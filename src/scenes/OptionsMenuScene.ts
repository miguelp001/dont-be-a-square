import Phaser from 'phaser';
import { CuteUI } from '../utils/CuteUI';
import { Settings, KeyBindings, DEFAULT_KEYBINDINGS } from '../utils/Settings';
import { SoundFx } from '../utils/SoundFx';
import { computeOptionsMenuLayout, OptionsMenuLayout } from '../ui/OptionsMenuLayout';
import { GameDifficulty, DIFFICULTY_ORDER, getDifficultyInfo } from '../utils/Difficulty';
import { StatsManager, GameStats } from '../utils/StatsManager';
import { CHARACTERS } from '../utils/Constants';

export default class OptionsMenuScene extends Phaser.Scene {
  private returnScene: string = 'MenuScene';
  private currentTab: 'audio' | 'controls' | 'howToPlay' | 'ai' | 'stats' = 'audio';

  private tabButtons: Phaser.GameObjects.Container[] = [];
  private audioTabContainer!: Phaser.GameObjects.Container;
  private controlsTabContainer!: Phaser.GameObjects.Container;
  private howToPlayTabContainer!: Phaser.GameObjects.Container;
  private aiTabContainer!: Phaser.GameObjects.Container;
  private statsTabContainer!: Phaser.GameObjects.Container;

  // Responsive card & layout metrics
  private cardW: number = 450;
  private cardH: number = 270;
  private barWidth: number = 240;
  private mobileControlsSubTab: 'keys' | 'gamepad' = 'keys';
  private mobileKeysContainer?: Phaser.GameObjects.Container;
  private mobileGamepadContainer?: Phaser.GameObjects.Container;
  private mobileSubTabButtons: Phaser.GameObjects.Container[] = [];
  private onResizeListener?: () => void;

  // Interactive Guide tab state
  private guideSubTab: 'basics' | 'chains' | 'strategy' = 'basics';
  private guideContainers: Map<'basics' | 'chains' | 'strategy', Phaser.GameObjects.Container> = new Map();
  private guideSubTabButtons: Phaser.GameObjects.Container[] = [];

  // Statistics tab state
  private statsSubTab: 'overview' | 'winrates' | 'combos' | 'inputs' = 'overview';
  private statsContainers: Map<'overview' | 'winrates' | 'combos' | 'inputs', Phaser.GameObjects.Container> = new Map();
  private statsSubTabButtons: Phaser.GameObjects.Container[] = [];

  // Audio & Settings tab refs
  private musicVolumeText!: Phaser.GameObjects.Text;
  private musicBarGraphics!: Phaser.GameObjects.Graphics;
  private sfxVolumeText!: Phaser.GameObjects.Text;
  private sfxBarGraphics!: Phaser.GameObjects.Graphics;
  private diffCenterText?: Phaser.GameObjects.Text;
  private diffDescText?: Phaser.GameObjects.Text;

  // Controls tab refs
  private listeningAction: keyof KeyBindings | null = null;
  private keyRemapButtons: Map<keyof KeyBindings, { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text }> = new Map();
  private gamepadStatusText!: Phaser.GameObjects.Text;
  private keydownListener?: (event: KeyboardEvent) => void;

  constructor() {
    super({ key: 'OptionsMenuScene' });
  }

  init(data: any): void {
    this.returnScene = data?.returnScene || 'MenuScene';
    this.currentTab = data?.defaultTab || 'audio';
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
    this.add.text(width / 2, layout.titleY, 'OPTIONS & GUIDE', {
      fontSize: `${layout.titleSize}px`,
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: Math.round(4 * (layout.uiScale > 1.3 ? 1.3 : 1.0))
    }).setOrigin(0.5);

    // Flanking sparkle stars
    this.add.image(width / 2 - layout.starOffset, layout.titleY, 'sparkle_star').setScale(layout.starScale);
    this.add.image(width / 2 + layout.starOffset, layout.titleY, 'sparkle_star').setScale(layout.starScale);

    // Navigation Tabs (5 tabs)
    this.createTabs(width / 2, layout);

    // Content Containers (guaranteed strictly below tabs to prevent any overlap)
    this.createAudioTab(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile);
    this.createControlsTab(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile, layout.useMobileControlsSubTabs);
    this.createHowToPlayTab(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile);
    this.createAITab(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile);
    this.createStatsTab(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile);

    if (layout.cardScale > 1.0) {
      this.audioTabContainer.setScale(layout.cardScale);
      this.controlsTabContainer.setScale(layout.cardScale);
      this.howToPlayTabContainer.setScale(layout.cardScale);
      this.aiTabContainer.setScale(layout.cardScale);
      this.statsTabContainer.setScale(layout.cardScale);
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
    if (this.onResizeListener) {
      this.scale.off('resize', this.onResizeListener);
      this.onResizeListener = undefined;
    }
  }

  private createTabs(
    centerX: number,
    layout: OptionsMenuLayout
  ): void {
    this.tabButtons = [];
    const tabs = [
      { id: 'audio', label: '🔊 AUDIO', shortLabel: '🔊 AUD' },
      { id: 'controls', label: '🎮 CONTROLS', shortLabel: '🎮 KEYS' },
      { id: 'howToPlay', label: '❓ GUIDE', shortLabel: '❓ GUIDE' },
      { id: 'ai', label: '🤖 AI', shortLabel: '🤖 AI' },
      { id: 'stats', label: '📊 STATS', shortLabel: '📊 STATS' }
    ];

    const tabWidth = layout.tabWidth;
    const tabHeight = layout.tabHeight;
    const halfH = tabHeight / 2;
    const spacing = layout.tabSpacing;
    const startX = centerX - layout.totalTabWidth / 2 + tabWidth / 2;

    tabs.forEach((tab, index) => {
      const x = startX + index * (tabWidth + spacing);
      const container = this.add.container(x, layout.tabY);

      const bg = this.add.graphics();
      const drawTab = (active: boolean) => {
        bg.clear();
        bg.fillStyle(active ? 0xff69b4 : 0x1e272e, active ? 0.95 : 0.75);
        bg.fillRoundedRect(-tabWidth / 2, -halfH, tabWidth, tabHeight, halfH);
        bg.lineStyle(2, active ? 0xffffff : 0x54a0ff, active ? 1 : 0.6);
        bg.strokeRoundedRect(-tabWidth / 2, -halfH, tabWidth, tabHeight, halfH);
      };

      drawTab(tab.id === this.currentTab);

      const labelText = layout.useShortLabels ? tab.shortLabel : tab.label;
      const text = this.add.text(0, -1, labelText, {
        fontSize: `${layout.useShortLabels ? 9.5 : Math.round(11 * (layout.isMobile ? 1.0 : Math.min(1.2, layout.uiScale)))}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);

      const hit = this.add.rectangle(0, 0, tabWidth, tabHeight, 0x000000, 0);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        SoundFx.playCursor();
        this.switchTab(tab.id as any);
      });

      container.add([bg, text, hit]);
      (container as any).drawTab = drawTab;
      (container as any).tabId = tab.id;
      this.tabButtons.push(container);
    });
  }

  private switchTab(tabId: 'audio' | 'controls' | 'howToPlay' | 'ai' | 'stats'): void {
    this.currentTab = tabId;
    this.listeningAction = null;

    this.tabButtons.forEach((btn) => {
      const active = (btn as any).tabId === tabId;
      (btn as any).drawTab(active);
    });

    this.audioTabContainer.setVisible(tabId === 'audio');
    this.controlsTabContainer.setVisible(tabId === 'controls');
    this.howToPlayTabContainer.setVisible(tabId === 'howToPlay');
    this.aiTabContainer.setVisible(tabId === 'ai');
    this.statsTabContainer.setVisible(tabId === 'stats');

    if (tabId === 'controls') {
      this.updateGamepadStatus();
      this.updateKeyRemapLabels();
    }
  }

  /** Tab 1: Music & Sound FX Volume Controls */
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
    cardBg.lineStyle(2, 0x54a0ff, 0.85);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    this.audioTabContainer.add(cardBg);

    const stepBtnOffset = Math.min(160, Math.round(cardW / 2 - 28));

    // 1. Music Volume Row
    const musicLabel = this.add.text(0, -100, '🎵 BGM MUSIC VOLUME', {
      fontSize: isMobile ? '12px' : '13px',
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.musicBarGraphics = this.add.graphics();
    this.musicVolumeText = this.add.text(0, -64, '', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const musicMinusBtn = this.createStepButton(-stepBtnOffset, -76, '➖', () => {
      Settings.setMusicVolume(Settings.musicVolume - 0.1, this);
      this.updateAudioDisplays();
      SoundFx.playCursor();
    });

    const musicPlusBtn = this.createStepButton(stepBtnOffset, -76, '➕', () => {
      Settings.setMusicVolume(Settings.musicVolume + 0.1, this);
      this.updateAudioDisplays();
      SoundFx.playCursor();
    });

    // 2. SFX Volume Row
    const sfxLabel = this.add.text(0, -36, '🔊 SOUND EFFECTS VOLUME', {
      fontSize: isMobile ? '12px' : '13px',
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.sfxBarGraphics = this.add.graphics();
    this.sfxVolumeText = this.add.text(0, 0, '', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const sfxMinusBtn = this.createStepButton(-stepBtnOffset, -12, '➖', () => {
      Settings.setSfxVolume(Settings.sfxVolume - 0.1);
      this.updateAudioDisplays();
      SoundFx.playSwap();
    });

    const sfxPlusBtn = this.createStepButton(stepBtnOffset, -12, '➕', () => {
      Settings.setSfxVolume(Settings.sfxVolume + 0.1);
      this.updateAudioDisplays();
      SoundFx.playMatch();
    });

    // 3. Default Game Difficulty Row
    const diffLabel = this.add.text(0, 22, '⭐ DEFAULT GAME DIFFICULTY', {
      fontSize: isMobile ? '11.5px' : '12.5px',
      color: '#54a0ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const diffBtnW = Math.min(240, cardW - 40);
    const arrowW = 32;
    const centerW = diffBtnW - (arrowW * 2) - 6;

    const diffMinusBtn = CuteUI.createPillButton(this, -diffBtnW / 2 + arrowW / 2, 48, '◀', () => {
      this.cycleDifficulty(-1);
    }, { textureKey: 'pill_blue', width: arrowW, height: 26, fontSize: '13px', autoScale: false });

    const diffCenterPill = CuteUI.createPillButton(this, 0, 48, '', () => {
      this.cycleDifficulty(1);
    }, { textureKey: 'pill_pink', width: centerW, height: 26, fontSize: '11px', autoScale: false });
    this.diffCenterText = diffCenterPill.list.find((c) => c instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text;

    const diffPlusBtn = CuteUI.createPillButton(this, diffBtnW / 2 - arrowW / 2, 48, '▶', () => {
      this.cycleDifficulty(1);
    }, { textureKey: 'pill_blue', width: arrowW, height: 26, fontSize: '13px', autoScale: false });

    this.diffDescText = this.add.text(0, 70, '', {
      fontSize: isMobile ? '9px' : '10px',
      color: '#54a0ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.updateDifficultyDisplay();

    // Install App button
    const installBtnW = Math.min(190, cardW - 40);
    const installBtn = CuteUI.createPillButton(
      this,
      0,
      104,
      '📲 INSTALL APP (PWA)',
      () => {
        if ((window as any).deferredInstallPrompt && (window as any).promptPwaInstall) {
          (window as any).promptPwaInstall();
        } else {
          alert("To install as an app:\n• On Chrome/Edge/Android: Tap browser menu (⋮) -> 'Install App'\n• On iPhone/Safari: Tap Share icon (⎋) -> 'Add to Home Screen'");
        }
      },
      { textureKey: 'pill_green', fontSize: '11.5px', width: installBtnW, height: 28 }
    );

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
      diffLabel,
      diffMinusBtn,
      diffCenterPill,
      diffPlusBtn,
      this.diffDescText,
      installBtn
    ]);

    this.updateAudioDisplays();
  }

  /** Tab 2: Keyboard Remapping, Gamepad Status & Touch Support */
  private createControlsTab(
    x: number,
    y: number,
    cardW: number,
    cardH: number,
    isMobile: boolean,
    useSubTabs: boolean = false
  ): void {
    this.controlsTabContainer = this.add.container(x, y);
    this.keyRemapButtons.clear();

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    cardBg.lineStyle(2, 0x54a0ff, 0.85);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    this.controlsTabContainer.add(cardBg);

    // Gamepad live status indicator at top
    this.gamepadStatusText = this.add.text(0, -cardH / 2 + 18, '🎮 GAMEPAD: Checking...', {
      fontSize: isMobile ? '10px' : '11px',
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.controlsTabContainer.add(this.gamepadStatusText);

    // Key Remapping Actions (Move Left, Right, Up, Down, Swap, Lift, Pause)
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
      const startRowY = -92;
      const rowHeight = 27;

      actions.forEach((act, idx) => {
        const rowY = startRowY + idx * rowHeight;

        const actText = this.add.text(-205, rowY, act.label, {
          fontSize: '11px',
          color: '#d2dae2',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2
        }).setOrigin(0, 0.5);

        // Key binding button (click to remap)
        const btnContainer = this.add.container(-40, rowY);
        const btnBg = this.add.graphics();
        const drawBtn = (isListening: boolean) => {
          btnBg.clear();
          btnBg.fillStyle(isListening ? 0xffbe1a : 0x221a38, 0.95);
          btnBg.fillRoundedRect(-55, -11, 110, 22, 6);
          btnBg.lineStyle(1.5, isListening ? 0xffffff : 0x54a0ff, 0.9);
          btnBg.strokeRoundedRect(-55, -11, 110, 22, 6);
        };
        drawBtn(false);

        const keyLabel = this.add.text(0, -1, this.formatKeyName(Settings.keyBindings[act.key]), {
          fontSize: '10.5px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(0.5);

        const hit = this.add.rectangle(0, 0, 110, 22, 0x000000, 0);
        hit.setInteractive({ useHandCursor: true });

        hit.on('pointerdown', () => {
          SoundFx.playCursor();
          this.startListeningForKey(act.key);
        });

        btnContainer.add([btnBg, keyLabel, hit]);
        (btnContainer as any).drawBtn = drawBtn;

        this.keyRemapButtons.set(act.key, { container: btnContainer, label: keyLabel });
        this.controlsTabContainer.add([actText, btnContainer]);
      });

      // Right Column: Gamepad & Touch Guide Reference
      const guideBox = this.add.graphics();
      guideBox.fillStyle(0x0e091b, 0.7);
      guideBox.fillRoundedRect(30, -96, 185, 185, 10);
      guideBox.lineStyle(1, 0xffffff, 0.15);
      guideBox.strokeRoundedRect(30, -96, 185, 185, 10);
      this.controlsTabContainer.add(guideBox);

      const guideTitle = this.add.text(122, -84, '🎮 GAMEPAD MAP', {
        fontSize: '11px',
        color: '#2ed573',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
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

      const guideText = this.add.text(38, -68, padLines.join('\n'), {
        fontSize: '9.5px',
        color: '#c8d6e5',
        lineSpacing: 3
      });

      this.controlsTabContainer.add([guideTitle, guideText]);

      // Reset Defaults Button
      const resetBtn = CuteUI.createPillButton(
        this,
        -95,
        108,
        'RESET DEFAULTS',
        () => {
          Settings.resetKeyBindings();
          this.updateKeyRemapLabels();
          SoundFx.playCursor();
        },
        { textureKey: 'pill_sm_grey', fontSize: '11px', width: 130, height: 28 }
      );
      this.controlsTabContainer.add(resetBtn);
    } else {
      // MOBILE: Sub-segmented toggle for Keyboard vs Gamepad & Touch
      this.mobileKeysContainer = this.add.container(0, 0);
      this.mobileGamepadContainer = this.add.container(0, 0);
      this.mobileSubTabButtons = [];

      // Sub-toggle pills
      const subTabs = [
        { id: 'keys', label: '⌨️ KEY REMAP' },
        { id: 'gamepad', label: '🎮 GAMEPAD / TOUCH' }
      ];
      const subTabW = Math.floor((cardW - 32 - 8) / 2);
      const subTabH = 26;
      const subStartX = -cardW / 2 + 16 + subTabW / 2;
      const subY = -cardH / 2 + 40;

      subTabs.forEach((st, idx) => {
        const stX = subStartX + idx * (subTabW + 8);
        const stContainer = this.add.container(stX, subY);
        const stBg = this.add.graphics();

        const drawSubTab = (active: boolean) => {
          stBg.clear();
          stBg.fillStyle(active ? 0x2ed573 : 0x110d20, active ? 0.95 : 0.75);
          stBg.fillRoundedRect(-subTabW / 2, -subTabH / 2, subTabW, subTabH, 6);
          stBg.lineStyle(1.5, active ? 0xffffff : 0x54a0ff, active ? 0.9 : 0.4);
          stBg.strokeRoundedRect(-subTabW / 2, -subTabH / 2, subTabW, subTabH, 6);
        };
        drawSubTab(st.id === this.mobileControlsSubTab);

        const stText = this.add.text(0, -1, st.label, {
          fontSize: '10.5px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(0.5);

        const stHit = this.add.rectangle(0, 0, subTabW, subTabH, 0x000000, 0);
        stHit.setInteractive({ useHandCursor: true });
        stHit.on('pointerdown', () => {
          SoundFx.playCursor();
          this.switchMobileControlsSubTab(st.id as any);
        });

        stContainer.add([stBg, stText, stHit]);
        (stContainer as any).drawTab = drawSubTab;
        (stContainer as any).tabId = st.id;
        this.mobileSubTabButtons.push(stContainer);
        this.controlsTabContainer.add(stContainer);
      });

      // 1. Mobile Keyboard Remap View
      const rowStartY = -62;
      const rowHeight = 22;
      const labelX = -cardW / 2 + 16;
      const btnX = cardW / 2 - 58;

      actions.forEach((act, idx) => {
        const rowY = rowStartY + idx * rowHeight;

        const actText = this.add.text(labelX, rowY, act.label, {
          fontSize: '10px',
          color: '#d2dae2',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2
        }).setOrigin(0, 0.5);

        const btnContainer = this.add.container(btnX, rowY);
        const btnBg = this.add.graphics();
        const drawBtn = (isListening: boolean) => {
          btnBg.clear();
          btnBg.fillStyle(isListening ? 0xffbe1a : 0x221a38, 0.95);
          btnBg.fillRoundedRect(-50, -9, 100, 18, 5);
          btnBg.lineStyle(1.5, isListening ? 0xffffff : 0x54a0ff, 0.9);
          btnBg.strokeRoundedRect(-50, -9, 100, 18, 5);
        };
        drawBtn(false);

        const keyLabel = this.add.text(0, -1, this.formatKeyName(Settings.keyBindings[act.key]), {
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(0.5);

        const hit = this.add.rectangle(0, 0, 100, 18, 0x000000, 0);
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

      const resetBtn = CuteUI.createPillButton(
        this,
        0,
        106,
        'RESET DEFAULTS',
        () => {
          Settings.resetKeyBindings();
          this.updateKeyRemapLabels();
          SoundFx.playCursor();
        },
        { textureKey: 'pill_sm_grey', fontSize: '11px', width: 140, height: 26 }
      );
      this.mobileKeysContainer.add(resetBtn);

      // 2. Mobile Gamepad & Touch Guide View
      const guideBoxW = cardW - 28;
      const guideBoxH = 168;
      const gBox = this.add.graphics();
      gBox.fillStyle(0x0e091b, 0.7);
      gBox.fillRoundedRect(-guideBoxW / 2, -64, guideBoxW, guideBoxH, 10);
      gBox.lineStyle(1, 0xffffff, 0.15);
      gBox.strokeRoundedRect(-guideBoxW / 2, -64, guideBoxW, guideBoxH, 10);

      const padGuideLines = [
        '🎮 GAMEPAD / CONTROLLER:',
        '• D-Pad / Left Stick: Move Cursor',
        '• Button A / Cross: Swap Horizontal Slimes',
        '• Button B / Circle / L1: Fast Lift Stack',
        '• Start / Options: Pause Game',
        '',
        '📱 TOUCHSCREEN CONTROLS:',
        '• Tap & drag on slimes to swap dynamically',
        '• Virtual D-pad + On-screen Swap / Lift buttons'
      ];

      const gText = this.add.text(-guideBoxW / 2 + 14, -54, padGuideLines.join('\n'), {
        fontSize: '9.5px',
        color: '#c8d6e5',
        lineSpacing: 3,
        wordWrap: { width: guideBoxW - 28 }
      });

      this.mobileGamepadContainer.add([gBox, gText]);

      this.controlsTabContainer.add([this.mobileKeysContainer, this.mobileGamepadContainer]);
      this.switchMobileControlsSubTab('keys');
    }

    // Global Key Listener for Remapping
    this.keydownListener = (event: KeyboardEvent) => {
      if (!this.listeningAction) return;

      event.preventDefault();
      event.stopPropagation();

      let keyName = event.key.toUpperCase();
      if (event.code.startsWith('Key')) keyName = event.code.replace('Key', '');
      else if (event.code.startsWith('Digit')) keyName = event.code.replace('Digit', '');
      else if (event.code === 'ArrowUp') keyName = 'UP';
      else if (event.code === 'ArrowDown') keyName = 'DOWN';
      else if (event.code === 'ArrowLeft') keyName = 'LEFT';
      else if (event.code === 'ArrowRight') keyName = 'RIGHT';
      else if (event.code === 'Space') keyName = 'SPACE';
      else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') keyName = 'SHIFT';
      else if (event.code === 'Escape') keyName = 'ESCAPE';
      else if (event.code === 'Enter') keyName = 'ENTER';

      Settings.setKeyBinding(this.listeningAction, keyName);
      SoundFx.playMatch();

      const btnData = this.keyRemapButtons.get(this.listeningAction);
      if (btnData) {
        (btnData.container as any).drawBtn(false);
      }
      this.listeningAction = null;
      this.updateKeyRemapLabels();
    };

    window.addEventListener('keydown', this.keydownListener);
  }

  private switchMobileControlsSubTab(subTab: 'keys' | 'gamepad'): void {
    this.mobileControlsSubTab = subTab;
    this.mobileSubTabButtons.forEach((btn) => {
      const active = (btn as any).tabId === subTab;
      (btn as any).drawTab(active);
    });
    if (this.mobileKeysContainer) this.mobileKeysContainer.setVisible(subTab === 'keys');
    if (this.mobileGamepadContainer) this.mobileGamepadContainer.setVisible(subTab === 'gamepad');
  }

  private startListeningForKey(action: keyof KeyBindings): void {
    if (this.listeningAction) {
      const prev = this.keyRemapButtons.get(this.listeningAction);
      if (prev) (prev.container as any).drawBtn(false);
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

    drawVolumeBar(this.musicBarGraphics, -76, Settings.musicVolume, 0xfeca57);
    this.musicVolumeText.setText(`${Math.round(Settings.musicVolume * 100)}%`);

    drawVolumeBar(this.sfxBarGraphics, -12, Settings.sfxVolume, 0xff69b4);
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

  /** Tab 3: How to Play Visual Guide */
  private createHowToPlayTab(
    x: number,
    y: number,
    cardW: number,
    cardH: number,
    isMobile: boolean
  ): void {
    this.howToPlayTabContainer = this.add.container(x, y);

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    cardBg.lineStyle(2, 0x2ed573, 0.85);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    this.howToPlayTabContainer.add(cardBg);

    this.guideContainers.clear();
    this.guideSubTabButtons = [];

    // 3 Category Sub-Tab Pills at top of card
    const topics: { id: 'basics' | 'chains' | 'strategy'; label: string; color: number }[] = [
      { id: 'basics', label: '🎯 BASICS', color: 0x2ed573 },
      { id: 'chains', label: '💥 CHAINS', color: 0xff69b4 },
      { id: 'strategy', label: '🏆 PRO TIPS', color: 0xfeca57 }
    ];

    const subTabSpacing = 6;
    const subTabW = Math.floor((cardW - 32 - (topics.length - 1) * subTabSpacing) / topics.length);
    const subTabH = 24;
    const subStartX = -cardW / 2 + 16 + subTabW / 2;
    const subY = -cardH / 2 + 22;

    topics.forEach((top, idx) => {
      const topX = subStartX + idx * (subTabW + subTabSpacing);
      const topContainer = this.add.container(topX, subY);
      const topBg = this.add.graphics();

      const drawTopicTab = (active: boolean) => {
        topBg.clear();
        topBg.fillStyle(active ? top.color : 0x110d20, active ? 0.95 : 0.75);
        topBg.fillRoundedRect(-subTabW / 2, -subTabH / 2, subTabW, subTabH, 6);
        topBg.lineStyle(1.5, active ? 0xffffff : 0x54a0ff, active ? 0.9 : 0.4);
        topBg.strokeRoundedRect(-subTabW / 2, -subTabH / 2, subTabW, subTabH, 6);
      };
      drawTopicTab(top.id === this.guideSubTab);

      const topText = this.add.text(0, -1, top.label, {
        fontSize: isMobile ? '10px' : '10.5px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const hit = this.add.rectangle(0, 0, subTabW, subTabH, 0x000000, 0);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        SoundFx.playCursor();
        this.switchGuideSubTab(top.id);
      });

      topContainer.add([topBg, topText, hit]);
      (topContainer as any).drawTab = drawTopicTab;
      (topContainer as any).tabId = top.id;
      this.guideSubTabButtons.push(topContainer);
      this.howToPlayTabContainer.add(topContainer);
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

    (['basics', 'chains', 'strategy'] as const).forEach((topicKey) => {
      const topicContainer = this.add.container(0, 0);
      let itemY = -cardH / 2 + 46;

      guideData[topicKey].forEach((item) => {
        const heading = this.add.text(contentX, itemY, item.title, {
          fontSize: isMobile ? '10.5px' : '11px',
          color: item.iconColor,
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2
        });

        const body = this.add.text(contentX, itemY + (isMobile ? 13 : 15), item.desc, {
          fontSize: isMobile ? '9px' : '9.5px',
          color: '#d2dae2',
          lineSpacing: isMobile ? 1.5 : 2,
          wordWrap: { width: wrapW }
        });

        topicContainer.add([heading, body]);
        itemY += body.height + (isMobile ? 12 : 14);
      });

      this.guideContainers.set(topicKey, topicContainer);
      this.howToPlayTabContainer.add(topicContainer);
    });

    this.switchGuideSubTab('basics');
  }

  private switchGuideSubTab(subTab: 'basics' | 'chains' | 'strategy'): void {
    this.guideSubTab = subTab;
    this.guideSubTabButtons.forEach((btn) => {
      const active = (btn as any).tabId === subTab;
      (btn as any).drawTab(active);
    });
    this.guideContainers.forEach((container, key) => {
      container.setVisible(key === subTab);
    });
  }

  /** Tab 4: AI Disclosure Statement */
  private createAITab(
    x: number,
    y: number,
    cardW: number,
    cardH: number,
    isMobile: boolean
  ): void {
    this.aiTabContainer = this.add.container(x, y);

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    cardBg.lineStyle(2, 0xa55eea, 0.85);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    this.aiTabContainer.add(cardBg);

    const title = this.add.text(0, -cardH / 2 + 25, '🤖 AI TRANSPARENCY & DISCLOSURE', {
      fontSize: isMobile ? '11.5px' : '13.5px',
      color: '#a55eea',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const statements = [
      '• Character Concept Art & Chibi Portraits:\nGenerated and styled with the assistance of Google DeepMind AI models.',
      '• Music Themes & Procedural Synthesizers:\nComposed and synthesized with generative AI assistance for authentic retro arcade vibes.',
      '• Code & Game Engine:\nFull physics simulation, panel matching algorithms, WebSocket multiplayer networking, and universal controls engineered with AI pair-programming in TypeScript & Phaser 3.',
      'Built with passion and dedication to classic action puzzle gaming!'
    ];

    const contentX = -cardW / 2 + (isMobile ? 14 : 20);
    const wrapW = cardW - (isMobile ? 28 : 40);
    let currentY = -cardH / 2 + 50;

    statements.forEach((txt, idx) => {
      const isLast = idx === statements.length - 1;
      const t = this.add.text(isLast ? 0 : contentX, currentY, txt, {
        fontSize: isLast ? (isMobile ? '10px' : '11px') : (isMobile ? '9px' : '10px'),
        color: isLast ? '#feca57' : '#d2dae2',
        fontStyle: isLast ? 'italic bold' : 'normal',
        align: isLast ? 'center' : 'left',
        lineSpacing: isMobile ? 1.5 : 2.5,
        wordWrap: { width: wrapW }
      });
      if (isLast) t.setOrigin(0.5, 0);

      this.aiTabContainer.add(t);
      currentY += t.height + (isMobile ? 8 : 10);
    });

    this.aiTabContainer.add(title);
  }

  /** Tab 5: Statistics & Telemetry with Canvas Charts & Graphs */
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
    cardBg.lineStyle(2, 0x00d2d3, 0.85);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    this.statsTabContainer.add(cardBg);

    // 4 Subtabs across top
    const statTabs = [
      { id: 'overview' as const, label: isMobile ? '📊 OVERVIEW' : '📊 OVERVIEW', color: 0x54a0ff },
      { id: 'winrates' as const, label: isMobile ? '⚔️ RECORD' : '⚔️ WIN RATES', color: 0x2ed573 },
      { id: 'combos' as const, label: isMobile ? '💥 COMBOS' : '💥 COMBOS & CHAINS', color: 0xff9f43 },
      { id: 'inputs' as const, label: isMobile ? '🎮 SYSTEM' : '🎮 INPUTS & SYS', color: 0xa55eea }
    ];

    this.statsSubTabButtons = [];
    const subTabSpacing = 4;
    const subTabW = Math.floor((cardW - 28 - (statTabs.length - 1) * subTabSpacing) / statTabs.length);
    const subTabH = isMobile ? 22 : 24;
    const subStartX = -cardW / 2 + 14 + subTabW / 2;
    const subY = -cardH / 2 + 20;

    statTabs.forEach((tab, idx) => {
      const topX = subStartX + idx * (subTabW + subTabSpacing);
      const topContainer = this.add.container(topX, subY);
      const topBg = this.add.graphics();

      const drawTopicTab = (active: boolean) => {
        topBg.clear();
        topBg.fillStyle(active ? tab.color : 0x110d20, active ? 0.95 : 0.75);
        topBg.fillRoundedRect(-subTabW / 2, -subTabH / 2, subTabW, subTabH, 6);
        topBg.lineStyle(1.5, active ? 0xffffff : 0x00d2d3, active ? 0.9 : 0.35);
        topBg.strokeRoundedRect(-subTabW / 2, -subTabH / 2, subTabW, subTabH, 6);
      };
      drawTopicTab(tab.id === this.statsSubTab);

      const topText = this.add.text(0, -1, tab.label, {
        fontSize: isMobile ? '9.5px' : '10.5px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const hit = this.add.rectangle(0, 0, subTabW, subTabH, 0x000000, 0);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        SoundFx.playCursor();
        this.switchStatsSubTab(tab.id);
      });

      topContainer.add([topBg, topText, hit]);
      (topContainer as any).drawTab = drawTopicTab;
      (topContainer as any).tabId = tab.id;
      this.statsSubTabButtons.push(topContainer);
      this.statsTabContainer.add(topContainer);
    });

    // Render initial subtab contents
    this.renderStatsSubTabs(cardW, cardH, isMobile);
  }

  private renderStatsSubTabs(cardW: number, cardH: number, isMobile: boolean): void {
    // Remove existing sub-containers
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
    const boxY = barY + 40;
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
      const cx = startX + idx * stepX;
      const bh = Math.max(4, Math.round((cd.count / maxChainCount) * maxBarH));
      const by = baseLineY - bh;

      chartGraphics.fillStyle(cd.color, 0.9);
      chartGraphics.fillRoundedRect(cx - colW / 2, by, colW, bh, 4);
      chartGraphics.lineStyle(1, 0xffffff, 0.4);
      chartGraphics.strokeRoundedRect(cx - colW / 2, by, colW, bh, 4);

      // Count above
      const countText = this.add.text(cx, by - 7, `${cd.count}`, {
        fontSize: isMobile ? '8.5px' : '9.5px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      // Label below baseline
      const lblText = this.add.text(cx, baseLineY + 8, cd.label, {
        fontSize: isMobile ? '8px' : '9px',
        color: cd.hex,
        fontStyle: 'bold'
      }).setOrigin(0.5);

      container.add([countText, lblText]);
    });
    container.add(chartGraphics);

    // 2. Combo Pops Horizontal Bars
    const comboStartY = baseLineY + 28;
    const comboTitle = this.add.text(0, comboStartY, '🌟 SIMULTANEOUS COMBO POPS (SAME SWAP)', {
      fontSize: isMobile ? '9.5px' : '10.5px',
      color: '#feca57',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(comboTitle);

    const comboData = [
      { label: '4-Slime Pop', count: stats.combos4, color: 0x54a0ff },
      { label: '5-Slime Pop', count: stats.combos5, color: 0xa55eea },
      { label: '6+ Mega Pop', count: stats.combos6Plus, color: 0xff4757 }
    ];

    const maxComboCount = Math.max(...comboData.map((c) => c.count), 1);
    const cBarW = cardW - (isMobile ? 160 : 180);
    const cBarH = 10;
    const cBarStartX = -cardW / 2 + (isMobile ? 85 : 95);

    comboData.forEach((cd, idx) => {
      const cy = comboStartY + 18 + idx * (isMobile ? 16 : 18);

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

    // 3. Reset Button & Engine Info
    const btnY = cardH / 2 - 24;
    const resetBtn = CuteUI.createPillButton(
      this,
      0,
      btnY,
      '🔄 RESET ALL STATS',
      () => {
        StatsManager.resetStats();
        SoundFx.playMatch();
        this.renderStatsSubTabs(cardW, cardH, isMobile);
      },
      {
        textureKey: 'pill_red',
        fontSize: isMobile ? '9.5px' : '10.5px',
        width: isMobile ? 160 : 180,
        height: 28,
        autoScale: false
      }
    );
    container.add(resetBtn);

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

  /** Setup Gamepad and Keyboard shortcuts for Options Navigation */
  private setupMenuNavigation(): void {
    // Keyboard shortcuts to switch tabs
    this.input.keyboard?.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.cycleTab(1);
    });

    this.input.keyboard?.on('keydown-Q', () => {
      if (!this.listeningAction) this.cycleTab(-1);
    });

    this.input.keyboard?.on('keydown-E', () => {
      if (!this.listeningAction) this.cycleTab(1);
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.listeningAction) {
        // Cancel listening
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
        // Shoulder buttons or D-pad Left/Right cycle tabs
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
    const tabs: ('audio' | 'controls' | 'howToPlay' | 'ai' | 'stats')[] = ['audio', 'controls', 'howToPlay', 'ai', 'stats'];
    const currentIdx = tabs.indexOf(this.currentTab);
    const nextIdx = (currentIdx + direction + tabs.length) % tabs.length;
    SoundFx.playCursor();
    this.switchTab(tabs[nextIdx]);
  }
}
