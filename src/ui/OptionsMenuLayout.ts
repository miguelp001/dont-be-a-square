export interface OptionsMenuLayout {
  isMobile: boolean;
  uiScale: number;
  titleY: number;
  titleSize: number;
  starOffset: number;
  starScale: number;
  tabY: number;
  tabY2?: number;
  isTwoRowTabs: boolean;
  row1TabWidth?: number;
  row2TabWidth?: number;
  tabHeight: number;
  tabWidth: number;
  tabSpacing: number;
  totalTabWidth: number;
  tabBottom: number;
  useShortLabels: boolean;
  cardW: number;
  cardH: number;
  cardScale: number;
  cardTop: number;
  cardY: number;
  cardBottom: number;
  barWidth: number;
  stepBtnOffset: number;
  useMobileControlsSubTabs: boolean;
  backBtnY: number;
  backBtnWidth: number;
}

export function computeOptionsMenuLayout(
  width: number,
  height: number,
  rawUiScale: number
): OptionsMenuLayout {
  const isMobile = width < 520 || height < 560;
  const uiScale = isMobile ? 1.0 : rawUiScale;

  // Title
  const titleY = Math.round((isMobile ? 32 : 42) * (isMobile ? 1.0 : Math.min(1.3, uiScale)));
  const titleSize = isMobile ? (width < 380 ? 17 : 19) : Math.round(24 * uiScale);

  // Sparkle stars
  const starOffset = isMobile ? Math.min(160, Math.round(width * 0.38)) : Math.round(160 * uiScale);
  const starScale = (isMobile ? 0.85 : 1.2) * (isMobile ? 1.0 : uiScale);

  // Two-row navigation tabs on mobile for generous, touch-friendly 2x2 grid (Gameplay, Audio / Stats, About)
  const isTwoRowTabs = isMobile;
  const tabHeight = Math.round((isMobile ? 26 : 32) * (isMobile ? 1.0 : Math.min(1.2, uiScale)));
  const tabSpacing = isMobile ? (width < 390 ? 5 : 6) : Math.round(6 * uiScale);
  const tabMargin = isMobile ? 10 : 16;
  const availableW = width - tabMargin * 2;

  const tabY = titleY + Math.round((isMobile ? 30 : 44) * (isMobile ? 1.0 : Math.min(1.2, uiScale)));
  const tabY2 = isTwoRowTabs ? tabY + tabHeight + 5 : tabY;
  const tabBottom = isTwoRowTabs ? tabY2 + tabHeight / 2 : tabY + tabHeight / 2;

  // On mobile: 2x2 grid (Row 1: Gameplay, Audio; Row 2: Stats, About)
  const row1TabWidth = isTwoRowTabs ? Math.floor((availableW - 1 * tabSpacing) / 2) : 0;
  const row2TabWidth = isTwoRowTabs ? Math.floor((availableW - 1 * tabSpacing) / 2) : 0;

  // Desktop single-row metrics (4 tabs: Gameplay, Audio, Stats, About):
  const tabCount = 4;
  const maxTabW = isMobile
    ? row1TabWidth
    : Math.floor((availableW - (tabCount - 1) * tabSpacing) / tabCount);
  const tabWidth = isMobile
    ? row1TabWidth
    : Math.max(100, Math.min(maxTabW, Math.round(120 * uiScale)));
  const totalTabWidth = isTwoRowTabs
    ? Math.max(row1TabWidth * 2 + tabSpacing, row2TabWidth * 2 + tabSpacing)
    : tabCount * tabWidth + (tabCount - 1) * tabSpacing;
  const useShortLabels = isMobile && width < 480;

  // Card dimensions & scale
  const cardW = isMobile ? Math.min(width - 24, 440) : 450;
  const cardH = 270;
  const barWidth = Math.min(240, Math.round(cardW - 110));
  const stepBtnOffset = Math.min(160, Math.round(cardW / 2 - 28));

  let cardScale = isMobile ? 1.0 : Math.min(1.35, uiScale);
  const availableHeight = height - tabBottom - 75;
  if (cardH * cardScale > availableHeight) {
    cardScale = Math.max(0.75, availableHeight / (cardH + 20));
  }

  const scaledHalfH = (cardH / 2) * cardScale;

  // Card Y positioning: top of card MUST sit strictly below tabs with a clean margin
  const gapBelowTabs = Math.round((isMobile ? 12 : 20) * cardScale);
  const cardTop = tabBottom + gapBelowTabs;
  const cardY = cardTop + scaledHalfH;
  const cardBottom = cardY + scaledHalfH;

  const useMobileControlsSubTabs = isMobile || cardW < 420;

  // Back Button
  const safeBottom = height - Math.round(28 * (isMobile ? 1.0 : Math.min(1.2, uiScale)));
  const preferredBackY = cardBottom + Math.round((isMobile ? 26 : 32) * cardScale);
  const backBtnY = Math.min(safeBottom, preferredBackY);
  const backBtnWidth = Math.round((isMobile ? Math.min(200, width - 40) : 220) * (isMobile ? 1.0 : cardScale));

  return {
    isMobile,
    uiScale,
    titleY,
    titleSize,
    starOffset,
    starScale,
    tabY,
    tabY2,
    isTwoRowTabs,
    row1TabWidth,
    row2TabWidth,
    tabHeight,
    tabWidth,
    tabSpacing,
    totalTabWidth,
    tabBottom,
    useShortLabels,
    cardW,
    cardH,
    cardScale,
    cardTop,
    cardY,
    cardBottom,
    barWidth,
    stepBtnOffset,
    useMobileControlsSubTabs,
    backBtnY,
    backBtnWidth
  };
}
