import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const inputArg = process.argv[2];
if (!inputArg) {
  console.error("no ad data provided, JSON is not being passed");
  process.exit(1);
}

let adData;
try {
  adData = JSON.parse(inputArg);
} catch (e) {
  console.error("Invalid JSON input:", e);
  process.exit(1);
}

async function postListingFacebookMarketplace(adData) {
    const savePath = path.join(process.cwd(), 'facebook_session.json');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState: savePath });
    const page = await context.newPage();
    
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    });

    await page.goto("https://www.facebook.com/");
    await page.getByLabel('Shortcuts').getByRole('link', { name: 'Marketplace' }).click();
    await page.getByRole('link', { name: 'Create new listing' }).click();
    await page.getByRole('link', { name: 'Item for sale Create a single' }).click();
  
    await page.getByRole('textbox', { name: 'Title' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill(adData.Title || "");
  
    await page.getByRole('textbox', { name: 'Price' }).click();
    await page.getByRole('textbox', { name: 'Price' }).fill(adData.Price ? String(adData.Price) : "");
  
    await page.getByRole('combobox', { name: 'Category' }).locator('i').click();
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

    const uploadDir = path.join(process.cwd(), 'uploads');
    const files = fs.readdirSync(uploadDir)
                   .map(filename => path.join(uploadDir, filename));
    if (files.length === 0) {
      console.error("No files found in uploads directory");
      process.exit(1);
    }
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Add photos or drag and drop' }).click()
    ]);
    await fileChooser.setFiles(files);

    // await page.getByRole('button', { name: 'Next' }).click(); // THIS IS THE ONE THAT POSTS THE ACTUAL LISTING
    await page.waitForTimeout(5000);
    await browser.close();
    console.log("Listing posted successfully");
    files.forEach(file => {
      fs.unlinkSync(file);
    });
    return "Listing posted successfully";
}

postListingFacebookMarketplace(adData)
  .then(result => console.log(result))
  .catch(err => {
    console.error("Error posting to Facebook:", err);
    process.exit(1);
  });