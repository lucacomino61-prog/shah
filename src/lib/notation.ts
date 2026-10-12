// Moves on the page: figurine notation drawn with the flat piece silhouettes, so no letter belongs to a language.

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const fig = (letter: string) => `<svg class="fig" aria-hidden="true" focusable="false"><use href="#fg-${letter.toLowerCase()}"/></svg>`;

const SPOKEN: Record<string, string> = { K: 'mbreti', Q: 'mbretëresha', R: 'torra', B: 'oficeri', N: 'kali' };

/** A SAN move as figurine HTML, with a spoken label for screen readers. */
export function sanHtml(san: string): string {
  if (san === 'O-O' || san === 'O-O+' || san === 'O-O#') return `<span class="san" aria-label="rokadë e shkurtër">${esc(san)}</span>`;
  if (san.startsWith('O-O-O')) return `<span class="san" aria-label="rokadë e gjatë">${esc(san)}</span>`;
  const piece = /^[KQRBN]/.test(san) ? san[0] : '';
  const rest = piece ? san.slice(1) : san;
  const promo = /=([QRBN])/.exec(rest);
  const body = promo ? rest.replace(/=([QRBN])/, '=' + fig(promo[1])) : esc(rest);
  const label = (piece ? SPOKEN[piece] + ' ' : '') + rest.replace('x', ' merr ').replace('+', ' shah').replace('#', ' mat').replace(/=([QRBN])/, (_, p) => ' bëhet ' + SPOKEN[p]);
  return `<span class="san" aria-label="${esc(label)}">${piece ? fig(piece) : ''}${body}</span>`;
}

/** A coach sentence: plain text with [[SAN]] marks. */
export function sentenceHtml(s: string): string {
  return s
    .split(/(\[\[[^\]]+\]\])/)
    .map((part) => (part.startsWith('[[') ? sanHtml(part.slice(2, -2)) : esc(part)))
    .join('');
}

/** The same sentence read aloud: marks replaced by their spoken form. */
export function sentenceText(s: string): string {
  return s.replace(/\[\[([^\]]+)\]\]/g, (_, san: string) => {
    const piece = /^[KQRBN]/.test(san) ? SPOKEN[san[0]] + ' ' : '';
    return piece + (piece ? san.slice(1) : san).replace('x', ' merr ').replace('+', ' shah').replace('#', ' mat');
  });
}
