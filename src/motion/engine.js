import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis = null;
let pressBound = false;

function onPressDown(event) {
  const target = event.target instanceof Element
    ? event.target.closest('.dash-primary, .metric-card, .command-item, .seg button, .mobile-nav button')
    : null;
  if (!target) return;
  gsap.to(target, { scale: 0.97, duration: 0.12, ease: 'power2.out', overwrite: 'auto' });
}

function onPressUp() {
  gsap.to('.dash-primary, .metric-card, .command-item, .seg button, .mobile-nav button', {
    scale: 1, duration: 0.18, ease: 'power2.out', overwrite: 'auto', clearProps: 'transform'
  });
}

function buildScrollScenes() {
  // Parallax drift for the landing preview masks, driven by real page scroll.
  gsap.to('.slide-image-mask', {
    y: -46,
    ease: 'none',
    scrollTrigger: { trigger: document.body, start: 0, end: 'max', scrub: 0.6 }
  });
  // Gentle counter-drift on the hero title while the story scrolls.
  gsap.to('#title-1', {
    yPercent: -6,
    ease: 'none',
    scrollTrigger: { trigger: document.body, start: 0, end: 'max', scrub: 0.6 }
  });
}

export function initMotion() {
  const reduced = reduceMotion();
  const api = {
    reduced,
    gsap: true,
    lenis: false,
    status() {
      return {
        reduced: reduceMotion(),
        gsap: true,
        lenis: !!lenis,
        lenisRunning: !!lenis && !lenis.isStopped,
        triggers: ScrollTrigger.getAll().length
      };
    },
    // Coordinated entrance for a dashboard view's direct children.
    // Returns true when GSAP handled it (CSS fallback otherwise).
    onViewChange(name) {
      if (reduceMotion()) return false;
      const host = document.getElementById(`view-${name}`);
      if (!host) return false;
      const kids = host.querySelectorAll(':scope > *');
      if (!kids.length) return false;
      gsap.fromTo(kids,
        { y: 12, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out', stagger: 0.05, overwrite: 'auto', clearProps: 'transform,opacity,visibility' });
      if (name === 'budgets' || name === 'goals') {
        const bars = host.querySelectorAll('.bar i');
        if (bars.length) {
          gsap.fromTo(bars,
            { scaleX: 0 },
            { scaleX: 1, transformOrigin: '0 50%', duration: 0.6, ease: 'power3.out', stagger: 0.04, overwrite: 'auto', clearProps: 'transform', delay: 0.1 });
        }
      }
      return true;
    },
    dashboardOpen() {
      if (lenis) lenis.stop();
    },
    dashboardClose() {
      if (lenis) lenis.start();
    },
    destroy: destroyMotion
  };

  if (!reduced) {
    document.documentElement.classList.add('gsap-on');
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    api.lenis = true;
    buildScrollScenes();
    if (!pressBound) {
      pressBound = true;
      document.addEventListener('pointerdown', onPressDown);
      document.addEventListener('pointerup', onPressUp);
      document.addEventListener('pointercancel', onPressUp);
    }
  }
  return api;
}

export function destroyMotion() {
  try { ScrollTrigger.getAll().forEach(trigger => trigger.kill()); } catch {}
  if (pressBound) {
    pressBound = false;
    document.removeEventListener('pointerdown', onPressDown);
    document.removeEventListener('pointerup', onPressUp);
    document.removeEventListener('pointercancel', onPressUp);
  }
  if (lenis) {
    try { lenis.destroy(); } catch {}
    lenis = null;
  }
  document.documentElement.classList.remove('gsap-on');
}
