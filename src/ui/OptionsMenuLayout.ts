export interface OptionsMenuLayout {
  isMobile: boolean;
  uiScale: number;
  titleY: number;
  titleSize: number;
  starOffset: number;
  starScale: number;
  tabY: number;
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
  const titleY = Math.round((isMobile ? 36 : 42) * (isMobile ? 1.0 : Math.min(1.3, uiScale)));
  const titleSize = isMobile ? (width < 380 ? 18 : 20) : Math.round(24 * uiScale);

  // Sparkle stars
  const starOffset = isMobile ? Math.min(160, Math.round(width * 0.38)) : Math.round(160 * uiScale);
  const starScale = (isMobile ? 0.9 : 1.2) * (isMobile ? 1.0 : uiScale);

  // Navigation Tabs (4 tabs)
  const tabHeight = Math.round(32 * (isMobile ? 1.0 : Math.min(1.2, uiScale)));
  const tabY = titleY + Math.round((isMobile ? 36 : 44) * (isMobile ? 1.0 : Math.min(1.2, uiScale)));
  const tabBottom = tabY + tabHeight / 2;

  const tabCount = 4;
  const tabMargin = isMobile ? 8 : 16;
  const availableW = width - tabMargin * 2;
  const tabSpacing = isMobile ? (width < 390 ? 4 : 6) : Math.round(8 * uiScale);
  const maxTabW = isMobile
    ? Math.floor((availableW - (tabCount - 1) * tabSpacing) / tabCount)
    : Math.round(108 * uiScale);
  const tabWidth = Math.min(maxTabW, isMobile ? 104 : Math.round(115 * uiScale));
  const totalTabWidth = tabCount * tabWidth + (tabCount - 1) * tabSpacing;
  const useShortLabels = isMobile && width < 400;

  // Card dimensions & scale
  const cardW = isMobile ? Math.min(width - 24, 440) : 450;
  const cardH = 270;
  const barWidth = Math.min(240, Math.round(cardW - 110));
  const stepBtnOffset = Math.min(160, Math.round(cardW / 2 - 28));

  let cardScale = isMobile ? 1.0 : Math.min(1.35, uiScale);
  const availableHeight = height - tabBottom - 75;
  if (!isMobile && cardH * cardScale > availableHeight) {
    cardScale = Math.max(1.0, availableHeight / (cardH + 30));
  }

  const scaledHalfH = (cardH / 2) * cardScale;

  // Card Y positioning: top of card MUST sit strictly below tabs with a clean margin
  const gapBelowTabs = Math.round((isMobile ? 14 : 20) * cardScale);
  const cardTop = tabBottom + gapBelowTabs;
  const cardY = cardTop + scaledHalfH;
  const cardBottom = cardY + scaledHalfH;

  const useMobileControlsSubTabs = isMobile || cardW < 420;

  // Back Button
  const safeBottom = height - Math.round(30 * (isMobile ? 1.0 : Math.min(1.2, uiScale)));
  const preferredBackY = cardBottom + Math.round(32 * cardScale);
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
