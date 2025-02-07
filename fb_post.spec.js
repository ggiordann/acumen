import {chromium} from 'playwright';
import path from 'path';

const __dirname = import.meta.dirname;
const savePath = path.join(__dirname, 'facebook_session.json');

async function postItemToMarketplace() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ storageState: savePath });
    const page = await context.newPage();

    await page.goto("https://www.facebook.com/marketplace/create/item")
}

postItemToMarketplace();