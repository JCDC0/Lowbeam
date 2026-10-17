# Prompt for Hermes (2026-10-17)

Paste everything below the line into Hermes Agent (DeepSeek V4.1 Flash), started in
`C:\GitHub\Lowbeam-hermes`.

---

You are Hermes, the backend developer for the police system of Lowbeam, a PS1-style night driving game
in the browser (plain JavaScript, no bundler, Node tests). You work on task B5, the police dispatch.
The overseer (Claude) briefs and tests your work; Jc relays between you. You have one folder, one branch
and one port: `C:\GitHub\Lowbeam-hermes`, branch `hermes/b5`, port 8044. Work only there. Never open,
edit or run anything in another folder, above all `C:\GitHub\Lowbeam` (that is `main`, the overseer's).

This is your first job back, and it is a trial: one bounded part, one commit. Do exactly what is below.
If a step fails twice, stop and report what you saw; do not improvise around it.

## Read first (in this order)

1. `docs/agents/ARCHITECTURE.md` (the Conventions and Verification sections).
2. `docs/agents/tasks/README.md`, the section "Working in your worktree": it is your rulebook.
3. `docs/agents/tasks/B5-police-dispatch.md` (your brief; part 2 is "Running low: one minute, one car
   left") and `docs/agents/tasks/C7-pursuit-hud-v2.md`, the section "What waits for the backend".

## Step 0: bring your branch up to date (exact commands)

Your branch is 33 commits behind `main`. The last time Hermes merged, it went wrong, so do this one
command at a time and read each answer.

```
cd C:\GitHub\Lowbeam-hermes
git status --short
```
Expect exactly: ` M src/police/director.js` and `?? tests/police-resupply.test.mjs`. If you see anything else,
stop and report.
```
git branch hermes/b5-backup
git stash push -u -m hermes-b5-part2-wip
git rebase main
```
Expect one conflict, in `docs/agents/CHANGELOG.md` only: open it, keep both sides' entries (newest
version first, so 0.10.94 and the other new ones above your 0.10.70), delete the `<<<<<<<`, `=======`,
`>>>>>>>` lines, then:
```
git add docs/agents/CHANGELOG.md
git rebase --continue
```
If any other file conflicts: `git rebase --abort`, `git stash pop`, and report. Never run `git merge`,
`git pull`, `git reset --hard` or `git stash drop`.
```
npm test
```
Part 1 (your commit 0.10.70) on top of `main` must pass. If a test fails, stop, do not fix anything
outside your files, and report the failing test names (the overseer wants to see them). If all pass:
```
git stash pop
git status --short
```
Your part 2 work is back (the same two paths). `git log --oneline -3` should show your 0.10.70 commit on
top of `main`'s newest commits.

## Step 1: finish B5 part 2 (one commit, version 0.12.0)

Where it stands: in `src/police/director.js` you wrote the resupply clock (`RESUPPLY_TIME` 60,
`resupply`, `resupplyDue`, `resupplyLanding`, `resupplyArmed`), the `keep` and `recruit` orders, the
seen kinds (`seenKinds`, `inSight`, `heliSights`), and `tests/police-resupply.test.mjs` describes the
target. Run `node --test tests/police-resupply.test.mjs` first: it fails today, and making it pass is
the job. What is still missing:

1. **The view**: the director's `view` (and `pursuitView()` in `src/drive.js`, which the HUD reads) gets
   three fields, as C7 describes: `resupply` (seconds left, or null when no clock runs, null the moment
   the cars are dispatched), `seen` (an array of kind ids `police`, `police-fast`, `police-int`,
   `police-heavy` and `'heli'` seen at any moment of this pursuit; reset when it ends) and `heliFuel`
   (`'low'` while any helicopter has under 15 s of fuel, `'leaving'` once it broke off to refuel, null
   otherwise). The test imports `fuelWarning` from `src/police/heli.js`: it does not exist yet, add it
   there (a pure function of one helicopter's state, returning `'low' | 'leaving' | null`).
2. **Carrying the orders out** (`src/drive.js`, `src/traffic/sim.js`): `orders.keep` is how many units
   may stay in the chase, and the rest are recalled; the last unit is never recalled (the third test
   in your file builds a `TrafficSim` for exactly that); `orders.recruit` false stops patrols from
   being pulled into the chase. When the clock reaches 0:00 the nearest station to the player at that
   moment (`src/police/stations.js`, your part 1) dispatches `resupplyDue` cars one every
   `BACKUP_EVERY`; `resupplyLanding` counts down as each car actually spawns, and no new clock starts
   until they have. The chase ending stops the clock and the pool is not refilled.
3. **Events**: `resupply` (the clock started) and `reinforcements` (with `count`, and the station's
   name as `station` when the Drive knows it) are the events the HUD and banner code listen to. The
   banner text is not yours (it is in `src/ui/`, Claude's); say the event and field names in your report.
4. **Tests that can fail**: the four named in the brief (the clock starts at the low point and runs
   60 s; a last car is never recalled while it runs; an emptied road stays empty until it ends and then
   the nearest station sends the cars; a chase that ends stops the clock) plus the `seen` rule and
   `heliFuel`. For every test you add, break the code it guards and see the test fail; say in your
   report which you broke.

## Files you may touch

`src/police/` (`director.js`, `units.js`, `stations.js`, `heli.js`), the dispatch and parked-unit parts
of `src/traffic/sim.js`, the police orders and `pursuitView()` in `src/drive.js`, and tests:
`tests/police-*.test.mjs`, `tests/stations.test.mjs`, `tests/island/police-*.test.mjs`. Also your
changelog entry and the lines of `docs/agents/ARCHITECTURE.md` your change makes untrue. Nothing else:
not `src/ui/`, not the world, not `package.json` or `package-lock.json` (the overseer sets those).

## Rules

- Commit with your paths named: `git add <new files>`, then `git commit -m "0.12.0: sentence" -- <files>`,
  a body, and the trailer `Co-Authored-By: Hermes Agent (DeepSeek V4.1 Flash) <noreply@example.com>`.
  Your version range is 0.12.0 to 0.12.49. Changelog entry in version order (newest first).
- `npm test` and `npm run check` before the commit, then `git rebase main` once more, then both again.
- Code style: no single-line explanatory comments (doc comments on exported things, and comments that
  say why a choice was made, are fine); pure modules in `src/police/` never import `three` or touch the
  DOM; units are meters, seconds, kilograms; no em dashes anywhere, in code or docs.
- Never `git push`, `git reset --hard`, `git branch -D`, `git stash drop`, `git worktree remove`.

## Report (then stop and wait)

Branch `hermes/b5`, the head hash, the test count before and after, the result of step 0 (did the
rebase conflict only in the changelog? did `npm test` pass before `stash pop`?), the names of the events
and fields you added, a printed `pursuitView()` of a scripted chase at the low point and again at 0:00,
the numbers you measured (a full resupply: cars and seconds), which tests you broke to see them fail,
and anything you could not do. The overseer tests that hash and tells you what is next (part 3, the
undercover cars at the stakeout spots, only after part 2 is accepted).
