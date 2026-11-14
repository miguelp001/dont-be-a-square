import { CHARACTERS } from './Constants';

export const CHARACTER_BG_PARTICLES: Record<string, number[]> = {
  kiri: [0xf39c12, 0xe67e22, 0xd35400, 0xf1c40f],      // Brass, gear copper, workshop gold
  mizu: [0x54a0ff, 0x00d2d3, 0xff9ff3, 0x70a1ff],      // Waterfall azure, sakura pink, crystal aqua
  riff: [0xff69b4, 0xff007f, 0x00f2fe, 0xa55eea],      // Neon magenta, electric cyan, rock star purple
  mocha: [0xa55eea, 0xd980fa, 0xfeca57, 0x78e08f],     // Arcane violet, magical fairy dust, elixir amber
  ember: [0xff4757, 0xff6b6b, 0xffa502, 0xff7f50],     // Matsuri embers, lantern flame, fiery orange
  volt: [0xfffa65, 0x00d2d3, 0x54a0ff, 0xffea00],      // Tesla sparks, plasma cyan, electric yellow
  salty: [0x00d2d3, 0xfeca57, 0x48dbfb, 0xffffff],     // Tropical sea spray, doubloon gold, ocean turquoise
  poppy: [0xff9ff3, 0xf368e0, 0x54a0ff, 0xfff0f6],     // Kawaii hearts, pastel sparkles, idol pink
  void_slime: [0x8e44ad, 0x9b59b6, 0x341f97, 0xd980fa],// Cosmic nebula violet, deep space celestial glow
  nano_banana: [0xf1c40f, 0x00d2d3, 0x2ed573, 0xfffa65]// Matrix cyber-gold, glitch teal, nanite green
};

export interface MatchBackgroundOptions {
  gameMode: string;
  characterId?: string;
  opponentCharacterId?: string;
  matchSeed?: number;
}

/**
 * Determine the custom thematic background key for a match:
 * - When playing in an online match, the background is chosen at random (synced across room via match seed if present).
 * - During endless mode, the background is chosen at random across all character stages.
 * - When facing a character (challenge mode, vs_cpu, etc.), custom thematic background of that character.
 */
export function selectMatchBackground(options: MatchBackgroundOptions): string {
  const allCharIds = CHARACTERS.map((c) => c.id);

  if (options.gameMode === 'vs_online') {
    if (options.matchSeed !== undefined && options.matchSeed !== null) {
      const seedIndex = Math.abs(Math.floor(options.matchSeed)) % allCharIds.length;
      return allCharIds[seedIndex];
    }
    return allCharIds[Math.floor(Math.random() * allCharIds.length)];
  }

  if (options.gameMode === 'endless') {
    return allCharIds[Math.floor(Math.random() * allCharIds.length)];
  }

  if (options.opponentCharacterId) {
    return options.opponentCharacterId;
  }

  return options.characterId || 'kiri';
}
