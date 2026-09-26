import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './Icons';

let openCount = 0;
function useModalBehavior(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    openCount++;
    document.body.style.overflow = 'hidden';
    const el = ref.current;
    const focusable = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el;
    focusable?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openCount--;
      if (openCount <= 0) document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

export function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const ref = useModalBehavior(onClose);
  const id = useId();
  return createPortal(
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
        <div className="grabber" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id={id}>
            {title}
            {subtitle && <div className="sub">{subtitle}</div>}
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Dialog({ title, children, onClose, role = 'dialog' }: { title: string; children: ReactNode; onClose: () => void; role?: 'dialog' | 'alertdialog' }) {
  const ref = useModalBehavior(onClose);
  const id = useId();
  return createPortal(
    <div className="scrim center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role={role} aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
        <h2 id={id}>{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({
  title, body, confirmLabel, cancelLabel = 'Cancel', danger, onConfirm, onCancel,
}: { title: string; body: ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog title={title} onClose={onCancel} role="alertdialog">
      <p>{body}</p>
      <div className="actions">
        <button className={`btn btn-block ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        <button className="btn btn-block btn-secondary" onClick={onCancel} data-autofocus>{cancelLabel}</button>
      </div>
    </Dialog>
  );
}
