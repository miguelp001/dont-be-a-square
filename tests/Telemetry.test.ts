import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TelemetryManager } from '../server/telemetry';
import fs from 'fs';
import path from 'path';

describe('TelemetryManager', () => {
  const testDataPath = path.join(__dirname, 'test_telemetry.json');

  beforeEach(() => {
    if (fs.existsSync(testDataPath)) {
      fs.unlinkSync(testDataPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDataPath)) {
      fs.unlinkSync(testDataPath);
    }
  });

  it('should initialize with default zero values and valid characters', () => {
    const mgr = new TelemetryManager(testDataPath);
    const summary = mgr.getSummary();

    expect(summary.totalMatches).toBe(0);
    expect(summary.totalPanelsCleared).toBe(0);
    expect(summary.totalGarbageCleared).toBe(0);
    expect(summary.totalPowersActivated).toBe(0);
    expect(summary.characters.kiri).toBeDefined();
    expect(summary.characters.kiri.picks).toBe(0);
    expect(summary.characters.kiri.winRate).toBe(0);
    expect(summary.characters.nano_banana).toBeDefined();
    expect(summary.characters.mocha).toBeDefined();
    expect(summary.characters.salty).toBeDefined();
  });

  it('should reject invalid payloads or unknown character IDs', () => {
    const mgr = new TelemetryManager(testDataPath);

    expect(mgr.recordMatch(null as any)).toBe(false);
    expect(mgr.recordMatch({} as any)).toBe(false);
    expect(mgr.recordMatch({ mode: 'endless', characterId: 'superman' })).toBe(false);

    expect(mgr.getSummary().totalMatches).toBe(0);
  });

  it('should sanitize numbers and accumulate match metrics accurately', () => {
    const mgr = new TelemetryManager(testDataPath);

    const success = mgr.recordMatch({
      mode: 'vs_cpu',
      difficulty: 'expert',
      characterId: 'kiri',
      opponentCharacterId: 'mizu',
      isVictory: true,
      score: 12500,
      maxChain: 5,
      matchDurationSeconds: 110,
      panelsCleared: 240,
      garbageCleared: 18,
      swaps: 95,
      fastLifts: 12,
      combos4: 4,
      combos5: 2,
      combos6Plus: 1,
      chains2: 3,
      chains3: 2,
      chains4: 1,
      chains5Plus: 1,
      powerActivations: {
        kiri: 2,
        mizu: 1
      },
      inputDevice: 'keyboard'
    });

    expect(success).toBe(true);

    const summary = mgr.getSummary();
    expect(summary.totalMatches).toBe(1);
    expect(summary.totalPanelsCleared).toBe(240);
    expect(summary.totalGarbageCleared).toBe(18);
    expect(summary.totalSwaps).toBe(95);
    expect(summary.totalFastLifts).toBe(12);
    expect(summary.totalPlayTimeSeconds).toBe(110);
    expect(summary.totalPowersActivated).toBe(3);

    // Kiri stats
    const kiri = summary.characters.kiri;
    expect(kiri.picks).toBe(1);
    expect(kiri.wins).toBe(1);
    expect(kiri.losses).toBe(0);
    expect(kiri.winRate).toBe(100);
    expect(kiri.powerActivations).toBe(2);
    expect(kiri.powerPerMatch).toBe(2);
    expect(kiri.maxChain).toBe(5);
    expect(kiri.avgScore).toBe(12500);

    // Mizu stats (as opponent)
    const mizu = summary.characters.mizu;
    expect(mizu.losses).toBe(1);
    expect(mizu.wins).toBe(0);
    expect(mizu.winRate).toBe(0);
    expect(mizu.powerActivations).toBe(1);

    // Distribution
    expect(summary.modes.vs_cpu).toBe(1);
    expect(summary.difficulties.expert).toBe(1);
    expect(summary.inputDevices.keyboard).toBe(1);
    expect(summary.combos.combos4).toBe(4);
    expect(summary.chains.chains2).toBe(3);
  });

  it('should calculate win rates and pick rates across multiple matches', () => {
    const mgr = new TelemetryManager(testDataPath);

    // Match 1: Kiri wins against Riff
    mgr.recordMatch({
      mode: 'vs_cpu',
      difficulty: 'adept',
      characterId: 'kiri',
      opponentCharacterId: 'riff',
      isVictory: true,
      score: 5000,
      panelsCleared: 50,
      swaps: 20
    });

    // Match 2: Kiri loses against Riff
    mgr.recordMatch({
      mode: 'vs_cpu',
      difficulty: 'adept',
      characterId: 'kiri',
      opponentCharacterId: 'riff',
      isVictory: false,
      score: 3000,
      panelsCleared: 40,
      swaps: 15
    });

    // Match 3: Ember plays Endless
    mgr.recordMatch({
      mode: 'endless',
      difficulty: 'novice',
      characterId: 'ember',
      score: 8000,
      panelsCleared: 100,
      swaps: 40
    });

    const summary = mgr.getSummary();
    expect(summary.totalMatches).toBe(3);

    // Pick rates: Kiri 2/3 (66.7%), Ember 1/3 (33.3%)
    expect(summary.characters.kiri.pickRate).toBe(66.7);
    expect(summary.characters.ember.pickRate).toBe(33.3);

    // Win rate: Kiri 1 win, 1 loss = 50%
    expect(summary.characters.kiri.winRate).toBe(50);
    // Riff: 1 win, 1 loss as opponent = 50%
    expect(summary.characters.riff.winRate).toBe(50);
  });

  it('should persist and reload data cleanly across instances', () => {
    const mgr1 = new TelemetryManager(testDataPath);
    mgr1.recordMatch({
      mode: 'challenge',
      difficulty: 'master',
      characterId: 'void_slime',
      isVictory: true,
      panelsCleared: 300,
      swaps: 120,
      powerActivations: { void_slime: 4 }
    });
    mgr1.flushPendingSave();

    // Load with new instance
    const mgr2 = new TelemetryManager(testDataPath);
    const summary = mgr2.getSummary();

    expect(summary.totalMatches).toBe(1);
    expect(summary.totalPanelsCleared).toBe(300);
    expect(summary.characters.void_slime.picks).toBe(1);
    expect(summary.characters.void_slime.powerActivations).toBe(4);
  });
});
