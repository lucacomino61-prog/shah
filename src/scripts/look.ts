// The Pamja pickers (components/LookPicker.astro): they show the stored room and set, keep a new choice, and tell
// the board on the page (board/index.ts listens for shah:look). On the table pages the palette buttons open the sheet.

import { chosenSet, chosenWorld, choose, type PieceSetId, type WorldId } from './board/looks.ts';

function wire(picker: HTMLElement) {
  const sync = () => {
    const w = picker.querySelector<HTMLInputElement>(`input[name="world"][value="${chosenWorld()}"]`);
    const p = picker.querySelector<HTMLInputElement>(`input[name="pieces"][value="${chosenSet()}"]`);
    if (w) w.checked = true;
    if (p) p.checked = true;
  };
  sync();
  picker.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.name === 'world') choose({ world: input.value as WorldId });
    if (input.name === 'pieces') choose({ pieces: input.value as PieceSetId });
  });
  // another picker on the page (or another tab) may have changed it
  window.addEventListener('shah:look', sync);
}

document.querySelectorAll<HTMLElement>('[data-look-picker]').forEach(wire);

const dialog = document.querySelector<HTMLDialogElement>('[data-look-dialog]');
if (dialog) {
  document.addEventListener('click', (e) => {
    const open = (e.target as Element | null)?.closest?.('[data-look-open]');
    if (!open) return;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('#pamja-title')?.focus();
  });
  // a tap on the dimmed table closes it
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

// a choice made in another tab
window.addEventListener('storage', (e) => {
  if (e.key === 'shah.world' || e.key === 'shah.pieces') choose({});
});
