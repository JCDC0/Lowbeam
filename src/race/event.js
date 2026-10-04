/**
 * The shape every race kind shares. Pure: no three.js, no DOM, no audio.
 *
 * A race is a state machine the caller drives one step at a time and reads results from.
 * Later kinds (point to point, the rally, police escapes, a racer joining mid-race) plug
 * into the same interface, so the HUD and the drive loop do not care which one is running.
 */

/**
 * @typedef {'countdown' | 'running' | 'won' | 'lost' | 'aborted'} RaceState
 * @typedef {{ type: string, [k: string]: any }} RaceEventMsg
 * @typedef {{ gap?: number, hits?: { player?: number, rival?: number }, [k: string]: any }} RaceWorld
 * @typedef {{ won: boolean, prize: number, rival: string, reason: string }} RaceResult
 */

/** The common part of a race: an id, a kind, a state, a clock and the participants. */
export class RaceEvent {
  /**
   * @param {string} id @param {string} kind @param {string[]} participants
   */
  constructor(id, kind, participants) {
    this.id = id;
    this.kind = kind;
    this.participants = participants;
    /** @type {RaceState} */
    this.state = 'countdown';
    this.time = 0;
  }

  /**
   * Advances the race. Subclasses return the events the caller should play.
   * @param {number} _dt @param {RaceWorld} [_world]
   * @returns {RaceEventMsg[]}
   */
  update(_dt, _world) {
    this.time += _dt;
    return [];
  }

  /** Ends the race without a winner. */
  abort() {
    if (this.state === 'countdown' || this.state === 'running') this.state = 'aborted';
  }

  /** @returns {RaceResult | null} null until the race is decided. */
  result() {
    return null;
  }
}