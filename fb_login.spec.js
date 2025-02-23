import { chromium } from 'playwright';
import path from 'path';
import { configDotenv } from 'dotenv';

configDotenv('.env');

const __dirname = import.meta.dirname;
const savePath = path.join(__dirname, 'facebook_session.json');

async function loginandsaveState() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // inject overlay with instructions
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
  });

  // wait for the user to click the OK button and dismiss the overlay
  await page.evaluate(() => {
    return new Promise(resolve => {
      document.getElementById('dismissOverlay').addEventListener('click', () => {
        const overlay = document.getElementById('fb-overlay');
        if (overlay) {
          overlay.parentNode.removeChild(overlay);
        }
        resolve();
      });
    });
  });

  // navigate to Facebook homepage and let the user log in manually
  await page.goto('https://www.facebook.com/login/');
  console.log("Please log in manually on the opened Facebook tab.");

  // wait until the user logs in and the URL becomes exactly the Facebook homepage
  await page.waitForURL('https://www.facebook.com/', { timeout: 0 });
  console.log('Detected Facebook homepage. Proceeding with navigation.');

  // navigate to Marketplace and initiate the listing process
  await page.getByRole('link', { name: 'Marketplace' }).click();
  await page.getByLabel('Create new listing').click();
  await page.getByRole('link', { name: 'Item for sale Create a single' }).click();

  // save session state to file
  await context.storageState({ path: savePath });
  console.log('Login successful, session saved');
  await browser.close();
}

loginandsaveState();