// Premium, self-contained feedback: corner toasts + a confirm modal.
// No provider/wiring needed — just import { toast, confirmDialog }.
// Uses the app's CSS variables so it matches light/dark automatically.

type ToastKind = 'success' | 'error' | 'info';

function container(): HTMLElement {
  let el = document.getElementById('bb-toasts');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bb-toasts';
    el.style.cssText =
      'position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:10px;max-width:min(360px,92vw);pointer-events:none';
    document.body.appendChild(el);
  }
  return el;
}

const ICONS: Record<ToastKind, string> = {
  success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
  error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 16v-5M12 8h.01"/><circle cx="12" cy="12" r="9"/></svg>',
};
const ACCENT: Record<ToastKind, string> = { success: 'var(--green)', error: 'var(--bad)', info: 'var(--gold)' };

export function toast(message: string, kind: ToastKind = 'success', ms = 3500) {
  const root = container();
  const card = document.createElement('div');
  card.style.cssText =
    `pointer-events:auto;display:flex;align-items:center;gap:11px;padding:13px 15px;border-radius:14px;` +
    `background:var(--surface);color:var(--ink);border:1px solid var(--line);` +
    `border-left:4px solid ${ACCENT[kind]};box-shadow:0 18px 40px -16px rgba(20,35,27,.35);` +
    `font-family:'Hanken Grotesk',system-ui,sans-serif;font-size:14px;font-weight:600;` +
    `transform:translateX(120%);transition:transform .28s cubic-bezier(.2,.9,.3,1),opacity .28s;opacity:0`;
  card.innerHTML =
    `<span style="color:${ACCENT[kind]};display:flex;flex:0 0 auto">${ICONS[kind]}</span><span style="flex:1">${message}</span>`;
  root.appendChild(card);
  requestAnimationFrame(() => { card.style.transform = 'translateX(0)'; card.style.opacity = '1'; });
  const close = () => { card.style.transform = 'translateX(120%)'; card.style.opacity = '0'; setTimeout(() => card.remove(), 300); };
  card.addEventListener('click', close);
  setTimeout(close, ms);
}

// Promise-based confirm modal (replaces window.confirm).
export function confirmDialog(opts: { title?: string; message: string; confirmText?: string; cancelText?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10000;background:rgba(8,16,11,.5);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .2s';
    const box = document.createElement('div');
    box.style.cssText =
      `width:100%;max-width:400px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:18px;` +
      `box-shadow:0 30px 70px -20px rgba(0,0,0,.5);padding:22px;font-family:'Hanken Grotesk',system-ui,sans-serif;` +
      `transform:scale(.96);transition:transform .2s`;
    const accent = opts.danger ? 'var(--bad)' : 'var(--green)';
    box.innerHTML =
      `${opts.title ? `<div style="font-family:'Baloo Da 2';font-weight:800;font-size:19px;margin-bottom:6px">${opts.title}</div>` : ''}` +
      `<div style="color:var(--muted);font-size:15px;line-height:1.5">${opts.message}</div>` +
      `<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">` +
      `<button id="bb-cancel" style="padding:10px 16px;border-radius:11px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-weight:600;cursor:pointer;font-family:inherit">${opts.cancelText || 'Cancel'}</button>` +
      `<button id="bb-ok" style="padding:10px 16px;border-radius:11px;border:none;background:${accent};color:#fff;font-weight:700;cursor:pointer;font-family:inherit">${opts.confirmText || 'Confirm'}</button>` +
      `</div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; box.style.transform = 'scale(1)'; });
    const done = (v: boolean) => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 200); resolve(v); };
    box.querySelector('#bb-ok')!.addEventListener('click', () => done(true));
    box.querySelector('#bb-cancel')!.addEventListener('click', () => done(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });
  });
}
