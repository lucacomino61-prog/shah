// Phosphor icons, inlined at build time: one family, one weight. Pause, play and the streak flame use the filled
// weight, since thin strokes at 16 px read as a missing glyph.
import arrowCounterClockwise from '@phosphor-icons/core/assets/regular/arrow-counter-clockwise.svg?raw';
import arrowLeft from '@phosphor-icons/core/assets/regular/arrow-left.svg?raw';
import arrowRight from '@phosphor-icons/core/assets/regular/arrow-right.svg?raw';
import arrowsDownUp from '@phosphor-icons/core/assets/regular/arrows-down-up.svg?raw';
import bookOpenText from '@phosphor-icons/core/assets/regular/book-open-text.svg?raw';
import caretLeft from '@phosphor-icons/core/assets/regular/caret-left.svg?raw';
import caretRight from '@phosphor-icons/core/assets/regular/caret-right.svg?raw';
import chartLineUp from '@phosphor-icons/core/assets/regular/chart-line-up.svg?raw';
import check from '@phosphor-icons/core/assets/regular/check.svg?raw';
import dotsThreeVertical from '@phosphor-icons/core/assets/regular/dots-three-vertical.svg?raw';
import eye from '@phosphor-icons/core/assets/regular/eye.svg?raw';
import flag from '@phosphor-icons/core/assets/regular/flag.svg?raw';
import horse from '@phosphor-icons/core/assets/regular/horse.svg?raw';
import lightbulb from '@phosphor-icons/core/assets/regular/lightbulb.svg?raw';
import pause from '@phosphor-icons/core/assets/fill/pause-fill.svg?raw';
import play from '@phosphor-icons/core/assets/fill/play-fill.svg?raw';
import plus from '@phosphor-icons/core/assets/regular/plus.svg?raw';
import puzzlePiece from '@phosphor-icons/core/assets/regular/puzzle-piece.svg?raw';
import videoCamera from '@phosphor-icons/core/assets/regular/video-camera.svg?raw';
import x from '@phosphor-icons/core/assets/regular/x.svg?raw';
import bell from '@phosphor-icons/core/assets/regular/bell.svg?raw';
import calendarCheck from '@phosphor-icons/core/assets/regular/calendar-check.svg?raw';
import cloudArrowUp from '@phosphor-icons/core/assets/regular/cloud-arrow-up.svg?raw';
import downloadSimple from '@phosphor-icons/core/assets/regular/download-simple.svg?raw';
import fire from '@phosphor-icons/core/assets/fill/fire-fill.svg?raw';
import globe from '@phosphor-icons/core/assets/regular/globe.svg?raw';
import lightning from '@phosphor-icons/core/assets/regular/lightning.svg?raw';
import magnifyingGlass from '@phosphor-icons/core/assets/regular/magnifying-glass.svg?raw';
import shieldWarning from '@phosphor-icons/core/assets/regular/shield-warning.svg?raw';
import speakerHigh from '@phosphor-icons/core/assets/regular/speaker-high.svg?raw';
import speakerSlash from '@phosphor-icons/core/assets/regular/speaker-slash.svg?raw';
import timer from '@phosphor-icons/core/assets/regular/timer.svg?raw';
import uploadSimple from '@phosphor-icons/core/assets/regular/upload-simple.svg?raw';
import users from '@phosphor-icons/core/assets/regular/users.svg?raw';
import robot from '@phosphor-icons/core/assets/regular/robot.svg?raw';
import shareNetwork from '@phosphor-icons/core/assets/regular/share-network.svg?raw';
import copy from '@phosphor-icons/core/assets/regular/copy.svg?raw';
import pencilSimple from '@phosphor-icons/core/assets/regular/pencil-simple.svg?raw';
import caretUpDown from '@phosphor-icons/core/assets/regular/caret-up-down.svg?raw';
import deviceMobile from '@phosphor-icons/core/assets/regular/device-mobile.svg?raw';
import linkSimple from '@phosphor-icons/core/assets/regular/link-simple.svg?raw';
import arrowsClockwise from '@phosphor-icons/core/assets/regular/arrows-clockwise.svg?raw';
import handshake from '@phosphor-icons/core/assets/regular/handshake.svg?raw';

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
  dotsThreeVertical,
  eye,
  flag,
  horse,
  lightbulb,
  pause,
  play,
  plus,
  puzzlePiece,
  videoCamera,
  x,
  bell,
  calendarCheck,
  cloudArrowUp,
  downloadSimple,
  fire,
  globe,
  lightning,
  magnifyingGlass,
  shieldWarning,
  speakerHigh,
  speakerSlash,
  timer,
  uploadSimple,
  users,
  robot,
  shareNetwork,
  copy,
  pencilSimple,
  caretUpDown,
  deviceMobile,
  linkSimple,
  arrowsClockwise,
  handshake,
};
export type IconName = keyof typeof raw;

export function icon(name: IconName, cls = 'icon'): string {
  return raw[name].replace('<svg ', `<svg class="${cls}" aria-hidden="true" focusable="false" `);
}
