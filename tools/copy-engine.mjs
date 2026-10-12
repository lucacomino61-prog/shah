// Copies the Stockfish lite single-threaded build (GPL-3.0) into public/engine, with its licence beside it.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'stockfish');
const to = join(root, 'public', 'engine');
mkdirSync(to, { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) copyFileSync(join(from, 'bin', f), join(to, f));
copyFileSync(join(from, 'Copying.txt'), join(to, 'COPYING.txt'));
console.log('engine copied to public/engine');
