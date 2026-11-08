import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundFx } from '../src/utils/SoundFx';

describe('SoundFx - Phase 3 Procedural Web Audio Engine', () => {
  let createdOscillators: any[] = [];
  let createdGains: any[] = [];

  beforeEach(() => {
    createdOscillators = [];
    createdGains = [];

    // Mock AudioContext
    const mockCtx: any = {
      currentTime: 10,
      state: 'running',
      destination: {},
      createOscillator: vi.fn(() => {
        const osc = {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn()
          },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn()
        };
        createdOscillators.push(osc);
        return osc;
      }),
      createGain: vi.fn(() => {
        const gain = {
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn()
          },
          connect: vi.fn()
        };
        createdGains.push(gain);
        return gain;
      })
    };

    (SoundFx as any).ctx = mockCtx;
    SoundFx.enabled = true;
  });

  it('1. playSwapCommit executes tactile dual-stage mechanical click', () => {
    SoundFx.playSwapCommit();

    // 2 oscillators: click impulse + resonant tone
    expect(createdOscillators.length).toBe(2);
    expect(createdOscillators[0].type).toBe('square');
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(1450, 10);
    expect(createdOscillators[1].type).toBe('triangle');
  });

  it('2. playCombo shifts pitch up by +1 semitone per cascade level', () => {
    // Test chain level 1 (base C5 ~523.25 Hz)
    SoundFx.playCombo(1);
    const rootOscLevel1 = createdOscillators[0];
    const initialFreq = rootOscLevel1.frequency.setValueAtTime.mock.calls[0][0];
    expect(Math.round(initialFreq)).toBe(523);

    // Test chain level 2 (C#5 = 523.25 * 2^(1/12) ~ 554.37 Hz)
    createdOscillators = [];
    SoundFx.playCombo(2);
    const rootOscLevel2 = createdOscillators[0];
    const level2Freq = rootOscLevel2.frequency.setValueAtTime.mock.calls[0][0];
    expect(Math.round(level2Freq)).toBe(554);

    // Ratio between consecutive chain levels must equal 2^(1/12) (1 semitone ~ 1.05946)
    const semitoneRatio = level2Freq / initialFreq;
    expect(semitoneRatio).toBeCloseTo(1.05946, 3);
  });

  it('3. playPowerChord executes 4-voice electric rock guitar chord without errors', () => {
    createdOscillators = [];
    SoundFx.playPowerChord();

    expect(createdOscillators.length).toBe(4);
    expect(createdOscillators[0].type).toBe('sawtooth');
    // Root note E3 ~ 164.81 Hz
    expect(Math.round(createdOscillators[0].frequency.setValueAtTime.mock.calls[0][0])).toBe(165);
  });

  it('4. plays character signature attack sounds correctly', () => {
    // Kiri: Wrench Clank
    createdOscillators = [];
    SoundFx.playWrenchClank();
    expect(createdOscillators.length).toBe(3);

    // Mizu: Water Slash
    createdOscillators = [];
    SoundFx.playWaterSlash();
    expect(createdOscillators.length).toBe(2);

    // Mocha: Potion Bubble
    createdOscillators = [];
    SoundFx.playPotionBubble();
    expect(createdOscillators.length).toBe(4);

    // Ember: Fire Whoosh
    createdOscillators = [];
    SoundFx.playFireWhoosh();
    expect(createdOscillators.length).toBe(2);

    // Volt: Electric Zap
    createdOscillators = [];
    SoundFx.playElectricZap();
    expect(createdOscillators.length).toBe(1);

    // Salty: Cannon Boom
    createdOscillators = [];
    SoundFx.playCannonBoom();
    expect(createdOscillators.length).toBe(3);

    // Poppy: Idol Sparkle
    createdOscillators = [];
    SoundFx.playSparkleIdol();
    expect(createdOscillators.length).toBe(4);
  });
});
