// Quick design check: node stills.cjs <outDir> <t1> <t2> ...   -> one PNG per timestamp (seconds).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const [outDir, ...times] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('file://' + path.join(__dirname, 'reel.html') + '?capture=1');
  await page.waitForFunction(() => window.__ready === true);
  for (const t of times) {
    await page.evaluate(x => window.seek(x), parseFloat(t));
    await page.screenshot({ path: path.join(outDir, `t${String(t).padStart(5, '0')}.png`) });
  }
  await browser.close();
})();
