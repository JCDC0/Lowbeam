# B1: Repair the police (Backend)

The police were built in four parts (0.8.15 to 0.8.18) and every rule has a unit test, but the parts
do not work together: a review found the bugs below by reading `Drive.stepPolice`
(`src/drive.js`, around line 213). This task fixes them, and first moves the police logic out of
`drive.js` into a pure module so a whole chase can be tested end to end. Read
`docs/agents/ARCHITECTURE.md` and `docs/agents/tasks/README.md` first, then
`archive/A17-police.md` (the Most Wanted design) and `archive/A13-pursuit-hud.md` (the view contract
the HUD and the maps already draw; keep it).

Versions: 0.9.20 onward, one per part.

## The bugs

1. A pursuit is never cleared. `this.pursuit` is only set to null in the constructor, so after an
   escape or a bust no new pursuit can start, and `u.agent.pursuit = !!this.pursuit` keeps every unit
   within 200 m chasing forever.
2. One fast toll pass means heat 5 forever. `this.lastTollSpeed` is set when a gate is crossed and
   never reset, so `noticesTrap` is true on every later frame and the heat never cools.
3. Heat level 1 begins on the first frame anything is noticed (`Math.ceil` in `heat.js`), and
   `events.duel = !!this.duel` adds heat for any duel, seen or not (the design says in sight of a
   unit).
4. Roadblocks: `road.dir` does not exist on a `Road`, so the lane lookup always asks for direction
   -1; on Route 1's one-way carriageways that finds no lane and no roadblock is ever set. Find the
   player's lane from the traffic network instead.
5. Spike strips: `flatTime` counts but nothing reaches the car. Grip and top speed must fall
   (`spikePenalty`) through a hook in `physics.js` (yours now), and mend at a pump or after the time.
6. `roadblocksDodged` counts roadblocks set, not passed.
7. "In sight" is any unit within 150 m. It must need a clear line: no building or deck between the
   unit and the player (the building colliders and `heliWorld.covered` already exist).
8. BUSTED and ESCAPED change nothing: no fine, no tow, no bounty paid.

## Part 1 (0.9.20): a pure police director, and a test of whole chases

- New `src/police/director.js` (pure): a `PoliceDirector` that owns the heat, the pursuit's whole
  life (none, pursuit, evading, cooldown, busted, escaped, then none again after the report),
  roadblocks, spikes and the counters. Each frame `update(dt, world)` takes what Drive knows (player
  state, the units near with their distance and whether each sees the player, toll crossings as
  events, duel and damage events, whether the player hides) and returns what Drive must do (units to
  spawn, which units chase, scramble or recall the helicopter, set or clear a roadblock, the tire
  penalty, a fine or a payout, the view for the HUD). `Drive.stepPolice` shrinks to feeding it and
  carrying out its orders.
- Fix bugs 1 to 4 and 6 inside it. Events are one-shot: a toll crossing is one notice, not a state.
- `tests/police-director.test.mjs`, scripted chases on a fake world, each one a story: speed past a
  unit and get chased; escape (out of sight until evade and cooldown fill) and see the units go back
  to patrol; get a second pursuit after the first; one toll pass at 180 km/h raises the heat once
  and it cools after the quiet time; a duel nobody sees adds no heat; get busted (stop beside a unit
  for 3 s); heat 4 sets a roadblock on Route 1 and passing it counts as dodged.

## Part 2 (0.9.21): the consequences

- Spike strips reach the car (bug 5): a `tires` factor in the physics state that scales grip and top
  speed, set from the director's penalty, mended at a pump (with the repair) or with time.
- Line of sight (bug 7): a pure `sees(from, to, world)` that samples the segment against building
  boxes and decks; used for units, not the helicopter (it has its own).
- BUSTED: the fine (bounty plus 30,000 yen, what the player can pay), the car towed to the police HQ
  lot, the pursuit report shown, then free roam. ESCAPED: the bounty paid. Lifetime totals saved under
  `rapSheet` in the store (pursuits, escapes, busts, total bounty, longest pursuit, most units
  disabled).
- Tests for each.

## Part 3 (0.9.22): the sound

Sirens (wail and yelp, Doppler with relative speed, through the effects channel, muffled in the
cockpit like the tires) and the helicopter's rotor by distance, in `src/audio/`. A pursuit is the
`intense` music mood at once and stays so through cooldown. Render a check WAV the way
`tools/render-passby.mjs` does.

## Later (ask before starting)

The rest of the Most Wanted design in `archive/A17-police.md`: radio chatter lines (`radio.js`),
pursuit breakers (Claude places them, you make them work), heat that carries over between pursuits.

## Rules

- Your files are in `docs/agents/tasks/README.md`. The HUD (`src/ui/*`) and the models are not
  yours: if the view needs a new field, add it to the contract in your report and Claude draws it.
- Do not lower a test's bar to make it pass. If a test is flaky, make it sturdier (more seeds, a
  longer run) and say why.
- Verify in the browser as well as in tests: start a pursuit (`__lowbeam.drive`), drive away under a
  viaduct, and show the HUD going through evading, cooldown and escaped, then a second pursuit.
  Screenshots at 1280 by 720 in your report.
