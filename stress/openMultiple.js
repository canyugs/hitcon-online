// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const puppeteer = require('puppeteer');

const TABS_PER_BROWSER = 20;

// Usage example:
// $ node openMultiple.js 10 127.0.0.1:5000

function procURL(inURL) {
  if (inURL.startsWith('https://') || inURL.startsWith('http://')) {
    // Everything's fine.
  } else {
    inURL = 'http://' + inURL;
  }
  let u = new URL(inURL);
  u.searchParams.set('test', 'type1');
  u.searchParams.set('skipCookieToken', 'true');
  u.searchParams.set('disableRender', 'true');
  u.pathname = '/client.html';
  return u.href;
}

async function main() {
  let args = process.argv.slice(2);
  if (args.length != 2) {
    console.log('Usage: openMultiple.js <tab count> <server url>');
    return;
  }
  let inURL = args[1];
  let cnt = parseInt(args[0], 10);
  if (!Number.isInteger(cnt)) {
    console.log('Tab count not integer: ', cnt);
    return;
  }
  let outURL;
  try {
    outURL = procURL(inURL);
  } catch (e) {
    console.log('Invalid URL: ', inURL);
  }

  console.log(`Opening ${cnt} x ${outURL}`);

  let browsers = [];
  let pages = [];
  function onClose() {
    (async () => {
      console.log('Cleaning up...');
      for (const b of browsers) {
        await b.close();
      }
      console.log('Done cleaning up...');
      process.exit(0);
    })();
  }
  process.on('exit', onClose);
  process.on('SIGINT', onClose);
  process.on('SIGTERM', onClose);

  let browser = null;
  let browserTabCount = 0;
  async function ensureBrowser() {
    if (browser === null || browserTabCount >= TABS_PER_BROWSER) {
      console.log('Creating new browser...');
      browser = await puppeteer.launch();
      browserTabCount = 0;
      browsers.push(browser);
    }
  };

  async function openPage(i) {
    console.log(`Opening page ${i}`);
    await ensureBrowser();
    const page = await browser.newPage();
    await page.goto(outURL);
    pages.push(page);
    browserTabCount++;
    //console.log(`Done opening page ${i}`);
  }

  for (let i = 0; i < cnt; i++) {
    // Add await to open page by page.
    await openPage(i);
  }

  while (true) {
    // Just let it run.
    await (new Promise(resolve => setTimeout(resolve, 1000)));
  }
}

main();
