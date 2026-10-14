// The small server (server/), run locally with `npx wrangler dev -c server/wrangler.jsonc --port 8787 --test-scheduled`:
// who may call it, a game between two friends from code to rematch (illegal moves, draw, resignation, a fallen flag,
// a player who walked away), the sync vault's revisions, and the daily reminder delivered to a stand-in push
// service that checks the VAPID signature and decrypts the message the way a browser would (RFC 8291).
// node tools/test-server.mjs [base]
import { createECDH, createHash, createPublicKey, createVerify, hkdfSync, randomBytes, createDecipheriv } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const ORIGIN = 'http://127.0.0.1:3770';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (c, label, extra = '') => {
  if (!c) failed++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${extra ? `  | ${extra}` : ''}`);
};
const api = async (path, init = {}) => {
  const res = await fetch(base + path, { ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data, headers: res.headers };
};
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });

// ------------------------------------------------------------------ who may call
{
  const pre = await fetch(base + '/room', { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } });
  ok(pre.status === 204 && pre.headers.get('access-control-allow-origin') === ORIGIN, 'the app’s own origin passes the preflight');
  const evil = await fetch(base + '/room', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' });
  ok(evil.status === 403, 'another site is turned away', String(evil.status));
  const preview = await fetch(base + '/', { headers: { Origin: 'https://3f2a9c1b.shah-trajneri.pages.dev' } });
  ok(preview.headers.get('access-control-allow-origin') === 'https://3f2a9c1b.shah-trajneri.pages.dev', 'a Pages preview deploy is allowed too');
}

// ------------------------------------------------------------------ a game between two friends
class Player {
  constructor(code, token) {
    this.states = [];
    this.ws = new WebSocket(`${base.replace(/^http/, 'ws')}/room/${code}/ws?token=${token}`);
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'state') this.states.push(m);
    };
    this.open = new Promise((r, j) => {
      this.ws.onopen = r;
      this.ws.onerror = j;
    });
  }
  get last() {
    return this.states[this.states.length - 1];
  }
  send(m) {
    this.ws.send(JSON.stringify(m));
  }
  async until(fn, ms = 4000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (this.last && fn(this.last)) return this.last;
      await sleep(30);
    }
    return null;
  }
  async play(uci) {
    const n = this.last.moves.length;
    this.send({ t: 'move', uci, n });
    return this.until((s) => s.moves.length === n + 1 || s.status === 'over');
  }
}

const made = await post('/room', { side: 'w', clock: 'none' });
ok(made.status === 200 && /^[A-Z2-9]{4}$/.test(made.data.code) && made.data.side === 'w', 'a room is made with a four-letter code', JSON.stringify(made.data?.code));
const code = made.data.code;
const info = await api(`/room/${code.toLowerCase()}`);
ok(info.data?.seat === 'b' && info.data.status === 'waiting', 'the link shows the friend the free seat (codes work in lower case too)', JSON.stringify(info.data));
const joined = await post(`/room/${code}/join`, {});
ok(joined.data?.side === 'b' && joined.data.token && joined.data.token !== made.data.token, 'the friend joins with Black');
const third = await post(`/room/${code}/join`, {});
ok(third.status === 409, 'a third person finds the room full', String(third.status));
const again = await post(`/room/${code}/join`, { token: joined.data.token });
ok(again.data?.side === 'b', 'a returning player keeps their seat');
ok((await api('/room/ZZZZ')).status === 404, 'an unknown code is not found');

const A = new Player(code, made.data.token);
const B = new Player(code, joined.data.token);
await Promise.all([A.open, B.open]);
await A.until((s) => s.here.b && s.here.w);
 await B.until((s) => s.here.w);
ok(A.last?.status === 'playing' && A.last.you === 'w' && B.last?.you === 'b', 'both are seated and the game is on');

B.send({ t: 'move', uci: 'e7e5', n: 0 });
await sleep(300);
ok(A.last.moves.length === 0, 'Black cannot move out of turn');
A.send({ t: 'move', uci: 'e2e5', n: 0 });
await sleep(300);
ok(A.last.moves.length === 0, 'an illegal move is refused');
await A.play('f2f3');
await B.play('e7e5');
await A.play('g2g4');
const mate = await B.play('d8h4');
await A.until((s) => s.status === 'over');
ok(mate?.status === 'over' && mate.result.winner === 'b' && mate.result.reason === 'mate' && A.last.result?.reason === 'mate', 'fool’s mate ends the game for both', JSON.stringify(mate?.result));
ok(A.last.sans.join(' ') === 'f3 e5 g4 Qh4#', 'the moves come with their notation', A.last.sans.join(' '));

A.send({ t: 'rematch' });
await B.until((s) => s.rematch.w);
B.send({ t: 'rematch' });
const r2 = await A.until((s) => s.round === 2);
ok(r2?.status === 'playing' && r2.you === 'b' && (await B.until((s) => s.round === 2))?.you === 'w', 'a rematch swaps the colours');

B.send({ t: 'draw' });
await A.until((s) => s.drawOffer === 'w');
A.send({ t: 'decline' });
ok((await B.until((s) => s.drawOffer === null)) !== null, 'a draw offer can be declined');
B.send({ t: 'draw' });
await A.until((s) => s.drawOffer === 'w');
A.send({ t: 'draw' });
const drawn = await B.until((s) => s.status === 'over');
ok(drawn?.result.winner === null && drawn.result.reason === 'agreed', 'an offer taken is a draw');

A.send({ t: 'rematch' });
B.send({ t: 'rematch' });
await A.until((s) => s.round === 3);
B.send({ t: 'resign' });
const res = await A.until((s) => s.round === 3 && s.status === 'over');
ok(res?.result.winner === 'w' && res.result.reason === 'resign', 'resigning gives the other the game', JSON.stringify(res?.result));

// walking away: the one left behind may take the game once the other has been gone a while (3 s in test mode)
A.send({ t: 'rematch' });
B.send({ t: 'rematch' });
await A.until((s) => s.round === 4);
B.ws.close();
const them = A.last.you === 'w' ? 'b' : 'w';
await A.until((s) => s.here[them] === false);
A.send({ t: 'claim' });
await sleep(400);
ok(A.last.status === 'playing', 'the win cannot be claimed at once', JSON.stringify({ st: A.last.status, r: A.last.result, gone: A.last.gone, here: A.last.here, round: A.last.round }));
await sleep(3200);
A.send({ t: 'claim' });
const claimed = await A.until((s) => s.status === 'over');
ok(claimed?.result.reason === 'abandon' && claimed.result.winner === A.last.you, 'after the wait the one who stayed wins');
// coming back
const B2 = new Player(code, joined.data.token);
await B2.open;
const back = await B2.until((s) => s.round === 4);
ok(back?.status === 'over' && back.sans.length === 0 && back.here.w, 'a player who comes back finds the game where it stands');
A.ws.close();
B2.ws.close();

// the clock: starts after Black's first move; White's flag falls (6 s test clock) with nobody moving
const fast = await post('/room', { side: 'w', clock: '0.1+0' });
const fj = await post(`/room/${fast.data.code}/join`, {});
const W = new Player(fast.data.code, fast.data.token);
const K = new Player(fast.data.code, fj.data.token);
await Promise.all([W.open, K.open]);
await W.until((s) => s.status === 'playing');
await sleep(800);
await W.play('e2e4');
ok(W.last.clock.running === null && W.last.clock.w === 6000, 'the clocks wait for the first moves', JSON.stringify(W.last.clock));
await K.play('e7e5');
ok(W.last.clock.running === 'w', 'after Black’s first move White’s clock runs');
const flag = await K.until((s) => s.status === 'over', 9000);
ok(flag?.result.reason === 'time' && flag.result.winner === 'b' && flag.clock.w === 0, 'the flag falls on the server by itself', JSON.stringify(flag?.result));
W.ws.close();
K.ws.close();
ok((await post('/room', { side: 'w', clock: '1+0' })).status === 400, 'an unknown clock is refused');

// ------------------------------------------------------------------ the sync vault
{
  const id = createHash('sha256').update('test-' + Date.now()).digest('hex').slice(0, 40);
  ok((await api(`/sync/${id}`)).status === 404, 'an unused sync code has no vault');
  const w1 = await api(`/sync/${id}`, { method: 'PUT', body: JSON.stringify({ base: 0, blob: 'one' }) });
  ok(w1.data?.rev === 1, 'the first write is revision 1');
  const stale = await api(`/sync/${id}`, { method: 'PUT', body: JSON.stringify({ base: 0, blob: 'two' }) });
  ok(stale.status === 409 && stale.data.rev === 1 && stale.data.blob === 'one', 'a write from an old revision is refused with the newer copy');
  const w2 = await api(`/sync/${id}`, { method: 'PUT', body: JSON.stringify({ base: 1, blob: 'two' }) });
  const read = await api(`/sync/${id}`);
  ok(w2.data?.rev === 2 && read.data.blob === 'two', 'a write on the latest revision goes through');
  ok((await api('/sync/not-a-hash')).status === 404, 'only a hash names a vault');
  await api(`/sync/${id}`, { method: 'DELETE' });
  ok((await api(`/sync/${id}`)).status === 404, 'turning sync off empties the vault');
}

// ------------------------------------------------------------------ the daily reminder
{
  const received = [];
  const service = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      received.push({ url: req.url, headers: req.headers, body: Buffer.concat(chunks) });
      res.statusCode = req.url.startsWith('/gone') ? 410 : 201;
      res.end();
    });
  });
  await new Promise((r) => service.listen(0, '127.0.0.1', r));
  const port = service.address().port;

  // the browser's side of a subscription
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const auth = randomBytes(16);
  const sub = (path) => ({ endpoint: `http://127.0.0.1:${port}${path}`, keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } });
  const tz = 'Europe/Tirane';
  const local = (d) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
  };
  const now = local(new Date());
  const yesterday = local(new Date(Date.now() - 86400000)).date;

  const key = await api('/push/key');
  ok(/^[A-Za-z0-9_-]{87}$/.test(key.data?.key), 'the server hands out its public VAPID key');
  ok((await post('/push/subscribe', { sub: { ...sub('/x'), endpoint: 'https://evil.example/x' }, hour: now.hour, tz })).status === 400, 'a subscription to an unknown host is refused');
  const s1 = await post('/push/subscribe', { sub: sub('/me'), hour: now.hour, tz, done: yesterday, streak: 3 });
  await post('/push/subscribe', { sub: sub('/gone'), hour: now.hour, tz, done: '', streak: 0 });
  await post('/push/subscribe', { sub: sub('/later'), hour: (now.hour + 5) % 24, tz });
  ok(s1.status === 200, 'a phone subscribes for this hour');

  const ring = async () => {
    const n = received.length;
    await fetch(`${base}/__scheduled?cron=0+*+*+*+*`);
    const t0 = Date.now();
    while (Date.now() - t0 < 4000 && received.length === n) await sleep(50);
    await sleep(400);
    return received.slice(n);
  };
  const first = await ring();
  ok(first.length === 2 && first.every((r) => r.url !== '/later'), 'the hourly ring reaches the phones whose hour it is', first.map((r) => r.url).join(' '));
  const msg = first.find((r) => r.url === '/me');

  // the signature: ES256 over header.claims with the server's key, for this push service's origin
  const [, t, k] = msg.headers.authorization.match(/^vapid t=([^,]+), k=(.+)$/) ?? [];
  const [h, c, sig] = t.split('.');
  const pub = Buffer.from(k, 'base64url');
  const jwk = { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33, 65).toString('base64url') };
  const verified = createVerify('SHA256').update(`${h}.${c}`).verify({ key: createPublicKey({ key: jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
  const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
  ok(verified && claims.aud === `http://127.0.0.1:${port}` && claims.sub.startsWith('https://') && k === key.data.key, 'the VAPID signature checks out', JSON.stringify(claims));

  // the body, opened the way the browser opens it (RFC 8291)
  const b = msg.body;
  const salt = b.subarray(0, 16);
  const idlen = b[20];
  const asPublic = b.subarray(21, 21 + idlen);
  const sealed = b.subarray(21 + idlen);
  const shared = ua.computeSecret(asPublic);
  const ikm = Buffer.from(hkdfSync('sha256', shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic]), 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(sealed.subarray(sealed.length - 16));
  const plain = Buffer.concat([d.update(sealed.subarray(0, sealed.length - 16)), d.final()]);
  const note = JSON.parse(plain.subarray(0, plain.lastIndexOf(2)).toString());
  ok(msg.headers['content-encoding'] === 'aes128gcm' && note.body.includes('serinë prej 3 ditësh') && note.url === '/ushtrime/?tema=dita', 'the message decrypts and names the streak', note.body);

  const second = await ring();
  ok(second.length === 0, 'one reminder a day: the next ring in the same hour sends nothing', String(second.length));
  // a phone gone from its push service (410) was dropped: subscribing it again rings again, solving today silences it
  await post('/push/subscribe', { sub: sub('/me2'), hour: now.hour, tz });
  await post('/push/done', { endpoint: sub('/me2').endpoint, date: now.date, streak: 4 });
  const third = await ring();
  ok(third.length === 0, 'a phone that solved today’s puzzle is not reminded', third.map((r) => r.url).join(' '));
  await post('/push/unsubscribe', { endpoint: sub('/me').endpoint });
  await post('/push/unsubscribe', { endpoint: sub('/me2').endpoint });
  await post('/push/unsubscribe', { endpoint: sub('/later').endpoint });
  service.close();
}

const src = readFileSync(new URL('../server/wrangler.jsonc', import.meta.url), 'utf8');
ok(!/VAPID_PRIVATE/.test(src), 'the private VAPID key is not in the committed config');
console.log(failed ? `\n${failed} FAILED` : '\nthe server works');
process.exit(failed ? 1 : 0);
