import { chromium } from 'playwright';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  // disable default timeouts so there's no 30s limit
  context.setDefaultTimeout(0);
  context.setDefaultNavigationTimeout(0);
  const page = await context.newPage();

  // ebay sign in page
  await page.goto('https://signin.ebay.com.au/');
  console.log('please sign in to ebay manually on the sign-in page.');

  // wait till url is 'https://www.ebay.com.au/'
  await page.waitForFunction(
    () => window.location.href === 'https://www.ebay.com.au/',
    { timeout: 0 }
  );
  // console.log('url is exactly https://www.ebay.com.au/ money standing tall yao ming by playboi carti');

  // once logged in nav to selling page
  await page.goto('https://www.ebay.com.au/sell');
  // console.log('navigated to selling page');

  // list for free link
  await page.waitForSelector('a:has-text("List for free")', { timeout: 0 });
  await page.click('a:has-text("List for free")');
  // console.log('clicked list for free');

  // save allat -> idk if this is right adi
  const savePath = path.join(process.cwd(), 'ebay_session.json');
  await context.storageState({ path: savePath });
  console.log('ebay session saved at:', savePath);

  // navigating to account settings profile page
  await page.goto('https://www.accountsettings.ebay.com.au/profile');

  // injecting a modal to remind the user
  await page.evaluate(() => {
    const modal = document.createElement('div');
    modal.id = 'playwright-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    modal.style.color = 'white';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '9999';
    modal.innerHTML = `
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif; font-size:24px; text-align:center;">
            Make sure your <strong>Phone Number</strong>, <strong>Name</strong> and <strong>Address</strong> are filled in, or <strong>you can't make any listings</strong> on eBay.<br>
        </p>
        <p style="font-size:20px; text-align:center;">
            Once you've finished filling in your details, press "Done".<br>
        </p>
        <button id="closeBtn" style="
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
        ">Ok</button>`;
    
    document.body.appendChild(modal);
    
    // Add hover effect to close button
    const closeBtn = document.getElementById('closeBtn');
    closeBtn.onmouseover = () => {
        closeBtn.style.transform = 'translateY(-2px)';
        closeBtn.style.filter = 'brightness(110%)';
    };
    closeBtn.onmouseout = () => {
        closeBtn.style.transform = 'translateY(0)';
        closeBtn.style.filter = 'brightness(100%)';
    };
});

  // wait for user to click ok, then remove the modal
  await page.evaluate(() => {
    return new Promise(resolve => {
      document.getElementById('closeBtn').addEventListener('click', () => {
        const modal = document.getElementById('playwright-modal');
        if (modal) {
          modal.parentNode.removeChild(modal);
        }
        resolve();
      });
    });
  });

  // now injecting a "done" button in the bottom right corner
    await page.evaluate(() => {
        const doneBtn = document.createElement('button');
        doneBtn.id = 'doneBtn';
        doneBtn.textContent = 'Done';
        doneBtn.style.position = 'fixed';
        doneBtn.style.bottom = '20px';
        doneBtn.style.right = '20px';
        doneBtn.style.padding = '0.8rem 1.3rem';
        doneBtn.style.fontSize = '20px';
        doneBtn.style.background = 'linear-gradient(135deg, #00ff9d 0%, #00cc7d 100%)';
        doneBtn.style.color = '#121212';
        doneBtn.style.border = 'none';
        doneBtn.style.borderRadius = '8px';
        doneBtn.style.zIndex = '9999';
        doneBtn.style.fontWeight = '500';
        doneBtn.style.cursor = 'pointer';
        doneBtn.style.transition = 'all 0.3s ease';
        doneBtn.style.boxShadow = '0 4px 15px rgba(0, 255, 157, 0.2)';
        
        // Add hover effect
        doneBtn.onmouseover = () => {
            doneBtn.style.transform = 'translateY(-2px)';
            doneBtn.style.filter = 'brightness(110%)';
        };
        doneBtn.onmouseout = () => {
            doneBtn.style.transform = 'translateY(0)';
            doneBtn.style.filter = 'brightness(100%)';
        };
        document.body.appendChild(doneBtn);
    });

  // waiting for the user to click the done button
  await page.evaluate(() => {
    return new Promise(resolve => {
      document.getElementById('doneBtn').addEventListener('click', () => {
        resolve();
      });
    });
  });

  // closing browser after user has done x
  await browser.close();
})();