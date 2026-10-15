// The people across the table (Luca, 2026-10-15: "bots with faces + chat"). Each level in levels.ts is a character;
// this file gives each one a face (an oil portrait of an invented person, public/bots/, see docs/ASSETS.md) and a
// few short things they say at the moments a person would speak: hello, a thought while thinking, pouncing on a
// loose piece, noticing their own slip, when the game turns, and at the end. They speak rarely (play.ts decides
// when), so a line is a small human touch and never noise over the coach.
//
// The lines never use an adjective about the learner: Albanian adjectives agree in gender, and the app does not
// know who is playing.

export type Moment = 'hello' | 'think' | 'pounce' | 'oops' | 'ahead' | 'behind' | 'won' | 'lost' | 'draw' | 'resign';

export interface Persona {
  /** the portrait's file stem in public/bots/ */
  face: string;
  /** one line under the name on the player card */
  tagline: string;
  say: Record<Moment, string[]>;
}

/** By level id (levels.ts), the id the progress keeps. */
const PERSONAS: Record<number, Persona> = {
  7: {
    face: 'lea',
    tagline: 'Sapo mësoi si lëvizin figurat.',
    say: {
      hello: ['Përshëndetje! Sapo mësova si lëvizin figurat.', 'Luajmë? Jam ende e re në këtë.'],
      think: ['Hmm… nga lëviz kali?', 'Prit, po mendoj.', 'Kjo shkon drejt, apo jo?'],
      pounce: ['Oh! Mund ta marr këtë?', 'Uau, faleminderit!'],
      oops: ['Oj, nuk e pashë!', 'Hmm, ma more…'],
      ahead: ['Sot po më shkon mirë!'],
      behind: ['Luan shumë mirë…'],
      won: ['Fitova! Luajmë përsëri?'],
      lost: ['Bravo! Më mësove diçka.'],
      draw: ['Barazim! Nuk ishte keq.'],
      resign: ['Dorëzohem. Bravo!'],
    },
  },
  8: {
    face: 'ermali',
    tagline: 'Merr gjithçka që i lë pa mbrojtje.',
    say: {
      hello: ['Hajde, të shohim çfarë di!', 'Gati? Unë marr çdo gjë që lë.'],
      think: ['Diçka po ma kap syri…', 'Hmm, çfarë mund të marr?'],
      pounce: ['Ha! E mora!', 'Falas? Faleminderit!'],
      oops: ['Ëh, këtë nuk e pashë.', 'Mirë, mirë, ma ktheve.'],
      ahead: ['Sot është dita ime.'],
      behind: ['Prit, si ndodhi kjo?'],
      won: ['Fitova! Revansh?'],
      lost: ['Mirë, kësaj radhe fitove ti.'],
      draw: ['Barazim. Herën tjetër fitoj unë.'],
      resign: ['Mirë, dorëzohem.'],
    },
  },
  9: {
    face: 'arta',
    tagline: 'Mbron figurat dhe ndëshkon çdo harresë.',
    say: {
      hello: ['Mirë se erdhe. Kujdes figurat pa mbrojtje.', 'Fillojmë? Unë i kontrolloj të gjitha.'],
      think: ['Një moment, po kontrolloj.', 'Çfarë kërcënon ti këtu?'],
      pounce: ['Kjo figurë mbeti pa mbrojtje.', 'Këtë e pashë.'],
      oops: ['Ah, këtë duhej ta shihja.'],
      ahead: ['Po shkon sipas planit.'],
      behind: ['Po luan mirë sot.'],
      won: ['Lojë e mirë. Shiko gabimet me trajnerin.'],
      lost: ['Bravo, e meritove.'],
      draw: ['Barazim i drejtë.'],
      resign: ['Dorëzohem. Bravo.'],
    },
  },
  1: {
    face: 'agimi',
    tagline: 'Di parimet; ngatërrohet kur loja ndërlikohet.',
    say: {
      hello: ['Fillojmë me qendrën, si gjithmonë.', 'Mirë se erdhe. Gati për lojë?'],
      think: ['Zhvilloj figurat, pastaj shohim.', 'Hmm, pozicion interesant.'],
      pounce: ['Këtë nuk e lë pa e marrë.'],
      oops: ['Uh, u ngatërrova pak këtu.'],
      ahead: ['Parimet po funksionojnë.'],
      behind: ['Më zure në befasi.'],
      won: ['Lojë e mirë! Edhe një?'],
      lost: ['Bravo! Më tregove rrugën.'],
      draw: ['Barazim. E meritonim të dy.'],
      resign: ['Dorëzohem. Lojë e mirë.'],
    },
  },
  2: {
    face: 'drita',
    tagline: 'Luan me kujdes, por gabon qartë.',
    say: {
      hello: ['Ngadalë dhe me kujdes. Fillojmë?'],
      think: ['Le ta shoh edhe një herë.', 'Pa nxitim.'],
      pounce: ['Faleminderit, e marr me kënaqësi.'],
      oops: ['Hm, kjo ishte e nxituar nga unë.'],
      ahead: ['Durimi po shpërblehet.'],
      behind: ['Po luan shumë saktë.'],
      won: ['Lojë e mirë. Me durim do fitosh.'],
      lost: ['Të lumtë! Fitore e merituar.'],
      draw: ['Barazim. Lojë e qetë.'],
      resign: ['Dorëzohem. Të lumtë.'],
    },
  },
  3: {
    face: 'besniku',
    tagline: 'I rregullti i klubit. Rrallë fal diçka.',
    say: {
      hello: ['Ulu, ulu. Prisja një kundërshtar.', 'Hajde, një lojë e shpejtë.'],
      think: ['Kjo më kujton një lojë të vjetër…', 'Hmm, hmm.'],
      pounce: ['Këtë nuk ta fal dot.'],
      oops: ['Plaku po fle pak sot.'],
      ahead: ['Përvoja flet.'],
      behind: ['Po më vë në vështirësi.'],
      won: ['Lojë e mirë. Eja prapë nesër.'],
      lost: ['Të lumtë! Rrallë më mundin kështu.'],
      draw: ['Barazim. Shtrëngojmë duart.'],
      resign: ['E di kur duhet dorëzuar. Bravo.'],
    },
  },
  4: {
    face: 'teuta',
    tagline: 'Zgjedh pothuajse gjithmonë më të mirën.',
    say: {
      hello: ['Mos prit dhurata.', 'Fillojmë.'],
      think: ['Po llogaris.', 'Interesante.'],
      pounce: ['Gabim.', 'Kjo të kushton.'],
      oops: ['Hm. Pasaktësi e imja.'],
      ahead: ['Pozicioni flet vetë.'],
      behind: ['Mirë. Shumë mirë.'],
      won: ['Lojë e mirë. Rishiko momentin kyç.'],
      lost: ['Respekt. E fitove ndershëm.'],
      draw: ['Barazim i drejtë.'],
      resign: ['Dorëzohem. Luajte shkëlqyeshëm.'],
    },
  },
  5: {
    face: 'ardiani',
    tagline: 'Mjeshtri i vjetër i klubit.',
    say: {
      hello: ['Çdo lojë është një mësim. Fillojmë.'],
      think: ['Shahu kërkon durim.', 'Le të shohim…'],
      pounce: ['Shiko përsëri fushën që lëshove.'],
      oops: ['Edhe mjeshtrit gabojnë.'],
      ahead: ['Qetësia fiton.'],
      behind: ['Shumë bukur. Vazhdo kështu.'],
      won: ['Faleminderit për lojën. Mëso nga ajo.'],
      lost: ['E fitove me mjeshtëri.'],
      draw: ['Barazim. Lojë fisnike.'],
      resign: ['Dorëzohem. Fitore e bukur.'],
    },
  },
  6: {
    face: 'stockfish',
    tagline: 'Motori, me gjithë forcën që ka në shfletues.',
    say: {
      hello: ['Gati.'],
      think: ['Po llogaris…'],
      pounce: ['Vlerësimi ndryshoi.'],
      oops: ['Po rillogaris.'],
      ahead: ['Avantazh i qartë.'],
      behind: ['Pozicion i vështirë.'],
      won: ['Mat. Loja mbaroi.'],
      lost: ['Rezultat i pazakontë. Bravo.'],
      draw: ['Barazim.'],
      resign: ['Dorëzohem.'],
    },
  },
};

export const persona = (id: number): Persona => PERSONAS[id] ?? PERSONAS[8];

/** The portrait: 'face' is the square head (192 px), 320 and 560 the 4:5 painting. */
export const portrait = (id: number, size: 'face' | 320 | 560 = 'face') => `/bots/${persona(id).face}-${size}.webp`;

/** Something this person says at this moment, never the same line twice in a row. */
const lastSaid = new Map<string, string>();
export function line(id: number, moment: Moment, rnd = Math.random): string {
  const all = persona(id).say[moment];
  const key = `${id}:${moment}`;
  const fresh = all.length > 1 ? all.filter((l) => l !== lastSaid.get(key)) : all;
  const out = fresh[Math.floor(rnd() * fresh.length)];
  lastSaid.set(key, out);
  return out;
}
