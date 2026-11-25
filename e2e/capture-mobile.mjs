import { chromium } from '@playwright/test';
import fs from 'fs';

const WEB = process.env.WEB_URL || 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.taste-skill/mobile/before';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

for (const theme of ['noir', 'brutal']) {
  for (const [w, h] of [[320, 568], [375, 812], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(v => { try { localStorage.setItem('roviel.theme', v); } catch {} }, theme);
    const page = await ctx.newPage();
    await page.goto(WEB + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true', null, { timeout: 25000 });
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${OUT}/landing-${theme}-${w}.png` });

    await page.click('#open-currency-tools-mobile');
    await page.waitForSelector('#currency-tools-dialog[open]');
    await page.waitForTimeout(1300);
    await page.evaluate(() => { document.getElementById('currency-tools-dialog').scrollTop = 300; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/converter-${theme}-${w}.png` });
    if (w !== 375) {
      await page.evaluate(() => {
        const dialog = document.getElementById('currency-tools-dialog');
        const quote = document.querySelector('.quote-tool-card');
        dialog.scrollTop = quote.offsetTop - 90;
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/quote-${theme}-${w}.png` });
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await page.goto(WEB + '/#dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#dashboard-view.open');
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${OUT}/dashboard-${theme}-${w}.png` });
    await ctx.close();
  }
}
await browser.close();
console.log('before captures complete →', OUT);
