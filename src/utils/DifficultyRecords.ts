import { GameDifficulty, DIFFICULTY_ORDER } from './Difficulty';

export interface ChallengeClearRecord {
  cleared: boolean;
  bestTimeSeconds: number;
  characterId: string;
  clearedAt: string;
}

export interface PlayerRecordsData {
  endlessHighScores: Record<GameDifficulty, number>;
  challengeClears: Record<GameDifficulty, ChallengeClearRecord>;
  secretBossUnlocked?: boolean;
  secretBossDefeated?: boolean;
  voidSlimeUnlocked?: boolean;
  voidSlimeDefeated?: boolean;
  nanoBananaUnlocked?: boolean;
  nanoBananaDefeated?: boolean;
}

const STORAGE_KEY = 'dont_be_a_square_records_v1';

function getDefaultRecords(): PlayerRecordsData {
  const endlessHighScores = {} as Record<GameDifficulty, number>;
  const challengeClears = {} as Record<GameDifficulty, ChallengeClearRecord>;

  for (const diff of DIFFICULTY_ORDER) {
    endlessHighScores[diff] = 0;
    challengeClears[diff] = {
      cleared: false,
      bestTimeSeconds: 0,
      characterId: '',
      clearedAt: ''
    };
  }

  return {
    endlessHighScores,
    challengeClears,
    secretBossUnlocked: false,
    secretBossDefeated: false,
    voidSlimeUnlocked: false,
    voidSlimeDefeated: false,
    nanoBananaUnlocked: false,
    nanoBananaDefeated: false
  };
}

export class RecordManager {
  private static cachedData: PlayerRecordsData | null = null;

  public static load(): PlayerRecordsData {
    if (this.cachedData) return this.cachedData;

    const defaults = getDefaultRecords();
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            for (const diff of DIFFICULTY_ORDER) {
              if (typeof parsed.endlessHighScores?.[diff] === 'number') {
                defaults.endlessHighScores[diff] = Math.max(0, parsed.endlessHighScores[diff]);
              }
              if (parsed.challengeClears?.[diff]?.cleared) {
                defaults.challengeClears[diff] = {
                  cleared: true,
                  bestTimeSeconds: Number(parsed.challengeClears[diff].bestTimeSeconds) || 0,
                  characterId: String(parsed.challengeClears[diff].characterId || 'kiri'),
                  clearedAt: String(parsed.challengeClears[diff].clearedAt || '')
                };
              }
            }
            if (parsed.secretBossUnlocked || parsed.voidSlimeUnlocked) {
              defaults.secretBossUnlocked = true;
              defaults.voidSlimeUnlocked = true;
            }
            if (parsed.secretBossDefeated || parsed.voidSlimeDefeated) {
              defaults.secretBossDefeated = true;
              defaults.voidSlimeDefeated = true;
            }
            if (parsed.nanoBananaUnlocked) {
              defaults.nanoBananaUnlocked = true;
            }
            if (parsed.nanoBananaDefeated) {
              defaults.nanoBananaDefeated = true;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse records from localStorage:', e);
    }

    this.cachedData = defaults;
    return this.cachedData;
  }

  public static save(): void {
    if (!this.cachedData) return;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cachedData));
      }
    } catch (e) {
      console.warn('Failed to save records to localStorage:', e);
    }
  }

  public static getEndlessHighScore(diff: GameDifficulty): number {
    const data = this.load();
    return data.endlessHighScores[diff] || 0;
  }

  public static recordEndlessScore(
    diff: GameDifficulty,
    score: number
  ): { isNewRecord: boolean; previousRecord: number; currentRecord: number } {
    const data = this.load();
    const previousRecord = data.endlessHighScores[diff] || 0;
    const isNewRecord = score > previousRecord;

    if (isNewRecord) {
      data.endlessHighScores[diff] = score;
      this.save();
    }

    return {
      isNewRecord,
      previousRecord,
      currentRecord: Math.max(previousRecord, score)
    };
  }

  public static getChallengeClear(diff: GameDifficulty): ChallengeClearRecord {
    const data = this.load();
    return data.challengeClears[diff] || {
      cleared: false,
      bestTimeSeconds: 0,
      characterId: '',
      clearedAt: ''
    };
  }

  public static isTierConquered(diff: GameDifficulty): boolean {
    const data = this.load();
    return Boolean(data.challengeClears[diff]?.cleared);
  }

  public static recordChallengeClear(
    diff: GameDifficulty,
    characterId: string,
    elapsedSeconds: number
  ): { isFirstClear: boolean; isFastestTime: boolean; bestTimeSeconds: number } {
    const data = this.load();
    const current = data.challengeClears[diff];
    const isFirstClear = !current?.cleared;
    const isFastestTime = isFirstClear || elapsedSeconds < (current?.bestTimeSeconds || Infinity);

    const bestTimeSeconds = isFastestTime
      ? elapsedSeconds
      : (current?.bestTimeSeconds || elapsedSeconds);

    data.challengeClears[diff] = {
      cleared: true,
      bestTimeSeconds,
      characterId,
      clearedAt: new Date().toISOString()
    };

    this.save();

    return {
      isFirstClear,
      isFastestTime,
      bestTimeSeconds
    };
  }

  public static getConqueredTierCount(): number {
    const data = this.load();
    let count = 0;
    for (const diff of DIFFICULTY_ORDER) {
      if (data.challengeClears[diff]?.cleared) count++;
    }
    return count;
  }

  public static isVoidSlimeUnlocked(): boolean {
    const data = this.load();
    return Boolean(
      data.voidSlimeUnlocked ||
      data.secretBossUnlocked ||
      data.challengeClears[GameDifficulty.MASTER]?.cleared ||
      data.challengeClears[GameDifficulty.GRANDMASTER]?.cleared
    );
  }

  public static unlockVoidSlime(): void {
    const data = this.load();
    data.voidSlimeUnlocked = true;
    data.secretBossUnlocked = true;
    this.save();
  }

  public static isVoidSlimeDefeated(): boolean {
    const data = this.load();
    return Boolean(data.voidSlimeDefeated || data.secretBossDefeated);
  }

  public static recordVoidSlimeDefeat(): void {
    const data = this.load();
    data.voidSlimeUnlocked = true;
    data.voidSlimeDefeated = true;
    data.secretBossUnlocked = true;
    data.secretBossDefeated = true;
    this.save();
  }

  public static isNanoBananaUnlocked(): boolean {
    const data = this.load();
    return Boolean(
      data.nanoBananaUnlocked ||
      data.challengeClears[GameDifficulty.GRANDMASTER]?.cleared
    );
  }

  public static unlockNanoBanana(): void {
    const data = this.load();
    data.nanoBananaUnlocked = true;
    this.save();
  }

  public static isNanoBananaDefeated(): boolean {
    const data = this.load();
    return Boolean(data.nanoBananaDefeated);
  }

  public static recordNanoBananaDefeat(): void {
    const data = this.load();
    data.nanoBananaUnlocked = true;
    data.nanoBananaDefeated = true;
    this.save();
  }

  public static isCharacterUnlocked(charId: string): boolean {
    if (charId === 'void_slime') return this.isVoidSlimeUnlocked();
    if (charId === 'nano_banana') return this.isNanoBananaUnlocked();
    return true;
  }

  public static isSecretBossUnlocked(): boolean {
    return this.isVoidSlimeUnlocked();
  }

  public static unlockSecretBoss(): void {
    this.unlockVoidSlime();
  }

  public static isSecretBossDefeated(): boolean {
    return this.isVoidSlimeDefeated();
  }

  public static recordSecretBossDefeat(): void {
    this.recordVoidSlimeDefeat();
  }

  public static resetAll(): void {
    this.cachedData = getDefaultRecords();
    this.save();
  }
}
