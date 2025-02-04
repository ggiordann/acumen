import { chromium } from 'playwright';

// this function posts a listing to facebook marketplace using playwright automation
// parameters: an object with title, category, description, and optional imagePath
export async function postListing({ title, category, description, imagePath }) {
  // launch chromium browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // navigate to facebook login page
    await page.goto('https://www.facebook.com/login');
    // fill in email using env variable fb_email
    await page.fill('input[name="email"]', process.env.FB_EMAIL);
    // fill in password using env variable fb_password
    await page.fill('input[name="pass"]', process.env.FB_PASSWORD);
    // click login button
    await page.click('button[name="login"]');
    // wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    // navigate to marketplace create listing page
    await page.goto('https://www.facebook.com/marketplace/create/');
    // wait for page load
    await page.waitForLoadState('networkidle');

    // fill in the title field (selector may need adjustment based on actual page structure)
    await page.fill('input[aria-label="title"]', title);
    // fill in the description field
    await page.fill('textarea[aria-label="description"]', description);
    // click on category dropdown to open it
    await page.click('div[aria-label="category"]');
    // type the category into the search input for categories
    await page.fill('input[aria-label="search categories"]', category);
    // wait for dropdown options to appear and select the first one
    await page.waitForSelector('div[role="option"]');
    await page.click('div[role="option"]');

    // if an image path is provided, upload the image
    if (imagePath) {
      // click on add photos button to trigger file chooser
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('div[aria-label="add photos"]')
      ]);
      // set files for file chooser
      await fileChooser.setFiles(imagePath);
    }

    // click on the publish button
    await page.click('div[aria-label="publish"]');
    // wait for a confirmation delay (adjust timeout as needed)
    await page.waitForTimeout(5000);
  } catch (err) {
    console.error('error posting listing:', err);
    await browser.close();
    throw err;
  }

  await browser.close();
  return true;
}