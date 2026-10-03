/**
 * Performance and scene stats overlay (F3 toggle).
 * Displays FPS, draw calls, rendered triangles, and live traffic agent count.
 */

/**
 * Formats render and scene stats into text.
 * @param {number} fps
 * @param {number} calls
 * @param {number} triangles
 * @param {number} traffic
 */
export function formatStats(fps, calls, triangles, traffic) {
  const triStr = triangles >= 1000 ? `${(triangles / 1000).toFixed(1)}k` : `${triangles}`;
  return `FPS: ${Math.round(fps)}\nCALLS: ${calls}\nTRIS: ${triStr}\nTRAFFIC: ${traffic}`;
}

/**
 * @param {HTMLElement} parent
 * @param {{ renderer?: { info?: { render?: { calls?: number, triangles?: number } } } }} stage
 * @param {() => number} [getTrafficCount]
 * @param {{ window?: any }} [opts]
 */
export function statsOverlay(parent, stage, getTrafficCount = () => 0, opts = {}) {
  const win = opts.window || (typeof window !== 'undefined' ? window : null);
  const doc = (parent && parent.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  const el = doc ? doc.createElement('div') : /** @type {HTMLElement} */ (/** @type {any} */ ({ style: {}, textContent: '' }));
  el.style.cssText = [
    'position: fixed',
    'left: 8px',
    'top: 8px',
    'background: rgba(4, 6, 12, 0.85)',
    'color: #e9edf2',
    'font-family: monospace',
    'font-size: 11px',
    'line-height: 1.4',
    'padding: 4px 8px',
    'border: 1px solid rgba(255, 180, 60, 0.4)',
    'border-radius: 2px',
    'pointer-events: none',
    'white-space: pre',
    'z-index: 1000',
    'display: none',
  ].join('; ');

  if (parent && typeof parent.appendChild === 'function') {
    parent.appendChild(el);
  }

  let visible = false;
  let lastTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let frames = 0;
  let currentFps = 60;

  function toggle() {
    visible = !visible;
    el.style.display = visible ? 'block' : 'none';
  }

  /**
   * @param {number} fps
   * @param {number} calls
   * @param {number} triangles
   * @param {number} traffic
   */
  function update(fps, calls, triangles, traffic) {
    el.textContent = formatStats(fps, calls, triangles, traffic);
  }

  function tick() {
    if (visible) {
      frames++;
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const elapsed = now - lastTime;
      if (elapsed >= 250) {
        currentFps = (frames * 1000) / elapsed;
        frames = 0;
        lastTime = now;
      }
      const renderInfo = stage?.renderer?.info?.render;
      const calls = renderInfo?.calls ?? 0;
      const triangles = renderInfo?.triangles ?? 0;
      const traffic = getTrafficCount();
      update(currentFps, calls, triangles, traffic);
    }
    if (win && typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(tick);
    }
  }

  if (win && typeof win.addEventListener === 'function') {
    win.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        toggle();
      }
    });
    if (typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(tick);
    }
  }

  return {
    el,
    get visible() {
      return visible;
    },
    toggle,
    update,
  };
}
