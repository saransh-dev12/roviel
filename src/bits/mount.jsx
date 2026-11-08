import { createRoot } from 'react-dom/client';
import SplitText from './SplitText.jsx';
import ClickSpark from './ClickSpark.jsx';

const splitRoots = new Map();
let sparkEngine = null;
const problems = [];

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function trySplit(el, props) {
  if (!el || splitRoots.has(el)) return false;
  try {
    const root = createRoot(el);
    root.render(<SplitText tag="span" trigger="load" {...props} text={el.textContent} />);
    splitRoots.set(el, root);
    return true;
  } catch (error) {
    problems.push('split: ' + String(error?.message || error));
    return false;
  }
}

// Reveal a dashboard view heading with one clean rise+fade (no per-char split).
export function splitViewHeading(name) {
  const el = document.querySelector(`#view-${name} .view-head h1`);
  if (!el) return false;
  el.classList.remove('view-title-in');
  void el.offsetWidth;
  el.classList.add('view-title-in');
  return true;
}

// Swap live heading text and re-run the same reveal.
export function updateSplitHeading(el, text) {
  if (!el) return;
  el.textContent = text;
  el.classList.remove('view-title-in');
  void el.offsetWidth;
  el.classList.add('view-title-in');
}

export function mountBits() {
  const flags = { sparks: false };
  // 1. The landing scene's WebGL canvas (created inline) is the background.

  // 2. ClickSpark engine layer; sparks are fired imperatively on real control presses.
  try {
    const host = document.createElement('div');
    host.id = 'bits-sparks';
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: 250, pointerEvents: 'none' });
    document.body.appendChild(host);
    createRoot(host).render(
      <ClickSpark
        ref={instance => { sparkEngine = instance; }}
        sparkColor={['#4ade80', '#ffffff']}
        sparkCount={6}
        sparkSize={10}
        sparkRadius={26}
        sparkWidth={2}
        duration={450}
        shape="line"
        style={{ position: 'fixed', inset: 0, width: 'auto', height: 'auto', pointerEvents: 'none' }}
      />
    );
    flags.sparks = true;
    if (!reduceMotion()) {
      document.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const target = event.target instanceof Element
          ? event.target.closest('.dash-primary, .dash-secondary, .dash-back, .seg button, .mobile-nav button, .contact-btn, .slide-cta, .command-item, .currency-actions button')
          : null;
        if (target && sparkEngine) {
          try { sparkEngine.spark(event.clientX, event.clientY); } catch {}
        }
      });
    }
  } catch (error) {
    problems.push('sparks: ' + String(error?.message || error));
    document.getElementById('bits-sparks')?.remove();
  }

  // 3. SplitText owns single-line headings only. The landing hero keeps its
  // line break, so it stays with the manual splitter (skipped via data-bits-split
  // only when a Bits root takes over; multi-line markup is never flattened).

  window.__bits = {
    ...flags,
    problems: () => [...problems],
    splitCount: () => splitRoots.size,
    sparkAt: (x, y) => sparkEngine?.spark(x, y)
  };
  return flags;
}
