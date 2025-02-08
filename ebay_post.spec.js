import { chromium } from 'playwright';
import path from 'path';

const __dirname = process.cwd();
const savePath = path.join(__dirname, 'ebay_session.json');

async function postItemToEbayMarketplace(adData) {
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

  // set attributes (fixed steps)
  await page.locator('button[name="attributes\\.Type"]').click(); // ts
  await page.locator('.filter-menu__checkbox').first().click();
  await page.locator('div:nth-child(2) > .filter-menu__checkbox').first().click(); //idk

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

const inputArg = process.argv[2];
if (!inputArg) {
  console.error("No ad data provided. Please pass JSON string as argument.");
  process.exit(1);
}

let adData;
try {
  adData = JSON.parse(inputArg);
} catch (e) {
  console.error("Invalid JSON input:", e);
  process.exit(1);
}

postItemToEbayMarketplace(adData)
  .then(result => console.log(result))
  .catch(err => {
    console.error("Error posting eBay listing:", err);
    process.exit(1);
  });