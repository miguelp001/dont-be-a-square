export enum GameDifficulty {
  NOVICE = 'NOVICE',
  ADEPT = 'ADEPT',
  EXPERT = 'EXPERT',
  MASTER = 'MASTER',
  GRANDMASTER = 'GRANDMASTER'
}

export interface DifficultyTierInfo {
  id: GameDifficulty;
  name: string;
  badge: string;
  color: number;
  hexColor: string;
  description: string;
  badgeText: string;
  // Board & Engine parameters
  colorCount: number; // 5 on Novice/Adept, 6 on Expert+
  baseRiseSpeedMultiplier: number;
  dangerGraceTimeMs: number;
  stopTimeMultiplier: number;
  initialRows: number;
  initialGarbageSlabs: number;
  // AI Bot parameters (VS / Challenge mode)
  aiIntervalMultiplier: number;
  aiIndecisiveness: number;
  aiJitterChance: number;
  aiChainBiasMultiplier: number;
  aiLiftFrequencyMultiplier: number;
  aiPanicSpeedup: number;
}

export const DIFFICULTY_TIERS: Record<GameDifficulty, DifficultyTierInfo> = {
  [GameDifficulty.NOVICE]: {
    id: GameDifficulty.NOVICE,
    name: 'Novice',
    badge: '🟢 NOVICE',
    color: 0x2ed573,
    hexColor: '#2ed573',
    description: '5 Colors • Relaxed Pace • 12s Danger Grace',
    badgeText: 'NOVICE',
    colorCount: 5,
    baseRiseSpeedMultiplier: 0.75,
    dangerGraceTimeMs: 12000,
    stopTimeMultiplier: 1.4,
    initialRows: 4,
    initialGarbageSlabs: 0,
    aiIntervalMultiplier: 1.5,
    aiIndecisiveness: 0.25,
    aiJitterChance: 0.20,
    aiChainBiasMultiplier: 0.8,
    aiLiftFrequencyMultiplier: 2.0,
    aiPanicSpeedup: 1.05
  },
  [GameDifficulty.ADEPT]: {
    id: GameDifficulty.ADEPT,
    name: 'Adept',
    badge: '🔵 ADEPT',
    color: 0x54a0ff,
    hexColor: '#54a0ff',
    description: '5 Colors • Standard Pace • 10s Danger Grace',
    badgeText: 'ADEPT',
    colorCount: 5,
    baseRiseSpeedMultiplier: 1.0,
    dangerGraceTimeMs: 10000,
    stopTimeMultiplier: 1.0,
    initialRows: 5,
    initialGarbageSlabs: 0,
    aiIntervalMultiplier: 1.0,
    aiIndecisiveness: 0.08,
    aiJitterChance: 0.08,
    aiChainBiasMultiplier: 1.0,
    aiLiftFrequencyMultiplier: 1.0,
    aiPanicSpeedup: 1.15
  },
  [GameDifficulty.EXPERT]: {
    id: GameDifficulty.EXPERT,
    name: 'Expert',
    badge: '🟡 EXPERT',
    color: 0xfeca57,
    hexColor: '#feca57',
    description: '6 Colors • Fast Pace • 7s Danger Grace',
    badgeText: 'EXPERT',
    colorCount: 6, // Introduces Cyan Mint
    baseRiseSpeedMultiplier: 1.5,
    dangerGraceTimeMs: 7000,
    stopTimeMultiplier: 0.75,
    initialRows: 6,
    initialGarbageSlabs: 0,
    aiIntervalMultiplier: 0.72,
    aiIndecisiveness: 0.04,
    aiJitterChance: 0.04,
    aiChainBiasMultiplier: 1.3,
    aiLiftFrequencyMultiplier: 0.8,
    aiPanicSpeedup: 1.25
  },
  [GameDifficulty.MASTER]: {
    id: GameDifficulty.MASTER,
    name: 'Master',
    badge: '🟠 MASTER',
    color: 0xff6b6b,
    hexColor: '#ff6b6b',
    description: '6 Colors • Intense Pressure • 5s Danger Grace',
    badgeText: 'MASTER',
    colorCount: 6,
    baseRiseSpeedMultiplier: 2.1,
    dangerGraceTimeMs: 5000,
    stopTimeMultiplier: 0.50,
    initialRows: 6,
    initialGarbageSlabs: 1,
    aiIntervalMultiplier: 0.52,
    aiIndecisiveness: 0.01,
    aiJitterChance: 0.01,
    aiChainBiasMultiplier: 1.6,
    aiLiftFrequencyMultiplier: 0.6,
    aiPanicSpeedup: 1.35
  },
  [GameDifficulty.GRANDMASTER]: {
    id: GameDifficulty.GRANDMASTER,
    name: 'Grandmaster',
    badge: '🔴 GRANDMASTER',
    color: 0xa55eea,
    hexColor: '#a55eea',
    description: '6 Colors • Relentless Speed • 3.5s Danger Grace',
    badgeText: 'GRANDMASTER',
    colorCount: 6,
    baseRiseSpeedMultiplier: 3.0,
    dangerGraceTimeMs: 3500,
    stopTimeMultiplier: 0.30,
    initialRows: 7,
    initialGarbageSlabs: 2,
    aiIntervalMultiplier: 0.38,
    aiIndecisiveness: 0.0,
    aiJitterChance: 0.0,
    aiChainBiasMultiplier: 2.0,
    aiLiftFrequencyMultiplier: 0.4,
    aiPanicSpeedup: 1.45
  }
};

export const DIFFICULTY_ORDER: GameDifficulty[] = [
  GameDifficulty.NOVICE,
  GameDifficulty.ADEPT,
  GameDifficulty.EXPERT,
  GameDifficulty.MASTER,
  GameDifficulty.GRANDMASTER
];

export function getDifficultyInfo(diff: GameDifficulty | string): DifficultyTierInfo {
  const normalized = typeof diff === 'string' ? (diff.toUpperCase() as GameDifficulty) : diff;
  return DIFFICULTY_TIERS[normalized] || DIFFICULTY_TIERS[GameDifficulty.ADEPT];
}
