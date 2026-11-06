# BASELINE — Game Design Document

*Working title "Baseline". Repo: `cheaptennis`. A school project. All art, audio, names and events are original and generated in code.*

---

## 0. Pitch & core verbs

**Pitch:** A bright, instantly readable arcade tennis game seen from a fixed broadcast camera, with timing feedback, shot types and stamina layered on top, and a career that climbs a fictional pro tour run on real ranking rules all the way to the four Majors.

**Core verbs:** **move** (arrows), **time the swing** (Space), **aim** (the arrow held at contact), **pick a shot type** (Z/X/C/V), **serve** (Space toss, Space hit).

Everything serves the swing. The moment of contact must feel crisp, legible and fair: the player always knows *why* a shot went where it went.

### Core loop at 3 scales
| Scale | Loop |
|---|---|
| **5 seconds** | Read the incoming ball → move to it → hold an aim direction → press a shot key at the right moment → see the timing grade + reason → recover to position. |
| **1 minute** | Points and games: serve or return, build a rally, manage stamina across a long point, win the game, short changeover recovery. |
| **10 minutes** | A match (default first to 3 games), then: the next bracket round, the career week's result, ranking movement, XP and skill points to spend. |

---

## 1. Presentation ("fantasy console" spec)

| Item | Value |
|---|---|
| Internal resolution | **640×480** (4:3) offscreen canvas |
| Display | Scaled to fit the window with smooth (bilinear) scaling and devicePixelRatio support; the 4:3 play area sits between **dark letterbox bars** on wide screens. Not pixelated: clean flash-era vector look. |
| Rendering | Canvas2D, all procedural: gradients, arcs, paths. Static layers (sky, stadium, court, stands) pre-rendered per surface to offscreen canvases; only players, ball, crowd motion, particles and UI are drawn per frame. |
| Text | Canvas text in a bold rounded system stack (`"Arial Rounded MT Bold", "Trebuchet MS", Verdana, sans-serif`, weight 800) with a dark outline for legibility. No web fonts (works offline). |
| Palette | Free colour, but a disciplined set: sky blues, two grass greens (mow stripes), clay terracotta pair, hard-court blue/green pair, crisp white lines, dark net, yellow posts, white kit, orange stat bars, dark translucent panels (`rgba(10,20,40,0.75)`). |
| Frame rate | Fixed 60 Hz simulation with accumulator (delta clamped to 250 ms), render every animation frame. |
| Audio | Web Audio: synthesized SFX + a 4-channel chip tracker for music. |

### Camera
A fixed, high, slightly tilted broadcast camera behind the near baseline. A real pinhole projection of court-space metres (x across, y along the court, z up):
- Camera at `(0, -38 m, 25.5 m)` aimed just beyond the net (focal 955 px); tuned so the **whole court, both players and the stand edges** fit in 640×480.
- Result: the far baseline is narrower than the near one (lines converge gently), the far player is drawn ~65% the size of the near one, and ball height (z) lifts the ball off its shadow on screen.
- The ball always has a soft round shadow on the ground at `(x, y, 0)`: the shadow is the player's key depth cue.

### Visual style
- **Court:** grass = mowed stripes in two alternating greens across the court; **clay** = terracotta with subtle brushed texture and darker line-adjacent dust; **hard** = blue court inside a green surround. Crisp white lines (doubles court drawn, singles played). Dark mesh net with white tape and **yellow posts**.
- **Players (M18 restyle):** chunky, stylised athletes with a big head (about a quarter of the height), short legs and an oversized racket (~1.5× real scale) with a visible string bed. The frame is tinted in the player's band colour. Limbs are shaded capsules lit from the upper left, and the shirt is rounded with sleeve caps and a trim stripe. Kit colours are customisable, with a round drop shadow underneath. This is an original design inspired by the general big-racket / small-player style of casual browser tennis games; no other game's art is copied.
- **Animations** (procedural keyframed poses, interpolated): idle bounce, run (with lean), split step, serve (toss, trophy pose, strike), volley punch, overhead, dive/stretch, celebration and tired slump. The ground strokes are clearly distinct:
  - **Forehand:** unit turn with the off arm pointing at the ball, low-to-high swing, finish wrapped over the opposite shoulder.
  - **Two-handed backhand:** both hands on the grip from the take-back to a high finish.
  - **One-handed backhand:** off hand on the throat during the take-back, off arm thrown back for balance at the finish.
  - **Slice:** a one-handed high-to-low swing on both wings.
  - **Drop shot:** a short, soft slice.
  - **Lob:** an open-face swing with a high finish.

  Left-handers and far (front-view) players are mirrored. *(pose gallery: e2e/art.spec)*
- **Stands & crowd:** tiered stands along both sidelines and behind the far baseline; crowd as small coloured head/shoulder blobs that bob idly, rise and wave on great points, and turn their heads to follow the ball.
- **Venues (M18, `src/data/venues.ts`):**
  - **Themes by surface:**
    - grass: cream stands, dark green and purple, ivy along the walls
    - clay: terracotta and navy, an open-air bowl
    - hard: blue and teal, with a **night session** option in Exhibition (darkened stands, floodlit court)
  - **Sponsor boards** in the classic pro-event look, with made-up brands only (no real trademarks):
    - dark boards with metallic lettering on the back and side walls
    - a big analogue **clock board** (CHRONOVA) showing the real time
    - a live **SERVE SPEED** display
  - **Majors and the Tour Finals** add:
    - taller, fuller stands
    - banners on the side stands
    - the event name painted behind each baseline
    - photographers at courtside
  - **Atmosphere builds through the event** (`stage` 0 = first round … 1 = final): fewer empty seats, louder applause and more camera flashes in later rounds. From the quarterfinals on there is a walk-on card ("FINAL • CENTRE COURT"). After match point in a final, the stadium erupts in camera flashes.
- **Effects:** ball trail on power and PERFECT shots; clay dust puff on bounces/slides; grass wear (worn brown patches accumulate around the baselines during a match); sweat particles when tired; small hitstop + screen kick on PERFECT; smooth fade/slide transitions between all screens.

### Screens (in order)
1. **Title:** sky-blue gradient with drifting puffy white clouds over a view of the stadium and court; big bold rounded "BASELINE" logo with a ball-in-motion swoosh; a short "How to play" blurb ("Arrows move · Space swings · hold an arrow to aim · Z X C V for spin, slice, lob, drop"); dark translucent menu panel with white bold rounded items: **Exhibition / Tournament / Career / Versus / Practice / Options**.
2. **Setup screens** per mode (surface, length, difficulty, opponent).
3. **Stat comparison card** before every match: both players' names, flags-free fictional "home city", **Forehand / Backhand / Serve / Footwork** as orange bars rated 1–10, OVR, surface icon, "Press Space".
4. **Match view:** full court, minimal HUD.
5. **Results** screens (match result, bracket, trophy, career week summary).

### In-match HUD (minimal)
- **Scoreboard (M18, top-left, broadcast style):** one row per player (far player on top), each with:
  - a kit-colour chip, the name and career ranking
  - a serve ball next to the server
  - completed set scores (the winner's number bright)
  - the current games in a highlighted column
  - the point score in a gold box (0/15/30/40/AD, or tiebreak points)

  The point box flashes when the score changes. On big points a tab slides out to the right: **BREAK POINT / SET POINT (GAME POINT in short formats) / MATCH POINT / TIEBREAK** (`Score.pressureLabel`).
- **Stamina:** two small bars (far player under the scoreboard, near player bottom-left), green → yellow → **red** when low, pulsing when critical.
- **"SPACE skip"** hint bottom-right whenever the time between points can be skipped.
- **Timing popup:** small arc meter by the hitting player + a text popup with the grade and reason.
- **Umpire calls:** centred pop-up text ("OUT!", "FAULT!", "LET", "DEUCE", "ADVANTAGE YOU", "GAME", "SET", "MATCH").
- Optional **Training HUD:** predicted landing spot marker and the timing window band on the arc meter.

---

## 2. Match gameplay

### 2.1 Controls (defaults, all rebindable in Options)
| Action | Keyboard (single player) | Gamepad |
|---|---|---|
| Move | Arrow keys | Left stick / D-pad |
| Aim (held at contact) | Arrow keys: ←/→ angle, ↑ deep, ↓ short | Stick / D-pad |
| Normal shot | Space | A |
| Topspin | Z | X |
| Slice | X | B |
| Lob | C | Y |
| Drop shot | V | RB |
| Serve | Space = toss, Space = hit; ←/→ direction; hold Z = kick serve, hold X = slice serve | A toss/hit; hold X/B |
| Pause | Esc / P | Start |

**Versus keyboard split:** P1 = WASD move/aim, F normal, G topspin, H slice, J lob, K drop. P2 = arrows move/aim, Numpad 1/2/3/4/5 (or digit row 1/2/3/4/5) = normal/topspin/slice/lob/drop. Two gamepads: pad 0 = P1, pad 1 = P2.

Auto-facing: the player automatically uses forehand or backhand depending on which side of the body the ball arrives on (handedness-aware). Movement uses acceleration/deceleration curves tuned to feel instant (reach full speed in ~0.12 s, stop in ~0.08 s), with a **split step** auto-triggered as the opponent strikes.

### 2.2 Ball physics (true 3D)
- State: position `(x, y, z)` metres, velocity, and **spin** (scalar: + topspin, − backspin; and a small sidespin term for slice serves).
- Forces per 60 Hz step: gravity 9.81 m/s², quadratic air drag, Magnus approximation (`az -= k_spin * spin * |v|`: topspin dips, backspin floats).
- **Bounce:** `vz' = -vz * e_surface`; horizontal speed multiplied by surface friction; spin converts: topspin kicks forward and higher, backspin skids low and slows (or checks up for drop shots). Spin decays after the bounce.
- Net: a collision plane at `y = 0`, height 0.914 m at centre to 1.07 m at posts. Net-cord hits deflect and slow (lets on serves).
- Line calls: a ball whose contact patch touches the line is IN (ball radius counted).

### 2.3 Surfaces
| Surface | Bounce restitution | Post-bounce speed kept | Footing (accel / slide) | Character |
|---|---|---|---|---|
| **Grass** (default) | low (0.68) | high (0.82) | slight slip, normal | fast and low: rewards serve, slice and net play |
| **Clay** | high (0.80) | low (0.66) | lower grip; slides into wide balls with dust | slow and high: rewards topspin, defence, stamina |
| **Hard** | medium (0.75) | medium (0.74) | full grip | neutral |

Spin multipliers per surface amplify the topspin kick on clay and the slice skid on grass. All values live in `src/data/surfaces.ts`.

### 2.4 The shot model
Shots are **target-driven**, then perturbed by error, so they're predictable for the player and fair for the AI:
1. **Target:** start from a base depth/width for the shot type; the held aim direction shifts it (←/→ = cross/down-the-line angle up to the sidelines, ↑ = deep toward the baseline, ↓ = short toward the service line). No aim = a safe central-deep target.
2. **Trajectory solve:** given the target and a desired net clearance/apex per shot type, solve for the launch velocity (iterative ballistic solve that includes drag and spin dip, done once at contact).
3. **Modifiers:** pace from the stat (forehand/backhand/volley/touch) × timing grade × stamina × footwork (standing vs. running) × contact height (ideal waist height, penalties for low/high).
4. **Error cone:** angular and depth noise scaled by timing grade, stats, stamina and being off-balance. PERFECT tightens it sharply.

| Shot | Key | Flight | Bounce | Use |
|---|---|---|---|---|
| **Normal** | Space | medium arc, medium pace | normal | default rally ball |
| **Topspin** | Z | higher over the net, dips hard | **high, kicks forward** | safe margin, push opponents back |
| **Slice** | X | low and slower, floats slightly | **low skid**, slows | defence, approach shots, change of pace |
| **Lob** | C | very high arc | high | over a net-rusher; weak if short |
| **Drop shot** | V | soft, just over the net | **dies** (strong backspin, low second bounce) | wrong-foot a deep opponent; risky from the baseline |

**Volleys** happen automatically when contact is made before the bounce near the net; **overheads** when contact is above ~2.3 m. Volley quality uses the Volley stat; drop/lob use Touch.

### 2.5 Shot timing + feedback (key feature)
- **Ideal contact moment** = the frame the ball reaches the player's contact zone (crossing their hitting plane at reach distance). The swing has a fixed wind-up (`W ≈ 8 frames`), so the ideal press is `W` frames before arrival.
- **offset** = (frames from press to arrival) − W. Positive = early, negative = late.

| Grade | offset window (frames, base) | Effect |
|---|---|---|
| **PERFECT** | within ±2.5 | +18% pace, aim cone ×0.35, 4-frame hitstop, sound sting, ball trail, crowd "ooh" on winners |
| **Good** | within ±6 | normal |
| **Early** | +6 to +13 | ball floats: higher arc, depth error toward long |
| **Late** | −6 to −11 | ball pulled wide toward the far sideline (side depends on forehand/backhand) |
| **Mishit** | +13 to +20 or −11 to −15 | weak, wobbly ball (low pace, random spin, big error) |
| Whiff | beyond that, or out of reach | no contact; the swing recovers after 0.3 s and you may swing again |

- **Window scaling:** the PERFECT/Good windows grow with Mental (and the Clutch badge on big points) and shrink with low stamina and with running at contact.
- **Timing meter:** a small arc beside the hitting player fills as the ball approaches; a white tick marks where the press landed; the Training HUD also shows the PERFECT band.
- **Popup with the main reason**, chosen by whichever factor contributed most error:
  - `PERFECT: +power +accuracy`
  - `GOOD`
  - `EARLY: rushed, floated long`
  - `LATE: ball pulled wide`
  - `MISHIT: framed it`
  - `Off-balance: you were still running`
  - `Stretched: reached too far`
  - `Too low: ball dropped below the knees` / `Jammed: ball too close`
  - `Tired: timing window shrinking`
- **Footwork:** standing (speed < 25% at contact) vs. running; running at contact adds error unless Footwork is high.

### 2.6 Serve
- Positioned at the correct side of the centre mark for the point (deuce/ad). ←/→ before the toss shifts position slightly along the baseline.
- **Space** tosses (the ball rises to ~2.9 m above the court and falls back); **Space** again strikes. Striking at the top of the toss (±4 frames) = full power and accuracy; earlier/later loses both. The toss can be let drop to re-toss (no penalty, once; a second drop is a fault? → No: re-toss allowed, as in real tennis).
- Direction: hold ← / → at the strike = wide / T; neutral = body.
- **Flat** (default): fastest, lowest margin. **Kick** (hold Z): high net clearance, high kicking bounce, safest second serve. **Slice** (hold X): curves wide, skids low on grass.
- **Fault** when it lands outside the service box or hits the net; **double fault**; **LET** when it clips the net cord and lands in (replay the serve).
- First vs. second serve: AI and the timing window are more forgiving on second serves only in the sense that kick serves have a wider safe margin.

### 2.7 Stamina
- 0–100 per player. **Drain:** running (proportional to speed), each shot (more for power/PERFECT-charged and lobs from deep), dives/stretches (big), long rallies (an extra drain per shot after 8 shots). Endurance stat scales all drains.
- **Recovery:** between points (+12), changeovers (+30), set breaks (+50).
- **Effects of low stamina** (below 40%, stronger below 20%): slower top speed and acceleration, narrower PERFECT/Good windows, wider error cone, weaker serves.
- **Shown clearly:** the bar turns yellow then **red** and pulses; sweat particles fly off the player; a slumped breathing idle; a heavy-breathing sound between points; the popup cites "Tired" when it was the main factor.
- Career fatigue lowers the **starting** stamina of a match (see §3.4).

### 2.8 Scoring
Real tennis scoring in a pure, unit-tested module (`src/match/scoring.ts`):
- Points 0/15/30/40, deuce, advantage, game.
- Sets to 6 games, win by 2, **tiebreak at 6-6** (first to 7, win by 2, serve rotation 1-2-2, change of ends logic for stamina breaks every 6 points).
- **Formats:** `1 game`, `first to 3 games` (**exhibition default**, no tiebreak needed: first to 3), `6-game set`, `best of 3 sets`, `best of 5 sets` (Majors in career, optional setting).
- Serve alternates each game. **Changeovers** after odd games (stamina recovery, short "changeover" banner).
- **Ends:** with the fixed camera, the human (or P1) always plays from the near side; changeovers are tracked for stamina and rules but the view does not swap (classic-arcade convention, documented simplification).

### 2.9 AI opponents
- AI reads the ball by forward-simulating the same physics (predict bounce point and reachable contact point), moves there at its Footwork-derived speed, and **recovers** to a style-dependent home position after each shot (deep baseline for grinders, inside the baseline for aggressive baseliners, the net after approach shots for serve-and-volleyers).
- **No cheating physics:** AI uses the same movement limits, reach, stamina and shot model. Its "timing press" is the ideal press plus Gaussian noise whose sigma comes from the relevant stat + difficulty; so it gets Early/Late/Mishit grades too.
- **Shot selection** by archetype and situation: weights for each shot type, aim choice (go to the open court, pick on the weaker wing, lob when the opponent is at the net, drop shot when the opponent is far back), serve-and-volley tendency, serve type on first vs. second serve.
- **Difficulty** (Options: Easy / Normal / Hard / Pro) shifts COM stats and timing noise only.

### 2.9b AI game plans (tactics + blends)
Five tactics based on common singles coaching patterns (all values in `src/data/tactics.ts`):

| Tactic | Pattern | What the COM does |
|---|---|---|
| **Serve + 1** | serve and first forehand as one combination | flat first serves wide/T, then an all-out forehand into the open court; stands close; short points |
| **Forehand Dominance** | run around the backhand, inside-out forehand | shades to its backhand corner, hits ~95% forehands, aims ~70% at your backhand |
| **Baseline Grind** | high-margin crosscourt rallies, deep heavy balls | heavy topspin, crosscourt ~75%, plays safe (lower power), kick serves, long rallies |
| **Net Attack** | serve-and-volley, chip-and-charge | serve-and-volleys ~50%, slices approach shots on short balls, puts volleys away short and angled |
| **Counterpunch & Variety** | retrieve and redirect | defends from deepest, slices, lobs net-rushers, drop shots, passing shots |

- Every COM has a personal **blend** (e.g. *Net Attack 61% / Serve + 1 15% / ...*): its archetype's default mix plus a deterministic per-player twist.
- **Before each point** the COM picks one plan from its blend, weighted by the situation: serving or returning, surface (grass favours Net/Serve + 1, clay favours Grind/Counter), its stamina (tired = shorter points), your weaker wing (fewer Forehand Dominance points if your backhand is solid), your net-rushing (more Counterpunch), and big points (it sticks to its most trusted plan).
- **In-match adaptation:** a plan that wins a point gets more weight and one that loses gets less, anchored to the player's natural style. When the main plan flips, a "CHANGES TACTICS" popup appears.
- **Risk/reward:** attacking plans hit with more power and more error (Serve + 1's first strike: +15% pace); Grind plays safer.
- **Visible:** a `PLAN:` chip under the COM stamina bar every point; the game-plan line on the stat card; a scouting report on the career event screen.
- **Exhibition:** pick the COM's natural blend, any single forced tactic (no adapting), or a random blend.
- **Stat sim:** blends shift point odds slightly by surface fit and matchups (Net beats Grind, Counter beats Net, Serve + 1 beats Counter, Grind beats Serve + 1, Forehand Dominance beats Grind), so tournament and career results reflect styles too.

### 2.9c Speed balance (playtest round 1, M16)
Design rule: **the ball should beat the player.** A well-placed ball wins; a ball hit down the middle doesn't. All values are in `src/data/tuning.ts` (shot paces in `src/match/shots.ts`).
- **Movement:** top speed 4.5 + 1.9 × footwork/99 m/s (was 5.4 + 2.3; ~17% slower). Acceleration 22 m/s² and braking 36 (were 46/64), so full speed takes ~0.3 s and a wrong-footed player must stop before turning. Running back toward your own baseline is capped at 72% speed. Stretch reach is 1.8 m (was 1.95).
- **Ball:** groundstroke base pace +10% (normal 25.3, topspin 23.1, slice 19.5 m/s). PERFECT contact lands 0.7 m deeper and skims lower over the net. First serves go up to ~175-185 km/h (flat 47, kick 34.5, slice 39 m/s base), and serves can be aimed 0.38 m from the lines.
- **Drop shots:** float longer the further back they're hit from (1.4 s + 0.06 s per metre beyond 6 m), land 2.8 m from the net, have less backspin (1.45, was 1.9) and a 0.22 m net margin. A baseline player can now usually reach a drop.
- **Lobs:** fly higher (3.4 m net margin, 1.85 s + 0.3 s per 10 m) and aim deeper (10.6 m). A net player who is lobbed reacts 0.3 s later (turning around). Smashing while backpedalling needs 0.3 s extra to set up. Any ball hit in the air while running back gets up to +220% error and −25% pace ("Off-balance: backpedalling").
- **Returns:** the COM reads a serve 8 frames slower than a rally ball.
- **Bug fix:** an untouched serve that flew past the returner was scored as a plain winner and never called "ACE!".
- **Measured** in `tests/balance.test.ts` (AI vs AI, about 1,600 points over the three surfaces):

| Metric | Before | After |
|---|---|---|
| Average rally (shots) | 6.7-6.9 | 5.3-5.7 |
| Corner shots won outright | 0-2% | 17-19% |
| Shots down the middle won outright | 0-1% | 0-1% |
| Drops won vs. a player at the baseline | 43-71% (PERFECT 50-83%) | 46-70%, about 53% pooled (PERFECT about 59%) |
| Lobs won vs. a net player | 18-39% | 52-58% |
| Aces | 0% (never called) | 3-6% (most on grass) |

### 2.10 Umpire & crowd
Text calls ("OUT!", "FAULT!", "DOUBLE FAULT", "LET", "DEUCE", "ADVANTAGE …", "GAME …", "SET …", "GAME, SET AND MATCH") with synth stings; crowd applause scaled by rally length and shot quality; "ooh" on near misses and PERFECT winners; hush during serves.

---

## 3. Game modes

Title menu: **Exhibition / Tournament / Career / Versus / Practice / Options**.

### 3.1 Exhibition
Quick match vs. COM. Choose surface (Grass/Clay/Hard), length (1 game / 3 games / 6-game set / best of 3) and opponent (random or pick from a list of named COM pros). Stat comparison card first.

### 3.2 Tournament (bracket mode)
- Draw size 8 / 16 / 32, surface, length. Seeded COM field (seeds by OVR; the player enters unseeded or seeded by chosen difficulty).
- **Bracket screen** after each round: lines connect winners, scores shown, the player's path highlighted; COM-vs-COM matches simulated with the same stat-based match simulator used by the career.
- Lose → "Eliminated in R16" screen; win the final → **trophy screen** (spinning procedurally drawn trophy, confetti, victory jingle).

### 3.3 Versus (local multiplayer)
Two humans, same screen (P1 near, P2 far). Keyboard split (see §2.1) and/or two gamepads; device assignment screen ("P1: press a key or button… P2: …"). Same surface/length options. Both players use a default balanced stat line (or pick a COM pro's stats).

### 3.4 Career
#### Phase 1: the tour
- **Create a player:** name, handedness (L/R), backhand (one/two-handed), kit colours (shirt/shorts/headband), skin and hair palettes, home city (fictional list).
- Start **unranked** with low stats (~35 OVR).
- **Tiers** (all values in `src/data/tour.ts`):

| Tier | Real analogue | Draw | Winner pts | Direct entry | Qualifying |
|---|---|---|---|---|---|
| Futures 15 | ITF M15 | 32 | 15 | open to all | – |
| Futures 25 | ITF M25 | 32 | 25 | open to all | – |
| Challenger 75 | Challenger 75 | 32 | 75 | rank ≤ 350 | rank ≤ 550 |
| Challenger 125 | Challenger 125 | 32 | 125 | rank ≤ 220 | rank ≤ 400 |
| Tour 250 | ATP 250 | 32 | 250 | rank ≤ 80 | rank ≤ 200 |
| Tour 500 | ATP 500 | 32 | 500 | rank ≤ 50 | rank ≤ 130 |
| Masters 1000 | ATP Masters 1000 | 64 | 1000 | rank ≤ 45 | rank ≤ 120 |
| Major | Grand Slam | 128 | 2000 | rank ≤ 104 | rank ≤ 240 |
| Tour Finals | ATP Finals | 8 (2 groups of 4 + SF + F) | up to 1500 | year-end top 8 only | – |

- **Points per round** (stored per tier):
  - Major: W 2000 / F 1300 / SF 800 / QF 400 / R16 200 / R32 100 / R64 50 / R128 10; qualifier +30 bonus; qualifying-round losses 16 / 8 / 0.
  - Masters 1000 (64 draw): 1000 / 650 / 400 / 200 / 100 / 50 / 10; qualifier +20.
  - Tour 500: 500 / 330 / 200 / 100 / 50 / 0; qualifier +20.
  - Tour 250: 250 / 165 / 100 / 50 / 25 / 0 (no points for a first-round loss); qualifier +12.
  - Challenger 125: 125 / 75 / 44 / 25 / 13 / 0; qualifier +6.
  - Challenger 75: 75 / 44 / 22 / 12 / 6 / 0; qualifier +3.
  - Futures 25: 25 / 16 / 8 / 3 / 1 / 0.
  - Futures 15: 15 / 8 / 4 / 2 / 1 / 0.
  - Tour Finals: 200 per round-robin win, +400 for the SF win, +500 for winning the final (max 1500).
- Qualifying: a 2-round mini-draw before the main draw (simulated or played).
- **Rankings:** rolling 52 weeks. Each result is stamped with its absolute week (`season × 52 + weekOfYear`); it drops off when the same week comes around next season. Ranking total = **sum of the best 19 results** in the window (Tour Finals counted as an extra 20th result, as in the real system). Ties broken by fewer events, then alphabetically. Unranked = no points.
- **COM field:** 500 fictional pros (the brief said ~300; the pool was extended so the #350 / #550 entry cutoffs are meaningful) (generated with a fixed seed from original syllable-based names and fictional cities), each with stats, archetype, surface preference, age. A **warm-up season** is simulated at career creation so rankings start realistic. Each week every pro enters the best event they're eligible for (with some randomness and rest weeks); every event's draw is filled by rank, simulated with the stat-based match simulator; points are awarded.
- **Calendar:** 52-week year; ~40 active weeks, several events per week across tiers and surfaces, shaped like the real season:
  - Weeks 1–4 hard-court start → **Major 1: "Southern Cross Open"** (hard, weeks 3–4).
  - Weeks 6–10 indoor/hard + spring hard Masters ×2.
  - Weeks 14–22 spring clay with clay Masters ×3 → **Major 2: "Terre Rouge Championships"** (clay, weeks 21–22).
  - Weeks 23–26 short grass swing → **Major 3: "Greenhaven Championships"** (grass, weeks 26–27).
  - Weeks 29–35 summer hard courts with Masters ×2 → **Major 4: "Liberty Open"** (hard, weeks 34–35).
  - Weeks 38–44 indoor autumn swing with Masters ×2.
  - Week 46: **Tour Finals: "Season Finale"** (top 8).
  - Weeks 47–52 off-season (skipped with one click; training allowed).
  - Futures and Challengers run most active weeks on mixed surfaces, so a low-ranked player always has something to play.
  - Majors span 2 weeks (counts as one event).
- **Entry rules:** each calendar entry shows tier, surface, draw size, and cutoff. Ineligible entries show **"Not eligible: rank #X required"** or **"Qualifying only"**. A rare **wildcard offer** (~8% chance per week for a promising young player into a Challenger / Tour 250 / occasionally a Major) appears in the news ticker.
- **Week loop:** Career hub → choose an event (or Rest / Train) → for each round: play the match or quick-sim it → the rest of the field simulates → points, rankings and the **news ticker** update ("You broke into the top 100!", "Wildcard offered into the Liberty Open!", "#3 Varlo Dessin wins Terre Rouge").
- **Saving:** autosave to localStorage (versioned, try/catch) after every week and match; **JSON export/import** on the career hub (download / file picker).

#### Phase 2: archetypes + progression
- At creation pick **Primary + Secondary archetypes**: Big Server, Baseline Grinder, Aggressive Baseliner, Serve-and-Volleyer, Counterpuncher, All-Court Artist, Clay Specialist.
- **Stats (0–99):** core **Forehand, Backhand, Serve, Footwork** (shown as 1–10 bars on the match card: `ceil(stat/10)`), plus **Volley, Touch** (lob/drop), **Spin, Return, Endurance** (stamina), **Mental** (clutch timing window). **OVR** = weighted average.
- **Caps:** each archetype defines a cap profile; the player's cap for a stat = `max(primaryCap, secondaryCap − 8)`, floored at 55. Profiles are designed so no combination reaches 90+ in everything (e.g. Big Server caps Serve 99 / Footwork 72; Counterpuncher caps Footwork 97 / Serve 70).
- **XP:** from matches (base + win bonus, × tier multiplier, + per PERFECT shot) and short **training drills** (Rest/Train week: pick a drill, either quick-sim for a small fixed gain or play a 60-second practice-mode drill for a score-based gain). XP converts to **skill points** (1 SP per 100 XP); each stat point costs 1 SP below 60, 2 SP below 75, 3 SP above.
- **Build screen:** each stat as a bar showing current value vs. cap (ghost bar), +/− to spend points, OVR preview.
- **Badges** (unlocked by milestones, max 3 equipped):
  - **Ace Machine** (serve ≥ 75 and 50 career aces): +4% serve pace, slightly wider ace angle.
  - **Wall** (footwork ≥ 75, win 10 rallies of 12+ shots): +8% reach on defensive stretches.
  - **Net Magnet** (volley ≥ 70): +10% volley reach and volley error ×0.8.
  - **Clutch** (mental ≥ 70, save 20 break points): PERFECT window +1 frame on break/set/match points.
  - **Iron Lungs** (endurance ≥ 75): stamina drain ×0.85.
  - **Dirtballer** (win a clay title): clay footing penalty removed, +topspin kick.
  Each badge shows a small icon on the match card and a brief flash when it triggers.
- **Fatigue:** each consecutive week played lowers the next match's starting stamina by 6 (max −30); a Rest week restores it fully; the hub shows a fatigue meter.
- **Career page:** titles (by tier), W/L overall and by surface, career-high rank (and week), prize-style trophy cabinet of procedurally drawn trophies per title, Major results grid.

### 3.5 Practice
- **Ball machine:** choose feed type (normal / topspin / slice / lob / random), side, speed; free hitting with the Training HUD on by default; streak counter of PERFECT hits.
- **Tutorial** (step list with on-screen prompts and success checks): moving → timing (hit 5 GOOD+) → aiming (hit targets left/right/deep/short) → each shot type (topspin, slice, lob, drop) → serve (flat, kick, slice into targets) → stamina explainer. Shows the current key bindings. Each shot plays out (landing ring, IN/OUT) before the next ball, and a step finished by a hit waits for that ball to land.

### 3.5b Tactics School (playtest round 1, M17)
Practice → **Tactics School**: eight lessons on real singles tactics, not tricks for beating the COM. Each lesson has:
- an intro card explaining the idea, with the drill underneath;
- a ball-machine drill with yellow target zones, an optional red stand-in opponent, progress pips and NICE / NOT QUITE feedback;
- a summary card with the takeaway and the AI game plan built on the same idea.

Progress is saved (`baseline.lessons`). The content is data in `src/data/lessons.ts`.

| # | Lesson | Drill (pass condition) | Game plan |
|---|---|---|---|
| 1 | Crosscourt is your safe rally ball | 5 in a row: diagonal, past the service line | Baseline Grind |
| 2 | Hit to the open court | 4 deep, away from the stand-in opponent | Serve + 1 |
| 3 | Change direction on a good ball | 3 clean (GOOD/PERFECT) down the line, deep | Forehand Dominance |
| 4 | Attack the short ball | 3: hit from inside the baseline, land deep | Net Attack |
| 5 | Serve to a spot | 2 wide + 2 down the T | Serve + 1 |
| 6 | Find the weaker side | 4 deep to a right-hander's backhand | Forehand Dominance |
| 7 | Beat the net player | 4: deep lob over them, or pass along a sideline | Counterpunch |
| 8 | Defend, then recover | 3: deep through the middle **and** back near the centre before it lands | Baseline Grind |

Sources for the tactics (general coaching consensus):
- [LTA singles tactics](https://clubspark.lta.org.uk/Adeltennisacademy/Coaching/Adult/SinglesTactics)
- [USHSTA singles strategies](https://ushsta.org/tennis-singles-strategies-and-tactics/)
- [TennisOne: crosscourt patterns](https://tennisone.tennisplayer.net/club/lessons/jm/patterns/cc.php)
- [TennisOne: the short ball](https://tennisone.tennisplayer.net/club/lessons/king/shortball/short.php)
- [TennisOne: approach shots](https://tennisone.tennisplayer.net/club/lessons/fein/approach/approach.php)
- [Tennishead: serve plus one](https://tennishead.net/?p=192827)

### 3.6 Options
Control remapping (P1 / P2 / per action, keyboard + gamepad button), master / music / SFX volume, mute (also **M** anywhere), Training HUD toggle, COM difficulty, career match length (short "first to 3 games" / full sets; Majors best-of-5 toggle), reduced screen shake, show FPS. Persisted in localStorage.

---

## 4. Audio
Per `retro-chiptune-audio`: Web Audio, unlocked on first user gesture.
- **Racket hits** vary by grade: PERFECT = bright layered "thwock" + rising sting; Good = clean pop; Early/Late = duller; Mishit = rattly frame clank.
- **Bounces** per surface: grass soft thud, clay gritty dull thump with a noise burst, hard sharp tock.
- Net-cord tick, net thud; footstep scuffs on slides; umpire stings (short two-note chime for calls, lower for faults); crowd applause (filtered noise swells sized by point quality), "ooh" (formant-swept noise), murmur bed.
- **Music:** menu theme (bright, bouncy, 4-channel), match intro jingle, game/set stings, victory jingle, trophy fanfare, career hub loop.
- Mute toggle (M + Options), separate music/SFX volumes; audio suspends when the tab is hidden.

---

## 5. Tech
- **Vite + TypeScript (strict) + Canvas2D**, no engine. Fixed 60 Hz timestep with accumulator.
- **Seeded RNG** (`mulberry32`) for all gameplay and simulation; `Math.random` only for cosmetic particles.
- **Layout:**
  ```
  src/
    main.ts
    core/      loop input audio rng save transitions debug
    gfx/       camera(projection) court stadium player-renderer ball-renderer particles ui text trophy
    match/     ball-physics shot-model timing player-controller ai scoring match-state serve stamina
    sim/       match-sim (stat-based) tournament bracket
    career/    career-state rankings entry calendar-gen field-sim progression badges news save-io
    scenes/    title exhibition-setup statcard match results bracket trophy versus-setup practice tutorial options career/*
    data/      tour.ts surfaces.ts shots.ts archetypes.ts names.ts tuning.ts music.ts sfx.ts
    testing/   hooks.ts (window.__game)
  tests/       scoring.test.ts rankings.test.ts entry.test.ts physics.test.ts ...
  e2e/         Playwright playtest scripts
  ```
- **Playtest hooks** (`window.__game`): `seed(n)`, `step(n)`, `state()` dump (scene, score, ball, players, stamina, last grade), `press/hold/release(action)`, `goto(scene, params)`, `pauseLoop()`; deterministic so a scripted rally reproduces exactly.
- **Unit tests (Vitest):** scoring (deuce/ad, tiebreaks, formats, serve rotation), rankings (52-week dropoff, best-19, ties), entry eligibility (direct / qualifying / not eligible / wildcard), shot solver lands near target, career quick-sim progression.
- **Build:** `vite.config.ts` with `base: './'` so it runs from any sub-path (local preview and GitHub Pages).

---

## 6. Scope budget & cut list
**In v1:** everything above.
**Cut / simplified (explicitly not in v1):**
- Doubles play (court lines are drawn, but singles only).
- Ends never visually swap (human always near side).
- No online play, no touch controls, no mobile layout.
- No Hawk-Eye challenges, no injuries, no coaching staff, no money/prize economy (points and XP only).
- Juniors/Davis-Cup-style team events and the women's tour are out of scope.
- Crowd is decorative 2D blobs, not individual animated people.
- Commentary is text-only (news ticker + umpire pop-ups), no speech.
