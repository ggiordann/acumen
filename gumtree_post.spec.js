import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UAPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

puppeteer.use(StealthPlugin());
puppeteer.use(UAPlugin({ customFn: ua => ua.replace(/Headless/, '') }));

// removed fingerprint plugin (not published) – rely on stealth + humanization

// helper for realistic delays
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// sleep helper since page.waitForTimeout is unavailable in this Puppeteer version
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error('No ad data provided');
    process.exit(1);
  }
  let adData;
  try { adData = JSON.parse(inputArg); } catch (e) {
    console.error('Invalid JSON input:', e);
    process.exit(1);
  }

  const launchArgs = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox'
  ];

  // use development or production proxy based on NODE_ENV
  const proxy = process.env.NODE_ENV === 'development' ? process.env.GUMTREE_PROXY_TEST : process.env.GUMTREE_PROXY;
  if (proxy) {
    launchArgs.push(`--proxy-server=${proxy}`);
  }

  const browser = await puppeteer.launch({
    headless: false,
    channel: 'chrome',
    args: launchArgs
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  const realUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15';
  await page.setUserAgent(realUA);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.emulateTimezone('Australia/Sydney');

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.navigator.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US','en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4] });
    Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    Object.defineProperty(navigator, 'connection', { get: () => ({ downlink: 10, effectiveType: '4g' }) });
  });

  // initial navigation with delay
  await page.goto('https://www.gumtree.com.au/', { waitUntil: 'networkidle2' });
  await sleep(randomDelay(1000, 2000));

  await page.waitForSelector('.nav-my-gumtree > [href="/m-my-ads.html?c=1"]');
  await sleep(randomDelay(500, 1000));
  await page.click('.nav-my-gumtree > [href="/m-my-ads.html?c=1"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  await page.waitForSelector('[href="/p-post-ad.html"]:nth-child(2)');
  await sleep(randomDelay(500, 1000));
  await page.click('[href="/p-post-ad.html"]:nth-child(2)');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  await page.waitForSelector('[name="preSyiTitle"]');
  await sleep(randomDelay(500, 1000));
  await page.click('[name="preSyiTitle"]');
  await page.type('[name="preSyiTitle"]', adData.Title || '', { delay: randomDelay(50, 150) });

  await sleep(randomDelay(500, 1000));
  await page.click('.css-1mqk92z-Box');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  if (adData.Category) {
    await sleep(randomDelay(500, 1000));
    await page.click('.css-1jascer-Box');
    await sleep(randomDelay(200, 500));
    const [opt] = await page.$x(`//button[contains(., '${adData.Category}')]`);
    if (opt) await opt.click();
  }

  // determine condition index: 1 for Used, 2 for New
  const condIndex = adData.Condition === 'New' ? 2 : 1;
  await sleep(randomDelay(500, 1000));
  await page.click(`.css-bc1f5v-Box:nth-child(${condIndex})`);

  if (adData.Price) {
    await sleep(randomDelay(500, 1000));
    await page.click('[name="price.amount"]');
    await page.type('[name="price.amount"]', String(adData.Price), { delay: randomDelay(50, 150) });
  }

  // upload images
  const uploadDir = path.join(process.cwd(), 'uploads');
  const files = fs.readdirSync(uploadDir).map(f => path.join(uploadDir, f));
  if (!files.length) {
    console.error('No files found in uploads'); process.exit(1);
  }
  const fileChooserPromise = page.waitForFileChooser();
  await page.click('[aria-label="upload-button"]');
  const fileChooser = await fileChooserPromise;
  await fileChooser.accept(files);

  // description
  await sleep(randomDelay(500, 1000));
  await page.click('textarea');
  await page.type('textarea', adData.Description || '', { delay: randomDelay(50, 150) });

  // use current location
  await sleep(randomDelay(500, 1000));
  await page.click('[data-testid="useCurrentLoc"]');
  await sleep(1000);

  // post
  await sleep(randomDelay(500, 1000));
  await page.click('.css-1gvwt6k-Box');
  await sleep(3000);

  await browser.close();
  console.log('Listing posted successfully');
})();