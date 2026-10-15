// The lessons: short segments for a player who knows the rules. A step shows a position and explains it; a step
// with a task waits for the learner's move. Practice steps take real Lichess puzzles of the lesson's theme.
// Every authored position and answer is checked by tools/check-lessons.ts against the engine.

import puzzles from './lesson-puzzles.json' with { type: 'json' };

export interface Task {
  /** the learner's move first, then the opponent's answer, then the learner again... (UCI) */
  moves: string[];
  /** other first moves that are also right */
  also?: string[];
  /** said when the task is done */
  done: string;
}

export interface Step {
  title: string;
  text: string;
  fen: string;
  /** the opponent's move played in front of the learner before the task */
  setup?: string;
  arrows?: { from: string; to: string }[];
  focus?: string[];
  task?: Task;
  /** where the board is seen from; the side to move after the setup by default */
  side?: 'w' | 'b';
  /** play it out against the engine at full strength until mate, or until a pawn becomes a queen */
  playout?: 'mate' | 'promote';
}

export interface Lesson {
  slug: string;
  title: string;
  lede: string;
  steps: Step[];
}

interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  theme: string;
}

/** The n-th easiest puzzle of a theme, as a practice step. */
function practice(theme: string, n: number, title: string, text: string): Step {
  const list = (puzzles as Puzzle[]).filter((p) => p.theme === theme).sort((a, b) => a.rating - b.rating);
  const p = list[Math.min(n, list.length - 1)];
  return {
    title,
    text: `${text} (Ushtrim nga Lichess, vlerësimi ${p.rating}.)`,
    fen: p.fen,
    setup: p.moves[0],
    task: { moves: p.moves.slice(1), done: 'Saktë.' },
  };
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const LESSONS: Lesson[] = [
  {
    slug: 'vlera-e-figurave',
    title: 'Vlera e figurave',
    lede: 'Sa vlen secila figurë, dhe si ta dish nëse një shkëmbim të leverdis.',
    steps: [
      {
        title: 'Numrat që duhet t’i dish',
        text: 'Ushtari vlen 1. Kali dhe oficeri vlejnë 3. Torra vlen 5. Mbretëresha vlen 9. Mbreti nuk ka çmim: pa të loja mbaron. Para çdo kapjeje, mblidh: çfarë merr dhe çfarë jep.',
        fen: START,
      },
      {
        title: 'Një shkëmbim i mirë',
        text: 'Kali yt mund të marrë torrën. Ushtari i zi do ta marrë kalin pas saj, por ti jep 3 dhe merr 5. Merre torrën.',
        fen: '4k3/8/4p3/3r4/8/4N3/8/4K3 w - - 0 1',
        arrows: [{ from: 'e3', to: 'd5' }],
        task: { moves: ['e3d5', 'e6d5'], done: 'Dhe 3, more 5: fitove dy pikë.' },
      },
      {
        title: 'Një figurë falas',
        text: 'Oficeri i zi në g4 nuk e mbron askush. Merre me mbretëreshën.',
        fen: '4k3/8/8/8/6b1/8/8/3QK3 w - - 0 1',
        task: { moves: ['d1g4'], done: 'Tre pikë pa dhënë asgjë.' },
      },
      practice('hangingPiece', 0, 'Provo vetë', 'Gjej figurën që mund ta marrësh pa humbur asgjë.'),
    ],
  },
  {
    slug: 'piruni',
    title: 'Piruni',
    lede: 'Një figurë sulmon dy njëherësh, dhe kundërshtari shpëton vetëm njërën.',
    steps: [
      {
        title: 'Piruni i kalit',
        text: 'Kali është mjeshtri i pirunit: sulmon në tetë drejtime dhe nuk e ndalon dot askush në rrugë. Gjej fushën ku kali sulmon mbretin dhe torrën njëherësh.',
        fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1',
        focus: ['e8', 'a8'],
        task: { moves: ['b5c7', 'e8e7', 'c7a8'], done: 'Mbreti duhej të ikte, dhe torra ra.' },
      },
      {
        title: 'Piruni i ushtarit',
        text: 'Edhe ushtari bën pirun. Shtyje përpara që të sulmojë kalin dhe oficerin njëherësh.',
        fen: '4k3/8/2n1b3/8/3P4/8/8/4K3 w - - 0 1',
        task: { moves: ['d4d5', 'c6e5', 'd5e6'], done: 'Ushtari vlen 1 dhe fitoi një oficer.' },
      },
      practice('fork', 0, 'Provo vetë', 'Kërko figurën që sulmon dy njëherësh.'),
      practice('fork', 2, 'Edhe një', 'Pirunët shpesh fillojnë me shah.'),
    ],
  },
  {
    slug: 'lidhja',
    title: 'Lidhja',
    lede: 'Një figurë që nuk lëviz dot, sepse pas saj qëndron diçka më e vlefshme.',
    steps: [
      {
        title: 'Kali i lidhur',
        text: 'Oficeri yt në b5 sulmon kalin në c6, dhe pas kalit qëndron mbreti. Kali nuk lëviz dot: do ta linte mbretin në shah. Kjo është lidhja.',
        fen: '4k3/1p6/2n5/1B6/3P4/8/8/4K3 w - - 0 1',
        arrows: [{ from: 'b5', to: 'e8' }],
      },
      {
        title: 'Sulmoje figurën e lidhur',
        text: 'Figura e lidhur është shënjestër. Sulmoje me ushtarin: kali nuk ka ku të ikë.',
        fen: '4k3/1p6/2n5/1B6/3P4/8/8/4K3 w - - 0 1',
        task: { moves: ['d4d5'], done: 'Kali i lidhur do të bjerë në lëvizjen tjetër.' },
      },
      practice('pin', 0, 'Provo vetë', 'Gjej lidhjen ose përfito prej saj.'),
    ],
  },
  {
    slug: 'helli',
    title: 'Helli',
    lede: 'Si lidhja, por e kundërta: figura më e vlefshme qëndron përpara, largohet, dhe merret ajo pas saj.',
    steps: [
      {
        title: 'Helli me torrë',
        text: 'Mbreti i zi dhe mbretëresha qëndrojnë në të njëjtën kolonë. Jepi shah mbretit me torrë: ai duhet të largohet, dhe mbretëresha pas tij mbetet pa mbrojtje.',
        fen: '4q3/8/8/4k3/8/8/8/R5K1 w - - 0 1',
        arrows: [{ from: 'a1', to: 'e1' }],
        task: { moves: ['a1e1', 'e5d4', 'e1e8'], done: 'Mbreti iku, dhe mbretëresha ra. Ky është helli.' },
      },
      practice('skewer', 0, 'Provo vetë', 'Kërko shahun që zbulon figurën e vlefshme pas mbretit.'),
      practice('skewer', 2, 'Edhe një', 'Helli punon në vija të drejta: kolona, rreshta dhe diagonale.'),
    ],
  },
  {
    slug: 'sulmi-i-zbuluar',
    title: 'Sulmi i zbuluar',
    lede: 'Një figurë largohet dhe zbulon sulmin e një tjetre pas saj: dy kërcënime me një lëvizje.',
    steps: [
      {
        title: 'Shahu i zbuluar',
        text: 'Torra jote në e1 sulmon mbretin, por oficeri yt në e2 i qëndron përpara. Lëviz oficerin: torra jep shah, dhe oficeri merr mbretëreshën në të njëjtën lëvizje.',
        fen: '4k3/8/q7/8/8/8/4B3/4R1K1 w - - 0 1',
        arrows: [{ from: 'e1', to: 'e8' }],
        focus: ['e2'],
        task: { moves: ['e2a6'], done: 'Shah nga torra, dhe mbretëresha ra: dy kërcënime me një lëvizje.' },
      },
      practice('discoveredAttack', 0, 'Provo vetë', 'Lëviz figurën që qëndron përpara, dhe zbulo sulmin pas saj.'),
      practice('discoveredAttack', 3, 'Edhe një', 'Kur figura që lëviz sulmon edhe vetë diçka, kundërshtari nuk shpëton dot nga të dyja.'),
    ],
  },
  {
    slug: 'mat-ne-rreshtin-e-fundit',
    title: 'Mat në rreshtin e fundit',
    lede: 'Mbreti pas tre ushtarëve të vet është i sigurt, derisa një torrë hyn në rreshtin e fundit.',
    steps: [
      {
        title: 'Burgu i mbretit',
        text: 'Mbreti i zi në g8 ka para vetes tre ushtarët e tij. Nuk ka asnjë fushë për të ikur. Çoje torrën në rreshtin e fundit.',
        fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
        task: { moves: ['a1a8'], done: 'Shah mat: mbreti u mbyll nga ushtarët e vet.' },
      },
      {
        title: 'Si mbrohesh: një dritare',
        text: 'Një ushtar i shtyrë para mbretit (h3 ose g3) i hap mbretit një fushë për të ikur. Lojtarët e mirë e bëjnë këtë kur torrat e kundërshtarit afrohen.',
        fen: '6k1/5ppp/8/8/8/7P/5PP1/R5K1 w - - 0 1',
        focus: ['h2'],
      },
      practice('backRankMate', 0, 'Provo vetë', 'Gjej matin në rreshtin e fundit.'),
    ],
  },
  {
    slug: 'parimet-e-hapjes',
    title: 'Parimet e hapjes',
    lede: 'Tri rregulla për dhjetë lëvizjet e para: zër qendrën, zhvillo figurat, fshihe mbretin.',
    steps: [
      {
        title: 'Zër qendrën',
        text: 'Fushat në mes të tabelës kontrollojnë gjithçka. Fillo me një ushtar në qendër: e4 ose d4.',
        fen: START,
        focus: ['d4', 'e4', 'd5', 'e5'],
        task: { moves: ['e2e4'], also: ['d2d4'], done: 'Ushtari zë qendrën dhe hap rrugën për oficerin dhe mbretëreshën.' },
      },
      {
        title: 'Zhvillo figurat',
        text: 'Nxirr kuajt dhe oficerët para mbretëreshës. Kali shkon drejt qendrës, jo në buzë.',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        task: { moves: ['g1f3'], also: ['b1c3', 'f1c4'], done: 'Një figurë më shumë në lojë.' },
      },
      {
        title: 'Bëj rokadë',
        text: 'Me rokadë mbreti shkon në cep, pas ushtarëve, dhe torra vjen drejt qendrës. Bëje tani.',
        fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        task: { moves: ['e1g1'], done: 'Mbreti është i sigurt dhe torra është gati për lojë.' },
      },
      {
        title: 'Mbretëresha herët humbet kohë',
        text: 'Pas 2.Qh5 kundërshtari mbrohet dhe e sulmon mbretëreshën me figura që zhvillohen. Çdo herë që mbretëresha ikën, ti humbet një lëvizje.',
        fen: 'r1bqkb1r/pppp1p1p/2n2np1/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 2 5',
        arrows: [{ from: 'f6', to: 'e4' }],
      },
    ],
  },
  {
    slug: 'mbrojtja-siciliane',
    title: 'Mbrojtja Siciliane',
    lede: 'Përgjigjja më e luajtur ndaj 1.e4: e zeza lufton për qendrën nga anash.',
    steps: [
      {
        title: '1.e4 c5',
        text: 'E zeza nuk e kopjon të bardhën me e5. Ushtari c lufton për fushën d4 nga anash, dhe loja bëhet e pabarabartë që në lëvizjen e parë.',
        fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        arrows: [{ from: 'c5', to: 'd4' }],
      },
      {
        title: 'Siciliania e hapur',
        text: 'Pas 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e zeza zgjedh sistemin. Luaj një nga lëvizjet kryesore me të zezat.',
        fen: 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5',
        side: 'b',
        task: { moves: ['a7a6'], also: ['g7g6', 'b8c6', 'e7e6'], done: 'Teori: a6 është Najdorf, g6 Dragoi, Nc6 Klasikja, e6 Scheveningen.' },
      },
      {
        title: 'Alapini: 2.c3',
        text: 'Kush nuk do teorinë e gjatë luan 2.c3: përgatit d4 që të rimarrë me ushtar dhe të mbajë dy ushtarë në qendër.',
        fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/2P5/PP1P1PPP/RNBQKBNR b KQkq - 0 2',
        arrows: [{ from: 'd2', to: 'd4' }],
        side: 'w',
      },
    ],
  },
  {
    slug: 'mati-me-dy-torra',
    title: 'Mati me dy torra',
    lede: 'Dy torra e shtyjnë mbretin si në shkallë, rresht pas rreshti, deri në buzë.',
    steps: [
      {
        title: 'Shkallët',
        text: 'Torra në a7 mbyll rreshtin e shtatë. Mbreti nuk kthehet dot. Torra tjetër jep matin në rreshtin e tetë.',
        fen: '6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1',
        task: { moves: ['b1b8'], done: 'Mat: njëra torrë mban rreshtin, tjetra jep shah.' },
      },
      practice('mateIn1', 0, 'Provo vetë', 'Gjej matin me një lëvizje.'),
      practice('mateIn2', 0, 'Mat me dy lëvizje', 'Lëvizja e parë e detyron kundërshtarin.'),
    ],
  },
];

LESSONS.push({
  slug: 'opozita',
  title: 'Opozita',
  lede: 'Në fund të lojës, mbreti që zë opozitën kalon përpara. Kjo vendos nëse ushtari bëhet mbretëreshë.',
  steps: [
    {
      title: 'Mbretërit përballë',
      text: 'Kur dy mbretërit qëndrojnë përballë me një fushë mes tyre, ai që duhet të lëvizë duhet t’i lërë rrugë tjetrit. Ai që nuk e ka radhën “ka opozitën”. Këtu radha është e të zezave: mbreti yt ka opozitën.',
      fen: '8/8/3k4/8/3K4/8/3P4/8 b - - 0 1',
      focus: ['d4', 'd6'],
      side: 'w',
    },
    {
      title: 'Zëre opozitën',
      text: 'Ti e ke radhën. Çoje mbretin dy rreshta para ushtarit, përballë mbretit të zi, që radha të jetë e tij.',
      fen: '8/8/3k4/8/8/3K4/3P4/8 w - - 0 1',
      task: { moves: ['d3d4'], also: ['d3c4', 'd3e4'], done: 'Mbreti yt qëndron para ushtarit: tani mbreti i zi duhet t’i lërë rrugë.' },
    },
    {
      title: 'Luaje deri në fund',
      text: 'Tani luaje kundër motorit. Mbaje mbretin përpara ushtarit, zëre opozitën sa herë mundesh, dhe bëje ushtarin mbretëreshë.',
      fen: '8/8/3k4/8/8/3K4/3P4/8 w - - 0 1',
      playout: 'promote',
    },
  ],
});

LESSONS.push({
  slug: 'fundloja',
  title: 'Fundloja kundër motorit',
  lede: 'Mbaroje vetë: mat me mbretëreshë, mat me torre, ushtari deri në fund. Motori mbrohet me gjithë forcën.',
  steps: [
    {
      title: 'Mbretëresha dhe mbreti',
      text: 'Me mbretëreshën ngushtoje mbretin kundërshtar drejt buzës, pastaj sill mbretin tënd afër dhe jep mat. Kujdes nga pati: lëre gjithmonë mbretin të ketë një lëvizje derisa jep mat.',
      fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
      playout: 'mate',
    },
    {
      title: 'Torra dhe mbreti',
      text: 'Torra pret një rresht ose një kolonë; mbreti yt i zë mbretit kundërshtar fushat përballë. Hap pas hapi, shtyje në buzë dhe jep mat.',
      fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
      playout: 'mate',
    },
    {
      title: 'Ushtari deri në fund',
      text: 'Mbreti yt para ushtarit dhe opozita fitojnë: çoje ushtarin deri në rreshtin e fundit pa e lënë mbretin kundërshtar ta ndalë.',
      fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
      playout: 'promote',
    },
  ],
});

export const lessonOf = (slug: string) => LESSONS.find((l) => l.slug === slug);

/** The lessons as a course: chapters in the order a learner meets them (the path on Mësime, the next lesson on the
 *  home screen). A lesson missing from every chapter still shows, at the end of the last one. */
export interface Chapter {
  n: string;
  title: string;
  note: string;
  lessons: Lesson[];
}
const chapter = (n: string, title: string, note: string, slugs: string[]): Chapter => ({ n, title, note, lessons: slugs.map((s) => lessonOf(s)!).filter(Boolean) });
export const COURSE: Chapter[] = [
  chapter('I', 'Bazat', 'Sa vlen secila figurë, dhe si nis një lojë e mirë.', ['vlera-e-figurave', 'parimet-e-hapjes']),
  chapter('II', 'Taktikat', 'Goditjet e shkurtra që fitojnë material.', ['piruni', 'lidhja', 'helli', 'sulmi-i-zbuluar']),
  chapter('III', 'Mati', 'Dy mënyrat e para për ta mbaruar lojën.', ['mat-ne-rreshtin-e-fundit', 'mati-me-dy-torra']),
  chapter('IV', 'Fundloja', 'Kur kanë mbetur pak figura: mbreti lufton.', ['opozita', 'fundloja']),
  chapter('V', 'Hapjet', 'Një hapje e vërtetë nga fillimi.', ['mbrojtja-siciliane']),
];
{
  const placed = new Set(COURSE.flatMap((c) => c.lessons.map((l) => l.slug)));
  COURSE[COURSE.length - 1].lessons.push(...LESSONS.filter((l) => !placed.has(l.slug)));
}
/** Every lesson in course order. */
export const COURSE_ORDER: Lesson[] = COURSE.flatMap((c) => c.lessons);
/** The first lesson not yet done, in course order (the first one again when all are done). */
export const nextLesson = (done: string[]) => COURSE_ORDER.find((l) => !done.includes(l.slug)) ?? COURSE_ORDER[0];
/** Where a lesson's diagram comes from: its first position that is not the starting one. */
export const lessonFen = (l: Lesson) => (l.steps.find((s) => !s.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')) ?? l.steps[0]).fen;
