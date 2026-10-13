// Opening repertoires for the trainer: the learner plays one side, the app plays the other side's main replies.
// Every line is checked by tools/check-repertoires.ts: legal, one move per position for the learner, and each of
// the learner's moves close to the engine's best.

export interface RepLine {
  name: string;
  /** one sentence the learner should keep from this line */
  idea: string;
  /** SAN from the starting position */
  moves: string;
}

export interface Repertoire {
  slug: string;
  title: string;
  side: 'w' | 'b';
  lede: string;
  lines: RepLine[];
}

export const REPERTOIRES: Repertoire[] = [
  {
    slug: 'italiania',
    title: 'Me të bardhat: Hapja Italiane',
    side: 'w',
    lede: '1.e4 dhe 3.Bc4, me përgjigje për çdo mbrojtje të zakonshme.',
    lines: [
      {
        name: 'Giuoco Piano i qetë',
        idea: 'Ndërto qendrën ngadalë me c3 dhe d3, bëj rokadë, pastaj Re1: plani para sulmit.',
        moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6',
      },
      {
        name: 'Dy kuajt me Be7',
        idea: 'Kundër 3...Nf6 mbroje e4 me d3, jo me aventura; zhvillo dhe bëj rokadë.',
        moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6 c3',
      },
      {
        name: 'Dy kuajt me Bc5',
        idea: 'Kur oficeri i zi shkon në c5, c3 përgatit d4 dhe i heq atij diagonalen.',
        moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 d6 O-O O-O',
      },
      {
        name: 'Kundër Philidorit',
        idea: 'Kundër 2...d6 zër qendrën me d4: e zeza mbetet me më pak hapësirë.',
        moves: 'e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7 Be2 O-O O-O',
      },
      {
        name: 'Kundër Petrovit',
        idea: 'Pas 3.Nxe5 d6 kthe kalin; e merr ushtarin prapa me d4 dhe Bd3.',
        moves: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3',
      },
      {
        name: 'Kundër Sicilianes: Najdorf',
        idea: 'Siciliania e hapur: d4, rimerr me kal, Nc3, dhe zhvillim i qetë me Be2.',
        moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O',
      },
      {
        name: 'Kundër Sicilianes: Sveshnikov',
        idea: 'Pas 5...e5 kali shkon në b5, ku kërcënon d6 dhe c7.',
        moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6',
      },
      {
        name: 'Kundër Frëngjishtes',
        idea: 'Shtyje e5, mbaje me f4 dhe Nf3: qendra e bardhë i zë vend të zezës.',
        moves: 'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 f4 c5 Nf3 Nc6 Be3',
      },
      {
        name: 'Kundër Caro-Kann',
        idea: 'Ndiqe oficerin me Ng3 dhe h4: e zeza humbet kohë duke u mbrojtur.',
        moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3',
      },
      {
        name: 'Kundër Skandinaves',
        idea: 'Nc3 e sulmon mbretëreshën që doli herët: zhvillo duke fituar kohë.',
        moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5 Bd2',
      },
    ],
  },
  {
    slug: 'siciliania',
    title: 'Me të zezat kundër 1.e4: Siciliania',
    side: 'b',
    lede: 'Najdorf kundër Sicilianes së hapur, dhe përgjigje për sistemet anësore.',
    lines: [
      {
        name: 'Najdorf, sulmi anglez',
        idea: 'Kundër Be3 dhe f3, ...e5 dhe ...Be6 zënë fushat e lehta; rokadë dhe ...Nbd7.',
        moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7',
      },
      {
        name: 'Najdorf, 6.Be2',
        idea: 'Kundër lojës së qetë: ...e5 dhe ...Be7, rokadë, pastaj ...Be6.',
        moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O',
      },
      {
        name: 'Najdorf, 6.Bg5',
        idea: 'Kundër Bg5 dhe f4, ...e6 dhe ...Be7 mbajnë pozicionin; mbretëresha në c7.',
        moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Be7 Qf3 Qc7 O-O-O Nbd7',
      },
      {
        name: 'Najdorf, 6.Bc4',
        idea: 'Kundër oficerit në c4: ...e6 e mbyll diagonalen, ...b5 e ndjek oficerin.',
        moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bc4 e6 Bb3 b5 O-O Be7',
      },
      {
        name: 'Alapini: 2.c3',
        idea: 'Kundër 2.c3, ...Nf6 sulmon e4; kali në d5 dhe ...cxd4 thyejnë qendrën.',
        moves: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6',
      },
      {
        name: 'Siciliania e mbyllur: 2.Nc3',
        idea: 'Kur e bardha nuk luan d4, zhvillo njësoj: ...Nc6, ...g6 dhe ...Bg7.',
        moves: 'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6',
      },
      {
        name: 'Moska: 3.Bb5+',
        idea: 'Kundër shahut, ...Bd7: shkëmbe oficerët dhe zhvillo me ...Nc6 dhe ...Nf6.',
        moves: 'e4 c5 Nf3 d6 Bb5+ Bd7 Bxd7+ Qxd7 O-O Nc6 c3 Nf6',
      },
      {
        name: 'Gambiti Smith-Morra',
        idea: 'Mos e merr ushtarin e dytë: ...Nf6 dhe ...Nd5 e kthejnë lojën në Alapin.',
        moves: 'e4 c5 d4 cxd4 c3 Nf6 e5 Nd5 Qxd4 e6 Nf3 Nc6 Qe4 d6',
      },
    ],
  },
  {
    slug: 'gambiti-refuzuar',
    title: 'Me të zezat kundër 1.d4: Gambiti i refuzuar',
    side: 'b',
    lede: '1.d4 d5 dhe ...e6: qendër e fortë, zhvillim i thjeshtë, rokadë e shpejtë.',
    lines: [
      {
        name: 'Klasikja me Bg5',
        idea: 'Kundër lidhjes Bg5: ...Be7, rokadë, ...h6 dhe ...b6 për oficerin e lehtë.',
        moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6',
      },
      {
        name: 'Me Bf4',
        idea: 'Kundër Bf4, rokadë dhe ...c5: godit qendrën kur e bardha nuk ka bërë ende rokadë.',
        moves: 'd4 d5 c4 e6 Nc3 Nf6 Nf3 Be7 Bf4 O-O e3 c5',
      },
      {
        name: 'Shkëmbimi',
        idea: 'Pas cxd5 exd5 strukturë e qetë: ...Be7, rokadë, ...Nbd7 dhe ...c6.',
        moves: 'd4 d5 c4 e6 cxd5 exd5 Nc3 Nf6 Bg5 Be7 e3 O-O Bd3 Nbd7',
      },
      {
        name: 'Katalania',
        idea: 'Kundër g3, merr ushtarin në c4 kur e bardha bën rokadë dhe mbaje me kujdes.',
        moves: 'd4 d5 c4 e6 Nf3 Nf6 g3 Be7 Bg2 O-O O-O dxc4',
      },
      {
        name: 'Kundër Londrës',
        idea: 'Kundër Bf4 pa c4: ...e6, ...c5 dhe ...Nc6, pastaj ...Bd6 kundër oficerit.',
        moves: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6',
      },
      {
        name: 'Kundër 2.Nf3',
        idea: 'Pas 2.Nf3 Nf6 3.c4 e6 loja kthehet në gambitin e refuzuar.',
        moves: 'd4 d5 Nf3 Nf6 c4 e6 Nc3 Be7 Bg5 O-O',
      },
    ],
  },
];

export const repertoireOf = (slug: string) => REPERTOIRES.find((r) => r.slug === slug);
