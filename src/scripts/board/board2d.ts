// The flat board: SVG squares and the side-profile pieces from the sprite (lib/chess/silhouette.ts). Same
// contract as the marble board; it moves pieces with CSS transitions and draws the commentator's arrows as
// strokes that run from the tail.

import { FILES, planMoves, readFen, type Arrow, type BoardOptions, type BoardView, type Kind, type Marks, type Placed, type Side, type Sq } from './types.ts';

const NS = 'http://www.w3.org/2000/svg';
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

interface Pc {
  side: Side;
  kind: Kind;
  sq: Sq;
  g: SVGGElement;
  use: SVGUseElement;
}

export function createBoard2d(o: BoardOptions): BoardView {
  let orientation: Side = o.orientation;
  let motionOn = o.motion();
  let interactive = true;

  const svg = el('svg', { viewBox: '-44 -44 888 888', class: 'board-svg', 'aria-hidden': 'true' });
  // a phone: the squares run edge to edge, the frame's sides fall outside the picture and the rank numbers move onto
  // the left-hand squares, as chess.com sets them
  const phone = window.matchMedia('(max-width: 1023px)');
  const squaresG = el('g');
  const coordsG = el('g', { class: 'board-coords' });
  const marksG = el('g');
  const dotsG = el('g');
  const piecesG = el('g');
  const arrowsG = el('g', { class: 'board-arrows' });
  svg.append(squaresG, marksG, coordsG, dotsG, piecesG, arrowsG);
  o.host.prepend(svg);

  const xy = (s: Sq) => {
    const f = FILES.indexOf(s[0]);
    const r = Number(s[1]) - 1;
    return orientation === 'w' ? { x: f * 100, y: (7 - r) * 100 } : { x: (7 - f) * 100, y: r * 100 };
  };

  function drawSquares() {
    const compact = phone.matches;
    svg.setAttribute('viewBox', compact ? '0 -44 800 888' : '-44 -44 888 888');
    squaresG.replaceChildren();
    coordsG.replaceChildren();
    // the frame: mahogany, a boxwood line let in round the squares
    squaresG.append(
      el('rect', { x: -44, y: -44, width: 888, height: 888, class: 'frame-wood' }),
      el('rect', { x: -15, y: -15, width: 830, height: 830, class: 'frame-string' }),
    );
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const s = FILES[f] + (r + 1);
        const { x, y } = xy(s);
        const light = (f + r) % 2 === 1;
        squaresG.append(el('rect', { x, y, width: 100, height: 100, class: light ? 'sq-l' : 'sq-d' }));
      }
    }
    // file letters under the squares and rank numbers beside them, inlaid in the frame
    for (let i = 0; i < 8; i++) {
      const t = el('text', { x: i * 100 + 50, y: 834, 'text-anchor': 'middle' });
      t.textContent = orientation === 'w' ? FILES[i] : FILES[7 - i];
      coordsG.append(t);
      // the left-hand column's far square is light in either orientation, so the colours alternate from light
      const n = compact
        ? el('text', { x: 7, y: i * 100 + 25, 'text-anchor': 'start', class: i % 2 === 0 ? 'on-l' : 'on-d' })
        : el('text', { x: -30, y: i * 100 + 58, 'text-anchor': 'middle' });
      n.textContent = String(orientation === 'w' ? 8 - i : i + 1);
      coordsG.append(n);
    }
  }
  drawSquares();
  phone.addEventListener('change', drawSquares);

  const pieces = new Map<Sq, Pc>();
  let current = new Map<Sq, Placed>();
  let chosen: Sq | null = null;
  let marks: Marks = {};
  let cursor: Sq | null = null;
  let busyUntil = 0;

  function moveTo(p: Pc, s: Sq, animate: boolean) {
    const { x, y } = xy(s);
    p.g.style.transition = animate && motionOn ? '' : 'none';
    p.g.style.transform = `translate(${x}px, ${y}px)`;
    if (!animate || !motionOn) void p.g.getBoundingClientRect();
    p.sq = s;
  }

  function makePiece(side: Side, kind: Kind, s: Sq): Pc {
    const g = el('g', { class: 'pc' });
    const use = el('use', { href: `#pc-${side}-${kind}`, width: 100, height: 100 });
    g.append(use);
    piecesG.append(g);
    const p: Pc = { side, kind, sq: s, g, use };
    moveTo(p, s, false);
    return p;
  }

  function setKind(p: Pc, kind: Kind) {
    p.kind = kind;
    p.use.setAttribute('href', `#pc-${p.side}-${kind}`);
  }

  function setPosition(fen: string, animate = true) {
    const next = readFen(fen);
    const plan = planMoves(current, next);
    current = next;
    choose(null);
    const go = animate && motionOn;
    const travelling = plan.travel.map((t) => ({ t, p: pieces.get(t.from)! })).filter((x) => x.p);
    const taken = plan.taken.map((s) => pieces.get(s)!).filter(Boolean);
    for (const { t } of travelling) pieces.delete(t.from);
    for (const s of plan.taken) pieces.delete(s);
    for (const { t, p } of travelling) {
      pieces.set(t.to, p);
      p.g.classList.remove('is-held');
      moveTo(p, t.to, go);
      if (t.becomes) {
        const kind = t.becomes;
        if (go) setTimeout(() => setKind(p, kind), 200);
        else setKind(p, kind);
      }
    }
    for (const s of plan.stay) {
      const p = pieces.get(s);
      if (p?.g.classList.contains('is-held')) {
        p.g.classList.remove('is-held');
        moveTo(p, s, go);
      }
    }
    for (const p of taken) {
      if (go) {
        p.g.classList.add('is-taken');
        setTimeout(() => p.g.remove(), 260);
      } else p.g.remove();
    }
    for (const a of plan.arrive) {
      const p = makePiece(a.side, a.kind, a.to);
      pieces.set(a.to, p);
      if (go) {
        p.g.classList.add('is-arriving');
        requestAnimationFrame(() => p.g.classList.remove('is-arriving'));
      }
    }
    if (go) busyUntil = performance.now() + 280;
    piecesG.append(...[...pieces.values()].map((p) => p.g));
  }

  // ------------------------------------------------ marks
  function drawMarks() {
    marksG.replaceChildren();
    if (marks.last) for (const s of marks.last) {
      const { x, y } = xy(s);
      marksG.append(el('rect', { x, y, width: 100, height: 100, class: 'mk-last' }));
    }
    if (marks.check) {
      const { x, y } = xy(marks.check);
      marksG.append(el('circle', { cx: x + 50, cy: y + 50, r: 50, class: 'mk-check' }));
    }
    for (const s of marks.focus ?? []) {
      const { x, y } = xy(s);
      marksG.append(el('rect', { x: x + 5, y: y + 5, width: 90, height: 90, class: 'mk-focus' }));
    }
    for (const s of marks.danger ?? []) {
      const { x, y } = xy(s);
      marksG.append(el('rect', { x, y, width: 100, height: 100, class: 'mk-danger-wash' }), el('circle', { cx: x + 50, cy: y + 50, r: 43, class: 'mk-danger' }));
    }
    if (cursor) {
      const { x, y } = xy(cursor);
      marksG.append(el('rect', { x: x + 4, y: y + 4, width: 92, height: 92, class: 'mk-cursor' }));
    }
    drawArrows(marks.arrows ?? []);
  }

  let arrowKey = '';
  function drawArrows(list: Arrow[]) {
    const key = list.map((a) => `${a.from}${a.to}${a.label ?? ''}${a.tone ?? ''}`).join('|') + orientation;
    if (key === arrowKey) return;
    arrowKey = key;
    arrowsG.replaceChildren();
    list.forEach((a, i) => {
      const A = xy(a.from);
      const B = xy(a.to);
      const ax = A.x + 50;
      const ay = A.y + 50;
      const bx = B.x + 50;
      const by = B.y + 50;
      const df = Math.abs(bx - ax) / 100;
      const dr = Math.abs(by - ay) / 100;
      const knight = (df === 1 && dr === 2) || (df === 2 && dr === 1);
      const pts: [number, number][] = knight ? [[ax, ay], dr === 2 ? [ax, by] : [bx, ay], [bx, by]] : [[ax, ay], [bx, by]];
      // start just off the centre, stop where the head begins
      const [p0, p1] = pts;
      const d0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      pts[0] = [p0[0] + ((p1[0] - p0[0]) / d0) * 18, p0[1] + ((p1[1] - p0[1]) / d0) * 18];
      const n = pts.length;
      const q0 = pts[n - 2];
      const q1 = pts[n - 1];
      const dl = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]);
      const ux = (q1[0] - q0[0]) / dl;
      const uy = (q1[1] - q0[1]) / dl;
      const tip: [number, number] = [q1[0] + ux * 10, q1[1] + uy * 10];
      const neck: [number, number] = [tip[0] - ux * 38, tip[1] - uy * 38];
      pts[n - 1] = neck;
      const g = el('g', { class: `ar${a.tone === 'quiet' ? ' ar-quiet' : ''}` });
      const shaft = el('path', { d: 'M' + pts.map((p) => p.join(' ')).join('L'), class: 'ar-shaft' });
      const head = el('path', {
        d: `M${neck[0] + uy * 24} ${neck[1] - ux * 24}L${tip[0]} ${tip[1]}L${neck[0] - uy * 24} ${neck[1] + ux * 24}Z`,
        class: 'ar-head',
      });
      g.append(shaft, head);
      if (a.label) {
        const c = el('circle', { cx: pts[0][0], cy: pts[0][1], r: 19, class: 'ar-badge' });
        const t = el('text', { x: pts[0][0], y: pts[0][1] + 7, 'text-anchor': 'middle', class: 'ar-num' });
        t.textContent = a.label;
        g.append(c, t);
      }
      arrowsG.append(g);
      if (motionOn) {
        const len = shaft.getTotalLength();
        shaft.style.strokeDasharray = `${len}`;
        const delay = i * 110;
        shaft.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 260, delay, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' });
        head.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: delay + 200, fill: 'backwards' });
      }
    });
  }

  function showDots() {
    dotsG.replaceChildren();
    if (!chosen) return;
    const { x, y } = xy(chosen);
    dotsG.append(el('rect', { x, y, width: 100, height: 100, class: 'mk-chosen' }));
    for (const s of o.dests(chosen)) {
      const p = xy(s);
      dotsG.append(current.has(s) ? el('circle', { cx: p.x + 50, cy: p.y + 50, r: 44, class: 'mk-take' }) : el('circle', { cx: p.x + 50, cy: p.y + 50, r: 13, class: 'mk-dot' }));
    }
  }

  function choose(s: Sq | null) {
    chosen = s;
    showDots();
  }

  const movable = (s: Sq | null) => !!s && interactive && current.has(s) && o.dests(s).length > 0;
  const reaches = (s: Sq | null) => !!chosen && !!s && o.dests(chosen).includes(s);

  function press(s: Sq) {
    if (!interactive) return;
    if (o.onSquare?.(s)) return;
    if (chosen && reaches(s)) {
      const from = chosen;
      choose(null);
      o.onMove(from, s);
      return;
    }
    if (movable(s)) {
      choose(chosen === s ? null : s);
      return;
    }
    choose(null);
  }

  // ------------------------------------------------ pointer: tap, or drag
  const toBoard = (cx: number, cy: number) => {
    const pt = svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : pt;
  };
  const squareAt = (cx: number, cy: number): Sq | null => {
    const p = toBoard(cx, cy);
    if (p.x < 0 || p.y < 0 || p.x >= 800 || p.y >= 800) return null;
    const c = Math.floor(p.x / 100);
    const r = Math.floor(p.y / 100);
    return orientation === 'w' ? FILES[c] + (8 - r) : FILES[7 - c] + (r + 1);
  };

  let drag: { id: number; from: Sq; x: number; y: number; moved: boolean; was: Sq | null } | null = null;
  function onDown(e: PointerEvent) {
    if (e.button !== 0 || !interactive || (e.target as Element).closest('[data-board-ui]')) return;
    const s = squareAt(e.clientX, e.clientY);
    if (!s) return;
    if (o.onSquare?.(s)) {
      e.preventDefault();
      return;
    }
    if (chosen && reaches(s)) {
      e.preventDefault();
      press(s);
      return;
    }
    if (!movable(s)) {
      choose(null);
      return;
    }
    e.preventDefault();
    drag = { id: e.pointerId, from: s, x: e.clientX, y: e.clientY, moved: false, was: chosen };
    choose(s);
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* best effort */
    }
  }
  function onMoveP(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const p = pieces.get(drag.from);
    if (!p) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) {
      drag.moved = true;
      p.g.classList.add('is-held');
      p.g.style.transition = 'none';
    }
    if (drag.moved) {
      const b = toBoard(e.clientX, e.clientY);
      p.g.style.transform = `translate(${b.x - 50}px, ${b.y - 62}px) scale(1.08)`;
    }
  }
  function onUp(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    const p = pieces.get(d.from);
    if (!d.moved) {
      if (d.was === d.from) choose(null);
      return;
    }
    const s = squareAt(e.clientX, e.clientY);
    if (s && s !== d.from && reaches(s)) {
      choose(null);
      o.onMove(d.from, s);
      return;
    }
    if (p) {
      p.g.classList.remove('is-held');
      moveTo(p, d.from, true);
    }
    choose(null);
  }
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMoveP);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);

  const plate = document.createElement('p');
  plate.className = 'board-plate';
  plate.setAttribute('data-board-ui', '');
  plate.hidden = true;
  o.host.append(plate);

  return {
    kind: '2d',
    setPosition,
    setOrientation(side) {
      if (side === orientation) return;
      orientation = side;
      drawSquares();
      for (const p of pieces.values()) moveTo(p, p.sq, false);
      arrowKey = '';
      drawMarks();
      showDots();
    },
    setMarks(m) {
      marks = m;
      drawMarks();
    },
    setInteractive(on) {
      interactive = on;
      if (!on) choose(null);
    },
    setPlate(text) {
      plate.hidden = !text;
      plate.textContent = text ?? '';
      o.host.toggleAttribute('data-analysis', !!text);
    },
    press,
    setCursor(s) {
      cursor = s;
      drawMarks();
    },
    get chosen() {
      return chosen;
    },
    tick() {
      /* CSS does the moving */
    },
    setMotion(on) {
      motionOn = on;
    },
    get busy() {
      return performance.now() < busyUntil;
    },
    dispose() {
      phone.removeEventListener('change', drawSquares);
      svg.remove();
      plate.remove();
    },
  };
}
