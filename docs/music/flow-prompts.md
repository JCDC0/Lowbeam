# Soundtrack prompts: the new lineup

The plan is in `docs/agents/tasks/C8-soundtrack.md` (the moods, the code, the file rules). This file is
what to paste into the music generator (Google Flow, or any text-to-music tool with a style prompt and
a lyrics box). Twenty-four tracks and two stingers in five moods; ten have vocals, fourteen do not.

I do not know the generator's field names or length limits. Each track below is a **Style prompt**
(paste it as the description or style) and, for the vocal ones, **Lyrics** (paste them in the lyrics box
with the section tags). If the style box is short, cut the prompt to its first two sentences and keep
the BPM and the instrument list.

## Rules for every track

- Length 2:30 to 3:30. Stereo. No spoken intro and no silence at the start: the track starts on the
  beat inside one second (a pursuit track starts at full energy, a cruise track may breathe in over 4 s).
- It ends on a clean final chord or a short tail, not a fade-out, because the game crossfades by itself.
- No real artist, band, game or song named in a prompt, and no sample of a real song. The tool will
  refuse or imitate; either is a problem for a game we publish.
- Make three or four takes of each and keep the best. Name the file by its id: `cruise-01.mp3`.
- Keep a note of where each came from (tool, date, the plan's terms): the shipping checklist needs the
  music's license to be clear, and a track made on a free tier may not allow public use. Check the tool's
  terms before anything is committed.
- Append this to every style prompt: `Studio-quality stereo mix, modern punchy mastering, clean ending.`
  Append `Instrumental, no vocals, no choir, no spoken words.` to the instrumentals, and
  `Clear, intelligible lead vocal.` to the vocal ones.

## The lineup

| Mood | Plays when | Tracks | Vocal |
|---|---|---|---|
| `menu` | title, garage, settings, map | 3 | 1 |
| `cruise` | the chill night drive | 6 | 3 |
| `intense` | a street race, a rival close, going fast | 5 | 3 |
| `mountain` | Kuro Pass, the rally | 4 | 1 |
| `pursuit` | a police chase (heat 1 to 3: tier A, heat 4 and 5: tier B) | 6 | 2 |
| stingers | escaped, busted | 2 | 0 |

---

## menu (3)

**menu-01 · Garage Lights** (instrumental, 84 BPM)
Style: Downtempo night-city instrumental, 84 BPM, warm Rhodes chords, soft vinyl-textured drums, a slow
sub bass, a faint arpeggiated synth far back, the feeling of a garage at midnight with the shutter half
open and rain outside. Calm, a little lonely, inviting. Gentle build, no drop.

**menu-02 · Kurogane (Neon Lobby)** (vocal, English, 92 BPM)
Style: Dreamy synth-pop with a soft female lead vocal, 92 BPM, warm analog pads, a clean muted guitar,
a light four-on-the-floor kick, a wide chorus. Late-night city, intimate, hopeful.
Lyrics:
```
[Verse 1]
Garage light flickers on the chrome
Engine ticking, cooling slow
City hums a lullaby
For everyone with nowhere to go

[Chorus]
Take me out where the road runs long
Where the neon bleeds into the dawn
Start the night, start it over
Kurogane, hold me closer

[Verse 2]
Rain on the glass, a quiet street
Keys in my hand, a thousand ways
Every light on the avenue
Is a promise that it stays

[Chorus]
Take me out where the road runs long
Where the neon bleeds into the dawn
Start the night, start it over
Kurogane, hold me closer

[Bridge]
Don't say where we're going
Just say we're going

[Chorus]
Take me out where the road runs long
Where the neon bleeds into the dawn
Start the night, start it over
Kurogane, hold me closer
```

**menu-03 · Pit Lane Dust** (instrumental, 100 BPM)
Style: Laid-back instrumental hip-hop with a late-night garage feel, 100 BPM, dusty drums, a mellow
electric piano loop, a round bass, a touch of tape saturation, a tiny guitar lick every eight bars.
Warm and unhurried, loopable.

---

## cruise (6): the chill night drive

**cruise-01 · Midnight Coast Road** (instrumental, 96 BPM)
Style: Instrumental synthwave night drive, 96 BPM, warm analog pads, gated snare, a rolling arpeggiated
bass, a reverb-soaked clean lead guitar, the feeling of an empty coastal highway under neon, relaxed
forward motion. A slow build to a bright lift at 1:30, then it settles back.

**cruise-02 · Tail Lights in the Rain** (vocal, English, 104 BPM)
Style: Dream-pop and electronic with a breathy male-female duet, 104 BPM, shimmering synths, a soft
side-chained bass, a crisp clap, distant guitar swells. Wet roads, red tail lights, calm and
a little bittersweet.
Lyrics:
```
[Verse 1]
Red lights bleeding down the wet street
Wipers keeping time with my heart
Nobody asking where we're headed
We're already past the start

[Pre-Chorus]
And the radio's low
And the road is slow
And I don't want it to end

[Chorus]
Follow the tail lights in the rain
Every mile is a way to stay
Follow the tail lights in the rain
Till the city forgets our names

[Verse 2]
Bridges humming under the tires
Harbor glowing on the left
All the things I meant to tell you
Are easy to leave unsaid

[Chorus]
Follow the tail lights in the rain
Every mile is a way to stay
Follow the tail lights in the rain
Till the city forgets our names

[Bridge]
One more exit
One more light
One more hour of the night

[Chorus]
Follow the tail lights in the rain
Every mile is a way to stay
Follow the tail lights in the rain
Till the city forgets our names
```

**cruise-03 · Route One, 2 AM** (instrumental, 118 BPM)
Style: Deep, chilled house instrumental, 118 BPM, a soft four-on-the-floor kick, a rolling filtered bass,
warm chord stabs, a airy pad, a slow filter sweep, a sense of speed without aggression. Empty expressway,
tunnel lights passing. Hypnotic, loopable.

**cruise-04 · 夜の高速 (Yoru no Kōsoku)** (vocal, Japanese, 108 BPM)
Style: Japanese city pop with a smooth female lead vocal in Japanese, 108 BPM, slap-style bass, bright
funky guitar, glossy electric piano, a brass stab, lush strings in the chorus. Warm, nostalgic and
breezy, a night expressway by the sea.
Lyrics:
```
[Verse 1]
夜の高速 光の川
窓を開ければ 海の匂い
ラジオから流れる あの頃の歌
このまま どこまでも

[Chorus]
アクセル踏んで 夢の続き
ネオンの波を 抜けていく
夜が明けるまで 二人きり
どこまでも 走ろう

[Verse 2]
ミラーに映る 街の灯り
遠ざかるほど 綺麗に見える
言葉はいらない 風があるから
このまま どこまでも

[Chorus]
アクセル踏んで 夢の続き
ネオンの波を 抜けていく
夜が明けるまで 二人きり
どこまでも 走ろう
```
(Pronunciation help if the tool needs it: yoru no kōsoku, hikari no kawa; mado o akereba, umi no nioi;
akuseru funde, yume no tsuzuki; neon no nami o nukete iku; yo ga akeru made, futari kiri.)

**cruise-05 · Harbor Lights** (instrumental, 90 BPM)
Style: Mellow jazz-fusion night drive, 90 BPM, a warm electric piano, a fretless-style bass, brushed
drums with a soft backbeat, a muted trumpet far back, vibraphone sparkle. Smoky, elegant, a slow
cruise past the harbor at 1 AM.

**cruise-06 · Empty Avenue** (vocal, English, 86 BPM)
Style: Smooth neo-soul and R&B with a warm male lead vocal, 86 BPM, a deep sub bass, a soft snare,
glassy keys, a late-night guitar, tasteful backing vocals. Alone in the car with the city asleep,
confident and relaxed.
Lyrics:
```
[Verse 1]
Empty avenue, the lights all green
Nobody on the road but me
City's sleeping, I'm wide awake
Got the windows down and the heart set free

[Chorus]
It's just me and the empty avenue
Every block feels like it's mine
Slow it down, there's nothing to prove
Midnight's got me feeling fine

[Verse 2]
Crosswalk ghosts and a vending glow
Sixty on the clock is plenty fast
Some nights you drive to get somewhere
Some nights you drive to make it last

[Chorus]
It's just me and the empty avenue
Every block feels like it's mine
Slow it down, there's nothing to prove
Midnight's got me feeling fine

[Outro]
Empty avenue
Empty avenue
```

---

## intense (5): a street race, a rival close, going fast

**intense-01 · Redline Rival** (vocal, English, 140 BPM)
Style: Electro-rock racing anthem with a powerful male vocal, 140 BPM, distorted guitar riff, a pounding
live-and-electronic drum kit, a driving saw-synth bass, huge shouted chorus, a build-up riser into each
chorus. Street racing at night, aggressive and exciting.
Lyrics:
```
[Verse 1]
Headlights burning in the mirror
Engine screaming, going higher
Every gear is a fire
Every corner is a wire

[Pre-Chorus]
You on my bumper
I won't back down
Pedal to the floor
Take the whole town

[Chorus]
Redline, redline, rival
Only one of us survives
Redline, redline, rival
Burn the night alive

[Verse 2]
Neon smeared across the glass
Tach needle trembling past
Nothing left to lose
Nothing left to ask

[Chorus]
Redline, redline, rival
Only one of us survives
Redline, redline, rival
Burn the night alive

[Bridge]
Hold the line
Hold the line
Feel it shake
It's now or never

[Chorus]
Redline, redline, rival
Only one of us survives
Redline, redline, rival
Burn the night alive
```

**intense-02 · Slipstream** (instrumental, 174 BPM)
Style: Liquid-edged drum and bass racing instrumental, 174 BPM, fast breakbeats, a rolling reese bass, a
glassy lead, tension risers, a switch-up at 1:20 into a half-time drop and back. Speed, wind, headlights
in the dark. Relentless.

**intense-03 · Nitro Hearts** (vocal, English, 150 BPM)
Style: High-energy electropop-punk with a bright female lead vocal, 150 BPM, fast palm-muted guitars,
a sequenced synth bass, a driving four-on-the-floor kick with snare rolls, a gang-shout chorus. Joyful and
reckless, a race you are winning.
Lyrics:
```
[Verse 1]
Press it down, the needle's flying
Light the engine, light the sky
Every streetlamp is a starting gun
And I'm not asking why

[Chorus]
Nitro hearts, nitro hearts
Racing through the dark
Nitro hearts, nitro hearts
Never going to stop

[Verse 2]
Rival's close but I don't care
I can hear the finish line
Hands are steady, eyes are clear
Tonight the road is mine

[Chorus]
Nitro hearts, nitro hearts
Racing through the dark
Nitro hearts, nitro hearts
Never going to stop

[Bridge]
Three, two, one
Hold your breath
Here we go

[Chorus]
Nitro hearts, nitro hearts
Racing through the dark
Nitro hearts, nitro hearts
Never going to stop
```

**intense-04 · Overtake** (instrumental, 128 BPM)
Style: Big-room electro house and breakbeat instrumental, 128 BPM, a punchy kick, a growling mid bass,
rave stabs, a siren-free build with snare rolls, two drops, a short breakdown with a spacious pad. Fast
traffic weaving, pure momentum.

**intense-05 · Last Gear** (vocal, English, 132 BPM)
Style: Heavy industrial rock with a gritty, intense male vocal, 132 BPM, a crunchy low-tuned guitar, a
pulsing distorted synth bass, a tight mechanical drum beat, sparse electronic glitches. Cold, tense
and dangerous.
Lyrics:
```
[Verse 1]
Cold steel, hot asphalt
Fingers locked on the wheel
No mercy in the mirror
No brakes I'm going to feel

[Chorus]
Last gear, last gear
Nothing left to shift
Last gear, last gear
Take the final lift

[Verse 2]
Wire tight, nerves bright
Every second is a mile
If I'm going down tonight
I'm going down in style

[Chorus]
Last gear, last gear
Nothing left to shift
Last gear, last gear
Take the final lift

[Bridge]
Don't look back
Don't look back
Just one more turn

[Chorus]
Last gear, last gear
Nothing left to shift
Last gear, last gear
Take the final lift
```

---

## mountain (4): Kuro Pass and the rally

**mountain-01 · Hairpin Hymn** (instrumental, 158 BPM)
Style: High-energy eurobeat-inspired instrumental, 158 BPM, a driving synth-bass, bright saw-lead
melody, a fast disco-style hi-hat, stacked synth stabs, a key change for the last chorus. A fast descent
through hairpins at night, joyful and relentless.

**mountain-02 · Drift Line** (vocal, English, 156 BPM)
Style: Energetic eurobeat with a high, powerful vocal, 156 BPM, a fast sequenced bass, bright synth
leads, a punchy snare, a soaring chorus with a vocal harmony. A mountain pass at night, drifting through
bends.
Lyrics:
```
[Verse 1]
Mountain road, midnight sky
Tires singing, going by
Taking every corner wide
Nothing left to hold inside

[Chorus]
Drift line, drift line
Sliding through the night
Drift line, drift line
Hold it, hold it tight

[Verse 2]
Guard rail flashing in the light
Hairpin turn and out of sight
Heart is racing, wheels are free
This is where I'm meant to be

[Chorus]
Drift line, drift line
Sliding through the night
Drift line, drift line
Hold it, hold it tight

[Bridge]
Down the mountain
Down the mountain
Faster

[Chorus]
Drift line, drift line
Sliding through the night
Drift line, drift line
Hold it, hold it tight
```

**mountain-03 · Fog on the Pass** (instrumental, 142 BPM)
Style: Tense driving synth-rock instrumental, 142 BPM, a palm-muted clean-to-crunch guitar, a pulsing
analog bass, a tight snare, a haunted pad that swells like fog, an urgent lead that answers the guitar.
Narrow mountain road, wet leaves, visibility low.

**mountain-04 · Downhill Ghost** (instrumental, 140 BPM)
Style: Driving trance-techno instrumental, 140 BPM, a rolling bass, a hypnotic arpeggio, a long
filtered build to a euphoric lead, crisp hats, a short breakdown with a spacious pad. A time-attack
run on a dark mountain, flow and focus.

---

## pursuit (6): a police chase

Start at full energy inside two seconds. These must be heard under sirens, so keep the lead melody out of
the siren's range (a steady 600 to 1,400 Hz wail): bass, drums and low guitar or strings carry the
track; the lead plays above or below it. Tier A plays at heat 1 to 3, tier B at heat 4 and 5.

**pursuit-01 · Sirens in the Mirror** (tier A, instrumental, 132 BPM)
Style: Rock and electronic hybrid police-chase instrumental, 132 BPM, a relentless palm-muted guitar
and bass ostinato, punchy live drums with a driving four-on-the-floor, a tense staccato string pulse,
short brass hits on the off-beats, a rising synth tension riser every eight bars. Urgent, exciting,
a chase that is winnable.

**pursuit-02 · Caught in the Spotlight** (tier A, vocal, English, 134 BPM)
Style: Anthemic alt-rock and electronic with a powerful, urgent male vocal, 134 BPM, a driving guitar
riff, a pulsing synth bass, a big snare, a stadium chorus with gang vocals. Blue and red lights on the
wall, running from the law, thrilling, not grim.
Lyrics:
```
[Verse 1]
Blue and red on the wall behind me
Radio crackling in the dark
Every light is turning against me
But I'm too fast to leave a mark

[Pre-Chorus]
Hear them calling
Hear them close
Never slowing
Never slowing

[Chorus]
Caught in the spotlight, run
Caught in the spotlight, run
Every street's a chance to fly
Every turn I'm testing the sky

[Verse 2]
Roadblocks waiting up ahead
I find the gap and I'm through
Helicopter overhead
But it can't see what I do

[Chorus]
Caught in the spotlight, run
Caught in the spotlight, run
Every street's a chance to fly
Every turn I'm testing the sky

[Bridge]
They won't catch me
They won't catch me
Not tonight

[Chorus]
Caught in the spotlight, run
Caught in the spotlight, run
Every street's a chance to fly
Every turn I'm testing the sky
```

**pursuit-03 · Cut Through Traffic** (tier A, instrumental, 140 BPM)
Style: Big-beat breakbeat chase instrumental, 140 BPM, a punchy funk-breaks drum loop, a distorted
walking bass, a wah guitar stab, a pulsing low brass, cowbell and tom fills, a quick switch-up every 16
bars. Playful menace, weaving through traffic with the police behind.

**pursuit-04 · All Units Respond** (tier B, instrumental, 146 BPM)
Style: Cinematic hybrid-orchestral and industrial police-chase instrumental, 146 BPM, a low string
ostinato, heavy cinematic percussion with taiko hits, a distorted sub-bass, brass stabs, a pulsing
electronic rhythm, a huge build and drop every 32 bars. Maximum pressure, many units, no way out.

**pursuit-05 · Rotor Wash** (tier B, instrumental, 150 BPM)
Style: Dark drum-and-bass and trap hybrid instrumental, 150 BPM, a heavy sub-bass, a rapid snare roll
pattern, a pulsing rotor-like synth that throbs in time, a sparse metallic lead, huge impact hits,
a half-time drop. A helicopter spotlight on the road, a real chase at heat five.

**pursuit-06 · No Way Out** (tier B, vocal, English, 138 BPM)
Style: Aggressive electro-rock with a fierce, gritty male vocal and gang chants, 138 BPM, a crushing
low guitar, a distorted synth bass, a hard-hitting drum kit, a half-time chorus drop. The whole
force on the player's tail; desperate and defiant.
Lyrics:
```
[Verse 1]
Roadblock, spikes, a wall of light
Every siren sings my name
No way out, but I'm not done
I never learned to play the game

[Chorus]
No way out, no way out
Shout it to the sky
No way out, no way out
We'll burn before we lie

[Verse 2]
Engine hot and tires tearing
Nothing left but the road
Fire in the rearview mirror
This is the way we go

[Chorus]
No way out, no way out
Shout it to the sky
No way out, no way out
We'll burn before we lie

[Bridge]
Break the line
Break the line
Through the fire

[Chorus]
No way out, no way out
Shout it to the sky
No way out, no way out
We'll burn before we lie
```

---

## stingers (2)

Short, 3 to 5 seconds, an instrument-led hit with a tail, played over the music for a moment.

**sting-escaped** (4 s)
Style: A short victory sting, 4 seconds, a rising synth swell into a bright major chord with a shimmering
tail and a soft low impact. Relief, escape, a breath out. No vocals, no beat.

**sting-busted** (4 s)
Style: A short defeat sting, 4 seconds, a heavy low brass and sub impact, a descending minor synth
sweep, a short metallic tail. Final, a door closing. No vocals, no beat.
