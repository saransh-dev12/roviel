import { chromium } from '@playwright/test';
import fs from 'fs';

const WEB = process.env.WEB || 'http://localhost:5173';
const API = process.env.API || 'http://localhost:4000';
const CAPTURE = process.env.CAPTURE === '1';
// Cloud checks fail the suite when sign-in fails. Set RESPONSIVE_CLOUD_OPTIONAL=1
// to record them as explicit skips (with the reason) instead of failures.
const CLOUD_OPTIONAL = process.env.RESPONSIVE_CLOUD_OPTIONAL === '1';
// Substrings of browser errors that are known and intentionally handled.
// Keep this list empty unless a specific error is documented as handled.
const KNOWN_HANDLED_ERRORS = [];
const results = [];
const skips = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + String(detail).slice(0, 140) : ''}`);
};
const skip = (name, reason) => {
  skips.push({ name, reason });
  console.log(`SKIP  ${name} — ${String(reason).slice(0, 140)}`);
};

const THEMES = ['noir', 'brutal'];

const viewports = [
  { name: '320x568', width: 320, height: 568, touch: true },
  { name: '360x740', width: 360, height: 740, touch: true },
  { name: '375x812', width: 375, height: 812, touch: true },
  { name: '390x844', width: 390, height: 844, touch: true },
  { name: '414x896', width: 414, height: 896, touch: true },
  { name: '430x932', width: 430, height: 932, touch: true },
  { name: '568x320', width: 568, height: 320, touch: true },
  { name: '667x375', width: 667, height: 375, touch: true },
  { name: '844x390', width: 844, height: 390, touch: true },
  { name: '768x1024', width: 768, height: 1024, touch: true },
  { name: '1024x768', width: 1024, height: 768, touch: true },
  { name: '1180x820', width: 1180, height: 820, touch: false },
  { name: '1280x800', width: 1280, height: 800, touch: false },
  { name: '1366x768', width: 1366, height: 768, touch: false },
  { name: '1440x900', width: 1440, height: 900, touch: false },
  { name: '1920x1080', width: 1920, height: 1080, touch: false },
];

const browser = await chromium.launch();
const pageErrors = [];

async function ready(page) {
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true', null, { timeout: 20000 });
}

async function newPage(viewport, theme = 'noir') {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.touch,
    isMobile: viewport.touch && viewport.width < 1000,
    deviceScaleFactor: 1,
  });
  await context.addInitScript(value => {
    try { localStorage.setItem('roviel.theme', value); } catch {}
  }, theme);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => pageErrors.push(String(error).slice(0, 180)));
  return { context, page };
}

async function openDashboard(page) {
  await page.goto(WEB + '/#dashboard', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.waitForSelector('#dashboard-view.open');
  await page.waitForTimeout(250);
}

async function overflow(page) {
  return page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - window.innerWidth,
    body: document.body.scrollWidth - window.innerWidth,
  }));
}

// Phone widths where the converter's controls are checked in full. The
// smallest and a current iPhone cover both the stacked layout and the roomier
// one without doubling the suite's runtime across every viewport.
const PHONE_CONVERTER_VIEWPORTS = ['320x568', '390x844'];

async function converterChecks(page, viewport, tag) {
  const state = () => page.evaluate(() => {
    const el = id => document.getElementById(id);
    const box = node => {
      const rect = node.getBoundingClientRect();
      return { left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    const dialog = el('currency-tools-dialog');
    return {
      from: el('currency-from').value,
      to: el('currency-to').value,
      fromOptions: el('currency-from').options.length,
      toOptions: el('currency-to').options.length,
      fromBox: box(el('currency-from')),
      toBox: box(el('currency-to')),
      swapBox: box(el('currency-swap')),
      closeBox: box(el('close-currency-tools')),
      fromFont: parseFloat(getComputedStyle(el('currency-from')).fontSize),
      message: el('currency-search-message').hidden ? '' : el('currency-search-message').textContent,
      pairLabel: el('provider-pair-label').textContent,
      feeLabel: el('fee-currency-label').textContent,
      dialogBox: box(dialog),
      horizontal: dialog.scrollWidth - dialog.clientWidth,
    };
  });

  const openConverter = async () => {
    await page.locator('#open-currency-tools-mobile').click();
    await page.waitForSelector('#currency-tools-dialog[open]');
    await page.waitForTimeout(350);
  };
  const settle = (ms = 260) => page.waitForTimeout(ms);

  check(`${tag} converter entry point is reachable`, await page.locator('#open-currency-tools-mobile').isVisible());
  await openConverter();

  const initial = await state();
  check(`${tag} converter dialog fits the viewport`,
    initial.dialogBox.top >= 0 && initial.dialogBox.bottom <= viewport.height + 1 && initial.dialogBox.left >= 0 && initial.dialogBox.right <= viewport.width + 1,
    JSON.stringify(initial.dialogBox));
  check(`${tag} converter dialog has no horizontal overflow`, initial.horizontal <= 1, `${initial.horizontal}px`);
  check(`${tag} both currency selectors are readable and tappable`,
    initial.fromBox.width >= 140 && initial.toBox.width >= 140 && initial.fromBox.height >= 44 && initial.toBox.height >= 44,
    JSON.stringify({ from: initial.fromBox, to: initial.toBox }));
  check(`${tag} currency selectors avoid iOS zoom`, initial.fromFont >= 16, `${initial.fromFont}px`);
  check(`${tag} swap control is a comfortable tap target`, initial.swapBox.height >= 44 && initial.swapBox.width >= 44, JSON.stringify(initial.swapBox));
  check(`${tag} converter close control is a comfortable tap target`, initial.closeBox.height >= 44 && initial.closeBox.width >= 44, JSON.stringify(initial.closeBox));

  await page.fill('#currency-search', 'Indian Rupee');
  await settle(180);
  const byName = await state();
  const nameMatch = await page.locator('#currency-from option[value="INR"]').count();
  check(`${tag} converter search matches a currency name`, nameMatch === 1 && byName.fromOptions <= 4, `${byName.fromOptions} options`);

  await page.fill('#currency-search', '₹');
  await settle(180);
  check(`${tag} converter search matches a currency symbol`, await page.locator('#currency-from option[value="INR"]').count() === 1);

  await page.fill('#currency-search', 'usd');
  await settle(180);
  check(`${tag} converter search is case-insensitive`, await page.locator('#currency-from option[value="USD"]').count() === 1);

  await page.fill('#currency-search', 'Rupee');
  await settle(180);
  await page.selectOption('#currency-from', 'INR');
  await settle(320);
  const picked = await state();
  check(`${tag} picking a filtered result keeps it and restores both lists`,
    picked.from === 'INR' && picked.fromOptions > 4 && picked.toOptions > 4,
    JSON.stringify({ from: picked.from, fromOptions: picked.fromOptions, toOptions: picked.toOptions }));
  check(`${tag} pair labels follow the picked currency`, picked.pairLabel === 'INR → ' + picked.to, picked.pairLabel);

  await page.fill('#currency-search', 'zzzzqq');
  await settle(200);
  const missing = await state();
  check(`${tag} converter explains a search with no matches`, missing.message.length > 0, missing.message.slice(0, 60));
  check(`${tag} a search with no matches keeps usable selectors`, missing.fromOptions > 4 && missing.toOptions > 4, `${missing.fromOptions}/${missing.toOptions} options`);
  check(`${tag} a search with no matches keeps the selected pair`, missing.from === 'INR' && missing.to === picked.to, `${missing.from}/${missing.to}`);

  await page.fill('#currency-search', '');
  await settle(200);
  const restored = await state();
  check(`${tag} clearing the search restores the directory`, restored.fromOptions === initial.fromOptions, `${restored.fromOptions} vs ${initial.fromOptions}`);

  await page.selectOption('#currency-to', restored.from === 'EUR' ? 'GBP' : 'EUR');
  await settle(320);
  const beforeSwap = await state();
  await page.click('#currency-swap');
  await settle(320);
  const swapped = await state();
  check(`${tag} swap exchanges both currencies`, swapped.from === beforeSwap.to && swapped.to === beforeSwap.from, `${beforeSwap.from}/${beforeSwap.to} → ${swapped.from}/${swapped.to}`);
  check(`${tag} swap updates the pair labels`, swapped.pairLabel === swapped.from + ' → ' + swapped.to && swapped.feeLabel === swapped.to, `${swapped.pairLabel} / ${swapped.feeLabel}`);
  const facts = await page.locator('#currency-rate-facts p').first().innerText();
  check(`${tag} rate facts describe the selected pair`, facts.includes(swapped.from + ' =') || /Unavailable/.test(facts), facts.replace(/\s+/g, ' '));
  const resultText = await page.locator('#currency-result').innerText();
  check(`${tag} result names the destination currency`, resultText.includes(swapped.to) || /unavailable|valid amount/i.test(resultText), resultText.replace(/\s+/g, ' ').slice(0, 50));

  await page.fill('#provider-rate', '0.0115');
  await page.click('#refresh-currency-rate');
  await settle(600);
  check(`${tag} refreshing a rate keeps the provider quote for the same pair`, await page.inputValue('#provider-rate') === '0.0115');
  await page.selectOption('#currency-to', swapped.to === 'GBP' ? 'JPY' : 'GBP');
  await settle(600);
  check(`${tag} changing the pair clears the stale provider quote`, await page.inputValue('#provider-rate') === '');

  // Popular pairs, favourites and recents are local-only, so drive them
  // through their handlers rather than through the sticky header above them.
  const popular = await page.locator('#currency-popular-list button').first().innerText();
  await page.evaluate(() => document.querySelector('#currency-popular-list button')?.click());
  await settle(450);
  const [popularFrom, popularTo] = popular.split('/').map(part => part.trim());
  const popularState = await state();
  check(`${tag} popular pair applies both currencies`,
    popularState.from === popularFrom && popularState.to === popularTo,
    `${popular} → ${popularState.from}/${popularState.to}`);

  await page.evaluate(() => document.getElementById('save-pair').click());
  await settle(200);
  check(`${tag} favourite pair can be saved`, await page.getAttribute('#save-pair', 'aria-pressed') === 'true');
  await page.evaluate(() => document.getElementById('save-pair').click());
  await settle(200);
  check(`${tag} favourite pair can be removed`, await page.getAttribute('#save-pair', 'aria-pressed') === 'false');

  if (await page.isEnabled('#save-conversion')) {
    await page.evaluate(() => document.getElementById('save-conversion').click());
    await settle(250);
    check(`${tag} saving a conversion lists it as recent`, await page.locator('#currency-recents-list button').count() >= 1);
  }

  await page.evaluate(() => {
    const dialog = document.getElementById('currency-tools-dialog');
    dialog.scrollTop = dialog.scrollHeight;
  });
  await settle(260);
  const scrolled = await state();
  check(`${tag} converter close stays reachable while scrolled`,
    scrolled.closeBox.top >= 0 && scrolled.closeBox.bottom <= viewport.height + 1,
    JSON.stringify(scrolled.closeBox));

  await page.click('#close-currency-tools');
  await settle(200);
  check(`${tag} converter closes from its close button`, await page.evaluate(() => !document.getElementById('currency-tools-dialog').open));
}

async function dropdownChecks(page, viewport, tag) {
  await page.evaluate(() => window.RovielShowView('transactions'));
  await page.waitForTimeout(350);
  const menu = await page.evaluate(() => new Promise(resolve => {
    const select = document.getElementById('transaction-filter');
    if (!select) return resolve(null);
    const trigger = select.parentElement.querySelector('.select-trigger');
    trigger.scrollIntoView({ block: 'center' });
    trigger.click();
    setTimeout(() => {
      const open = document.querySelector('.select-menu:not([hidden])');
      if (!open) return resolve(null);
      const first = open.querySelector('.select-option');
      const rect = open.getBoundingClientRect();
      resolve({
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        options: open.querySelectorAll('.select-option').length,
        optionHeight: first ? Math.round(first.getBoundingClientRect().height) : 0,
      });
    }, 400);
  }));
  check(`${tag} dashboard dropdown stays inside the viewport`,
    !!menu && menu.left >= -1 && menu.right <= viewport.width + 1 && menu.top >= -1 && menu.bottom <= viewport.height + 1,
    JSON.stringify(menu));
  check(`${tag} dashboard dropdown lists selectable options`, !!menu && menu.options > 1, menu ? `${menu.options} options` : 'no menu');
  check(`${tag} dashboard dropdown options are touch sized`, !!menu && menu.optionHeight >= 40, menu ? `${Math.round(menu.optionHeight)}px` : 'no menu');
  await page.evaluate(() => {
    document.querySelectorAll('.select-menu').forEach(node => { node.hidden = true; });
    document.querySelectorAll('.select.open').forEach(node => node.classList.remove('open'));
  });
  await page.evaluate(() => window.RovielShowView('overview'));
  await page.waitForTimeout(250);
}

async function rect(page, selector) {
  return page.locator(selector).first().evaluate(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
  });
}

for (const theme of THEMES) {
  for (const viewport of viewports) {
    const tag = `[${theme}] ${viewport.name}`;
    const { context, page } = await newPage(viewport, theme);

    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    await ready(page);
    const landingOverflow = await overflow(page);
    check(`${tag} landing has no horizontal overflow`, landingOverflow.doc <= 1 && landingOverflow.body <= 1, JSON.stringify(landingOverflow));
    const headerCta = await rect(page, '.contact-btn');
    check(`${tag} header CTA stays in viewport`, headerCta.top >= 0 && headerCta.bottom <= viewport.height + 1 && headerCta.left >= 0 && headerCta.right <= viewport.width + 1, JSON.stringify(headerCta));

    if (viewport.height <= 520) {
      await page.evaluate(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, max * .94);
      });
      await page.waitForFunction(() => document.querySelector('#slide-4')?.classList.contains('active'), null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(450);
      const cta = await rect(page, '#slide-4 .slide-cta');
      const ctaOpacity = await page.locator('#slide-4 .slide-cta').evaluate(element => parseFloat(getComputedStyle(element).opacity));
      check(`${tag} landscape story CTA stays in viewport`, ctaOpacity > .5 && cta.top >= 0 && cta.bottom <= viewport.height + 1 && cta.left >= 0 && cta.right <= viewport.width + 1, JSON.stringify({ ...cta, opacity: ctaOpacity }));
    }

    if (viewport.width > 760 && viewport.width <= 900) {
      const convert = page.locator('#open-currency-tools-mobile');
      check(`${tag} landing currency tool stays reachable`, await convert.isVisible());
      await convert.click();
      await page.waitForSelector('#currency-tools-dialog[open]');
      const dialogRect = await rect(page, '#currency-tools-dialog');
      check(`${tag} currency tool fits the viewport`, dialogRect.top >= 0 && dialogRect.bottom <= viewport.height + 1 && dialogRect.left >= 0 && dialogRect.right <= viewport.width + 1, JSON.stringify(dialogRect));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('currency-tools-dialog').open);
    }

    if (PHONE_CONVERTER_VIEWPORTS.includes(viewport.name)) {
      await converterChecks(page, viewport, tag);
    }

    if (CAPTURE) {
      fs.mkdirSync('artifacts/responsive/after', { recursive: true });
      await page.screenshot({ path: `artifacts/responsive/after/landing-${theme}-${viewport.name}.png` });
    }

    await openDashboard(page);
    const dashOverflow = await overflow(page);
    check(`${tag} dashboard has no horizontal overflow`, dashOverflow.doc <= 1 && dashOverflow.body <= 1, JSON.stringify(dashOverflow));

    if (PHONE_CONVERTER_VIEWPORTS.includes(viewport.name)) {
      await dropdownChecks(page, viewport, tag);
    }

    if (CAPTURE) await page.screenshot({ path: `artifacts/responsive/after/dashboard-${theme}-${viewport.name}.png` });

    if (viewport.width <= 900) {
      const nav = page.locator('.mobile-nav');
      check(`${tag} bottom navigation is visible`, await nav.isVisible());
      const contextRow = await rect(page, '.dash-contextbar');
      check(`${tag} empty context row stays compact`, contextRow.height <= 46, `${Math.round(contextRow.height)}px`);
      check(`${tag} active mobile tab exposes aria-current`, await page.locator('.mobile-nav [data-view="overview"]').getAttribute('aria-current') === 'page');
      const navRect = await rect(page, '.mobile-nav');
      const padding = await page.locator('.dash-content').evaluate(element => parseFloat(getComputedStyle(element).paddingBottom) || 0);
      check(`${tag} content clears bottom navigation`, padding >= navRect.height, `padding ${padding}, nav ${navRect.height}`);
      await page.evaluate(() => {
        const toast = document.getElementById('dashboard-toast');
        toast.textContent = 'Responsive check';
        toast.classList.add('show');
      });
      const toastRect = await rect(page, '.dash-toast');
      check(`${tag} toast sits above the bottom navigation`, toastRect.bottom <= navRect.top - 2, JSON.stringify({ toast: toastRect.bottom, nav: navRect.top }));
      await page.evaluate(() => document.getElementById('dashboard-toast').classList.remove('show'));
    }

    if (['320x568', '390x844', '844x390'].includes(viewport.name)) {
      await page.evaluate(() => window.RovielShowView('transactions'));
      await page.waitForTimeout(200);
      const toolbar = await rect(page, '#view-transactions .dash-activity-tools');
      const firstRowTop = async () => page.locator('#transaction-list .dash-row:not(.head)').first().evaluate(node => node.getBoundingClientRect().top);
      const rowTop = await firstRowTop().catch(() => null);
      check(`${tag} transaction toolbar reserves no blank panel`, toolbar.height <= 140 && (rowTop === null || rowTop - toolbar.bottom <= 40), JSON.stringify({ toolbar: Math.round(toolbar.height), gap: rowTop === null ? null : Math.round(rowTop - toolbar.bottom) }));
      const row = page.locator('#transaction-list .dash-row:not(.head)').first();
      if (await row.count()) {
        const sub = row.locator('.dash-mobile-sub');
        check(`${tag} transaction metadata stays visible`, await sub.isVisible());
        const rowBox = await row.evaluate(element => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, width: box.width };
        });
        const nameBox = await row.locator('.dash-transaction-name').evaluate(element => element.getBoundingClientRect().width);
        check(`${tag} transaction description keeps useful width`, nameBox >= 72, `name ${Math.round(nameBox)}px`);
        check(`${tag} transaction row fits its card`, rowBox.left >= 0 && rowBox.right <= viewport.width + 1, JSON.stringify(rowBox));
      } else {
        check(`${tag} transaction row available for responsive checks`, false, 'no transaction rows rendered');
      }

      const more = page.locator('#mobile-more-toggle');
      if (await more.isVisible()) {
        await more.click();
        await page.waitForSelector('#mobile-more-sheet:not([hidden])');
        await page.waitForTimeout(80);
        const focusedInside = await page.evaluate(() => document.getElementById('mobile-more-sheet')?.contains(document.activeElement));
        check(`${tag} More sheet moves focus inside`, focusedInside);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(80);
        check(`${tag} Escape closes More without closing dashboard`,
          await page.evaluate(() => document.getElementById('mobile-more-sheet').hidden && document.getElementById('dashboard-view').classList.contains('open')));
      } else {
        check(`${tag} More sheet toggle visible on mobile`, false, 'toggle not visible');
      }

      await page.evaluate(() => window.RovielShowView('overview'));
      await page.click('#open-transaction');
      await page.waitForSelector('#transaction-modal[open]');
      const font = await page.locator('#transaction-name').evaluate(element => parseFloat(getComputedStyle(element).fontSize));
      if (viewport.touch) check(`${tag} mobile form inputs avoid iOS zoom`, font >= 16, `font ${font}px`);
      const form = page.locator('#transaction-form');
      await form.evaluate(element => { element.scrollTop = element.scrollHeight; });
      const save = await rect(page, '.tx-submit');
      check(`${tag} transaction save action is reachable`, save.top >= 0 && save.bottom <= viewport.height + 1, JSON.stringify(save));
      const modalOverflow = await page.evaluate(() => {
        const form = document.getElementById('transaction-form');
        return { horizontal: form.scrollWidth - form.clientWidth, viewport: document.documentElement.scrollWidth - window.innerWidth };
      });
      check(`${tag} transaction modal does not overflow horizontally`, modalOverflow.horizontal <= 1 && modalOverflow.viewport <= 1, JSON.stringify(modalOverflow));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      check(`${tag} Escape closes transaction modal without closing dashboard`,
        await page.evaluate(() => !document.getElementById('transaction-modal').open && document.getElementById('dashboard-view').classList.contains('open')));

      if (viewport.name === '844x390') {
        await page.click('#auth-button');
        await page.waitForSelector('#auth-modal[open]');
        const authForm = page.locator('#auth-modal .auth-form');
        await authForm.evaluate(element => { element.scrollTop = element.scrollHeight; });
        const authSubmit = await rect(page, '#auth-submit');
        check(`${tag} auth form scrolls and keeps submit reachable`, authSubmit.top >= 0 && authSubmit.bottom <= viewport.height + 1, JSON.stringify(authSubmit));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(120);
        check(`${tag} Escape closes auth without closing dashboard`,
          await page.evaluate(() => !document.getElementById('auth-modal').open && document.getElementById('dashboard-view').classList.contains('open')));
      }
    }

    if (['320x568', '390x844'].includes(viewport.name)) {
      await page.goto(WEB + '/#dashboard/pulse/AED-INR', { waitUntil: 'domcontentloaded' });
      await ready(page);
      await page.waitForSelector('#dashboard-view.open');
      await page.waitForTimeout(600);
      const tabs = await page.locator('#pulse-tabs').evaluate(element => {
        const box = element.getBoundingClientRect();
        const active = element.querySelector('button.active');
        if (!active) return null;
        const activeBox = active.getBoundingClientRect();
        return { left: box.left, right: box.right, activeLeft: activeBox.left, activeRight: activeBox.right };
      });
      check(`${tag} pulse deep link keeps active tab on screen`, !!tabs && tabs.activeLeft >= tabs.left - 1 && tabs.activeRight <= tabs.right + 1, JSON.stringify(tabs));

      await page.evaluate(base => localStorage.setItem('roviel.api.base', base), API);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await ready(page);
      await page.waitForSelector('#dashboard-view.open');
      let signedIn = false;
      try {
        await page.click('#auth-button');
        await page.waitForSelector('#auth-modal.open');
        await page.fill('#auth-email', 'demo@ledgerly.app');
        await page.fill('#auth-password', 'ledgerly123');
        await page.click('#auth-submit');
        await page.waitForFunction(() => document.querySelector('#cloud-status')?.textContent.includes('Cloud sync'), null, { timeout: 15000 });
        signedIn = true;
      } catch (error) {
        const message = String(error?.message || error).slice(0, 160);
        if (CLOUD_OPTIONAL) {
          skip(`${tag} cloud responsive checks`, `sign-in failed (RESPONSIVE_CLOUD_OPTIONAL=1) — ${message}`);
        } else {
          check(`${tag} cloud sign-in succeeds for cloud view checks`, false, message);
        }
      }

      if (signedIn) {
        for (const view of ['overview', 'transactions', 'accounts', 'budgets', 'goals', 'recurring', 'insights', 'pulse']) {
          await page.evaluate(name => window.RovielShowView(name), view);
          await page.waitForTimeout(view === 'pulse' ? 1000 : 500);
          const viewOverflow = await page.evaluate(name => {
            const host = document.getElementById('view-' + name);
            return { view: host.scrollWidth - host.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth };
          }, view);
          check(`${tag} ${view} view fits`, viewOverflow.view <= 1 && viewOverflow.page <= 1, JSON.stringify(viewOverflow));
        }
        if (viewport.touch) {
          const chartCount = await page.locator('#pulse-chart svg').count();
          check(`${tag} pulse chart renders for touch checks`, chartCount > 0, chartCount ? '' : 'no pulse chart svg');
          if (chartCount) {
            const chart = page.locator('#pulse-chart');
            await chart.scrollIntoViewIfNeeded();
            await page.waitForTimeout(200);
            const box = await chart.boundingBox();
            check(`${tag} pulse chart has a bounding box for touch checks`, !!box, box ? '' : 'bounding box unavailable');
            if (box) {
              await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
              await page.waitForTimeout(180);
              check(`${tag} pulse tooltip remains available to touch`, await page.locator('#pulse-tooltip').isVisible());
            }
          }
        }
      }
    }

    await context.close();
  }

  const reducedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const reducedPage = await reducedContext.newPage();
  reducedPage.on('pageerror', error => pageErrors.push(String(error).slice(0, 180)));
  await reducedPage.goto(WEB, { waitUntil: 'domcontentloaded' });
  await ready(reducedPage);
  await openDashboard(reducedPage);
  const reducedOverflow = await overflow(reducedPage);
  check(`[${theme}] reduced motion landing and dashboard remain usable`, reducedOverflow.doc <= 1 && reducedOverflow.body <= 1);
  await reducedContext.close();
}

await browser.close();

const knownHandled = error => KNOWN_HANDLED_ERRORS.some(known => error.includes(known));
const unexpectedErrors = pageErrors.filter(error => !knownHandled(error));
check('no unexpected browser page errors across the suite', unexpectedErrors.length === 0, unexpectedErrors.slice(0, 3).join(' | '));

const failures = results.filter(result => !result.ok);
console.log(`\n${results.length - failures.length}/${results.length} responsive checks passed.`);
if (skips.length) console.log(`${skips.length} check(s) skipped as explicitly optional:`);
for (const { name, reason } of skips) console.log(`  SKIP  ${name} — ${reason}`);
if (pageErrors.length) console.log('Page errors:', pageErrors.slice(0, 5));
if (failures.length) process.exitCode = 1;
