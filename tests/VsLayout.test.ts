import { describe, it, expect } from 'vitest';
import { computeVsLayout } from '../src/ui/VsLayout';

describe('VsLayout - Phase 4 Asymmetric Hero & Radar Layout', () => {
  it('1. Computes asymmetric split on iPhone 15 viewport (390x844)', () => {
    const layout = computeVsLayout(390, 844);

    expect(layout.isMobile).toBe(true);

    // 1. Status bar: ~8% of 844 = ~67px
    expect(layout.statusBar.height).toBeGreaterThanOrEqual(50);
    expect(layout.statusBar.height).toBeLessThanOrEqual(80);

    // 2. Opponent Radar: mini-grid cell size ~20px-24px (42% scale)
    expect(layout.opponentRadar.cellSize).toBeGreaterThanOrEqual(18);
    expect(layout.opponentRadar.cellSize).toBeLessThanOrEqual(24);
    expect(layout.opponentRadar.width).toBe(layout.opponentRadar.cellSize * 6);

    // 3. Threat Buffer: positioned to the left of radar
    expect(layout.threatBuffer.x).toBeLessThan(layout.opponentRadar.x);
    expect(layout.threatBuffer.width).toBeGreaterThanOrEqual(80);

    // 4. Divider: separates top radar from player board
    expect(layout.divider.y).toBeGreaterThanOrEqual(layout.opponentRadar.y + layout.opponentRadar.height);

    // 5. Player Grid: Large touch targets (46px - 56px per cell on 844px height)
    expect(layout.playerGrid.cellSize).toBeGreaterThanOrEqual(44);
    expect(layout.playerGrid.cellSize).toBeLessThanOrEqual(56);
    expect(layout.playerGrid.y).toBeGreaterThan(layout.divider.y);

    // 6. Bottom Safe Gutter: Dedicated tap trigger below player board
    expect(layout.bottomGutter.y).toBeGreaterThanOrEqual(layout.playerGrid.y + layout.playerGrid.height);
  });

  it('2. Computes asymmetric split on Pixel 8 viewport (412x915)', () => {
    const layout = computeVsLayout(412, 915);

    expect(layout.isMobile).toBe(true);
    expect(layout.opponentRadar.cellSize).toBeGreaterThanOrEqual(20);
    expect(layout.playerGrid.cellSize).toBeGreaterThanOrEqual(48);
    expect(layout.playerGrid.y + layout.playerGrid.height).toBeLessThanOrEqual(layout.bottomGutter.y + 4);
  });

  it('3. Computes side-by-side split on Desktop viewport (1024x768)', () => {
    const layout = computeVsLayout(1024, 768);

    expect(layout.isMobile).toBe(false);
    expect(layout.playerGrid.x).toBeLessThan(layout.opponentRadar.x);
    expect(layout.playerGrid.width).toBe(layout.opponentRadar.width);
  });
});
