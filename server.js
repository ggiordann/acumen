// import dotenv for loading .env in ES module scope
import dotenv from 'dotenv'
dotenv.config()

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import OpenAI from 'openai';
import { chromium } from 'playwright';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs';
import multer from 'multer';
import admin from "firebase-admin";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Buffer } from "buffer";
import Stripe from 'stripe';
import { createProxyMiddleware } from 'http-proxy-middleware'; // Import the proxy middleware
import { browserPool } from './services/browserPool.js';
import http from 'http';
import WebSocketService from './services/websocketService.js';

// server.js: main express app that handles routes for file uploads, ai analysis, auth, stripe payments, and webhooks
// - loads env vars (dotenv) for secure secret management
// - initialises firebase-admin for auth and firestore access
// - sets up stripe client for checkout sessions and webhooks
// - defines middleware for parsing json and raw webhook payloads
// - serves static frontend assets from app/ and root

const __dirname = dirname(fileURLToPath(import.meta.url));

// initialise stripe client using secret key from environment
// stripe methods will be called for creating checkout sessions, managing subscriptions, and sending receipts
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// Initialise OpenAI client using API key from environment
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
// define port and base url for redirects
const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.DOMAIN || `http://localhost:${PORT}`;

// =============== MAINTENANCE MODE CONFIGURATION ===============
// MAINTENANCE MODE: When true, all traffic will be redirected to the maintenance.html page
// To disable maintenance mode, change this to false and restart the server
const MAINTENANCE_MODE = true; 
const MAINTENANCE_START_DATE = new Date('June 13, 2025');
const MAINTENANCE_END_DATE = new Date('August 15, 2025');

// Check if we're in the maintenance period
const isMaintenancePeriod = () => {
  const now = new Date();
  return MAINTENANCE_MODE && now >= MAINTENANCE_START_DATE && now <= MAINTENANCE_END_DATE;
};

// Maintenance mode middleware - must be applied before other routes
app.use((req, res, next) => {
  // Skip maintenance mode for webhook and API endpoints that need to remain functional
  if (isMaintenancePeriod() && 
      !req.path.startsWith('/webhook') && 
      !req.path.startsWith('/api/') &&
      req.path !== '/maintenance.html') {
    console.log(`Maintenance mode active: Redirecting ${req.path} to maintenance page`);
    return res.sendFile(path.join(__dirname, 'maintenance.html'));
  }
  next();
});

// --- Firebase Auth Proxy Setup ---
// Proxy requests to /__/auth/* to your Firebase project's auth handler
// This makes the auth flow appear to come from your domain, avoiding third-party cookie issues.
const firebaseAuthProxyTarget = 'https://acumen-2ead9.firebaseapp.com'; // Your Firebase project's default auth domain
app.use('/__/auth/', createProxyMiddleware({ // <--- Added trailing slash to match /__/auth/handler and other paths
  target: firebaseAuthProxyTarget,
  changeOrigin: true, // Important: Needed for virtual hosted sites like Firebase Hosting
  logLevel: 'debug', // Changed to debug for more detailed proxy logs during troubleshooting
  // No pathRewrite needed if the target path structure matches
  onProxyReq: (proxyReq, req, res) => {
    // Add the host header expected by Firebase
    proxyReq.setHeader('Host', new URL(firebaseAuthProxyTarget).host);
    console.log(`[Proxy] Forwarding ${req.method} ${req.originalUrl} to ${firebaseAuthProxyTarget}${req.url}`); // Added logging
  },
  onError: (err, req, res) => { // Added error logging
    console.error('[Proxy] Error:', err);
    res.writeHead(500, {
      'Content-Type': 'text/plain'
    });
    res.end('Proxy error occurred.');
  }
}));
// --- End Firebase Auth Proxy Setup ---

// Middleware setup
// middleware setup explanation:
// bodyParser.json with verify hook lets us capture rawBody for /webhook before JSON parsing
// bodyParser.urlencoded supports form submissions
// cors enables cross-origin resource sharing for frontend requests
// express.json is available for other endpoints as fallback
app.use(bodyParser.json({
  limit: '25mb',
  // verify raw body for webhook signature verification
  verify: (req, res, buf) => {
    if (req.originalUrl === '/webhook') {
      req.rawBody = buf;
    }
  }
}));
app.use(bodyParser.urlencoded({ limit: '25mb', extended: true }));
app.use(cors());
app.use(express.json());

// Serve intro_pages directory at root for test assets
app.use(express.static(path.join(__dirname, 'intro_pages')));

// Serve membership pages at root
app.use(express.static(path.join(__dirname, 'membership_pages')));

// Endpoint to return active user count without needing Firestore client rules
app.get('/active-users', async (req, res) => {
  const snapshot = await db.collection('users').get();
  res.json({ count: snapshot.size });
});

// Serve the test intro page as the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'intro_pages', 'test.html'));
});

app.use(express.static(path.join(process.cwd(), 'app'))); // comment out if not over network
app.use(express.static(path.join(process.cwd()))); // Serve files from project root

// File upload configuration
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({
  storage: storage,
  limits: { files: 10 }
});

// Initialise Firebase
const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SECRETKEY_BASE64, "base64").toString("utf-8"));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

//initialise globals
var uid, email, fullName = null;

// Firebase auth middleware
async function verifyToken(req, res, next) {
    const idToken = req.headers.authorization?.split("Bearer ")[1];

    if (!idToken) {
        return res.status(401).send("Unauthorised");
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        console.log("token verified");
        next();
    } catch (error){
        res.status(401).send("Invalid Token");
        console.log(error);
    }
}

// map plan names to our price IDs for stripe
const priceIds = {
  plus: 'price_1R4Az1IMPfgQ2CBGgRnSEebU',
  pro: 'price_1R4AzuIMPfgQ2CBGakghtEhV',
  premium: 'price_1R4B0WIMPfgQ2CBGJSZnF7oJ'
}

// ============== ENDPOINTS FROM SERVER.JS ==============

app.post('/upload', upload.array('files', 10), (req, res) => {
  res.json({ message: 'Files uploaded successfully', files: req.files });
});

app.post('/analyze', async (req, res) => {
  const { imageData } = req.body;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `
                Write a facebook marketplace Advertisement based on the product in the image.

                DO NOT USE ANY EMOJIS IN THE LISTING. DO NOT USE ANY SINGLE QUOTES IN THE DESCRIPTION, USE SOMETHING ELSE.

                Fill it out in JSON format with the following fields:
                - Title – a short, descriptive title for the listing.
                - Price – a price estimate for the product in AUD.
                - Category – choose the most suitable category from:
                  ["Tools", "Furniture", "Household", "Garden", "Appliances", 
                  "Video Games", "Books, Films & Music",
                  "Bags & Luggage", "Women's clothing & shoes", "Men's clothing & shoes", "Jewellery and accessories",
                  "Health & Beauty", "Pet supplies", "Baby & children", "Toys and games",
                  "Electronics & computers", "Mobile phones",
                  "Bicycles", "Arts & crafts", "Sport and outdoors", "Car parts", "Musical Instruments", "Antiques and collectibles",
                  "Garage sale", "Miscellaneous", "Vehicles"]
                - Condition – one of: ["New", "Used – like new", "Used – good", "Used – fair"]
                - Brand – the brand of the product (if applicable; leave blank if unknown)
                - Description – a detailed description of the product. At the end include a new line, and then "Generated by Acumen (useacumen.co)"
                - Availability – one of: ["List as single item", "List as in stock"]
                - Product Tags – a list of tags for the product.
                - Meetup Preferences – a list of meetup preferences, choose from: ["Public meetup", "Door pick-up", "Door drop-off"]
                - Hide from friends – a boolean value.

                OUTPUT RAW TEXT OUTPUT.

                EG.

                { "Title": "Casio FX-CG50 Graphing Calculator", "Price": 120, "Category": "Electronics & computers", "Condition": "Used – like new", "Brand": "Casio", "Description": "Lightly used Casio FX-CG50 graphing calculator in excellent condition. Perfect for students and professionals needing advanced calculation capabilities. Comes with original packaging, USB cable, and user manuals. Generated by Acumen (useacumen.co)", "Availability": "List as single item", "Product Tags": ["Calculator", "Graphing", "Casio", "FX-CG50", "Math"], "Meetup Preferences": ["Public meetup", "Door pick-up"], "Hide from friends": false }
                
                DO NOT SPECIFY IT IS A JSON WITH ANY EXTRA TEXT.
            ` },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageData}` } }
          ]
        }
      ],
      max_tokens: 300
    });
    const answer = response.choices[0].message.content;
    res.json({ response: answer });
  } catch (error) {
    console.error('Error analyzing image:', error);
    res.status(500).json({ error: 'Error analyzing image' });
  }
});

app.post('/analyze-ebay', async (req, res) => {
  const { imageData } = req.body;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `
                    Write an eBay advertisement for the product in the image.

                    DO NOT USE ANY EMOJIS IN THE LISTING.

                    Fill it out in RAW JSON format with the following fields exactly:
                    - Title – an above average length descriptive title for the listing 80 characters max, include details such as brand, colour, size, specs, condition, etc but still keep concise.
                    - Price – a price estimate for the product in AUD.
                    - Condition for different Categories – one of:

                        For Calculators and Electronics:
                          ["Brand New", "New: Never Used", "Seller refurbished", "Used", "For parts or not working"].

                        For Hats:
                          ["New with tags", "New without tags", "New with defects", "Pre-Owned"].

                        For Shoes:
                          ["New with box", "New without box", "New with Imperfections", "Pre-owned"].

                        For Books:
                          ["Brand New", "Like New", "Very Good", "Good", "Acceptable"].

                        For Clothing:
                          ["New with tags", "New without tags", "New with defects", "Pre-Owned"].

                        For Video Games:
                          ["Brand New", "New: Never Used", "Used", "For parts or not working"].

                        For Watches:
                          ["Brand New", "Pre-owned", "Certified Pre-owned", "For parts or not working"].

                        For Furniture:
                          ["New", "Used"].

                        For Collectibles:
                          ["Brand New", "Used", "For parts or not working"].

                    - Description – a detailed description of the product in HTML formatting (use <br> for line breaks). End with a new line and then "Generated by Acumen (useacumen.co)".
                    - SearchTerm – a concise term to be used for searching the product on eBay.

                    EG.

                    { "Title": "Casio FX-CG50 Calculator", "Price": 99.99, "Condition": "Used", "Description": "Lightly used Casio FX-CG50 calculator in good working condition.<br>Perfect for students and professionals.<br>Generated by Acumen (useacumen.co)", "SearchTerm": "Casio FX-CG50 Calculator" }

                    DO NOT SPECIFY IT IS A JSON WITH ANY EXTRA TEXT EG DO NOT SAY "JSON Grave (DASH) Grave (DASH) Grave (DASH)" AND THEN THE JSON. JUST OUTPUT RAW JSON AS TEXT.
                    
                    LIKE THIS:

                    {"Title": "Casio FX-CG50 Calculator with Accessories", "Price": 120.00, "Condition": "Used", "Description": "Casio FX-CG50 calculator in good condition, includes original packaging and manuals.<br>Comes with cables and protective cover.<br>Ideal for students and professionals seeking a reliable graphing calculator.<br>Generated by Acumen (useacumen.co)", "SearchTerm": "Casio FX-CG50 Calculator" }

                    SEE, NO DASHES. DO NOT INCLUDE ´´´ JSON OR I WILL TERMINATE YOU

                    DO NOT INCLUDE ANY ADDITIONAL TEXT. CONDITION SHOULD BE THE EXACT SAME TEXT AS CONDITIONS FROM THE ARRAY STATES ABOVE.
            ` },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageData}` } }
          ]
        }
      ],
      max_tokens: 300
    });
    const answer = response.choices[0].message.content;
    res.json({ response: answer });
  } catch (error) {
    console.error('Error analyzing image for eBay:', error);
    res.status(500).json({ error: 'Error analyzing image for eBay' });
  }
});

app.post('/analyze-gumtree', async (req, res) => {
  const { imageData } = req.body;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `
              Write a Gumtree advertisement based on the product in the image.
              Fill it out in JSON format with the following fields exactly:
              - Title: a short descriptive title.
              - Price: estimated price in AUD.
              - CategoryPath: an array of two strings [Category, Subcategory], choose from:
                Categories: ["Antiques, Art & Collectables","Baby & Children","Boats & Jet Skis","Books & Music & Games","Cars & Vehicles","Clothing & Jewellery","Community","Electronics & Computer","Home & Garden","Jobs","Miscellaneous Goods","Pets","Real Estate","Services For Hire","Sport & Fitness","Tickets"]
                Subcategories:
                  "Antiques, Art & Collectables": ["Antiques","Art","Collectables","Other Antiques, Art & Collectables"],
                  "Baby & Children": ["Baby Carriers","Baby Clothing","Baths","Cots & Bedding","Feeding","Kids Clothing","Maternity Clothing","Other Baby & Children","Prams & Strollers","Safety","Toys - Indoor","Toys - Outdoor"],
                  "Boats & Jet Skis": ["Boat Accessories & Parts","Jet Skis","Kayaks & Paddle","Motorboats & Powerboats","Other Boats & Jet Skis","Sail Boats","Tinnies & Dinghies"],
                  "Books, Music & Games": ["Board Games","Books","CDs & DVDs","Musical Instruments","Other Books, Music & Games"],
                  "Cars & Vehicles": ["Caravans & Campervans","Cars, Vans & Utes","Construction Vehicles & Equipment","Farming Vehicles & Equipment","Motorcycles & Scooters","Other Automotive","Parts & Accessories","Trailers","Trucks"],
                  "Clothing & Jewellery": ["Accessories","Bags","Jewellery","Men’s Clothing","Men’s Shoes","Women’s Clothing","Women’s Shoes"],
                  "Community": ["Activities & Hobbies","Classes","Dance Partners","Events","Garage Sale","Language Swap","Lost & Found","Missed Connections","Musicians & Artists","Other Community","Rideshare & Travel Partners","Sports Partners"],
                  "Electronics & Computer": ["Audio","Cameras","Computers & Software","Other Electronics & Computers","Phones","TV & DVD players","Tablets & eBooks","Video Games & Consoles"],
                  "Home & Garden": ["Appliances","Building Materials","Furniture","Garden","Home Decor","Kitchen & Dining","Lighting","Other Home & Garden","Tools & DIY"],
                  "Jobs": ["Accounting","Administration & Office Support","Advertising, Arts & Media","Banking & Financial Services","Call Centre & Customer Service","Community Services & Development","Construction","Design & Architecture","Education & Teaching","Engineering","Farming & Veterinary","Government & Defence","Healthcare & Nursing","Hospitality & Tourism","Information & Communication Technology","Legal","Manufacturing, Transport & Logistics","Marketing & Communications","Mining, Resources & Energy","Other Jobs","Real Estate & Property","Recruitment & HR","Retail","Sales","Sports & Recreation","Trades & Services"],
                  "Miscellaneous Goods": ["Miscellaneous Goods"],
                  "Pets": ["Birds","Cats & Kittens","Dogs & Puppies","Fish","Horses & Ponies","Livestock","Lost & Found","Other Pets","Pet Products","Rabbits","Reptiles & Amphibians"],
                  "Real Estate": ["Business For Sale","Flatshare & Houseshare","Land For Sale","Office Space & Commercial","Other Real Estate","Parking & Storage","Property For Sale","Property for Rent","Roomshare","Short Term"],
                  "Services For Hire": ["Automotive","Building & Construction","Childcare & Nanny","Cleaning","Computer, Telecom & Freelance","Dress Making & Alterations","Health, Fitness & Beauty","Hiring","Landscaping & Gardening","Learning & Tutoring","Other Business Services","Pet Services","Photography & Video","Real Estate","Removals & Storage","Tax, Insurance & Financial","Taxi, Chauffeur & Airport Transfer","Weddings & Parties"],
                  "Sport & Fitness": ["Bicycles","Boxing & Martial Arts","Camping & Hiking","Fishing","Golf","Gym & Fitness","Other Sports & Fitness","Racquet Sports","Rock Climbing","Skateboards & Rollerblades","Snow Sports","Sports Bags","Surfing"],
                  "Tickets": ["Bus, Train & Plane","Concerts","Other Tickets","Sport","Theatre/Film"]
              
              - Condition: one of ["New","Used"].
              - Description: a detailed description. End with a new line and then "Generated by Acumen (useacumen.co)".
              Output only raw JSON text, no additional commentary. DO NOT WRITE "JSON" OR "GRAVE GRAVE GRAVE" OR ANYTHING ELSE. JUST RAW JSON.
            ` },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageData}` } }
          ]
        }
      ],
      max_tokens: 300
    });
    const answer = response.choices[0].message.content;
    res.json({ response: answer });
  } catch (error) {
    console.error('Error analyzing image for Gumtree:', error);
    res.status(500).json({ error: 'Error analyzing image for Gumtree' });
  }
});

const BROWSER_POOL_SIZE = process.env.BROWSER_POOL_SIZE || 3;

// Initialize browser pool when server starts
browserPool.initialize(BROWSER_POOL_SIZE)
    .catch(err => console.error('Failed to initialize browser pool:', err));

// Cleanup on server shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, cleaning up...');
    await browserPool.cleanup();
    process.exit(0);
});

// Create HTTP server instance
const server = http.createServer(app);

// Initialize WebSocket service with server instance
const wsService = new WebSocketService(server);

// HTTP/WebSocket server listens on PORT and host 0.0.0.0
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP/WebSocket server running on port ${PORT}`);
});

// Initialize browser pool when auth state changes
app.post('/save-user', verifyToken, async (req, res) => {
    try {
        ({ uid, email, fullName } = req.user);

        if (!uid) {
            return res.status(400).json({ error: "Invalid request: UID is missing" });
        }

        console.log("Db thing trying");
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();

        console.log("Db thing done");

        if (!userDoc.exists) {
            console.log("New user detected, saving to Firestore...");
             
            // Create a Stripe customer for the new user
            let stripeCustomerId = null;
            try {
                const customer = await stripe.customers.create({
                    email: email,
                    name: fullName || "Unknown",
                    metadata: {
                        firebaseUID: uid
                    }
                });
                stripeCustomerId = customer.id;
                console.log(`Created Stripe customer: ${stripeCustomerId} for user: ${uid}`);
            } catch (stripeError) {
                console.error("Error creating Stripe customer:", stripeError);
                // Continue even if Stripe customer creation fails
            }
            
            // Save new user to Firestore with Stripe customer ID
            await userDocRef.set({
                email,
                name: fullName || "Unknown", // If Google OAuth doesn't return a name
                createdAt: new Date(),
                stripeCustomerId: stripeCustomerId,
                subscription: {
                  subscriptionLevel:"free",
                  status: "none",
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
            });
            return res.json({ message: "New user created", email, uid });
        }

        // Initialize browser pool for new user session
        await browserPool.initialize();
        
        console.log("Existing user Logged in");
        return res.json({ message: "Existing user", email, uid });

    } catch (error) {
        console.log("Error: " + error.message);
        res.status(500).send(error.message);
    }
});

// Update post endpoints to use browser contexts
app.post('/post-facebook', verifyToken, async (req, res) => {
  const adData = req.body;
  try {
    const context = await browserPool.getContext(req.user.uid, 'facebook');
    // Send status update through WebSocket
    wsService.sendToUser(req.user.uid, { 
      status: 'starting',
      message: 'Initialising Facebook posting'
    });

    const adDataStr = JSON.stringify(adData);
    const fbCmd = 'node fb_post.spec.js';
    const prefix = process.platform === 'darwin' ? '' : 'xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" ';
    const command = `${prefix}${fbCmd}`;
    console.log(`Executing command: ${command} with AD_DATA env var`);
    exec(command, { env: { ...process.env, AD_DATA: adDataStr } }, (error, stdout, stderr) => {
      const output = stdout + stderr;
      wsService.sendToUser(req.user.uid, { 
        status: 'progress',
        message: output
      });
      console.log(`Output from command: ${output}`); 
      if (error) {
        console.error(`Error executing command: ${error}`);
        // Check if it's a session error from the script's stdout
        if (output.startsWith('SESSION_ERROR:')) {
          // Send 401 Unauthorized with a more specific message
          const specificError = output.replace('SESSION_ERROR: ', '').trim();
          return res.status(401).json({ error: `Facebook session error: ${specificError}. Please try logging into Facebook again via Acumen.` });
        }
        // Otherwise, send a generic 500 error
        return res.status(500).json({ error: output || error.message }); 
      }
      return res.json({ message: output });
    });
  } catch (error) {
    wsService.sendToUser(req.user.uid, {
      status: 'error',
      message: error.toString()
    });
    console.error('Error posting Facebook listing:', error);
    res.status(500).json({ error: error.toString() });
  }
});

// Similar updates for Gumtree endpoint
app.post('/post-gumtree', verifyToken, async (req, res) => {
  const adData = req.body;
  try {
    const context = await browserPool.getContext(req.user.uid, 'gumtree');
    wsService.sendToUser(req.user.uid, {
      status: 'starting',
      message: 'Initializing Gumtree posting'
    });

    const adDataStr = JSON.stringify(adData);
    const gumCmd = 'node gumtree_post.spec.js';
    const prefixG = process.platform === 'darwin' ? '' : 'xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" ';
    const command = `${prefixG}${gumCmd}`;
    console.log(`Executing command: ${command} with AD_DATA env var`);
    exec(command, { env: { ...process.env, AD_DATA: adDataStr } }, (error, stdout, stderr) => {
      const output = stdout + stderr;
      console.log(`Output from command: ${output}`);
      if (error) {
        console.error(`Error executing command: ${error}`);
        // Check if it's a session error from the script's stdout
        if (output.startsWith('SESSION_ERROR:')) {
          // Send 401 Unauthorized with the specific message
          return res.status(401).send(output.replace('SESSION_ERROR: ', ''));
        }
        // Otherwise, send a generic 500 error
        return res.status(500).send(output || error.message);
      }
      res.send(output);
    });
  } catch (error) {
    console.error('Error posting to Gumtree:', error);
    res.status(500).json({ error: error.toString() });
  }
});

app.post('/post-ebay', async (req, res) => {
  const adData = req.body;
  try {
    const adDataStr = JSON.stringify(adData);
    const ebayCmd = 'node ebay_post.spec.js';
    const prefixE = process.platform === 'darwin' ? '' : 'xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" ';
    const command = `${prefixE}${ebayCmd}`;
    console.log(`Executing command: ${command} with AD_DATA env var`);
    exec(command, { env: { ...process.env, AD_DATA: adDataStr } }, (error, stdout, stderr) => {
      const output = stdout + stderr;
      console.log(`Output from command: ${output}`);
      if (error) {
         console.error(`Error executing command: ${error}`);
         // Check if it's a session error from the script's stdout
         if (output.startsWith('SESSION_ERROR:')) {
           // Send 401 Unauthorized with the specific message
           return res.status(401).send(output.replace('SESSION_ERROR: ', ''));
         }
         // Otherwise, send a generic 500 error
         return res.status(500).send(output || error.message);
      }
      return res.send(output);
    });
  } catch (error) {
    console.error('Error posting eBay listing:', error);
    res.status(500).json({ error: error.toString() });
  }
});

app.get('/run-fb-login', (req, res) => {
  const loginFbCmd = 'node fb_login.spec.js';
  const prefixLf = process.platform === 'darwin' ? '' : 'xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" ';
  const command = `${prefixLf}${loginFbCmd}`;
  console.log(`Executing command: ${command}`);
  exec(command, (error, stdout, stderr) => {
    const output = stdout + stderr;
    console.log(`Output from command: ${output}`);
    if (error) {
      console.error(`Error executing command: ${error}`);
      return res.status(500).send(output || error.message); 
    }
    res.send(output);
  });
});

app.get('/run-ebay-login', (req, res) => {
  const loginEbCmd = 'node ebay_login.spec.js';
  const prefixLe = process.platform === 'darwin' ? '' : 'xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" ';
  const command = `${prefixLe}${loginEbCmd}`;
  console.log(`Executing command: ${command}`);
  exec(command, (error, stdout, stderr) => {
    const output = stdout + stderr;
    console.log(`Output from command: ${output}`);
    if (error) {
      console.error(`Error executing command: ${error}`);
      return res.status(500).send(output || error.message);
    }
    res.send(output);
  });
});

app.get('/run-gumtree-login', (req, res) => {
  const loginGCmd = 'node gumtree_login.spec.js';
  const prefixLg = process.platform === 'darwin' ? '' : 'xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" ';
  const command = `${prefixLg}${loginGCmd}`;
  console.log(`Executing command: ${command}`);
  exec(command, (error, stdout, stderr) => {
    const output = stdout + stderr;
    console.log(`Output from command: ${output}`);
    if (error) {
      console.error(`Error executing command: ${error}`);
      return res.status(500).send(output || error.message);
    }
    res.send(output);
  });
});

// stripe webhook endpoint must be placed after raw body capture but before any json parsers in effect for this route

/*

terminal output unhandled explanation:

“unhandled stripe event type: invoice.payment_succeeded” is just our default‐case log 
letting us know we didn’t write any custom logic for that specific event. 
it isn’t an error—stripe delivered the webhook (200 in the cli)
it  means “i got this event but i don’t know what to do with it"
if we need to react to invoice.payment_succeeded (e.g. grant access, send email, update billing records),
add a case 'invoice.payment_succeeded': block in our webhook handler. 
otherwise we can safely ignore unhandled events.


*/

// note: stripe cli must be running to forward webhook events locally

//====================================================
// stripe listen --forward-to localhost:1989/webhook
//====================================================

// stripe cli creates a public tunnel so stripe's servers can reach our localhost endpoint
// we need to restart this command whenever we restart our server or reconnect our internet
// without the tunnel, stripe cannot deliver events to our development environment

// webhook handler logic:
// 1. stripe CLI creates tunnel and forwards webhook POST to /webhook
// 2. verify signature using rawBody and STRIPE_WEBHOOK_SECRET
// 3. switch on event.type to handle:
//    - checkout.session.completed: cancel previous subscription to avoid double billing, update firestore
//    - invoice.payment_succeeded: send email receipt via stripe.charges.sendReceipt
//    - default: log unhandled events safely without error
// 4. respond with 200 to acknowledge receipt and prevent retries
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    // use rawBody captured by bodyParser.verify when content-type is application/json
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('webhook signature verification failed:', err.message);
    return res.status(400).send(`webhook error: ${err.message}`);
  }

  // handle different stripe event types here
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const { userId, plan } = session.metadata || {};
      const newSubscriptionId = session.subscription;
      if (userId) {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const oldSubscriptionId = userDoc.data()?.subscription?.id;
        if (oldSubscriptionId && oldSubscriptionId !== newSubscriptionId) {
          try {
            // cancel previous subscription immediately to avoid double billing
            await stripe.subscriptions.del(oldSubscriptionId);
            console.log(`cancelled old subscription ${oldSubscriptionId} for user ${userId}`);
          } catch (cancelErr) {
            console.error(`error cancelling old subscription ${oldSubscriptionId}:`, cancelErr);
          }
        }
        // update firestore with new subscription details
        await userRef.update({
          stripeCustomerId: session.customer,
          subscription: {
            id: newSubscriptionId,
            subscriptionLevel: plan,
            status: 'active',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }
        });
        console.log(`updated user ${userId} with new subscription ${newSubscriptionId}`);
      }
      break;
    }
    // send email receipts when invoice payment succeeds
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      const chargeId = invoice.charge;
      if (chargeId) {
        try {
          await stripe.charges.sendReceipt(chargeId);
          console.log(`sent receipt for charge ${chargeId}`);
        } catch (sendErr) {
          console.error(`error sending receipt for charge ${chargeId}:`, sendErr);
        }
      }
      break;
    }
    // other event types: subscription updates, payment intent, etc.
    default:
      console.log(`unhandled stripe event type: ${event.type}`);
  }

  // acknowledge receipt of event
  res.status(200).send('received');
});

// ============== ENDPOINTS FROM SUBSERVER.JS ==============

app.post("/save-user", verifyToken, async (req, res) => {
    ({ uid, email, fullName } = req.user);

    if (!uid) {
        return res.status(400).json({ error: "Invalid request: UID is missing" });
    }

    try {
        console.log("Db thing trying");
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();

        console.log("Db thing done");

        if (!userDoc.exists) {
            console.log("New user detected, saving to Firestore...");
             
            // Create a Stripe customer for the new user
            let stripeCustomerId = null;
            try {
                const customer = await stripe.customers.create({
                    email: email,
                    name: fullName || "Unknown",
                    metadata: {
                        firebaseUID: uid
                    }
                });
                stripeCustomerId = customer.id;
                console.log(`Created Stripe customer: ${stripeCustomerId} for user: ${uid}`);
            } catch (stripeError) {
                console.error("Error creating Stripe customer:", stripeError);
                // Continue even if Stripe customer creation fails
            }
            
            // Save new user to Firestore with Stripe customer ID
            await userDocRef.set({
                email,
                name: fullName || "Unknown", // If Google OAuth doesn't return a name
                createdAt: new Date(),
                stripeCustomerId: stripeCustomerId,
                subscription: {
                  subscriptionLevel:"free",
                  status: "none",
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
            });
            return res.json({ message: "New user created", email, uid });
        }

        console.log("Existing user Logged in");
        return res.json({ message: "Existing user", email, uid });

    } catch (error) {
        console.log("Error: " + error.message);
        res.status(500).send(error.message);
    }
});

app.get("/get-api-key", async(req, res) => {
    console.log("Firebase config requested"); // Modified log
    try {
        const firebaseConfigString = process.env.FIREBASE_API.replace(/'/g, '"');
        const firebaseConfig = JSON.parse(firebaseConfigString);

        // *** FIX: Always use the default Firebase auth domain for the client SDK ***
        // The server-side proxy will handle routing correctly for local development.
        // In production (on useacumen.co), Firebase Hosting handles __/auth automatically.
        firebaseConfig.authDomain = "acumen-2ead9.firebaseapp.com"; 
        
        console.log("Sending Firebase config with authDomain:", firebaseConfig.authDomain); // Log the domain being sent
        res.json({ firebaseConfig: firebaseConfig });
    } catch (error) {
        console.error("Error processing Firebase config:", error); // Modified log
        res.status(500).send("Error processing Firebase configuration"); // Modified log
    }
});

app.get("/get-user-id", async (req, res) => {
    res.json({ userId: uid });
})

// =============== STRIPE ENDPOINTS ===============

// create-checkout-session route logic:
// 1. read plan and uid from client request body
// 2. fetch user email from firestore to prefill checkout
// 3. create stripe checkout.session with subscription mode, line items, success/cancel URLs
// 4. attach client_reference_id and metadata for identifying user in webhook
// 5. return session id and url so frontend can redirect customer to hosted checkout page
app.post('/create-checkout-session', async (req, res) => {
  const { plan, uid } = req.body

  // look up the customer email securely from firestore
  const userSnap = await db.collection('users').doc(uid).get()
  const customerEmail = userSnap.data().email

  try {
    // create a checkout session in stripe
    // mode is required when we use price IDs for subscriptions
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',                // recurring billing mode
      line_items: [{ price: priceIds[plan], quantity: 1 }],
      customer_email: customerEmail,       // prefill email in checkout
      client_reference_id: uid,            // identify user in webhook events
      metadata: { plan, userId: uid },     // extra data for webhook payload
      success_url: `${BASE_URL}/membership_pages/success.html?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url: `${BASE_URL}/membership_pages/subscription.html`
    })

    // respond with session id and url so client can redirect
    res.json({ id: session.id, url: session.url })
  } catch (err) {
    console.error('error creating checkout session:', err.message)
    res.status(500).json({ error: err.message })
  }
})

//when customer clicks cancel subscription button. 
//rn it instantly deletes for testing but later we can make it end at period end
app.post('/cancel-subscription', async (req, res) => {
  const { uid } = req.body; // 'uid' is the user's Firebase ID

  try {
    // Look up the user in Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).send({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const subscriptionId = userData.subscription?.id;
    
    if (!subscriptionId) {
      return res.status(400).send({ error: 'No active subscription found' });
    }
    
    // Cancel the subscription in Stripe
    const result = await stripe.subscriptions.cancel(subscriptionId);
    
    // Update the user's subscription status in Firestore
    await db.collection('users').doc(uid).update({
      subscription: {
        subscriptionLevel: "free",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "cancelled"
      }
    });

    return res.status(200).send({ success: true, message: 'Subscription cancelled' });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return res.status(500).send({ error: 'Internal server error' });
  }
})

// Verify a Stripe session status directly
app.get('/verify-session', verifyToken, async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Missing session_id parameter' });
    }
    
    console.log(`Verifying Stripe session ${session_id}`);
    
    // Get the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    // Check payment status
    const isComplete = session && session.payment_status === 'paid';
    const customerId = session.customer;
    const subscriptionId = session.subscription;
    const metadata = session.metadata || {};
    
    console.log(`Session verification: payment_status=${session.payment_status}, customer=${customerId}, subscription=${subscriptionId}`);
    
    if (isComplete && subscriptionId) {
      // Get subscription details
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      // Get the plan ID and map to plan name
      const planId = subscription.items.data[0].plan.id;
      let planName = "free";
      
      if (planId === 'price_1R4Az1IMPfgQ2CBGgRnSEebU') planName = "plus";
      else if (planId === 'price_1R4AzuIMPfgQ2CBGakghtEhV') planName = "pro";
      else if (planId === 'price_1R4B0WIMPfgQ2CBGJSZnF7oJ') planName = "premium";
      
      console.log(`Subscription plan: ${planName}`);
      
      // Check if user ID in request matches the one in session metadata
      const userId = metadata.userId || req.user.uid;
      
      if (userId) {
        // Update the user's Firestore document
        await db.collection('users').doc(userId).update({
          stripeCustomerId: customerId,
          subscription: {
            id: subscriptionId,
            subscriptionLevel: planName,
            status: subscription.status,
            periodStart: subscription.current_period_start,
            periodEnd: subscription.current_period_end,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }
        });
        
        console.log(`Updated user ${userId} with subscription ${subscriptionId}`);
        return res.json({ 
          verified: true, 
          plan: planName, 
          status: subscription.status 
        });
      }
    }
    
    return res.json({ 
      verified: isComplete, 
      metadata: metadata 
    });
    
  } catch (error) {
    console.error('Error verifying session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Force update a user's subscription based on session ID
app.post('/force-update-subscription', verifyToken, async (req, res) => {
  try {
    const { uid, session_id, plan } = req.body;
    
    // Make sure this is the same user making the request or an admin
    if (uid !== req.user.uid) {
      return res.status(403).json({ error: 'Unauthorised access' });
    }
    
    console.log(`Force updating subscription for user ${uid} to plan ${plan}`);
    
    // Get user data
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const stripeCustomerId = userData.stripeCustomerId;
    
    if (!stripeCustomerId) {
      console.error("No Stripe customer ID for user");
      return res.status(400).json({ error: 'No Stripe customer ID for user' });
    }
    
    let subscriptionId = null;
    
    // If we have a session ID, try to get subscription from it
    if (session_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        subscriptionId = session.subscription;
        console.log(`Retrieved subscription ID ${subscriptionId} from session ${session_id}`);
      } catch (stripeError) {
        console.error("Error retrieving session from Stripe:", stripeError);
      }
    }
    
    // If no subscription ID from session, try to create/update via Stripe API
    if (!subscriptionId) {
      try {
        // Check if user already has a subscription
        const existingSubscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          limit: 1,
          status: 'all'
        });
        
        if (existingSubscriptions.data.length > 0) {
          // Update existing subscription
          const existingSubscription = existingSubscriptions.data[0];
          subscriptionId = existingSubscription.id;
          
          console.log(`Found existing subscription ${subscriptionId} for customer ${stripeCustomerId}`);
          
          // If subscription is canceled, create a new one instead
          if (existingSubscription.status === 'canceled') {
            console.log("Existing subscription is canceled, creating new one");
            subscriptionId = null;
          }
        }
        
        // Map plan to price ID
        const priceIds = {
          plus: 'price_1R4Az1IMPfgQ2CBGgRnSEebU',
          pro: 'price_1R4AzuIMPfgQ2CBGakghtEhV',
          premium: 'price_1R4B0WIMPfgQ2CBGJSZnF7oJ'
        };
        
        const priceId = priceIds[plan] || priceIds.plus;
        
        if (!subscriptionId) {
          // Create new subscription
          const newSubscription = await stripe.subscriptions.create({
            customer: stripeCustomerId,
            items: [{ price: priceId }],
            metadata: {
              firebaseUID: uid
            }
          });
          
          subscriptionId = newSubscription.id;
          console.log(`Created new subscription ${subscriptionId} for customer ${stripeCustomerId}`);
        } else {
          // Update existing subscription
          const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
            items: [{
              id: existingSubscriptions.data[0].items.data[0].id,
              price: priceId
            }],
            metadata: {
              firebaseUID: uid
            }
          });
          
          console.log(`Updated subscription ${subscriptionId} for customer ${stripeCustomerId}`);
        }
      } catch (stripeError) {
        console.error("Error updating subscription via Stripe API:", stripeError);
      }
    }
    
    // Update user document in Firestore
    await db.collection('users').doc(uid).update({
      subscription: {
        id: subscriptionId,
        subscriptionLevel: plan,
        status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }
    });
    
    console.log(`Force updated user ${uid} subscription in Firestore to ${plan}`);
    
    return res.json({
      success: true,
      plan: plan,
      subscriptionId: subscriptionId || 'manual-update'
    });
    
  } catch (error) {
    console.error('Error forcing subscription update:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

//multiple use function to update user subscription
async function updateCustomerSubscription(customerId, subscriptionId, invoice) {
  try {
    // Query Firestore for users with this stripeCustomerId
    const usersSnapshot = await db.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .get();

    if (usersSnapshot.empty) {
      console.log(`No user found with stripeCustomerId: ${customerId}`);
      return;
    }

    let subscriptionData;
    
    // If there is invoice, update/add subscription, otherwise cancel plan
    if (invoice !== "cancelled") {
      // Get subscription details from Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const planId = subscription.items.data[0].plan.id;
      
      // Map plan ID to plan name
      let planName = "free";
      if (planId === 'price_1R4Az1IMPfgQ2CBGgRnSEebU') planName = "plus";
      else if (planId === 'price_1R4AzuIMPfgQ2CBGakghtEhV') planName = "pro";
      else if (planId === 'price_1R4B0WIMPfgQ2CBGJSZnF7oJ') planName = "premium";
      
      subscriptionData = {
        id: subscriptionId,
        subscriptionLevel: planName,
        periodStart: subscription.current_period_start,
        periodEnd: subscription.current_period_end,
        status: subscription.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    } else {
      subscriptionData = {
        subscriptionLevel: "free",
        status: "cancelled",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    }

    // Update for every matching user
    usersSnapshot.forEach(doc => {
      doc.ref.update({
        subscription: subscriptionData
      });
      console.log(`Updated subscription for user ${doc.id}`);
    });
  } catch (error) {
    console.error('Error updating user subscription:', error);
  }
}

// Get user subscription endpoint
app.get('/get-user-subscription', verifyToken, async (req, res) => {
  try {
    const { uid } = req.query;
    
    // Make sure this is the same user making the request
    if (uid !== req.user.uid) {
      return res.status(403).json({ error: 'Unauthorised access to subscription data' });
    }
    
    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    
    // Return subscription data
    return res.json({ 
      subscription: userData.subscription || { subscriptionLevel: 'free' }
    });
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add endpoint to fetch monthly usage securely
app.get('/get-monthly-usage', verifyToken, async (req, res) => {
    const uidParam = req.query.uid;
    if (!uidParam || uidParam !== req.user.uid) {
        return res.status(403).json({ error: 'Unauthorised access to usage data' });
    }
    try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const snapshot = await db.collection('listings')
            .where('uid', '==', uidParam)
            .where('createdAt', '>=', start)
            .get();
        return res.json({ usage: snapshot.size });
    } catch (error) {
        console.error('Error in get-monthly-usage:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Record a new listing for usage tracking
app.post('/record-listing', verifyToken, async (req, res) => {
    const uidParam = req.body.uid;
    if (!uidParam || uidParam !== req.user.uid) {
        return res.status(403).json({ error: 'Unauthorised to record listing' });
    }
    try {
        await db.collection('listings').add({
            uid: uidParam,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.json({ success: true });
    } catch (error) {
        console.error('Error recording listing:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});