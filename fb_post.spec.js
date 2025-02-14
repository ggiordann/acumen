/*import {chromium} from 'playwright';
import path from 'path';

const __dirname = import.meta.dirname;
const savePath = path.join(__dirname, 'facebook_session.json');

async function postItemToMarketplace() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ storageState: savePath });
    const page = await context.newPage();

    //bot detection stuff
    await page.evaluate(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
        Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    });

    await page.goto("https://www.facebook.com/marketplace/create/item")

    
    
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Publish' }).click();
    await page.goto('https://www.facebook.com/marketplace/you/selling');
}

postItemToMarketplace();
*/

// facebook posting endpoint (unchanged)
async function postListingFacebookMarketplace(adData) {
    const savePath = path.join(process.cwd(), 'facebook_session.json');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ storageState: savePath });
    const page = await context.newPage();
  
    await page.goto("https://www.facebook.com/");
    await page.getByRole('link', { name: 'Marketplace' }).click();
    await page.getByRole('link', { name: 'Create new listing' }).click();
    await page.getByRole('link', { name: 'Item for sale Create a single' }).click();
  
    await page.getByRole('textbox', { name: 'Title' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill(adData.Title || "");
  
    await page.getByRole('textbox', { name: 'Price' }).click();
    await page.getByRole('textbox', { name: 'Price' }).fill(adData.Price ? String(adData.Price) : "");
  
    await page.getByRole('button', { name: 'Category' }).click();
    await page.getByRole('button', { name: adData.Category || "", exact: true }).click();
  
    await page.getByRole('combobox', { name: 'Condition' }).locator('div').nth(2).click();
    await page.getByRole('option', { name: adData.Condition || 'Used – good', exact: true }).click();
  
    await page.getByRole('textbox', { name: 'Brand' }).click();
    await page.getByRole('textbox', { name: 'Brand' }).fill(adData.Brand || "");
  
    await page.getByRole('textbox', { name: 'Description' }).click();
    await page.getByRole('textbox', { name: 'Description' }).fill(adData.Description || "");
  
    await page.getByRole('combobox', { name: 'Availability' }).locator('div').nth(2).click();
    await page.getByText(adData.Availability || 'List as single item').click();
  
    await page.getByRole('textbox', { name: 'Product tags' }).click();
    const productTags = Array.isArray(adData["Product Tags"])
      ? adData["Product Tags"].join(', ')
      : (adData["Product Tags"] || "");
    await page.getByRole('textbox', { name: 'Product tags' }).fill(productTags);
  
    if (
      adData["Meetup Preferences"] &&
      Array.isArray(adData["Meetup Preferences"]) &&
      adData["Meetup Preferences"].includes("Door pick-up")
    ) {
      await page.getByRole('checkbox', { name: 'Door pick-up Buyer picks up' }).click();
    }
  
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(5000);
    await browser.close();
    return "Listing posted successfully";
  }