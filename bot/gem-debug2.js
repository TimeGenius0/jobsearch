const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  });
  await page.goto('https://jobs.gem.com/biorender/am9icG9zdDrChY8ZhcZKCg-tVL7zE_NE?src=Linkedin', { waitUntil: 'commit', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Dump the HTML of the `flex-9` ancestor (which contains all form rows)
  const result = await page.evaluate(() => {
    const inp = document.querySelector('input[type="text"]');
    let node = inp?.parentElement;
    for (let d = 0; d < 10; d++) {
      if (!node) break;
      if (node.className?.includes('flex-9')) {
        return {
          class: node.className,
          innerHTML: node.innerHTML.substring(0, 4000),
          innerText: node.innerText.substring(0, 1000),
        };
      }
      node = node.parentElement;
    }
    return null;
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
