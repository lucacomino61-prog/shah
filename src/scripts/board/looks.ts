// The table's worlds and the sets of pieces, chosen in Progresi > Pamja or from the board's own button (Luca,
// 2026-10-14, after looking at Chess Ultra and Pure Chess: "do all with theme switcher"). A world is a real room (a
// Poly Haven photograph that lights the board and shows blurred behind it), the wood of the table, the lamp and what
// stands on the table; a set is what the pieces are made of. The shapes are the same Staunton in every set.

export type WorldId = 'library' | 'day' | 'fire' | 'night';
export type PieceSetId = 'wood' | 'lacquer' | 'glass' | 'metal';
export type TableWood = 'cherry' | 'oak' | 'smoked' | 'mahogany';
export type PropId = 'clock' | 'cup' | 'books' | 'lamp' | 'mug' | 'notebook' | 'tumbler' | 'deskLamp' | 'phone' | 'candle';

export interface WorldDef {
  id: WorldId;
  /** its name in the picker */
  name: string;
  /** one line under the name */
  note: string;
  /** the room photograph's turn round the table, and how it shows: blur, brightness behind, strength in reflections */
  turn: number;
  blur: number;
  backdrop: number;
  reflect: number;
  table: { wood: TableWood; tint: number; rough: number; coat: number; coatRough: number; bump: number; unit: number };
  /** the lamp over the board: its colour and strength, where it hangs (from White's side), how wide its pool is */
  lamp: { color: number; power: number; at: [number, number, number]; cone: number };
  /** the soft fill from the room and the camera's exposure */
  fill: number;
  exposure: number;
  /** the glass of the menus over a bright room is the light glass */
  tone: 'dark' | 'light';
  /** what stands on the table, across from the player: [prop, x, z, turn] */
  props: [PropId, number, number, number][];
  /** the swatch in the picker: the room's two main colours */
  swatch: [string, string];
}

export const WORLDS: Record<WorldId, WorldDef> = {
  library: {
    id: 'library',
    name: 'Biblioteka',
    note: 'Dru i errët, libra, llamba e gjelbër',
    turn: 0,
    blur: 0.16,
    backdrop: 0.62,
    reflect: 0.9,
    table: { wood: 'smoked', tint: 0x9a8270, rough: 0.55, coat: 0.65, coatRough: 0.12, bump: 0.18, unit: 7 },
    lamp: { color: 0xffe2b0, power: 3.1, at: [-11, 19, 8], cone: 0.5 },
    fill: 0.1,
    exposure: 1.02,
    tone: 'dark',
    props: [
      ['books', -3.6, -6.3, 0.35],
      ['lamp', 3.4, -6.6, -0.5],
      ['clock', 0.9, -6.4, -0.12],
    ],
    swatch: ['#3b2618', '#7d5a2f'],
  },
  day: {
    id: 'day',
    name: 'Dritë dite',
    note: 'Dhomë moderne, dritare, lis i çelët',
    turn: 2.09,
    blur: 0.14,
    backdrop: 1.0,
    reflect: 1.0,
    table: { wood: 'oak', tint: 0xf2e6d4, rough: 0.5, coat: 0.4, coatRough: 0.16, bump: 0.12, unit: 8 },
    lamp: { color: 0xfff6ea, power: 2.2, at: [-12, 18, 6], cone: 0.62 },
    fill: 0.3,
    exposure: 1.0,
    tone: 'light',
    props: [
      ['mug', -3.4, -6.1, 2.6],
      ['notebook', 3.0, -6.4, -0.25],
      ['tumbler', -1.4, -6.9, 0],
    ],
    swatch: ['#dfe6ea', '#b7a68c'],
  },
  fire: {
    id: 'fire',
    name: 'Pranë zjarrit',
    note: 'Dhomë e ngrohtë, qershi e llakuar',
    turn: 0.9,
    blur: 0.18,
    backdrop: 0.42,
    reflect: 0.85,
    table: { wood: 'cherry', tint: 0xffffff, rough: 0.6, coat: 0.7, coatRough: 0.1, bump: 0.2, unit: 7 },
    lamp: { color: 0xffd9a8, power: 3.0, at: [-12, 20, 9], cone: 0.5 },
    fill: 0.1,
    exposure: 1.0,
    tone: 'dark',
    props: [
      ['cup', -3.1, -6.2, 2.4],
      ['clock', 2.9, -6.3, -0.18],
      ['candle', -0.9, -6.9, 0],
    ],
    swatch: ['#2a1407', '#d9822b'],
  },
  night: {
    id: 'night',
    name: 'Natën',
    note: 'Tavolinë pune, llambë, dritat e qytetit',
    turn: 0,
    blur: 0.2,
    backdrop: 0.55,
    reflect: 0.7,
    table: { wood: 'mahogany', tint: 0x8d6a58, rough: 0.5, coat: 0.6, coatRough: 0.14, bump: 0.22, unit: 9 },
    lamp: { color: 0xffe0b8, power: 3.6, at: [-8, 15, -3], cone: 0.46 },
    fill: 0.06,
    exposure: 0.98,
    tone: 'dark',
    props: [
      ['deskLamp', -4.4, -5.6, 0.7],
      ['mug', 3.4, -6.0, 1.2],
      ['phone', 1.0, -6.6, 0.2],
      ['notebook', -1.9, -6.8, 0.15],
    ],
    swatch: ['#120c08', '#c98a3c'],
  },
};

export interface PieceSetDef {
  id: PieceSetId;
  name: string;
  note: string;
  /** the swatch in the picker: White's and Black's colour */
  swatch: [string, string];
}

export const PIECE_SETS: Record<PieceSetId, PieceSetDef> = {
  wood: { id: 'wood', name: 'Dru', note: 'Bush dhe eben, si në turne', swatch: ['#e4c99a', '#2a1d16'] },
  lacquer: { id: 'lacquer', name: 'Llak', note: 'Krem dhe e kuqe, me shkëlqim', swatch: ['#efe3c8', '#7a1414'] },
  glass: { id: 'glass', name: 'Xham', note: 'I tejdukshëm dhe rubin', swatch: ['#dfeff2', '#8c1020'] },
  metal: { id: 'metal', name: 'Metal', note: 'Argjend dhe ar', swatch: ['#d9dadd', '#c9a24a'] },
};

const WORLD_KEY = 'shah.world';
const SET_KEY = 'shah.pieces';
export const DEFAULT_WORLD: WorldId = 'library';
export const DEFAULT_SET: PieceSetId = 'wood';

export function chosenWorld(): WorldId {
  try {
    const v = localStorage.getItem(WORLD_KEY) as WorldId | null;
    if (v && v in WORLDS) return v;
  } catch {}
  return DEFAULT_WORLD;
}

export function chosenSet(): PieceSetId {
  try {
    const v = localStorage.getItem(SET_KEY) as PieceSetId | null;
    if (v && v in PIECE_SETS) return v;
  } catch {}
  return DEFAULT_SET;
}

/** Keep the choice and tell the open page (its board changes in place, its glass follows the room). */
export function choose(look: { world?: WorldId; pieces?: PieceSetId }) {
  try {
    if (look.world) localStorage.setItem(WORLD_KEY, look.world);
    if (look.pieces) localStorage.setItem(SET_KEY, look.pieces);
  } catch {}
  document.documentElement.dataset.worldTone = WORLDS[chosenWorld()].tone;
  window.dispatchEvent(new CustomEvent('shah:look', { detail: { world: chosenWorld(), pieces: chosenSet() } }));
}
