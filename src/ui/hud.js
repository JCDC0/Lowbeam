/**
 * Driving HUD: area name, money, the interaction prompt, the minimap and a corner slot
 * for the gauge cluster. DOM text only changes when its value does.
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
      <div class="mapslot"></div>
      <div class="cluster"></div>
      <div class="readout display"><span class="spd">0</span><span class="unit">KM/H</span><span class="gear">N</span><span class="fuel"></span></div>`;
    ui.appendChild(this.el);
    const q = (s) => /** @type {HTMLElement} */ (this.el.querySelector(s));
    this.areaEl = q('.area');
    this.moneyEl = q('.money');
    this.promptEl = q('.prompt');
    this.mapSlot = q('.mapslot');
    this.clusterSlot = q('.cluster');
    this.readout = { root: q('.readout'), spd: q('.spd'), gear: q('.gear'), fuel: q('.fuel') };
    /** @type {Record<string, string>} */
    this.last = {};
    this.areaTimer = 0;
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

  /** @param {string} text empty to hide */
  prompt(text) {
    this.text(this.promptEl, 'prompt', text);
    this.promptEl.style.display = text ? 'block' : 'none';
  }

  /**
   * Plain digital readout, used until a gauge cluster is attached.
   * @param {number} kmh @param {string} gear @param {number} fuel @param {number} tank
   */
  digital(kmh, gear, fuel, tank) {
    this.text(this.readout.spd, 'spd', String(Math.round(kmh)));
    this.text(this.readout.gear, 'gear', gear);
    this.text(this.readout.fuel, 'fuel', `FUEL ${fuel.toFixed(1)} / ${tank} L`);
  }
}
