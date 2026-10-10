# C8: The new soundtrack (Jc generates, the backend wires, Claude fits it)

Jc wants the whole lineup replaced: proper songs with lyrics and instrumentals, in the line of an
arcade police-chase game (Need for Speed: Hot Pursuit): chill night drives, intense races, police chases.
Jc makes the tracks in a text-to-music tool (Google Flow). The prompts, the lyrics and the rules for the
files are in `docs/music/flow-prompts.md`: 24 tracks and 2 stingers in five moods.

## The moods

The game has four moods today (`menu`, `cruise`, `intense`, `mountain`, in `src/audio/soundtrack.js`) and
a pursuit plays `intense`. The new lineup splits the police chase out:

| Mood | Plays when | Tracks | With vocals |
|---|---|---|---|
| `menu` | title, garage, settings, map | 3 | 1 |
| `cruise` | the chill night drive | 6 | 3 |
| `intense` | a street race, a rival close, going fast | 5 | 3 |
| `mountain` | Kuro Pass, the rally | 4 | 1 |
| `pursuit` (new) | a police chase: tier A at heat 1 to 3, tier B at heat 4 and 5 | 6 | 2 |
| stingers | escaped, busted | 2 | 0 |

## 1. The code (Backend: `src/audio/*`, `drive.js` for the events, `tests/*`)

- `MOODS` gains `'pursuit'`, ranked above `mountain` in `ENERGY`. `MoodTracker.update` answers `'pursuit'`
  (not `'intense'`) while `scene.pursuit`, and takes `scene.heat`. The Drive passes the heat.
- A track list with no `pursuit` track must keep working: the pursuit falls back to `intense`, and
  `setSoundtrack` requires only the four old moods (today it refuses a list that lacks one).
- Tiers: a `pursuit` track in `tracks.json` has `tier: "A"` or `"B"`. `nextTrack(mood, lastId, turn, heat)`
  picks tier A below heat 4 and tier B from heat 4, never the track just played. When the heat climbs to
  4 while an A track plays, the next track (a B one) starts with the usual crossfade once the A has played
  20 s; when the heat falls, the tier changes at the next track, never mid-track.
- Stingers: `audio.sting('escaped' | 'busted')` plays `assets/music/stings/<id>.mp3` once over the music,
  the music ducked by 6 dB for its length and back over 1 s. The Drive calls it on the pursuit's escaped
  and busted events. A missing file does nothing.
- Vocals: a saved setting `vocals` (default on; `store`): off, `nextTrack` skips the tracks marked
  `vocal: true` (the field is already in the manifest). Claude adds the Settings row (VOCAL TRACKS).
- `tracks.json` entries may carry `tier` and `source` (a string: the tool and the date, for the
  license record); `tools/music-manifest.mjs` keeps `mood`, `tier`, `vocal` and `source` it finds.
- Tests (pure): a pursuit answers the `pursuit` mood and a list without one falls back to `intense`;
  the tier by heat; the heat rising mid-track asks for the next track once; the vocal filter; the
  stinger's ducking curve.

## 2. The files (Jc, then Claude)

- Jc generates the tracks (take three or four of each and keep the best), names them by id
  (`cruise-01.mp3`, `pursuit-04.mp3`, `stings/sting-escaped.mp3`) and puts them in `assets/music/`.
  An `.m4a` plays as well as an `.mp3` in every browser the game targets, but use mp3 so the size stays
  predictable: 128 kbps, 2:30 to 3:30, under 3.5 MB each (24 tracks come to about 70 MB; the old eight
  are 41 MB, and GitHub Pages' limit is 1 GB).
- Claude runs `npm run music` (it measures the loudness with ffmpeg), sets each track's mood, tier,
  vocal flag and source in `tracks.json`, and checks that the levels sit within 3 LUFS of each other.
- The old eight tracks stay until every mood has at least three new ones; the swap commit removes them.
- Before the game ships (the GitHub Pages milestone): the license of every generated track is checked
  against the tool's terms for the plan it was made on. The `source` field is the record.

## Order

1. The code (one commit), with the tests: the backend (Hermes, or Gemini after B4).
2. Claude: the Settings row, the pursuit HUD already done; check the moods in the game with two placeholder
   tracks set to `pursuit`.
3. Jc: the tracks, mood by mood (`pursuit` and `cruise` first: they are most of the play).
4. Claude: `npm run music`, the manifest, the swap.
