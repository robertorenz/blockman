import './style.css';

import { History } from './core/history';
import { cloneState, loadLevel } from './core/level';
import { grabOrDrop, move } from './core/rules';
import type { GameState, StepResult } from './core/types';
import { LEVELS } from './levels/levels';
import { Sfx } from './render/audio';
import { Renderer } from './render/renderer';
import { isModalOpen, showModal } from './ui/modal';
import { loadProgress, saveProgress, showHelp, showLevelSelect, type Progress } from './ui/screens';

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const stageWrap = document.querySelector<HTMLDivElement>('#stage-wrap')!;

const el = {
  level: document.querySelector<HTMLElement>('#hud-level')!,
  name: document.querySelector<HTMLElement>('#hud-name')!,
  moves: document.querySelector<HTMLElement>('#hud-moves')!,
  best: document.querySelector<HTMLElement>('#hud-best')!,
  carry: document.querySelector<HTMLElement>('#hud-carry')!,
  sound: document.querySelector<HTMLButtonElement>('#btn-sound')!,
};

const renderer = new Renderer(canvas);
const sfx = new Sfx();
const history = new History();

let progress: Progress = loadProgress();
let levelIndex = 0;
let state: GameState = loadLevel(LEVELS[0]);
let shakeUntil = 0;

function startLevel(index: number): void {
  levelIndex = index;
  state = loadLevel(LEVELS[index]);
  history.clear();
  renderer.snapTo(state);
  fit();
  updateHud();
}

function fit(): void {
  const pad = 24;
  renderer.resize(state, stageWrap.clientWidth - pad, stageWrap.clientHeight - pad);
}

function updateHud(): void {
  const best = progress.best[levelIndex];
  el.level.textContent = String(levelIndex + 1).padStart(2, '0');
  el.name.textContent = LEVELS[levelIndex].name;
  el.moves.textContent = String(state.moves);
  el.best.textContent = best === undefined ? '--' : String(best);
  el.carry.dataset.on = state.carrying ? 'true' : 'false';
  el.carry.textContent = state.carrying ? 'Carrying' : 'Empty-handed';
}

/** Map a rules result onto sound + screen feedback. */
function feedback(result: StepResult): void {
  switch (result.kind) {
    case 'none':
      sfx.play('blocked');
      shakeUntil = performance.now() + 120;
      break;
    case 'walk':
    case 'turn':
      sfx.play('walk');
      break;
    case 'climb':
      sfx.play('climb');
      break;
    case 'fall':
      sfx.play('land');
      break;
    case 'pickup':
      sfx.play('pickup');
      break;
    case 'drop':
      sfx.play('drop');
      break;
  }
}

function act(fn: (s: GameState) => StepResult): void {
  if (state.won || isModalOpen()) return;

  const before = cloneState(state);
  const result = fn(state);

  if (result.kind !== 'none') history.push(before);
  feedback(result);
  updateHud();

  if (state.won) void onWin();
}

async function onWin(): Promise<void> {
  sfx.play('win');

  const prevBest = progress.best[levelIndex];
  const isRecord = prevBest === undefined || state.moves < prevBest;
  if (isRecord) progress.best[levelIndex] = state.moves;
  progress.unlocked = Math.max(progress.unlocked, Math.min(levelIndex + 1, LEVELS.length - 1));
  saveProgress(progress);
  updateHud();

  const isFinal = levelIndex === LEVELS.length - 1;

  const choice = await showModal({
    eyebrow: isFinal ? 'The kingdom of Bentangle' : `Chamber ${levelIndex + 1} cleared`,
    title: isFinal ? 'You have won the princess' : 'Escaped',
    body: isFinal
      ? `<p>Every chamber King Triangulos built has been beaten. Block-Man walks
         out of the last door a free man.</p>
         <p class="stat"><strong>${state.moves}</strong> moves on the final chamber.</p>`
      : `<p class="stat"><strong>${state.moves}</strong> moves${
          isRecord && prevBest !== undefined ? ' &mdash; a new best' : ''
        }.</p>
         ${prevBest !== undefined && !isRecord ? `<p class="muted">Your best is ${prevBest}.</p>` : ''}`,
    actions: isFinal
      ? [
          { label: 'Chamber select', value: 'select' },
          { label: 'Play again', primary: true, value: 'restart-all' },
        ]
      : [
          { label: 'Replay chamber', value: 'replay' },
          { label: 'Next chamber', primary: true, value: 'next' },
        ],
  });

  if (choice === 'next') startLevel(levelIndex + 1);
  else if (choice === 'replay') startLevel(levelIndex);
  else if (choice === 'restart-all') startLevel(0);
  else if (choice === 'select') void openLevelSelect();
  else startLevel(Math.min(levelIndex + 1, LEVELS.length - 1));
}

function undo(): void {
  const prev = history.pop();
  if (!prev) {
    sfx.play('blocked');
    return;
  }
  state = prev;
  renderer.snapTo(state);
  sfx.play('drop');
  updateHud();
}

async function openLevelSelect(): Promise<void> {
  const choice = await showLevelSelect(progress);
  if (choice?.startsWith('level:')) startLevel(Number(choice.slice(6)));
}

async function confirmReset(): Promise<void> {
  if (state.moves === 0) {
    startLevel(levelIndex);
    return;
  }
  const choice = await showModal({
    title: 'Restart this chamber?',
    body: `<p>Block-Man returns to the entrance and the blocks go back where
           they started. Your ${state.moves} moves so far will be discarded.</p>`,
    dismissible: true,
    actions: [
      { label: 'Keep playing', value: 'cancel' },
      { label: 'Restart', primary: true, value: 'reset' },
    ],
  });
  if (choice === 'reset') startLevel(levelIndex);
}

function toggleSound(): void {
  sfx.enabled = !sfx.enabled;
  el.sound.dataset.on = String(sfx.enabled);
  el.sound.setAttribute('aria-pressed', String(sfx.enabled));
  el.sound.title = sfx.enabled ? 'Mute sound (M)' : 'Unmute sound (M)';
  if (sfx.enabled) sfx.play('pickup');
}

// --- input ----------------------------------------------------------------

const HELD = new Set<string>();

window.addEventListener('keydown', (e) => {
  sfx.unlock();

  const key = e.key.toLowerCase();
  const handled = [
    'arrowleft', 'arrowright', 'arrowup', 'a', 'd', 'w',
    ' ', 'u', 'z', 'r', 'l', 'm', '?',
  ];
  if (!handled.includes(key)) return;
  e.preventDefault();

  if (isModalOpen()) return;

  // Ignore OS key-repeat for the one-shot actions only.
  const oneShot = ['u', 'z', 'r', 'l', 'm', '?', ' ', 'arrowup', 'w'];
  if (e.repeat && oneShot.includes(key)) return;
  HELD.add(key);

  switch (key) {
    case 'arrowleft':
    case 'a':
      act((s) => move(s, 'left'));
      break;
    case 'arrowright':
    case 'd':
      act((s) => move(s, 'right'));
      break;
    case 'arrowup':
    case 'w':
    case ' ':
      act(grabOrDrop);
      break;
    case 'u':
    case 'z':
      undo();
      break;
    case 'r':
      void confirmReset();
      break;
    case 'l':
      void openLevelSelect();
      break;
    case 'm':
      toggleSound();
      break;
    case '?':
      void showHelp();
      break;
  }
});

window.addEventListener('keyup', (e) => HELD.delete(e.key.toLowerCase()));

// Touch controls mirror the keyboard exactly.
document.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((btn) => {
  const fire = (e: Event) => {
    e.preventDefault();
    sfx.unlock();
    switch (btn.dataset.act) {
      case 'left': act((s) => move(s, 'left')); break;
      case 'right': act((s) => move(s, 'right')); break;
      case 'grab': act(grabOrDrop); break;
      case 'undo': undo(); break;
      case 'reset': void confirmReset(); break;
      case 'levels': void openLevelSelect(); break;
      case 'help': void showHelp(); break;
      case 'sound': toggleSound(); break;
    }
  };
  btn.addEventListener('click', fire);
});

window.addEventListener('resize', fit);

// --- boot -----------------------------------------------------------------

function frame(now: number): void {
  if (now < shakeUntil) {
    const t = (shakeUntil - now) / 120;
    canvas.style.transform = `translateX(${(Math.sin(now / 12) * 3 * t).toFixed(2)}px)`;
  } else if (canvas.style.transform) {
    canvas.style.transform = '';
  }
  renderer.draw(state, now);
  requestAnimationFrame(frame);
}

startLevel(progress.unlocked);
requestAnimationFrame(frame);

if (!localStorage.getItem('blockman.seenHelp')) {
  void showHelp().then(() => localStorage.setItem('blockman.seenHelp', '1'));
}
