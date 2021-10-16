// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const puppeteer = require('puppeteer');

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

  let browser = undefined;
  let pages = [];
  function onClose() {
    (async () => {
      console.log('Cleaning up...');
      if (browser) {
        await browser.close();
      }
      console.log('Done cleaning up...');
      process.exit(0);
    })();
  }

  browser = await puppeteer.launch();

  process.on('exit', onClose);
  process.on('SIGINT', onClose);
  process.on('SIGTERM', onClose);

  async function openPage(i) {
    console.log(`Opening page ${i}`);
    const page = await browser.newPage();
    await page.goto(outURL);
    pages.push(page);
    console.log(`Done opening page ${i}`);
  }

  for (let i = 0; i < cnt; i++) {
    // Add await to open page by page.
    openPage(i);
  }

  while (true) {
    // Just let it run.
    await (new Promise(resolve => setTimeout(resolve, 1000)));
  }
}

main();
