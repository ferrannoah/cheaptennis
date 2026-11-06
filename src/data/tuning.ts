/** All gameplay feel constants in one place. Units: metres, seconds, frames (60 Hz). */
export const T = {
  // player movement
  baseSpeed: 5.4, // m/s at footwork 0 => scaled up by footwork
  footworkSpeedBonus: 2.3,
  accel: 46,
  decel: 64,
  swingMoveMult: 0.35,
  reach: 1.25, // lateral reach for a comfortable stroke
  stretchReach: 1.95, // max lateral reach with a stretch/dive
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
  flatServeSpeed: 41,
  kickServeSpeed: 31,
  sliceServeSpeed: 35,

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
