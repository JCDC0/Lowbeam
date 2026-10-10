# C8: The soundtrack (Jc makes the music, Claude wires it)

Jc wanted the whole lineup replaced: songs with lyrics and instrumentals, in the line of an arcade
police-chase game (Need for Speed: Hot Pursuit): chill night drives, races, police chases. Jc makes the
tracks in a text-to-music tool (Google Flow) and organizes them in folders under `assets/music/`. The
generator prompts and lyrics I wrote are in `docs/music/flow-prompts.md` (24 tracks and 2 stingers) for
more music; Jc's own tracks came first.

## Done (0.10.28)

- A folder is a playlist with roles: `Chase` plays for the police chase (the new `pursuit` mood), `Chill`
  for the drive and the menus (`cruise`, `menu`), `LeisureRacing` for a race and the pass (`intense`,
  `mountain`). `tracks.json` lists the folders and the tracks; `npm run music` scans the folders (mp3, m4a,
  ogg, wav, flac, opus), measures each file and keeps the roles, titles and vocal flags already set.
- A shuffle bag per mood (the first track is a surprise, none repeats before all have played).
- A pursuit is its own mood and cuts in at once; a mood nobody plays for falls back to the nearest.
- Hooks for the music settings: `OPTIONS.vocals`, `OPTIONS.shuffle`, `OPTIONS.lock`, each folder's `enabled`.

## Still to do

1. Done (0.10.30): the music player in Settings (`tasks/C9-music-player.md`).
2. Stingers: `audio.sting('escaped' | 'busted')` plays `assets/music/stings/<id>.mp3` over the music, the
   music ducked by 6 dB for its length and back over 1 s; the Drive calls it on the pursuit's escaped and
   busted events. A missing file does nothing. Needs the two files (`docs/music/flow-prompts.md`).
3. Vocal flags: the Japanese tracks read as instrumental because the manifest cannot hear. The player can
   mark a song VOCAL in Settings (kept in the browser), or set `"vocal": true` in `tracks.json` for the
   ones that have a singer so every player gets it.
4. Heat tiers for the pursuit (an easier track at heat 1 to 3, a harder at 4 and 5): dropped for now,
   because Chase has three tracks and no tiers; a `tier` on a track is the way back if Jc wants it.
5. Before the game ships (the GitHub Pages milestone): the license of every generated track against the
   terms of the tool and the plan it was made on. Record it in a `source` field (the tool and the date)
   per track in `tracks.json`; `npm run music` keeps it.

## Sizes

Each track is 2 to 4 MB (mp3 at 128 kbps, m4a at about the same); the 14 now are 43 MB. GitHub Pages' limit
is 1 GB and the tracks stream when they play, so the cost is the repository's size: swap tracks rarely and
commit them once.
