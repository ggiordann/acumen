import { webkit } from 'playwright';
import path from 'path';

const __dirname = import.meta.dirname;
const savePath = path.join(__dirname, 'gumtree_session.json');

async function loginAndSaveState() {
  const browser = await webkit.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // inject overlay with instructions
  await page.evaluate(() => {
    const overlay = document.createElement('div');
    overlay.id = 'gumtree-overlay';
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
        const overlay = document.getElementById('gumtree-overlay');
        if (overlay) {
          overlay.remove();
        }
        resolve();
      });
    });
  });

  await page.goto('https://www.gumtree.com.au/t-login-form.html');
  console.log("Please log in manually on the opened Gumtree tab.");

  await page.waitForURL('https://www.gumtree.com.au/', { timeout: 0 });
  console.log('Detected Gumtree homepage. Proceeding.');

  await context.storageState({ path: savePath });
  console.log('Login successful, session saved');
  await browser.close();
}

loginAndSaveState();