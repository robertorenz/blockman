import { LEVELS } from '../levels/levels';
import { showModal } from './modal';

export interface Progress {
  /** Highest level index unlocked. */
  unlocked: number;
  /** Best move count per level index, keyed by index. */
  best: Record<number, number>;
}

const STORAGE_KEY = 'blockman.progress.v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Progress>;
      return {
        unlocked: Math.min(Math.max(parsed.unlocked ?? 0, 0), LEVELS.length - 1),
        best: parsed.best ?? {},
      };
    }
  } catch {
    // Corrupt or unavailable storage just means a fresh run.
  }
  return { unlocked: 0, best: {} };
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Private-mode browsing; progress simply will not persist.
  }
}

export function showHelp(): Promise<string | null> {
  return showModal({
    eyebrow: 'The rules of Bentangle',
    title: 'How to play',
    dismissible: true,
    body: `
      <p>King Triangulos built these chambers so that only the clever could
      leave them. Reach the glowing doorway to escape.</p>
      <dl class="rules">
        <dt>Turn, then walk</dt>
        <dd>The first press of a direction turns Block-Man to face it. The next
        press walks him one square.</dd>
        <dt>Climb exactly one</dt>
        <dd>He steps up a single square without help. Two is a wall.</dd>
        <dd class="rules__note">He falls from any height unharmed.</dd>
        <dt>Carry one block</dt>
        <dd>Lift the block you are facing, then drop it where you need a step.
        A block with anything stacked on it cannot be lifted.</dd>
      </dl>
      <table class="keys">
        <tbody>
          <tr><td><kbd>&larr;</kbd> <kbd>&rarr;</kbd></td><td>Turn and walk</td></tr>
          <tr><td><kbd>&uarr;</kbd> / <kbd>Space</kbd></td><td>Pick up or drop a block</td></tr>
          <tr><td><kbd>U</kbd> / <kbd>Z</kbd></td><td>Undo the last move</td></tr>
          <tr><td><kbd>R</kbd></td><td>Restart the chamber</td></tr>
          <tr><td><kbd>L</kbd></td><td>Chamber select</td></tr>
          <tr><td><kbd>M</kbd></td><td>Mute sound</td></tr>
        </tbody>
      </table>`,
    actions: [{ label: 'Begin', primary: true, value: 'ok' }],
  });
}

export function showLevelSelect(progress: Progress): Promise<string | null> {
  const grid = document.createElement('div');
  grid.className = 'levelgrid';

  LEVELS.forEach((level, i) => {
    const locked = i > progress.unlocked;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'levelcard' + (locked ? ' levelcard--locked' : '');
    btn.disabled = locked;
    btn.value = String(i);

    const best = progress.best[i];
    btn.innerHTML = `
      <span class="levelcard__num">${String(i + 1).padStart(2, '0')}</span>
      <span class="levelcard__name">${level.name}</span>
      <span class="levelcard__meta">${
        locked ? 'Locked' : best !== undefined ? `Best ${best} moves` : 'Unsolved'
      }</span>`;

    btn.addEventListener('click', () => {
      btn.closest('dialog')?.close('level:' + i);
    });
    grid.append(btn);
  });

  return showModal({
    eyebrow: `${Object.keys(progress.best).length} of ${LEVELS.length} escaped`,
    title: 'Chamber select',
    body: grid,
    dismissible: true,
    actions: [{ label: 'Close', value: 'close' }],
  });
}
