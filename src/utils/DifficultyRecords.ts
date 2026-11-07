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

  return { endlessHighScores, challengeClears, secretBossUnlocked: false, secretBossDefeated: false };
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
            if (parsed.secretBossUnlocked) {
              defaults.secretBossUnlocked = true;
            }
            if (parsed.secretBossDefeated) {
              defaults.secretBossDefeated = true;
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

  public static isSecretBossUnlocked(): boolean {
    const data = this.load();
    return Boolean(
      data.secretBossUnlocked ||
      data.challengeClears[GameDifficulty.MASTER]?.cleared ||
      data.challengeClears[GameDifficulty.GRANDMASTER]?.cleared
    );
  }

  public static unlockSecretBoss(): void {
    const data = this.load();
    data.secretBossUnlocked = true;
    this.save();
  }

  public static isSecretBossDefeated(): boolean {
    const data = this.load();
    return Boolean(data.secretBossDefeated);
  }

  public static recordSecretBossDefeat(): void {
    const data = this.load();
    data.secretBossUnlocked = true;
    data.secretBossDefeated = true;
    this.save();
  }

  public static resetAll(): void {
    this.cachedData = getDefaultRecords();
    this.save();
  }
}
