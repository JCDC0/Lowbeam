# Handoff: A11 (rival duels done, rally in progress)

Written by Hermes when Claude clocked out mid-A11. Read this first, then
`docs/agents/tasks/A11-rally.md` for the full brief.

## What is committed and done

| Part | Version | Commit | State |
|---|---|---|---|
| A9 part 1, dev server range requests | 0.4.21 | `cbe1016` | done |
| A9 part 2, remove gauge aliases | 0.4.22 | `fa518f9` | done |
| A9 part 3, rival duels (`RaceEvent`, `Duel`) | 0.4.23 | `1c421bc` | done, verified in a browser |
| A11 part 1, pace notes | 0.6.5 | `8b30ab1` | done |

A11 part 1 added pure `src/race/pacenotes.js` and `tests/pacenotes.test.mjs` (10 tests).
It walks a stage every 5 m, grades each corner 1 to 6, and tags hairpin, long, tightens,
opens, crest and into. Full suite at that commit: 183 passing, `npm run check` clean.

## What is NOT done: A11 parts 2 and 3

Neither has been committed. Nothing from A11 parts 2 or 3 is in the tree.

### Part 2, `src/race/rally.js` (the `Rally` event) - STARTED, NOT WRITTEN

The test file is written and reviewed but the implementation does not exist, so the test
cannot pass yet. To keep `npm test` green for everyone else it is parked here:

    docs/agents/handoff/A11-part2-rally.test.mjs

To resume: move it back to `tests/rally.test.mjs`, write `src/race/rally.js`, then run it.

The test expects this API, decided with the user and confirmed:

- `new Rally(carId, RALLY, road, opts?)` where `road` needs `length` (and `id`). `opts` may
  carry `{ best, bestSplits }` for the time trial comparison.
- Pure module. The user explicitly chose **Rally stays pure, Drive handles the store**, so
  `Rally` must NOT import `src/core/store.js` or touch localStorage. Drive reads and writes
  `rallyBest` and `rallyGhost`.
- States: `countdown` then `running` then `won` / `aborted`. A 3 s countdown (`COUNTDOWN`)
  emitting `count` events and one `go`, same as `Duel`.
- Gates: `rally.gates` is an array of arc-length positions, `RALLY.checkpoints` of them,
  spaced evenly from `RALLY.startS` to the finish at `road.length - RALLY.finishEndOffset`.
  `rally.gatesHit` counts gates actually driven through. `rally.nextGate()` returns the next
  required gate. Skipping a gate must not finish.
- Splits: one per gate plus the finish, each `{ at, against, ahead }`. `against` is `null`
  when there is no best time.
- Medals and prize from `RALLY.medals` (average km/h targets) and `RALLY.prize`, gold first.
- `PENALTY` is 5 s; `rally.penalize()` adds it to the final time.
- Off course: more than `OFF_COURSE` (25) m from the road for `OFF_LIMIT` (3) s starts a 10 s
  countdown, then the run aborts with no result. Coming back on course clears the timer.
- Ghost: `rally.recordGhost(t, { x, z, yaw })` stores integers (centimeters and
  centi-radians). `rally.ghostAt(t)` interpolates between samples and returns `null` outside
  the recorded span.

`RALLY` in `src/world/layout.js` is read only, never edited. Read the road through
`ground.roads.byId.get(RALLY.road)`, never hard-coded positions, because Claude is still
rebuilding the map.

### Part 3, drive wiring and HUD - NOT STARTED

Nothing written. From the brief:

- `src/drive.js`: stopped within 15 m of the start point, prompt `F  KURO PASS TIME ATTACK`;
  F places the car on the line facing down the stage and starts the countdown. During a run,
  `audio.music.hold('ridge')` and release at the end; `audio.beep('count')` and
  `audio.beep('go')` from the events. R during a run puts the car back on the stage with the
  5 s penalty. Traffic gets a way to keep the pass clear during a run (a field in `sim.js`
  that stops spawning on that road and fades out agents on it). Save `rallyBest` and
  `rallyGhost` here, per the pure-module decision above.
- `src/ui/hud.js` and `style.css`: the timer, the split at each gate (green ahead, red
  behind), the next two pace notes as big text (`L4 LONG`, `R HAIRPIN`, `INTO L2`) from
  `paceNotes`, and the result card with time, medal and prize for 4 s. Stays at the top in
  the cockpit view, like the duel panel and the prompt.
- Screenshot of the HUD during a run via `__lowbeam.simulate` and `shot()`, with the dev
  server started without `&`.

## Constraints to carry forward

- Stay out of `src/world/`, `src/render/`, `src/audio/`, `src/traffic/net.js`,
  `traffic/render.js`, `bodies.js`, `src/vehicles/` (reading is fine), `src/ui/map.js`,
  `src/ui/minimap.js`, `assets/`. Calling `audio.*` from drive.js is allowed.
- Next free version after `git log` when resuming. Claude was on 0.6.4 when I stopped, so
  check before bumping: my last was 0.6.5 and Claude may have moved on.
- One commit per part, tests first and seen to fail, `npm test` and `npm run check` clean
  before each commit, stage files by name, small exact-string edits to ARCHITECTURE.md and
  CHANGELOG.md with a re-read right before editing, no em dashes, no single-line explanatory
  comments, end with the Hermes Co-Authored-By trailer.

## Known coordination item

Claude's A10 brief (Antigravity's, already running elsewhere) says the T-junction yield is
exposed as data on the stop, `{ s, yield: { lanes, at } }`, for the sim side to read, but does
not say who wires `src/traffic/sim.js`. A11 part 3 also needs a field in `sim.js` for the
rally keeping the pass clear. Those two are adjacent and could collide. Antigravity is barred
from `sim.js`, so one of us needs to own both.

## Housekeeping done at handoff

- The half-written part 2 test was moved out of `tests/` to `docs/agents/handoff/` so the suite
  is green (183 passing, check clean) rather than leaving a red test in the tree.
- `package-lock.json` had drifted: both its `version` fields said 0.6.3 while `package.json`
  said 0.6.4 (Claude's stats overlay). Both are fixed to 0.6.5 in the part 1 commit.
- Version numbers in git history are no longer monotonic: A9 ended at 0.4.23 and the map work
  started at 0.5.0. Nothing is broken by it, but the changelog is not a simple ascending list.