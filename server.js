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
const PORT = process.env.PORT || 1989;
const BASE_URL = process.env.DOMAIN || `http://localhost:${PORT}`;

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
                - Description – a detailed description of the product. At the end include a new line, and then "Generated by Acumen (acumen.ai)"
                - Availability – one of: ["List as single item", "List as in stock"]
                - Product Tags – a list of tags for the product.
                - Meetup Preferences – a list of meetup preferences, choose from: ["Public meetup", "Door pick-up", "Door drop-off"]
                - Hide from friends – a boolean value.

                OUTPUT RAW TEXT OUTPUT.

                EG.

                { "Title": "Casio FX-CG50 Graphing Calculator", "Price": 120, "Category": "Electronics & computers", "Condition": "Used – like new", "Brand": "Casio", "Description": "Lightly used Casio FX-CG50 graphing calculator in excellent condition. Perfect for students and professionals needing advanced calculation capabilities. Comes with original packaging, USB cable, and user manuals. Generated by Acumen (acumen.ai)", "Availability": "List as single item", "Product Tags": ["Calculator", "Graphing", "Casio", "FX-CG50", "Math"], "Meetup Preferences": ["Public meetup", "Door pick-up"], "Hide from friends": false }
                
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
                    - Title – a short, descriptive title for the listing.
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

                    - Description – a detailed description of the product in HTML formatting (use <br> for line breaks). End with a new line and then "Generated by Acumen (acumen.ai)".
                    - SearchTerm – a concise term to be used for searching the product on eBay.

                    EG.

                    { "Title": "Casio FX-CG50 Calculator", "Price": 99.99, "Condition": "Used", "Description": "Lightly used Casio FX-CG50 calculator in good working condition.<br>Perfect for students and professionals.<br>Generated by Acumen (acumen.ai)", "SearchTerm": "Casio FX-CG50 Calculator" }

                    DO NOT SPECIFY IT IS A JSON WITH ANY EXTRA TEXT EG DO NOT SAY "JSON Grave (DASH) Grave (DASH) Grave (DASH)" AND THEN THE JSON. JUST OUTPUT RAW JSON AS TEXT.
                    
                    LIKE THIS:

                    {"Title": "Casio FX-CG50 Calculator with Accessories", "Price": 120.00, "Condition": "Used", "Description": "Casio FX-CG50 calculator in good condition, includes original packaging and manuals.<br>Comes with cables and protective cover.<br>Ideal for students and professionals seeking a reliable graphing calculator.<br>Generated by Acumen (acumen.ai)", "SearchTerm": "Casio FX-CG50 Calculator" }

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

app.post('/post-facebook', async (req, res) => {
  const adData = req.body;
  try {
    const adDataStr = JSON.stringify(adData);
    exec(`node fb_post.spec.js '${adDataStr}'`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing fb_post.spec.js: ${error}`);
        return res.status(500).json({ error: stderr });
      }
      return res.json({ message: stdout });
    });
  } catch (error) {
    console.error('Error posting Facebook listing:', error);
    res.status(500).json({ error: error.toString() });
  }
});

app.post('/post-ebay', async (req, res) => {
  const adData = req.body;
  try {
    const adDataStr = JSON.stringify(adData);
    exec(`node ebay_post.spec.js '${adDataStr}'`, (error, stdout, stderr) => {
      if (error) {
         console.error(`Error executing ebay_post.spec.js: ${error}`);
         return res.status(500).send(stderr);
      }
      return res.send(stdout);
    });
  } catch (error) {
    console.error('Error posting eBay listing:', error);
    res.status(500).json({ error: error.toString() });
  }
});

app.get('/run-fb-login', (req, res) => {
  exec('node fb_login.spec.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing fb_login.spec.js: ${error}`);
      return res.status(500).send(stderr);
    }
    res.send(stdout);
  });
});

app.get('/run-ebay-login', (req, res) => {
  exec('node ebay_login.spec.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing ebay_login.spec.js: ${error}`);
      return res.status(500).send(stderr);
    }
    res.send(stdout);
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
    console.log("Firebase config sent");
    try {
        const firebaseConfigString = process.env.FIREBASE_API.replace(/'/g, '"');
        const firebaseConfig = JSON.parse(firebaseConfigString);
        res.json({ firebaseConfig: firebaseConfig });
    } catch (error) {
        console.error("Error with Firebase config:", error);
        res.status(500).send("Error with Firebase configuration");
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

// Start the server on defined PORT
app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});