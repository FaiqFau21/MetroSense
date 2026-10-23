// Accessible modal window: focus moves in on open and back on close, Tab stays
// inside, Esc and the backdrop close it.

import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

export function Modal({ title, eyebrow, badge, onClose, children, wide }) {
  const ref = useRef();
  useEffect(() => {
    const before = document.activeElement;
    ref.current?.querySelector('.modal-close')?.focus();
    return () => before?.focus?.();
  }, []);

  const onKeyDown = (ev) => {
    if (ev.key === 'Escape') { ev.stopPropagation(); onClose(); return; }
    if (ev.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  };

  return (
    <div className="modal-backdrop" onPointerDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div
        ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog" aria-modal="true" aria-labelledby="modal-title" onKeyDown={onKeyDown}
      >
        <header className="modal-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id="modal-title">{title}</h2>
            {badge}
          </div>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
