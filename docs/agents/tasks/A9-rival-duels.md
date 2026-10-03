# A9: rival duels, plus two small cleanups

Owner: Hermes (backend). Claude is reworking the map, roads and toll plazas in another session at
the same time, so stay out of `src/world/` entirely, and out of `src/audio/`, `src/vehicles/`
(except `gauges.js` in part 2), `src/traffic/net.js`, `kinds.js`, `bodies.js`, `render.js`.

Same rules as A8: `git status` first and stop if there are changes you did not make, next free
0.4.x after `git log`, one commit per part, a test for every rule written first, `npm test` and
`npm run check` clean before each commit, stage files by name, update ARCHITECTURE.md and
CHANGELOG.md in the same commit, no em dashes, no single-line explanatory comments, the Hermes
Co-Authored-By trailer.

## Part 1. The dev server answers range requests

`tools/devserver.mjs` sends whole files only, so a media element cannot seek inside a music track.
Honor `Range: bytes=a-b` (and `a-`, `-n`) with `206 Partial Content`, `Content-Range` and
`Accept-Ranges: bytes`; `416` for a range past the end. Keep the no-store caching. Test it in a new
`tests/devserver.test.mjs` by starting the server on a free port in the test and fetching a range of
`package.json`.

## Part 2. Remove the deprecated gauge aliases

`gauges.js` still exports `WATER_MIN`, `WATER_MAX` and sets `g.water`; `ui/cluster.js` reads
`gs.temp ?? gs.water ?? 84`. Remove the aliases, read `gs.temp` only, and delete the line about
them under "Open work and known issues" in ARCHITECTURE.md. (The `water` in `audio/env.js` and in
the tests about lakes is a different thing; leave it.)

## Part 3. Challenging a street racer (the first RaceEvent)

The design target is Need for Speed: Most Wanted and Tokyo Xtreme Racer style duels on Route 1.

**Pure logic in a new `src/race/` folder** (no three.js, no DOM), tested in `tests/race.test.mjs`:

- `race/event.js`: the `RaceEvent` interface every race kind will share, as a JSDoc typedef and a
  small base: `{ id, kind, state: 'countdown' | 'running' | 'won' | 'lost' | 'aborted', time,
  participants, update(dt, world) -> events[], result() }`. Later kinds (point-to-point, the rally,
  police escapes, a racer joining mid-race) plug into the same shape.
- `race/duel.js`: `Duel extends` that base. Tokyo Xtreme Racer rules: each driver has a gauge
  (1 at the start). Whoever is behind loses gauge at a rate that grows with the gap (none under
  10 m, fast past 150 m), and a little more for each wall or traffic hit. The leader's gauge
  recovers slowly. First to 0 loses; past 500 m apart the leader wins at once. A 3 s countdown
  first (both cars keep driving, the gauge does not move), `audio.beep('count')` each second and
  `audio.beep('go')` at the start are events the caller plays, not calls from the pure module.
- Prize: win `4000 + 6000 * rival speed factor` yen rounded to 500, lose nothing. Store wins per
  rival kind id in the save under `duelWins`.

**Starting one** (in `src/drive.js`, small and clearly marked): the challenge key (add `KeyH`,
"flash headlights", and gamepad `RB` in `core/input.js`; update the controls screen in
`ui/menus.js`) when a rival is within 60 m ahead in the same direction on Route 1 or the Bayshore
Line. The rival agent switches to a duel flag in the traffic sim: it keeps its lane logic but
aims for its top speed (`kind.speed[1]`) and ignores the slow lane. Use `TrafficSim` hooks only: add
a `duel` field on the agent and read it in `sim.js`; do not change other agents' behavior.

**HUD** (`ui/hud.js`, `style.css`): two gauge bars at the top center (you and the rival's name),
the countdown digits, and `YOU WIN  ¥8,500` or `YOU LOSE` for 3 s at the end. In the cockpit view
they stay at the top like the prompt does.

**Music**: leave audio alone. The music already turns intense when a racer is within 150 m, so a
duel needs no `audio.music.hold`.

Tests for part 3 at least: the countdown blocks the gauge, the trailing driver's gauge falls faster
with a bigger gap, a 500 m lead wins at once, hits cost gauge, the prize rounds to 500, a challenge
is refused when the rival is behind or more than 60 m away, an agent in a duel wants its top speed.

Stop after part 3 and report: commit hashes, the tests you added, and a screenshot of the duel HUD
during a run (`__lowbeam.simulate` and `shot()`; start the dev server with the preview tooling or
`node tools/devserver.mjs 8040` without backgrounding it with `&`).
