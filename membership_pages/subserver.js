const express = require("express");
const admin = require('firebase-admin');
const serviceAccount = require("/acumenFirebaseSecretKey.json");
const cors = require("cors");
require("dotenv").config();

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore();
const app = express();

app.use(cors);
app.use(express.json);

async function verifyToken(req, res, next) {
    const idToken = req.headers.authorization?.split("Bearer ")[1];

    if (!idToken) {
        return res.status(401).send("Unauthorised");
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next()
    } catch (error){
        res.status(401).send("Invalid Token");
        console.log(error);
    }
}

app.post("/save-user", verifyToken, async (req, res) => {
    const {userId} = req.user;
    try {
        const userDoc = await db.collection("users").doc(uid).get();
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));

