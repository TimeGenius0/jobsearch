const { chromium } = require('playwright');

(async () => {
  console.log('Attempting to launch Chrome...');
  try {
    const browser = await chromium.launch({
      headless: false,
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ Chrome launched successfully!');
    const page = await browser.newPage();
    await page.goto('https://example.com');
    console.log('✅ Page loaded');
    await page.waitForTimeout(3000);
    await browser.close();
  } catch (e) {
    console.error('❌ Failed:', e.message);
  }
})();
