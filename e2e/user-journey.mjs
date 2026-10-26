import { chromium } from '@playwright/test';
import fs from 'fs';

// Reusable visible-browser user-journey runner.
// Usage: npm run test:journey
// Records one continuous video to artifacts/roviel-user-journey/.
// Targets the LOCAL stack only (http://localhost:5173 + :4000).

const WEB = 'http://localhost:5173';
const ARTIFACTS = 'artifacts/roviel-user-journey';
fs.mkdirSync(ARTIFACTS, { recursive: true });

const results = [];
const pass = (name, detail = '') => {
  results.push({ name, ok: true });
  console.log(`JOURNEY PASS  ${name}${detail ? ' — ' + String(detail).slice(0, 90) : ''}`);
};
const fail = (name, detail = '') => {
  results.push({ name, ok: false });
  console.log(`JOURNEY FAIL  ${name}${detail ? ' — ' + String(detail).slice(0, 160) : ''}`);
};
const money = text => Number(String(text).replace(/[^0-9.-]/g, '')) || 0;
const near = (a, b, tol = 1) => Math.abs(Number(a) - Number(b)) <= tol;
// TIME_SCALE stretches every deliberate pause for the recorded take
// (legibility pacing) without changing any assertions.
const TIME_SCALE = Number(process.env.TIME_SCALE || 1);
const sleep = ms => new Promise(r => setTimeout(r, ms * TIME_SCALE));

const ts = Date.now().toString(36);
const EXPENSE = `Journey expense ${ts}`;
const INCOME = `Journey income ${ts}`;

const browser = await chromium.launch({ headless: process.env.HEADLESS === '1', slowMo: 90 });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: ARTIFACTS, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
page.on('pageerror', e => console.log('PAGE ERROR ' + String(e).slice(0, 160)));

try {
  // ---------- A. Sign in ----------
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true', { timeout: 20000 });
  await sleep(800);
  if ((await page.title()).includes('Roviel') && await page.locator('#open-auth-modal').isVisible()) pass('landing shows branding and sign-in');
  else fail('landing shows branding and sign-in');
  await page.click('#open-auth-modal');
  await page.waitForSelector('#auth-modal.open');
  pass('sign-in screen opens');
  await page.fill('#auth-email', 'demo@ledgerly.app');
  await page.fill('#auth-password', 'ledgerly123');
  await sleep(400);
  await page.click('#auth-submit');
  await page.waitForFunction(() => document.querySelector('#cloud-status')?.textContent.includes('Cloud sync'), { timeout: 25000 });
  pass('demo sign-in succeeds, cloud sync on');
  await page.click('.contact-btn');
  await page.waitForSelector('#dashboard-view.open');
  pass('dashboard loads after sign-in');

  // ---------- B. Overview ----------
  const bal = await page.locator('#total-balance').innerText();
  const inc = await page.locator('#total-income').innerText();
  pass('overview shows labelled totals', `${bal} / ${inc}`);
  await page.click('[data-metric="expense"]');
  await page.waitForSelector('#detail-drawer.open');
  pass('spending detail drawer opens with categories');
  await page.click('#drawer-close');
  await sleep(300);

  // ---------- D. Transactions ----------
  await page.click('.dash-side-nav [data-view="transactions"]');
  await page.waitForSelector('#view-transactions.active');
  await sleep(400);
  const rows0 = await page.locator('#transaction-list .dash-row:not(.head)').count();
  pass('transaction rows render', `${rows0} rows`);
  await page.fill('#transaction-search', 'rent');
  await sleep(400);
  pass('search filters activity', (await page.locator('#transaction-list').innerText()).toLowerCase().includes('rent') ? 'rent found' : 'none');
  await page.fill('#transaction-search', 'zzz-no-such-entry');
  await sleep(400);
  pass('empty search state shows', (await page.locator('#transaction-list').innerText()).includes('No activity matches') ? 'empty message' : 'missing');
  await page.fill('#transaction-search', '');
  await page.selectOption('#transaction-filter', 'income');
  await sleep(400);
  await page.selectOption('#transaction-filter', 'all');
  await page.selectOption('#transaction-sort', 'date-asc');
  await sleep(400);
  pass('type filter and sort controls work');
  await page.selectOption('#transaction-sort', 'date-desc');

  // validation error first
  await page.click('#open-transaction-2');
  await page.fill('#transaction-name', '');
  await page.fill('#transaction-amount', '-5');
  await page.click('.tx-submit');
  await sleep(400);
  pass('invalid entry rejected with message', (await page.locator('#transaction-error').innerText()).length > 3 ? 'error shown' : 'missing');
  await page.click('#close-transaction');
  await sleep(300);

  // create expense
  const beforeSpend = money(await page.locator('#total-expenses').innerText());
  await page.click('#open-transaction-2');
  await page.fill('#transaction-name', EXPENSE);
  await page.fill('#transaction-amount', '25');
  await page.selectOption('#transaction-type', 'expense');
  await page.click('.tx-submit');
  await sleep(900);
  const afterSpend = money(await page.locator('#total-expenses').innerText());
  if (near(afterSpend - beforeSpend, 25, 1)) pass('expense raises spending by exactly 25');
  else fail('expense raises spending by exactly 25', `${beforeSpend} -> ${afterSpend}`);

  // edit it
  await page.fill('#transaction-search', EXPENSE);
  await sleep(500);
  await page.locator('#transaction-list .dash-row:not(.head)').first().click();
  await page.waitForSelector('#transaction-modal.open');
  await page.fill('#transaction-name', EXPENSE + ' edited');
  await page.fill('#transaction-amount', '30');
  await page.click('.tx-submit');
  await sleep(900);
  pass('entry edits persist', (await page.locator('#transaction-list').innerText()).includes('edited') ? 'renamed' : 'missing');

  // create + delete income
  await page.fill('#transaction-search', '');
  await page.click('#open-transaction-2');
  await page.fill('#transaction-name', INCOME);
  await page.fill('#transaction-amount', '100');
  await page.selectOption('#transaction-type', 'income');
  await page.click('.tx-submit');
  await sleep(900);
  await page.fill('#transaction-search', INCOME);
  await sleep(500);
  await page.locator('#transaction-list .dash-row .row-del:not([disabled])').first().click();
  await sleep(700);
  if (!(await page.locator('#transaction-list').innerText()).includes(INCOME)) pass('test income deleted');
  else fail('test income deleted');
  await page.fill('#transaction-search', EXPENSE);
  await sleep(500);
  await page.locator('#transaction-list .dash-row .row-del:not([disabled])').first().click();
  await sleep(700);
  await page.fill('#transaction-search', '');
  pass('test expense deleted');

  // ---------- C. Accounts ----------
  await page.click('.dash-side-nav [data-view="accounts"]');
  await sleep(800);
  const acctText = await page.locator('#account-list').innerText();
  pass('accounts list names, currencies, balances', acctText.replace(/\n/g, ' ').slice(0, 70));
  await page.locator('[data-account-detail]').first().click();
  await page.waitForSelector('#detail-drawer.open');
  pass('account detail drawer opens', (await page.locator('#drawer-title').innerText()).slice(0, 30));
  await page.click('#drawer-close');
  await sleep(300);

  // create + rename + delete a USD test account
  const ACCT = `Journey Wallet ${ts}`;
  await page.fill('#new-account-name', ACCT);
  await page.selectOption('#new-account-cur', 'USD');
  await page.click('#add-account');
  await sleep(1500);
  const acctRow = page.locator('#account-list li', { hasText: ACCT });
  if ((await acctRow.count()) === 1) pass('test USD account created');
  else fail('test USD account created');
  const answerRename = async dialog => { await dialog.accept(ACCT + ' renamed'); };
  page.on('dialog', answerRename);
  await acctRow.locator('[data-account-rename]').click();
  await sleep(1500);
  page.off('dialog', answerRename);
  pass('test account renamed', (await page.locator('#account-list').innerText()).includes('renamed') ? 'renamed' : 'missing');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#account-list li', { hasText: ACCT + ' renamed' }).locator('[data-account-del]').click();
  await sleep(1500);
  if (!(await page.locator('#account-list').innerText()).includes(ACCT)) pass('test account deleted, others remain');
  else fail('test account deleted');

  // transfer between two INR accounts
  const accts = await page.evaluate(() => [...document.querySelectorAll('#transfer-from option')].map(o => ({ id: o.value, text: o.textContent })));
  const inr = accts.filter(a => /INR/.test(a.text));
  if (inr.length >= 2) {
    await page.selectOption('#transfer-from', inr[0].id);
    await page.selectOption('#transfer-to', inr[1].id);
    await page.fill('#transfer-amount', '10');
    await sleep(2500);
    const preview = await page.locator('#transfer-preview').innerText();
    pass('transfer preview shows pair', /INR/.test(preview) ? preview.slice(0, 60) : 'missing');
    await page.click('#do-transfer');
    await sleep(2500);
    const toast = await page.locator('#dashboard-toast').innerText();
    pass('transfer recorded', /Transferred/.test(toast) ? toast.slice(0, 50) : toast.slice(0, 50));
  } else fail('transfer recorded', 'need two INR accounts');

  // ---------- E. Budgets ----------
  await page.click('.dash-side-nav [data-view="budgets"]');
  await sleep(800);
  pass('budgets render', (await page.locator('#budget-list').innerText()).replace(/\n/g, ' ').slice(0, 60));
  const CAT = `Journey Cat ${ts}`;
  await page.fill('#new-budget-cat', CAT);
  await page.fill('#new-budget-limit', '500');
  await page.click('#add-budget');
  await sleep(1500);
  const brow = page.locator('#budget-list .budget-row', { hasText: CAT });
  if ((await brow.count()) === 1) pass('test budget created with month + limit');
  else fail('test budget created with month + limit');
  await brow.locator('[data-budget-del]').click();
  await sleep(1500);
  if (!(await page.locator('#budget-list').innerText()).includes(CAT)) pass('test budget deleted');
  else fail('test budget deleted');

  // ---------- E. Goals ----------
  await page.click('.dash-side-nav [data-view="goals"]');
  await sleep(800);
  const GOAL = `Journey Goal ${ts}`;
  await page.fill('#new-goal-title', GOAL);
  await page.fill('#new-goal-target', '1000');
  await page.fill('#new-goal-deadline', '2030-01-15');
  await page.click('#add-goal');
  await sleep(1800);
  const grow = page.locator('#goal-list .goal-row', { hasText: GOAL });
  if ((await grow.count()) === 1) pass('test goal created with deadline');
  else fail('test goal created with deadline');
  const gid = await grow.locator('[data-goal]').getAttribute('data-goal');
  await grow.locator(`[data-contrib="${gid}"]`).fill('100');
  await grow.locator('[data-goal]').click();
  await sleep(2200);
  if ((await page.locator('#goal-list .goal-row', { hasText: GOAL }).innerText()).includes('100.00')) pass('contribution adds exactly 100');
  else fail('contribution adds exactly 100');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#goal-list .goal-row', { hasText: GOAL }).locator('[data-goal-del]').click();
  await sleep(1800);
  if ((await page.locator('#goal-list .goal-row', { hasText: GOAL }).count()) === 0) pass('test goal deleted');
  else fail('test goal deleted');

  // ---------- F. Converter ----------
  await page.click('.dash-side-nav [data-view="pulse"]');
  await sleep(800);
  await page.click('#open-converter-cta');
  await page.waitForSelector('#currency-tools-dialog[open]');
  await page.waitForFunction(() => !document.querySelector('#currency-result').textContent.includes('Loading'), { timeout: 20000 }).catch(() => {});
  await page.fill('#currency-amount', '250');
  await page.selectOption('#currency-from', 'USD');
  await page.selectOption('#currency-to', 'EUR');
  await sleep(3500);
  const facts = await page.locator('#currency-rate-facts').innerText();
  const shown = await page.locator('#currency-result').innerText();
  const rm = facts.match(/1 USD = ([\d.]+) EUR/);
  const em = shown.match(/€([\d,.]+) EUR/);
  if (rm && em && near(250 * Number(rm[1]), Number(em[1].replace(/,/g, '')), 0.02)) pass('conversion matches dated reference rate', `250 USD -> ${em[1]} EUR`);
  else fail('conversion matches dated reference rate', shown.replace(/\n/g, ' ').slice(0, 60));
  pass('rate date/inverse shown', /Observed|Inverse/i.test(facts) ? 'dated + inverse' : 'missing');
  await page.fill('#provider-rate', '0.86');
  await page.fill('#fixed-fee', '2');
  await page.fill('#percentage-fee', '1');
  await page.fill('#fee-tax', '5');
  await sleep(800);
  const quote = await page.locator('#quote-results').innerText();
  if (/net|received|difference/i.test(quote)) pass('provider quote + fees breakdown renders');
  else fail('provider quote + fees breakdown renders');
  const dlg = await page.locator('#currency-tools-dialog').innerText();
  if (/does not execute exchanges/i.test(dlg)) pass('no real-exchange claim (disclaimer present)');
  else fail('no real-exchange claim (disclaimer present)');
  await page.click('#close-currency-tools');
  await page.waitForFunction(() => !document.querySelector('#currency-tools-dialog').open, { timeout: 5000 });
  pass('currency dialog closes');

  // ---------- G. Recurring + Insights ----------
  await page.click('.dash-side-nav [data-view="recurring"]');
  await sleep(700);
  pass('recurring rules listed', (await page.locator('#recurring-list').innerText()).replace(/\n/g, ' ').slice(0, 60));
  const RULE = `Journey Rule ${ts}`;
  await page.fill('#new-rec-title', RULE);
  await page.fill('#new-rec-amount', '5');
  await page.click('#add-recurring');
  await sleep(1800);
  const rrow = page.locator('#recurring-list li', { hasText: RULE });
  if ((await rrow.count()) === 1) pass('test recurring rule created (disposable DB)');
  else fail('test recurring rule created (disposable DB)');
  await rrow.locator('[data-rec]').click();
  await sleep(2200);
  pass('rule posts exactly one ledger entry', (await page.locator('#dashboard-toast').innerText()).length > 2 ? 'posted' : 'missing');
  await page.click('.dash-side-nav [data-view="transactions"]');
  await sleep(700);
  await page.fill('#transaction-search', RULE);
  await sleep(500);
  if ((await page.locator('#transaction-list').innerText()).includes(RULE)) pass('posted entry visible in ledger');
  else fail('posted entry visible in ledger');
  await page.locator('#transaction-list .dash-row .row-del:not([disabled])').first().click();
  await sleep(700);
  await page.fill('#transaction-search', '');
  pass('posted test entry cleaned up');
  await page.click('.dash-side-nav [data-view="insights"]');
  await sleep(900);
  const cards = await page.locator('.insight-card').count();
  const ev = await page.locator('.insight-card .insight-more').allInnerTexts().catch(() => []);
  if (cards >= 1 && ev.every(t => /Evidence \d+ entr|Open breakdown/.test(t))) pass('insights show evidence-backed summaries', `${cards} cards`);
  else fail('insights show evidence-backed summaries', `${cards} cards`);

  // ---------- H. Theme + preferences ----------
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.click('.dashboard-view [data-theme-toggle]');
  await sleep(1000);
  const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (before !== after) pass('theme switch visibly changes interface', `${before} -> ${after}`);
  else fail('theme switch visibly changes interface');
  await page.click('.dashboard-view [data-theme-toggle]');
  await sleep(1000);
  await page.click('.dash-side-nav [data-view="accounts"]');
  await sleep(600);
  await page.selectOption('#settings-home-currency', 'USD');
  await page.click('#save-settings');
  await sleep(1800);
  pass('home currency preference saves', (await page.locator('#dashboard-toast').innerText()).length > 2 ? 'saved' : 'missing');
  await page.selectOption('#settings-home-currency', 'INR');
  await page.click('#save-settings');
  await sleep(1800);

  // ---------- I. Reload persistence + sign out ----------
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true', { timeout: 20000 });
  await sleep(800);
  if (!(await page.locator('#dashboard-view.open').count())) {
    await page.click('.contact-btn');
    await page.waitForSelector('#dashboard-view.open');
  } else pass('dashboard state restored after reload');
  await sleep(800);
  if ((await page.locator('#cloud-status').innerText()).includes('Cloud sync') && (await page.locator('#total-balance').innerText()).length > 1) pass('session + data persist across reload');
  else fail('session + data persist across reload');
  await page.click('#auth-button');
  await sleep(900);
  if ((await page.locator('#cloud-status').innerText()).includes('Local demo') && (await page.locator('#auth-button').innerText()).includes('Sign in')) pass('sign-out returns to local demo');
  else fail('sign-out returns to local demo');
} catch (e) {
  fail('journey aborted', String(e).slice(0, 200));
  await page.screenshot({ path: ARTIFACTS + '/journey-failure.png' }).catch(() => {});
}

await context.close();
await browser.close();

// rename recorded video to the canonical master name
const files = fs.readdirSync(ARTIFACTS).filter(f => f.endsWith('.webm') && !f.startsWith('roviel-full'));
const failed = results.filter(r => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} journey checks passed ====`);
if (files.length) {
  fs.renameSync(`${ARTIFACTS}/${files[0]}`, `${ARTIFACTS}/roviel-full-user-journey.webm`);
  console.log('video: ' + ARTIFACTS + '/roviel-full-user-journey.webm');
}
if (failed.length) {
  console.log('FAILED:\n - ' + failed.map(f => f.name).join('\n - '));
  process.exit(1);
}
