// What stands on the table beside the board, so it reads as a real table in a real room. Each room (looks.ts) sets its
// own: an analog chess clock in the same mahogany as the board's frame (two dials under glass, the two buttons on top,
// one pressed), an espresso on its saucer, a stack of clothbound books and a banker's lamp in the library, a mug, a
// notebook with its pencil and a glass of water in the day room, a candle by the fire, an architect's lamp and a phone
// on the night desk. Small models built here, a few thousand triangles each.

import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ConeGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  SRGBColorSpace,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface Kit {
  /** the board's wood, for the clock's case */
  wood: Material;
  env: Texture;
  /** box-projected UVs for wood on a box-like part */
  woody: <T extends BufferGeometry>(g: T) => T;
  keep: <T extends BufferGeometry>(g: T) => T;
  own: <T extends Material>(m: T) => T;
  textures: Texture[];
}

/** A clock dial: white enamel, black numerals and minute ticks, a red flag near twelve. */
function dialTexture(hours: number, minutes: number): CanvasTexture {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const r = s / 2;
  const grad = g.createRadialGradient(r, r * 0.9, r * 0.1, r, r, r);
  grad.addColorStop(0, '#fbf8f0');
  grad.addColorStop(1, '#e9e2d2');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(r, r, r, 0, Math.PI * 2);
  g.fill();
  g.translate(r, r);
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const long = i % 5 === 0;
    g.strokeStyle = '#1a1a1a';
    g.lineWidth = long ? 5 : 2;
    g.beginPath();
    g.moveTo(Math.sin(a) * r * 0.9, -Math.cos(a) * r * 0.9);
    g.lineTo(Math.sin(a) * r * (long ? 0.76 : 0.84), -Math.cos(a) * r * (long ? 0.76 : 0.84));
    g.stroke();
  }
  g.fillStyle = '#1a1a1a';
  g.font = `600 ${s * 0.11}px Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let h = 1; h <= 12; h++) {
    const a = (h / 12) * Math.PI * 2;
    g.fillText(String(h), Math.sin(a) * r * 0.62, -Math.cos(a) * r * 0.62);
  }
  // the flag the minute hand lifts as the hour runs out
  g.fillStyle = '#c0392b';
  g.beginPath();
  g.moveTo(r * 0.06, -r * 0.5);
  g.lineTo(r * 0.2, -r * 0.4);
  g.lineTo(r * 0.06, -r * 0.33);
  g.fill();
  const hand = (a: number, len: number, w: number) => {
    g.save();
    g.rotate(a);
    g.fillStyle = '#111';
    g.beginPath();
    g.moveTo(-w, r * 0.08);
    g.lineTo(0, -len);
    g.lineTo(w, r * 0.08);
    g.fill();
    g.restore();
  };
  hand(((hours % 12) / 12 + minutes / 720) * Math.PI * 2, r * 0.48, 7);
  hand((minutes / 60) * Math.PI * 2, r * 0.72, 5);
  g.beginPath();
  g.arc(0, 0, 9, 0, Math.PI * 2);
  g.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** The chess clock: about 16 cm wide in the board's units (one square is 5.8 cm), its front leaning back. */
export function chessClock(kit: Kit): Group {
  const group = new Group();
  const w = 2.8;
  // the case seen from the side: a deep foot, a front leaning back, a rounded crown
  const side = new Shape();
  side.moveTo(-0.62, 0);
  side.lineTo(0.62, 0);
  side.lineTo(0.48, 1.42);
  side.quadraticCurveTo(0.44, 1.7, 0.18, 1.72);
  side.lineTo(-0.3, 1.72);
  side.quadraticCurveTo(-0.5, 1.7, -0.52, 1.5);
  side.lineTo(-0.62, 0);
  const caseGeo = new ExtrudeGeometry(side, { depth: w, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 8 });
  // the profile's front (+x) turned to face +z, toward the player; the width runs along x
  caseGeo.rotateY(-Math.PI / 2);
  caseGeo.translate(w / 2, 0, 0);
  caseGeo.computeVertexNormals();
  const body = new Mesh(kit.keep(kit.woody(caseGeo)), kit.wood);
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  // the front face leans back by this much
  const lean = Math.atan2(0.14, 1.42);
  const brass = kit.own(new MeshPhysicalMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.28, envMap: kit.env, envMapIntensity: 1 }));
  const glass = kit.own(
    new MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMap: kit.env,
      envMapIntensity: 1.2,
      depthWrite: false,
    }),
  );
  const times: [number, number][] = [
    [11, 52],
    [11, 47],
  ];
  times.forEach(([h, m], i) => {
    const x = i === 0 ? -0.68 : 0.68;
    const dial = new Group();
    const tex = dialTexture(h, m);
    kit.textures.push(tex);
    const face = new Mesh(kit.keep(new CircleGeometry(0.5, 40)), kit.own(new MeshPhysicalMaterial({ map: tex, roughness: 0.45, envMap: kit.env, envMapIntensity: 0.4 })));
    const bezel = new Mesh(kit.keep(new TorusGeometry(0.52, 0.045, 10, 40)), brass);
    bezel.position.z = 0.012;
    const cover = new Mesh(kit.keep(new CircleGeometry(0.5, 40)), glass);
    cover.position.z = 0.04;
    dial.add(face, bezel, cover);
    // on the front face, which leans back as it rises
    dial.position.set(x, 0.86, 0.62 - 0.14 * (0.86 / 1.42) + 0.06);
    dial.rotation.x = -lean;
    dial.traverse((o) => ((o as Mesh).castShadow = false));
    group.add(dial);
    // the two buttons on top: White's pressed, Black's up
    const button = new Mesh(kit.keep(new CylinderGeometry(0.11, 0.13, i === 0 ? 0.12 : 0.26, 20)), brass);
    button.position.set(x, 1.72 + (i === 0 ? 0.06 : 0.13), -0.05);
    button.castShadow = true;
    group.add(button);
  });
  return group;
}

/** An espresso cup on its saucer, porcelain with a gold line, coffee in it. */
export function coffeeCup(kit: Kit): Group {
  const group = new Group();
  const porcelain = kit.own(
    new MeshPhysicalMaterial({ color: 0xf6f3ec, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envMap: kit.env, envMapIntensity: 0.9, side: DoubleSide }),
  );
  const gold = kit.own(new MeshPhysicalMaterial({ color: 0xd8b45a, metalness: 1, roughness: 0.2, envMap: kit.env, envMapIntensity: 1 }));
  // the cup: one lathe outline up the outside, over the rim and down the inside
  const cupPts = [
    [0.0, 0.02],
    [0.3, 0.02],
    [0.33, 0.06],
    [0.36, 0.25],
    [0.42, 0.6],
    [0.47, 0.84],
    [0.46, 0.87],
    [0.43, 0.86],
    [0.39, 0.62],
    [0.33, 0.28],
    [0.28, 0.1],
    [0.0, 0.1],
  ].map(([x, y]) => new Vector2(x, y));
  const cup = new Mesh(kit.keep(new LatheGeometry(cupPts, 48)), porcelain);
  cup.castShadow = cup.receiveShadow = true;
  const rim = new Mesh(kit.keep(new TorusGeometry(0.455, 0.012, 6, 48).rotateX(Math.PI / 2)), gold);
  rim.position.y = 0.865;
  const coffee = new Mesh(
    kit.keep(new CylinderGeometry(0.405, 0.405, 0.01, 40)),
    kit.own(new MeshPhysicalMaterial({ color: new Color(0x2a160b), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, envMap: kit.env, envMapIntensity: 0.8 })),
  );
  coffee.position.y = 0.68;
  const handle = new Mesh(kit.keep(new TorusGeometry(0.17, 0.045, 10, 24, Math.PI * 1.25)), porcelain);
  handle.position.set(0.5, 0.5, 0);
  handle.rotation.z = -Math.PI * 0.62;
  handle.castShadow = true;
  const saucerPts = [
    [0.0, 0.0],
    [0.42, 0.0],
    [0.48, 0.03],
    [0.86, 0.09],
    [0.92, 0.12],
    [0.9, 0.135],
    [0.84, 0.115],
    [0.46, 0.06],
    [0.0, 0.06],
  ].map(([x, y]) => new Vector2(x, y));
  const saucer = new Mesh(kit.keep(new LatheGeometry(saucerPts, 56)), porcelain);
  saucer.castShadow = saucer.receiveShadow = true;
  const saucerRim = new Mesh(kit.keep(new TorusGeometry(0.91, 0.01, 6, 56).rotateX(Math.PI / 2)), gold);
  saucerRim.position.y = 0.128;
  const lift = new Group();
  lift.position.y = 0.06;
  lift.add(cup, rim, coffee, handle);
  group.add(saucer, saucerRim, lift);
  return group;
}

const shadowed = (m: Mesh) => {
  m.castShadow = m.receiveShadow = true;
  return m;
};
const lathe = (pts: number[][], segments = 48) =>
  new LatheGeometry(
    pts.map(([x, y]) => new Vector2(x, y)),
    segments,
  );

/** Three clothbound books lying in a stack, each a little turned: boards in a deep colour, the pages cream between
 *  them, gilt bands across the spine. A real octavo is about 23 by 16 cm: 4 by 2.8 squares. */
export function books(kit: Kit): Group {
  const group = new Group();
  const pages = kit.own(new MeshPhysicalMaterial({ color: 0xe9dec4, roughness: 0.92, envMap: kit.env, envMapIntensity: 0.3 }));
  const gilt = kit.own(new MeshPhysicalMaterial({ color: 0xd4af5a, metalness: 1, roughness: 0.32, envMap: kit.env, envMapIntensity: 1 }));
  const specs: [number, number, number, number, number][] = [
    [4.3, 3.0, 0.62, 0x5a1a1a, 0],
    [3.9, 2.7, 0.5, 0x1d382a, 0.14],
    [3.5, 2.45, 0.42, 0x2a2238, -0.1],
  ];
  let y = 0;
  for (const [w, d, h, colour, turn] of specs) {
    const book = new Group();
    const cloth = kit.own(
      new MeshPhysicalMaterial({
        color: colour,
        roughness: 0.78,
        sheen: 0.6,
        sheenRoughness: 0.6,
        sheenColor: new Color(colour).multiplyScalar(1.8),
        envMap: kit.env,
        envMapIntensity: 0.35,
      }),
    );
    const t = 0.05;
    for (const yy of [t / 2, h - t / 2]) {
      const b = new Mesh(kit.keep(new RoundedBoxGeometry(w, t, d, 2, 0.02)), cloth);
      b.position.y = yy;
      book.add(shadowed(b));
    }
    const spine = new Mesh(kit.keep(new RoundedBoxGeometry(0.14, h, d, 2, 0.06)), cloth);
    spine.position.set(-w / 2 + 0.05, h / 2, 0);
    book.add(shadowed(spine));
    const block = new Mesh(kit.keep(new RoundedBoxGeometry(w - 0.18, h - 2 * t + 0.01, d - 0.14, 1, 0.01)), pages);
    block.position.set(0.03, h / 2, 0);
    book.add(shadowed(block));
    for (const z of [-d * 0.32, -d * 0.26, d * 0.26, d * 0.32]) {
      const band = new Mesh(kit.keep(new BoxGeometry(0.16, h * 0.8, 0.035)), gilt);
      band.position.set(-w / 2 + 0.03, h / 2, z);
      book.add(band);
    }
    book.position.y = y;
    book.rotation.y = turn;
    y += h;
    group.add(book);
  }
  return group;
}

/** A banker's lamp: a brass foot and stem, the green glass shade lying across them, its bulb glowing under it. */
export function bankersLamp(kit: Kit): Group {
  const group = new Group();
  const brass = kit.own(new MeshPhysicalMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.24, envMap: kit.env, envMapIntensity: 1 }));
  const base = new Mesh(
    kit.keep(
      lathe([
        [0, 0],
        [1.0, 0],
        [1.05, 0.05],
        [1.0, 0.15],
        [0.78, 0.22],
        [0.48, 0.28],
        [0.2, 0.32],
        [0.14, 0.4],
        [0, 0.4],
      ]),
    ),
    brass,
  );
  group.add(shadowed(base));
  const stem = new Mesh(kit.keep(new CylinderGeometry(0.075, 0.085, 3.4, 16)), brass);
  stem.position.y = 0.4 + 1.7;
  group.add(shadowed(stem));
  // the shade: half a tube of cased glass, green outside and white within, its open side down
  const green = kit.own(
    new MeshPhysicalMaterial({
      color: 0x0c4a26,
      roughness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      emissive: 0x0b3a1d,
      emissiveIntensity: 0.35,
      envMap: kit.env,
      envMapIntensity: 1.1,
      side: DoubleSide,
    }),
  );
  const shade = new Mesh(kit.keep(new CylinderGeometry(0.62, 0.62, 3.1, 40, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2)), green);
  shade.position.set(0, 3.95, 0.55);
  shade.castShadow = true;
  group.add(shade);
  for (const x of [-1.55, 1.55]) {
    const rim = new Mesh(kit.keep(new TorusGeometry(0.62, 0.025, 6, 24, Math.PI).rotateY(Math.PI / 2)), brass);
    rim.position.set(x, 3.95, 0.55);
    group.add(rim);
  }
  const arm = new Mesh(kit.keep(new CylinderGeometry(0.04, 0.04, 0.62, 10).rotateX(Math.PI / 2)), brass);
  arm.position.set(0, 3.9, 0.28);
  group.add(arm);
  const glow = kit.own(new MeshBasicMaterial({ color: new Color(2.6, 2.2, 1.5) }));
  const bulb = new Mesh(kit.keep(new SphereGeometry(0.22, 16, 12).scale(1.6, 1, 1)), glow);
  bulb.position.set(0, 3.72, 0.55);
  group.add(bulb);
  return group;
}

/** A stoneware mug of coffee. */
export function mug(kit: Kit, colour: number): Group {
  const group = new Group();
  const glaze = kit.own(
    new MeshPhysicalMaterial({ color: colour, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.12, envMap: kit.env, envMapIntensity: 0.7, side: DoubleSide }),
  );
  const body = new Mesh(
    kit.keep(
      lathe([
        [0, 0],
        [0.6, 0],
        [0.68, 0.06],
        [0.72, 0.4],
        [0.72, 1.55],
        [0.69, 1.6],
        [0.65, 1.56],
        [0.64, 0.2],
        [0, 0.16],
      ]),
    ),
    glaze,
  );
  group.add(shadowed(body));
  const handle = new Mesh(kit.keep(new TorusGeometry(0.36, 0.085, 12, 24, Math.PI * 1.15)), glaze);
  handle.position.set(0.72, 0.85, 0);
  handle.rotation.z = -Math.PI * 0.575;
  group.add(shadowed(handle));
  const coffee = new Mesh(
    kit.keep(new CylinderGeometry(0.645, 0.645, 0.01, 40)),
    kit.own(new MeshPhysicalMaterial({ color: 0x24130a, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMap: kit.env, envMapIntensity: 0.8 })),
  );
  coffee.position.y = 1.28;
  group.add(coffee);
  return group;
}

/** A closed notebook with its elastic band, a pencil lying across it. */
export function notebook(kit: Kit, cover: number): Group {
  const group = new Group();
  const board = kit.own(
    new MeshPhysicalMaterial({ color: cover, roughness: 0.62, sheen: 0.4, sheenRoughness: 0.7, sheenColor: new Color(0x555555), envMap: kit.env, envMapIntensity: 0.35 }),
  );
  const pages = kit.own(new MeshPhysicalMaterial({ color: 0xf0ead8, roughness: 0.9, envMap: kit.env, envMapIntensity: 0.3 }));
  const book = new Mesh(kit.keep(new RoundedBoxGeometry(2.6, 0.22, 3.6, 2, 0.05)), board);
  book.position.y = 0.11;
  group.add(shadowed(book));
  const edge = new Mesh(kit.keep(new BoxGeometry(2.48, 0.15, 3.52)), pages);
  edge.position.set(0.07, 0.11, 0);
  group.add(edge);
  const band = new Mesh(
    kit.keep(new BoxGeometry(0.07, 0.235, 3.62)),
    kit.own(new MeshPhysicalMaterial({ color: 0x151515, roughness: 0.5, envMap: kit.env, envMapIntensity: 0.3 })),
  );
  band.position.set(0.95, 0.11, 0);
  group.add(band);
  // the pencil: a yellow hexagon, a sharpened cedar cone and its lead, a brass ferrule and a pink eraser
  const pencil = new Group();
  const paint = kit.own(new MeshPhysicalMaterial({ color: 0xe8b21a, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.1, envMap: kit.env, envMapIntensity: 0.6 }));
  const shaft = new Mesh(kit.keep(new CylinderGeometry(0.06, 0.06, 2.6, 6)), paint);
  pencil.add(shadowed(shaft));
  const cedar = new Mesh(
    kit.keep(new ConeGeometry(0.058, 0.3, 12).translate(0, 1.45, 0)),
    kit.own(new MeshPhysicalMaterial({ color: 0xd9b48a, roughness: 0.8, envMap: kit.env, envMapIntensity: 0.3 })),
  );
  const lead = new Mesh(
    kit.keep(new ConeGeometry(0.02, 0.1, 8).translate(0, 1.6, 0)),
    kit.own(new MeshPhysicalMaterial({ color: 0x2b2b2b, roughness: 0.4, metalness: 0.4, envMap: kit.env })),
  );
  const ferrule = new Mesh(
    kit.keep(new CylinderGeometry(0.063, 0.063, 0.16, 16).translate(0, -1.38, 0)),
    kit.own(new MeshPhysicalMaterial({ color: 0xbfa25a, metalness: 1, roughness: 0.3, envMap: kit.env })),
  );
  const eraser = new Mesh(
    kit.keep(new CylinderGeometry(0.058, 0.058, 0.14, 16).translate(0, -1.52, 0)),
    kit.own(new MeshPhysicalMaterial({ color: 0xe58a8a, roughness: 0.8, envMap: kit.env, envMapIntensity: 0.3 })),
  );
  pencil.add(cedar, lead, ferrule, eraser);
  pencil.rotation.set(Math.PI / 2, 0, 0.5);
  pencil.position.set(-0.2, 0.28, 0.1);
  group.add(pencil);
  return group;
}

/** A tumbler of water: thick-bottomed glass, the water a little cooler than the glass. */
export function tumbler(kit: Kit): Group {
  const group = new Group();
  const glass = kit.own(
    new MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.02,
      transparent: true,
      opacity: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMap: kit.env,
      envMapIntensity: 1.5,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  const cup = new Mesh(
    kit.keep(
      lathe([
        [0, 0],
        [0.52, 0],
        [0.55, 0.04],
        [0.6, 1.7],
        [0.57, 1.7],
        [0.52, 0.3],
        [0, 0.28],
      ]),
    ),
    glass,
  );
  cup.renderOrder = 2;
  group.add(cup);
  const water = new Mesh(
    kit.keep(new CylinderGeometry(0.565, 0.522, 0.95, 40).translate(0, 0.28 + 0.475, 0)),
    kit.own(new MeshPhysicalMaterial({ color: 0xd5ecf0, roughness: 0.03, transparent: true, opacity: 0.3, envMap: kit.env, envMapIntensity: 1.2, depthWrite: false })),
  );
  water.renderOrder = 1;
  group.add(water);
  return group;
}

/** An architect's lamp in black: a heavy foot, two arms, the cone of the shade bent down toward the board, its bulb
 *  glowing inside. Built leaning toward +z. */
export function deskLamp(kit: Kit): Group {
  const group = new Group();
  const paint = kit.own(
    new MeshPhysicalMaterial({ color: 0x18181a, roughness: 0.42, metalness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.3, envMap: kit.env, envMapIntensity: 0.8 }),
  );
  const foot = new Mesh(
    kit.keep(
      lathe([
        [0, 0],
        [0.9, 0],
        [0.93, 0.05],
        [0.9, 0.22],
        [0.5, 0.3],
        [0.16, 0.34],
        [0, 0.34],
      ]),
    ),
    paint,
  );
  group.add(shadowed(foot));
  const rod = (len: number) => new Mesh(kit.keep(new CylinderGeometry(0.05, 0.05, len, 10).translate(0, len / 2, 0)), paint);
  // lower arm, leaning forward; upper arm reaching out over the table; the head hanging from its end
  const lower = new Group();
  lower.position.y = 0.34;
  lower.rotation.x = 0.32;
  lower.add(shadowed(rod(3.3)));
  const upper = new Group();
  upper.position.y = 3.3;
  upper.rotation.x = 1.55;
  upper.add(shadowed(rod(2.9)));
  const head = new Group();
  head.position.y = 2.9;
  head.rotation.x = 1.4;
  const shade = new Mesh(kit.keep(new ConeGeometry(0.62, 1.05, 32, 1, true).translate(0, -0.52, 0)), paint);
  shade.material = paint;
  shade.castShadow = true;
  const inside = kit.own(new MeshPhysicalMaterial({ color: 0xf2eee6, roughness: 0.6, side: DoubleSide, emissive: 0xffe2b0, emissiveIntensity: 0.6 }));
  const lining = new Mesh(kit.keep(new ConeGeometry(0.6, 1.0, 32, 1, true).translate(0, -0.52, 0)), inside);
  lining.scale.setScalar(0.985);
  const bulb = new Mesh(kit.keep(new SphereGeometry(0.2, 16, 12)), kit.own(new MeshBasicMaterial({ color: new Color(2.8, 2.4, 1.7) })));
  bulb.position.y = -0.82;
  head.add(shade, lining, bulb);
  upper.add(head);
  lower.add(upper);
  group.add(lower);
  return group;
}

/** A phone lying face up, its screen dark. */
export function phone(kit: Kit): Group {
  const group = new Group();
  const frame = new Mesh(
    kit.keep(new RoundedBoxGeometry(1.3, 0.13, 2.66, 3, 0.06)),
    kit.own(new MeshPhysicalMaterial({ color: 0x2c2d30, metalness: 0.8, roughness: 0.3, envMap: kit.env, envMapIntensity: 0.9 })),
  );
  frame.position.y = 0.065;
  group.add(shadowed(frame));
  const screen = new Mesh(
    kit.keep(new RoundedBoxGeometry(1.24, 0.01, 2.6, 2, 0.004)),
    kit.own(new MeshPhysicalMaterial({ color: 0x050607, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, envMap: kit.env, envMapIntensity: 1.1 })),
  );
  screen.position.y = 0.132;
  group.add(screen);
  return group;
}

/** A pillar candle on a brass dish, its flame lit. */
export function candle(kit: Kit): Group {
  const group = new Group();
  const brass = kit.own(new MeshPhysicalMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.26, envMap: kit.env, envMapIntensity: 1 }));
  const dish = new Mesh(
    kit.keep(
      lathe([
        [0, 0],
        [0.9, 0],
        [0.98, 0.1],
        [0.96, 0.13],
        [0.88, 0.06],
        [0, 0.06],
      ]),
    ),
    brass,
  );
  group.add(shadowed(dish));
  const wax = kit.own(
    new MeshPhysicalMaterial({
      color: 0xf1e6cf,
      roughness: 0.55,
      sheen: 0.4,
      sheenColor: new Color(0xfff2d8),
      envMap: kit.env,
      envMapIntensity: 0.4,
      emissive: 0xff9a3c,
      emissiveIntensity: 0.05,
    }),
  );
  const pillar = new Mesh(
    kit.keep(
      lathe([
        [0, 0.06],
        [0.55, 0.06],
        [0.56, 1.9],
        [0.5, 2.0],
        [0.3, 1.94],
        [0, 1.92],
      ]),
    ),
    wax,
  );
  group.add(shadowed(pillar));
  const wick = new Mesh(kit.keep(new CylinderGeometry(0.012, 0.012, 0.16, 6)), kit.own(new MeshPhysicalMaterial({ color: 0x1a120c, roughness: 0.8 })));
  wick.position.y = 2.0;
  group.add(wick);
  const flame = new Mesh(kit.keep(new SphereGeometry(0.1, 16, 12).scale(1, 2.6, 1)), kit.own(new MeshBasicMaterial({ color: new Color(3.2, 2.0, 0.7) })));
  flame.position.y = 2.28;
  group.add(flame);
  return group;
}
