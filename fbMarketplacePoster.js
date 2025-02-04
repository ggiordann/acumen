import { chromium } from 'playwright';

// this function posts a listing to facebook marketplace using playwright automation
// parameters: an object with title, category, description, and optional imagePath
export async function postListing({ title, category, description, imagePath }) {
  // launch chromium browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // navigate directly to facebook marketplace homepage
    await page.goto('https://www.facebook.com/marketplace/');
    await page.waitForLoadState('networkidle');

    // perform login using the sign in form displayed on the marketplace page
    // fill in email using the second sign in form's selectors (ids :r1: and :r4:)
    console.log("Performing marketplace sign in...");
    await page.fill('input[id=":r1:"]', process.env.FB_EMAIL);
    console.log("Marketplace email filled.");
    await page.fill('input[id=":r4:"]', process.env.FB_PASSWORD);
    console.log("Marketplace password filled.");
    // click on the accessible login button
    await page.click('div[aria-label="Accessible login button"]');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    console.log("Marketplace sign in complete.");

    // navigate to marketplace create listing page
    await page.goto('https://www.facebook.com/marketplace/create/');
    await page.waitForLoadState('networkidle');

    // wait for title input to appear with an increased timeout and fill it
    console.log("Waiting for title input...");
    await page.waitForSelector('input[aria-label="title"]', { timeout: 60000 });
    console.log("Title input found. Filling title...");
    await page.fill('input[aria-label="title"]', title);

    // wait for description textarea and fill it
    await page.waitForSelector('textarea[aria-label="description"]', { timeout: 60000 });
    await page.fill('textarea[aria-label="description"]', description);

    // click on category dropdown to open it
    await page.click('div[aria-label="category"]');
    // type the category into the search input for categories
    await page.fill('input[aria-label="search categories"]', category);
    // wait for dropdown options to appear and select the first one
    await page.waitForSelector('div[role="option"]', { timeout: 60000 });
    await page.click('div[role="option"]');

    // if an image path is provided (and not "null"), upload the image
    if (imagePath && imagePath !== "null") {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('div[aria-label="add photos"]')
      ]);
      await fileChooser.setFiles(imagePath);
    }

    // click on the publish button
    await page.click('div[aria-label="publish"]');
    // wait for a short confirmation delay (adjust timeout as needed)
    await page.waitForTimeout(5000);
  } catch (err) {
    console.error('error posting listing:', err);
    await browser.close();
    throw err;
  }

  await browser.close();
  return true;
}