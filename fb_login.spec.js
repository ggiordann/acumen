import {chromium} from 'playwright';
import path from 'path';
import { configDotenv } from 'dotenv';

configDotenv('.env');

const __dirname = import.meta.dirname;
const savePath = path.join(__dirname, 'facebook_session.json');

const fb_username = process.env.FB_EMAIL
const fb_password = process.env.FB_PASSWORD


async function loginandsaveState() {
    const browser = await chromium.launch({headless:false});
    const context = await browser.newContext();
    const page = await context.newPage()

    // remove all of below

    await page.goto('https://www.facebook.com/');
    await page.getByTestId('royal-email').click();
    await page.getByTestId('royal-email').fill(process.env.FB_EMAIL);
    await page.getByTestId('royal-pass').click(fb_username);
    await page.getByTestId('royal-pass').fill(fb_password);
    await page.getByTestId('royal-login-button').click();
    await page.waitForURL('https://www.facebook.com/');
    await page.waitForTimeout(5000);

    // remove all of above

    await page.getByRole('link', { name: 'Marketplace' }).click();
    await page.getByLabel('Create new listing').click();
    await page.getByRole('link', { name: 'Item for sale Create a single' }).click();

    await context.storageState({ path: savePath });

    console.log('Login successful, session saved');
    await browser.close();
}

loginandsaveState();
