import { chromium } from 'playwright';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  // disable default timeouts so there's no 30s limit
  context.setDefaultTimeout(0);
  context.setDefaultNavigationTimeout(0);
  const page = await context.newPage();

  // depop sign in page
  await page.goto('https://www.depop.com/login/');
  console.log('please sign in to depop manually on the login page.');

  // inject overlay with instructions
  await page.evaluate(() => {
    const overlay = document.createElement('div');
    overlay.id = 'depop-overlay';
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
        If you don't want to log in with a "Magic Link", please enter your email or username, login, <br> then click "Didn't get your link?" and finally click "Log in with password"!<br><br> From our experience, this is the most reliable and fastest way to log in. <br> <br>
        <strong>Do not close this tab, we will automatically close it for you after authenticate your account 😊</strong>
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
            box-shadow: 0 4px 15px rgba(0, 255, 157, 0.2);">Ok</button>
    `;
    document.body.appendChild(overlay);
  });

  // wait for the user to dismiss the overlay
  await page.evaluate(() => {
    return new Promise(resolve => {
      document.getElementById('dismissOverlay').addEventListener('click', () => {
        const overlay = document.getElementById('depop-overlay');
        if (overlay) {
          overlay.parentNode.removeChild(overlay);
        }
        resolve();
      });
    });
  });

  // wait until the URL is exactly "https://www.depop.com/au/"
  await page.waitForURL("https://www.depop.com/au/", { timeout: 0 });
  console.log('detected depop main page. proceeding with automation.');

  // once logged in, click the "Sell now" button
  await page.getByRole('button', { name: 'Sell now' }).click();
  console.log('clicked "Sell now".');

  // save all cookies and session state to depop_session.json
  const savePath = path.join(process.cwd(), 'depop_session.json');
  await context.storageState({ path: savePath });
  console.log('depop session saved at:', savePath);

  await browser.close();
})();