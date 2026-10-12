// A short book of the openings a club player meets, by move sequence (no transpositions). The coach names the
// opening while the game is in it and grades a move that stays in it as theory.

export interface Opening {
  name: string;
  moves: string[];
}

const BOOK: [string, string][] = [
  ['Hapja e ushtarit të mbretit', 'e4'],
  ['Hapja e ushtarit të mbretëreshës', 'd4'],
  ['Hapja Angleze', 'c4'],
  ['Hapja Réti', 'Nf3'],
  ['Hapja Angleze, simetrike', 'c4 c5'],
  ['Hapja Angleze, Siciliane e kthyer', 'c4 e5'],

  ['Mbrojtja Siciliane', 'e4 c5'],
  ['Mbrojtja Siciliane, e hapur', 'e4 c5 Nf3 d6 d4'],
  ['Mbrojtja Siciliane, e hapur', 'e4 c5 Nf3 Nc6 d4'],
  ['Mbrojtja Siciliane, e hapur', 'e4 c5 Nf3 e6 d4'],
  ['Mbrojtja Siciliane, Najdorf', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'],
  ['Mbrojtja Siciliane, Dragoi', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6'],
  ['Mbrojtja Siciliane, Klasike', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6'],
  ['Mbrojtja Siciliane, Scheveningen', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6'],
  ['Mbrojtja Siciliane, Sveshnikov', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5'],
  ['Mbrojtja Siciliane, Taimanov', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6'],
  ['Mbrojtja Siciliane, Kan', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6'],
  ['Mbrojtja Siciliane, Rossolimo', 'e4 c5 Nf3 Nc6 Bb5'],
  ['Mbrojtja Siciliane, Moska', 'e4 c5 Nf3 d6 Bb5+'],
  ['Mbrojtja Siciliane, Alapin', 'e4 c5 c3'],
  ['Mbrojtja Siciliane, e mbyllur', 'e4 c5 Nc3'],
  ['Mbrojtja Siciliane, Gambiti Smith-Morra', 'e4 c5 d4 cxd4 c3'],

  ['Mbrojtja Franceze', 'e4 e6'],
  ['Mbrojtja Franceze, shtyrja', 'e4 e6 d4 d5 e5'],
  ['Mbrojtja Franceze, Winawer', 'e4 e6 d4 d5 Nc3 Bb4'],
  ['Mbrojtja Franceze, Tarrasch', 'e4 e6 d4 d5 Nd2'],
  ['Mbrojtja Franceze, shkëmbimi', 'e4 e6 d4 d5 exd5'],
  ['Mbrojtja Caro-Kann', 'e4 c6'],
  ['Mbrojtja Caro-Kann, shtyrja', 'e4 c6 d4 d5 e5'],
  ['Mbrojtja Caro-Kann, Klasike', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5'],
  ['Mbrojtja Skandinave', 'e4 d5'],
  ['Mbrojtja Pirc', 'e4 d6 d4 Nf6 Nc3 g6'],
  ['Mbrojtja Alekhine', 'e4 Nf6'],
  ['Mbrojtja Moderne', 'e4 g6'],

  ['Loja e hapur', 'e4 e5'],
  ['Hapja Italiane', 'e4 e5 Nf3 Nc6 Bc4'],
  ['Hapja Italiane, Giuoco Piano', 'e4 e5 Nf3 Nc6 Bc4 Bc5'],
  ['Hapja Italiane, Gambiti Evans', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4'],
  ['Mbrojtja e dy kuajve', 'e4 e5 Nf3 Nc6 Bc4 Nf6'],
  ['Mbrojtja e dy kuajve, sulmi Fried Liver', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7'],
  ['Hapja Spanjolle', 'e4 e5 Nf3 Nc6 Bb5'],
  ['Hapja Spanjolle, Morphy', 'e4 e5 Nf3 Nc6 Bb5 a6'],
  ['Hapja Spanjolle, Berlini', 'e4 e5 Nf3 Nc6 Bb5 Nf6'],
  ['Hapja Skoceze', 'e4 e5 Nf3 Nc6 d4'],
  ['Loja e katër kuajve', 'e4 e5 Nf3 Nc6 Nc3 Nf6'],
  ['Mbrojtja Petrov', 'e4 e5 Nf3 Nf6'],
  ['Mbrojtja Philidor', 'e4 e5 Nf3 d6'],
  ['Gambiti i Mbretit', 'e4 e5 f4'],
  ['Hapja Vjeneze', 'e4 e5 Nc3'],
  ['Hapja e oficerit', 'e4 e5 Bc4'],

  ['Gambiti i Mbretëreshës', 'd4 d5 c4'],
  ['Gambiti i Mbretëreshës, i refuzuar', 'd4 d5 c4 e6'],
  ['Gambiti i Mbretëreshës, i pranuar', 'd4 d5 c4 dxc4'],
  ['Mbrojtja Sllave', 'd4 d5 c4 c6'],
  ['Sistemi i Londrës', 'd4 d5 Bf4'],
  ['Sistemi i Londrës', 'd4 Nf6 Bf4'],
  ['Mbrojtja Indiane', 'd4 Nf6'],
  ['Mbrojtja Indiane e Mbretit', 'd4 Nf6 c4 g6 Nc3 Bg7'],
  ['Mbrojtja Grünfeld', 'd4 Nf6 c4 g6 Nc3 d5'],
  ['Mbrojtja Nimzo-Indiane', 'd4 Nf6 c4 e6 Nc3 Bb4'],
  ['Mbrojtja Indiane e Mbretëreshës', 'd4 Nf6 c4 e6 Nf3 b6'],
  ['Hapja Katalane', 'd4 Nf6 c4 e6 g3'],
  ['Mbrojtja Benoni', 'd4 Nf6 c4 c5 d5'],
  ['Gambiti Budapest', 'd4 Nf6 c4 e5'],
  ['Mbrojtja Holandeze', 'd4 f5'],
];

export const OPENINGS: Opening[] = BOOK.map(([name, line]) => ({ name, moves: line.split(' ') }));

const same = (a: string, b: string) => a.replace(/[+#]/g, '') === b.replace(/[+#]/g, '');

/** The deepest book line the game has followed move for move, or null once it left the book (or never entered). */
export function openingOf(history: string[]): Opening | null {
  let best: Opening | null = null;
  for (const o of OPENINGS) {
    if (o.moves.length > history.length) continue;
    if (o.moves.every((m, i) => same(m, history[i])) && (!best || o.moves.length > best.moves.length)) best = o;
  }
  return best;
}

/** Is the game still inside some book line (a prefix of one, or a whole one)? */
export function inBook(history: string[]): boolean {
  if (!history.length) return true;
  return OPENINGS.some((o) => history.length <= o.moves.length && history.every((m, i) => same(m, o.moves[i])));
}
