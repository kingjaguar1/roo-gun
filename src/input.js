// Turns taps and clicks into (x, y) presses in CSS pixels.
// Audio unlocking is not done here; `audio.listenForTaps()` watches the page.
export function attachInput(canvas, { onPress }) {
  const toLocal = (ev) => {
    const rect = canvas.getBoundingClientRect();
    return [ev.clientX - rect.left, ev.clientY - rect.top];
  };

  canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    const [x, y] = toLocal(ev);
    onPress(x, y);
  }, { passive: false });

  // Stop iOS from zooming, scrolling or showing the callout menu.
  canvas.addEventListener('touchstart', (ev) => ev.preventDefault(), { passive: false });
  canvas.addEventListener('touchend', (ev) => ev.preventDefault(), { passive: false });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
}
