// The daily reminder end to end on a built copy (the service worker exists only in a build): the switch on Progresi
// asks for permission, subscribes and tells the server the hour and time zone; the hourly ring then reaches a
// stand-in push service with a message the subscription's keys open; the service worker shows the notification;
// turning the switch off unsubscribes. Headless Chrome cannot reach a real push service, so the browser's
// subscription is a stand-in carrying real keys.
// Build with PUBLIC_SHAH_SERVER=http://127.0.0.1:8787 npm run build, serve it on 3772, run the local server (8787).
// node tools/test-remind.mjs [base]
import { createDecipheriv, createECDH, hkdfSync, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://127.0.0.1:3772';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (c, label, extra = '') => {
  if (!c) failed++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${extra ? `  | ${extra}` : ''}`);
};

// the stand-in push service and the browser's keys
const received = [];
const service = createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    received.push({ url: req.url, body: Buffer.concat(chunks) });
    res.statusCode = 201;
    res.end();
  });
});
await new Promise((r) => service.listen(0, '127.0.0.1', r));
const ua = createECDH('prime256v1');
ua.generateKeys();
const auth = randomBytes(16);
const sub = { endpoint: `http://127.0.0.1:${service.address().port}/phone-${Date.now()}`, keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } };
const open = (b) => {
  const salt = b.subarray(0, 16);
  const idlen = b[20];
  const asPublic = b.subarray(21, 21 + idlen);
  const sealed = b.subarray(21 + idlen);
  const ikm = Buffer.from(hkdfSync('sha256', ua.computeSecret(asPublic), auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic]), 32));
  const d = createDecipheriv('aes-128-gcm', Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16)), Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12)));
  d.setAuthTag(sealed.subarray(sealed.length - 16));
  const plain = Buffer.concat([d.update(sealed.subarray(0, sealed.length - 16)), d.final()]);
  return JSON.parse(plain.subarray(0, plain.lastIndexOf(2)).toString());
};

const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--hide-scrollbars'] });
const ctx = await browser.createBrowserContext();
await ctx.overridePermissions(base, ['notifications']);
const page = await ctx.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// the browser's push subscription, standing in for the real push service
await page.evaluateOnNewDocument((sub) => {
  let current = null;
  const make = () => ({ endpoint: sub.endpoint, toJSON: () => sub, unsubscribe: async () => ((current = null), (window.__unsubscribed = true), true) });
  PushManager.prototype.subscribe = async function (opts) {
    window.__serverKey = opts.applicationServerKey.byteLength;
    current = make();
    return current;
  };
  PushManager.prototype.getSubscription = async () => current;
}, sub);

await page.goto(base + '/progresi/cilesimet/', { waitUntil: 'networkidle0' });
await page.evaluate(() => navigator.serviceWorker.ready);
ok(await page.$eval('[data-remind-box]', (e) => !!e), 'a build with a server shows the reminder');
const hour = new Date().getHours();
await page.evaluate(() => document.querySelector('[data-remind]').click());
await page.waitForFunction(() => document.querySelector('[data-remind-note]').textContent.includes('Kujtesa vjen'), { timeout: 10000 }).catch(() => {});
ok((await page.evaluate(() => window.__serverKey)) === 65, 'the subscription is made with the server’s 65-byte public key');
ok(await page.$eval('[data-remind-hour-row]', (e) => !e.hidden), 'on: the hour row appears', await page.$eval('[data-remind-note]', (e) => e.textContent));
// the hour moved to now, so the next ring is for this phone
await page.evaluate((h) => {
  const s = document.querySelector('[data-remind-hour]');
  s.value = String(h);
  s.dispatchEvent(new Event('change'));
}, hour);
await page.waitForFunction((h) => document.querySelector('[data-remind-note]').textContent.includes(`${String(h).padStart(2, '0')}:00`), { timeout: 10000 }, hour).catch(() => {});
ok((await page.evaluate(() => localStorage.getItem('shah.remind'))) === JSON.stringify({ hour }), 'the chosen hour is kept', String(hour));

await fetch('http://127.0.0.1:8787/__scheduled?cron=0+*+*+*+*');
for (let i = 0; i < 40 && !received.some((r) => r.url === new URL(sub.endpoint).pathname); i++) await sleep(100);
const msg = received.find((r) => r.url === new URL(sub.endpoint).pathname);
const note = msg && open(msg.body);
ok(note?.body === 'Ushtrimi i ditës të pret.' && note.url === '/ushtrime/?tema=dita', 'the hourly ring reaches this phone, readable only with its keys', note?.body);

// the service worker shows it: the push delivered to the real worker through DevTools
const cdp = await page.createCDPSession();
const regs = [];
cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => regs.push(...e.registrations));
await cdp.send('ServiceWorker.enable');
await sleep(500);
const reg = regs.find((r) => r.scopeURL.startsWith(base));
await cdp.send('ServiceWorker.deliverPushMessage', { origin: base, registrationId: reg.registrationId, data: JSON.stringify(note) });
await sleep(800);
const shown = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag, url: n.data?.url })));
ok(shown.length === 1 && shown[0].title === 'Shah' && shown[0].body === note.body && shown[0].tag === 'daily' && shown[0].url === '/ushtrime/?tema=dita', 'the service worker shows “Shah: Ushtrimi i ditës të pret.”', JSON.stringify(shown));

// off: unsubscribed here and on the server, so the next ring is silent
await page.evaluate(() => document.querySelector('[data-remind]').click());
await sleep(800);
ok((await page.evaluate(() => window.__unsubscribed)) === true && (await page.evaluate(() => localStorage.getItem('shah.remind'))) === null, 'off: the phone unsubscribes');
const n = received.length;
await fetch('http://127.0.0.1:8787/__scheduled?cron=0+*+*+*+*');
await sleep(1500);
ok(received.length === n, 'and the server stops ringing it');

// a phone without push (an iPhone outside the home screen) is told how to get it
const ios = await ctx.newPage();
await ios.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await ios.evaluateOnNewDocument(() => {
  delete window.PushManager;
});
await ios.goto(base + '/progresi/cilesimet/', { waitUntil: 'networkidle0' });
const iosNote = await ios.$eval('[data-remind-note]', (e) => e.textContent);
ok((await ios.$eval('[data-remind]', (e) => e.disabled)) && iosNote.includes('ekrani kryesor'), 'on an iPhone in Safari: the switch waits and says to add Shah to the home screen', iosNote.slice(0, 70));

await browser.close();
service.close();
ok(!errors.length, 'no page errors', errors.join(' / '));
console.log(failed ? `\n${failed} FAILED` : '\nthe reminder works');
process.exit(failed ? 1 : 0);
