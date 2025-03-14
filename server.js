import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import OpenAI from 'openai';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs';
import multer from 'multer';
dotenv.config();

const app = express();
const port = 5500;

app.use(bodyParser.json({ limit: '25mb' }));
app.use(bodyParser.urlencoded({ limit: '25mb', extended: true }));
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(process.cwd(), 'app'))); // coment out if not over network

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
const upload = multer({ storage: storage });

app.post('/upload', upload.array('files'), (req, res) => {
  res.json({ message: 'Files uploaded successfully', files: req.files });
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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

// New endpoint for eBay advertisement analysis
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
        return res.status(500).send(stderr);
      }
      return res.send(stdout);
    });
  } catch (error) {
    console.error('Error posting Facebook listing:', error);
    res.status(500).json({ error: error.toString() });
  }
});

// New endpoint for eBay posting
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

// CONNECTIONS TO PLATFORMS

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

app.listen(port, '0.0.0.0', () => { // comment out if not over network
  console.log(`Server listening on port ${port}`);
});