import { GameDifficulty, DIFFICULTY_ORDER } from './Difficulty';
import { RecordManager } from './DifficultyRecords';

export interface DifficultyVsStats {
  wins: number;
  losses: number;
}

export interface GameStats {
  totalMatches: number;
  totalPlayTimeSeconds: number;
  totalSwaps: number;
  totalFastLifts: number;
  totalPanelsCleared: number;
  totalGarbageCleared: number;
  maxChain: number;

  // Combos breakdown
  combos4: number;
  combos5: number;
  combos6Plus: number;

  // Chains breakdown (x2, x3, x4, x5+)
  chains2: number;
  chains3: number;
  chains4: number;
  chains5Plus: number;

  // Mode breakdown
  modeMatches: {
    endless: number;
    challenge: number;
    vs_cpu: number;
    vs_online: number;
    time_attack: number;
    score_attack: number;
  };

  // VS CPU Difficulty record (wins / losses)
  vsCpu: Record<GameDifficulty, DifficultyVsStats>;

  // VS Online record
  vsOnline: {
    wins: number;
    losses: number;
    matchesPlayed: number;
  };

  // Input Device usage (percentage / counter)
  inputUsage: {
    keyboard: number;
    touch: number;
    gamepad: number;
  };

  // Character Usage (matches played per character)
  characterPicks: Record<string, number>;

  // Performance telemetry
  avgFps: number;
}

const STORAGE_KEY = 'dont_be_a_square_stats_v1';

function getDefaultStats(): GameStats {
  const vsCpu = {} as Record<GameDifficulty, DifficultyVsStats>;
  for (const diff of DIFFICULTY_ORDER) {
    vsCpu[diff] = { wins: 0, losses: 0 };
  }

  return {
    totalMatches: 0,
    totalPlayTimeSeconds: 0,
    totalSwaps: 0,
    totalFastLifts: 0,
    totalPanelsCleared: 0,
    totalGarbageCleared: 0,
    maxChain: 0,

    combos4: 0,
    combos5: 0,
    combos6Plus: 0,

    chains2: 0,
    chains3: 0,
    chains4: 0,
    chains5Plus: 0,

    modeMatches: {
      endless: 0,
      challenge: 0,
      vs_cpu: 0,
      vs_online: 0,
      time_attack: 0,
      score_attack: 0
    },

    vsCpu,
    vsOnline: {
      wins: 0,
      losses: 0,
      matchesPlayed: 0
    },

    inputUsage: {
      keyboard: 0,
      touch: 0,
      gamepad: 0
    },

    characterPicks: {
      kiri: 0,
      mizu: 0,
      riff: 0,
      ember: 0,
      poppy: 0,
      volt: 0,
      void_slime: 0,
      mocha: 0,
      salty: 0,
      nano_banana: 0
    },

    avgFps: 60
  };
}

/** Pre-populate illustrative starter telemetry if the player has existing progress or is viewing stats for the first time */
function getSeededStarterStats(): GameStats {
  const stats = getDefaultStats();
  const records = RecordManager.load();

  // Check how many challenge clears exist
  let clearedCount = 0;
  for (const diff of DIFFICULTY_ORDER) {
    if (records.challengeClears[diff]?.cleared) {
      clearedCount++;
      stats.vsCpu[diff].wins += 1;
    }
  }

  // Base starter statistics so graphs have rich visual data
  stats.totalMatches = Math.max(12, clearedCount * 3);
  stats.totalPlayTimeSeconds = stats.totalMatches * 145;
  stats.totalSwaps = stats.totalMatches * 68;
  stats.totalFastLifts = stats.totalMatches * 14;
  stats.totalPanelsCleared = stats.totalSwaps * 3;
  stats.totalGarbageCleared = stats.totalMatches * 6;
  stats.maxChain = Math.max(5, clearedCount + 2);

  stats.combos4 = stats.totalMatches * 5;
  stats.combos5 = stats.totalMatches * 2;
  stats.combos6Plus = Math.max(3, stats.totalMatches);

  stats.chains2 = stats.totalMatches * 8;
  stats.chains3 = stats.totalMatches * 4;
  stats.chains4 = stats.totalMatches * 2;
  stats.chains5Plus = Math.max(2, clearedCount);

  stats.modeMatches.endless = Math.round(stats.totalMatches * 0.35);
  stats.modeMatches.challenge = Math.round(stats.totalMatches * 0.30);
  stats.modeMatches.vs_cpu = Math.round(stats.totalMatches * 0.20);
  stats.modeMatches.vs_online = Math.round(stats.totalMatches * 0.10);
  stats.modeMatches.time_attack = Math.round(stats.totalMatches * 0.05);

  stats.vsCpu[GameDifficulty.NOVICE] = { wins: 4, losses: 1 };
  stats.vsCpu[GameDifficulty.ADEPT] = { wins: 3, losses: 1 };
  stats.vsCpu[GameDifficulty.EXPERT] = { wins: 2, losses: 2 };
  stats.vsCpu[GameDifficulty.MASTER] = { wins: 2, losses: 3 };
  stats.vsCpu[GameDifficulty.GRANDMASTER] = { wins: 1, losses: 2 };

  stats.vsOnline = {
    wins: 3,
    losses: 1,
    matchesPlayed: 4
  };

  stats.inputUsage = {
    keyboard: 180,
    touch: 120,
    gamepad: 60
  };

  stats.characterPicks = {
    kiri: 8,
    mizu: 5,
    riff: 4,
    ember: 3,
    poppy: 2,
    volt: 2,
    void_slime: 1,
    mocha: 2,
    salty: 2,
    nano_banana: 1
  };

  stats.avgFps = 60;
  return stats;
}

export class StatsManager {
  private static cachedStats: GameStats | null = null;
  private static fpsSamples: number[] = [];

  public static load(): GameStats {
    if (this.cachedStats) return this.cachedStats;

    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            const defaults = getDefaultStats();
            this.cachedStats = {
              ...defaults,
              ...parsed,
              modeMatches: { ...defaults.modeMatches, ...(parsed.modeMatches || {}) },
              vsCpu: { ...defaults.vsCpu, ...(parsed.vsCpu || {}) },
              vsOnline: { ...defaults.vsOnline, ...(parsed.vsOnline || {}) },
              inputUsage: { ...defaults.inputUsage, ...(parsed.inputUsage || {}) },
              characterPicks: { ...defaults.characterPicks, ...(parsed.characterPicks || {}) }
            };
            return this.cachedStats!;
          }
        }
      }
    } catch {
      // Storage unavailable
    }

    this.cachedStats = getDefaultStats();
    this.save();
    return this.cachedStats;
  }

  public static save(): void {
    if (!this.cachedStats) return;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cachedStats));
      }
    } catch {
      // Storage quota or private browsing
    }
  }

  public static getStats(): GameStats {
    return this.load();
  }

  public static resetStats(): void {
    this.cachedStats = getDefaultStats();
    this.save();
  }

  public static recordMatchStart(mode: string, characterId: string): void {
    const stats = this.load();
    stats.totalMatches++;

    const normalizedMode = mode as keyof GameStats['modeMatches'];
    if (stats.modeMatches[normalizedMode] !== undefined) {
      stats.modeMatches[normalizedMode]++;
    }

    if (characterId) {
      stats.characterPicks[characterId] = (stats.characterPicks[characterId] || 0) + 1;
    }

    this.save();
  }

  public static recordMatchEnd(
    mode: string,
    durationSeconds: number,
    isVictory: boolean,
    difficulty?: GameDifficulty
  ): void {
    const stats = this.load();
    stats.totalPlayTimeSeconds += Math.max(1, Math.round(durationSeconds));

    if (mode === 'vs_cpu' && difficulty) {
      const diffStat = stats.vsCpu[difficulty] || { wins: 0, losses: 0 };
      if (isVictory) {
        diffStat.wins++;
      } else {
        diffStat.losses++;
      }
      stats.vsCpu[difficulty] = diffStat;
    } else if (mode === 'vs_online') {
      stats.vsOnline.matchesPlayed++;
      if (isVictory) {
        stats.vsOnline.wins++;
      } else {
        stats.vsOnline.losses++;
      }
    } else if (mode === 'challenge' && isVictory && difficulty) {
      const diffStat = stats.vsCpu[difficulty] || { wins: 0, losses: 0 };
      diffStat.wins++;
      stats.vsCpu[difficulty] = diffStat;
    }

    this.save();
  }

  public static recordSwap(inputType?: 'keyboard' | 'touch' | 'gamepad'): void {
    const stats = this.load();
    stats.totalSwaps++;
    if (inputType && stats.inputUsage[inputType] !== undefined) {
      stats.inputUsage[inputType]++;
    }
    // Throttle saves on high-frequency swaps
    if (stats.totalSwaps % 15 === 0) {
      this.save();
    }
  }

  public static recordFastLift(): void {
    const stats = this.load();
    stats.totalFastLifts++;
    if (stats.totalFastLifts % 10 === 0) {
      this.save();
    }
  }

  public static recordMatchEvent(comboSize: number, chainLevel: number): void {
    const stats = this.load();
    stats.totalPanelsCleared += Math.max(3, comboSize);

    if (comboSize === 4) stats.combos4++;
    else if (comboSize === 5) stats.combos5++;
    else if (comboSize >= 6) stats.combos6Plus++;

    if (chainLevel === 2) stats.chains2++;
    else if (chainLevel === 3) stats.chains3++;
    else if (chainLevel === 4) stats.chains4++;
    else if (chainLevel >= 5) stats.chains5Plus++;

    if (chainLevel > stats.maxChain) {
      stats.maxChain = chainLevel;
    }

    this.save();
  }

  public static recordGarbageCleared(count: number = 1): void {
    const stats = this.load();
    stats.totalGarbageCleared += count;
    this.save();
  }

  public static recordFps(fps: number): void {
    if (fps <= 0 || fps > 240) return;
    this.fpsSamples.push(fps);
    if (this.fpsSamples.length > 20) {
      this.fpsSamples.shift();
    }
    const sum = this.fpsSamples.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / this.fpsSamples.length);
    const stats = this.load();
    stats.avgFps = avg;
    this.save();
  }
}
