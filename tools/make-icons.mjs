// App icons and the share image, rendered in headless Chrome from what the app itself draws:
// the boxwood king on ink (public/favicon.svg) for the icons, the home page's first screen for the share image.
// node tools/make-icons.mjs [base]   (the share image needs the dev or preview server running)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://127.0.0.1:3770';
const svg = readFileSync('public/favicon.svg', 'utf8');
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  userDataDir: join(process.env.TEMP || '.', 'shah-chrome-icons'),
  args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--hide-scrollbars'],
});
const page = await browser.newPage();

async function icon(size, file, pad = 0) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(
    `<html><body style="margin:0;background:#111214;display:grid;place-items:center;width:${size}px;height:${size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  writeFileSync(join('public', file), await page.screenshot({ type: 'png' }));
  console.log(file);
}
await icon(192, 'icon-192.png');
await icon(512, 'icon-512.png');
// maskable: the king inside the safe circle (80%)
await icon(512, 'icon-maskable-512.png', 0.12);
await icon(180, 'apple-touch-icon.png');

// the share image: the home page's first screen at 1200 x 630
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(base + '/', { waitUntil: 'networkidle0' });
await page.addStyleTag({ content: '.mast,.home__dash,.tabs,.ticker{display:none!important}.stage{height:100vh!important}.home{--inset-top:1.5rem!important;--inset-bottom:1.5rem!important;--inset-left:27rem!important;--inset-right:1.5rem!important}' });
// a resize makes the board frame itself in the share image's own margins
await page.setViewport({ width: 1199, height: 630, deviceScaleFactor: 1 });
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await new Promise((r) => setTimeout(r, 4500));
writeFileSync(join('public', 'og.png'), await page.screenshot({ type: 'png' }));
console.log('og.png');
await browser.close();
