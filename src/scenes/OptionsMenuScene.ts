import Phaser from 'phaser';
import { CuteUI } from '../utils/CuteUI';
import { Settings, KeyBindings, DEFAULT_KEYBINDINGS } from '../utils/Settings';
import { SoundFx } from '../utils/SoundFx';
import { computeOptionsMenuLayout, OptionsMenuLayout } from '../ui/OptionsMenuLayout';

export default class OptionsMenuScene extends Phaser.Scene {
  private returnScene: string = 'MenuScene';
  private currentTab: 'audio' | 'controls' | 'howToPlay' | 'ai' = 'audio';

  private tabButtons: Phaser.GameObjects.Container[] = [];
  private audioTabContainer!: Phaser.GameObjects.Container;
  private controlsTabContainer!: Phaser.GameObjects.Container;
  private howToPlayTabContainer!: Phaser.GameObjects.Container;
  private aiTabContainer!: Phaser.GameObjects.Container;

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

  // Audio tab text refs
  private musicVolumeText!: Phaser.GameObjects.Text;
  private musicBarGraphics!: Phaser.GameObjects.Graphics;
  private sfxVolumeText!: Phaser.GameObjects.Text;
  private sfxBarGraphics!: Phaser.GameObjects.Graphics;

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

    // Navigation Tabs (4 tabs)
    this.createTabs(width / 2, layout);

    // Content Containers (guaranteed strictly below tabs to prevent any overlap)
    this.createAudioTab(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile);
    this.createControlsTab(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile, layout.useMobileControlsSubTabs);
    this.createHowToPlayTab(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile);
    this.createAITab(width / 2, layout.cardY, layout.cardW, layout.cardH, layout.isMobile);

    if (layout.cardScale > 1.0) {
      this.audioTabContainer.setScale(layout.cardScale);
      this.controlsTabContainer.setScale(layout.cardScale);
      this.howToPlayTabContainer.setScale(layout.cardScale);
      this.aiTabContainer.setScale(layout.cardScale);
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
      { id: 'audio', label: '🔊 AUDIO', shortLabel: '🔊 AUDIO' },
      { id: 'controls', label: '🎮 CONTROLS', shortLabel: '🎮 KEYS' },
      { id: 'howToPlay', label: '❓ GUIDE', shortLabel: '❓ GUIDE' },
      { id: 'ai', label: '🤖 AI', shortLabel: '🤖 AI' }
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
        fontSize: `${layout.useShortLabels ? 10 : Math.round(11 * (layout.isMobile ? 1.0 : Math.min(1.2, layout.uiScale)))}px`,
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

  private switchTab(tabId: 'audio' | 'controls' | 'howToPlay' | 'ai'): void {
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
    const musicLabel = this.add.text(0, -92, '🎵 BGM MUSIC VOLUME', {
      fontSize: isMobile ? '13px' : '14px',
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.musicBarGraphics = this.add.graphics();
    this.musicVolumeText = this.add.text(0, -48, '', {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const musicMinusBtn = this.createStepButton(-stepBtnOffset, -62, '➖', () => {
      Settings.setMusicVolume(Settings.musicVolume - 0.1, this);
      this.updateAudioDisplays();
      SoundFx.playCursor();
    });

    const musicPlusBtn = this.createStepButton(stepBtnOffset, -62, '➕', () => {
      Settings.setMusicVolume(Settings.musicVolume + 0.1, this);
      this.updateAudioDisplays();
      SoundFx.playCursor();
    });

    // 2. SFX Volume Row
    const sfxLabel = this.add.text(0, 4, '🔊 SOUND EFFECTS VOLUME', {
      fontSize: isMobile ? '13px' : '14px',
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.sfxBarGraphics = this.add.graphics();
    this.sfxVolumeText = this.add.text(0, 48, '', {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const sfxMinusBtn = this.createStepButton(-stepBtnOffset, 34, '➖', () => {
      Settings.setSfxVolume(Settings.sfxVolume - 0.1);
      this.updateAudioDisplays();
      SoundFx.playSwap();
    });

    const sfxPlusBtn = this.createStepButton(stepBtnOffset, 34, '➕', () => {
      Settings.setSfxVolume(Settings.sfxVolume + 0.1);
      this.updateAudioDisplays();
      SoundFx.playMatch();
    });

    // Install App button
    const installBtnW = Math.min(190, cardW - 40);
    const installBtn = CuteUI.createPillButton(
      this,
      0,
      96,
      '📲 INSTALL APP (PWA)',
      () => {
        if ((window as any).deferredInstallPrompt && (window as any).promptPwaInstall) {
          (window as any).promptPwaInstall();
        } else {
          alert("To install as an app:\n• On Chrome/Edge/Android: Tap browser menu (⋮) -> 'Install App'\n• On iPhone/Safari: Tap Share icon (⎋) -> 'Add to Home Screen'");
        }
      },
      { textureKey: 'pill_green', fontSize: '12px', width: installBtnW, height: 32 }
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

    drawVolumeBar(this.musicBarGraphics, -62, Settings.musicVolume, 0xfeca57);
    this.musicVolumeText.setText(`${Math.round(Settings.musicVolume * 100)}%`);

    drawVolumeBar(this.sfxBarGraphics, 34, Settings.sfxVolume, 0xff69b4);
    this.sfxVolumeText.setText(`${Math.round(Settings.sfxVolume * 100)}%`);
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
          desc: 'Matching animations freeze stack rise! When slimes reach the ceiling, a 6.5s Danger Grace countdown activates. Any match pauses danger!',
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
          title: '📡 RADAR & THREAT BUFFER',
          desc: 'In VS mode, watch the opponent radar mini-grid! The flashing threat bar reveals pending garbage drop timers so you can prepare counters.',
          iconColor: '#feca57'
        },
        {
          title: '🦅 MID-AIR SWAPPING',
          desc: 'You can swap slimes mid-air as they fall! Use mid-air swaps to catch cascading drops before they land for clutch last-second saves.',
          iconColor: '#1dd1a1'
        },
        {
          title: '🔄 INSTANT ONLINE REMATCH',
          desc: 'After an Online Multiplayer match, tap "PLAY AGAIN" to immediately vote for a rematch with the same player with synchronized seed generation!',
          iconColor: '#a55eea'
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
    const tabs: ('audio' | 'controls' | 'howToPlay' | 'ai')[] = ['audio', 'controls', 'howToPlay', 'ai'];
    const currentIdx = tabs.indexOf(this.currentTab);
    const nextIdx = (currentIdx + direction + tabs.length) % tabs.length;
    SoundFx.playCursor();
    this.switchTab(tabs[nextIdx]);
  }
}
