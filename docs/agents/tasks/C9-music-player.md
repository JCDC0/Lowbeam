# C9: A music player in Settings (Claude)

Jc (2026-10-10): put a music player in the Settings screen, on one half of the side, in the game's
fonts, so the player can swap between folders, add their own songs, add a playlist folder, and so on. And
the songs should shuffle, not always begin with the first (done in 0.10.28, `Shuffler`).

Jc's own music is already in folders (`assets/music/Chase`, `Chill`, `LeisureRacing`): a folder is a
playlist and plays for the moods it is given (`tasks/C8-soundtrack.md`). The player makes that visible and
lets the player add their own.

## What the player sees

The right half of the Settings screen (where the configuration help is) gets two tabs, HELP and MUSIC; the
MUSIC tab, or the MUSIC row at the end of the audio rows, shows the player:

1. Now playing: the title (in `--font-jp`: the file names have kana and kanji), its folder, a progress bar
   with the time in Share Tech Mono, and the transport: previous, play and pause, next, and a SHUFFLE
   toggle (on by default, `OPTIONS.shuffle`).
2. The mode: AUTO (the mood music: each folder plays for its roles) or one folder LOCKED (it plays on its
   own, shuffled, whatever the mood: `OPTIONS.lock`).
3. The folders: each row has a name, its track count, a toggle (a folder that is off plays for nothing),
   its role chips (MENU, CRUISE, RACE, PASS, CHASE: which moods it plays for, `Folder.moods`), a LOCK
   button, and for the player's own folders a remove button. Choosing a folder lists its tracks under it;
   a click plays one.
4. ADD FOLDER and ADD SONGS: a folder picker (`<input type="file" webkitdirectory>`, in every browser) and a
   file picker. The files are copied into the browser's storage (IndexedDB) so they stay; a new folder plays
   for every mood until its roles are set. A VOCALS toggle skips the tracks marked vocal (`OPTIONS.vocals`).
5. All of it saved (`store`): the folders' toggles and roles, the mode, the shuffle, the vocals.

Keyboard and pad: with the MUSIC row selected, left and right change track, Enter plays and pauses; the
folder lists are mouse and touch.

## The code

- `src/audio/library.js` (browser): the player's own folders in IndexedDB (`folders` metadata and a `blobs`
  store), `load()` giving `Folder`s (`user: true`) and `Track`s (`user: true`, an object URL in `url`),
  `addFolder(name, files)`, `addFiles(folderId, files)`, `removeFolder`, `setRoles`. Titles from the file
  names; loudness left at the target (unmeasured: a quick measure at import is a later step).
- `music.js`: loads the library after the manifest and merges it (`setSoundtrack` takes both); the player's
  methods: `skip()`, `previous()`, `pause()` and `resume()`, `playTrack(id)`, `state()` (what is playing,
  the time, paused, locked), and `refresh()` after the settings change (start the next track at once).
- `src/ui/music-panel.js`: the panel, built from the DOM like the other screens, its fonts from
  `style.css` (`--font-display` for labels, `--font-jp` for titles, `--font-mono` for the clock).
- `menus.js` (the Settings screen: the tabs, the MUSIC row), `style.css`.
- Tests (pure): the library's folder and track records from a list of files (titles, ids, extensions
  filtered, a folder name from the common path), the settings' save and load, `skip` and `previous` over the
  shuffle bag (`previous` returns to the track before, not a new one).

## Order

1. The panel over the existing folders: now playing, transport, shuffle, lock, the folder toggles and roles.
2. The player's own folders: add, remove, persist.
3. Polish: gamepad focus, a loudness measure at import, vocal flags for the player's tracks.

## Notes and limits

- A browser tab needs a key or a click before any audio plays; the first one in the game starts it, so the
  Settings player works from the first visit to the screen onward.
- Songs the player adds live in the browser's storage, not in the repository, and are the player's own
  responsibility for licensing; the game ships only the tracks in `assets/music/`.
- IndexedDB storage is limited by the browser's quota (usually many gigabytes); the panel shows the size of
  what is stored.
