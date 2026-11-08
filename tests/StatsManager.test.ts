import { describe, it, expect, beforeEach } from 'vitest';
import { StatsManager } from '../src/utils/StatsManager';
import { GameDifficulty } from '../src/utils/Difficulty';

describe('StatsManager - Telemetry and Gameplay Tracking', () => {
  beforeEach(() => {
    StatsManager.resetStats();
  });

  it('1. Initializes default stats properly on reset', () => {
    const stats = StatsManager.getStats();
    expect(stats.totalMatches).toBe(0);
    expect(stats.totalSwaps).toBe(0);
    expect(stats.totalPlayTimeSeconds).toBe(0);
    expect(stats.maxChain).toBe(0);
    expect(stats.vsCpu[GameDifficulty.NOVICE].wins).toBe(0);
  });

  it('2. Records match start, mode tracking, and character picks', () => {
    StatsManager.recordMatchStart('vs_cpu', 'kiri');
    StatsManager.recordMatchStart('vs_cpu', 'kiri');
    StatsManager.recordMatchStart('endless', 'mizu');

    const stats = StatsManager.getStats();
    expect(stats.totalMatches).toBe(3);
    expect(stats.modeMatches.vs_cpu).toBe(2);
    expect(stats.modeMatches.endless).toBe(1);
    expect(stats.characterPicks['kiri']).toBe(2);
    expect(stats.characterPicks['mizu']).toBe(1);
  });

  it('3. Tracks match completion, duration, and win/loss records by difficulty', () => {
    StatsManager.recordMatchStart('vs_cpu', 'riff');
    StatsManager.recordMatchEnd('vs_cpu', 120, true, GameDifficulty.ADEPT);
    StatsManager.recordMatchStart('vs_cpu', 'riff');
    StatsManager.recordMatchEnd('vs_cpu', 95, false, GameDifficulty.ADEPT);

    const stats = StatsManager.getStats();
    expect(stats.totalPlayTimeSeconds).toBe(215);
    expect(stats.vsCpu[GameDifficulty.ADEPT].wins).toBe(1);
    expect(stats.vsCpu[GameDifficulty.ADEPT].losses).toBe(1);
  });

  it('4. Tracks online 1v1 record correctly', () => {
    StatsManager.recordMatchStart('vs_online', 'volt');
    StatsManager.recordMatchEnd('vs_online', 150, true);
    StatsManager.recordMatchStart('vs_online', 'volt');
    StatsManager.recordMatchEnd('vs_online', 180, false);

    const stats = StatsManager.getStats();
    expect(stats.vsOnline.matchesPlayed).toBe(2);
    expect(stats.vsOnline.wins).toBe(1);
    expect(stats.vsOnline.losses).toBe(1);
  });

  it('5. Tracks combos, chains, and max chain milestone', () => {
    StatsManager.recordMatchEvent(4, 1); // 4-combo
    StatsManager.recordMatchEvent(5, 2); // 5-combo, x2 chain
    StatsManager.recordMatchEvent(6, 4); // 6-combo, x4 chain
    StatsManager.recordMatchEvent(3, 7); // x7 chain

    const stats = StatsManager.getStats();
    expect(stats.combos4).toBe(1);
    expect(stats.combos5).toBe(1);
    expect(stats.combos6Plus).toBe(1);
    expect(stats.chains2).toBe(1);
    expect(stats.chains4).toBe(1);
    expect(stats.chains5Plus).toBe(1);
    expect(stats.maxChain).toBe(7);
  });

  it('6. Tracks input methods (keyboard, touch, gamepad) and fast lifts', () => {
    StatsManager.recordSwap('keyboard');
    StatsManager.recordSwap('keyboard');
    StatsManager.recordSwap('touch');
    StatsManager.recordSwap('gamepad');
    StatsManager.recordFastLift();
    StatsManager.recordFastLift();

    const stats = StatsManager.getStats();
    expect(stats.totalSwaps).toBe(4);
    expect(stats.inputUsage.keyboard).toBe(2);
    expect(stats.inputUsage.touch).toBe(1);
    expect(stats.inputUsage.gamepad).toBe(1);
    expect(stats.totalFastLifts).toBe(2);
  });
});
