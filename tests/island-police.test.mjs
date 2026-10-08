/**
 * The police on the island, and the traffic around a pursuit. One process for all of them, so the
 * island they share (`tests/island.mjs`) is built once.
 */
import './island/police-heat.test.mjs';
import './island/police-units.test.mjs';
import './island/roadblock.test.mjs';
import './island/pursuit-chase.test.mjs';
import './island/police-damage.test.mjs';
import './island/police-detect.test.mjs';
import './island/police-driving.test.mjs';
import './island/rally-traffic.test.mjs';
import './island/traffic-refill.test.mjs';
import './island/traffic-knock.test.mjs';
