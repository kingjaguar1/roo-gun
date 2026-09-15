// Turns taps and clicks into (x, y) presses in CSS pixels.
// onGesture fires on every touch start/end so audio can unlock on iOS.
export function attachInput(canvas, { onPress, onGesture = () => {} }) {
  const toLocal = (ev) => {
    const rect = canvas.getBoundingClientRect();
    return [ev.clientX - rect.left, ev.clientY - rect.top];
  };

  canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    onGesture();
    const [x, y] = toLocal(ev);
    onPress(x, y);
  }, { passive: false });

  canvas.addEventListener('pointerup', () => onGesture());
  // Stop iOS from zooming, scrolling or showing the callout menu.
  canvas.addEventListener('touchstart', (ev) => ev.preventDefault(), { passive: false });
  canvas.addEventListener('touchend', (ev) => { ev.preventDefault(); onGesture(); }, { passive: false });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
}
