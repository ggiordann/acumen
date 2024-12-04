const PORT = 8000
const express = require('express')
const cors = require('cors')
const app = express()
app.use(cors())
app.use(express.json())
require('dotenv').config()
const fs = require('fs')
const multer = require('multer')

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
        return res.status(200).json({ message: "Image uploaded successfully." })
    })
})

app.post('/openai', (req, res) => {
    const prompt = req.body.message
    console.log(prompt)
})

app.listen(PORT, () => console.log(`Listening on port ${PORT}`))
