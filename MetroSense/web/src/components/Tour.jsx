// Step-by-step guided tour: dims the screen, spotlights one element per step
// and shows a card next to it. Back / Next / Skip, arrow keys and Esc work; the
// "show at sign-in" choice is the user's. No dependency: positions come from
// getBoundingClientRect and are re-measured while the tour is open.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const PAD = 8; // space between the element and the spotlight edge
const GAP = 14; // space between the spotlight and the card
const EDGE = 12; // minimum distance from the window edge

function measure(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

// Where the card goes: below, above, right or left of the spotlight, whichever
// fits; otherwise centred. Always kept inside the window.
function place(spot, card, vw, vh) {
  if (!spot) return { top: (vh - card.h) / 2, left: (vw - card.w) / 2 };
  const clampX = (x) => Math.min(Math.max(EDGE, x), vw - card.w - EDGE);
  const clampY = (y) => Math.min(Math.max(EDGE, y), vh - card.h - EDGE);
  const cx = spot.left + spot.width / 2 - card.w / 2;
  const cy = spot.top + spot.height / 2 - card.h / 2;
  if (spot.top + spot.height + GAP + card.h <= vh - EDGE) return { top: spot.top + spot.height + GAP, left: clampX(cx) };
  if (spot.top - GAP - card.h >= EDGE) return { top: spot.top - GAP - card.h, left: clampX(cx) };
  if (spot.left + spot.width + GAP + card.w <= vw - EDGE) return { top: clampY(cy), left: spot.left + spot.width + GAP };
  if (spot.left - GAP - card.w >= EDGE) return { top: clampY(cy), left: spot.left - GAP - card.w };
  // Big targets (the map, the side panel): sit the card inside, near the bottom.
  return { top: clampY(spot.top + spot.height - card.h - GAP * 2), left: clampX(cx) };
}

export function Tour({ steps, showAtLogin, onShowAtLoginChange, onStep, onClose }) {
  const [i, setI] = useState(0);
  const [spot, setSpot] = useState(null);
  const [pos, setPos] = useState(null);
  const cardRef = useRef();
  const nextRef = useRef();
  const step = steps[i];
  const last = i === steps.length - 1;

  // Let the app prepare the screen for this step (for example, open a tab),
  // then bring the target into view.
  useEffect(() => {
    onStep?.(step);
    const el = step.target && document.querySelector(step.target);
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    nextRef.current?.focus();
  }, [i]);

  // Re-measure while open: panels change size, the window resizes, phones scroll.
  useLayoutEffect(() => {
    const update = () => {
      const s = measure(step.target);
      setSpot((prev) => (JSON.stringify(prev) === JSON.stringify(s) ? prev : s));
      const card = cardRef.current?.getBoundingClientRect();
      if (card) {
        const p = place(s, { w: card.width, h: card.height }, window.innerWidth, window.innerHeight);
        setPos((prev) => (prev && Math.abs(prev.top - p.top) < 0.5 && Math.abs(prev.left - p.left) < 0.5 ? prev : p));
      }
    };
    update();
    const timer = setInterval(update, 200);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { clearInterval(timer); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [step]);

  const go = (d) => setI((n) => Math.min(Math.max(0, n + d), steps.length - 1));

  const onKeyDown = (ev) => {
    if (ev.key === 'Escape') { ev.stopPropagation(); onClose(); }
    else if (ev.key === 'ArrowRight' && !last) go(1);
    else if (ev.key === 'ArrowLeft' && i > 0) go(-1);
    else if (ev.key === 'Tab') {
      const items = [...cardRef.current.querySelectorAll('button, input')];
      const a = items[0], z = items[items.length - 1];
      if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); z.focus(); }
      else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus(); }
    }
  };

  return (
    <div className="tour" onKeyDown={onKeyDown}>
      {/* Blocks clicks on the page while the tour is open */}
      <div className={`tour-shade ${spot ? '' : 'is-dim'}`} />
      {spot && <div className="tour-spot" style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }} />}
      <section
        ref={cardRef} className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body"
        style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
      >
        <div className="tour-progress" aria-hidden="true">
          {steps.map((s, n) => <i key={s.id} className={n === i ? 'is-on' : n < i ? 'is-done' : ''} />)}
        </div>
        <p className="tour-count">Step {i + 1} of {steps.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-body" aria-live="polite">{step.body}</p>
        {(i === 0 || last) && (
          <label className="tour-pref">
            <input type="checkbox" checked={showAtLogin} onChange={(ev) => onShowAtLoginChange(ev.target.checked)} />
            Show this tour every time I sign in
          </label>
        )}
        <div className="tour-actions">
          {!last && <button type="button" className="link-btn tour-skip" onClick={onClose}>{i === 0 ? 'Skip for now' : 'Skip tour'}</button>}
          <span className="tour-nav">
            {i > 0 && <button type="button" className="btn btn-quiet btn-small" onClick={() => go(-1)}>Back</button>}
            <button ref={nextRef} type="button" className="btn btn-small" onClick={() => (last ? onClose() : go(1))}>
              {i === 0 ? 'Start the tour' : last ? 'Finish' : 'Next'}
            </button>
          </span>
        </div>
      </section>
    </div>
  );
}
