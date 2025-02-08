import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.ebay.com.au/sl/prelist/suggest');
  await page.getByRole('textbox', { name: 'Tell us what you\'re selling' }).click();
  await page.getByRole('textbox', { name: 'Tell us what you\'re selling' }).fill('Casio FX-CG50 Calculator');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('button', { name: 'Continue without match' }).click();
  await page.getByRole('radio', { name: 'Brand New' }).check();
  await page.getByRole('radio', { name: 'New: Never Used' }).check();
  await page.getByRole('radio', { name: 'Seller refurbished' }).check();
  await page.getByRole('radio', { name: 'Used', exact: true }).check();
  await page.getByRole('radio', { name: 'For parts or not working' }).check();
  await page.getByRole('button', { name: 'Continue to listing' }).click();
  await page.locator('button[name="attributes\\.Type"]').click();
  await page.locator('.filter-menu__checkbox').first().click();
  await page.locator('div:nth-child(2) > .filter-menu__checkbox').first().click();
  await page.getByRole('checkbox', { name: 'Show HTML editor' }).check();
  await page.getByRole('textbox', { name: 'Write a detailed description' }).fill('<br>Here is where you can write the description for the product in HTML FORMATTING<br>');
  await page.getByRole('textbox').nth(2).click();
  await page.getByRole('textbox').nth(2).fill('99.99');
  await page.getByRole('button', { name: 'List it' }).click();
});