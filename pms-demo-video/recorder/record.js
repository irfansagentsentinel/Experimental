// Records the screen scenes of the demo. Usage:
//   PMS_EMAIL=... PMS_PASSWORD=... node record.js [sceneId ...]
// Output: ../remotion/public/clips/<scene>.mp4 + <scene>.json (duration, narration cue times)
const path = require('path');
const fs = require('fs');
const d = require('./director');
const { click, type, select, hover, moveTo, smoothScroll, sleep } = d;

// visible text match inside the hotel app (the page also holds hidden agent-portal markup)
const T = (p, text) => p.locator('body').getByText(text).locator('visible=true').first();

const OUT = path.resolve(__dirname, '../remotion/public/clips');
const durations = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../assets/voice/durations.json')));

async function go(p, section) {
  await p.evaluate(s => navigate(s), section);
  await p.waitForLoadState('networkidle');
  await sleep(1800);
  await p.evaluate(() => { document.scrollingElement.scrollTop = 0; });
}

const scenes = {
  async '02-dashboard'(p, r) {
    await go(p, 'dashboard');
    await r.start(); await sleep(600);
    await r.cue();
    for (const id of ['#today-checkins', '#today-checkouts', '#today-bookings']) await hover(p, p.locator(id), 600);
    await hover(p, p.locator('#monthly-bookings'), 600);
    await hover(p, p.locator('#monthly-revenue'), 900);
    await smoothScroll(p, null, 260, 1400);
    await hover(p, p.locator('table tbody tr').first(), 800);
  },

  async '03-roomchart'(p, r) {
    await go(p, 'room-chart');
    await r.start(); await sleep(600);
    await r.cue();
    await hover(p, T(p, 'Aarav Mehta'), 900);
    await hover(p, T(p, 'Rohan & Kavya Iyer'), 900);
    await r.cue();
    await hover(p, T(p, 'Confirmed'), 700);
    await hover(p, T(p, 'In house'), 700);
    await hover(p, T(p, 'Arjun Reddy'), 800);
  },

  async '04-booking'(p, r) {
    await go(p, 'direct-booking');
    await r.start(); await sleep(500);
    await r.cue();
    await click(p, p.locator('#dbook-checkin-box'));
    await click(p, p.locator('.blist-cal-day[data-y="2026"][data-m="10"][data-d="24"]').first(), { pause: 300 });
    await click(p, p.locator('.blist-cal-day[data-y="2026"][data-m="10"][data-d="26"]').first(), { pause: 400 });
    await click(p, p.locator(`button[onclick="dbookAdjustCounter('hotel-adults', 1, 1)"]`), { pause: 300 });
    await click(p, p.locator('#hotel-search-btn'), { pause: 1800 });
    await r.cue();
    await smoothScroll(p, null, 300, 1000);
    await hover(p, T(p, 'Suite Rate'), 600);
    await click(p, p.locator('.dbook-rateplan-book-btn').nth(1), { pause: 1200 });
    await r.cue();
    await type(p, p.locator('#hotel-guest-name'), 'Ananya Rao');
    await type(p, p.locator('#hotel-guest-phone'), '9811200021');
    await type(p, p.locator('#hotel-guest-email'), 'ananya.rao@example.com', { delay: 30 });
    await select(p, p.locator('#hotel-nationality'), 'Indian');
    const summary = p.locator('#dbook-payment-summary');
    await summary.scrollIntoViewIfNeeded().catch(() => {});
    await sleep(600);
    await hover(p, summary, 1200);
    await r.cue();
    await click(p, p.locator('#hotel-confirm-booking-btn'), { pause: 300 });
    await T(p, 'Confirmation Code').waitFor({ timeout: 20000 });
    await sleep(1200);
    await hover(p, T(p, 'Confirmation Code'), 1500);
  },

  async '05-checkin'(p, r) {
    await go(p, 'fd-arrivals');
    await r.start(); await sleep(500);
    await r.cue();
    const row = p.locator('tr', { hasText: 'Daniel Müller' }).first();
    await hover(p, row.locator('td').nth(1), 900);
    await click(p, row.getByRole('button', { name: 'Check In' }), { pause: 1500 });
    await r.cue();
    const picker = p.locator('#ci-room-picker-0');
    const opts = await picker.locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
    await select(p, picker, opts[Math.min(1, opts.length - 1)]);
    await click(p, p.getByRole('button', { name: 'Confirm Check In' }), { pause: 2200 });
  },

  async '06-pos-setup'(p, r) {
    await go(p, 'pos-management');
    await r.start(); await sleep(500);
    await r.cue();
    await click(p, p.locator('button[onclick="openPosOutletCreateModal()"]'), { pause: 900 });
    await type(p, p.locator('#pos-outlet-name'), 'Spa & Wellness');
    await type(p, p.locator('#pos-outlet-email'), 'spa@example.com', { delay: 30 });
    await type(p, p.locator('#pos-outlet-phone'), '9800000103', { delay: 30 });
    await r.cue();
    await type(p, p.locator('#pos-outlet-service-charge'), '5');
    await type(p, p.locator('#pos-outlet-gst-percentage'), '18');
    await click(p, p.locator('#pos-outlet-submit-btn'), { pause: 1800 });
    await click(p, p.locator(`button[onclick="openPosCategories('9')"]`), { pause: 1800 });
    await hover(p, T(p, 'Mains'), 900);
  },

  async '07-pos-order'(p, r) {
    await go(p, 'pos-billing');
    await p.evaluate(() => { window.openPrintWindow = () => {}; });
    await p.locator(`button[onclick="openPosBilling('9')"]`).click();
    await p.waitForLoadState('networkidle'); await sleep(1200);
    // start from a fresh empty bill (the current open one is put on hold)
    await p.locator('#pos-billing-new-bill-btn').click();
    await p.waitForLoadState('networkidle'); await sleep(1200);
    await r.start(); await sleep(500);
    await r.cue();
    for (const item of ['Masala Dosa', 'Cappuccino', 'Chocolate Lava Cake']) {
      await click(p, p.locator('button', { hasText: item }).first(), { pause: 700 });
    }
    await r.cue();
    await click(p, p.getByRole('button', { name: 'Print KOT' }), { pause: 1200 });
    await r.cue();
    await click(p, p.locator('input[name="pos-bill-seating"]').nth(1), { pause: 1000 });
    const folioSel = p.locator('select[onchange*="folio_id"]');
    const val = await folioSel.locator('option', { hasText: 'Ishaan Kapoor' }).first().getAttribute('value');
    await select(p, folioSel, val);
    await sleep(800);
    const staff = p.locator('input[onchange*="billing_staff"]');
    if (!(await staff.inputValue())) { await type(p, staff, 'Vikram Singh'); await staff.blur(); await sleep(800); }
    await click(p, p.getByRole('button', { name: 'Pay @ Checkout' }), { pause: 2000 });
  },

  async '08-folio'(p, r) {
    await go(p, 'folios');
    await r.start(); await sleep(500);
    await r.cue();
    const row = p.locator('tr', { hasText: 'Ishaan Kapoor' }).first();
    await click(p, row.getByRole('button', { name: 'View' }), { pause: 2000 });
    await hover(p, T(p, 'Total Charges'), 900).catch(() => {});
    const posRows = p.locator('tr', { hasText: 'POS Bill' }).locator('visible=true');
    for (let i = 0; i < Math.min(3, await posRows.count()); i++) await hover(p, posRows.nth(i), 700);
    await hover(p, p.locator('tr', { hasText: 'Room charges' }).locator('visible=true').first(), 900).catch(() => {});
    await hover(p, T(p, 'Balance Due'), 1000).catch(() => {});
  },

  async '09-users'(p, r) {
    await go(p, 'inhouse-users');
    await r.start(); await sleep(500);
    await r.cue();
    await click(p, p.locator('button:has-text("+ Add New User")'), { pause: 900 });
    await type(p, p.locator('#user-name'), 'Kabir Khan');
    await type(p, p.locator('#user-email'), 'kabir.khan@example.com', { delay: 30 });
    await type(p, p.locator('#user-designation'), 'Guest Relations Executive', { delay: 30 });
    await type(p, p.locator('#user-username'), 'kabir.gre');
    await type(p, p.locator('#user-password'), 'Demo@2026#Reef', { delay: 30 });
    await r.cue();
    await click(p, p.locator('label:has-text("Dashboard")').first(), { pause: 500 });
    await click(p, p.locator('label:has-text("Front Desk")').first(), { pause: 700 });
    await click(p, p.locator('label:has-text("Point of Sale")').first(), { pause: 700 });
    const cell = p.locator('.pos-perm-cell[data-key="pos_billing:9"]');
    await cell.scrollIntoViewIfNeeded(); await sleep(500);
    await click(p, cell, { pause: 500 });
    await click(p, p.locator('.pos-perm-cell[data-key="pos_orders_view:9"]'), { pause: 700 });
    await click(p, p.getByRole('button', { name: 'Create User' }), { pause: 2000 });
  },

  async '10-reports'(p, r) {
    await go(p, 'revenue-report');
    await r.start(); await sleep(500);
    await r.cue();
    await hover(p, T(p, 'Total Revenue'), 900).catch(() => {});
    await hover(p, T(p, 'Revenue by Source'), 900).catch(() => {});
    await smoothScroll(p, null, 300, 1400);
    await go(p, 'occupancy-report');
    await hover(p, T(p, 'Occupancy Rate'), 900).catch(() => {});
    await hover(p, T(p, 'Occupancy by Room Type'), 900).catch(() => {});
  },
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(scenes);
  const { browser, page } = await d.launch();
  page.on('pageerror', e => console.log('  pageerror:', e.message));
  for (const id of ids) {
    console.log('recording', id);
    const rec = new d.Recorder(page, id, OUT, durations[id]);
    try {
      await scenes[id](page, rec);
      const meta = await rec.finish();
      console.log('  done', meta.duration + 's', 'cues', meta.cues.join(', '));
    } catch (e) {
      console.log('  FAILED', id, e.message.split('\n')[0]);
      await page.screenshot({ path: path.join(OUT, id + '_error.png') });
      try { await rec.cdp?.send('Page.stopScreencast'); } catch {}
    }
    await page.evaluate(() => document.querySelectorAll('.fixed.inset-0').forEach(e => e.remove())).catch(() => {});
  }
  await browser.close();
})();
