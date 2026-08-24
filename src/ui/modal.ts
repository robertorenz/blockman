/**
 * Every interruption in this game is a modal - never window.alert/confirm.
 * Built on <dialog> so focus trapping and Esc come from the platform.
 */

export interface ModalAction {
  label: string;
  /** Rendered as the filled accent button. Exactly one action should set this. */
  primary?: boolean;
  value: string;
}

export interface ModalOptions {
  title: string;
  body: string | HTMLElement;
  actions: ModalAction[];
  /** Small uppercase line above the title. */
  eyebrow?: string;
  /** Allow Esc / backdrop click to dismiss, resolving to null. */
  dismissible?: boolean;
}

let openDialog: HTMLDialogElement | null = null;

/** Close whatever modal is showing, resolving it as dismissed. */
export function closeModal(): void {
  openDialog?.close('');
}

export function isModalOpen(): boolean {
  return openDialog !== null;
}

export function showModal(opts: ModalOptions): Promise<string | null> {
  closeModal();

  const dialog = document.createElement('dialog');
  dialog.className = 'modal';

  const card = document.createElement('div');
  card.className = 'modal__card';

  if (opts.eyebrow) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'modal__eyebrow';
    eyebrow.textContent = opts.eyebrow;
    card.append(eyebrow);
  }

  const heading = document.createElement('h2');
  heading.className = 'modal__title';
  heading.textContent = opts.title;
  card.append(heading);

  const body = document.createElement('div');
  body.className = 'modal__body';
  if (typeof opts.body === 'string') body.innerHTML = opts.body;
  else body.append(opts.body);
  card.append(body);

  const footer = document.createElement('div');
  footer.className = 'modal__actions';
  for (const action of opts.actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ' + (action.primary ? 'btn--primary' : 'btn--ghost');
    btn.textContent = action.label;
    btn.addEventListener('click', () => dialog.close(action.value));
    footer.append(btn);
  }
  card.append(footer);
  dialog.append(card);
  document.body.append(dialog);

  if (!opts.dismissible) {
    dialog.addEventListener('cancel', (e) => e.preventDefault());
  } else {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close('');
    });
  }

  openDialog = dialog;
  dialog.showModal();
  card.querySelector<HTMLButtonElement>('.btn--primary')?.focus();

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      openDialog = null;
      dialog.remove();
      resolve(dialog.returnValue || null);
    });
  });
}
