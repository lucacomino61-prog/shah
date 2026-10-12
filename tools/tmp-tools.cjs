const fs = require('fs');
const edit = (p, pairs) => {
  let s = fs.readFileSync(p, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) {
      console.log('MISSING in', p, ':', a.slice(0, 80));
      process.exit(1);
    }
    s = s.split(a).join(b);
  }
  fs.writeFileSync(p, s);
};

const tool = (attrs, iconName, label, extra = '') =>
  `        <button type="button" class="tool" ${attrs}><span class="tool__icon"><Fragment set:html={icon('${iconName}')} /></span><span class="tool__label" data-label>${label}</span>${extra}</button>`;
const motion = `        <button type="button" class="tool tool--motion" data-motion-switch aria-pressed="false"><span class="tool__icon" data-when="on"><Fragment set:html={icon('pause')} /></span><span class="tool__icon" data-when="off"><Fragment set:html={icon('play')} /></span><span class="tool__label">Ndal lëvizjet</span></button>`;
const wrap = (items) => `    <div class="tools" data-board-ui>
      <button type="button" class="tool tool--menu" data-tools-toggle aria-expanded="false" aria-controls="tools-list" aria-label="Mjetet"><Fragment set:html={icon('dotsThreeVertical')} /></button>
      <div class="tools__list" id="tools-list">
${items.join('\n')}
      </div>
    </div>`;

edit('src/pages/luaj.astro', [
  [
    `    <div class="tools" data-board-ui>
      <button type="button" class="tool tool--motion" data-motion-switch aria-pressed="false" aria-label="Ndal lëvizjet"><span data-when="on"><Fragment set:html={icon('pause')} /></span><span data-when="off"><Fragment set:html={icon('play')} /></span></button>
      <button type="button" class="tool" data-new aria-label="Lojë e re"><Fragment set:html={icon('plus')} /></button>
      <button type="button" class="tool" data-undo aria-label="Kthe lëvizjen"><Fragment set:html={icon('arrowCounterClockwise')} /></button>
      <button type="button" class="tool" data-flip aria-label="Rrotullo tabelën"><Fragment set:html={icon('arrowsDownUp')} /></button>
      <button type="button" class="tool" data-angle aria-label="Ndrysho këndin e kamerës"><Fragment set:html={icon('videoCamera')} /></button>
      <button type="button" class="tool" data-view aria-pressed="false" aria-label="Pamje e sheshtë"><Fragment set:html={icon('square')} /><span class="visually-hidden" data-label>Pamje e sheshtë</span></button>
    </div>`,
    wrap([
      tool('data-new', 'plus', 'Lojë e re'),
      tool('data-undo', 'arrowCounterClockwise', 'Kthe lëvizjen'),
      tool('data-flip', 'arrowsDownUp', 'Rrotullo tabelën'),
      tool('data-angle', 'videoCamera', 'Këndi i kamerës'),
      tool('data-view aria-pressed="false"', 'square', 'Pamje e sheshtë'),
      motion,
    ]),
  ],
]);

edit('src/pages/ushtrime.astro', [
  [
    `    <div class="tools" data-board-ui>
      <button type="button" class="tool tool--motion" data-motion-switch aria-pressed="false" aria-label="Ndal lëvizjet"><span data-when="on"><Fragment set:html={icon('pause')} /></span><span data-when="off"><Fragment set:html={icon('play')} /></span></button>
      <button type="button" class="tool" data-next-puzzle aria-label="Ushtrimi tjetër"><Fragment set:html={icon('arrowRight')} /></button>
      <button type="button" class="tool" data-angle aria-label="Ndrysho këndin e kamerës"><Fragment set:html={icon('videoCamera')} /></button>
      <button type="button" class="tool" data-view aria-pressed="false" aria-label="Pamje 3D"><Fragment set:html={icon('cube')} /></button>
    </div>`,
    wrap([
      tool('data-next-puzzle', 'arrowRight', 'Ushtrimi tjetër'),
      tool('data-angle', 'videoCamera', 'Këndi i kamerës'),
      tool('data-view aria-pressed="false"', 'cube', 'Pamje 3D'),
      motion,
    ]),
  ],
]);

edit('src/lib/icons.ts', [
  [`import eye from`, `import dotsThreeVertical from '@phosphor-icons/core/assets/regular/dots-three-vertical.svg?raw';\nimport eye from`],
  [`  cube,\n  eye,`, `  cube,\n  dotsThreeVertical,\n  eye,`],
]);

edit('src/scripts/play.ts', [
  [
    `  const viewLabel = board.kind === '3d' ? 'Pamje e sheshtë' : 'Pamje 3D';
  ui.viewToggle.querySelector('[data-label]')!.textContent = viewLabel;
  ui.viewToggle.setAttribute('aria-label', viewLabel);
  ui.viewToggle.innerHTML = ui.viewToggle.innerHTML.replace(/<svg[\\s\\S]*?<\\/svg>/, board.kind === '3d' ? icon('square') : icon('cube'));`,
    `  ui.viewToggle.querySelector('[data-label]')!.textContent = board.kind === '3d' ? 'Pamje e sheshtë' : 'Pamje 3D';
  ui.viewToggle.querySelector('.tool__icon')!.innerHTML = board.kind === '3d' ? icon('square') : icon('cube');`,
  ],
]);
edit('src/scripts/puzzles.ts', [
  [
    `  ui.view.setAttribute('aria-label', board.kind === '3d' ? 'Pamje e sheshtë' : 'Pamje 3D');
  ui.view.innerHTML = board.kind === '3d' ? icon('square') : icon('cube');`,
    `  ui.view.querySelector('[data-label]')!.textContent = board.kind === '3d' ? 'Pamje e sheshtë' : 'Pamje 3D';
  ui.view.querySelector('.tool__icon')!.innerHTML = board.kind === '3d' ? icon('square') : icon('cube');`,
  ],
]);

edit('src/scripts/shell.ts', [
  [
    `  reduced.addEventListener('change', () => listeners.forEach((fn) => fn(motionOn())));`,
    `  reduced.addEventListener('change', () => listeners.forEach((fn) => fn(motionOn())));
  // the tool menu on a phone stage: opens a labelled list, closes on a choice, outside, or Escape
  document.querySelectorAll<HTMLButtonElement>('[data-tools-toggle]').forEach((btn) => {
    const box = btn.closest<HTMLElement>('.tools')!;
    const set = (open: boolean) => {
      box.toggleAttribute('data-open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', () => set(!box.hasAttribute('data-open')));
    box.querySelector('.tools__list')?.addEventListener('click', (e) => {
      if ((e.target as Element).closest('.tool')) set(false);
    });
    document.addEventListener('pointerdown', (e) => {
      if (!box.contains(e.target as Node)) set(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && box.hasAttribute('data-open')) {
        set(false);
        btn.focus();
      }
    });
  });`,
  ],
]);

edit('src/styles/play.css', [
  [
    `/* tools, top right */
.tools { top: 0.5rem; right: 0.5rem; display: grid; gap: 0.25rem; }
.tool {
  display: grid; place-items: center; width: 44px; height: 44px;
  background: rgb(20 17 14 / 0.86); color: var(--stone);
  transition: transform var(--dur-press) var(--ease-out), background-color var(--dur-ui) ease;
}`,
    `/* tools, top right: one menu button on a phone, a row of icons on a wide screen */
.tools { top: 0.5rem; right: 0.5rem; display: grid; justify-items: end; gap: 0.25rem; }
.tool {
  display: flex; align-items: center; gap: 0.75rem; min-width: 44px; height: 44px; padding: 0 0.7rem;
  background: rgb(20 17 14 / 0.86); color: var(--stone); font-weight: 680; font-size: 0.9375rem; white-space: nowrap;
  transition: transform var(--dur-press) var(--ease-out), background-color var(--dur-ui) ease;
}
.tool__icon { display: grid; place-items: center; }
.tool--menu { justify-content: center; padding: 0; width: 44px; }
.tools__list { display: none; }
.tools[data-open] .tools__list {
  display: grid; gap: 1px; min-width: 15rem; background: rgb(230 229 225 / 0.12);
  transform-origin: top right; animation: menu-in 160ms var(--ease-out);
}
@keyframes menu-in { from { opacity: 0; transform: scale(0.96); } }
.tools__list .tool { width: 100%; height: 48px; background: #15120f; }
.tools[data-open] .tool--menu { background: var(--stone); color: var(--ink); }
@media (min-width: 1024px) {
  .tool--menu { display: none; }
  .tools__list, .tools[data-open] .tools__list { display: flex; gap: 0.25rem; min-width: 0; background: none; animation: none; }
  .tools__list .tool { width: 44px; height: 44px; padding: 0; justify-content: center; background: rgb(20 17 14 / 0.86); }
  .tool__label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
}`,
  ],
  [`.tool--motion [data-when] { display: none; }
html:not([data-motion="off"]) .tool--motion [data-when="on"],
html[data-motion="off"] .tool--motion [data-when="off"] { display: grid; }`,
    `.tool--motion [data-when] { display: none; }
html:not([data-motion="off"]) .tool--motion [data-when="on"],
html[data-motion="off"] .tool--motion [data-when="off"] { display: grid; }
html[data-motion="off"] .tool--motion .tool__label::after { content: " (ndalur)"; }`],
]);
console.log('ok');
