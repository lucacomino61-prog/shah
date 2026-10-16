// The puzzle themes in Albanian, each with the one sentence a learner should keep.

export interface Theme {
  id: string;
  name: string;
  task: string;
  idea: string;
}

export const THEMES: Theme[] = [
  { id: 'mateIn1', name: 'Mat me një lëvizje', task: 'Gjej matin me një lëvizje.', idea: 'Kërko lëvizjen që e lë mbretin pa asnjë fushë për të ikur dhe pa asnjë mbrojtje.' },
  { id: 'backRankMate', name: 'Mat në rreshtin e fundit', task: 'Gjej matin.', idea: 'Mbreti i mbyllur pas ushtarëve të vet nuk ka ku të ikë kur torra ose mbretëresha hyn në rreshtin e fundit.' },
  { id: 'mateIn2', name: 'Mat me dy lëvizje', task: 'Gjej matin me dy lëvizje.', idea: 'Lëvizja e parë e detyron kundërshtarin; e dyta jep mat. Fillo nga shahet.' },
  { id: 'fork', name: 'Pirun', task: 'Gjej sulmin e dyfishtë.', idea: 'Një figurë sulmon dy figura njëherësh, dhe kundërshtari shpëton vetëm njërën.' },
  { id: 'pin', name: 'Lidhja', task: 'Përfito nga figura e lidhur.', idea: 'Figura e lidhur nuk lëviz dot pa e lënë nën sulm figurën më të vlefshme pas saj.' },
  { id: 'skewer', name: 'Helli', task: 'Sulmo figurën e vlefshme përpara.', idea: 'Si lidhja, por e kundërta: figura më e vlefshme është përpara, largohet, dhe merret ajo pas saj.' },
  { id: 'discoveredAttack', name: 'Sulm i zbuluar', task: 'Hap rrugën për një sulm.', idea: 'Një figurë largohet dhe zbulon sulmin e një tjetre pas saj: dy kërcënime me një lëvizje.' },
  { id: 'hangingPiece', name: 'Figura pa mbrojtje', task: 'Fito materialin falas.', idea: 'Një figurë që askush nuk e mbron mund të merret pa humbur asgjë.' },
  { id: 'trappedPiece', name: 'Figurë e bllokuar', task: 'Kape figurën që s’ka ku të ikë.', idea: 'Një figurë pa asnjë fushë të sigurt humbet, edhe pa qenë e pambrojtur.' },
  { id: 'promotion', name: 'Promovimi', task: 'Çoje ushtarin deri në fund.', idea: 'Ushtari që arrin rreshtin e fundit bëhet mbretëreshë; shpesh vlen më shumë se çdo gjë tjetër në tabelë.' },
  // added 2026-10-16
  { id: 'deflection', name: 'Devijimi', task: 'Largoje mbrojtësin nga detyra e tij.', idea: 'Një figurë që mbron diçka mund të detyrohet të largohet, me shah, me kapje ose me një sakrificë. Pastaj ajo që mbronte bie.' },
  { id: 'attraction', name: 'Tërheqja', task: 'Tërhiqe figurën në fushën ku bie.', idea: 'Një sakrificë e detyron një figurë, shpesh mbretin, të vijë në një fushë ku pastaj sulmohet.' },
  { id: 'capturingDefender', name: 'Heqja e mbrojtësit', task: 'Hiqe figurën që mbron.', idea: 'Kap figurën që mbron një tjetër: pa mbrojtësin, figura e dytë bie.' },
  { id: 'mateIn3', name: 'Mat me tri lëvizje', task: 'Gjej matin me tri lëvizje.', idea: 'Një plan me tre hapa, ku çdo lëvizje e detyron kundërshtarin. Fillo nga shahet dhe kapjet.' },
  { id: 'pawnEndgame', name: 'Fundloja me ushtarë', task: 'Gjej rrugën e fitores.', idea: 'Me pak figura mbreti lufton: zëre opozitën dhe numëro fushat deri në rreshtin e fundit.' },
  { id: 'rookEndgame', name: 'Fundloja me torra', task: 'Gjej lëvizjen më të mirë.', idea: 'Torra punon më mirë nga larg: pas ushtarit të lirë, ose duke prerë mbretin kundërshtar.' },
];

export const themeOf = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];
