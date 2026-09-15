import { CONFIG } from './config.js';
import { clamp } from './math.js';

// Screen size in CSS pixels, device pixel ratio, a size multiplier relative
// to a reference phone, and the notch/home-bar safe-area insets.
export function createView(canvas) {
  const probe = document.getElementById('safe-area');
  const view = { w: 0, h: 0, dpr: 1, scale: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 } };

  function resize() {
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    const { w, h, minScale, maxScale } = CONFIG.reference;
    view.scale = clamp(Math.min(view.w / w, view.h / h), minScale, maxScale);
    if (probe) {
      const cs = getComputedStyle(probe);
      view.safe.top = parseFloat(cs.paddingTop) || 0;
      view.safe.right = parseFloat(cs.paddingRight) || 0;
      view.safe.bottom = parseFloat(cs.paddingBottom) || 0;
      view.safe.left = parseFloat(cs.paddingLeft) || 0;
    }
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  resize();
  return view;
}
