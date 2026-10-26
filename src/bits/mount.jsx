import { createRoot } from 'react-dom/client';
import SplitText from './SplitText.jsx';
import ClickSpark from './ClickSpark.jsx';
import Galaxy from './Galaxy.jsx';
import './Galaxy.css';

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

// Hydrate a dashboard view heading with a real SplitText reveal.
export function splitViewHeading(name) {
  const el = document.querySelector(`#view-${name} .view-head h1`);
  if (!el) return false;
  return trySplit(el, { delay: 20, duration: 0.85, splitType: 'chars', textAlign: 'left' });
}

// Keep the live insight heading animated when its verdict text changes.
export function updateSplitHeading(el, text) {
  if (!el) return;
  if (!splitRoots.has(el)) {
    el.textContent = text;
    trySplit(el, { delay: 20, duration: 0.85, splitType: 'chars', textAlign: 'left' });
    return;
  }
  const root = splitRoots.get(el);
  try {
    root.render(<SplitText tag="span" trigger="load" delay={20} duration={0.85} splitType="chars" textAlign="left" text={text} />);
  } catch (error) {
    problems.push('split-update: ' + String(error?.message || error));
    splitRoots.delete(el);
    el.textContent = text;
  }
}

export function mountBits() {
  const flags = { galaxy: false, sparks: false };
  // 1. Galaxy starfield behind the landing scene (aria-hidden, non-interactive).
  try {
    const host = document.createElement('div');
    host.id = 'bits-galaxy';
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: 2, pointerEvents: 'none' });
    document.body.prepend(host);
    createRoot(host).render(
      <Galaxy
        density={0.55}
        speed={0.55}
        mouseInteraction={false}
        mouseRepulsion={false}
        twinkleIntensity={0.25}
        rotationSpeed={0.05}
        glowIntensity={0.2}
        saturation={0.15}
        starColors={['#ffffff', '#a3a3a3', '#4ade80']}
        transparent
        opacity={0.85}
        starSize={1}
        layers={4}
        intro={false}
      />
    );
    flags.galaxy = true;
  } catch (error) {
    problems.push('galaxy: ' + String(error?.message || error));
    document.getElementById('bits-galaxy')?.remove();
  }

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
