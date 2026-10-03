# A11: the Kuro Pass rally, the second RaceEvent

Owner: Hermes, after A9 is committed. Builds on `src/race/event.js` from A9. The design is
`docs/DESIGN.md` section 6; the config is `RALLY` in `src/world/layout.js` (read it, do not edit
it). Claude is rebuilding the map at the same time (`C1-kurogane-island.md`); Kuro Pass keeps its
shape, so read the road through `ground.roads.byId.get(RALLY.road)` and never hard-code positions.

Stay out of: `src/world/` (all of it), `src/render/`, `src/audio/` (calling `audio.*` from drive.js
is fine), `src/traffic/net.js`, `render.js`, `bodies.js`, `src/vehicles/` (except reading),
`src/ui/map.js`, `src/ui/minimap.js`, `assets/`. Same rules as A9: `git status` first and leave any
file with changes you did not make, next free version after `git log` (Claude is on 0.5.x), one
commit per part, tests first, `npm test` and `npm run check` clean, stage by name, small exact-string
edits to ARCHITECTURE.md and CHANGELOG.md (re-read right before editing, others edit them too), no
em dashes, no single-line explanatory comments, the Hermes Co-Authored-By trailer.

## Part 1. Pace notes (`src/race/pacenotes.js`, pure)

From a road's path (any object with `length` and `sample(s) -> { x, z, tx, tz }` and a height
function): walk it every 5 m, find corners from the curvature, and grade each: 1 is the tightest,
6 nearly flat, plus `hairpin` under about 20 m radius. Direction left or right (remember `d` is
positive to the left of travel). Add `long` when a corner lasts over 60 m, `tightens` and `opens`
when the radius changes by half inside it, `crest` from a sharp drop in grade, `into` when the next
corner starts within 30 m. Return `[{ s, dir, grade, mods: [] }]`. Tests on synthetic paths: a
circle of radius 15 is a hairpin, radius 150 is a 5 or 6, an S bend gives `into`, the direction
comes out right for a left-hand bend.

## Part 2. The event (`src/race/rally.js`)

`Rally extends` the A9 base. Start at `RALLY.startS`, finish `RALLY.finishEndOffset` before the
road's end, `RALLY.checkpoints` gates spaced evenly between. States as in A9 with the 3 s countdown
events. Splits against the best time per car, medals from `RALLY.medals` (average km/h targets),
prize from `RALLY.prize`, best time per car id saved under `rallyBest`. Off course: more than 25 m
from the road for 3 s starts a 10 s countdown, then the run is aborted. R during a run puts the car
back on the stage (Drive's existing reset) with a 5 s penalty. A ghost: record the player's pose
every 0.1 s (`x, z, yaw` as rounded integers in centimeters and centi-radians) and keep the best per
car in the store under `rallyGhost`; expose `ghostAt(t)` that interpolates it. Claude will draw the
ghost car; you only provide the data. Tests: a run that hits every gate finishes with the right
time and medal, skipping a gate does not finish, the penalty adds 5 s, the off-course countdown
aborts, `ghostAt` interpolates between samples.

## Part 3. Starting it and the HUD

In `src/drive.js` (small and clearly marked, like the duel): stopped within 15 m of the start
point, the prompt `F  KURO PASS TIME ATTACK`; F places the car on the line facing down the stage
and starts the countdown. During the run: `audio.music.hold('ridge')`, release at the end;
`audio.beep('count')` and `audio.beep('go')` from the events; the traffic sim gets a way to keep the
pass clear during a run (a field in `sim.js` that stops spawning on that road and fades out agents
on it). HUD (`ui/hud.js`, `style.css`): the timer, the split at each gate (green ahead, red behind),
the next two pace notes as big readable text (`L4 LONG`, `R HAIRPIN`, `INTO L2`), and the result
card with time, medal and prize for 4 s. In the cockpit view it stays at the top like the prompt.

Stop after part 3 and report: commit hashes, the tests you added, and a screenshot of the HUD
during a run (`__lowbeam.simulate` and `shot()`).
