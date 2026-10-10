// Builds assets/music/tracks.json from the folders in assets/music/: every audio file in a folder (and
// in the music folder itself) gets an entry, its loudness measured with ffmpeg (ebur128) so the game can
// level it. A folder is a playlist and carries the moods it plays for (Chase plays for the police chase,
// Chill for the drive and the menus, LeisureRacing for the race and the pass; a folder it does not know
// plays for every mood). Entries and folders already in the manifest keep their roles, title, vocal flag
// and enabled flag; a new file comes in with its title made from its file name. A file that is gone is
// dropped.
//
//   npm run music            measure new files only
//   npm run music -- --all   measure every file again
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MOODS, DEFAULT_ROLES, folderId } from '../src/audio/soundtrack.js';

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

/**
 * A title from a file name: "night-highway-drift.mp3" is "Night Highway Drift"; a name that already has
 * spaces (or is not Latin) is kept as it is. @param {string} file
 */
const titleOf = (file) => {
  const base = file.replace(AUDIO, '');
  if (/\s/.test(base) || /[^\x00-\x7f]/.test(base)) return base;
  return base.split(/[-_]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
};

/** Every audio file under a folder, as paths relative to it with forward slashes. @param {string} dir @param {string} [rel] @returns {string[]} */
function walk(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(dir, p));
    else if (AUDIO.test(e.name)) out.push(p);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

const previous = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const beforeTracks = Array.isArray(previous) ? previous : previous.tracks || [];
const beforeFolders = new Map((previous.folders || []).map((f) => [f.id, f]));
const byFile = new Map(beforeTracks.map((t) => [t.file, t]));
const byBase = new Map(beforeTracks.map((t) => [path.basename(t.file), t]));

const files = walk(DIR);
/** @type {Map<string, { id: string, name: string, moods: string[], enabled: boolean }>} */
const folders = new Map();
const tracks = [];
const added = [];
for (const file of files) {
  const dir = file.includes('/') ? file.slice(0, file.indexOf('/')) : 'Music';
  const fid = folderId(dir);
  if (!folders.has(fid)) {
    const old = beforeFolders.get(fid);
    const moods = old && old.moods?.length ? old.moods : DEFAULT_ROLES[fid] || [...MOODS];
    folders.set(fid, { id: fid, name: old?.name ?? dir, moods, enabled: old ? old.enabled !== false : true });
  }
  const old = byFile.get(file) || byBase.get(path.basename(file));
  const lufs = !old || all || !Number.isFinite(old.lufs) ? measure(path.join(DIR, file)) : old.lufs;
  const entry = {
    id: `${fid}-${folderId(path.basename(file).replace(AUDIO, ''))}`,
    title: old?.title ?? titleOf(path.basename(file)),
    file,
    folder: fid,
    lufs: Math.round((lufs ?? -16) * 10) / 10,
    vocal: old?.vocal ?? /vocal|lyric/i.test(file),
  };
  if (old?.moods) entry.moods = old.moods;
  if (old && old.enabled === false) entry.enabled = false;
  tracks.push(entry);
  if (!old) added.push(`${file} (${entry.lufs.toFixed(1)} LUFS)`);
}
const gone = beforeTracks.filter((t) => !files.includes(t.file) && !byBase.has(t.file)).map((t) => t.file);
fs.writeFileSync(FILE, JSON.stringify({ folders: [...folders.values()], tracks }, null, 2) + '\n');
console.log(`wrote ${path.relative(ROOT, FILE)}: ${tracks.length} tracks in ${folders.size} folders`);
for (const f of folders.values()) console.log(`  ${f.name}: ${tracks.filter((t) => t.folder === f.id).length} tracks, plays for ${f.moods.join(', ')}${f.enabled ? '' : ' (off)'}`);
for (const a of added) console.log(`  new  ${a}`);
for (const g of gone) console.log(`  gone ${g}`);
for (const mood of MOODS) {
  if (!tracks.some((t) => (t.moods || folders.get(t.folder)?.moods || []).includes(mood) && t.enabled !== false)) console.log(`  nothing plays for the ${mood} mood: it falls back to a neighbor`);
}
