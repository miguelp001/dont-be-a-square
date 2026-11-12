import Phaser from 'phaser';
import { CuteUI } from '../utils/CuteUI';
import { Settings, KeyBindings, DEFAULT_KEYBINDINGS } from '../utils/Settings';
import { SoundFx } from '../utils/SoundFx';
import { computeOptionsMenuLayout, OptionsMenuLayout } from '../ui/OptionsMenuLayout';
import { GameDifficulty, DIFFICULTY_ORDER, getDifficultyInfo } from '../utils/Difficulty';
import { StatsManager, GameStats } from '../utils/StatsManager';
import { CHARACTERS } from '../utils/Constants';
import { LeaderboardClient } from '../utils/LeaderboardClient';

export type OptionsTabId = 'gameplay' | 'audio' | 'stats' | 'about';

export default class OptionsMenuScene extends Phaser.Scene {
  private returnScene: string = 'MenuScene';
  private currentTab: OptionsTabId = 'gameplay';

  // Navigation tabs & containers
  private tabButtons: Phaser.GameObjects.Container[] = [];
  private gameplayTabContainer!: Phaser.GameObjects.Container;
  private audioTabContainer!: Phaser.GameObjects.Container;
  private statsTabContainer!: Phaser.GameObjects.Container;
  private aboutTabContainer!: Phaser.GameObjects.Container;

  // Responsive card & layout metrics
  private cardW: number = 450;
  private cardH: number = 270;
  private barWidth: number = 240;
  private onResizeListener?: () => void;

  // Gameplay tab refs
  private diffCenterText?: Phaser.GameObjects.Text;
  private diffDescText?: Phaser.GameObjects.Text;
  private handleBtnText?: Phaser.GameObjects.Text;

  // Audio tab refs
  private musicVolumeText!: Phaser.GameObjects.Text;
  private musicBarGraphics!: Phaser.GameObjects.Graphics;
  private sfxVolumeText!: Phaser.GameObjects.Text;
  private sfxBarGraphics!: Phaser.GameObjects.Graphics;

  // About tab state (Guide vs AI Disclosure)
  private aboutSubTab: 'guide' | 'ai' = 'guide';
  private aboutSubTabButtons: Phaser.GameObjects.Container[] = [];
  private guideMainContainer?: Phaser.GameObjects.Container;
  private aiMainContainer?: Phaser.GameObjects.Container;

  // Interactive Guide category state
  private guideCategory: 'basics' | 'chains' | 'strategy' = 'basics';
  private guideContainers: Map<'basics' | 'chains' | 'strategy', Phaser.GameObjects.Container> = new Map();
  private guideCategoryButtons: Phaser.GameObjects.Container[] = [];

  // Statistics tab state
  private statsSubTab: 'overview' | 'winrates' | 'combos' | 'inputs' = 'overview';
  private statsContainers: Map<'overview' | 'winrates' | 'combos' | 'inputs', Phaser.GameObjects.Container> = new Map();
  private statsSubTabButtons: Phaser.GameObjects.Container[] = [];

  // Controls Modal refs (accessible from Gameplay)
  private controlsModalContainer?: Phaser.GameObjects.Container;
  private listeningAction: keyof KeyBindings | null = null;
  private keyRemapButtons: Map<keyof KeyBindings, { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text }> = new Map();
  private gamepadStatusText!: Phaser.GameObjects.Text;
  private keydownListener?: (event: KeyboardEvent) => void;
  private mobileControlsSubTab: 'keys' | 'gamepad' = 'keys';
  private mobileKeysContainer?: Phaser.GameObjects.Container;
  private mobileGamepadContainer?: Phaser.GameObjects.Container;
  private mobileControlsSubTabButtons: Phaser.GameObjects.Container[] = [];

  // Leaderboard Handle Modal refs (accessible from Gameplay)
  private nameModalContainer?: Phaser.GameObjects.Container;
  private nameSlotsText?: Phaser.GameObjects.Text;
  private nameErrorText?: Phaser.GameObjects.Text;
  private inputName: string = '';
  private isUpdatingName: boolean = false;
  private modalKeydownHandler?: (e: KeyboardEvent) => void;

  constructor() {
    super({ key: 'OptionsMenuScene' });
  }

  init(data: any): void {
    this.returnScene = data?.returnScene || 'MenuScene';
    if (data?.defaultTab && ['gameplay', 'audio', 'stats', 'about'].includes(data.defaultTab)) {
      this.currentTab = data.defaultTab;
    } else if (data?.defaultTab === 'controls') {
      this.currentTab = 'gameplay';
    } else {
      this.currentTab = 'gameplay';
    }
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const rawUiScale = CuteUI.getUIScale(this);
    const layout = computeOptionsMenuLayout(width, height, rawUiScale);

    this.cardW = layout.cardW;
    this.cardH = layout.cardH;
    this.barWidth = layout.barWidth;

    // Drifting cute background pattern
    CuteUI.createCuteBackground(this);

    // Title
    this.add.text(width / 2, layout.titleY, 'OPTIONS & SETTINGS', {
      fontSize: `${layout.titleSize}px`,
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: Math.round(4 * (layout.uiScale > 1.3 ? 1.3 : 1.0))
    }).setOrigin(0.5);

    // Flanking sparkle stars
    this.add.image(width / 2 - layout.starOffset, layout.titleY, 'sparkle_star').setScale(layout.starScale);
    this.add.image(width / 2 + layout.starOffset, layout.titleY, 'sparkle_star').setScale(layout.starScale);

    // Navigation Tabs (4 streamlined tabs: Gameplay, Audio, Stats, About)
    this.createTabs(width / 2, layout);

    // Content Containers (guaranteed strictly below tabs to prevent any overlap)
    this.createGameplayTab(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile);
    this.createAudioTab(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile);
    this.createStatsTab(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile);
    this.createAboutTab(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile);

    if (layout.cardScale > 1.0) {
      this.gameplayTabContainer.setScale(layout.cardScale);
      this.audioTabContainer.setScale(layout.cardScale);
      this.statsTabContainer.setScale(layout.cardScale);
      this.aboutTabContainer.setScale(layout.cardScale);
    }

    // Back Button (Bottom)
    const backBtnText = this.returnScene === 'GameScene' ? 'RESUME GAME' : 'BACK TO MENU';
    CuteUI.createPillButton(
      this,
      width / 2,
      layout.backBtnY,
      backBtnText,
      () => {
        this.goBack();
      },
      {
        textureKey: 'pill_grey',
        fontSize: `${Math.round(15 * (layout.isMobile ? 1.0 : Math.min(1.2, layout.uiScale)))}px`,
        width: layout.backBtnWidth,
        height: Math.round(42 * (layout.isMobile ? 1.0 : Math.min(1.2, layout.uiScale))),
        autoScale: false
      }
    );

    // Controls Modal UI (Depth 70, accessible from Gameplay)
    this.createControlsModalUI(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile, layout.useMobileControlsSubTabs);

    // In-Game Leaderboard Handle Modal (Depth 80, above cards and tabs)
    this.createNameModalUI(width / 2, height / 2, rawUiScale);

    // Setup global keyboard & gamepad navigation for the options menu
    this.setupMenuNavigation();

    // Listen for window resize to reflow responsive layout
    this.onResizeListener = () => {
      this.cleanUpListeners();
      this.scene.restart({ returnScene: this.returnScene, defaultTab: this.currentTab });
    };
    this.scale.on('resize', this.onResizeListener);

    // Show initial tab
    this.switchTab(this.currentTab);
  }

  private goBack(): void {
    SoundFx.playCursor();
    this.cleanUpListeners();
    this.scene.start(this.returnScene);
  }

  private cleanUpListeners(): void {
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = undefined;
    }
    if (this.modalKeydownHandler) {
      window.removeEventListener('keydown', this.modalKeydownHandler);
      this.modalKeydownHandler = undefined;
    }
    if (this.onResizeListener) {
      this.scale.off('resize', this.onResizeListener);
      this.onResizeListener = undefined;
    }
  }

  // =========================================================================
  // TOP NAVIGATION TABS (GAMEPLAY, AUDIO, STATS, ABOUT)
  // =========================================================================

  private createTabs(
    centerX: number,
    layout: OptionsMenuLayout
  ): void {
    this.tabButtons = [];
    const tabs: { id: OptionsTabId; label: string; color: number }[] = [
      { id: 'gameplay', label: layout.useShortLabels ? '🎮 GAME' : '🎮 GAMEPLAY', color: 0x54a0ff },
      { id: 'audio', label: '🎵 AUDIO', color: 0xff69b4 },
      { id: 'stats', label: '📊 STATS', color: 0x2ed573 },
      { id: 'about', label: 'ℹ️ ABOUT', color: 0xa55eea }
    ];

    if (layout.isTwoRowTabs) {
      // Mobile: 2x2 grid (Row 1: Gameplay, Audio; Row 2: Stats, About)
      const row1Tabs = tabs.slice(0, 2);
      const row1W = layout.row1TabWidth || layout.tabWidth;
      const row1Total = 2 * row1W + 1 * layout.tabSpacing;
      const row1StartX = centerX - row1Total / 2 + row1W / 2;

      row1Tabs.forEach((tab, index) => {
        const x = row1StartX + index * (row1W + layout.tabSpacing);
        this.createTabButton(x, layout.tabY, row1W, layout.tabHeight, tab);
      });

      const row2Tabs = tabs.slice(2, 4);
      const row2W = layout.row2TabWidth || layout.tabWidth;
      const row2Total = 2 * row2W + 1 * layout.tabSpacing;
      const row2StartX = centerX - row2Total / 2 + row2W / 2;

      row2Tabs.forEach((tab, index) => {
        const x = row2StartX + index * (row2W + layout.tabSpacing);
        this.createTabButton(x, layout.tabY2 || layout.tabY + 32, row2W, layout.tabHeight, tab);
      });
    } else {
      // Desktop: Single clean row of 4 tabs
      const tabWidth = layout.tabWidth;
      const tabHeight = layout.tabHeight;
      const spacing = layout.tabSpacing;
      const startX = centerX - layout.totalTabWidth / 2 + tabWidth / 2;

      tabs.forEach((tab, index) => {
        const x = startX + index * (tabWidth + spacing);
        this.createTabButton(x, layout.tabY, tabWidth, tabHeight, tab);
      });
    }
  }

  private createTabButton(
    x: number,
    y: number,
    tabWidth: number,
    tabHeight: number,
    tab: { id: OptionsTabId; label: string; color: number }
  ): void {
    const container = this.add.container(x, y);
    container.setDepth(25);
    const halfH = tabHeight / 2;

    const bg = this.add.graphics();
    const drawTab = (active: boolean) => {
      bg.clear();
      bg.fillStyle(active ? tab.color : 0x1e272e, active ? 0.95 : 0.75);
      bg.fillRoundedRect(-tabWidth / 2, -halfH, tabWidth, tabHeight, 7);
      bg.lineStyle(2, active ? 0xffffff : tab.color, active ? 1 : 0.5);
      bg.strokeRoundedRect(-tabWidth / 2, -halfH, tabWidth, tabHeight, 7);
    };

    drawTab(tab.id === this.currentTab);

    const text = this.add.text(0, -1, tab.label, {
      fontSize: `${Math.round(tabHeight * 0.42)}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, tabWidth, tabHeight, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      SoundFx.playCursor();
      this.switchTab(tab.id);
    });

    container.add([bg, text, hit]);
    (container as any).drawTab = drawTab;
    (container as any).tabId = tab.id;
    this.tabButtons.push(container);
  }

  private switchTab(tabId: OptionsTabId): void {
    this.currentTab = tabId;
    this.listeningAction = null;

    // Close any active modal overlay when switching main tabs
    if (this.controlsModalContainer?.visible) {
      this.closeControlsModal();
    }

    this.tabButtons.forEach((btn) => {
      const active = (btn as any).tabId === tabId;
      (btn as any).drawTab(active);
    });

    this.gameplayTabContainer.setVisible(tabId === 'gameplay');
    this.audioTabContainer.setVisible(tabId === 'audio');
    this.statsTabContainer.setVisible(tabId === 'stats');
    this.aboutTabContainer.setVisible(tabId === 'about');
  }

  // =========================================================================
  // TAB 1: GAMEPLAY (DIFFICULTY, LEADERBOARD HANDLE, APP INSTALL, CONTROLS)
  // =========================================================================

  private createGameplayTab(
    x: number,
    y: number,
    cardW: number,
    cardH: number,
    isMobile: boolean
  ): void {
    this.gameplayTabContainer = this.add.container(x, y);

    // Card frame
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    cardBg.lineStyle(2, 0x54a0ff, 0.85);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    this.gameplayTabContainer.add(cardBg);

    const stepBtnOffset = Math.min(160, Math.round(cardW / 2 - 28));

    // Section 1: Default Game Difficulty (Y: -92 to -45)
    const diffLabel = this.add.text(0, -96, '⭐ DEFAULT GAME DIFFICULTY', {
      fontSize: isMobile ? '12px' : '13px',
      color: '#54a0ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2.5
    }).setOrigin(0.5);

    const diffMinusBtn = this.createStepButton(-stepBtnOffset, -68, '◀', () => {
      this.cycleDifficulty(-1);
    });

    const diffPillW = Math.min(190, cardW - 130);
    const diffCenterPill = CuteUI.createPillButton(
      this,
      0,
      -68,
      '',
      () => {
        this.cycleDifficulty(1);
      },
      { textureKey: 'pill_blue', fontSize: isMobile ? '12px' : '13px', width: diffPillW, height: 28, autoScale: false }
    );
    this.diffCenterText = diffCenterPill.list.find((c) => c instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text;

    const diffPlusBtn = this.createStepButton(stepBtnOffset, -68, '▶', () => {
      this.cycleDifficulty(1);
    });

    this.diffDescText = this.add.text(0, -42, '', {
      fontSize: isMobile ? '9.5px' : '10.5px',
      color: '#7bed9f',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1.5,
      align: 'center',
      wordWrap: { width: cardW - 36 }
    }).setOrigin(0.5);

    // Section 2: Leaderboard Arcade Handle (Y: -10 to +35)
    const handleLabel = this.add.text(0, -12, '🏆 LEADERBOARD ARCADE HANDLE', {
      fontSize: isMobile ? '12px' : '13px',
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2.5
    }).setOrigin(0.5);

    const handleBtnW = Math.min(240, cardW - 40);
    const currentName = LeaderboardClient.getDisplayName();
    const handleBtn = CuteUI.createPillButton(
      this,
      0,
      14,
      `👤 ${currentName}  [✏️ CHANGE]`,
      () => {
        this.openNameModal();
      },
      { textureKey: 'pill_purple', fontSize: isMobile ? '11.5px' : '12.5px', width: handleBtnW, height: 28, autoScale: false }
    );
    this.handleBtnText = handleBtn.list.find((c) => c instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text;

    const handleSubText = this.add.text(0, 36, 'Unique tag synced across all global high-score tables', {
      fontSize: isMobile ? '8.5px' : '9.5px',
      color: '#a4b0be',
      fontStyle: 'italic'
    }).setOrigin(0.5);

    // Section 3: App Install & Controls Actions (Y: +62 to +104)
    const actionsLabel = this.add.text(0, 58, '📱 APP & INPUT CONFIGURATION', {
      fontSize: isMobile ? '11px' : '12px',
      color: '#2ed573',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    const halfCardOffset = Math.round(cardW * 0.25);
    const actionBtnW = Math.min(185, Math.floor((cardW - 40) / 2));
    const btnY = 92;

    const installBtn = CuteUI.createPillButton(
      this,
      -halfCardOffset,
      btnY,
      '📲 INSTALL APP',
      () => {
        if ((window as any).deferredInstallPrompt && (window as any).promptPwaInstall) {
          (window as any).promptPwaInstall();
        } else {
          alert("To install as an app:\n• On Chrome/Edge/Android: Tap browser menu (⋮) -> 'Install App'\n• On iPhone/Safari: Tap Share icon (⎋) -> 'Add to Home Screen'");
        }
      },
      { textureKey: 'pill_green', fontSize: isMobile ? '11px' : '12px', width: actionBtnW, height: 28 }
    );

    const controlsBtn = CuteUI.createPillButton(
      this,
      halfCardOffset,
      btnY,
      '🎮 CONTROLS',
      () => {
        this.openControlsModal();
      },
      { textureKey: 'pill_blue', fontSize: isMobile ? '11px' : '12px', width: actionBtnW, height: 28 }
    );

    this.gameplayTabContainer.add([
      diffLabel,
      diffMinusBtn,
      diffCenterPill,
      diffPlusBtn,
      this.diffDescText,
      handleLabel,
      handleBtn,
      handleSubText,
      actionsLabel,
      installBtn,
      controlsBtn
    ]);

    this.updateDifficultyDisplay();
  }

  // =========================================================================
  // TAB 2: AUDIO (SFX & BACKGROUND MUSIC VOLUME WITH SPACIOUS DESIGN)
  // =========================================================================

  private createAudioTab(
    x: number,
    y: number,
    cardW: number,
    cardH: number,
    isMobile: boolean
  ): void {
    this.audioTabContainer = this.add.container(x, y);

    // Card frame
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    cardBg.lineStyle(2, 0xff69b4, 0.85);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    this.audioTabContainer.add(cardBg);

    const stepBtnOffset = Math.min(160, Math.round(cardW / 2 - 28));

    // 1. Music Volume Row (Y: -85 to -48)
    const musicLabel = this.add.text(0, -84, '🎵 BACKGROUND MUSIC (BGM)', {
      fontSize: isMobile ? '12.5px' : '13.5px',
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2.5
    }).setOrigin(0.5);

    this.musicBarGraphics = this.add.graphics();
    this.musicVolumeText = this.add.text(0, -56, '', {
      fontSize: '13.5px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const musicMinusBtn = this.createStepButton(-stepBtnOffset, -56, '➖', () => {
      Settings.setMusicVolume(Settings.musicVolume - 0.1, this);
      this.updateAudioDisplays();
      SoundFx.playCursor();
    });

    const musicPlusBtn = this.createStepButton(stepBtnOffset, -56, '➕', () => {
      Settings.setMusicVolume(Settings.musicVolume + 0.1, this);
      this.updateAudioDisplays();
      SoundFx.playCursor();
    });

    // 2. SFX Volume Row (Y: -10 to +28)
    const sfxLabel = this.add.text(0, -6, '🔊 SOUND EFFECTS (SFX)', {
      fontSize: isMobile ? '12.5px' : '13.5px',
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2.5
    }).setOrigin(0.5);

    this.sfxBarGraphics = this.add.graphics();
    this.sfxVolumeText = this.add.text(0, 22, '', {
      fontSize: '13.5px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const sfxMinusBtn = this.createStepButton(-stepBtnOffset, 22, '➖', () => {
      Settings.setSfxVolume(Settings.sfxVolume - 0.1);
      this.updateAudioDisplays();
      SoundFx.playSwap();
    });

    const sfxPlusBtn = this.createStepButton(stepBtnOffset, 22, '➕', () => {
      Settings.setSfxVolume(Settings.sfxVolume + 0.1);
      this.updateAudioDisplays();
      SoundFx.playMatch();
    });

    // 3. Audio Quick Presets (Y: +70 to +105)
    const presetLabel = this.add.text(0, 68, '⚡ AUDIO PRESETS & TESTING', {
      fontSize: isMobile ? '11px' : '12px',
      color: '#2ed573',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    const pBtnW = Math.min(125, Math.floor((cardW - 44) / 3));
    const pBtnH = 26;
    const pY = 96;
    const pSpacing = Math.round((cardW - 32) / 3);

    const resetBtn = CuteUI.createPillButton(this, -pSpacing, pY, 'DEFAULT (80%)', () => {
      Settings.setMusicVolume(0.8, this);
      Settings.setSfxVolume(0.8);
      this.updateAudioDisplays();
      SoundFx.playMatch();
    }, { textureKey: 'pill_blue', fontSize: isMobile ? '10px' : '11px', width: pBtnW, height: pBtnH, autoScale: false });

    const muteBtn = CuteUI.createPillButton(this, 0, pY, '🔇 MUTE ALL', () => {
      if (Settings.musicVolume > 0 || Settings.sfxVolume > 0) {
        Settings.setMusicVolume(0.0, this);
        Settings.setSfxVolume(0.0);
      } else {
        Settings.setMusicVolume(0.8, this);
        Settings.setSfxVolume(0.8);
      }
      this.updateAudioDisplays();
      SoundFx.playCursor();
    }, { textureKey: 'pill_purple', fontSize: isMobile ? '10px' : '11px', width: pBtnW, height: pBtnH, autoScale: false });

    const testBtn = CuteUI.createPillButton(this, pSpacing, pY, '▶ TEST SFX', () => {
      SoundFx.playMatch();
    }, { textureKey: 'pill_green', fontSize: isMobile ? '10px' : '11px', width: pBtnW, height: pBtnH, autoScale: false });

    this.audioTabContainer.add([
      musicLabel,
      this.musicBarGraphics,
      this.musicVolumeText,
      musicMinusBtn,
      musicPlusBtn,
      sfxLabel,
      this.sfxBarGraphics,
      this.sfxVolumeText,
      sfxMinusBtn,
      sfxPlusBtn,
      presetLabel,
      resetBtn,
      muteBtn,
      testBtn
    ]);

    this.updateAudioDisplays();
  }

  // =========================================================================
  // TAB 3: STATS (ORGANIZED NEATLY: OVERVIEW, WIN RATES, COMBOS, INPUTS)
  // =========================================================================

  private createStatsTab(
    x: number,
    y: number,
    cardW: number,
    cardH: number,
    isMobile: boolean
  ): void {
    this.statsTabContainer = this.add.container(x, y);

    // Card frame
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    cardBg.lineStyle(2, 0x2ed573, 0.85);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    this.statsTabContainer.add(cardBg);

    this.statsContainers.clear();
    this.statsSubTabButtons = [];

    // 4 Clean Sub-Tab Selectors at the Top of Card
    const subTabs: { id: 'overview' | 'winrates' | 'combos' | 'inputs'; label: string; color: number }[] = [
      { id: 'overview', label: '📊 OVERVIEW', color: 0x54a0ff },
      { id: 'winrates', label: '⚔️ WIN RATES', color: 0x2ed573 },
      { id: 'combos', label: '⚡ COMBOS', color: 0xff9f43 },
      { id: 'inputs', label: '🎮 INPUTS', color: 0xa55eea }
    ];

    const subTabSpacing = 5;
    const subTabW = Math.floor((cardW - 28 - (subTabs.length - 1) * subTabSpacing) / subTabs.length);
    const subTabH = 24;
    const subStartX = -cardW / 2 + 14 + subTabW / 2;
    const subY = -cardH / 2 + 20;

    subTabs.forEach((st, idx) => {
      const topX = subStartX + idx * (subTabW + subTabSpacing);
      const topContainer = this.add.container(topX, subY);
      const topBg = this.add.graphics();

      const drawTopicTab = (active: boolean) => {
        topBg.clear();
        topBg.fillStyle(active ? st.color : 0x110d20, active ? 0.95 : 0.75);
        topBg.fillRoundedRect(-subTabW / 2, -subTabH / 2, subTabW, subTabH, 6);
        topBg.lineStyle(1.5, active ? 0xffffff : 0x3d315b, active ? 0.9 : 0.4);
        topBg.strokeRoundedRect(-subTabW / 2, -subTabH / 2, subTabW, subTabH, 6);
      };
      drawTopicTab(st.id === this.statsSubTab);

      const topText = this.add.text(0, -1, st.label, {
        fontSize: isMobile ? '9px' : '10px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const hit = this.add.rectangle(0, 0, subTabW, subTabH, 0x000000, 0);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        SoundFx.playCursor();
        this.switchStatsSubTab(st.id);
      });

      topContainer.add([topBg, topText, hit]);
      (topContainer as any).drawTab = drawTopicTab;
      (topContainer as any).tabId = st.id;
      this.statsSubTabButtons.push(topContainer);
      this.statsTabContainer.add(topContainer);
    });

    // Render Sub-Views
    this.renderStatsSubTabs(cardW, cardH, isMobile);
  }

  private renderStatsSubTabs(cardW: number, cardH: number, isMobile: boolean): void {
    this.statsContainers.forEach((container) => {
      container.destroy();
    });
    this.statsContainers.clear();

    const stats = StatsManager.getStats();

    const overview = this.createOverviewSubTab(stats, cardW, cardH, isMobile);
    const winrates = this.createWinRatesSubTab(stats, cardW, cardH, isMobile);
    const combos = this.createCombosSubTab(stats, cardW, cardH, isMobile);
    const inputs = this.createInputsSubTab(stats, cardW, cardH, isMobile);

    this.statsContainers.set('overview', overview);
    this.statsContainers.set('winrates', winrates);
    this.statsContainers.set('combos', combos);
    this.statsContainers.set('inputs', inputs);

    this.statsTabContainer.add([overview, winrates, combos, inputs]);

    this.switchStatsSubTab(this.statsSubTab);
  }

  private switchStatsSubTab(subTab: 'overview' | 'winrates' | 'combos' | 'inputs'): void {
    this.statsSubTab = subTab;
    this.statsSubTabButtons.forEach((btn) => {
      const active = (btn as any).tabId === subTab;
      (btn as any).drawTab(active);
    });
    this.statsContainers.forEach((container, key) => {
      container.setVisible(key === subTab);
    });
  }

  /** Sub-view 1: High Level Overview & Stacked Mode Distribution */
  private createOverviewSubTab(
    stats: GameStats,
    cardW: number,
    cardH: number,
    isMobile: boolean
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);

    // 1. Metric Badges (4 cards across)
    const badgeGap = 6;
    const badgeW = Math.floor((cardW - 32 - 3 * badgeGap) / 4);
    const badgeH = 34;
    const badgeY = -cardH / 2 + 52;
    const startBadgeX = -cardW / 2 + 16 + badgeW / 2;

    const badges = [
      { label: 'MATCHES', value: stats.totalMatches.toString(), color: 0x54a0ff, hex: '#54a0ff' },
      { label: 'PLAY TIME', value: this.formatPlayTime(stats.totalPlayTimeSeconds), color: 0xa55eea, hex: '#a55eea' },
      { label: 'MAX CHAIN', value: `x${stats.maxChain}`, color: 0xff9f43, hex: '#ff9f43' },
      { label: 'POPPED', value: stats.totalPanelsCleared.toLocaleString(), color: 0x2ed573, hex: '#2ed573' }
    ];

    badges.forEach((b, i) => {
      const bx = startBadgeX + i * (badgeW + badgeGap);
      const bg = this.add.graphics();
      bg.fillStyle(0x110d20, 0.9);
      bg.fillRoundedRect(bx - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 6);
      bg.lineStyle(1.5, b.color, 0.7);
      bg.strokeRoundedRect(bx - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 6);
      container.add(bg);

      const lbl = this.add.text(bx, badgeY - 8, b.label, {
        fontSize: isMobile ? '7.5px' : '8.5px',
        color: '#a4b0be',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const val = this.add.text(bx, badgeY + 7, b.value, {
        fontSize: isMobile ? '10.5px' : '11.5px',
        color: b.hex,
        fontStyle: 'bold'
      }).setOrigin(0.5);

      container.add([lbl, val]);
    });

    // 2. Mode Engagement Distribution (Stacked Horizontal Bar)
    const barY = -cardH / 2 + 96;
    const chartW = cardW - 32;
    const barH = 14;

    const modeTitle = this.add.text(0, barY - 14, 'MODE ENGAGEMENT DISTRIBUTION', {
      fontSize: isMobile ? '9.5px' : '10.5px',
      color: '#feca57',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(modeTitle);

    const barBg = this.add.graphics();
    barBg.fillStyle(0x221a36, 1);
    barBg.fillRoundedRect(-chartW / 2, barY - barH / 2, chartW, barH, 4);

    const modes = [
      { key: 'endless', label: 'Endless', count: stats.modeMatches.endless, color: 0x00d2d3, hex: '#00d2d3' },
      { key: 'challenge', label: 'Challenge', count: stats.modeMatches.challenge, color: 0xff9f43, hex: '#ff9f43' },
      { key: 'vs_cpu', label: 'VS CPU', count: stats.modeMatches.vs_cpu, color: 0xff4757, hex: '#ff4757' },
      { key: 'vs_online', label: 'Online', count: stats.modeMatches.vs_online, color: 0xfeca57, hex: '#feca57' },
      { key: 'attack', label: 'Attack', count: stats.modeMatches.time_attack + stats.modeMatches.score_attack, color: 0xa55eea, hex: '#a55eea' }
    ];

    const totalModeMatches = modes.reduce((acc, m) => acc + m.count, 0) || 1;
    let currX = -chartW / 2;

    modes.forEach((m) => {
      if (m.count > 0) {
        const segW = Math.max(2, Math.round((m.count / totalModeMatches) * chartW));
        barBg.fillStyle(m.color, 0.95);
        barBg.fillRect(currX, barY - barH / 2, segW, barH);
        currX += segW;
      }
    });

    barBg.lineStyle(1.5, 0x3d315b, 0.8);
    barBg.strokeRoundedRect(-chartW / 2, barY - barH / 2, chartW, barH, 4);
    container.add(barBg);

    // Legend below bar
    const legY = barY + 16;
    const legendParts = modes.map((m) => `${m.label}: ${this.formatPct(m.count, totalModeMatches)}`);
    const legText = this.add.text(0, legY, legendParts.join('  •  '), {
      fontSize: isMobile ? '8px' : '9px',
      color: '#d2dae2',
      align: 'center'
    }).setOrigin(0.5);
    container.add(legText);

    // 3. Lifetime Action Totals Box
    const boxY = barY + 38;
    const boxH = cardH / 2 - boxY - 10;
    const boxBg = this.add.graphics();
    boxBg.fillStyle(0x120c22, 0.9);
    boxBg.fillRoundedRect(-chartW / 2, boxY, chartW, boxH, 8);
    boxBg.lineStyle(1.5, 0x3d315b, 0.7);
    boxBg.strokeRoundedRect(-chartW / 2, boxY, chartW, boxH, 8);
    container.add(boxBg);

    const boxTitle = this.add.text(0, boxY + 12, '⚡ LIFETIME GAMEPLAY ACTIONS', {
      fontSize: isMobile ? '9px' : '10px',
      color: '#54a0ff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(boxTitle);

    const col1X = -chartW / 4;
    const col2X = chartW / 4;
    const row1Y = boxY + 31;
    const row2Y = boxY + 49;

    const tSwaps = this.add.text(col1X, row1Y, `🔄 Total Swaps: ${stats.totalSwaps.toLocaleString()}`, {
      fontSize: isMobile ? '8.5px' : '9.5px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const tLifts = this.add.text(col2X, row1Y, `⬆️ Fast Lifts: ${stats.totalFastLifts.toLocaleString()}`, {
      fontSize: isMobile ? '8.5px' : '9.5px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const tGarbage = this.add.text(col1X, row2Y, `💥 Garbage Shattered: ${stats.totalGarbageCleared.toLocaleString()}`, {
      fontSize: isMobile ? '8.5px' : '9.5px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const tFps = this.add.text(col2X, row2Y, `🚀 Frame Rate: ~${stats.avgFps || 60} FPS`, {
      fontSize: isMobile ? '8.5px' : '9.5px',
      color: '#2ed573',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    container.add([tSwaps, tLifts, tGarbage, tFps]);
    return container;
  }

  /** Sub-view 2: Difficulty Win/Loss Bar Chart & 1v1 Online Record */
  private createWinRatesSubTab(
    stats: GameStats,
    cardW: number,
    cardH: number,
    isMobile: boolean
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);

    const title = this.add.text(0, -cardH / 2 + 42, '⚔️ VS CPU DIFFICULTY WIN / LOSS RECORD', {
      fontSize: isMobile ? '10px' : '11px',
      color: '#2ed573',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(title);

    const diffs = [
      GameDifficulty.NOVICE,
      GameDifficulty.ADEPT,
      GameDifficulty.EXPERT,
      GameDifficulty.MASTER,
      GameDifficulty.GRANDMASTER
    ];

    const rowStartY = -cardH / 2 + 63;
    const rowStep = isMobile ? 18 : 20;
    const barW = cardW - (isMobile ? 190 : 210);
    const barH = 10;
    const barStartX = -cardW / 2 + (isMobile ? 85 : 95);

    diffs.forEach((diff, idx) => {
      const ry = rowStartY + idx * rowStep;
      const dInfo = getDifficultyInfo(diff);
      const diffStat = stats.vsCpu[diff] || { wins: 0, losses: 0 };
      const total = diffStat.wins + diffStat.losses;
      const winPct = total > 0 ? Math.round((diffStat.wins / total) * 100) : 0;

      // Difficulty Name
      const nameText = this.add.text(-cardW / 2 + 18, ry, dInfo.name, {
        fontSize: isMobile ? '9px' : '10px',
        color: dInfo.hexColor,
        fontStyle: 'bold'
      }).setOrigin(0, 0.5);

      // Horizontal Bar
      const bg = this.add.graphics();
      bg.fillStyle(0x221a36, 1);
      bg.fillRoundedRect(barStartX, ry - barH / 2, barW, barH, 3);

      if (total > 0) {
        const winW = Math.round((diffStat.wins / total) * barW);
        if (winW > 0) {
          bg.fillStyle(0x2ed573, 0.95);
          bg.fillRect(barStartX, ry - barH / 2, winW, barH);
        }
        if (barW - winW > 0) {
          bg.fillStyle(0xff4757, 0.95);
          bg.fillRect(barStartX + winW, ry - barH / 2, barW - winW, barH);
        }
      }

      bg.lineStyle(1, 0x3d315b, 0.7);
      bg.strokeRoundedRect(barStartX, ry - barH / 2, barW, barH, 3);

      // Numeric record on right
      const recLabel = total > 0 ? `${diffStat.wins}W - ${diffStat.losses}L (${winPct}%)` : '0W - 0L';
      const recText = this.add.text(cardW / 2 - 18, ry, recLabel, {
        fontSize: isMobile ? '8.5px' : '9.5px',
        color: total > 0 ? '#ffffff' : '#747d8c',
        fontStyle: 'bold'
      }).setOrigin(1, 0.5);

      container.add([nameText, bg, recText]);
    });

    // Online 1v1 Plaque Card at Bottom
    const plaqueY = rowStartY + 5 * rowStep + 10;
    const plaqueH = cardH / 2 - plaqueY - 10;
    const plaqueW = cardW - 32;

    const pBg = this.add.graphics();
    pBg.fillStyle(0x130e22, 0.95);
    pBg.fillRoundedRect(-plaqueW / 2, plaqueY, plaqueW, plaqueH, 8);
    pBg.lineStyle(1.5, 0xfeca57, 0.85);
    pBg.strokeRoundedRect(-plaqueW / 2, plaqueY, plaqueW, plaqueH, 8);
    container.add(pBg);

    const pTitle = this.add.text(0, plaqueY + 12, '🌐 ONLINE MULTIPLAYER 1v1 MATCHES', {
      fontSize: isMobile ? '9.5px' : '10.5px',
      color: '#feca57',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const onMatches = stats.vsOnline.matchesPlayed || (stats.vsOnline.wins + stats.vsOnline.losses);
    const onWins = stats.vsOnline.wins;
    const onLosses = stats.vsOnline.losses;
    const onWinPct = onMatches > 0 ? Math.round((onWins / onMatches) * 100) : 0;

    const pStats = this.add.text(0, plaqueY + 31, `${onMatches} Matches Played  •  ${onWins} Wins  •  ${onLosses} Losses`, {
      fontSize: isMobile ? '9px' : '10px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const badgeLabel = onMatches > 0 ? `🏆 ${onWinPct}% WIN RATE` : 'NO ONLINE MATCHES YET';
    const pBadge = this.add.text(0, plaqueY + 48, badgeLabel, {
      fontSize: isMobile ? '8.5px' : '9.5px',
      color: onMatches > 0 ? '#2ed573' : '#a4b0be',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    container.add([pTitle, pStats, pBadge]);
    return container;
  }

  /** Sub-view 3: Cascading Chains Vertical Column Chart & Combo Pop Breakdown */
  private createCombosSubTab(
    stats: GameStats,
    cardW: number,
    cardH: number,
    isMobile: boolean
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);

    // 1. Cascading Chains Vertical Column Chart
    const chartTitle = this.add.text(0, -cardH / 2 + 42, '⚡ CASCADING CHAINS (GRAVITY DROPS)', {
      fontSize: isMobile ? '10px' : '11px',
      color: '#ff9f43',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(chartTitle);

    const chainData = [
      { label: 'x2 Chain', count: stats.chains2, color: 0x00d2d3, hex: '#00d2d3' },
      { label: 'x3 Chain', count: stats.chains3, color: 0x2ed573, hex: '#2ed573' },
      { label: 'x4 Chain', count: stats.chains4, color: 0xff9f43, hex: '#ff9f43' },
      { label: 'x5+ Chain', count: stats.chains5Plus, color: 0xff69b4, hex: '#ff69b4' }
    ];

    const maxChainCount = Math.max(...chainData.map((c) => c.count), 1);
    const maxBarH = isMobile ? 38 : 44;
    const baseLineY = -cardH / 2 + 114;
    const chartWidth = cardW - 60;
    const stepX = chartWidth / 4;
    const startX = -chartWidth / 2 + stepX / 2;
    const colW = isMobile ? 24 : 32;

    const chartGraphics = this.add.graphics();
    chartGraphics.lineStyle(1.5, 0x3d315b, 0.7);
    chartGraphics.lineBetween(-chartWidth / 2 - 10, baseLineY, chartWidth / 2 + 10, baseLineY);

    chainData.forEach((cd, idx) => {
      const colX = startX + idx * stepX;
      const colH = Math.max(3, Math.round((cd.count / maxChainCount) * maxBarH));
      const colTopY = baseLineY - colH;

      chartGraphics.fillStyle(cd.color, 0.95);
      chartGraphics.fillRoundedRect(colX - colW / 2, colTopY, colW, colH, 3);
      chartGraphics.lineStyle(1, 0xffffff, 0.4);
      chartGraphics.strokeRoundedRect(colX - colW / 2, colTopY, colW, colH, 3);

      const valText = this.add.text(colX, colTopY - 7, `${cd.count}`, {
        fontSize: isMobile ? '8px' : '9px',
        color: cd.hex,
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const lblText = this.add.text(colX, baseLineY + 9, cd.label, {
        fontSize: isMobile ? '8px' : '9px',
        color: '#d2dae2'
      }).setOrigin(0.5);

      container.add([valText, lblText]);
    });
    container.add(chartGraphics);

    // 2. Combo Pops Distribution Horizontal Bars
    const comboTitle = this.add.text(0, baseLineY + 28, '💥 SIMULTANEOUS COMBO POPS', {
      fontSize: isMobile ? '9.5px' : '10.5px',
      color: '#ff69b4',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(comboTitle);

    const comboData = [
      { label: '4-Panel Pops', count: stats.combos4, color: 0x54a0ff },
      { label: '5-Panel Pops', count: stats.combos5, color: 0x2ed573 },
      { label: '6+ Panel Pops', count: stats.combos6Plus, color: 0xa55eea }
    ];

    const maxComboCount = Math.max(...comboData.map((c) => c.count), 1);
    const cStartY = baseLineY + 44;
    const cStepY = isMobile ? 18 : 20;
    const cBarW = cardW - (isMobile ? 170 : 190);
    const cBarH = 10;
    const cBarStartX = -cardW / 2 + (isMobile ? 90 : 100);

    comboData.forEach((cd, i) => {
      const cy = cStartY + i * cStepY;

      const lbl = this.add.text(-cardW / 2 + 18, cy, cd.label, {
        fontSize: isMobile ? '8.5px' : '9.5px',
        color: '#ffffff'
      }).setOrigin(0, 0.5);

      const bg = this.add.graphics();
      bg.fillStyle(0x221a36, 1);
      bg.fillRoundedRect(cBarStartX, cy - cBarH / 2, cBarW, cBarH, 3);

      const fillW = Math.max(3, Math.round((cd.count / maxComboCount) * cBarW));
      bg.fillStyle(cd.color, 0.95);
      bg.fillRect(cBarStartX, cy - cBarH / 2, fillW, cBarH);

      bg.lineStyle(1, 0x3d315b, 0.7);
      bg.strokeRoundedRect(cBarStartX, cy - cBarH / 2, cBarW, cBarH, 3);

      const num = this.add.text(cardW / 2 - 18, cy, `${cd.count}`, {
        fontSize: isMobile ? '8.5px' : '9.5px',
        color: '#feca57',
        fontStyle: 'bold'
      }).setOrigin(1, 0.5);

      container.add([lbl, bg, num]);
    });

    return container;
  }

  /** Sub-view 4: Input Device Usage, Top Mascots & Engine Telemetry */
  private createInputsSubTab(
    stats: GameStats,
    cardW: number,
    cardH: number,
    isMobile: boolean
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);

    // 1. Input Device Distribution
    const title = this.add.text(0, -cardH / 2 + 42, '🎮 INPUT DEVICE ENGAGEMENT', {
      fontSize: isMobile ? '10px' : '11px',
      color: '#a55eea',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(title);

    const inputData = [
      { label: 'Keyboard', count: stats.inputUsage.keyboard, color: 0x54a0ff },
      { label: 'Touch/Mouse', count: stats.inputUsage.touch, color: 0x2ed573 },
      { label: 'Gamepad', count: stats.inputUsage.gamepad, color: 0xff9f43 }
    ];

    const totalInputs = inputData.reduce((acc, d) => acc + d.count, 0) || 1;
    const barW = cardW - 32;
    const barH = 14;
    const barY = -cardH / 2 + 62;

    const iBarBg = this.add.graphics();
    iBarBg.fillStyle(0x221a36, 1);
    iBarBg.fillRoundedRect(-barW / 2, barY - barH / 2, barW, barH, 4);

    let currX = -barW / 2;
    inputData.forEach((d) => {
      if (d.count > 0) {
        const segW = Math.max(2, Math.round((d.count / totalInputs) * barW));
        iBarBg.fillStyle(d.color, 0.95);
        iBarBg.fillRect(currX, barY - barH / 2, segW, barH);
        currX += segW;
      }
    });

    iBarBg.lineStyle(1.5, 0x3d315b, 0.8);
    iBarBg.strokeRoundedRect(-barW / 2, barY - barH / 2, barW, barH, 4);
    container.add(iBarBg);

    const legendY = barY + 16;
    const legendParts = [
      `⌨️ Keys: ${this.formatPct(stats.inputUsage.keyboard, totalInputs)}`,
      `📱 Touch: ${this.formatPct(stats.inputUsage.touch, totalInputs)}`,
      `🎮 Gamepad: ${this.formatPct(stats.inputUsage.gamepad, totalInputs)}`
    ];
    const legText = this.add.text(0, legendY, legendParts.join('   •   '), {
      fontSize: isMobile ? '8.5px' : '9.5px',
      color: '#d2dae2'
    }).setOrigin(0.5);
    container.add(legText);

    // 2. Favorite Characters / Mascots
    const mascotTitle = this.add.text(0, legendY + 22, '🦊 TOP CHARACTER PICKS', {
      fontSize: isMobile ? '9.5px' : '10.5px',
      color: '#feca57',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(mascotTitle);

    const sortedPicks = Object.entries(stats.characterPicks || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const cardGap = 6;
    const cWidth = Math.floor((cardW - 32 - 3 * cardGap) / 4);
    const cHeight = 32;
    const cTopY = legendY + 44;
    const cStartX = -cardW / 2 + 16 + cWidth / 2;

    sortedPicks.forEach(([charId, count], i) => {
      const cx = cStartX + i * (cWidth + cardGap);
      const charObj = CHARACTERS.find((c) => c.id === charId);
      const name = charObj?.name || charId.toUpperCase();

      const bg = this.add.graphics();
      bg.fillStyle(0x130e22, 0.9);
      bg.fillRoundedRect(cx - cWidth / 2, cTopY - cHeight / 2, cWidth, cHeight, 6);
      bg.lineStyle(1, 0x54a0ff, 0.5);
      bg.strokeRoundedRect(cx - cWidth / 2, cTopY - cHeight / 2, cWidth, cHeight, 6);

      const nText = this.add.text(cx, cTopY - 6, name, {
        fontSize: isMobile ? '8.5px' : '9.5px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const pText = this.add.text(cx, cTopY + 7, `${count} games`, {
        fontSize: isMobile ? '7.5px' : '8.5px',
        color: '#feca57'
      }).setOrigin(0.5);

      container.add([bg, nText, pText]);
    });

    // 3. System & Engine Telemetry Plaque
    const infoY = cardH / 2 - 22;
    const infoBoxW = cardW - 32;
    const infoBoxH = 28;

    const infoBg = this.add.graphics();
    infoBg.fillStyle(0x130e22, 0.9);
    infoBg.fillRoundedRect(-infoBoxW / 2, infoY - infoBoxH / 2, infoBoxW, infoBoxH, 6);
    infoBg.lineStyle(1, 0x3d315b, 0.7);
    infoBg.strokeRoundedRect(-infoBoxW / 2, infoY - infoBoxH / 2, infoBoxW, infoBoxH, 6);
    container.add(infoBg);

    const infoText = this.add.text(0, infoY, '🔒 Telemetry auto-synced to persistent local storage  •  Target: 60 FPS', {
      fontSize: isMobile ? '8px' : '9px',
      color: '#a4b0be',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(infoText);

    return container;
  }

  private formatPlayTime(seconds: number): string {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }

  private formatPct(num: number, total: number): string {
    if (total <= 0) return '0%';
    return `${Math.round((num / total) * 100)}%`;
  }

  // =========================================================================
  // TAB 4: ABOUT (HOW TO PLAY GUIDE & AI TRANSPARENCY DISCLOSURE)
  // =========================================================================

  private createAboutTab(
    x: number,
    y: number,
    cardW: number,
    cardH: number,
    isMobile: boolean
  ): void {
    this.aboutTabContainer = this.add.container(x, y);

    // Card frame
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    cardBg.lineStyle(2, 0xa55eea, 0.85);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    this.aboutTabContainer.add(cardBg);

    this.aboutSubTabButtons = [];

    // 2 Top Sub-Tabs: Guide vs AI Disclosure
    const aboutSections: { id: 'guide' | 'ai'; label: string; color: number }[] = [
      { id: 'guide', label: '📖 HOW TO PLAY / GUIDE', color: 0x2ed573 },
      { id: 'ai', label: '🤖 AI DISCLOSURE & CREDITS', color: 0xa55eea }
    ];

    const subTabSpacing = 8;
    const subTabW = Math.floor((cardW - 32 - subTabSpacing) / 2);
    const subTabH = 26;
    const subStartX = -cardW / 2 + 16 + subTabW / 2;
    const subY = -cardH / 2 + 22;

    aboutSections.forEach((sec, idx) => {
      const btnX = subStartX + idx * (subTabW + subTabSpacing);
      const btnContainer = this.add.container(btnX, subY);
      const btnBg = this.add.graphics();

      const drawSubTab = (active: boolean) => {
        btnBg.clear();
        btnBg.fillStyle(active ? sec.color : 0x110d20, active ? 0.95 : 0.75);
        btnBg.fillRoundedRect(-subTabW / 2, -subTabH / 2, subTabW, subTabH, 6);
        btnBg.lineStyle(1.5, active ? 0xffffff : 0x3d315b, active ? 0.9 : 0.4);
        btnBg.strokeRoundedRect(-subTabW / 2, -subTabH / 2, subTabW, subTabH, 6);
      };
      drawSubTab(sec.id === this.aboutSubTab);

      const btnText = this.add.text(0, -1, sec.label, {
        fontSize: isMobile ? '9.5px' : '10.5px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const hit = this.add.rectangle(0, 0, subTabW, subTabH, 0x000000, 0);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        SoundFx.playCursor();
        this.switchAboutSubTab(sec.id);
      });

      btnContainer.add([btnBg, btnText, hit]);
      (btnContainer as any).drawTab = drawSubTab;
      (btnContainer as any).subId = sec.id;
      this.aboutSubTabButtons.push(btnContainer);
      this.aboutTabContainer.add(btnContainer);
    });

    // 1. Build How To Play Guide Sub-Container
    this.createGuideSubSection(cardW, cardH, isMobile);

    // 2. Build AI Disclosure Sub-Container
    this.createAIDisclosureSubSection(cardW, cardH, isMobile);

    this.switchAboutSubTab(this.aboutSubTab);
  }

  private switchAboutSubTab(subTab: 'guide' | 'ai'): void {
    this.aboutSubTab = subTab;
    this.aboutSubTabButtons.forEach((btn) => {
      const active = (btn as any).subId === subTab;
      (btn as any).drawTab(active);
    });

    this.guideMainContainer?.setVisible(subTab === 'guide');
    this.aiMainContainer?.setVisible(subTab === 'ai');
  }

  private createGuideSubSection(cardW: number, cardH: number, isMobile: boolean): void {
    this.guideMainContainer = this.add.container(0, 0);
    this.guideContainers.clear();
    this.guideCategoryButtons = [];

    // 3 Category Pills (Basics, Chains, Strategy)
    const topics: { id: 'basics' | 'chains' | 'strategy'; label: string; color: number }[] = [
      { id: 'basics', label: '🎯 BASICS', color: 0x2ed573 },
      { id: 'chains', label: '💥 CHAINS', color: 0xff69b4 },
      { id: 'strategy', label: '🏆 PRO TIPS', color: 0xfeca57 }
    ];

    const catSpacing = 6;
    const catW = Math.floor((cardW - 32 - (topics.length - 1) * catSpacing) / topics.length);
    const catH = 22;
    const catStartX = -cardW / 2 + 16 + catW / 2;
    const catY = -cardH / 2 + 50;

    topics.forEach((top, idx) => {
      const topX = catStartX + idx * (catW + catSpacing);
      const topContainer = this.add.container(topX, catY);
      const topBg = this.add.graphics();

      const drawTopicTab = (active: boolean) => {
        topBg.clear();
        topBg.fillStyle(active ? top.color : 0x110d20, active ? 0.95 : 0.75);
        topBg.fillRoundedRect(-catW / 2, -catH / 2, catW, catH, 5);
        topBg.lineStyle(1.5, active ? 0xffffff : 0x54a0ff, active ? 0.9 : 0.4);
        topBg.strokeRoundedRect(-catW / 2, -catH / 2, catW, catH, 5);
      };
      drawTopicTab(top.id === this.guideCategory);

      const topText = this.add.text(0, -1, top.label, {
        fontSize: isMobile ? '9px' : '9.5px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const hit = this.add.rectangle(0, 0, catW, catH, 0x000000, 0);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        SoundFx.playCursor();
        this.switchGuideCategory(top.id);
      });

      topContainer.add([topBg, topText, hit]);
      (topContainer as any).drawTab = drawTopicTab;
      (topContainer as any).catId = top.id;
      this.guideCategoryButtons.push(topContainer);
      this.guideMainContainer!.add(topContainer);
    });

    // Content definitions for each topic
    const guideData: Record<'basics' | 'chains' | 'strategy', { title: string; desc: string; iconColor: string }[]> = {
      basics: [
        {
          title: '🎯 PANEL SWAPPING & MATCHING',
          desc: 'Swap two horizontal slimes with Space / Button A / Drag. Align 3+ matching colors horizontally or vertically to pop them!',
          iconColor: '#2ed573'
        },
        {
          title: '⬆️ RISING STACK & FAST LIFT',
          desc: 'The stack continuously ascends. Hold Shift / Button B / Flick Up on the board to raise new rows instantly when you need slimes.',
          iconColor: '#00d2d3'
        },
        {
          title: '⏱️ STOP TIME & DANGER GRACE',
          desc: 'Matching animations freeze stack rise! When slimes reach the ceiling, Danger Grace countdown activates (12s down to 3.5s by difficulty). Any match pauses danger!',
          iconColor: '#ff9ff3'
        }
      ],
      chains: [
        {
          title: '🌟 COMBOS (4+ SLIMES)',
          desc: 'Clear 4, 5, or 6 slimes in a single swap to launch solid combo garbage slabs directly onto your opponent\'s grid!',
          iconColor: '#ff9f43'
        },
        {
          title: '⚡ CASCADING CHAINS (x2, x3...)',
          desc: 'Panels falling into new matches trigger CHAINS! Chains multiply score, freeze your stack, and drop massive full-board garbage!',
          iconColor: '#ff6b6b'
        },
        {
          title: '💥 SHATTERING GARBAGE',
          desc: 'Make any match touching a garbage block. The garbage flashes and shatters, transforming into normal matching slimes to clear your board!',
          iconColor: '#54a0ff'
        }
      ],
      strategy: [
        {
          title: '⭐ 5-STEP DIFFICULTY LADDER',
          desc: 'Novice (5 colors, slow), Adept (standard), Expert (6 colors, fast), Master (handicap slab), or Grandmaster (0% bot error, 3.5s grace, 2 slabs)!',
          iconColor: '#feca57'
        },
        {
          title: '📡 RADAR & THREAT BUFFER',
          desc: 'In VS mode, watch the opponent radar mini-grid! The flashing threat bar reveals pending garbage drop timers so you can prepare counters.',
          iconColor: '#54a0ff'
        },
        {
          title: '🦅 MID-AIR SWAPPING',
          desc: 'You can swap slimes mid-air as they fall! Use mid-air swaps to catch cascading drops before they land for clutch last-second saves.',
          iconColor: '#1dd1a1'
        }
      ]
    };

    const contentX = -cardW / 2 + (isMobile ? 14 : 20);
    const wrapW = cardW - (isMobile ? 28 : 40);

    (['basics', 'chains', 'strategy'] as const).forEach((catKey) => {
      const topicContainer = this.add.container(0, 0);
      let itemY = -cardH / 2 + 70;

      guideData[catKey].forEach((item) => {
        const heading = this.add.text(contentX, itemY, item.title, {
          fontSize: isMobile ? '10px' : '10.5px',
          color: item.iconColor,
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2
        });

        const body = this.add.text(contentX, itemY + (isMobile ? 13 : 15), item.desc, {
          fontSize: isMobile ? '8.5px' : '9px',
          color: '#d2dae2',
          lineSpacing: isMobile ? 1.5 : 2,
          wordWrap: { width: wrapW }
        });

        topicContainer.add([heading, body]);
        itemY += body.height + (isMobile ? 10 : 12);
      });

      this.guideContainers.set(catKey, topicContainer);
      this.guideMainContainer!.add(topicContainer);
    });

    this.aboutTabContainer.add(this.guideMainContainer);
    this.switchGuideCategory('basics');
  }

  private switchGuideCategory(cat: 'basics' | 'chains' | 'strategy'): void {
    this.guideCategory = cat;
    this.guideCategoryButtons.forEach((btn) => {
      const active = (btn as any).catId === cat;
      (btn as any).drawTab(active);
    });
    this.guideContainers.forEach((container, key) => {
      container.setVisible(key === cat);
    });
  }

  private createAIDisclosureSubSection(cardW: number, cardH: number, isMobile: boolean): void {
    this.aiMainContainer = this.add.container(0, 0);

    const title = this.add.text(0, -cardH / 2 + 54, '🤖 AI TRANSPARENCY & CODE ARCHITECTURE', {
      fontSize: isMobile ? '11px' : '12.5px',
      color: '#a55eea',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2.5
    }).setOrigin(0.5);

    const statements = [
      '• Character Concept Art & Chibi Portraits:\nGenerated and styled with the assistance of Google DeepMind AI models.',
      '• Music Themes & Procedural Synthesizers:\nComposed and synthesized with generative AI assistance for authentic retro arcade vibes.',
      '• Code & Game Engine:\nFull physics simulation, panel matching algorithms, WebSocket multiplayer networking, and universal controls engineered with AI pair-programming in TypeScript & Phaser 3.',
      'Built with passion and dedication to classic action puzzle gaming!'
    ];

    const contentX = -cardW / 2 + (isMobile ? 14 : 20);
    const wrapW = cardW - (isMobile ? 28 : 40);
    let currentY = -cardH / 2 + 74;

    statements.forEach((txt, idx) => {
      const isLast = idx === statements.length - 1;
      const t = this.add.text(isLast ? 0 : contentX, currentY, txt, {
        fontSize: isLast ? (isMobile ? '9.5px' : '10.5px') : (isMobile ? '8.5px' : '9.5px'),
        color: isLast ? '#feca57' : '#d2dae2',
        fontStyle: isLast ? 'italic bold' : 'normal',
        align: isLast ? 'center' : 'left',
        lineSpacing: isMobile ? 1.5 : 2.5,
        wordWrap: { width: wrapW }
      });
      if (isLast) t.setOrigin(0.5, 0);

      this.aiMainContainer!.add(t);
      currentY += t.height + (isMobile ? 7 : 9);
    });

    this.aiMainContainer.add(title);
    this.aboutTabContainer.add(this.aiMainContainer);
  }

  // =========================================================================
  // CONTROLS CONFIGURATION MODAL (ACCESSIBLE FROM GAMEPLAY)
  // =========================================================================

  private createControlsModalUI(
    centerX: number,
    centerY: number,
    cardW: number,
    cardH: number,
    isMobile: boolean,
    useSubTabs: boolean = false
  ): void {
    this.controlsModalContainer = this.add.container(centerX, centerY);
    this.controlsModalContainer.setDepth(70);
    this.controlsModalContainer.setVisible(false);
    this.keyRemapButtons.clear();

    const backdrop = this.add.rectangle(0, 0, this.cameras.main.width * 2, this.cameras.main.height * 2, 0x000000, 0.7);
    backdrop.setInteractive(); // Blocks input to background elements

    const modalBox = this.add.graphics();
    modalBox.fillStyle(0x181028, 0.98);
    modalBox.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    modalBox.lineStyle(2, 0x54a0ff, 0.95);
    modalBox.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);

    // Title
    const title = this.add.text(0, -cardH / 2 + 16, '🎮 CONTROLS & KEY REMAPPING', {
      fontSize: isMobile ? '11px' : '13px',
      color: '#54a0ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Gamepad live status indicator at top
    this.gamepadStatusText = this.add.text(0, -cardH / 2 + 34, '🎮 GAMEPAD: Checking...', {
      fontSize: isMobile ? '9.5px' : '10.5px',
      color: '#feca57',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const actions: { key: keyof KeyBindings; label: string }[] = [
      { key: 'moveLeft', label: 'MOVE LEFT' },
      { key: 'moveRight', label: 'MOVE RIGHT' },
      { key: 'moveUp', label: 'MOVE UP' },
      { key: 'moveDown', label: 'MOVE DOWN' },
      { key: 'swap', label: 'SWAP SLIMES' },
      { key: 'lift', label: 'FAST LIFT' },
      { key: 'pause', label: 'PAUSE GAME' }
    ];

    if (!useSubTabs && cardW >= 420) {
      // DESKTOP: Two-column layout
      const startRowY = -82;
      const rowHeight = 24;

      actions.forEach((act, idx) => {
        const rowY = startRowY + idx * rowHeight;

        const actText = this.add.text(-205, rowY, act.label, {
          fontSize: '11.5px',
          color: '#d2dae2',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 1.5
        }).setOrigin(0, 0.5);

        // Key binding button (click to remap)
        const btnContainer = this.add.container(-40, rowY);
        const btnBg = this.add.graphics();
        const drawBtn = (isListening: boolean) => {
          btnBg.clear();
          btnBg.fillStyle(isListening ? 0xffbe1a : 0x221a38, 0.95);
          btnBg.fillRoundedRect(-50, -10, 100, 20, 5);
          btnBg.lineStyle(1.5, isListening ? 0xffffff : 0x54a0ff, 0.9);
          btnBg.strokeRoundedRect(-50, -10, 100, 20, 5);
        };
        drawBtn(false);

        const keyLabel = this.add.text(0, -1, this.formatKeyName(Settings.keyBindings[act.key]), {
          fontSize: '11px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(0.5);

        const hit = this.add.rectangle(0, 0, 100, 20, 0x000000, 0);
        hit.setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => {
          SoundFx.playCursor();
          this.startListeningForKey(act.key);
        });

        btnContainer.add([btnBg, keyLabel, hit]);
        (btnContainer as any).drawBtn = drawBtn;

        this.keyRemapButtons.set(act.key, { container: btnContainer, label: keyLabel });
        this.controlsModalContainer!.add([actText, btnContainer]);
      });

      // Right Column: Gamepad & Touch Guide Reference
      const guideBox = this.add.graphics();
      guideBox.fillStyle(0x0e091b, 0.7);
      guideBox.fillRoundedRect(30, -86, 185, 170, 8);
      guideBox.lineStyle(1, 0xffffff, 0.15);
      guideBox.strokeRoundedRect(30, -86, 185, 170, 8);
      this.controlsModalContainer.add(guideBox);

      const guideTitle = this.add.text(122, -74, '🎮 GAMEPAD MAP', {
        fontSize: '11.5px',
        color: '#2ed573',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 1.5
      }).setOrigin(0.5);

      const padLines = [
        '• D-Pad / Stick: Move',
        '• Button A / X: Swap',
        '• Button B / Y / L1: Lift',
        '• Start / Select: Pause',
        '',
        '📱 TOUCH CONTROLS:',
        '• Tap & swipe on board',
        '• Virtual D-pad + Pills'
      ];

      const guideText = this.add.text(38, -58, padLines.join('\n'), {
        fontSize: '10px',
        color: '#d2dae2',
        lineSpacing: 2
      });

      this.controlsModalContainer.add([guideTitle, guideText]);
    } else {
      // MOBILE: Sub-tabs (Keys remap vs Gamepad guide)
      this.createMobileControlsSubTabs(cardW, cardH, actions);
    }

    // Bottom Action Row: Reset Defaults & Close Done Button
    const resetBtn = CuteUI.createPillButton(this, -70, cardH / 2 - 20, 'RESET KEYS', () => {
      Settings.resetKeyBindings();
      this.updateKeyRemapLabels();
      SoundFx.playMatch();
    }, { textureKey: 'pill_purple', fontSize: '11px', width: 110, height: 26, autoScale: false });

    const doneBtn = CuteUI.createPillButton(this, 70, cardH / 2 - 20, 'DONE ✔', () => {
      this.closeControlsModal();
    }, { textureKey: 'pill_green', fontSize: '11px', width: 110, height: 26, autoScale: false });

    this.controlsModalContainer.add([backdrop, modalBox, title, this.gamepadStatusText, resetBtn, doneBtn]);
  }

  private createMobileControlsSubTabs(
    cardW: number,
    cardH: number,
    actions: { key: keyof KeyBindings; label: string }[]
  ): void {
    const subTabY = -cardH / 2 + 50;
    const subW = Math.min(130, Math.floor((cardW - 32) / 2));
    const subH = 22;

    this.mobileControlsSubTabButtons = [];

    const drawSubTabPill = (btn: Phaser.GameObjects.Container, active: boolean, label: string) => {
      const g = btn.list[0] as Phaser.GameObjects.Graphics;
      g.clear();
      g.fillStyle(active ? 0x54a0ff : 0x110d20, active ? 0.95 : 0.7);
      g.fillRoundedRect(-subW / 2, -subH / 2, subW, subH, 5);
      g.lineStyle(1.5, active ? 0xffffff : 0x3d315b, active ? 0.9 : 0.5);
      g.strokeRoundedRect(-subW / 2, -subH / 2, subW, subH, 5);
    };

    const keysBtn = this.add.container(-subW / 2 - 4, subTabY);
    const keysBg = this.add.graphics();
    const keysText = this.add.text(0, -1, '⌨️ KEYBOARD', { fontSize: '9.5px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    const keysHit = this.add.rectangle(0, 0, subW, subH, 0x000000, 0).setInteractive({ useHandCursor: true });
    keysBtn.add([keysBg, keysText, keysHit]);
    (keysBtn as any).tabKey = 'keys';
    keysHit.on('pointerdown', () => {
      SoundFx.playCursor();
      this.switchMobileControlsSubTab('keys');
    });

    const padBtn = this.add.container(subW / 2 + 4, subTabY);
    const padBg = this.add.graphics();
    const padText = this.add.text(0, -1, '🎮 GAMEPAD', { fontSize: '9.5px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    const padHit = this.add.rectangle(0, 0, subW, subH, 0x000000, 0).setInteractive({ useHandCursor: true });
    padBtn.add([padBg, padText, padHit]);
    (padBtn as any).tabKey = 'gamepad';
    padHit.on('pointerdown', () => {
      SoundFx.playCursor();
      this.switchMobileControlsSubTab('gamepad');
    });

    this.mobileControlsSubTabButtons = [keysBtn, padBtn];
    this.controlsModalContainer!.add([keysBtn, padBtn]);

    // Sub-view A: Mobile Keys Remap List
    this.mobileKeysContainer = this.add.container(0, 0);
    const startRowY = -cardH / 2 + 70;
    const rowHeight = 21;

    actions.forEach((act, idx) => {
      const rowY = startRowY + idx * rowHeight;
      const actText = this.add.text(-cardW / 2 + 18, rowY, act.label, {
        fontSize: '10px',
        color: '#d2dae2',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5);

      const btnContainer = this.add.container(cardW / 2 - 58, rowY);
      const btnBg = this.add.graphics();
      const drawBtn = (isListening: boolean) => {
        btnBg.clear();
        btnBg.fillStyle(isListening ? 0xffbe1a : 0x221a38, 0.95);
        btnBg.fillRoundedRect(-42, -9, 84, 18, 4);
        btnBg.lineStyle(1.5, isListening ? 0xffffff : 0x54a0ff, 0.9);
        btnBg.strokeRoundedRect(-42, -9, 84, 18, 4);
      };
      drawBtn(false);

      const keyLabel = this.add.text(0, -1, this.formatKeyName(Settings.keyBindings[act.key]), {
        fontSize: '9.5px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const hit = this.add.rectangle(0, 0, 84, 18, 0x000000, 0);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        SoundFx.playCursor();
        this.startListeningForKey(act.key);
      });

      btnContainer.add([btnBg, keyLabel, hit]);
      (btnContainer as any).drawBtn = drawBtn;

      this.keyRemapButtons.set(act.key, { container: btnContainer, label: keyLabel });
      this.mobileKeysContainer!.add([actText, btnContainer]);
    });

    // Sub-view B: Mobile Gamepad & Touch Reference
    this.mobileGamepadContainer = this.add.container(0, 0);
    const padLines = [
      '🎮 GAMEPAD BUTTONS:',
      '• D-Pad / Analog Stick: Move Cursor',
      '• Button A / Cross: Swap Slimes',
      '• Button B / Circle / L1: Fast Lift Stack',
      '• Start / Select / Esc: Pause Game',
      '',
      '📱 ON-SCREEN TOUCH CONTROLS:',
      '• Tap & drag on matching grid',
      '• Virtual D-pad + action pill buttons'
    ];

    const guideText = this.add.text(0, -cardH / 2 + 76, padLines.join('\n'), {
      fontSize: '9.5px',
      color: '#d2dae2',
      align: 'center',
      lineSpacing: 3
    }).setOrigin(0.5, 0);
    this.mobileGamepadContainer.add(guideText);

    this.controlsModalContainer!.add([this.mobileKeysContainer, this.mobileGamepadContainer]);
    this.switchMobileControlsSubTab('keys');
  }

  private switchMobileControlsSubTab(subTab: 'keys' | 'gamepad'): void {
    this.mobileControlsSubTab = subTab;
    this.mobileControlsSubTabButtons.forEach((btn) => {
      const active = (btn as any).tabKey === subTab;
      const g = btn.list[0] as Phaser.GameObjects.Graphics;
      const subW = (btn.list[2] as Phaser.GameObjects.Rectangle).width;
      const subH = (btn.list[2] as Phaser.GameObjects.Rectangle).height;
      g.clear();
      g.fillStyle(active ? 0x54a0ff : 0x110d20, active ? 0.95 : 0.7);
      g.fillRoundedRect(-subW / 2, -subH / 2, subW, subH, 5);
      g.lineStyle(1.5, active ? 0xffffff : 0x3d315b, active ? 0.9 : 0.5);
      g.strokeRoundedRect(-subW / 2, -subH / 2, subW, subH, 5);
    });

    this.mobileKeysContainer?.setVisible(subTab === 'keys');
    this.mobileGamepadContainer?.setVisible(subTab === 'gamepad');
  }

  private openControlsModal(): void {
    SoundFx.playDecide();
    this.updateGamepadStatus();
    this.controlsModalContainer?.setVisible(true);
  }

  private closeControlsModal(): void {
    SoundFx.playCancel();
    if (this.listeningAction) {
      const btnData = this.keyRemapButtons.get(this.listeningAction);
      if (btnData) (btnData.container as any).drawBtn(false);
      this.listeningAction = null;
      this.updateKeyRemapLabels();
    }
    this.controlsModalContainer?.setVisible(false);
  }

  private startListeningForKey(action: keyof KeyBindings): void {
    if (this.listeningAction) {
      const prev = this.keyRemapButtons.get(this.listeningAction);
      if (prev) {
        (prev.container as any).drawBtn(false);
        prev.label.setText(this.formatKeyName(Settings.keyBindings[this.listeningAction]));
      }
    }

    this.listeningAction = action;
    const current = this.keyRemapButtons.get(action);
    if (current) {
      (current.container as any).drawBtn(true);
      current.label.setText('PRESS KEY...');
    }
  }

  private formatKeyName(key: string): string {
    if (key === 'UP') return '↑ (UP)';
    if (key === 'DOWN') return '↓ (DOWN)';
    if (key === 'LEFT') return '← (LEFT)';
    if (key === 'RIGHT') return '→ (RIGHT)';
    return key;
  }

  private updateKeyRemapLabels(): void {
    for (const [action, btnData] of this.keyRemapButtons.entries()) {
      if (this.listeningAction !== action) {
        btnData.label.setText(this.formatKeyName(Settings.keyBindings[action]));
        (btnData.container as any).drawBtn(false);
      }
    }
  }

  private updateGamepadStatus(): void {
    if (!this.gamepadStatusText) return;
    const pads = this.input.gamepad?.gamepads || [];
    let connectedPad = pads.find((p) => p && p.connected);
    let navPadName = '';

    if (!connectedPad && typeof navigator !== 'undefined' && navigator.getGamepads) {
      const rawPads = navigator.getGamepads();
      for (let i = 0; i < rawPads.length; i++) {
        if (rawPads[i] && rawPads[i]?.connected) {
          navPadName = rawPads[i]?.id || 'Controller';
          break;
        }
      }
    }

    if (connectedPad || navPadName) {
      const rawName = connectedPad?.id || navPadName || 'Standard Gamepad';
      const name = rawName.substring(0, 28);
      this.gamepadStatusText.setText(`🟢 GAMEPAD: ${name} (Ready)`);
      this.gamepadStatusText.setColor('#2ed573');
    } else {
      this.gamepadStatusText.setText('🎮 GAMEPAD: None detected (supports Xbox/PlayStation/USB)');
      this.gamepadStatusText.setColor('#feca57');
    }
  }

  // =========================================================================
  // AUDIO & DIFFICULTY HELPERS
  // =========================================================================

  private updateAudioDisplays(): void {
    const drawVolumeBar = (
      g: Phaser.GameObjects.Graphics,
      centerY: number,
      vol: number,
      color: number
    ) => {
      g.clear();
      const barWidth = this.barWidth;
      const barHeight = 14;
      const startX = -barWidth / 2;

      g.fillStyle(0x0c0818, 0.9);
      g.fillRoundedRect(startX, centerY - barHeight / 2, barWidth, barHeight, 7);
      g.lineStyle(1.5, 0xffffff, 0.35);
      g.strokeRoundedRect(startX, centerY - barHeight / 2, barWidth, barHeight, 7);

      const fillW = Math.max(0, barWidth * vol);
      if (fillW > 0) {
        g.fillStyle(color, 0.95);
        g.fillRoundedRect(startX + 1, centerY - barHeight / 2 + 1, fillW - 2, barHeight - 2, 6);
      }
    };

    drawVolumeBar(this.musicBarGraphics, -56, Settings.musicVolume, 0xfeca57);
    this.musicVolumeText.setText(`${Math.round(Settings.musicVolume * 100)}%`);

    drawVolumeBar(this.sfxBarGraphics, 22, Settings.sfxVolume, 0xff69b4);
    this.sfxVolumeText.setText(`${Math.round(Settings.sfxVolume * 100)}%`);
  }

  private cycleDifficulty(delta: number): void {
    const currentIndex = DIFFICULTY_ORDER.indexOf(Settings.difficulty);
    const newIndex = (currentIndex + delta + DIFFICULTY_ORDER.length) % DIFFICULTY_ORDER.length;
    Settings.setDifficulty(DIFFICULTY_ORDER[newIndex]);
    SoundFx.playCursor();
    this.updateDifficultyDisplay();
  }

  private updateDifficultyDisplay(): void {
    const info = getDifficultyInfo(Settings.difficulty);
    if (this.diffCenterText) {
      this.diffCenterText.setText(info.badge);
    }
    if (this.diffDescText) {
      this.diffDescText.setText(info.description);
      this.diffDescText.setColor(info.hexColor);
    }
  }

  private createStepButton(x: number, y: number, label: string, callback: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x2ed573, 0.95);
    bg.fillCircle(0, 0, 16);
    bg.lineStyle(1.8, 0xffffff, 0.9);
    bg.strokeCircle(0, 0, 16);

    const text = this.add.text(0, -1, label, {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const hit = this.add.circle(0, 0, 20, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });

    hit.on('pointerdown', () => {
      container.setScale(0.92);
      callback();
    });
    hit.on('pointerup', () => container.setScale(1.0));
    hit.on('pointerout', () => container.setScale(1.0));

    container.add([bg, text, hit]);
    return container;
  }

  // =========================================================================
  // KEYBOARD & GAMEPAD SHORTCUTS
  // =========================================================================

  private setupMenuNavigation(): void {
    // Global keyboard listener for key remapping
    this.keydownListener = (event: KeyboardEvent) => {
      if (this.listeningAction) {
        event.preventDefault();
        event.stopPropagation();

        let key = event.key.toUpperCase();
        if (key === ' ') key = 'SPACE';
        else if (key === 'ARROWUP') key = 'UP';
        else if (key === 'ARROWDOWN') key = 'DOWN';
        else if (key === 'ARROWLEFT') key = 'LEFT';
        else if (key === 'ARROWRIGHT') key = 'RIGHT';
        else if (key === 'ESCAPE') {
          // Cancel remapping
          const current = this.keyRemapButtons.get(this.listeningAction);
          if (current) (current.container as any).drawBtn(false);
          this.listeningAction = null;
          this.updateKeyRemapLabels();
          return;
        }

        Settings.setKeyBinding(this.listeningAction, key);
        SoundFx.playDecide();

        const current = this.keyRemapButtons.get(this.listeningAction);
        if (current) (current.container as any).drawBtn(false);
        this.listeningAction = null;
        this.updateKeyRemapLabels();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    // Keyboard shortcuts to switch tabs
    this.input.keyboard?.on('keydown-TAB', (e: KeyboardEvent) => {
      if (this.nameModalContainer?.visible || this.controlsModalContainer?.visible) return;
      e.preventDefault();
      this.cycleTab(1);
    });

    this.input.keyboard?.on('keydown-Q', () => {
      if (this.nameModalContainer?.visible || this.controlsModalContainer?.visible) return;
      if (!this.listeningAction) this.cycleTab(-1);
    });

    this.input.keyboard?.on('keydown-E', () => {
      if (this.nameModalContainer?.visible || this.controlsModalContainer?.visible) return;
      if (!this.listeningAction) this.cycleTab(1);
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.nameModalContainer?.visible) {
        this.closeNameModal();
        return;
      }
      if (this.controlsModalContainer?.visible) {
        this.closeControlsModal();
        return;
      }
      if (this.listeningAction) {
        const btnData = this.keyRemapButtons.get(this.listeningAction);
        if (btnData) (btnData.container as any).drawBtn(false);
        this.listeningAction = null;
        this.updateKeyRemapLabels();
      } else {
        this.goBack();
      }
    });

    // Gamepad support
    if (this.input.gamepad) {
      this.input.gamepad.on('connected', () => {
        this.updateGamepadStatus();
      });

      this.input.gamepad.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
        if (this.nameModalContainer?.visible) {
          if (button.index === 1) { // B -> Cancel modal
            this.closeNameModal();
          }
          return;
        }
        if (this.controlsModalContainer?.visible) {
          if (button.index === 1) { // B -> Cancel modal
            this.closeControlsModal();
          }
          return;
        }
        // Shoulder buttons cycle tabs
        if (button.index === 4) { // LB
          this.cycleTab(-1);
        } else if (button.index === 5) { // RB
          this.cycleTab(1);
        } else if (button.index === 1 || button.index === 9) { // B or Start -> Back
          this.goBack();
        }
      });
    }

    this.events.once('shutdown', () => {
      this.cleanUpListeners();
    });
  }

  public update(): void {
    this.updateGamepadStatus();
  }

  private cycleTab(direction: number): void {
    const tabs: OptionsTabId[] = ['gameplay', 'audio', 'stats', 'about'];
    const currentIdx = tabs.indexOf(this.currentTab);
    const nextIdx = (currentIdx + direction + tabs.length) % tabs.length;
    SoundFx.playCursor();
    this.switchTab(tabs[nextIdx]);
  }

  // =========================================================================
  // LEADERBOARD HANDLE EDIT MODAL (DEPTH 80)
  // =========================================================================

  private createNameModalUI(centerX: number, centerY: number, uiScale: number): void {
    this.nameModalContainer = this.add.container(centerX, centerY);
    this.nameModalContainer.setDepth(80);
    this.nameModalContainer.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, this.cameras.main.width * 2, this.cameras.main.height * 2, 0x000000, 0.75);
    backdrop.setInteractive(); // Blocks clicks to background

    const modalW = Math.min(360, Math.round(this.cameras.main.width * 0.92));
    const modalH = 240;

    const box = this.add.graphics();
    box.fillStyle(0x130e24, 0.98);
    box.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 16);
    box.lineStyle(2.5, 0x54a0ff, 0.95);
    box.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 16);

    const title = this.add.text(0, -modalH / 2 + 22, '🏆 EDIT ARCADE HANDLE', {
      fontSize: `${Math.round(15 * uiScale)}px`,
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const promptText = this.add.text(0, -modalH / 2 + 48, 'Type (2-10 characters: A-Z, 0-9, -, _)', {
      fontSize: `${Math.round(10.5 * uiScale)}px`,
      color: '#a4b0be'
    }).setOrigin(0.5);

    // Letter slots display
    const slotBox = this.add.graphics();
    slotBox.fillStyle(0x090611, 0.95);
    slotBox.fillRoundedRect(-130, -32, 260, 36, 8);
    slotBox.lineStyle(2, 0x2ed573, 0.85);
    slotBox.strokeRoundedRect(-130, -32, 260, 36, 8);

    this.nameSlotsText = this.add.text(0, -14, '', {
      fontSize: `${Math.round(18 * uiScale)}px`,
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      letterSpacing: 4
    }).setOrigin(0.5);

    this.nameErrorText = this.add.text(0, 16, '', {
      fontSize: `${Math.round(10 * uiScale)}px`,
      color: '#ff4757',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Mobile helper touch buttons (Prompt, Delete, Clear)
    const row1Y = 46;
    const btnW = Math.round(76 * uiScale);
    const btnOffset = Math.round(82 * uiScale);

    const promptBtn = this.createSmallModalButton(-btnOffset, row1Y, '✏ PROMPT', 0x54a0ff, () => {
      const entered = window.prompt('Enter your arcade leaderboard handle (2-10 characters):', this.inputName);
      if (entered !== null) {
        SoundFx.playCursor();
        this.inputName = entered.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 10);
        this.updateNameDisplay();
      }
    }, uiScale);

    const delBtn = this.createSmallModalButton(0, row1Y, '⌫ DEL', 0xff9f43, () => {
      if (this.inputName.length > 0) {
        SoundFx.playCursor();
        this.inputName = this.inputName.slice(0, -1);
        this.updateNameDisplay();
      }
    }, uiScale);

    const clearBtn = this.createSmallModalButton(btnOffset, row1Y, '✖ CLEAR', 0xff4757, () => {
      SoundFx.playCancel();
      this.inputName = '';
      this.updateNameDisplay();
    }, uiScale);

    // Bottom Action Buttons (Confirm & Cancel)
    const row2Y = 88;
    const lgBtnW = Math.round(120 * uiScale);
    const lgBtnH = Math.round(32 * uiScale);
    const lgOffset = Math.round(68 * uiScale);

    const saveBtn = CuteUI.createPillButton(this, -lgOffset, row2Y, 'CONFIRM ✔', () => {
      this.submitNameChange();
    }, {
      textureKey: 'pill_green',
      fontSize: `${Math.round(12 * uiScale)}px`,
      width: lgBtnW,
      height: lgBtnH,
      autoScale: false
    });

    const cancelBtn = CuteUI.createPillButton(this, lgOffset, row2Y, 'CANCEL', () => {
      this.closeNameModal();
    }, {
      textureKey: 'pill_grey',
      fontSize: `${Math.round(12 * uiScale)}px`,
      width: lgBtnW,
      height: lgBtnH,
      autoScale: false
    });

    this.nameModalContainer.add([
      backdrop,
      box,
      title,
      promptText,
      slotBox,
      this.nameSlotsText,
      this.nameErrorText,
      promptBtn,
      delBtn,
      clearBtn,
      saveBtn,
      cancelBtn
    ]);
  }

  private createSmallModalButton(
    x: number,
    y: number,
    text: string,
    color: number,
    callback: () => void,
    uiScale: number = 1.0
  ): Phaser.GameObjects.Container {
    let texture = 'pill_sm_grey';
    if (color === 0x2ed573) texture = 'pill_sm_green';
    else if (color === 0x1e90ff || color === 0x54a0ff) texture = 'pill_sm_blue';
    else if (color === 0xff4757 || color === 0xff69b4) texture = 'pill_sm_pink';
    else if (color === 0x9b59b6 || color === 0xa55eea) texture = 'pill_sm_purple';

    const btnW = Math.round(76 * uiScale);
    const btnH = Math.round(28 * uiScale);

    return CuteUI.createPillButton(this, x, y, text, callback, {
      textureKey: texture,
      fontSize: `${Math.round(11 * uiScale)}px`,
      width: btnW,
      height: btnH,
      autoScale: false
    });
  }

  private updateNameDisplay(): void {
    if (!this.nameSlotsText) return;
    let display = '';
    for (let i = 0; i < 10; i++) {
      if (i < this.inputName.length) {
        display += this.inputName[i] + ' ';
      } else {
        display += '_ ';
      }
    }
    this.nameSlotsText.setText(display.trim());
  }

  private openNameModal(): void {
    SoundFx.playDecide();
    if (!this.nameModalContainer) return;
    this.inputName = LeaderboardClient.getDisplayName().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 10);
    this.updateNameDisplay();
    this.nameErrorText?.setText('');
    this.nameModalContainer.setVisible(true);

    if (this.modalKeydownHandler) {
      window.removeEventListener('keydown', this.modalKeydownHandler);
    }

    this.modalKeydownHandler = (e: KeyboardEvent) => {
      if (this.isUpdatingName) return;

      if (e.key === 'Escape') {
        this.closeNameModal();
        return;
      }
      if (e.key === 'Enter') {
        this.submitNameChange();
        return;
      }
      if (e.key === 'Backspace') {
        if (this.inputName.length > 0) {
          SoundFx.playCursor();
          this.inputName = this.inputName.slice(0, -1);
          this.updateNameDisplay();
        }
        return;
      }
      if (/^[a-zA-Z0-9_-]$/.test(e.key) && this.inputName.length < 10) {
        SoundFx.playCursor();
        this.inputName += e.key.toUpperCase();
        this.updateNameDisplay();
      }
    };

    window.addEventListener('keydown', this.modalKeydownHandler);
  }

  private closeNameModal(): void {
    SoundFx.playCancel();
    if (this.modalKeydownHandler) {
      window.removeEventListener('keydown', this.modalKeydownHandler);
      this.modalKeydownHandler = undefined;
    }
    this.nameModalContainer?.setVisible(false);
  }

  private async submitNameChange(): Promise<void> {
    if (this.isUpdatingName) return;

    const trimmed = this.inputName.trim();
    if (trimmed.length < 2) {
      this.nameErrorText?.setText('Handle must be at least 2 characters!').setColor('#ff4757');
      SoundFx.playCancel();
      return;
    }

    if (trimmed.length > 10) {
      this.nameErrorText?.setText('Handle cannot exceed 10 characters!').setColor('#ff4757');
      SoundFx.playCancel();
      return;
    }

    this.isUpdatingName = true;
    this.nameErrorText?.setText('Updating arcade handle on server...').setColor('#54a0ff');

    try {
      const res = await LeaderboardClient.updateDisplayName(trimmed);
      this.isUpdatingName = false;

      if (res && res.success) {
        SoundFx.playMatch();
        this.closeNameModal();
        this.handleBtnText?.setText(`👤 ${res.displayName || trimmed}  [✏️ CHANGE]`);
      } else {
        this.nameErrorText?.setText(res?.error || 'Failed to update handle!').setColor('#ff4757');
        SoundFx.playCancel();
      }
    } catch (e: any) {
      this.isUpdatingName = false;
      this.nameErrorText?.setText('Connection failed. Please try again.').setColor('#ff4757');
      SoundFx.playCancel();
    }
  }
}
