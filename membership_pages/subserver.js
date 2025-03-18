import express from "express";
import admin from "firebase-admin";
import cors from "cors";
import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Buffer } from "buffer";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the .env file from outside the project
// GIORDAN: [THIS IS WHERE MY .ENV FILE IS LOCATED]
dotenv.config({ path: join(__dirname, "../.env") });

// ADI: dotenv.config({ path: join(__dirname, "../../acumen/.env") }); 

const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SECRETKEY_BASE64, "base64").toString("utf-8"));
console.log(serviceAccount)

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
  

const db = admin.firestore();
const app = express();

app.use(cors());

app.use(express.json());

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

app.listen(1989, () => console.log("Server running on port 1989"));

