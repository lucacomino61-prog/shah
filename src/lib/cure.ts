// The lesson (or the puzzles) that cures each kind of mistake the coach names: the progress page's list of mistakes
// and the end of a game point to it.
import type { Tag } from './coach.ts';

export const CURE: Record<Tag, { href: string; label: string }> = {
  hanging: { href: '/mesime/vlera-e-figurave/', label: 'Mësimi: Vlera e figurave' },
  'lost-material': { href: '/mesime/vlera-e-figurave/', label: 'Mësimi: Vlera e figurave' },
  'missed-capture': { href: '/ushtrime/', label: 'Ushtrime: Figura pa mbrojtje' },
  'allowed-fork': { href: '/mesime/piruni/', label: 'Mësimi: Piruni' },
  'missed-fork': { href: '/mesime/piruni/', label: 'Mësimi: Piruni' },
  'allowed-mate': { href: '/mesime/mat-ne-rreshtin-e-fundit/', label: 'Mësimi: Mat në rreshtin e fundit' },
  'missed-mate': { href: '/mesime/mat-ne-dy/', label: 'Mësimi: Mat me dy lëvizje' },
  'early-queen': { href: '/mesime/parimet-e-hapjes/', label: 'Mësimi: Parimet e hapjes' },
  'same-piece': { href: '/mesime/parimet-e-hapjes/', label: 'Mësimi: Parimet e hapjes' },
  'rim-knight': { href: '/mesime/parimet-e-hapjes/', label: 'Mësimi: Parimet e hapjes' },
  'f-pawn': { href: '/mesime/parimet-e-hapjes/', label: 'Mësimi: Parimet e hapjes' },
};
