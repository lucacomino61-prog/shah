// The progress page, read from this browser's storage (and drawn again when sync brings in another phone's
// progress), with the settings, the daily reminder, sync between phones and the backup file.

import { TAG_NAMES, type Tag } from '../lib/coach.ts';
import { LESSONS } from '../data/lessons.ts';
import { levelOf } from '../lib/levels.ts';
import { load, loadGame, save, saveGame, streakNow, today } from '../lib/store.ts';
import { remindAt, remindHour, remindOff, remindSupport } from '../lib/remind.ts';
import { joinSync, normalize, pretty, startSync, stopSync, syncNow, syncState, type SyncResult } from '../lib/sync.ts';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
let p = load();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// which lesson answers which mistake
const CURE: Record<Tag, { href: string; label: string }> = {
  hanging: { href: '/mesime/vlera-e-figurave/', label: 'Mësimi: Vlera e figurave' },
  'lost-material': { href: '/mesime/vlera-e-figurave/', label: 'Mësimi: Vlera e figurave' },
  'missed-capture': { href: '/ushtrime/', label: 'Ushtrime: Figura pa mbrojtje' },
  'allowed-fork': { href: '/mesime/piruni/', label: 'Mësimi: Piruni' },
  'missed-fork': { href: '/mesime/piruni/', label: 'Mësimi: Piruni' },
  'allowed-mate': { href: '/mesime/mat-ne-rreshtin-e-fundit/', label: 'Mësimi: Mat në rreshtin e fundit' },
  'missed-mate': { href: '/mesime/mati-me-dy-torra/', label: 'Mësimi: Mati me dy torra' },
  'early-queen': { href: '/mesime/parimet-e-hapjes/', label: 'Mësimi: Parimet e hapjes' },
  'same-piece': { href: '/mesime/parimet-e-hapjes/', label: 'Mësimi: Parimet e hapjes' },
  'rim-knight': { href: '/mesime/parimet-e-hapjes/', label: 'Mësimi: Parimet e hapjes' },
  'f-pawn': { href: '/mesime/parimet-e-hapjes/', label: 'Mësimi: Parimet e hapjes' },
};

function render() {
  p = load();
  const wins = p.games.filter((g) => g.result === 'win').length;
  const draws = p.games.filter((g) => g.result === 'draw').length;
  const losses = p.games.length - wins - draws;
  const acc = p.games.filter((g) => g.accuracy !== null);
  const avg = acc.length ? Math.round(acc.reduce((s, g) => s + (g.accuracy ?? 0), 0) / acc.length) : null;
  const rows: [string, string][] = [
    ['Lojëra', p.games.length ? `${p.games.length} (${wins} fitore, ${draws} ${draws === 1 ? 'barazim' : 'barazime'}, ${losses} humbje)` : '0'],
    ['Saktësia mesatare', avg === null ? 'Ende pa lojëra' : `${avg}%`],
    [p.puzzlesTried ? 'Vlerësimi në ushtrime' : 'Vlerësimi fillestar në ushtrime', String(p.puzzleRating)],
    ['Ushtrime të zgjidhura pa ndihmë', `${p.puzzlesSolved} nga ${p.puzzlesTried}`],
    ['Mësime të kryera', `${p.lessons.length} nga ${LESSONS.length}`],
    ['Ushtrimi i ditës', streakNow(p) ? `${streakNow(p)} ditë rresht` : 'Seria nuk ka filluar'],
    ['Rekordi në garë', p.rushBest ? `${p.rushBest} pikë` : 'Ende pa garë'],
  ];
  $('[data-summary]').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

  const tags = (Object.entries(p.tags) as [Tag, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  $('[data-mistakes]').innerHTML = tags.length
    ? tags
        .map(([t, n]) => `<li><b>${TAG_NAMES[t]}</b><span class="n">${n}</span><a href="${CURE[t].href}">${CURE[t].label}</a></li>`)
        .join('')
    : `<li class="empty">Ende asnjë gabim i numëruar. Pas lojës së parë, trajneri do t’i mbledhë këtu. <a href="/luaj/">Luaj një lojë</a></li>`;

  const fmt = new Intl.DateTimeFormat('sq-AL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const RES = { win: 'Fitore', loss: 'Humbje', draw: 'Barazim', resigned: 'Dorëzim' } as const;
  $('[data-games]').innerHTML = p.games.length
    ? [...p.games]
        .reverse()
        .slice(0, 12)
        .map((g) => {
          let when = g.date.slice(0, 10);
          try {
            when = fmt.format(new Date(g.date));
          } catch {
            /* keep the ISO date */
          }
          const lv = levelOf(g.level);
          return `<li><span>${esc(when)}, ${g.side === 'w' ? 'të bardhat' : 'të zezat'}, niveli ${lv.n}</span><span class="res" data-r="${g.result}">${RES[g.result]}</span><span class="meta">${g.moves} lëvizje${g.accuracy !== null ? `, saktësia ${g.accuracy}%` : ''}${g.blunders ? `, ${g.blunders} gabime të rënda` : ''}${g.opening ? `, ${esc(g.opening)}` : ''}</span></li>`;
        })
        .join('')
    : `<li class="empty">Ende asnjë lojë e mbaruar. <a href="/luaj/">Luaj të parën</a></li>`;
}
render();
window.addEventListener('shah:synced', render);

// clearing everything takes two presses
const reset = $<HTMLButtonElement>('[data-reset]');
let armed: ReturnType<typeof setTimeout> | null = null;
reset.addEventListener('click', () => {
  const label = reset.querySelector('[data-label]')!;
  if (!armed) {
    label.textContent = 'Shtyp përsëri për ta fshirë';
    armed = setTimeout(() => {
      label.textContent = 'Fshi progresin';
      armed = null;
    }, 4000);
    return;
  }
  clearTimeout(armed);
  armed = null;
  // with sync on, the wipe reaches the other phones too: the copy wiped last wins
  save({ ...load(), games: [], puzzleRating: 900, puzzlesSolved: 0, puzzlesTried: 0, seen: [], tags: {}, lessons: [], resetAt: new Date().toISOString() });
  saveGame(null);
  location.reload();
});

// the glass, clear to tinted, the way iOS 27 lets people set it; the page head applies the stored level before paint
const glass = $<HTMLInputElement>('[data-glass]');
const GLASS_KEY = 'shah.glass';
const glassWords = (v: number) => (v < 0.34 ? 'I qartë' : v > 0.66 ? 'I ngjyrosur' : 'Mesatar');
const showGlass = (v: number) => {
  glass.style.setProperty('--pct', `${v * 100}%`);
  glass.setAttribute('aria-valuetext', glassWords(v));
};
try {
  const stored = parseFloat(localStorage.getItem(GLASS_KEY) ?? '');
  if (stored >= 0 && stored <= 1) glass.value = String(stored);
} catch {}
showGlass(Number(glass.value));
glass.addEventListener('input', () => {
  const v = Number(glass.value);
  document.documentElement.style.setProperty('--glass-level', String(v));
  showGlass(v);
  try {
    localStorage.setItem(GLASS_KEY, String(v));
  } catch {}
});

// the game's switches: sounds and vibration, and the red rings on pieces in danger
const switchFor = (sel: string, key: 'sound' | 'threats') => {
  const box = $<HTMLInputElement>(sel);
  box.checked = load()[key];
  box.addEventListener('change', () => save({ ...load(), [key]: box.checked }));
};
switchFor('[data-sound]', 'sound');
switchFor('[data-threats-pref]', 'threats');

// a backup of everything this browser keeps: a file to carry to another phone or to keep safe
const note = $('[data-backup-note]');
$('[data-export]').addEventListener('click', async () => {
  const data = { app: 'shah', version: 1, saved: new Date().toISOString(), progress: load(), game: loadGame() };
  const name = `shah-progresi-${today()}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  // a phone offers its share sheet (Files, a chat, AirDrop); elsewhere the file downloads
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Shah: progresi' });
      note.textContent = 'Kopja u ruajt.';
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  note.textContent = `Kopja u ruajt si ${name}.`;
});

const fileInput = $<HTMLInputElement>('[data-import-file]');
$('[data-import]').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const f = fileInput.files?.[0];
  fileInput.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data?.app !== 'shah' || typeof data.progress?.puzzleRating !== 'number') throw new Error('not a Shah backup');
    if (!confirm('Kjo kopje zëvendëson progresin që ke në këtë shfletues. Vazhdo?')) return;
    save({ ...load(), ...data.progress });
    saveGame(data.game ?? null);
    location.reload();
  } catch {
    note.textContent = 'Ky skedar nuk është një kopje e Shah.';
  }
});

// ------------------------------------------------------------------ the daily reminder

const remindBox = document.querySelector<HTMLElement>('[data-remind-box]');
if (remindBox) {
  const box = $<HTMLInputElement>('[data-remind]');
  const hourRow = $('[data-remind-hour-row]');
  const hourPick = $<HTMLSelectElement>('[data-remind-hour]');
  const note = $('[data-remind-note]');
  const plain = note.textContent ?? '';
  const support = remindSupport();
  const show = () => {
    const h = remindHour();
    box.checked = h !== null;
    hourRow.hidden = h === null;
    if (h !== null) hourPick.value = String(h);
  };
  show();
  if (support === 'install') {
    box.disabled = true;
    note.textContent = 'Në iPhone, kujtesa punon vetëm kur Shah hapet nga ekrani kryesor: prek Shpërndaj (katrori me shigjetë), pastaj «Shto në ekranin bazë» (Add to Home Screen). Hape prej andej dhe ndize këtu.';
  } else if (support === 'no') {
    box.disabled = true;
    note.textContent = 'Ky shfletues nuk i lejon njoftimet.';
  }
  const turnOn = async (hour: number) => {
    box.disabled = true;
    note.textContent = 'Po ndizet…';
    const r = await remindAt(hour);
    box.disabled = false;
    note.textContent =
      r === 'ok'
        ? `Kujtesa vjen çdo ditë në ${String(hour).padStart(2, '0')}:00, vetëm nëse ushtrimi i ditës është ende pa zgjidhur.`
        : r === 'denied'
          ? 'Njoftimet janë të bllokuara për Shah. Lejoji te cilësimet e shfletuesit, pastaj provo përsëri.'
          : 'Kujtesa nuk u ndez. Provo përsëri kur të kesh internet.';
    show();
  };
  box.addEventListener('change', async () => {
    if (box.checked) return turnOn(Number(hourPick.value) || 19);
    await remindOff();
    note.textContent = plain;
    show();
  });
  hourPick.addEventListener('change', () => turnOn(Number(hourPick.value)));
}

// ------------------------------------------------------------------ sync between phones

const syncBox = document.querySelector<HTMLElement>('[data-sync]');
if (syncBox) {
  const off = $('[data-sync-off]');
  const on = $('[data-sync-on]');
  const form = $<HTMLFormElement>('[data-sync-join]');
  const field = form.querySelector<HTMLInputElement>('input[name="code"]')!;
  const openJoin = $<HTMLButtonElement>('[data-sync-join-open]');
  const note = $('[data-sync-note]');
  const lede = $('[data-lede]');
  const plain = note.textContent ?? '';
  const two = (n: number) => String(n).padStart(2, '0');
  const when = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const time = `${two(d.getHours())}:${two(d.getMinutes())}`;
    return today(d) === today() ? `sot ${time}` : `${d.getDate()}.${d.getMonth() + 1} ${time}`;
  };
  const failed: Record<string, string> = {
    offline: 'Pa internet. Sinkronizimi vazhdon vetë kur të lidhesh.',
    server: 'Serveri nuk u përgjigj. Provo përsëri pak më vonë.',
    missing: 'Ky kod nuk u gjet. Kontrolloje te telefoni tjetër: 16 shkronja dhe shifra.',
    wiped: 'Kopja në server u fshi nga një telefon tjetër, ndaj sinkronizimi u fik edhe këtu. Progresi këtu mbetet.',
    key: 'Kopja në server nuk u hap me këtë kod.',
    off: '',
  };
  const show = (message?: string) => {
    const st = syncState();
    off.hidden = !!st;
    on.hidden = !st;
    if (st) form.hidden = true;
    openJoin.setAttribute('aria-expanded', String(!form.hidden));
    lede.textContent = st ? 'Ruhet në këtë shfletues dhe, e koduar, te telefonat e tu që kanë kodin.' : 'Gjithçka ruhet vetëm në këtë shfletues. Askush tjetër nuk e sheh.';
    if (st) {
      $('[data-sync-code]').textContent = pretty(st.code);
      $('[data-sync-when]').textContent = when(st.at);
    }
    note.textContent = message ?? (st ? 'Fut këtë kod te Progresi në telefonin tjetër, ose dërgoja vetes. Mbaje si fjalëkalim: kush e ka, e sheh progresin tënd.' : plain);
  };
  const tell = (r: SyncResult, good: string) => show(r.ok ? good : failed[r.reason] || undefined);
  show();
  window.addEventListener('shah:synced', () => show());
  window.addEventListener('shah:sync-wiped', () => show(failed.wiped));

  $('[data-sync-start]').addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    b.disabled = true;
    note.textContent = 'Po ndizet…';
    const { result } = await startSync();
    b.disabled = false;
    tell(result, 'Sinkronizimi u ndez. Tani fut kodin në telefonin tjetër.');
  });
  openJoin.addEventListener('click', () => {
    form.hidden = !form.hidden;
    openJoin.setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden) field.focus();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    btn.disabled = true;
    note.textContent = 'Po lidhet…';
    const r = await joinSync(field.value);
    btn.disabled = false;
    if (r.ok) {
      field.value = '';
      render();
    }
    tell(r, 'U lidh. Progresi i dy telefonave tani është një.');
  });
  // a shared link carries the code after the #, which never reaches a server
  const fromLink = /^#sync=([A-Za-z0-9-]+)$/.exec(location.hash);
  if (fromLink) {
    history.replaceState(null, '', location.pathname);
    if (!syncState()) {
      form.hidden = false;
      field.value = pretty(normalize(fromLink[1]));
      show('Kodi erdhi nga lidhja. Shtyp Lidhu për ta bashkuar këtë telefon.');
    }
  }
  $('[data-sync-share]').addEventListener('click', async () => {
    const st = syncState();
    if (!st) return;
    const url = `${location.origin}/progresi/#sync=${st.code}`;
    const text = `Kodi i sinkronizimit për Shah: ${pretty(st.code)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Shah', text, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      show('Kodi dhe lidhja u kopjuan.');
    } catch {
      show('Kopjoje kodin me dorë: ' + pretty(st.code));
    }
  });
  $('[data-sync-now]').addEventListener('click', async () => {
    note.textContent = 'Po sinkronizohet…';
    const r = await syncNow();
    if (r.ok && r.changed) render();
    if (!r.ok && r.reason === 'missing') return show(failed.wiped);
    tell(r, r.ok && r.changed ? 'U sinkronizua: erdhi progresi i telefonit tjetër.' : 'U sinkronizua.');
  });
  $('[data-sync-stop]').addEventListener('click', async () => {
    await stopSync(false);
    show('Sinkronizimi u fik në këtë telefon. Progresi mbetet këtu; kodi punon ende te telefonat e tjerë.');
  });
  const wipe = $<HTMLButtonElement>('[data-sync-wipe]');
  let wipeArmed: ReturnType<typeof setTimeout> | null = null;
  wipe.addEventListener('click', async () => {
    const label = wipe.querySelector('[data-label]')!;
    if (!wipeArmed) {
      label.textContent = 'Shtyp përsëri për ta fshirë';
      wipeArmed = setTimeout(() => {
        label.textContent = 'Fshi kopjen nga serveri';
        wipeArmed = null;
      }, 4000);
      return;
    }
    clearTimeout(wipeArmed);
    wipeArmed = null;
    label.textContent = 'Fshi kopjen nga serveri';
    const done = await stopSync(true);
    show(done ? 'Kopja në server u fshi dhe sinkronizimi u fik në të gjithë telefonat. Progresi në secilin telefon mbetet.' : failed.offline);
  });
}
