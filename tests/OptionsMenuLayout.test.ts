import { describe, it, expect } from 'vitest';
import { computeOptionsMenuLayout } from '../src/ui/OptionsMenuLayout';

describe('OptionsMenuLayout - Responsive Mobile & Desktop Layout', () => {
  it('1. Mobile 360x640: Fits viewport without overflowing width or height', () => {
    const layout = computeOptionsMenuLayout(360, 640, 1.0);

    expect(layout.isMobile).toBe(true);

    // Total tabs width fits within screen with margins
    expect(layout.totalTabWidth).toBeLessThanOrEqual(360 - 16);
    expect(layout.useShortLabels).toBe(true);

    // Card dimensions fit within 360px viewport
    expect(layout.cardW).toBeLessThanOrEqual(360 - 20);
    expect(layout.cardW).toBeGreaterThanOrEqual(320);

    // Card top is strictly below tabs with a clean gap
    expect(layout.cardTop).toBeGreaterThan(layout.tabBottom + 10);
    expect(layout.cardY - (layout.cardH / 2) * layout.cardScale).toBe(layout.cardTop);

    // Controls sub-tabs enabled for mobile narrow width
    expect(layout.useMobileControlsSubTabs).toBe(true);

    // Plus/Minus step buttons fit inside the card width
    expect(layout.stepBtnOffset * 2).toBeLessThanOrEqual(layout.cardW - 32);

    // Volume bar fits between plus/minus buttons
    expect(layout.barWidth).toBeLessThanOrEqual(layout.cardW - 60);

    // Back button fits in safe bottom
    expect(layout.backBtnY).toBeLessThanOrEqual(640 - 20);
    expect(layout.backBtnY).toBeGreaterThan(layout.cardBottom);
  });

  it('2. Mobile iPhone 15 (390x844): Dynamic widths and clean spacing', () => {
    const layout = computeOptionsMenuLayout(390, 844, 1.0);

    expect(layout.isMobile).toBe(true);
    expect(layout.totalTabWidth).toBeLessThanOrEqual(390 - 16);
    expect(layout.cardW).toBeLessThanOrEqual(390 - 20);
    expect(layout.cardTop).toBeGreaterThan(layout.tabBottom + 10);
    expect(layout.useMobileControlsSubTabs).toBe(true);
    expect(layout.backBtnY).toBeLessThanOrEqual(844 - 20);
  });

  it('3. Mobile Pixel 7 (412x915): Generous margins and responsive elements', () => {
    const layout = computeOptionsMenuLayout(412, 915, 1.0);

    expect(layout.isMobile).toBe(true);
    expect(layout.totalTabWidth).toBeLessThanOrEqual(412 - 16);
    expect(layout.cardW).toBeLessThanOrEqual(412 - 20);
    expect(layout.cardTop).toBeGreaterThan(layout.tabBottom + 10);
    expect(layout.backBtnY).toBeLessThanOrEqual(915 - 20);
  });

  it('4. Desktop 1080p (1920x1080, uiScale=1.74): Card NEVER covers top navigation tabs', () => {
    const layout = computeOptionsMenuLayout(1920, 1080, 1.74);

    expect(layout.isMobile).toBe(false);
    expect(layout.cardScale).toBeGreaterThanOrEqual(1.2);

    // CRITICAL: Card top edge must be strictly below the navigation tabs bottom edge
    const cardTopEdge = layout.cardY - (layout.cardH / 2) * layout.cardScale;
    expect(cardTopEdge).toBe(layout.cardTop);
    expect(cardTopEdge).toBeGreaterThan(layout.tabBottom + 15);

    // Desktop uses full two-column controls layout (no sub-tabs needed)
    expect(layout.useMobileControlsSubTabs).toBe(false);

    // Tab buttons have ample desktop spacing
    expect(layout.tabWidth).toBeGreaterThanOrEqual(100);

    // Back button is comfortably placed below card
    expect(layout.backBtnY).toBeGreaterThan(layout.cardBottom + 20);
    expect(layout.backBtnY).toBeLessThanOrEqual(1080 - 20);
  });

  it('5. Desktop 720p (1280x720, uiScale=1.16): Card stays below tabs and fits vertically', () => {
    const layout = computeOptionsMenuLayout(1280, 720, 1.16);

    expect(layout.isMobile).toBe(false);
    expect(layout.cardTop).toBeGreaterThan(layout.tabBottom + 15);
    expect(layout.cardBottom).toBeLessThan(layout.backBtnY);
    expect(layout.backBtnY).toBeLessThanOrEqual(720 - 20);
    expect(layout.useMobileControlsSubTabs).toBe(false);
  });

  it('6. Streamlined 4-Tab Reorganization (Gameplay, Audio, Stats, About)', () => {
    // Mobile 2x2 grid tabs fit within mobile width
    const mobileLayout = computeOptionsMenuLayout(360, 640, 1.0);
    expect(mobileLayout.isTwoRowTabs).toBe(true);
    expect(mobileLayout.row1TabWidth).toBeDefined();
    expect(mobileLayout.row2TabWidth).toBeDefined();
    // 2 tabs per row
    expect((mobileLayout.row1TabWidth! * 2) + mobileLayout.tabSpacing).toBeLessThanOrEqual(360 - 16);

    // Desktop 4 tabs in a single row
    const desktopLayout = computeOptionsMenuLayout(1280, 720, 1.0);
    expect(desktopLayout.isTwoRowTabs).toBe(false);
    expect(desktopLayout.totalTabWidth).toBeLessThanOrEqual(1280 - 32);
    expect(desktopLayout.tabWidth).toBeGreaterThanOrEqual(100);
  });
});
