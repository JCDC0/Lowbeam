/**
 * The layout, the GPS route, the Kurogane Line and the signals. One process for all of them, so
 * the island they share (`tests/island.mjs`) is built once.
 */
import './island/layout.test.mjs';
import './island/route.test.mjs';
import './island/kurogane-line.test.mjs';
import './island/signals.test.mjs';
