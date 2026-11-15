import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundFx } from '../src/utils/SoundFx';
import { StatsManager } from '../src/utils/StatsManager';
import { GameDifficulty } from '../src/utils/Difficulty';

describe('Performance Audit & Lifecycle Regression Tests', () => {
  describe('SoundFx Lifecycle & Oscillator Tracking', () => {
    let mockOscs: any[] = [];
    let mockGains: any[] = [];

    beforeEach(() => {
      mockOscs = [];
      mockGains = [];

      const mockCtx: any = {
        currentTime: 0,
        state: 'running',
        destination: {},
        createOscillator: vi.fn(() => {
          const osc = {
            type: 'sine',
            frequency: {
              setValueAtTime: vi.fn(),
              exponentialRampToValueAtTime: vi.fn(),
              linearRampToValueAtTime: vi.fn()
            },
            connect: vi.fn(),
            disconnect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            onended: null as any
          };
          mockOscs.push(osc);
          return osc;
        }),
        createGain: vi.fn(() => {
          const gain = {
            gain: {
              setValueAtTime: vi.fn(),
              exponentialRampToValueAtTime: vi.fn()
            },
            connect: vi.fn(),
            disconnect: vi.fn()
          };
          mockGains.push(gain);
          return gain;
        })
      };

      (SoundFx as any).ctx = mockCtx;
      SoundFx.enabled = true;
      (SoundFx as any).activeOscillators.clear();
    });

    it('tracks active oscillators when sounds are triggered and stops all on stopAll()', () => {
      SoundFx.playCursor();
      expect((SoundFx as any).activeOscillators.size).toBe(1);

      SoundFx.playMatch();
      // Cursor (1) + Match (3 notes) = 4
      expect((SoundFx as any).activeOscillators.size).toBe(4);

      // Verify stopAll stops and disconnects all
      SoundFx.stopAll();
      expect((SoundFx as any).activeOscillators.size).toBe(0);
      mockOscs.forEach((osc) => {
        expect(osc.stop).toHaveBeenCalled();
        expect(osc.disconnect).toHaveBeenCalled();
      });
    });

    it('onended callback cleans up oscillator and disconnects gain', () => {
      SoundFx.playCursor();
      const osc = mockOscs[0];
      const gain = mockGains[0];

      expect((SoundFx as any).activeOscillators.has(osc)).toBe(true);

      // Simulate natural Web Audio node completion
      if (typeof osc.onended === 'function') {
        osc.onended(new Event('ended'));
      }

      expect((SoundFx as any).activeOscillators.has(osc)).toBe(false);
      expect(osc.disconnect).toHaveBeenCalled();
      expect(gain.disconnect).toHaveBeenCalled();
    });
  });

  describe('StatsManager Throttled Storage IO', () => {
    beforeEach(() => {
      StatsManager.resetStats();
      vi.clearAllMocks();
    });

    it('does not write to localStorage on high-frequency FPS recordings', () => {
      const saveSpy = vi.spyOn(StatsManager, 'save');
      saveSpy.mockClear();

      for (let i = 0; i < 20; i++) {
        StatsManager.recordFps(60);
      }

      // Should not call synchronous save 20 times during gameplay
      expect(saveSpy).not.toHaveBeenCalled();

      // In-memory stats are still accurate
      expect(StatsManager.getStats().avgFps).toBe(60);
      saveSpy.mockRestore();
    });

    it('persists synchronously on match completion', () => {
      const saveSpy = vi.spyOn(StatsManager, 'save');
      saveSpy.mockClear();

      StatsManager.recordMatchEnd('vs_cpu', 60, true, GameDifficulty.NOVICE);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      saveSpy.mockRestore();
    });
  });
});
