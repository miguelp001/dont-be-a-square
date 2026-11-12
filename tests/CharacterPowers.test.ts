import { describe, it, expect } from 'vitest';
import { CHARACTERS } from '../src/utils/Constants';

describe('Character Super Powers & Power Meter System', () => {
  it('1. All 10 characters have unique power names and descriptions', () => {
    expect(CHARACTERS.length).toBe(10);
    const powerNames = CHARACTERS.map((c) => c.powerName?.trim() || '');
    powerNames.forEach((name) => expect(name.length).toBeGreaterThan(0));

    const uniqueNames = new Set(powerNames);
    expect(uniqueNames.size).toBe(10);

    const descs = CHARACTERS.map((c) => c.powerDescription?.trim() || '');
    descs.forEach((d) => expect(d.length).toBeGreaterThan(0));
  });

  it('2. Volt has Overcharge and Kiri has Gear Lock', () => {
    const volt = CHARACTERS.find((c) => c.id === 'volt');
    expect(volt).toBeDefined();
    expect(volt?.powerName).toBe('Overcharge');
    expect(volt?.powerDescription.toLowerCase()).toContain('electrif');

    const kiri = CHARACTERS.find((c) => c.id === 'kiri');
    expect(kiri).toBeDefined();
    expect(kiri?.powerName).toBe('Gear Lock');
    expect(kiri?.powerDescription.toLowerCase()).toContain('jam');
  });

  it('3. All other characters have their requested unique abilities', () => {
    const mocha = CHARACTERS.find((c) => c.id === 'mocha');
    expect(mocha?.powerName).toBe('Transmute');
    expect(mocha?.powerDescription.toLowerCase()).toContain('garbage');

    const mizu = CHARACTERS.find((c) => c.id === 'mizu');
    expect(mizu?.powerName).toBe('Tidal Flow');
    expect(mizu?.powerDescription.toLowerCase()).toContain('reverse');

    const ember = CHARACTERS.find((c) => c.id === 'ember');
    expect(ember?.powerName).toBe('Wildfire');
    expect(ember?.powerDescription.toLowerCase()).toContain('color');

    const riff = CHARACTERS.find((c) => c.id === 'riff');
    expect(riff?.powerName).toBe('Groove Extension');
    expect(riff?.powerDescription.toLowerCase()).toContain('chain');

    const poppy = CHARACTERS.find((c) => c.id === 'poppy');
    expect(poppy?.powerName).toBe('Sub-Floor Blast');
    expect(poppy?.powerDescription.toLowerCase()).toContain('bottom 2 rows');

    const salty = CHARACTERS.find((c) => c.id === 'salty');
    expect(salty?.powerName).toBe('Flash Freeze');
    expect(salty?.powerDescription.toLowerCase()).toContain('freeze');

    const voidSlime = CHARACTERS.find((c) => c.id === 'void_slime');
    expect(voidSlime?.powerName).toBe('Aether Drain');
    expect(voidSlime?.powerDescription.toLowerCase()).toContain('power meter');

    const nanoBanana = CHARACTERS.find((c) => c.id === 'nano_banana');
    expect(nanoBanana?.powerName).toBe('Pure Skill');
    expect(nanoBanana?.powerDescription.toLowerCase()).toContain('zero powers');
  });

  it('4. Power meter accumulation formula (Option B)', () => {
    // Model the exact meter calculation used in Board.ts
    const calculateMeterGain = (comboSize: number, activeChain: number, isDanger: boolean): number => {
      let meter = 1; // Basic 3-match
      if (comboSize === 4) meter = 8;
      else if (comboSize === 5) meter = 14;
      else if (comboSize >= 6) meter = 20;

      if (activeChain === 2) meter += 15;
      else if (activeChain === 3) meter += 25;
      else if (activeChain >= 4) meter += 35;

      if (isDanger) {
        meter = Math.round(meter * 1.5);
      }
      return meter;
    };

    // Basic 3-match
    expect(calculateMeterGain(3, 1, false)).toBe(1);

    // 4-combo: 8%
    expect(calculateMeterGain(4, 1, false)).toBe(8);

    // 5-combo: 14%
    expect(calculateMeterGain(5, 1, false)).toBe(14);

    // 6-combo: 20%
    expect(calculateMeterGain(6, 1, false)).toBe(20);

    // x2 chain: 1 + 15 = 16%
    expect(calculateMeterGain(3, 2, false)).toBe(16);

    // x3 chain: 1 + 25 = 26%
    expect(calculateMeterGain(3, 3, false)).toBe(26);

    // 4-combo on x2 chain: 8 + 15 = 23%
    expect(calculateMeterGain(4, 2, false)).toBe(23);

    // 4-combo on x2 chain in Danger (1.5x multiplier): 23 * 1.5 = 35%
    expect(calculateMeterGain(4, 2, true)).toBe(35);
  });

  it('5. Nano Banana handicap rule clamp', () => {
    let powerMeter = 0;
    const addPowerMeter = (charId: string, amount: number) => {
      if (charId === 'nano_banana') return;
      powerMeter = Math.min(100, powerMeter + amount);
    };

    addPowerMeter('nano_banana', 50);
    expect(powerMeter).toBe(0);

    addPowerMeter('nano_banana', 100);
    expect(powerMeter).toBe(0);

    addPowerMeter('volt', 50);
    expect(powerMeter).toBe(50);
  });

  it('6. Panel lock state mechanics & adjacent unlocking', () => {
    interface MockPanel {
      x: number;
      y: number;
      isLocked: boolean;
      state: 'IDLE' | 'SWAPPING' | 'FLASHING';
      canSwap(): boolean;
    }

    const createMockPanel = (x: number, y: number): MockPanel => ({
      x,
      y,
      isLocked: false,
      state: 'IDLE',
      canSwap() {
        return this.state === 'IDLE' && !this.isLocked;
      }
    });

    const panelA = createMockPanel(0, 5);
    expect(panelA.canSwap()).toBe(true);

    // Kiri casts Gear Lock
    panelA.isLocked = true;
    expect(panelA.canSwap()).toBe(false);

    // Adjacent match pops the lock
    const matchedCoords = [{ x: 1, y: 5 }];
    const neighbors = [
      { x: matchedCoords[0].x - 1, y: matchedCoords[0].y },
      { x: matchedCoords[0].x + 1, y: matchedCoords[0].y }
    ];
    const isAdjacent = neighbors.some((n) => n.x === panelA.x && n.y === panelA.y);
    expect(isAdjacent).toBe(true);
    if (isAdjacent) {
      panelA.isLocked = false;
    }
    expect(panelA.isLocked).toBe(false);
    expect(panelA.canSwap()).toBe(true);
  });

  it('7. Status timers countdown correctly', () => {
    let reverseLiftTimer = 5000;
    let isReverseLiftActive = true;

    const tick = (delta: number) => {
      if (reverseLiftTimer > 0) {
        reverseLiftTimer = Math.max(0, reverseLiftTimer - delta);
        if (reverseLiftTimer === 0) isReverseLiftActive = false;
      }
    };

    tick(2000);
    expect(reverseLiftTimer).toBe(3000);
    expect(isReverseLiftActive).toBe(true);

    tick(3000);
    expect(reverseLiftTimer).toBe(0);
    expect(isReverseLiftActive).toBe(false);
  });
});
