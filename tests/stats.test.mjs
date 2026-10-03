import { test } from 'node:test';
import assert from 'node:assert/strict';

test('stats overlay creates corner readout and toggles on F3', async () => {
  const { statsOverlay, formatStats } = await import('../src/ui/stats.js');

  const formatted = formatStats(59.8, 128, 154200, 38);
  assert.ok(formatted.includes('60'), 'includes rounded fps');
  assert.ok(formatted.includes('128'), 'includes draw calls');
  assert.ok(formatted.includes('154'), 'includes triangles');
  assert.ok(formatted.includes('38'), 'includes traffic agent count');

  let appended = null;
  const mockParent = {
    appendChild(el) {
      appended = el;
    },
  };

  const renderer = {
    info: {
      render: { calls: 95, triangles: 82000 },
    },
  };

  const listeners = new Map();
  const mockWindow = {
    addEventListener(event, fn) {
      listeners.set(event, fn);
    },
    removeEventListener(event, fn) {
      listeners.delete(event);
    },
  };

  const overlay = statsOverlay(mockParent, { renderer }, () => 24, { window: mockWindow });
  assert.ok(appended, 'overlay element appended to parent');
  assert.equal(overlay.visible, false, 'hidden by default');

  overlay.toggle();
  assert.equal(overlay.visible, true, 'toggled on');

  overlay.update(60, 95, 82000, 24);
  assert.ok(overlay.el.textContent.includes('95'));
  assert.ok(overlay.el.textContent.includes('24'));

  const keyHandler = listeners.get('keydown');
  assert.ok(keyHandler, 'registers keydown listener');
  let prevented = false;
  keyHandler({ key: 'F3', preventDefault: () => { prevented = true; } });
  assert.ok(prevented, 'F3 default prevented');
  assert.equal(overlay.visible, false, 'F3 toggles overlay off');
});
