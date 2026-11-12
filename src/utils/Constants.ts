export const GAME_WIDTH = 512;
export const GAME_HEIGHT = 512;

/** Cute & ultra-legible rounded font family for all game text */
export const CUTE_FONT = '"Fredoka", "Nunito", "Arial Rounded MT Bold", sans-serif';

export const BOARD_WIDTH = 6;
export const BOARD_HEIGHT = 12; // visible + buffer
export const BOARD_VISIBLE_HEIGHT = 10;
export const PANEL_SIZE = 32;

export const COLORS = {
  RED: 0,
  BLUE: 1,
  GREEN: 2,
  YELLOW: 3,
  PURPLE: 4,
  CYAN: 5,
  COUNT: 6
};

export const PANEL_COLORS = [
  0xff4757, // Red
  0x3742fa, // Blue
  0x2ed573, // Green
  0xfffa65, // Yellow
  0xa55eea, // Purple
  0x00d2d3  // Cyan
];

export const GAME_STATES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  MATCHING: 'matching',
  FALLING: 'falling',
  SWAPPING: 'swapping',
  GAME_OVER: 'game_over'
};

export enum PanelState {
  IDLE = 'IDLE',
  SWAPPING = 'SWAPPING',
  HOVER = 'HOVER',
  FALLING = 'FALLING',
  FLASHING = 'FLASHING',
  POPPING = 'POPPING',
  DEAD = 'DEAD'
}

export const GRAVITY_DELAY = 50;
export const SWAP_DURATION = 100;
export const MATCH_DELAY = 150;
export const COMBO_DELAY = 200;
export const CURSOR_SPEED = 150;

export const BASE_RISE_SPEED = 6; // pixels per second (relaxed pace for thoughtful play)
export const FAST_LIFT_SPEED = 200; // pixels per second when holding lift
export const DANGER_ROW = 1; // Top ceiling row
export const DANGER_GRACE_TIME = 10500; // ms grace before top-out game over (10.5s generous survival time)

export interface CharacterData {
  id: string;
  name: string;
  species: string;
  description: string;
  shortDescription: string;
  quote: string;
  defeatQuote: string;
  powerName: string;
  powerDescription: string;
  isSecret?: boolean;
  unlockTier?: string;
}

export const CHARACTERS: CharacterData[] = [
  {
    id: 'kiri',
    name: 'Kiri',
    species: 'Mechanic Fox Girl',
    description: 'Grease-covered and gear-obsessed!',
    shortDescription: 'Mechanic Fox Girl — Grease & gears!',
    quote: 'Wrench it up!',
    defeatQuote: 'Out of spare parts...',
    powerName: 'Gear Lock',
    powerDescription: 'Jams 3–4 enemy blocks; immovable until freed by an adjacent match!'
  },
  {
    id: 'mizu',
    name: 'Mizu',
    species: 'Axolotl Swordsman',
    description: 'Cuts with the flow of water!',
    shortDescription: 'Axolotl Swordsman — Swift as water!',
    quote: 'Flow like water!',
    defeatQuote: 'Swept away...',
    powerName: 'Tidal Flow',
    powerDescription: 'Reverses rising blocks and makes your stack scroll downward for 5 seconds.'
  },
  {
    id: 'riff',
    name: 'Riff',
    species: 'Tigress Guitarist',
    description: 'Rocks harder than the stage can handle!',
    shortDescription: 'Tigress Guitarist — Rock & roll energy!',
    quote: 'Rock & Roll!',
    defeatQuote: 'Snapped a guitar string...',
    powerName: 'Groove Extension',
    powerDescription: 'Extends chain & combo grace time for 8 seconds, making big cascades easier.'
  },
  {
    id: 'mocha',
    name: 'Mocha',
    species: 'Bunny Alchemist',
    description: 'Brews up cute chaos!',
    shortDescription: 'Bunny Alchemist — Brews cute chaos!',
    quote: 'Bubbling brew!',
    defeatQuote: 'My potion spilled...',
    powerName: 'Transmute',
    powerDescription: 'Transmutes 3 random enemy blocks directly into a solid garbage slab.'
  },
  {
    id: 'ember',
    name: 'Ember',
    species: 'Shiba Inu Fire Dancer',
    description: 'Lights up the dance floor!',
    shortDescription: 'Shiba Inu Fire Dancer — Blazing beats!',
    quote: 'Feel the heat!',
    defeatQuote: 'Flames extinguished...',
    powerName: 'Wildfire',
    powerDescription: 'Ignites all slimes of a chosen color on your board and clears them all.'
  },
  {
    id: 'volt',
    name: 'Volt',
    species: 'Gecko Inventor',
    description: 'Shocking levels of genius!',
    shortDescription: 'Gecko Inventor — Shocking genius!',
    quote: 'Static shock!',
    defeatQuote: 'Short circuit...',
    powerName: 'Overcharge',
    powerDescription: 'Electrifies enemy controls for 6 seconds, making cursor moves & swaps sluggish.'
  },
  {
    id: 'salty',
    name: 'Salty',
    species: 'Otter Pirate',
    description: 'Plunders with panache!',
    shortDescription: 'Otter Pirate — Plunders with panache!',
    quote: 'Ahoy matey!',
    defeatQuote: 'Walked the plank...',
    powerName: 'Flash Freeze',
    powerDescription: 'Freezes the enemy stack mechanism for 6 seconds so blocks cannot rise.'
  },
  {
    id: 'poppy',
    name: 'Poppy',
    species: 'Red Panda Idol',
    description: 'The star of the show!',
    shortDescription: 'Red Panda Idol — Sparkling superstar!',
    quote: 'Idol sparkle!',
    defeatQuote: 'The curtain fell...',
    powerName: 'Sub-Floor Blast',
    powerDescription: 'Explodes and vaporizes the bottom 2 rows of your stack to drop height instantly.'
  },
  {
    id: 'void_slime',
    name: 'Void Slime',
    species: 'Cosmic Void Champion',
    description: 'An ultra cute squishy slime crowned with cosmic space magic and mischievous sparkle!',
    shortDescription: 'Cosmic Void Champion — Cosmic magic!',
    quote: 'The cosmic void calls... squish!',
    defeatQuote: 'Pop goes the galaxy...',
    powerName: 'Aether Drain',
    powerDescription: 'Cosmic void siphon that instantly drains and wipes the enemy power meter to 0%!',
    isSecret: true,
    unlockTier: 'Master'
  },
  {
    id: 'nano_banana',
    name: 'Nano Banana',
    species: 'Glitch Nanite Overlord',
    description: 'The legendary hidden anomaly peeling the very fabric of reality itself!',
    shortDescription: 'Glitch Nanite Overlord — Reality peeler!',
    quote: 'Reality is ripe for peeling!',
    defeatQuote: 'Split into nanobits...',
    powerName: 'Pure Skill',
    powerDescription: 'Zero powers — the ultimate handicap flex for pure mechanical mastery.',
    isSecret: true,
    unlockTier: 'Grandmaster'
  }
];
