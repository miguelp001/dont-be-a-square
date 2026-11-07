import { describe, it, expect, beforeEach } from 'vitest';
import { GameDifficulty, DIFFICULTY_ORDER } from '../src/utils/Difficulty';
import { RecordManager } from '../src/utils/DifficultyRecords';

describe('Phase 3: RecordManager & Tier-Specific Progression Tracking', () => {
  beforeEach(() => {
    localStorage.clear();
    RecordManager.resetAll();
  });

  it('1. Initializes with zero records across all 5 difficulty tiers', () => {
    for (const diff of DIFFICULTY_ORDER) {
      expect(RecordManager.getEndlessHighScore(diff)).toBe(0);
      expect(RecordManager.isTierConquered(diff)).toBe(false);
      const clearRec = RecordManager.getChallengeClear(diff);
      expect(clearRec.cleared).toBe(false);
      expect(clearRec.bestTimeSeconds).toBe(0);
    }
    expect(RecordManager.getConqueredTierCount()).toBe(0);
  });

  it('2. Records Endless high scores per tier independently', () => {
    // Record 50,000 on Novice
    const res1 = RecordManager.recordEndlessScore(GameDifficulty.NOVICE, 50000);
    expect(res1.isNewRecord).toBe(true);
    expect(res1.previousRecord).toBe(0);
    expect(res1.currentRecord).toBe(50000);

    // Record 120,000 on Grandmaster
    const res2 = RecordManager.recordEndlessScore(GameDifficulty.GRANDMASTER, 120000);
    expect(res2.isNewRecord).toBe(true);
    expect(res2.currentRecord).toBe(120000);

    // Verify Adept is still 0 (isolated per tier!)
    expect(RecordManager.getEndlessHighScore(GameDifficulty.ADEPT)).toBe(0);
    expect(RecordManager.getEndlessHighScore(GameDifficulty.NOVICE)).toBe(50000);
    expect(RecordManager.getEndlessHighScore(GameDifficulty.GRANDMASTER)).toBe(120000);

    // Lower score does not overwrite record
    const res3 = RecordManager.recordEndlessScore(GameDifficulty.NOVICE, 35000);
    expect(res3.isNewRecord).toBe(false);
    expect(res3.currentRecord).toBe(50000);
    expect(RecordManager.getEndlessHighScore(GameDifficulty.NOVICE)).toBe(50000);
  });

  it('3. Records Challenge Mode clears, speedrun times, and conquered crowns', () => {
    expect(RecordManager.isTierConquered(GameDifficulty.EXPERT)).toBe(false);

    // First clear of Expert: 240 seconds with Mizu
    const clear1 = RecordManager.recordChallengeClear(GameDifficulty.EXPERT, 'mizu', 240);
    expect(clear1.isFirstClear).toBe(true);
    expect(clear1.isFastestTime).toBe(true);
    expect(clear1.bestTimeSeconds).toBe(240);
    expect(RecordManager.isTierConquered(GameDifficulty.EXPERT)).toBe(true);
    expect(RecordManager.getConqueredTierCount()).toBe(1);

    // Slower clear of Expert (300 seconds) keeps 240 as best
    const clear2 = RecordManager.recordChallengeClear(GameDifficulty.EXPERT, 'riff', 300);
    expect(clear2.isFirstClear).toBe(false);
    expect(clear2.isFastestTime).toBe(false);
    expect(clear2.bestTimeSeconds).toBe(240);

    // Faster speedrun clear of Expert (185 seconds) with 125,000 points updates best
    const clear3 = RecordManager.recordChallengeClear(GameDifficulty.EXPERT, 'sparky', 185, 125000);
    expect(clear3.isFirstClear).toBe(false);
    expect(clear3.isFastestTime).toBe(true);
    expect(clear3.bestTimeSeconds).toBe(185);
    expect(clear3.bestScore).toBe(125000);

    const expertRec = RecordManager.getChallengeClear(GameDifficulty.EXPERT);
    expect(expertRec.cleared).toBe(true);
    expect(expertRec.bestTimeSeconds).toBe(185);
    expect(expertRec.bestScore).toBe(125000);
    expect(expertRec.characterId).toBe('sparky');
  });

  it('4. Survives localStorage reload cycles and persists state', () => {
    RecordManager.recordEndlessScore(GameDifficulty.MASTER, 88800);
    RecordManager.recordChallengeClear(GameDifficulty.GRANDMASTER, 'kiri', 150);

    // Clear cached memory state
    (RecordManager as any).cachedData = null;

    // Load back from localStorage
    expect(RecordManager.getEndlessHighScore(GameDifficulty.MASTER)).toBe(88800);
    expect(RecordManager.isTierConquered(GameDifficulty.GRANDMASTER)).toBe(true);
    expect(RecordManager.getChallengeClear(GameDifficulty.GRANDMASTER).bestTimeSeconds).toBe(150);
  });

  it('5. Tracks Master Void Slime and Grandmaster Nano Banana unlock and defeat states independently', () => {
    // Initially both locked
    expect(RecordManager.isVoidSlimeUnlocked()).toBe(false);
    expect(RecordManager.isVoidSlimeDefeated()).toBe(false);
    expect(RecordManager.isNanoBananaUnlocked()).toBe(false);
    expect(RecordManager.isNanoBananaDefeated()).toBe(false);
    expect(RecordManager.isCharacterUnlocked('void_slime')).toBe(false);
    expect(RecordManager.isCharacterUnlocked('nano_banana')).toBe(false);

    // Defeating Void Slime unlocks it for multiplayer and singleplayer
    RecordManager.recordVoidSlimeDefeat();
    expect(RecordManager.isVoidSlimeUnlocked()).toBe(true);
    expect(RecordManager.isVoidSlimeDefeated()).toBe(true);
    expect(RecordManager.isCharacterUnlocked('void_slime')).toBe(true);
    // Nano Banana remains locked until Grandmaster
    expect(RecordManager.isNanoBananaUnlocked()).toBe(false);
    expect(RecordManager.isCharacterUnlocked('nano_banana')).toBe(false);

    // Defeating Nano Banana on Grandmaster unlocks it
    RecordManager.recordNanoBananaDefeat();
    expect(RecordManager.isNanoBananaUnlocked()).toBe(true);
    expect(RecordManager.isNanoBananaDefeated()).toBe(true);
    expect(RecordManager.isCharacterUnlocked('nano_banana')).toBe(true);

    // Persists across localStorage reloads
    (RecordManager as any).cachedData = null;
    expect(RecordManager.isVoidSlimeUnlocked()).toBe(true);
    expect(RecordManager.isNanoBananaUnlocked()).toBe(true);
  });
});
