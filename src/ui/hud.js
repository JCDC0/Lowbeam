/**
 * Driving HUD: area name, money, the interaction prompt, the minimap and the slot the
 * gauge cluster draws into. DOM text only changes when its value does.
 */

export class Hud {
  /** @param {HTMLElement} ui */
  constructor(ui) {
    this.el = document.createElement('section');
    this.el.id = 'hud';
    this.el.className = 'screen';
    this.el.innerHTML = `
      <div class="area display"></div>
      <div class="money display"></div>
      <div class="prompt display"></div>
      <div class="duel">
        <div class="duelrow"><span class="duelname duelplayer">YOU</span><span class="duelbar duelplayergauge"><i></i></span></div>
        <div class="duelcount display"></div>
        <div class="duelrow"><span class="duelname duelrival"></span><span class="duelbar duelrivalgauge"><i></i></span></div>
        <div class="duelend display"></div>
      </div>
      <div class="rally">
        <div class="rallytime display"></div>
        <div class="rallysplit display"></div>
        <div class="rallycount display"></div>
        <div class="rallynotes"><span class="rallynote first"></span><span class="rallynote second"></span></div>
        <div class="rallyoff display"></div>
        <div class="rallyend display"></div>
      </div>
      <div class="mapslot"></div>
      <div class="cluster"></div>`;
    ui.appendChild(this.el);
    const q = (s) => /** @type {HTMLElement} */ (this.el.querySelector(s));
    this.areaEl = q('.area');
    this.moneyEl = q('.money');
    this.promptEl = q('.prompt');
    this.duelEl = q('.duel');
    this.duelRivalNameEl = q('.duelrival');
    this.duelPlayerBarEl = q('.duelplayergauge i');
    this.duelRivalBarEl = q('.duelrivalgauge i');
    this.duelCountEl = q('.duelcount');
    this.duelEndEl = q('.duelend');
    this.rallyEl = q('.rally');
    this.rallyTimeEl = q('.rallytime');
    this.rallySplitEl = q('.rallysplit');
    this.rallyCountEl = q('.rallycount');
    this.rallyNoteEls = [q('.rallynote.first'), q('.rallynote.second')];
    this.rallyOffEl = q('.rallyoff');
    this.rallyEndEl = q('.rallyend');
    this.mapSlot = q('.mapslot');
    this.clusterSlot = q('.cluster');
    /** @type {Record<string, string>} */
    this.last = {};
    this.cockpit = false;
  }

  /** @param {boolean} on */
  show(on) {
    this.el.classList.toggle('on', on);
  }

  /** @param {HTMLElement} el @param {string} key @param {string} text */
  text(el, key, text) {
    if (this.last[key] === text) return;
    this.last[key] = text;
    el.textContent = text;
  }

  /** @param {string} name */
  area(name) {
    if (this.last.area === name) return;
    this.text(this.areaEl, 'area', name);
    this.areaEl.classList.remove('fade');
    void this.areaEl.offsetWidth;
    this.areaEl.classList.add('fade');
  }

  /** @param {number} yen */
  money(yen) {
    this.text(this.moneyEl, 'money', `¥ ${Math.round(yen).toLocaleString('en-US')}`);
  }

  /**
   * @param {string} text empty to hide
   * @param {boolean} [cockpit] true while the camera is in the cockpit, where the prompt
   *   moves up out of the way of the modeled gauges
   */
  prompt(text, cockpit) {
    this.text(this.promptEl, 'prompt', text);
    this.promptEl.style.display = text ? 'block' : 'none';
    if (this.cockpit !== !!cockpit) {
      this.cockpit = !!cockpit;
      this.promptEl.classList.toggle('cockpit', this.cockpit);
    }
  }

  /**
   * The duel readout: two gauge bars, the countdown digits and the result line.
   * @param {{ rival: string, player: number, rivalGauge: number, count: number, end: string } | null} duel
   */
  duelPanel(duel) {
    this.duelEl.style.display = duel ? 'block' : 'none';
    if (!duel) return;
    this.text(this.duelRivalNameEl, 'duelrival', duel.rival);
    this.duelPlayerBarEl.style.width = `${Math.max(0, Math.min(1, duel.player)) * 100}%`;
    this.duelRivalBarEl.style.width = `${Math.max(0, Math.min(1, duel.rivalGauge)) * 100}%`;
    this.text(this.duelCountEl, 'duelcount', duel.count > 0 ? String(duel.count) : '');
    this.text(this.duelEndEl, 'duelend', duel.end);
  }

  /**
   * The rally readout: the running time, the last split, the next two pace notes and the
   * result card. It sits at the top of the screen so it stays clear of the gauges in the
   * cockpit view, like the duel panel and the prompt.
   * @param {{ time: string, split: { delta: number, ahead: boolean } | null,
   *           notes: { text: string }[], count: number, end: string, off?: number } | null} rally
   */
  rallyPanel(rally) {
    this.rallyEl.style.display = rally ? 'block' : 'none';
    if (!rally) return;
    this.text(this.rallyTimeEl, 'rallytime', rally.time);
    this.text(this.rallyCountEl, 'rallycount', rally.count > 0 ? String(rally.count) : '');
    this.text(this.rallyEndEl, 'rallyend', rally.end);
    this.text(this.rallyOffEl, 'rallyoff', rally.off ? `OFF COURSE  ${rally.off}` : '');
    if (rally.split) {
      const sign = rally.split.ahead ? '-' : '+';
      this.text(this.rallySplitEl, 'rallysplit', `${sign}${Math.abs(rally.split.delta).toFixed(2)}`);
      this.rallySplitEl.classList.toggle('ahead', rally.split.ahead);
      this.rallySplitEl.classList.toggle('behind', !rally.split.ahead);
    } else {
      this.text(this.rallySplitEl, 'rallysplit', '');
    }
    for (let i = 0; i < this.rallyNoteEls.length; i++) {
      this.text(this.rallyNoteEls[i], `rallynote${i}`, rally.notes[i] ? rally.notes[i].text : '');
    }
  }
}
