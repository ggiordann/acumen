// NODE SERVER.JS
// RUN INDEX.HTML USING LIVE SERVER EXTENSION

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import OpenAI from 'openai';
import dotenv from 'dotenv';
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
            { type: 'text', text: 'what do you see in this image?' }, // adi prompt engineer here
            // do something about "write heading: and then heading, also write description: and then description"
            // just set it up so it's easy to interact with gumtree API later
            // look at conditions to fill out .png image and CATEGORIES folder and prompt engineer accordingly
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

app.listen(port, () => {
  console.log(`server listening on port ${port}`);
});