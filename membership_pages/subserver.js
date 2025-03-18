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
        console.log("token verified");
        next()
    } catch (error){
        res.status(401).send("Invalid Token");
        console.log(error);
    }
}

app.post("/save-user", verifyToken, async (req, res) => {
    const { uid, email, name } = req.user;

    if (!uid) {
        return res.status(400).json({ error: "Invalid request: UID is missing" });
    }

    try {
        console.log("Db thing trying");
        const userDocRef =  db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();

        console.log("Db thing done");

        if (!userDoc.exists) {
            console.log("New user detected, saving to Firestore...");
            
            // Save new user to Firestore
            await userDocRef.set({
                email,
                name: name || "Unknown", // If Google OAuth doesn't return a name
                createdAt: new Date()
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

app.listen(1989, () => console.log("Server running on port 1989"));

