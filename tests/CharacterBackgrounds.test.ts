import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CHARACTERS } from '../src/utils/Constants';
import { CHARACTER_BG_PARTICLES, selectMatchBackground } from '../src/utils/Backgrounds';

describe('Character Custom Thematic Backgrounds & Grid Frames', () => {
  const backgroundsDir = path.resolve(__dirname, '../assets/ui/backgrounds');
  const framesDir = path.resolve(__dirname, '../assets/ui/frames');

  it('should ensure all 10 characters have custom background assets generated and present on disk', () => {
    expect(CHARACTERS.length).toBe(10);

    CHARACTERS.forEach((char) => {
      const webpPath = path.join(backgroundsDir, `bg_${char.id}.webp`);
      const pngPath = path.join(backgroundsDir, `bg_${char.id}.png`);

      expect(fs.existsSync(webpPath), `Missing WebP background for ${char.id}`).toBe(true);
      expect(fs.existsSync(pngPath), `Missing PNG fallback background for ${char.id}`).toBe(true);

      const webpStats = fs.statSync(webpPath);
      expect(webpStats.size).toBeGreaterThan(10000); // Verify non-empty file (>10KB)
    });
  });

  it('should ensure each background has a custom themed grid frame present on disk', () => {
    CHARACTERS.forEach((char) => {
      const framePng = path.join(framesDir, `board_frame_${char.id}.png`);
      const frameWebp = path.join(framesDir, `board_frame_${char.id}.webp`);

      expect(fs.existsSync(framePng), `Missing PNG grid frame for ${char.id}`).toBe(true);
      expect(fs.existsSync(frameWebp), `Missing WebP grid frame for ${char.id}`).toBe(true);

      const pngStats = fs.statSync(framePng);
      const webpStats = fs.statSync(frameWebp);
      expect(pngStats.size).toBeGreaterThan(10000);
      expect(webpStats.size).toBeGreaterThan(5000);
    });
  });

  it('should have custom atmospheric particle palettes defined for all 10 characters', () => {
    CHARACTERS.forEach((char) => {
      const particles = CHARACTER_BG_PARTICLES[char.id];
      expect(particles, `Missing particle palette for ${char.id}`).toBeDefined();
      expect(particles.length).toBeGreaterThanOrEqual(3);
      particles.forEach((color) => {
        expect(typeof color).toBe('number');
        expect(color).toBeGreaterThan(0);
      });
    });
  });

  it('should select the opponent custom background when facing them in battle/challenge mode', () => {
    CHARACTERS.forEach((opponent) => {
      const bgKey = selectMatchBackground({
        gameMode: 'challenge',
        characterId: 'kiri',
        opponentCharacterId: opponent.id
      });
      expect(bgKey).toBe(opponent.id);
    });

    const vsCpuBg = selectMatchBackground({
      gameMode: 'vs_cpu',
      characterId: 'mizu',
      opponentCharacterId: 'riff'
    });
    expect(vsCpuBg).toBe('riff');
  });

  it('should select a random background during endless mode', () => {
    const allCharIds = CHARACTERS.map((c) => c.id);
    const selectedBgs = new Set<string>();

    for (let i = 0; i < 50; i++) {
      const bg = selectMatchBackground({
        gameMode: 'endless',
        characterId: 'kiri'
      });
      expect(allCharIds).toContain(bg);
      selectedBgs.add(bg);
    }

    // Over 50 endless runs, multiple different backgrounds should be chosen randomly
    expect(selectedBgs.size).toBeGreaterThan(1);
  });

  it('should select a random background in online matches', () => {
    const allCharIds = CHARACTERS.map((c) => c.id);
    const selectedBgs = new Set<string>();

    // Test different seeds produce randomized arenas across online rooms
    for (let seed = 1000; seed < 1050; seed++) {
      const bg = selectMatchBackground({
        gameMode: 'vs_online',
        characterId: 'kiri',
        opponentCharacterId: 'mizu',
        matchSeed: seed
      });
      expect(allCharIds).toContain(bg);
      selectedBgs.add(bg);
    }

    expect(selectedBgs.size).toBeGreaterThan(1);
  });
});
