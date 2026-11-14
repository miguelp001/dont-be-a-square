import fs from 'fs';
import path from 'path';

export const VALID_CHARACTERS = [
  'kiri',
  'mizu',
  'riff',
  'ember',
  'poppy',
  'volt',
  'void_slime',
  'mocha',
  'salty',
  'nano_banana'
] as const;

export type ValidCharacterId = (typeof VALID_CHARACTERS)[number];

export interface MatchTelemetryPayload {
  mode: string;
  difficulty?: string;
  characterId: string;
  opponentCharacterId?: string;
  isVictory?: boolean;
  score?: number;
  maxChain?: number;
  matchDurationSeconds?: number;
  panelsCleared?: number;
  garbageCleared?: number;
  swaps?: number;
  fastLifts?: number;
  combos4?: number;
  combos5?: number;
  combos6Plus?: number;
  chains2?: number;
  chains3?: number;
  chains4?: number;
  chains5Plus?: number;
  powerActivations?: Record<string, number>;
  inputDevice?: 'keyboard' | 'touch' | 'gamepad';
}

export interface CharacterTelemetry {
  picks: number;
  wins: number;
  losses: number;
  powerActivations: number;
  totalScore: number;
  maxChain: number;
}

export interface CharacterBalanceSummary extends CharacterTelemetry {
  id: string;
  pickRate: number; // 0 - 100%
  winRate: number; // 0 - 100%
  powerPerMatch: number;
  avgScore: number;
}

export interface StoredTelemetryData {
  totalMatches: number;
  totalPlayTimeSeconds: number;
  totalPanelsCleared: number;
  totalGarbageCleared: number;
  totalSwaps: number;
  totalFastLifts: number;
  characters: Record<string, CharacterTelemetry>;
  modes: Record<string, number>;
  difficulties: Record<string, number>;
  inputDevices: {
    keyboard: number;
    touch: number;
    gamepad: number;
  };
  combos: {
    combos4: number;
    combos5: number;
    combos6Plus: number;
  };
  chains: {
    chains2: number;
    chains3: number;
    chains4: number;
    chains5Plus: number;
  };
  lastUpdated: string;
}

export interface TelemetrySummaryResponse {
  totalMatches: number;
  totalPlayTimeSeconds: number;
  totalPanelsCleared: number;
  totalGarbageCleared: number;
  totalSwaps: number;
  totalFastLifts: number;
  totalPowersActivated: number;
  characters: Record<string, CharacterBalanceSummary>;
  modes: Record<string, number>;
  difficulties: Record<string, number>;
  inputDevices: {
    keyboard: number;
    touch: number;
    gamepad: number;
  };
  combos: {
    combos4: number;
    combos5: number;
    combos6Plus: number;
  };
  chains: {
    chains2: number;
    chains3: number;
    chains4: number;
    chains5Plus: number;
  };
  lastUpdated: string;
}

function getDefaultStoredData(): StoredTelemetryData {
  const characters: Record<string, CharacterTelemetry> = {};
  for (const charId of VALID_CHARACTERS) {
    characters[charId] = {
      picks: 0,
      wins: 0,
      losses: 0,
      powerActivations: 0,
      totalScore: 0,
      maxChain: 0
    };
  }

  return {
    totalMatches: 0,
    totalPlayTimeSeconds: 0,
    totalPanelsCleared: 0,
    totalGarbageCleared: 0,
    totalSwaps: 0,
    totalFastLifts: 0,
    characters,
    modes: {
      endless: 0,
      challenge: 0,
      vs_cpu: 0,
      vs_online: 0,
      time_attack: 0,
      score_attack: 0
    },
    difficulties: {
      novice: 0,
      adept: 0,
      expert: 0,
      master: 0,
      grandmaster: 0
    },
    inputDevices: {
      keyboard: 0,
      touch: 0,
      gamepad: 0
    },
    combos: {
      combos4: 0,
      combos5: 0,
      combos6Plus: 0
    },
    chains: {
      chains2: 0,
      chains3: 0,
      chains4: 0,
      chains5Plus: 0
    },
    lastUpdated: new Date().toISOString()
  };
}

export class TelemetryManager {
  private filePath: string;
  private data: StoredTelemetryData;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath;
    } else {
      const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
      this.filePath = path.join(dataDir, 'telemetry.json');
    }
    this.data = getDefaultStoredData();
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const defaults = getDefaultStoredData();
          this.data = {
            ...defaults,
            ...parsed,
            characters: { ...defaults.characters, ...(parsed.characters || {}) },
            modes: { ...defaults.modes, ...(parsed.modes || {}) },
            difficulties: { ...defaults.difficulties, ...(parsed.difficulties || {}) },
            inputDevices: { ...defaults.inputDevices, ...(parsed.inputDevices || {}) },
            combos: { ...defaults.combos, ...(parsed.combos || {}) },
            chains: { ...defaults.chains, ...(parsed.chains || {}) }
          };
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to read telemetry file, initializing fresh:', err);
    }

    this.data = getDefaultStoredData();
    this.saveToDiskSync();
  }

  public clearAll(): void {
    this.data = getDefaultStoredData();
    this.saveToDiskSync();
  }

  public async saveToDiskAsync(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.promises.mkdir(dir, { recursive: true });

      const tmpPath = `${this.filePath}.tmp.${Date.now()}`;
      await fs.promises.writeFile(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
      try {
        await fs.promises.rename(tmpPath, this.filePath);
      } catch {
        await fs.promises.copyFile(tmpPath, this.filePath);
        await fs.promises.unlink(tmpPath);
      }
    } catch (err) {
      console.error('Failed to save telemetry to disk asynchronously:', err);
    }
  }

  public saveToDiskSync(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const tmpPath = `${this.filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
      try {
        fs.renameSync(tmpPath, this.filePath);
      } catch {
        fs.copyFileSync(tmpPath, this.filePath);
        fs.unlinkSync(tmpPath);
      }
    } catch (err) {
      console.error('Failed to save telemetry to disk synchronously:', err);
    }
  }

  private queueSave(): void {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(async () => {
      this.saveTimeout = null;
      await this.saveToDiskAsync();
    }, 1500);
  }

  public flushPendingSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.saveToDiskSync();
  }

  public recordMatch(payload: MatchTelemetryPayload): boolean {
    if (!payload || typeof payload !== 'object') return false;

    const charId = (payload.characterId || '').toLowerCase().trim();
    if (!VALID_CHARACTERS.includes(charId as ValidCharacterId)) {
      return false;
    }

    this.data.totalMatches++;

    // Safe sanitized increments
    const safePanels = Math.max(0, Math.min(100000, Number(payload.panelsCleared) || 0));
    const safeGarbage = Math.max(0, Math.min(10000, Number(payload.garbageCleared) || 0));
    const safeSwaps = Math.max(0, Math.min(50000, Number(payload.swaps) || 0));
    const safeFastLifts = Math.max(0, Math.min(10000, Number(payload.fastLifts) || 0));
    const safeDuration = Math.max(0, Math.min(36000, Number(payload.matchDurationSeconds) || 0));
    const safeScore = Math.max(0, Math.min(100000000, Number(payload.score) || 0));
    const safeMaxChain = Math.max(0, Math.min(99, Number(payload.maxChain) || 0));

    this.data.totalPanelsCleared += safePanels;
    this.data.totalGarbageCleared += safeGarbage;
    this.data.totalSwaps += safeSwaps;
    this.data.totalFastLifts += safeFastLifts;
    this.data.totalPlayTimeSeconds += safeDuration;

    // Character metrics
    const charStats = this.data.characters[charId] || {
      picks: 0,
      wins: 0,
      losses: 0,
      powerActivations: 0,
      totalScore: 0,
      maxChain: 0
    };
    charStats.picks++;
    charStats.totalScore += safeScore;
    if (safeMaxChain > charStats.maxChain) {
      charStats.maxChain = safeMaxChain;
    }

    if (payload.isVictory === true) {
      charStats.wins++;
    } else if (payload.isVictory === false) {
      charStats.losses++;
    }

    // Opponent match record in VS mode
    if (payload.opponentCharacterId) {
      const oppId = payload.opponentCharacterId.toLowerCase().trim();
      if (VALID_CHARACTERS.includes(oppId as ValidCharacterId)) {
        const oppStats = this.data.characters[oppId];
        if (oppStats) {
          if (payload.isVictory === true) {
            oppStats.losses++;
          } else if (payload.isVictory === false) {
            oppStats.wins++;
          }
        }
      }
    }

    // Power activations
    if (payload.powerActivations && typeof payload.powerActivations === 'object') {
      for (const [pChar, pCount] of Object.entries(payload.powerActivations)) {
        const cleanPChar = pChar.toLowerCase().trim();
        const safePCount = Math.max(0, Math.min(100, Number(pCount) || 0));
        if (VALID_CHARACTERS.includes(cleanPChar as ValidCharacterId) && this.data.characters[cleanPChar]) {
          this.data.characters[cleanPChar].powerActivations += safePCount;
        }
      }
    }

    // Game Mode
    if (payload.mode) {
      const cleanMode = payload.mode.toLowerCase().trim();
      this.data.modes[cleanMode] = (this.data.modes[cleanMode] || 0) + 1;
    }

    // Difficulty
    if (payload.difficulty) {
      const cleanDiff = payload.difficulty.toLowerCase().trim();
      this.data.difficulties[cleanDiff] = (this.data.difficulties[cleanDiff] || 0) + 1;
    }

    // Input Device
    if (payload.inputDevice && this.data.inputDevices[payload.inputDevice] !== undefined) {
      this.data.inputDevices[payload.inputDevice]++;
    }

    // Combos & Chains
    const c4 = Math.max(0, Math.min(1000, Number(payload.combos4) || 0));
    const c5 = Math.max(0, Math.min(1000, Number(payload.combos5) || 0));
    const c6 = Math.max(0, Math.min(1000, Number(payload.combos6Plus) || 0));
    this.data.combos.combos4 += c4;
    this.data.combos.combos5 += c5;
    this.data.combos.combos6Plus += c6;

    const ch2 = Math.max(0, Math.min(1000, Number(payload.chains2) || 0));
    const ch3 = Math.max(0, Math.min(1000, Number(payload.chains3) || 0));
    const ch4 = Math.max(0, Math.min(1000, Number(payload.chains4) || 0));
    const ch5 = Math.max(0, Math.min(1000, Number(payload.chains5Plus) || 0));
    this.data.chains.chains2 += ch2;
    this.data.chains.chains3 += ch3;
    this.data.chains.chains4 += ch4;
    this.data.chains.chains5Plus += ch5;

    this.data.lastUpdated = new Date().toISOString();
    this.queueSave();
    return true;
  }

  public getSummary(): TelemetrySummaryResponse {
    let totalPicks = 0;
    let totalPowers = 0;

    for (const c of Object.values(this.data.characters)) {
      totalPicks += c.picks;
      totalPowers += c.powerActivations;
    }

    const calculatedChars: Record<string, CharacterBalanceSummary> = {};

    for (const [id, raw] of Object.entries(this.data.characters)) {
      const totalDecisions = raw.wins + raw.losses;
      const winRate = totalDecisions > 0 ? Math.round((raw.wins / totalDecisions) * 1000) / 10 : 0;
      const pickRate = totalPicks > 0 ? Math.round((raw.picks / totalPicks) * 1000) / 10 : 0;
      const powerPerMatch = raw.picks > 0 ? Math.round((raw.powerActivations / raw.picks) * 100) / 100 : 0;
      const avgScore = raw.picks > 0 ? Math.round(raw.totalScore / raw.picks) : 0;

      calculatedChars[id] = {
        ...raw,
        id,
        pickRate,
        winRate,
        powerPerMatch,
        avgScore
      };
    }

    return {
      totalMatches: this.data.totalMatches,
      totalPlayTimeSeconds: this.data.totalPlayTimeSeconds,
      totalPanelsCleared: this.data.totalPanelsCleared,
      totalGarbageCleared: this.data.totalGarbageCleared,
      totalSwaps: this.data.totalSwaps,
      totalFastLifts: this.data.totalFastLifts,
      totalPowersActivated: totalPowers,
      characters: calculatedChars,
      modes: { ...this.data.modes },
      difficulties: { ...this.data.difficulties },
      inputDevices: { ...this.data.inputDevices },
      combos: { ...this.data.combos },
      chains: { ...this.data.chains },
      lastUpdated: this.data.lastUpdated
    };
  }
}
