// The favicon: the boxwood king on an ink tile, drawn from the same profile as the board's pieces.
import { writeFileSync } from 'node:fs';
import { SILHOUETTES } from '../src/lib/chess/silhouette.ts';

const k = SILHOUETTES.k.shape;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#111214"/><g transform="translate(6 2) scale(0.88)"><path d="${k}" fill="#ecd9b2"/></g></svg>`;
writeFileSync('public/favicon.svg', svg);
console.log('public/favicon.svg written');
