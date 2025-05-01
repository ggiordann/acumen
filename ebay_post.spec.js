// STILL NEED TO DO SOMETHING REGARDING IMAGE UPLOAD //

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const __dirname = process.cwd();
const savePath = path.join(__dirname, 'ebay_session.json');

// Read JSON data from environment variable AD_DATA
const adDataStr = process.env.AD_DATA;
if (!adDataStr) {
  console.error('Error: AD_DATA environment variable not set.');
  process.exit(1);
}
const adData = JSON.parse(adDataStr);

async function postItemToEbayMarketplace(adData) {
  // Check if the session file exists before trying to load it
  if (!fs.existsSync(savePath)) {
    // Output specific error message to stdout for server to catch
    console.log('SESSION_ERROR: eBay session file not found. Please connect to eBay first.');
    process.exit(1); // Exit if session file is missing
  }
  console.log(`Session file found at ${savePath}. Attempting to load...`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: savePath });
  const page = await context.newPage();

  // navigate to eBay prelist suggestion page
  await page.goto('https://www.ebay.com.au/sl/prelist/suggest');

  // fill in the search box with adData.SearchTerm (or Title if SearchTerm is not provided)
  const searchTerm = adData.SearchTerm || adData.Title || "";
  await page.getByRole('textbox', { name: "Tell us what you're selling" }).click();
  await page.getByRole('textbox', { name: "Tell us what you're selling" }).fill(searchTerm);

  // click the Search button
  await page.getByRole('button', { name: 'Search' }).click();

  // click "Continue without match"
  await page.getByRole('button', { name: 'Continue without match' }).click();

  // select the condition radio button based on adData.Condition
  await page.getByRole('radio', { name: adData.Condition, exact: true }).check();

  // click "Continue to listing"
  await page.getByRole('button', { name: 'Continue to listing' }).click();

  // --- Start: Image Upload Logic ---
  const uploadDir = path.join(__dirname, 'uploads');
  const files = fs.readdirSync(uploadDir).map(filename => path.join(uploadDir, filename));
  if (files.length === 0) {
    console.error('No files found in uploads directory');
    process.exit(1);
  }
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Upload from computer' }).click()
  ]);
  await fileChooser.setFiles(files);
  // give upload some time to process
  await page.waitForTimeout(10000);
  // --- End: Image Upload Logic ---

  // check the HTML editor checkbox
  await page.getByRole('checkbox', { name: 'Show HTML editor' }).check();

  // fill in detailed description (HTML formatted)
  await page.getByRole('textbox', { name: 'Write a detailed description' }).fill(adData.Description || "");

  // fill in the price field (assuming it is the third textbox)
  await page.getByRole('textbox').nth(2).click();
  await page.getByRole('textbox').nth(2).fill(String(adData.Price || ""));

  // click the "List it" button
  await page.getByRole('button', { name: 'List it' }).click();

  await page.waitForTimeout(5000);
  await browser.close();
  return "eBay Listing posted successfully";
}

postItemToEbayMarketplace(adData)
  .then(result => console.log(result))
  .catch(err => {
    console.error("Error posting eBay listing:", err);
    process.exit(1);
  });