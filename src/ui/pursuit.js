/**
 * Pursuit HUD (Need for Speed: Most Wanted 2005 style).
 * Shows heat marks, state banner, units / helicopter status,
 * evade/cooldown bar, bust bar, bounty, and pursuit duration.
 */

/**
 * @typedef {{
 *   state: 'pursuit' | 'evading' | 'cooldown' | 'busted' | 'escaped',
 *   heat: 1 | 2 | 3 | 4 | 5,
 *   evade: number,
 *   cooldown: number,
 *   bust: number,
 *   units: number,
 *   heli: boolean,
 *   bounty: number,
 *   time: number,
 * }} PursuitView
 *
 * @typedef {{
 *   kind: 'police' | 'heli',
 *   x: number,
 *   z: number,
 *   yaw: number,
 *   search?: { x: number, z: number, r: number },
 *   active?: boolean,
 *   sees?: boolean,
 * }} PoliceMarker
 * `active` is a unit in a pursuit (lights on); `sees` a patrol that sees the player and is filling
 * the detection bar.
 */

/**
 * Pure layout / data formatting helper for unit tests and rendering.
 * @param {PursuitView | null} view
 */
export function layoutPursuit(view) {
  if (!view) return null;
  const state = view.state || 'pursuit';
  const stateText = state.toUpperCase();
  const heat = Math.max(1, Math.min(5, view.heat || 1));
  const isCooldown = state === 'cooldown';
  const isTerminal = state === 'busted' || state === 'escaped';

  // Primary bar fill (0..1)
  const barType = isCooldown ? 'cooldown' : 'evade';
  const barFill = Math.max(0, Math.min(1, isCooldown ? view.cooldown : view.evade));

  // Bust bar fill (0..1)
  const bustFill = Math.max(0, Math.min(1, view.bust || 0));
  const showBust = bustFill > 0;

  // Formatted bounty and time
  const bountyText = `¥${(view.bounty || 0).toLocaleString('en-US')}`;
  const m = Math.floor((view.time || 0) / 60);
  const s = Math.floor((view.time || 0) % 60);
  const timeText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return {
    state,
    stateText,
    heat,
    barType,
    barFill,
    bustFill,
    showBust,
    units: view.units || 0,
    heli: !!view.heli,
    bountyText,
    timeText,
    isTerminal,
  };
}

/**
 * Mounts the Pursuit HUD into parent container.
 * @param {HTMLElement} parent
 * @returns {{ update: (view: PursuitView | null, dt: number) => void, el: HTMLElement }}
 */
export function pursuitHud(parent) {
  const el = document.createElement('div');
  el.id = 'pursuit-hud';
  el.className = 'pursuit-hud display';
  el.style.display = 'none';

  el.innerHTML = `
    <div class="pursuit-top">
      <div class="pursuit-heat">
        <span class="heat-mark" data-h="1"></span>
        <span class="heat-mark" data-h="2"></span>
        <span class="heat-mark" data-h="3"></span>
        <span class="heat-mark" data-h="4"></span>
        <span class="heat-mark" data-h="5"></span>
      </div>
      <div class="pursuit-status">
        <span class="pursuit-units"></span>
        <span class="pursuit-heli"></span>
      </div>
    </div>
    <div class="pursuit-banner"></div>
    <div class="pursuit-bars">
      <div class="pursuit-bar main-bar">
        <div class="bar-fill"></div>
      </div>
      <div class="pursuit-bar bust-bar" style="display: none;">
        <div class="bar-fill"></div>
      </div>
    </div>
    <div class="pursuit-footer">
      <span class="pursuit-bounty"></span>
      <span class="pursuit-time"></span>
    </div>
  `;

  parent.appendChild(el);

  const q = (sel) => /** @type {HTMLElement} */ (el.querySelector(sel));
  const heatMarks = Array.from(el.querySelectorAll('.heat-mark'));
  const bannerEl = q('.pursuit-banner');
  const unitsEl = q('.pursuit-units');
  const heliEl = q('.pursuit-heli');
  const mainBar = q('.main-bar');
  const mainFill = q('.main-bar .bar-fill');
  const bustBar = q('.bust-bar');
  const bustFill = q('.bust-bar .bar-fill');
  const bountyEl = q('.pursuit-bounty');
  const timeEl = q('.pursuit-time');

  let terminalTimer = 0;
  let lastState = '';

  /**
   * @param {PursuitView | null} view
   * @param {number} dt
   */
  function update(view, dt) {
    if (!view) {
      if (terminalTimer > 0) {
        terminalTimer -= dt;
        if (terminalTimer <= 0) {
          el.style.display = 'none';
          el.classList.remove('fading');
        } else if (terminalTimer < 0.8) {
          el.classList.add('fading');
        }
      } else {
        el.style.display = 'none';
        el.classList.remove('fading');
      }
      return;
    }

    const layout = layoutPursuit(view);
    if (!layout) return;

    el.style.display = 'flex';
    el.classList.remove('fading');

    if (layout.isTerminal) {
      if (lastState !== layout.state) {
        terminalTimer = 3.0;
      } else if (terminalTimer > 0) {
        terminalTimer -= dt;
        if (terminalTimer < 0.8) {
          el.classList.add('fading');
        }
      }
    } else {
      terminalTimer = 0;
    }
    lastState = layout.state;

    // Heat marks
    for (let i = 0; i < 5; i++) {
      heatMarks[i].classList.toggle('active', i < layout.heat);
    }

    // Units & Heli
    unitsEl.textContent = layout.units > 0 ? `X${layout.units}` : '';
    heliEl.style.display = layout.heli ? 'inline-block' : 'none';
    heliEl.textContent = layout.heli ? 'AIR' : '';

    // Banner
    bannerEl.textContent = layout.stateText;
    bannerEl.setAttribute('data-state', layout.state);

    // Main bar (evade or cooldown)
    mainBar.setAttribute('data-mode', layout.barType);
    mainFill.style.width = `${(layout.barFill * 100).toFixed(1)}%`;

    // Bust bar
    bustBar.style.display = layout.showBust ? 'block' : 'none';
    if (layout.showBust) {
      bustFill.style.width = `${(layout.bustFill * 100).toFixed(1)}%`;
    }

    // Footer
    bountyEl.textContent = `BOUNTY ${layout.bountyText}`;
    timeEl.textContent = layout.timeText;
  }

  return { update, el };
}
