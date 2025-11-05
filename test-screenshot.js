const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  console.log('Navigating to google.com...');
  await page.goto('https://google.com');

  console.log('Taking screenshot...');
  await page.screenshot({ path: 'google-screenshot.png' });

  console.log('Screenshot saved as google-screenshot.png');
  await browser.close();
})();
