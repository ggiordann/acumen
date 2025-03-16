import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2020-08-27'
})

const app = express();
app.use(express.json());
app.use(cors());

app.post('/createSubscription')