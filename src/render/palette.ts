/**
 * Single source of truth for colour. Deliberately warm stone + amber against
 * a cool slate ground: high contrast for the puzzle read, no purple anywhere.
 */
export const PALETTE = {
  // Chamber background
  voidTop: '#0b1016',
  voidBottom: '#131b24',
  grid: 'rgba(148, 163, 184, 0.045)',

  // Walls - cold quarried stone
  wallFace: '#3a4551',
  wallLight: '#4c5866',
  wallDark: '#242c35',
  wallMortar: '#1b222a',

  // Blocks - warm crates, the one thing you can move
  blockFace: '#b3813c',
  blockLight: '#d8a74f',
  blockDark: '#7a5423',
  blockBand: '#8c6229',

  // Exit
  doorGlow: '#3fb950',
  doorFrame: '#2b6f3a',
  doorInner: '#0f2015',

  // Block-Man
  skin: '#e8c8a0',
  tunic: '#2f81d8',
  tunicDark: '#1f5ea3',
  belt: '#28313b',
  boots: '#1d242c',
  outline: '#0a0e13',
} as const;
