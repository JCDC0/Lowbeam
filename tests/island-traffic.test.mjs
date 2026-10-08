/**
 * The traffic: following, lanes, blinkers, solid bodies, walls, getting out of the way. One
 * process for all of them, so the island they share (`tests/island.mjs`) is built once.
 */
import './island/traffic.test.mjs';
import './island/traffic-solid.test.mjs';
import './island/blinkers.test.mjs';
import './island/traffic-walls.test.mjs';
import './island/traffic-evade.test.mjs';
