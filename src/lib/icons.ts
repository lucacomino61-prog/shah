// Phosphor icons, inlined at build time: one family, one weight. Pause and play use the filled weight, since thin
// bars at 16 px read as a missing glyph.
import arrowCounterClockwise from '@phosphor-icons/core/assets/regular/arrow-counter-clockwise.svg?raw';
import arrowLeft from '@phosphor-icons/core/assets/regular/arrow-left.svg?raw';
import arrowRight from '@phosphor-icons/core/assets/regular/arrow-right.svg?raw';
import arrowsDownUp from '@phosphor-icons/core/assets/regular/arrows-down-up.svg?raw';
import bookOpenText from '@phosphor-icons/core/assets/regular/book-open-text.svg?raw';
import caretLeft from '@phosphor-icons/core/assets/regular/caret-left.svg?raw';
import caretRight from '@phosphor-icons/core/assets/regular/caret-right.svg?raw';
import chartLineUp from '@phosphor-icons/core/assets/regular/chart-line-up.svg?raw';
import check from '@phosphor-icons/core/assets/regular/check.svg?raw';
import cube from '@phosphor-icons/core/assets/regular/cube.svg?raw';
import dotsThreeVertical from '@phosphor-icons/core/assets/regular/dots-three-vertical.svg?raw';
import eye from '@phosphor-icons/core/assets/regular/eye.svg?raw';
import flag from '@phosphor-icons/core/assets/regular/flag.svg?raw';
import horse from '@phosphor-icons/core/assets/regular/horse.svg?raw';
import lightbulb from '@phosphor-icons/core/assets/regular/lightbulb.svg?raw';
import pause from '@phosphor-icons/core/assets/fill/pause-fill.svg?raw';
import play from '@phosphor-icons/core/assets/fill/play-fill.svg?raw';
import plus from '@phosphor-icons/core/assets/regular/plus.svg?raw';
import puzzlePiece from '@phosphor-icons/core/assets/regular/puzzle-piece.svg?raw';
import square from '@phosphor-icons/core/assets/regular/square.svg?raw';
import videoCamera from '@phosphor-icons/core/assets/regular/video-camera.svg?raw';
import x from '@phosphor-icons/core/assets/regular/x.svg?raw';

const raw = {
  arrowCounterClockwise,
  arrowLeft,
  arrowRight,
  arrowsDownUp,
  bookOpenText,
  caretLeft,
  caretRight,
  chartLineUp,
  check,
  cube,
  dotsThreeVertical,
  eye,
  flag,
  horse,
  lightbulb,
  pause,
  play,
  plus,
  puzzlePiece,
  square,
  videoCamera,
  x,
};
export type IconName = keyof typeof raw;

export function icon(name: IconName, cls = 'icon'): string {
  return raw[name].replace('<svg ', `<svg class="${cls}" aria-hidden="true" focusable="false" `);
}
