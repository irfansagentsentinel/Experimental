// Check stills before a full render: node stills.cjs <outDir> [--zones] <t1> <t2> ...
// Saves one PNG per timestamp (seconds). --zones draws the platform-UI bands over each still:
// anything meant to be read should stay out of the shaded areas.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const args = process.argv.slice(2);
  const outDir = args.shift();
  const zones = args[0] === '--zones' ? (args.shift(), true) : false;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('file://' + path.join(__dirname, 'composition.html') + '?capture=1');
  await page.waitForFunction(() => window.__ready === true);
  if (zones) {
    await page.evaluate(() => {
      const band = 'position:absolute;background:rgba(255,40,40,.28);z-index:99;pointer-events:none;';
      document.getElementById('stage').insertAdjacentHTML('beforeend',
        `<div style="${band}left:0;top:0;width:1080px;height:250px"></div>` +
        `<div style="${band}left:0;top:1536px;width:1080px;height:384px"></div>` +
        `<div style="${band}left:940px;top:960px;width:140px;height:576px"></div>`);
    });
  }
  for (const t of args) {
    await page.evaluate(x => window.seek(x), parseFloat(t));
    await page.screenshot({ path: path.join(outDir, `t${parseFloat(t).toFixed(3).padStart(7, '0')}.png`) });
  }
  await browser.close();
})();
