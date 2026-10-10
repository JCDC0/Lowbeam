/**
 * The pursuit HUD, after Need for Speed: Most Wanted (2005), Jc's sketches and (as Jc drew it) Need for
 * Speed Unbound's. Two groups.
 *
 * At the top of the screen: while the police resupply, the reinforcements' timer bar, which closes toward
 * the middle as the clock runs down, the clock under it (seconds and hundredths) and REINFORCEMENTS
 * ARRIVING; and under those, always, the row of the units on the scene by kind (a cruiser, an unmarked
 * car, an interceptor, a Rhino, the helicopters), each icon over its count. When the clock reaches 0 the
 * bar, the clock and the label fade out and the cars are added under their symbols, leaving only the
 * active icons and their integers. A helicopter that needs fuel gets a yellow gas symbol beside it, which
 * turns red as it retreats.
 *
 * At the bottom center, the board: the heat as five marks, the bounty counting up and the pursuit's
 * time; the units on the scene, assigned (the pool reinforcements come from) and destroyed, each a
 * number over an icon instead of a word; and along the bottom the evade and busted meter, split from
 * the middle (green to the left as the police lose sight, red to the right as they box the player in), a
 * blue cooldown bar while they search. Before a pursuit, while a patrol watches, only the detection bar
 * shows. At the end the result card, then nothing. Words are in Michroma (`--font-display`); the unit
 * counts and the clock are in the Japanese face (`--font-jp`) and never zero-padded (0, not 00).
 *
 * The icon row is a centered row that grows and shrinks: each icon fades in, and the row re-centers, the
 * first time a unit of its kind is in the player's sight (`seen`); it shows its live count, which pops
 * when reinforcements are added; when a unit of the kind is destroyed its icon plays a short fading
 * glitch and the DESTROYED tally rises; and when the kind has no units left the icon rests at 0 for a
 * moment, fades out and the row closes up over the space. The board never fades or pulses.
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
 *   byKind?: Record<string, number>,
 *   assigned?: number | null,
 *   reinforcements?: boolean,
 *   seen?: string[],
 *   resupply?: number | null,
 *   heliFuel?: 'low' | 'leaving' | null,
 * }} PursuitView
 * `units` are the units on the scene (in the pursuit), `nearby` those that see the player now,
 * `disabled` those taken out, `helis` the helicopters up, `byKind` the units on the scene by kind
 * id, `assigned` the units the pursuit still has to send (null until the director keeps the pool),
 * `reinforcements` true while reinforcements are arriving, `seen` the kind ids (and `'heli'`) the
 * player has had in sight in this pursuit (absent on an old view: a kind counts as seen while it has
 * units), `resupply` the seconds left before the next cars are dispatched (null when no clock runs),
 * `heliFuel` 'low' while a helicopter needs to refuel and 'leaving' once it breaks off to do it.
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

/** The unit kinds in the row over the panel, in the sketch's order. */
export const KIND_ROW = ['police', 'police-fast', 'police-int', 'police-heavy'];
/** The seconds a resupply takes (B5: `RESUPPLY_TIME`), the full length of the reinforcements' bar. */
export const RESUPPLY_SECONDS = 60;
/** Seconds the bar, the clock and the label take to fade out once the clock has run out. */
export const RESUPPLY_FADE = 0.9;
/** Seconds an icon rests at 0 (the glitch plays out) before it fades out of the row. */
export const LEAVE_DELAY = 0.9;

/**
 * One step of an icon's life in the row: it comes in when its kind has been seen and has units, stays
 * while it has units, rests `LEAVE_DELAY` seconds at 0 and then leaves; a kind that comes back with
 * units comes back in.
 * @param {{ in: boolean, zero: number }} state @param {boolean} seen @param {number} n @param {number} dt
 * @returns {{ in: boolean, zero: number }}
 */
export function iconStep(state, seen, n, dt) {
  if (n > 0) return { in: state.in || seen, zero: 0 };
  if (!state.in) return { in: false, zero: 0 };
  const zero = state.zero + dt;
  return zero >= LEAVE_DELAY ? { in: false, zero: 0 } : { in: true, zero };
}

/** The resupply clock as seconds and hundredths, 60:00 down to 00:00. @param {number} left */
export function clockText(left) {
  const cs = Math.min(9999, Math.floor(Math.max(0, left) * 100 + 1e-6));
  return `${String(Math.floor(cs / 100)).padStart(2, '0')}:${String(cs % 100).padStart(2, '0')}`;
}

/**
 * The kinds whose icon should glitch between two layouts: units were destroyed (the tally rose) and
 * the kind's count fell. A unit that merely went home does not glitch.
 * @param {{ destroyed: number, kinds: { kind: string, n: number }[] } | null} prev
 * @param {{ destroyed: number, kinds: { kind: string, n: number }[] } | null} next
 * @returns {string[]}
 */
export function lostKinds(prev, next) {
  if (!prev || !next || next.destroyed <= prev.destroyed) return [];
  return next.kinds.filter((k, i) => k.n < (prev.kinds[i]?.n ?? 0)).map((k) => k.kind);
}

/**
 * The icons whose count rose between two layouts (reinforcements added under their symbols), by kind
 * id and `'heli'`.
 * @param {{ kinds: { kind: string, n: number }[], helis: number } | null} prev
 * @param {{ kinds: { kind: string, n: number }[], helis: number } | null} next
 * @returns {string[]}
 */
export function risenKinds(prev, next) {
  if (!prev || !next) return [];
  const out = next.kinds.filter((k, i) => k.n > (prev.kinds[i]?.n ?? 0)).map((k) => k.kind);
  if (next.helis > prev.helis) out.push('heli');
  return out;
}

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
    destroyedText: String(Math.min(99, view.disabled || 0)),
    kinds: KIND_ROW.map((kind) => {
      const n = Math.max(0, view.byKind?.[kind] ?? 0);
      return { kind, n, seen: view.seen ? view.seen.includes(kind) : n > 0 };
    }),
    heliSeen: view.seen ? view.seen.includes('heli') : (view.helis ?? (view.heli ? 1 : 0)) > 0,
    resupply: typeof view.resupply === 'number' ? { left: view.resupply, fill: Math.max(0, Math.min(1, view.resupply / RESUPPLY_SECONDS)), text: clockText(view.resupply) } : null,
    fuel: view.heliFuel === 'low' || view.heliFuel === 'leaving' ? view.heliFuel : null,
    assignedText: view.assigned == null ? '--' : String(Math.max(0, Math.round(view.assigned))),
    reinforcements: !!view.reinforcements,
    bountyText,
    fineText: yen(view.report?.fine || 0),
    timeText,
    isTerminal,
  };
}

const HELI_ICON = '<svg viewBox="0 0 24 14" aria-hidden="true"><path d="M2 2h20M12 2v3"/><path d="M6 7c0-1.5 2-2.5 6-2.5s6 1 6 3.5-2 3-6 3H8z"/><path d="M18 7.5h5M22 6v3M9 11.5v2M14 11.5v2M7 13.5h9"/></svg>';
/** A gas pump: yellow beside a helicopter that needs fuel, red when it breaks off to refuel. */
const FUEL_ICON = '<svg viewBox="0 0 16 18" aria-hidden="true"><path d="M2 17V3a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 11 3v14M1 17h11M4 4.5h5v4H4zM11 6l2.5 1.5v5a1.2 1.2 0 0 0 2.4 0V6L13.5 3.5"/></svg>';
/** The four unit kinds as small side views: the bar on the roof is what tells them apart. */
const KIND_ICONS = {
  police: '<svg viewBox="0 0 28 14" aria-hidden="true"><path class="b" d="M11 2.2h3v1.4h-3z"/><path class="r" d="M14 2.2h3v1.4h-3z"/><path d="M2 11V8l4-1 3-3.4h9l4 3.4 4 1v3z"/><circle cx="8" cy="11.4" r="2"/><circle cx="20" cy="11.4" r="2"/></svg>',
  'police-fast': '<svg viewBox="0 0 28 14" aria-hidden="true"><path d="M2 11V8l4-1 3-3.4h9l4 3.4 4 1v3z"/><path class="r" d="M23 8h2v1.2h-2z"/><circle cx="8" cy="11.4" r="2"/><circle cx="20" cy="11.4" r="2"/></svg>',
  'police-int': '<svg viewBox="0 0 28 14" aria-hidden="true"><path class="b" d="M12 3.6h2.4v1.2H12z"/><path class="r" d="M14.4 3.6h2.4v1.2h-2.4z"/><path d="M1.5 11.2V9.4l5-1.6 4-3h7l5.5 3 3.5 1v2.4z"/><circle cx="7.5" cy="11.5" r="1.9"/><circle cx="21" cy="11.5" r="1.9"/></svg>',
  'police-heavy': '<svg viewBox="0 0 28 14" aria-hidden="true"><path class="b" d="M10 0.8h3.5v1.4H10z"/><path class="r" d="M13.5 0.8H17v1.4h-3.5z"/><path d="M2 11.4V6.5l3-0.5 2-3.6h13l3 3.6 3 0.5v4.9z"/><circle cx="8" cy="11.6" r="2.2"/><circle cx="20" cy="11.6" r="2.2"/></svg>',
};
/** The board's three tallies are drawn, not spelled: a cop car with its bar flashing, a car with the drop-in arrow over it, a crashed car crossed out. */
const TALLY_ICONS = {
  scene: '<svg viewBox="0 0 32 20" aria-hidden="true"><path class="b" d="M12 3.2h4v2h-4z"/><path class="r" d="M16 3.2h4v2h-4z"/><path class="ray b" d="M10 3 7.5 0.8"/><path class="ray r" d="M22 3l2.5-2.2"/><path d="M3 17v-4l5-1.5 3.5-4.5h9l4 4.5 4.5 1.5v4z"/><circle cx="9.5" cy="17.4" r="2.3"/><circle cx="22.5" cy="17.4" r="2.3"/></svg>',
  assigned: '<svg viewBox="0 0 32 20" aria-hidden="true"><path class="a" d="M11 0.6h10L16 6.4z"/><path d="M3 18v-3.4l5-1.3 3.5-3.7h9l4 3.7 4.5 1.3V18z"/><circle cx="9.5" cy="18" r="2" /><circle cx="22.5" cy="18" r="2"/></svg>',
  destroyed: '<svg viewBox="0 0 32 20" aria-hidden="true"><g class="wreck"><path d="M3 17v-4l5-1.5 3.5-4.5h9l4 4.5 4.5 1.5v4z"/><circle cx="9.5" cy="17.4" r="2.3"/><circle cx="22.5" cy="17.4" r="2.3"/></g><path class="x" d="M9 2.5l14 12M23 2.5L9 14.5"/></svg>',
};

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
    <div class="ph-top">
      <div class="ph-resupply">
        <div class="ph-rs-bar"><i></i></div>
        <div class="ph-rs-time"></div>
        <div class="ph-rs-label">REINFORCEMENTS ARRIVING</div>
      </div>
      <div class="ph-kinds">${KIND_ROW.map((k) => `<span class="ph-kind" data-kind="${k}">${KIND_ICONS[k]}<em>0</em></span>`).join('')}<span class="ph-kind ph-heli-count">${HELI_ICON}<span class="ph-fuel">${FUEL_ICON}</span><em>0</em></span></div>
    </div>
    <div class="ph-bottom">
      <div class="ph-detect">
        <span class="ph-label">DETECTION</span>
        <div class="ph-track"><div class="ph-detect-fill"></div></div>
      </div>
      <div class="ph-panel">
        <div class="ph-row ph-head">
          <div class="ph-heat"><span class="ph-label">HEAT</span>${'<i></i>'.repeat(5)}</div>
          <div class="ph-bounty"><span class="ph-label">BOUNTY</span><b></b></div>
          <div class="ph-time"></div>
        </div>
        <div class="ph-row ph-stats">
          <span class="ph-stat" title="ON SCENE"><em class="ph-scene"></em><span class="ph-ico" role="img" aria-label="ON SCENE">${TALLY_ICONS.scene}</span></span>
          <span class="ph-stat" title="ASSIGNED"><em class="ph-assigned"></em><span class="ph-ico" role="img" aria-label="ASSIGNED">${TALLY_ICONS.assigned}</span></span>
          <span class="ph-stat ph-kills" title="DESTROYED"><em class="ph-out"></em><span class="ph-ico" role="img" aria-label="DESTROYED">${TALLY_ICONS.destroyed}</span></span>
        </div>
        <div class="ph-meter">
          <span class="ph-side ph-evade-label">EVADE</span>
          <div class="ph-track ph-split">
            <div class="ph-evade"></div><div class="ph-busted"></div><div class="ph-cool"></div><div class="ph-mid"></div>
          </div>
          <span class="ph-side ph-busted-label">BUSTED</span>
        </div>
        <div class="ph-result"><b></b><span></span></div>
      </div>
    </div>
  `;
  parent.appendChild(el);

  const q = (sel) => /** @type {HTMLElement} */ (el.querySelector(sel));
  const topEl = q('.ph-top');
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
  const assignedEl = q('.ph-assigned');
  const outEl = q('.ph-out');
  const kindsEl = q('.ph-kinds');
  const kindEls = KIND_ROW.map((k) => /** @type {HTMLElement} */ (el.querySelector(`.ph-kind[data-kind="${k}"]`)));
  const heliCountEl = q('.ph-heli-count');
  const fuelEl = q('.ph-fuel');
  const resupplyEl = q('.ph-resupply');
  const rsFill = q('.ph-rs-bar i');
  const rsTime = q('.ph-rs-time');
  const killsEl = q('.ph-kills');
  const cells = [...kindEls, heliCountEl];
  const CELL_IDS = [...KIND_ROW, 'heli'];
  for (const cell of cells) {
    cell.addEventListener('animationend', (e) => {
      if (e.target === cell) cell.classList.remove('glitch');
      else /** @type {HTMLElement} */ (e.target).classList.remove('pop');
    });
  }
  killsEl.addEventListener('animationend', () => killsEl.classList.remove('bump'));
  fuelEl.addEventListener('animationend', () => fuelEl.classList.remove('pop-in'));
  const resultEl = q('.ph-result');
  const resultHead = q('.ph-result b');
  const resultLine = q('.ph-result span');

  let shownBounty = 0;
  /** Where each icon is in its life in the row (see `iconStep`). */
  const icons = cells.map(() => ({ in: false, zero: 0 }));
  /** @type {ReturnType<typeof layoutPursuit>} */
  let prev = null;
  /** Seconds left of the top group's fade-out after the clock ran out. */
  let rsFade = 0;
  let fuelWas = null;

  /** Plays a CSS animation again from the start. @param {HTMLElement} node @param {string} cls */
  const play = (node, cls) => {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  };

  /**
   * @param {PursuitView | null} view the pursuit, or null when there is none (or the screen is not the drive)
   * @param {number} dt
   * @param {{ level: number } | null} [detect] the detection bar before a pursuit
   */
  function update(view, dt, detect = null) {
    const layout = layoutPursuit(view);
    if (!layout) {
      shownBounty = 0;
      prev = null;
      rsFade = 0;
      fuelWas = null;
      icons.forEach((_, i) => { icons[i] = { in: false, zero: 0 }; });
      for (const cell of cells) cell.classList.remove('in', 'none', 'glitch', 'fuel-low', 'fuel-out');
      resupplyEl.classList.remove('timed', 'closing');
      const level = detect?.level || 0;
      el.style.display = level > 0.01 ? 'block' : 'none';
      topEl.style.display = 'none';
      panel.style.display = 'none';
      detectEl.style.display = level > 0.01 ? 'flex' : 'none';
      detectFill.style.width = `${(level * 100).toFixed(1)}%`;
      detectEl.classList.toggle('hot', level > 0.66);
      return;
    }
    el.style.display = 'block';
    detectEl.style.display = 'none';
    panel.style.display = 'block';
    topEl.style.display = layout.isTerminal ? 'none' : 'block';
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
    assignedEl.textContent = layout.assignedText;
    outEl.textContent = layout.destroyedText;
    const counts = [...layout.kinds.map((k) => ({ n: k.n, seen: k.seen })), { n: layout.helis, seen: layout.heliSeen }];
    counts.forEach(({ n, seen }, i) => {
      icons[i] = iconStep(icons[i], seen, n, dt);
      const cell = cells[i];
      /** @type {HTMLElement} */ (cell.querySelector('em')).textContent = String(n);
      cell.classList.toggle('in', icons[i].in);
      cell.classList.toggle('none', n === 0);
    });
    for (const kind of lostKinds(prev, layout)) play(kindEls[KIND_ROW.indexOf(kind)], 'glitch');
    for (const id of risenKinds(prev, layout)) play(/** @type {HTMLElement} */ (cells[CELL_IDS.indexOf(id)].querySelector('em')), 'pop');
    if (prev && layout.destroyed > prev.destroyed) play(killsEl, 'bump');

    // A helicopter low on fuel gets a yellow pump beside it; it turns red as the helicopter retreats.
    heliCountEl.classList.toggle('fuel-low', layout.fuel === 'low');
    heliCountEl.classList.toggle('fuel-out', layout.fuel === 'leaving');
    if (layout.fuel && !fuelWas) play(fuelEl, 'pop-in');
    fuelWas = layout.fuel;

    // The clock closes the bar toward the middle; when it runs out the bar, the clock and the label
    // fade away and only the icons and their counts stay.
    const clock = layout.resupply;
    if (clock) {
      rsFade = 0;
      rsFill.style.width = `${(clock.fill * 100).toFixed(1)}%`;
      rsTime.textContent = clock.text;
    } else if (prev?.resupply && !layout.isTerminal) {
      rsFade = RESUPPLY_FADE;
      rsFill.style.width = '0';
      rsTime.textContent = clockText(0);
    } else if (rsFade > 0) {
      rsFade = Math.max(0, rsFade - dt);
    }
    resupplyEl.classList.toggle('timed', !!clock || rsFade > 0);
    resupplyEl.classList.toggle('closing', !clock && rsFade > 0);
    prev = layout;

    resultEl.style.display = layout.isTerminal ? 'flex' : 'none';
    if (layout.isTerminal) {
      resultHead.textContent = layout.stateText;
      resultLine.textContent = layout.state === 'busted' ? `FINE ${layout.fineText}` : `BOUNTY ${layout.bountyText}`;
    }
  }

  return { update, el };
}
