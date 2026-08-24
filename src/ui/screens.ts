import { CAMPAIGNS, campaignById, type Campaign } from '../levels';
import { showModal } from './modal';

export interface Progress {
  /** Highest level index unlocked, per campaign id. */
  unlocked: Record<string, number>;
  /** Best move count, keyed "<campaignId>:<levelIndex>". */
  best: Record<string, number>;
  /** Campaign the player was last in. */
  lastCampaign: string;
}

const STORAGE_KEY = 'blockman.progress.v2';

export function loadProgress(): Progress {
  const empty: Progress = { unlocked: {}, best: {}, lastCampaign: CAMPAIGNS[0].id };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      unlocked: parsed.unlocked ?? {},
      best: parsed.best ?? {},
      lastCampaign: parsed.lastCampaign ?? CAMPAIGNS[0].id,
    };
  } catch {
    return empty;
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Private-mode browsing; progress simply will not persist.
  }
}

export function unlockedIn(p: Progress, c: Campaign): number {
  return Math.min(Math.max(p.unlocked[c.id] ?? 0, 0), c.levels.length - 1);
}

export function bestFor(p: Progress, c: Campaign, i: number): number | undefined {
  return p.best[`${c.id}:${i}`];
}

export function solvedIn(p: Progress, c: Campaign): number {
  return c.levels.filter((_, i) => bestFor(p, c, i) !== undefined).length;
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
          <tr><td><kbd>C</kbd></td><td>Change campaign</td></tr>
          <tr><td><kbd>M</kbd></td><td>Mute sound</td></tr>
        </tbody>
      </table>`,
    actions: [{ label: 'Begin', primary: true, value: 'ok' }],
  });
}

/** The opening screen: pick which set of chambers to play. */
export function showCampaignSelect(
  progress: Progress,
  opts: { dismissible?: boolean } = {},
): Promise<string | null> {
  const wrap = document.createElement('div');
  wrap.className = 'campaigns';

  for (const c of CAMPAIGNS) {
    const done = solvedIn(progress, c);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'campaign';
    btn.innerHTML = `
      <span class="campaign__head">
        <span class="campaign__name">${c.name}</span>
        <span class="campaign__count">${done} / ${c.levels.length}</span>
      </span>
      <span class="campaign__blurb">${c.blurb}</span>
      <span class="campaign__source">${c.source}</span>`;
    btn.addEventListener('click', () => btn.closest('dialog')?.close('campaign:' + c.id));
    wrap.append(btn);
  }

  return showModal({
    eyebrow: 'Block-Man',
    title: 'Choose your chambers',
    body: wrap,
    dismissible: opts.dismissible ?? false,
    actions: opts.dismissible ? [{ label: 'Cancel', value: 'cancel' }] : [],
  });
}

/** 'extreme' is too long for the badge, and "extra hard" is what it means. */
const TIER_LABEL: Record<string, string> = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
  extreme: 'extra hard',
};

export function showLevelSelect(progress: Progress, campaignId: string): Promise<string | null> {
  const c = campaignById(campaignId);
  const unlocked = unlockedIn(progress, c);

  const grid = document.createElement('div');
  grid.className = 'levelgrid';

  c.levels.forEach((level, i) => {
    const locked = i > unlocked;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'levelcard' + (locked ? ' levelcard--locked' : '');
    btn.disabled = locked;

    const best = bestFor(progress, c, i);
    const tier = level.tier
      ? `<span class="tier tier--${level.tier}">${TIER_LABEL[level.tier] ?? level.tier}</span>`
      : '';
    btn.innerHTML = `
      <span class="levelcard__top">
        <span class="levelcard__num">${String(i + 1).padStart(2, '0')}</span>
        ${tier}
      </span>
      <span class="levelcard__name">${level.name}</span>
      <span class="levelcard__meta">${
        locked
          ? 'Locked'
          : best !== undefined
            ? `Best ${best}${level.par ? ` · par ${level.par}` : ''}`
            : level.par !== undefined
              ? `Unsolved · par ${level.par}`
              : 'Unsolved'
      }</span>`;

    btn.addEventListener('click', () => btn.closest('dialog')?.close('level:' + i));
    grid.append(btn);
  });

  return showModal({
    eyebrow: `${c.name} — ${solvedIn(progress, c)} of ${c.levels.length} escaped`,
    title: 'Chamber select',
    body: grid,
    dismissible: true,
    actions: [{ label: 'Change campaign', value: 'campaign' }],
  });
}
