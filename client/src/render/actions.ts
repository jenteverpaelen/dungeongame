// Skill choreography: how a hero physically performs every skill. Shared by the art module (body, weapon,
// trails, auras) and the effects module (world-space impacts) so both land on the same frame.
//
// Timing model (keeps visuals in sync with an authoritative server that resolves hits the moment it emits
// `cast`): t = 0 is the event. Melee swings and shots RELEASE immediately (strike over 0..strikeMs), then
// recover; anticipation for the next attack is played at the END of the previous cycle while the hero keeps
// attacking (F_ATTACK), so the wind-up never delays the hit. Spells with a server-side delay (Meteor's
// telegraph) play their gesture at t = 0 while the effects module shows the delay.

export type Pose =
  | 'swing'      // weapon arc across the body, torso twists into it, small lunge
  | 'double'     // two fast crossing slashes
  | 'spin'       // whirlwind: full-body 360° rotation loop, weapon held out
  | 'leapSlam'   // crouch → hop → slam with squash
  | 'overhead'   // weapon raised high, smashed into the ground in front
  | 'roar'       // chest out, arms wide, head back, aura burst
  | 'shoot'      // bow/crossbow release + recoil, string snap; redraw anticipates next shot
  | 'volley'     // bow sweeps across a fan while releasing
  | 'lob'        // aim 45° up, release, recoil
  | 'skyShot'    // aim straight up, release burst
  | 'deploy'     // kneel, hammer-tap twice
  | 'whistle'    // hand to mouth, call
  | 'flick'      // wand/staff flick toward target, sparkle at tip
  | 'callDown'   // both arms raise weapon overhead, gather glow, point at target, float a little
  | 'thrust'     // both hands forward, swirl at the hands
  | 'groundBurst' // crouch, slam staff butt into the ground
  | 'summon'     // sweep arm upward from the ground
  | 'empower';   // hold weapon up, runes circle it

export interface ActionDef {
  pose: Pose;
  /** ms from the event to the moment of maximum extension / release. */
  strikeMs: number;
  /** Total ms the pose owns the body (primaries are additionally capped to their attack cycle). */
  durMs: number;
  /** Character lunge toward the target in world units at strike (0 = none). */
  lunge: number;
  /** Weapon / hand trail colour hint (0 = derive from the weapon look). */
  trail: number;
  /** Camera kick in world units for the local player at strike (0 = none). */
  kick: number;
}

const A = (pose: Pose, strikeMs: number, durMs: number, lunge = 0, trail = 0, kick = 0): ActionDef => ({ pose, strikeMs, durMs, lunge, trail, kick });

export const ACTIONS: Record<string, ActionDef> = {
  // Warrior
  cleave: A('swing', 70, 300, 7, 0, 0),
  whirlwind: A('spin', 0, 0, 0),             // driven by F_CHANNEL, not by the event
  rend: A('double', 60, 320, 5, 0xd2302a),
  ground_stomp: A('leapSlam', 260, 520, 0, 0, 5),
  seismic_slam: A('overhead', 180, 480, 4, 0, 4),
  battle_rage: A('roar', 120, 600, 0, 0xff4a2a),
  // Ranger
  hungering_arrow: A('shoot', 30, 260, 0),
  sentry: A('deploy', 220, 460, 0),
  multishot: A('volley', 60, 340, 0),
  cluster_arrow: A('lob', 50, 320, 0),
  rain_of_vengeance: A('skyShot', 80, 480, 0),
  companion: A('whistle', 150, 420, 0),
  // Mage
  magic_missile: A('flick', 40, 240, 0, 0xb388ff),
  meteor: A('callDown', 260, 620, 0, 0xff8a3d),
  black_hole: A('thrust', 160, 460, 0, 0x8e44ad),
  frost_nova: A('groundBurst', 120, 380, 0, 0x7fd3ff, 3),
  hydra: A('summon', 200, 460, 0, 0xff5e3a),
  magic_weapon: A('empower', 200, 560, 0, 0xb388ff),
};

/** What the scene hands to a hero view when the server reports a cast. */
export interface ActionSpec {
  skill: string;
  rune?: string;
  /** Target point in world units (direction of the swing / shot). */
  tx: number;
  ty: number;
  /** Attack cycle length for primaries (1000 / attacks per second). */
  cycleMs: number;
}
