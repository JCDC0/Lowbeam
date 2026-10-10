import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAudioName, titleOf, userFolderId, userTrackId, groupPicks, byTitle, needsJp, sizeText, clockText,
  snapshotPrefs, applyPrefs, toggleMood, LOOSE_FOLDER,
} from '../src/audio/library-rules.js';
import { FOLDERS, OPTIONS, SOUNDTRACK, MOODS, poolFor, setSoundtrack, rolesOf } from '../src/audio/soundtrack.js';

test('only audio files count, by their extension', () => {
  for (const n of ['a.mp3', 'B.M4A', 'x y.flac', '直線エスケープ.ogg', 'c.opus', 'd.wav']) assert.ok(isAudioName(n), n);
  for (const n of ['cover.jpg', 'notes.txt', 'mp3', 'song.mp3.part', '.DS_Store', 'list.m3u']) assert.ok(!isAudioName(n), n);
});

test('a title is the file name with no folder, extension or underscores', () => {
  assert.equal(titleOf('Night_Drive__Remix.mp3'), 'Night Drive Remix');
  assert.equal(titleOf('Mine/sub/Shibuya Rain (Vocal).m4a'), 'Shibuya Rain (Vocal)');
  assert.equal(titleOf('C:\\music\\直線エスケープ.m4a'), '直線エスケープ');
  assert.equal(titleOf('.mp3'), '.mp3', 'a name that is only an extension stays as it is');
});

test('the player\'s ids are their own, and the same file is the same song', () => {
  assert.equal(userFolderId('Chill'), 'u-chill');
  assert.notEqual(userFolderId('Chill'), 'chill', 'a folder named like one of the game\'s does not take its place');
  assert.equal(userFolderId('Night Drive!'), userFolderId('night drive'));
  const f = userFolderId('Mine');
  assert.equal(userTrackId(f, { name: 'A Song.mp3', size: 1234 }), userTrackId(f, { name: 'A Song.mp3', size: 1234 }));
  assert.notEqual(userTrackId(f, { name: 'A Song.mp3', size: 1234 }), userTrackId(f, { name: 'A Song.mp3', size: 1235 }));
  assert.notEqual(userTrackId(f, { name: 'A Song.mp3', size: 1 }), userTrackId(userFolderId('Other'), { name: 'A Song.mp3', size: 1 }));
});

test('a folder pick is one playlist with its subfolders, loose songs go where they are told, others are left out', () => {
  const { folders, skipped } = groupPicks([
    { name: 'a.mp3', size: 1, path: 'Road Trip/a.mp3' },
    { name: 'b.m4a', size: 2, path: 'Road Trip/Disc 2/b.m4a' },
    { name: 'cover.jpg', size: 3, path: 'Road Trip/cover.jpg' },
    { name: 'c.ogg', size: 4, path: 'Other/c.ogg' },
    { name: 'd.wav', size: 5 },
    { name: 'e.txt', size: 6 },
  ]);
  assert.deepEqual(folders.map((g) => [g.name, g.files.map((p) => p.name)]), [
    ['Road Trip', ['a.mp3', 'b.m4a']],
    ['Other', ['c.ogg']],
    [LOOSE_FOLDER, ['d.wav']],
  ]);
  assert.equal(skipped, 2);
  assert.deepEqual(groupPicks([{ name: 'z.mp3', size: 1 }], 'Mixtape').folders.map((g) => g.name), ['Mixtape']);
  assert.deepEqual(groupPicks([]).folders, []);
});

test('titles sort the way people count', () => {
  const list = [{ title: 'Track 10' }, { title: 'track 2' }, { title: 'Track 1' }, { title: 'Ōtsuki' }];
  list.sort(byTitle);
  assert.deepEqual(list.map((t) => t.title), ['Ōtsuki', 'Track 1', 'track 2', 'Track 10']);
});

test('what needs the Japanese face, sizes and clocks read well', () => {
  assert.ok(needsJp('直線エスケープ') && needsJp('Mix 夜'));
  assert.ok(!needsJp('Night Drive') && !needsJp('Café Ōtsuki'));
  assert.equal(sizeText(900), '900 B');
  assert.equal(sizeText(1536), '2 KB');
  assert.equal(sizeText(5.5 * 1024 * 1024), '5.5 MB');
  assert.equal(sizeText(3 * 1024 ** 3), '3.00 GB');
  assert.equal(clockText(83.4), '1:23');
  assert.equal(clockText(0), '0:00');
  assert.equal(clockText(3605), '60:05');
  assert.equal(clockText(NaN), '--:--');
  assert.equal(clockText(-1), '--:--');
});

test('a mood switched on keeps the order of the moods, and off leaves the others', () => {
  assert.deepEqual(toggleMood(['pursuit'], 'menu'), ['menu', 'pursuit']);
  assert.deepEqual(toggleMood(['menu', 'cruise', 'pursuit'], 'cruise'), ['menu', 'pursuit']);
  assert.deepEqual(toggleMood([], 'intense'), ['intense']);
  assert.deepEqual(toggleMood([...MOODS], 'menu'), MOODS.slice(1));
});

const folderList = () => [
  { id: 'chill', name: 'Chill', moods: ['cruise', 'menu'], enabled: true },
  { id: 'chase', name: 'Chase', moods: ['pursuit'], enabled: true },
  { id: 'u-mine', name: 'Mine', moods: [...MOODS], enabled: true, user: true },
];

test('the settings are saved and put back, and anything that no longer fits is left out', () => {
  const folders = folderList();
  const opts = { vocals: false, shuffle: false, lock: 'chase' };
  folders[0].enabled = false;
  folders[2].moods = ['intense'];
  const saved = JSON.parse(JSON.stringify(snapshotPrefs(folders, opts)));
  const fresh = folderList();
  const o2 = { vocals: true, shuffle: true, lock: null };
  applyPrefs(fresh, o2, saved);
  assert.deepEqual(o2, { vocals: false, shuffle: false, lock: 'chase' });
  assert.equal(fresh[0].enabled, false);
  assert.deepEqual(fresh[2].moods, ['intense']);
  assert.deepEqual(fresh[1].moods, ['pursuit']);

  const odd = folderList();
  const o3 = { vocals: true, shuffle: true, lock: null };
  applyPrefs(odd, o3, { vocals: 'yes', lock: 'gone', folders: { chill: { enabled: 1, moods: ['cruise', 'disco'] }, gone: { enabled: false, moods: [] }, 'u-mine': 'broken' } });
  assert.deepEqual(o3, { vocals: true, shuffle: true, lock: null }, 'a wrong type or a lock on a missing folder changes nothing');
  assert.deepEqual(odd[0].moods, ['cruise'], 'a mood that does not exist is dropped');
  assert.equal(odd[0].enabled, true);
  assert.deepEqual(odd[2].moods, [...MOODS]);
  applyPrefs(odd, o3, null);
  applyPrefs(odd, o3, 'nonsense');
  applyPrefs(odd, o3, { folders: { chase: { moods: [] } } });
  assert.deepEqual(odd[1].moods, [], 'a folder switched off for every mood is saved that way');
});

test('the marks on songs (which have a singer) are saved and put back on the songs that still exist', () => {
  const tracks = [{ id: 'a', vocal: false }, { id: 'b', vocal: true }, { id: 'c', vocal: false }];
  const o = () => ({ vocals: true, shuffle: true, lock: null });
  const saved = JSON.parse(JSON.stringify(snapshotPrefs(folderList(), o(), { a: true, b: false, gone: true })));
  const marks = applyPrefs(folderList(), o(), saved, tracks);
  assert.deepEqual(tracks.map((x) => x.vocal), [true, false, false]);
  assert.deepEqual(marks, { a: true, b: false }, 'a song that is gone is dropped');
  assert.deepEqual(applyPrefs(folderList(), o(), { marks: { a: 'maybe' } }, tracks), {}, 'a mark that is not true or false is ignored');
  assert.equal(snapshotPrefs(folderList(), o()).marks.a, undefined);
});

test('a folder\'s roles are the folder\'s to change: its songs follow, unless a song names its own', () => {
  const tracks = SOUNDTRACK.slice();
  const folders = FOLDERS.slice();
  const opts = { ...OPTIONS };
  try {
    const fl = folderList();
    const mk = (id, folder, extra = {}) => ({ id, title: id, file: id, folder, moods: [], mood: 'cruise', lufs: -16, ...extra });
    setSoundtrack([mk('a', 'chill'), mk('b', 'chase'), mk('mine', 'u-mine', { user: true, url: 'blob:x' }), mk('own', 'chill', { own: true, moods: ['pursuit'] })], fl);
    Object.assign(OPTIONS, { vocals: true, shuffle: true, lock: null });
    const ids = (mood) => poolFor(mood).map((t) => t.id).sort().join(',');
    assert.equal(ids('cruise'), 'a,mine');
    assert.equal(ids('pursuit'), 'b,mine,own');
    assert.deepEqual(rolesOf(SOUNDTRACK[0]), ['cruise', 'menu']);
    fl[2].moods = ['intense'];
    assert.equal(ids('cruise'), 'a', 'the user folder no longer plays for the drive');
    assert.equal(ids('intense'), 'mine');
    assert.equal(ids('pursuit'), 'b,own');
    fl[2].moods = [];
    assert.equal(ids('intense'), 'a', 'a folder with no roles plays for nothing, and the nearest mood stands in');
    OPTIONS.lock = 'u-mine';
    assert.equal(ids('cruise'), 'mine', 'but locked it plays on its own');
    fl[1].enabled = false;
    OPTIONS.lock = null;
    assert.equal(ids('pursuit'), 'own', 'a folder that is off plays for nothing');
  } finally {
    SOUNDTRACK.splice(0, SOUNDTRACK.length, ...tracks);
    FOLDERS.splice(0, FOLDERS.length, ...folders);
    Object.assign(OPTIONS, opts);
  }
});
