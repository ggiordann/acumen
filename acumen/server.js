const PORT = 8000
const express = require('express')
const cors = require('cors')
const app = express()
app.use(cors())
app.use(express.json())
require('dotenv').config()
const fs = require('fs')
const multer = require('multer')
const OpenAI = require('openai')

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY })

const storage = multer.diskStorage({
    destination: ( req, file, cb ) => {
        cb(null, 'public')
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname)
    }
})

const upload = multer({ storage: storage }).single('file')

let filePath

app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            return res.status(500).json(err)
        }
        filePath = req.file.path
    })
})


app.post('/openai1', async (req, res) => {
    try {
        const { currency, condition, platforms, message } = req.body;
        const realString = platforms.join(", ");
        const prompt = "Provide a price estimate for the attached item in " + currency + ". The item is in " + condition + " condition. The user is interested in listing on the following platforms: " + realString + ". Here is extra information from the user: " + message;
        if (!filePath) {
            return res.status(400).json({ error: "No image uploaded." });
        }
        const imageAsBase64 = fs.readFileSync(filePath, 'base64');
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: {
                            url: `data:image/jpeg;base64,${imageAsBase64}`
                        }},
                    ]
                }
            ]
        })
        console.log(response.choices[0].message.content)
        res.send(response.choices[0].message.content)
    } catch (err) {
        console.error(err)
    }   
})

app.listen(PORT, () => console.log(`Listening on port ${PORT}`))
