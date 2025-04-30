import { chromium } from 'playwright';
import path from 'path';

const __dirname = import.meta.dirname;
const savePath = path.join(__dirname, 'facebook_session.json');

async function loginandsaveState() {
  console.log('Starting loginandsaveState function...');
  let browser;
  try {
    console.log('Launching browser...');
    browser = await chromium.launch({ headless: false });
    console.log('Browser launched.');

    console.log('Creating new browser context...');
    const context = await browser.newContext();
    console.log('Context created.');

    console.log('Creating new page...');
    const page = await context.newPage();
    console.log('Page created.');

    console.log('Injecting overlay...');
    await page.evaluate(() => {
      const overlay = document.createElement('div');
      overlay.id = 'fb-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      overlay.style.color = 'white';
      overlay.style.display = 'flex';
      overlay.style.flexDirection = 'column';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';
      overlay.style.zIndex = '9999';
      overlay.innerHTML = `
        <p style="text-align:center; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif; font-size:24px;">
          Once you've logged in, <strong>do not close this tab</strong>, we will automatically close it for you after authenticate your account 😊
        </p>
        <button id="dismissOverlay" style="
              margin-top: 1rem;
              background: linear-gradient(135deg, #00ff9d 0%, #00cc7d 100%);
              color: #121212;
              border: none;
              padding: 0.8rem 1.3rem;
              border-radius: 8px;
              font-size: 20px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 4px 15px rgba(0, 255, 157, 0.2);
        ">Ok</button>
      `;
      document.body.appendChild(overlay);
      console.log('Overlay injected into page.');
    });
    console.log('Overlay injection code executed.');

    console.log('Waiting for user to dismiss overlay...');
    await page.evaluate(() => {
      return new Promise(resolve => {
        const dismissButton = document.getElementById('dismissOverlay');
        if (dismissButton) {
          console.log('Dismiss button found. Adding listener.');
          dismissButton.addEventListener('click', () => {
            console.log('Dismiss button clicked.');
            const overlay = document.getElementById('fb-overlay');
            if (overlay) {
              overlay.parentNode.removeChild(overlay);
              console.log('Overlay removed.');
            }
            resolve();
          });
        } else {
          console.error('Dismiss button not found!');
          resolve();
        }
      });
    });
    console.log('Overlay dismissed (or skipped in non-interactive).');

    console.log('Navigating to Facebook login page...');
    await page.goto('https://www.facebook.com/login/');
    console.log("Navigated to login page. Please log in manually on the opened Facebook tab.");

    console.log('Waiting for navigation to Facebook homepage (manual login)...');
    await page.waitForURL('https://www.facebook.com/', { timeout: 0 });
    console.log('Detected Facebook homepage. Proceeding with navigation.');

    console.log('Navigating to Marketplace...');
    await page.getByRole('link', { name: 'Marketplace' }).click();
    console.log('Clicked Marketplace link.');
    await page.getByLabel('Create new listing').click();
    console.log('Clicked Create new listing.');
    await page.getByRole('link', { name: 'Item for sale Create a single' }).click();
    console.log('Clicked Item for sale.');

    console.log(`Saving session state to ${savePath}...`);
    await context.storageState({ path: savePath });
    console.log('Login successful, session saved.');

  } catch (error) {
    console.error('Error during Facebook login script:', error);
    process.exitCode = 1;
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
      console.log('Browser closed.');
    }
  }
}

loginandsaveState().then(() => {
  console.log('loginandsaveState finished.');
}).catch(err => {
  console.error('Unhandled error in loginandsaveState:', err);
  process.exit(1);
});