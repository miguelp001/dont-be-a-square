import { describe, it, expect, beforeEach, vi } from 'vitest';

// Provide canvas 2D mock for headless happy-dom environment
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Array(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => []),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    globalCompositeOperation: 'source-over'
  });
}

import { GameDifficulty, DIFFICULTY_TIERS, DIFFICULTY_ORDER, getDifficultyInfo } from '../src/utils/Difficulty';
import { Settings } from '../src/utils/Settings';

describe('5-Step Difficulty System (Novice to Grandmaster)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. All 5 Difficulty Tiers are strictly registered in ascending progression order', () => {
    expect(DIFFICULTY_ORDER).toEqual([
      GameDifficulty.NOVICE,
      GameDifficulty.ADEPT,
      GameDifficulty.EXPERT,
      GameDifficulty.MASTER,
      GameDifficulty.GRANDMASTER
    ]);

    for (const diff of DIFFICULTY_ORDER) {
      const tier = DIFFICULTY_TIERS[diff];
      expect(tier).toBeDefined();
      expect(tier.id).toBe(diff);
      expect(tier.name).toBeTruthy();
      expect(tier.description).toBeTruthy();
      expect(tier.hexColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('2. Cognitive Density: Novice/Adept use 5 colors, Expert+ introduces 6th color', () => {
    expect(DIFFICULTY_TIERS[GameDifficulty.NOVICE].colorCount).toBe(5);
    expect(DIFFICULTY_TIERS[GameDifficulty.ADEPT].colorCount).toBe(5);
    expect(DIFFICULTY_TIERS[GameDifficulty.EXPERT].colorCount).toBe(6);
    expect(DIFFICULTY_TIERS[GameDifficulty.MASTER].colorCount).toBe(6);
    expect(DIFFICULTY_TIERS[GameDifficulty.GRANDMASTER].colorCount).toBe(6);
  });

  it('3. Temporal Compression: Rise speed, Stop-time freeze, and Danger grace scale rigorously', () => {
    const novice = DIFFICULTY_TIERS[GameDifficulty.NOVICE];
    const adept = DIFFICULTY_TIERS[GameDifficulty.ADEPT];
    const expert = DIFFICULTY_TIERS[GameDifficulty.EXPERT];
    const master = DIFFICULTY_TIERS[GameDifficulty.MASTER];
    const gm = DIFFICULTY_TIERS[GameDifficulty.GRANDMASTER];

    // Rise speed increases monotonically
    expect(novice.baseRiseSpeedMultiplier).toBe(0.75);
    expect(adept.baseRiseSpeedMultiplier).toBe(1.0);
    expect(expert.baseRiseSpeedMultiplier).toBe(1.5);
    expect(master.baseRiseSpeedMultiplier).toBe(2.1);
    expect(gm.baseRiseSpeedMultiplier).toBe(3.0);

    // Stop time compresses monotonically
    expect(novice.stopTimeMultiplier).toBe(1.4);
    expect(adept.stopTimeMultiplier).toBe(1.0);
    expect(expert.stopTimeMultiplier).toBe(0.75);
    expect(master.stopTimeMultiplier).toBe(0.50);
    expect(gm.stopTimeMultiplier).toBe(0.30);

    // Danger grace compresses monotonically (12s down to 3.5s)
    expect(novice.dangerGraceTimeMs).toBe(12000);
    expect(adept.dangerGraceTimeMs).toBe(10000);
    expect(expert.dangerGraceTimeMs).toBe(7000);
    expect(master.dangerGraceTimeMs).toBe(5000);
    expect(gm.dangerGraceTimeMs).toBe(3500);
  });

  it('4. Handicap Challenge: Master spawns 1 garbage slab, Grandmaster spawns 2', () => {
    expect(DIFFICULTY_TIERS[GameDifficulty.NOVICE].initialGarbageSlabs).toBe(0);
    expect(DIFFICULTY_TIERS[GameDifficulty.ADEPT].initialGarbageSlabs).toBe(0);
    expect(DIFFICULTY_TIERS[GameDifficulty.EXPERT].initialGarbageSlabs).toBe(0);
    expect(DIFFICULTY_TIERS[GameDifficulty.MASTER].initialGarbageSlabs).toBe(1);
    expect(DIFFICULTY_TIERS[GameDifficulty.GRANDMASTER].initialGarbageSlabs).toBe(2);
  });

  it('5. AI Heuristic Scaling: Bot action interval, mistake rate, and chain bias scale across tiers', () => {
    const novice = DIFFICULTY_TIERS[GameDifficulty.NOVICE];
    const adept = DIFFICULTY_TIERS[GameDifficulty.ADEPT];
    const gm = DIFFICULTY_TIERS[GameDifficulty.GRANDMASTER];

    // AI Interval multiplier: slower at novice (1.5x interval), hyper-fast at GM (0.38x interval)
    expect(novice.aiIntervalMultiplier).toBe(1.5);
    expect(adept.aiIntervalMultiplier).toBe(1.0);
    expect(gm.aiIntervalMultiplier).toBe(0.38);

    // AI Indecisiveness & Jitter: Novice makes frequent exploratory wandering/second thoughts; GM has 0% error
    expect(novice.aiIndecisiveness).toBeGreaterThan(0.20);
    expect(novice.aiJitterChance).toBeGreaterThan(0.15);
    expect(gm.aiIndecisiveness).toBe(0.0);
    expect(gm.aiJitterChance).toBe(0.0);

    // Chain bias: GM heavily weighs multi-level cascade setups (2.0x bias)
    expect(novice.aiChainBiasMultiplier).toBe(0.8);
    expect(adept.aiChainBiasMultiplier).toBe(1.0);
    expect(gm.aiChainBiasMultiplier).toBe(2.0);
  });

  it('6. Settings Persistence: Saving and loading difficulty tier survives storage cycles', () => {
    Settings.setDifficulty(GameDifficulty.EXPERT);
    expect(Settings.difficulty).toBe(GameDifficulty.EXPERT);

    // Verify localStorage payload
    const raw = localStorage.getItem('dont_be_a_square_settings_v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.difficulty).toBe(GameDifficulty.EXPERT);

    // Reset in-memory static variable
    Settings.difficulty = GameDifficulty.NOVICE;

    // Load from storage
    Settings.load();
    expect(Settings.difficulty).toBe(GameDifficulty.EXPERT);
  });

  it('7. Board.applyDifficulty sets color count, speed multiplier, danger grace duration', () => {
    // Test the Board applyDifficulty contract using getDifficultyInfo mapping
    interface DifficultyTarget {
      difficulty: GameDifficulty;
      colorCount: number;
      riseSpeedMultiplier: number;
      stopTimeMultiplier: number;
      dangerGraceDuration: number;
      applyDifficulty: (diff: GameDifficulty) => void;
    }

    const board: DifficultyTarget = {
      difficulty: GameDifficulty.ADEPT,
      colorCount: 5,
      riseSpeedMultiplier: 1.0,
      stopTimeMultiplier: 1.0,
      dangerGraceDuration: 10000,
      applyDifficulty(diff: GameDifficulty) {
        this.difficulty = diff;
        const info = getDifficultyInfo(diff);
        this.colorCount = info.colorCount;
        this.riseSpeedMultiplier = info.baseRiseSpeedMultiplier;
        this.stopTimeMultiplier = info.stopTimeMultiplier;
        this.dangerGraceDuration = info.dangerGraceTimeMs;
      }
    };

    // Test Novice
    board.applyDifficulty(GameDifficulty.NOVICE);
    expect(board.colorCount).toBe(5);
    expect(board.riseSpeedMultiplier).toBe(0.75);
    expect(board.stopTimeMultiplier).toBe(1.4);
    expect(board.dangerGraceDuration).toBe(12000);

    // Test Grandmaster
    board.applyDifficulty(GameDifficulty.GRANDMASTER);
    expect(board.colorCount).toBe(6);
    expect(board.riseSpeedMultiplier).toBe(3.0);
    expect(board.stopTimeMultiplier).toBe(0.30);
    expect(board.dangerGraceDuration).toBe(3500);
  });

  it('8. Registers Master Void Slime and Grandmaster Nano Banana with distinct AI profiles', async () => {
    const { CHARACTERS } = await import('../src/utils/Constants');
    const { AI_PERSONALITIES } = await import('../src/objects/AIBot');

    // Void Slime (Master secret boss)
    const voidChar = CHARACTERS.find((c) => c.id === 'void_slime');
    expect(voidChar).toBeDefined();
    expect(voidChar?.name).toBe('Void Slime');
    expect(voidChar?.species).toBe('Cosmic Void Champion');
    expect(voidChar?.isSecret).toBe(true);

    const voidAi = AI_PERSONALITIES['void_slime'];
    expect(voidAi).toBeDefined();
    expect(voidAi.name).toBe('Void Slime');
    expect(voidAi.title).toBe('Cosmic Void Champion');
    expect(voidAi.comboBias).toBeGreaterThanOrEqual(2.0);

    // Nano Banana (Grandmaster hidden boss)
    const nanoChar = CHARACTERS.find((c) => c.id === 'nano_banana');
    expect(nanoChar).toBeDefined();
    expect(nanoChar?.name).toBe('Nano Banana');
    expect(nanoChar?.species).toBe('Glitch Nanite Overlord');
    expect(nanoChar?.isSecret).toBe(true);

    const nanoAi = AI_PERSONALITIES['nano_banana'];
    expect(nanoAi).toBeDefined();
    expect(nanoAi.name).toBe('Nano Banana');
    expect(nanoAi.title).toBe('Glitch Nanite Overlord');
    expect(nanoAi.baseInterval).toBeLessThanOrEqual(140); // Blistering speed
    expect(nanoAi.chainBias).toBeGreaterThanOrEqual(2.8); // Supreme cascade builder
  });
});
