import type { LevelDef } from '../core/types';
import { BLOCKMAN_LEVELS } from './blockman';
import { BLOCKMAN2_LEVELS } from './blockman2';
import { LEVELS as BLOCKDUDE_LEVELS } from './levels';

export interface Campaign {
  /** Stable key — used for saved progress, so never change it. */
  id: string;
  name: string;
  /** One line under the name in the picker. */
  blurb: string;
  /** Provenance, shown in the picker so the source is always visible. */
  source: string;
  levels: LevelDef[];
}

export const CAMPAIGNS: Campaign[] = [
  {
    id: 'blockman',
    name: 'Block-Man',
    blurb: "The original chambers of King Triangulos.",
    source:
      'Recovered pixel-by-pixel from EGA screenshots of the 1993 Soleau ' +
      'Software release. The original has 17 rooms; only these three were ' +
      'ever published as screenshots.',
    levels: BLOCKMAN_LEVELS,
  },
  {
    id: 'blockman2',
    name: 'Block-Man 2',
    blurb: 'Collect every jewel, then find the door.',
    source:
      'Original levels in the style of the 1995 sequel, not Soleau layouts. ' +
      "Block-Man 2's own rooms are obfuscated inside its executable and scroll " +
      'beyond one screen, so they cannot be read off screenshots.',
    levels: BLOCKMAN2_LEVELS,
  },
  {
    id: 'blockdude',
    name: 'Block Dude',
    blurb: 'The full eleven-level calculator classic.',
    source:
      "Brandon Sterner's TI-83 Block Dude, via the open-source Block Dude CE " +
      'port. Inspired by Block-Man and identical in rules, but an original ' +
      'level set — not Soleau’s.',
    levels: BLOCKDUDE_LEVELS,
  },
];

export function campaignById(id: string): Campaign {
  return CAMPAIGNS.find((c) => c.id === id) ?? CAMPAIGNS[0];
}
