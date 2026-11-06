/** All gameplay feel constants in one place. Units: metres, seconds, frames (60 Hz). */
export const T = {
  // player movement
  // (M16 retune: players ~17% slower with real momentum, so a well-placed ball beats them)
  baseSpeed: 4.5, // m/s at footwork 0 => scaled up by footwork (was 5.4)
  footworkSpeedBonus: 1.9, // (was 2.3)
  accel: 22, // m/s² (was 46: full speed in ~0.15 s; now ~0.3 s)
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
