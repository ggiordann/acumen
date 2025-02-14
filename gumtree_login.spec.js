import { chromium } from 'playwright-extra';
import stealth from 'playwright-stealth';
import path from 'path';
import { configDotenv } from 'dotenv';

chromium.use(stealth);
configDotenv('.env');

const __dirname = import.meta.dirname;
const savePath = path.join(__dirname, 'gumtree_session.json');

async function loginandsaveState() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  //bot detection stuff
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  });

  page.goto("gumtree.com.au");
}