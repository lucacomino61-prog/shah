// The sheets that hold what used to lie below the table (Luca, 2026-10-16: "everything inside a page not to scroll …
// make it be like an real app"): the scoresheet, the puzzle themes, a game to open, the opening's lines. Each page is
// one screen; these rise over it from the bottom as iOS sheets do, and the tools menu (or a control on the table) opens
// them. Anything with [data-panel-open="name"] opens dialog[data-panel="name"]; [data-panel-close] and a tap on the
// dimmed table close it; a swipe down on its head closes it too (feel.ts).

export function openPanel(name: string) {
  const d = document.querySelector<HTMLDialogElement>(`dialog[data-panel="${name}"]`);
  if (!d || d.open) return;
  d.showModal();
  d.querySelector<HTMLElement>('.panel__title')?.focus({ preventScroll: true });
}

/** Back to the table: every open sheet closes (a theme chosen, a game opened, a move picked). */
export function closePanels() {
  document.querySelectorAll<HTMLDialogElement>('dialog[data-panel][open]').forEach((d) => d.close());
}

export function initPanels() {
  document.addEventListener('click', (e) => {
    const t = e.target as Element | null;
    const open = t?.closest<HTMLElement>('[data-panel-open]');
    if (open) return openPanel(open.dataset.panelOpen!);
    const close = t?.closest('[data-panel-close]');
    if (close) close.closest('dialog')?.close();
  });
  document.querySelectorAll<HTMLDialogElement>('dialog[data-panel]').forEach((d) =>
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    }),
  );
}
