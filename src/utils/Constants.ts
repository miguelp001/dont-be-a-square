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

export const GRAVITY_DELAY = 50;
export const SWAP_DURATION = 100;
export const MATCH_DELAY = 150;
export const COMBO_DELAY = 200;
export const CURSOR_SPEED = 150;

export const BASE_RISE_SPEED = 14; // pixels per second
export const FAST_LIFT_SPEED = 200; // pixels per second when holding lift
export const DANGER_ROW = 1; // Top ceiling row
export const DANGER_GRACE_TIME = 6500; // ms grace before top-out game over (6.5s generous survival time)

export const CHARACTERS = [
  {
    id: 'kiri',
    name: 'Kiri',
    species: 'Mechanic Fox Girl',
    description: 'Grease-covered and gear-obsessed!',
    quote: 'Wrench it up!',
    defeatQuote: 'Out of spare parts...'
  },
  {
    id: 'mizu',
    name: 'Mizu',
    species: 'Axolotl Swordsman',
    description: 'Cuts with the flow of water!',
    quote: 'Flow like water!',
    defeatQuote: 'Swept away...'
  },
  {
    id: 'riff',
    name: 'Riff',
    species: 'Tigress Guitarist',
    description: 'Rocks harder than the stage can handle!',
    quote: 'Rock & Roll!',
    defeatQuote: 'Snapped a guitar string...'
  },
  {
    id: 'mocha',
    name: 'Mocha',
    species: 'Bunny Alchemist',
    description: 'Brews up cute chaos!',
    quote: 'Bubbling brew!',
    defeatQuote: 'My potion spilled...'
  },
  {
    id: 'ember',
    name: 'Ember',
    species: 'Shiba Inu Fire Dancer',
    description: 'Lights up the dance floor!',
    quote: 'Feel the heat!',
    defeatQuote: 'Flames extinguished...'
  },
  {
    id: 'volt',
    name: 'Volt',
    species: 'Gecko Inventor',
    description: 'Shocking levels of genius!',
    quote: 'Static shock!',
    defeatQuote: 'Short circuit...'
  },
  {
    id: 'salty',
    name: 'Salty',
    species: 'Otter Pirate',
    description: 'Plunders with panache!',
    quote: 'Ahoy matey!',
    defeatQuote: 'Walked the plank...'
  },
  {
    id: 'poppy',
    name: 'Poppy',
    species: 'Red Panda Idol',
    description: 'The star of the show!',
    quote: 'Idol sparkle!',
    defeatQuote: 'The curtain fell...'
  }
];
