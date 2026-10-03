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
      <div class="mapslot"></div>
      <div class="cluster"></div>`;
    ui.appendChild(this.el);
    const q = (s) => /** @type {HTMLElement} */ (this.el.querySelector(s));
    this.areaEl = q('.area');
    this.moneyEl = q('.money');
    this.promptEl = q('.prompt');
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
}
