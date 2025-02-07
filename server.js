// NODE SERVER.JS
// RUN INDEX.HTML USING LIVE SERVER EXTENSION

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { postListing } from './fbMarketplacePoster.js';
dotenv.config();

const app = express();
const port = 5500;

// increased sigma size limt
app.use(bodyParser.json({ limit: '25mb' }));
app.use(bodyParser.urlencoded({ limit: '25mb', extended: true }));

app.use(cors());
app.use(express.json());

// configure openai
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// endpoint to analyze an image
app.post('/analyze', async (req, res) => {
  const { imageData } = req.body;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'write a facebook marketplace ad based on the product in the image. in the advertisement, provide a price estimate for the product displayed in the image. aud prices.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageData}` } }
          ]
        }
      ],
      max_tokens: 300
    });

    const answer = response.choices[0].message.content;
    res.json({ response: answer });
  } catch (error) {
    console.error('error analyzing image:', error);
    res.status(500).json({ error: 'error analyzing image' });
  }
});

// endpoint to post a facebook marketplace listing
app.post('/post-facebook', async (req, res) => {
  // get title, category, description, and imagePath from request body
  const { title, category, description, imagePath } = req.body;
  try {
    const result = await postListing({ title, category, description, imagePath });
    res.json({ success: result });
  } catch (error) {
    console.error('error posting facebook listing:', error);
    res.status(500).json({ error: error.toString() });
  }
});

app.listen(port, () => {
  console.log(`server listening on port ${port}`);
});