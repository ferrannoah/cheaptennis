/** All gameplay feel constants in one place. Units: metres, seconds, frames (60 Hz). */
export const T = {
  // player movement
  // (M16 retune: players ~17% slower with real momentum, so a well-placed ball beats them)
  // (M20 retune to the Free Tennis footage: top speed ≈6.3-6.5 m/s at footwork 72, but every
  // stroke now roots you for its animation, so a fast player still pays for each swing)
  baseSpeed: 5.0, // m/s at footwork 0 => scaled up by footwork (M16: 4.5, before that 5.4)
  footworkSpeedBonus: 2.0, // (M16: 1.9)
  accel: 24, // m/s² (M16: 22; M15: 46)
  decel: 36, // (was 64)
  backpedalMul: 0.72, // top speed when running back towards your own baseline (lobs)
  swingMoveMult: 0.35,
  reach: 1.25, // lateral reach for a comfortable stroke
  stretchReach: 1.8, // max lateral reach with a stretch/dive (was 1.95)
  contactAhead: 0.45, // contact plane is this far in front of the body
  maxContactZ: 2.75,
  minContactZ: 0.08,
  overheadZ: 2.1,

  // swing timing (frames)
  windup: 8,
  perfectWin: 2.5,
  goodWin: 6,
  earlyMax: 13,
  lateMax: 11,
  mishitEarly: 20,
  mishitLate: 15,
  swingRecover: 22,
  whiffRecover: 18,
  // stroke commitment (M20, from the Free Tennis footage): no steering from the start of the
  // swing animation until this many frames after contact (the follow-through)
  followLock: 18,
  serveLock: 18, // frames after the serve contact before the server can move
  plantDecel: 30, // m/s²: planted feet stop a moving player this fast (5 m/s -> 0 in ~0.17 s)
  slideMinSpeed: 3.2, // m/s: swinging faster than this turns the stroke into a slide
  slideDecel: 9, // m/s² base slide friction (x grip; clay slides 25% further)

  // serve
  tossVz: 5.6,
  tossZ0: 1.5,
  servePerfectWin: 4,
  serveGoodWin: 9,
  flatServeSpeed: 47, // (M16: was 41; first serves now reach ~175-185 km/h so placed serves can win outright)
  kickServeSpeed: 34.5,
  sliceServeSpeed: 39,

  // drop shot flight time (s): base + extra per metre the hitter is behind the service line area
  dropFlight: 1.4,
  dropFlightPerM: 0.06,
  dropBackspin: 1.45, // (was 1.9: drops died so low that even a retrieved drop was a lost point)
  lobFlight: 1.85, // s, plus 0.3 s per 10 m of depth
  overheadSetup: 0.3, // s: extra time a player needs to smash a ball they are backpedalling for
  netLobReact: 18, // extra COM reaction frames when lobbed while at the net (turning to run back)
  returnReact: 8, // extra COM reaction frames when returning a serve
  backpedalErr: 2.2, // extra error for a ball hit in the air while running back at full speed
  // (M20) COM court position, fitted to the Free Tennis footage (contact ≈ on the baseline, a shot every ~1.0 s)
  aiHomeShift: 1.8, // m: every archetype recovers this much closer to the baseline than its homeBack
  aiDeepCost: 0.9, // plan cost per metre of contact behind (baseline - 0.5 m)

  // ball physics
  drag: 0.0052,
  magnus: 0.3,
  sideMagnus: 0.22,

  // stamina
  runDrain: 0.045, // per frame at full speed
  shotDrain: 0.7,
  powerDrain: 0.6,
  diveDrain: 4.5,
  rallyDrain: 0.45, // per shot after shot 8
  pointRecover: 12,
  skipMinDeadFrames: 12, // the call is visible this long before a skip press is accepted
  skipTossLock: 8, // frames after a skip in which the serve toss ignores the press
  practiceAfterShot: 60, // practice: pause after a shot has played out before the next feed
  practiceSkipAfter: 15, // practice: the shot button can skip the pause after this many frames
  changeoverRecover: 30,
  setRecover: 50,
  lowStamina: 40,

  hitstopPerfect: 4,
};
