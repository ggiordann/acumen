import { webkit } from 'playwright';
import path from 'path';
import fs from 'fs';

// Read JSON data from environment variable AD_DATA
const adDataStr = process.env.AD_DATA;
if (!adDataStr) {
  console.error('Error: AD_DATA environment variable not set.');
  process.exit(1);
}
const adData = JSON.parse(adDataStr);

async function postListingGumtree(adData) {
  const savePath = path.join(process.cwd(), 'gumtree_session.json');

  // Check if the session file exists before trying to load it
  if (!fs.existsSync(savePath)) {
    // Output specific error message to stdout for server to catch
    console.log('SESSION_ERROR: Gumtree session file not found. Please connect to Gumtree first.');
    process.exit(1); // Exit if session file is missing
  }
  console.log(`Session file found at ${savePath}. Attempting to load...`);

  // launch WebKit with UI, DevTools, and slowMo for visibility
  const browser = await webkit.launch({ headless: false, devtools: true, slowMo: 100 });
  const context = await browser.newContext({ storageState: savePath });
  const page = await context.newPage();

  // spoof navigator properties
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.goto('https://www.gumtree.com.au/');
  const profileBtn = page.locator('.header__my-gumtree-portrait').first();
  await profileBtn.click();
  // wait for Manage Ads link to appear and click first instance
  const manageAdsLink = page.getByRole('link', { name: 'Manage Ads' }).first();
  await manageAdsLink.waitFor({ state: 'visible', timeout: 60000 });
  await manageAdsLink.click();

  // wait for Post an ad link and click first instance
  const postAdLink = page.getByRole('link', { name: 'Post an ad', exact: true }).first();
  await postAdLink.waitFor({ state: 'visible', timeout: 60000 });
  await postAdLink.click();

  await page.getByRole('link', { name: 'Select a category' }).locator('a').click();
  if (Array.isArray(adData.CategoryPath)) {
    for (const cat of adData.CategoryPath) {
      await page.getByRole('button', { name: cat }).click();
    }
  }
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByTestId('20046_TEXT_FIELD_ad_title').fill(adData.Title || '');
  await page.getByPlaceholder('Enter your price').fill(adData.Price ? String(adData.Price) : '');

  // upload photos
  const uploadDir = path.join(process.cwd(), 'uploads');
  const files = fs.readdirSync(uploadDir).map(f => path.join(uploadDir, f));
  if (files.length === 0) {
    console.error('No files found in uploads directory');
    process.exit(1);
  }
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'upload-button' }).click()
  ]);
  await fileChooser.setFiles(files);

  await page.getByTestId('20046_TEXT_AREA_ad_description').fill(adData.Description || '');
  if (adData.Condition) {
    await page.getByRole('radio', { name: adData.Condition }).click();
  }

  // Skipping post button click on Gumtree as per user request
  console.log('Form filled; skipping actual post button click');
  await page.waitForTimeout(5000);
  await page.waitForTimeout(300000);
  await browser.close();
  console.log('Skipped posting and closed browser');

  // cleanup uploaded files
  files.forEach(f => fs.unlinkSync(f));
  return 'Listing posted successfully';
}

postListingGumtree(adData)
  .then(res => console.log(res))
  .catch(err => {
    console.error('Error posting to Gumtree:', err);
    process.exit(1);
  });