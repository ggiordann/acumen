import { chromium } from 'playwright';

// this function posts a listing to facebook marketplace using playwright automation
// it assumes that the user is already logged in so it skips the login process
// parameters: an object with title, category, description, and optional imagePath
export async function postListing({ title, category, description, imagePath }) {
  // launch chromium browser (if you want to reuse an existing context with cookies,
  // consider using a persistent context instead)
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // assume that the user is already logged in; navigate directly to the marketplace create listing page
    await page.goto('https://www.facebook.com/marketplace/create/');
    await page.waitForLoadState('networkidle');

    // fill out the listing form
    // fill in the title field
    await page.fill('input[aria-label="title"]', title);
    // fill in the description field
    await page.fill('textarea[aria-label="description"]', description);
    // click on the category dropdown to open it
    await page.click('div[aria-label="category"]');
    // type the category into the search input for categories
    await page.fill('input[aria-label="search categories"]', category);
    // wait for dropdown options to appear and select the first option
    await page.waitForSelector('div[role="option"]');
    await page.click('div[role="option"]');

    // if an image path is provided, upload the image
    if (imagePath) {
      // click the add photos button to trigger the file chooser
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('div[aria-label="add photos"]')
      ]);
      await fileChooser.setFiles(imagePath);
    }

    // click on the publish button to submit the listing
    await page.click('div[aria-label="publish"]');
    // wait a few seconds to allow the submission to process
    await page.waitForTimeout(5000);
  } catch (err) {
    console.error('error posting listing:', err);
    await browser.close();
    throw err;
  }

  await browser.close();
  return true;
}