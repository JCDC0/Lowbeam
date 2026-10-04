/**
 * HUD waypoint distance readout mounted under the minimap.
 * Displays remaining route distance (e.g. "420 M" or "3.5 KM") while a route is set,
 * and "ARRIVED" briefly upon arrival.
 */

export function routeHud(ui) {
  const el = document.createElement('div');
  el.className = 'route-hud';
  ui.appendChild(el);

  let arrivedTimer = 0;
  let wasArrived = false;

  return {
    el,
    /**
     * @param {import('./route.js').RouteTracker | null} tracker
     * @param {number} [dt]
     */
    update(tracker, dt = 1 / 60) {
      if (!tracker) {
        el.textContent = '';
        el.classList.remove('on', 'arrived');
        return;
      }

      if (tracker.arrived) {
        if (!wasArrived) {
          wasArrived = true;
          arrivedTimer = 3.0;
        }
      } else if (tracker.destination) {
        wasArrived = false;
        arrivedTimer = 0;
      }

      if (arrivedTimer > 0) {
        arrivedTimer -= dt;
        el.textContent = 'ARRIVED';
        el.classList.add('on', 'arrived');
        return;
      }

      if (tracker.route && tracker.destination) {
        const d = tracker.distance;
        const text = d >= 1000 ? `${(d / 1000).toFixed(1)} KM` : `${Math.round(d)} M`;
        el.textContent = text;
        el.classList.remove('arrived');
        el.classList.add('on');
      } else {
        el.textContent = '';
        el.classList.remove('on', 'arrived');
      }
    },
    /** @param {boolean} on */
    show(on) {
      el.style.display = on ? '' : 'none';
    },
  };
}
