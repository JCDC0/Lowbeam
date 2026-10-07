// Builds assets/music/tracks.json from the files in assets/music/: every audio file gets an
// entry, its loudness measured with ffmpeg (ebur128) so the game can level it. Entries already in
// the manifest keep their mood, title, vocal flag and enabled flag; a new file comes in as
// `cruise` with its title made from its file name, and is listed so its mood can be set by hand.
// A file that is gone is dropped.
//
//   npm run music            measure new files only
//   npm run music -- --all   measure every file again
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SOUNDTRACK, MOODS } from '../src/audio/soundtrack.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'assets', 'music');
const FILE = path.join(DIR, 'tracks.json');
const AUDIO = /\.(mp3|ogg|m4a|wav|flac|opus)$/i;
const all = process.argv.includes('--all');

/** Integrated loudness of a file in LUFS, or null when ffmpeg cannot read it. @param {string} file */
function measure(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /I:\s+(-?[\d.]+) LUFS/g;
  let last = null;
  let hit;
  while ((hit = m.exec(r.stderr || ''))) last = Number(hit[1]);
  return last;
}

/** A title from a file name: "night-highway-drift.mp3" is "Night Highway Drift". @param {string} file */
const titleOf = (file) => file.replace(AUDIO, '').split(/[-_ ]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

const before = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')).tracks : SOUNDTRACK;
const known = new Map(before.map((t) => [t.file, t]));
const files = fs.readdirSync(DIR).filter((f) => AUDIO.test(f)).sort();
const tracks = [];
const added = [];
for (const file of files) {
  const old = known.get(file);
  const lufs = !old || all || !Number.isFinite(old.lufs) ? measure(path.join(DIR, file)) : old.lufs;
  const entry = {
    id: old?.id ?? file.replace(AUDIO, ''),
    title: old?.title ?? titleOf(file),
    file,
    mood: old && MOODS.includes(old.mood) ? old.mood : 'cruise',
    lufs: lufs ?? -16,
    vocal: old?.vocal ?? /vocal|lyric/i.test(file),
  };
  if (old && old.enabled === false) entry.enabled = false;
  tracks.push(entry);
  if (!old) added.push(`${file} (${entry.lufs.toFixed(1)} LUFS, mood cruise: set it in tracks.json)`);
}
const gone = before.filter((t) => !files.includes(t.file)).map((t) => t.file);
fs.writeFileSync(FILE, JSON.stringify({ tracks }, null, 2) + '\n');
console.log(`wrote ${path.relative(ROOT, FILE)}: ${tracks.length} tracks`);
for (const a of added) console.log(`  new  ${a}`);
for (const g of gone) console.log(`  gone ${g}`);
for (const mood of MOODS) if (!tracks.some((t) => t.mood === mood && t.enabled !== false)) console.log(`  no track for the ${mood} mood: the game keeps its built-in list until there is one`);
