import { chromium } from '@playwright/test';
import fs from 'fs';

const WEB = process.env.WEB_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:4000';
const OUT = process.env.OUT_DIR || '.taste-skill/full-mobile';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const VIEWS = ['overview', 'transactions', 'accounts', 'budgets', 'goals', 'recurring', 'insights', 'pulse'];

for (const theme of ['noir', 'brutal']) {
  for (const [w, h] of [[320, 568], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(([t, api]) => {
      try { localStorage.setItem('roviel.theme', t); localStorage.setItem('roviel.api.base', api); } catch {}
    }, [theme, API]);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message || e)));
    await page.goto(WEB + '/#dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#dashboard-view.open');
    await page.waitForTimeout(1200);
    try {
      await page.click('#auth-button');
      await page.waitForSelector('#auth-modal.open');
      await page.fill('#auth-email', 'demo@ledgerly.app');
      await page.fill('#auth-password', 'ledgerly123');
      await page.click('#auth-submit');
      await page.waitForFunction(() => document.querySelector('#cloud-status')?.textContent.includes('Cloud sync'), null, { timeout: 20000 });
      await page.waitForTimeout(1200);
    } catch (e) { console.log('sign-in failed', w, theme, String(e).slice(0, 80)); }

    for (const view of VIEWS) {
      await page.evaluate(v => window.RovielShowView(v), view);
      await page.waitForTimeout(view === 'pulse' ? 1600 : 900);
      await page.screenshot({ path: `${OUT}/view-${view}-${theme}-${w}.png` });
    }
    console.log(theme, w, 'views captured', errs.slice(0, 2));
    await ctx.close();
  }
}
await browser.close();
console.log('audit captures complete');
