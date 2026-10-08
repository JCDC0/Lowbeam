/**
 * The pursuit HUD, after Need for Speed: Most Wanted (2005): one panel at the bottom center of the
 * screen. The heat as five marks and the pursuit's time; the bounty, counting up; the evade and
 * busted meter, split from the middle (green to the left as the police lose sight, red to the right
 * as they box the player in), a blue cooldown bar while they search; then the units on the scene,
 * the units in sight, the units taken out, and a helicopter for each one up. Before a pursuit, while
 * a patrol watches, only the detection bar shows. At the end the result card, then nothing: the
 * panel never fades or pulses, and leaves at once when the pursuit or the drive screen does.
 * Every word and number is in Michroma (`--font-display`).
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
 *   helis?: number,
 *   nearby?: number,
 *   disabled?: number,
 *   report?: { fine?: number } | null,
 * }} PursuitView
 * `units` are the units on the scene (in the pursuit), `nearby` those that see the player now,
 * `disabled` those taken out, `helis` the helicopters up.
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
 * `active` is a unit in a pursuit (lights on); `sees` a unit that sees the player (a patrol filling
 * the detection bar, or a pursuing unit with the player in sight).
 */

const yen = (n) => `¥${Math.round(n || 0).toLocaleString('en-US')}`;

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

  const bountyText = yen(view.bounty);
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
    helis: Math.max(0, Math.min(3, view.helis ?? (view.heli ? 1 : 0))),
    nearby: view.nearby || 0,
    destroyed: view.disabled || 0,
    bountyText,
    fineText: yen(view.report?.fine || 0),
    timeText,
    isTerminal,
  };
}

const HELI_ICON = '<svg viewBox="0 0 24 14" aria-hidden="true"><path d="M2 2h20M12 2v3"/><path d="M6 7c0-1.5 2-2.5 6-2.5s6 1 6 3.5-2 3-6 3H8z"/><path d="M18 7.5h5M22 6v3M9 11.5v2M14 11.5v2M7 13.5h9"/></svg>';
const CAR_ICON = '<svg viewBox="0 0 24 12" aria-hidden="true"><path d="M2 9V6l3-1 3-3h7l4 3 3 1v3z"/><circle cx="7" cy="9.5" r="1.8"/><circle cx="17" cy="9.5" r="1.8"/></svg>';

/**
 * Mounts the pursuit HUD into `parent`.
 * @param {HTMLElement} parent
 * @returns {{ update: (view: PursuitView | null, dt: number, detect?: { level: number } | null) => void, el: HTMLElement }}
 */
export function pursuitHud(parent) {
  const el = document.createElement('div');
  el.id = 'pursuit-hud';
  el.style.display = 'none';
  el.innerHTML = `
    <div class="ph-detect">
      <span class="ph-label">DETECTION</span>
      <div class="ph-track"><div class="ph-detect-fill"></div></div>
    </div>
    <div class="ph-panel">
      <div class="ph-row ph-head">
        <div class="ph-heat"><span class="ph-label">HEAT</span>${'<i></i>'.repeat(5)}</div>
        <div class="ph-time"></div>
      </div>
      <div class="ph-bounty"><span class="ph-label">BOUNTY</span><b></b></div>
      <div class="ph-meter">
        <span class="ph-side ph-evade-label">EVADE</span>
        <div class="ph-track ph-split">
          <div class="ph-evade"></div><div class="ph-busted"></div><div class="ph-cool"></div><div class="ph-mid"></div>
        </div>
        <span class="ph-side ph-busted-label">BUSTED</span>
      </div>
      <div class="ph-row ph-stats">
        <span class="ph-stat">${CAR_ICON}<em class="ph-scene"></em><small>ON SCENE</small></span>
        <span class="ph-stat"><em class="ph-near"></em><small>IN SIGHT</small></span>
        <span class="ph-stat ph-kills"><em class="ph-out"></em><small>TAKEN OUT</small></span>
        <span class="ph-helis"></span>
      </div>
      <div class="ph-result"><b></b><span></span></div>
    </div>
  `;
  parent.appendChild(el);

  const q = (sel) => /** @type {HTMLElement} */ (el.querySelector(sel));
  const detectEl = q('.ph-detect');
  const detectFill = q('.ph-detect-fill');
  const panel = q('.ph-panel');
  const heatMarks = Array.from(el.querySelectorAll('.ph-heat i'));
  const timeEl = q('.ph-time');
  const bountyEl = q('.ph-bounty b');
  const evadeEl = q('.ph-evade');
  const bustedEl = q('.ph-busted');
  const coolEl = q('.ph-cool');
  const meterEl = q('.ph-meter');
  const evadeLabel = q('.ph-evade-label');
  const sceneEl = q('.ph-scene');
  const nearEl = q('.ph-near');
  const outEl = q('.ph-out');
  const helisEl = q('.ph-helis');
  const resultEl = q('.ph-result');
  const resultHead = q('.ph-result b');
  const resultLine = q('.ph-result span');

  let shownBounty = 0;
  let helisShown = -1;

  /**
   * @param {PursuitView | null} view the pursuit, or null when there is none (or the screen is not the drive)
   * @param {number} dt
   * @param {{ level: number } | null} [detect] the detection bar before a pursuit
   */
  function update(view, dt, detect = null) {
    const layout = layoutPursuit(view);
    if (!layout) {
      shownBounty = 0;
      const level = detect?.level || 0;
      el.style.display = level > 0.01 ? 'block' : 'none';
      panel.style.display = 'none';
      detectEl.style.display = level > 0.01 ? 'flex' : 'none';
      detectFill.style.width = `${(level * 100).toFixed(1)}%`;
      detectEl.classList.toggle('hot', level > 0.66);
      return;
    }
    el.style.display = 'block';
    detectEl.style.display = 'none';
    panel.style.display = 'block';
    panel.dataset.state = layout.state;

    for (let i = 0; i < 5; i++) heatMarks[i].classList.toggle('on', i < layout.heat);
    timeEl.textContent = layout.timeText;

    // The bounty counts up to what it is worth now, fast enough to keep up with a destroyed Rhino.
    const target = view?.bounty || 0;
    shownBounty = dt > 0 ? shownBounty + (target - shownBounty) * Math.min(1, dt * 5) : target;
    if (Math.abs(target - shownBounty) < 1) shownBounty = target;
    bountyEl.textContent = yen(shownBounty);

    const cooldown = layout.barType === 'cooldown';
    meterEl.classList.toggle('cooling', cooldown);
    evadeLabel.textContent = cooldown ? 'COOLDOWN' : 'EVADE';
    // On the end card the meter has nothing left to say, and the panel stays short under the prompt.
    meterEl.style.display = layout.isTerminal ? 'none' : 'flex';
    evadeEl.style.width = cooldown ? '0' : `${(layout.barFill * 50).toFixed(1)}%`;
    bustedEl.style.width = cooldown ? '0' : `${(layout.bustFill * 50).toFixed(1)}%`;
    coolEl.style.width = cooldown ? `${(layout.barFill * 100).toFixed(1)}%` : '0';

    sceneEl.textContent = String(layout.units);
    nearEl.textContent = String(layout.nearby);
    outEl.textContent = String(layout.destroyed);
    if (layout.helis !== helisShown) {
      helisShown = layout.helis;
      helisEl.innerHTML = HELI_ICON.repeat(layout.helis);
    }

    resultEl.style.display = layout.isTerminal ? 'flex' : 'none';
    if (layout.isTerminal) {
      resultHead.textContent = layout.stateText;
      resultLine.textContent = layout.state === 'busted' ? `FINE ${layout.fineText}` : `BOUNTY ${layout.bountyText}`;
    }
  }

  return { update, el };
}
