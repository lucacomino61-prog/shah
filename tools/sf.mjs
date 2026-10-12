// Stockfish for Node scripts (tests, puzzle checks): the same lite build the page runs, spoken to over stdin.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(root, 'node_modules', 'stockfish', 'bin', 'stockfish-19-lite-single.js');

export function startEngine() {
  const proc = spawn(process.execPath, [BIN], { stdio: ['pipe', 'pipe', 'inherit'] });
  let buf = '';
  let listener = null;
  proc.stdout.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (listener) listener(line);
    }
  });
  const send = (s) => proc.stdin.write(s + '\n');
  const until = (pred) =>
    new Promise((resolve) => {
      listener = (l) => {
        if (pred(l)) {
          listener = null;
          resolve(l);
        }
      };
    });
  let multipv = 1;
  const ready = (async () => {
    const p = until((l) => l === 'uciok');
    send('uci');
    await p;
    const r = until((l) => l === 'readyok');
    send('setoption name Hash value 32');
    send('isready');
    await r;
  })();

  async function analyse(fen, { depth = 14, movetime, multipv: mpv = 1 } = {}) {
    await ready;
    if (mpv !== multipv) {
      send(`setoption name MultiPV value ${mpv}`);
      multipv = mpv;
    }
    const lines = new Map();
    let reached = 0;
    const done = new Promise((resolve) => {
      listener = (l) => {
        if (l.startsWith('info ') && l.includes(' pv ') && !/ (lowerbound|upperbound)/.test(l)) {
          const d = Number(/ depth (\d+)/.exec(l)?.[1] ?? 0);
          const k = Number(/ multipv (\d+)/.exec(l)?.[1] ?? 1);
          const cp = /score cp (-?\d+)/.exec(l);
          const mate = /score mate (-?\d+)/.exec(l);
          lines.set(k, { multipv: k, depth: d, cp: cp ? Number(cp[1]) : undefined, mate: mate ? Number(mate[1]) : undefined, pv: l.split(' pv ')[1].trim().split(/\s+/) });
          if (k === 1) reached = d;
        } else if (l.startsWith('bestmove')) {
          listener = null;
          const best = l.split(/\s+/)[1];
          resolve({ fen, bestmove: best && best !== '(none)' ? best : null, depth: reached, lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv) });
        }
      };
    });
    send(`position fen ${fen}`);
    send(`go depth ${depth}${movetime ? ` movetime ${movetime}` : ''}`);
    return done;
  }

  return { analyse, quit: () => (send('quit'), proc.kill()) };
}
