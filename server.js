// NODE SERVER.JS
// RUN INDEX.HTML USING LIVE SERVER EXTENSION

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 8080;

app.use(cors());
app.use(bodyParser.json());
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
            {
              type: 'text',
              text: 'what do you see in this image?'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageData}`
              }
            }
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