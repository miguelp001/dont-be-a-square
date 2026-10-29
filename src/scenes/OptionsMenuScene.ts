import Phaser from 'phaser';
import { CuteUI } from '../utils/CuteUI';
import { Settings, KeyBindings, DEFAULT_KEYBINDINGS } from '../utils/Settings';
import { SoundFx } from '../utils/SoundFx';

export default class OptionsMenuScene extends Phaser.Scene {
  private returnScene: string = 'MenuScene';
  private currentTab: 'audio' | 'controls' | 'howToPlay' | 'ai' = 'audio';

  private tabButtons: Phaser.GameObjects.Container[] = [];
  private audioTabContainer!: Phaser.GameObjects.Container;
  private controlsTabContainer!: Phaser.GameObjects.Container;
  private howToPlayTabContainer!: Phaser.GameObjects.Container;
  private aiTabContainer!: Phaser.GameObjects.Container;

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

    // Drifting cute background pattern
    CuteUI.createCuteBackground(this);

    // Title
    const title = this.add.text(width / 2, 42, 'OPTIONS & GUIDE', {
      fontSize: '24px',
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // Flanking sparkle stars
    this.add.image(width / 2 - 150, 42, 'sparkle_star').setScale(1.2);
    this.add.image(width / 2 + 150, 42, 'sparkle_star').setScale(1.2);

    // Navigation Tabs (4 tabs)
    this.createTabs(width / 2, 82);

    // Content Containers
    this.createAudioTab(width / 2, 240);
    this.createControlsTab(width / 2, 240);
    this.createHowToPlayTab(width / 2, 240);
    this.createAITab(width / 2, 240);

    // Back Button (Bottom)
    const cardBottom = 240 + 135; // 375
    const safeBottom = height - 48;
    const backBtnY = Math.min(safeBottom, Math.max(cardBottom + 45, 465));
    const backBtnText = this.returnScene === 'GameScene' ? 'RESUME GAME' : 'BACK TO MENU';
    CuteUI.createPillButton(
      this,
      width / 2,
      backBtnY,
      backBtnText,
      () => {
        this.goBack();
      },
      { textureKey: 'pill_grey', fontSize: '15px', width: 220, height: 44 }
    );

    // Setup global keyboard & gamepad navigation for the options menu
    this.setupMenuNavigation();

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
  }

  private createTabs(centerX: number, y: number): void {
    const tabs = [
      { id: 'audio', label: '🔊 AUDIO' },
      { id: 'controls', label: '🎮 CONTROLS' },
      { id: 'howToPlay', label: '❓ GUIDE' },
      { id: 'ai', label: '🤖 AI' }
    ];

    const tabWidth = 106;
    const spacing = 8;
    const totalW = tabs.length * tabWidth + (tabs.length - 1) * spacing;
    const startX = centerX - totalW / 2 + tabWidth / 2;

    tabs.forEach((tab, index) => {
      const x = startX + index * (tabWidth + spacing);
      const container = this.add.container(x, y);

      const bg = this.add.graphics();
      const drawTab = (active: boolean) => {
        bg.clear();
        bg.fillStyle(active ? 0xff69b4 : 0x1e272e, active ? 0.95 : 0.75);
        bg.fillRoundedRect(-tabWidth / 2, -16, tabWidth, 32, 16);
        bg.lineStyle(2, active ? 0xffffff : 0x54a0ff, active ? 1 : 0.6);
        bg.strokeRoundedRect(-tabWidth / 2, -16, tabWidth, 32, 16);
      };

      drawTab(tab.id === this.currentTab);

      const text = this.add.text(0, -1, tab.label, {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);

      const hit = this.add.rectangle(0, 0, tabWidth, 32, 0x000000, 0);
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
  private createAudioTab(x: number, y: number): void {
    this.audioTabContainer = this.add.container(x, y);

    // Card frame
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-225, -135, 450, 270, 16);
    cardBg.lineStyle(2, 0x54a0ff, 0.85);
    cardBg.strokeRoundedRect(-225, -135, 450, 270, 16);
    this.audioTabContainer.add(cardBg);

    // 1. Music Volume Row
    const musicLabel = this.add.text(0, -95, '🎵 BGM MUSIC VOLUME', {
      fontSize: '14px',
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

    const musicMinusBtn = this.createStepButton(-160, -62, '➖', () => {
      Settings.setMusicVolume(Settings.musicVolume - 0.1, this);
      this.updateAudioDisplays();
      SoundFx.playCursor();
    });

    const musicPlusBtn = this.createStepButton(160, -62, '➕', () => {
      Settings.setMusicVolume(Settings.musicVolume + 0.1, this);
      this.updateAudioDisplays();
      SoundFx.playCursor();
    });

    // 2. SFX Volume Row
    const sfxLabel = this.add.text(0, 0, '🔊 SOUND EFFECTS VOLUME', {
      fontSize: '14px',
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

    const sfxMinusBtn = this.createStepButton(-160, 34, '➖', () => {
      Settings.setSfxVolume(Settings.sfxVolume - 0.1);
      this.updateAudioDisplays();
      SoundFx.playSwap();
    });

    const sfxPlusBtn = this.createStepButton(160, 34, '➕', () => {
      Settings.setSfxVolume(Settings.sfxVolume + 0.1);
      this.updateAudioDisplays();
      SoundFx.playMatch();
    });

    // Install App button
    const installBtn = CuteUI.createPillButton(
      this,
      0,
      95,
      '📲 INSTALL APP (PWA)',
      () => {
        if ((window as any).deferredInstallPrompt && (window as any).promptPwaInstall) {
          (window as any).promptPwaInstall();
        } else {
          alert("To install as an app:\n• On Chrome/Edge/Android: Tap browser menu (⋮) -> 'Install App'\n• On iPhone/Safari: Tap Share icon (⎋) -> 'Add to Home Screen'");
        }
      },
      { textureKey: 'pill_green', fontSize: '12px', width: 190, height: 32 }
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
  private createControlsTab(x: number, y: number): void {
    this.controlsTabContainer = this.add.container(x, y);

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-225, -135, 450, 270, 16);
    cardBg.lineStyle(2, 0x54a0ff, 0.85);
    cardBg.strokeRoundedRect(-225, -135, 450, 270, 16);
    this.controlsTabContainer.add(cardBg);

    // Gamepad live status indicator at top
    this.gamepadStatusText = this.add.text(0, -118, '🎮 GAMEPAD: Checking...', {
      fontSize: '11px',
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.controlsTabContainer.add(this.gamepadStatusText);

    // Left Column: Key Remapping Actions (Move Left, Right, Up, Down, Swap, Lift, Pause)
    const actions: { key: keyof KeyBindings; label: string }[] = [
      { key: 'moveLeft', label: 'MOVE LEFT' },
      { key: 'moveRight', label: 'MOVE RIGHT' },
      { key: 'moveUp', label: 'MOVE UP' },
      { key: 'moveDown', label: 'MOVE DOWN' },
      { key: 'swap', label: 'SWAP SLIMES' },
      { key: 'lift', label: 'FAST LIFT' },
      { key: 'pause', label: 'PAUSE GAME' }
    ];

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
      const barWidth = 240;
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
  private createHowToPlayTab(x: number, y: number): void {
    this.howToPlayTabContainer = this.add.container(x, y);

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-225, -135, 450, 270, 16);
    cardBg.lineStyle(2, 0x2ed573, 0.85);
    cardBg.strokeRoundedRect(-225, -135, 450, 270, 16);
    this.howToPlayTabContainer.add(cardBg);

    const guideLines = [
      {
        title: '🎯 THE GOAL',
        desc: 'Swap two horizontal slimes to connect 3+ of the same color in a row or column to clear them!'
      },
      {
        title: '🎮 UNIVERSAL CONTROLS',
        desc: '• Keyboard: Remappable keys in Controls tab (Default: Arrows/WASD, Space, Shift).\n• Gamepad: Full native support (D-Pad, A to Swap, B to Lift, Start to Pause).\n• Touch: Swipe directly on slimes or use on-screen D-Pad and pill buttons!'
      },
      {
        title: '💥 CHAINS & COMBOS',
        desc: 'Clear 4+ slimes for Combos. Panels that fall into new matches form CHAINS! Chains pause stack rise and drop heavy garbage blocks on your rival!'
      },
      {
        title: '⚠️ DANGER & SURVIVAL',
        desc: 'When slimes reach the ceiling, you have 6.5s of Danger Grace! Make quick matches to pause danger and clear breathing room!'
      }
    ];

    let startY = -120;
    guideLines.forEach((item) => {
      const heading = this.add.text(-205, startY, item.title, {
        fontSize: '11.5px',
        color: '#ff9ff3',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      });

      const body = this.add.text(-205, startY + 15, item.desc, {
        fontSize: '10px',
        color: '#d2dae2',
        lineSpacing: 2,
        wordWrap: { width: 410 }
      });

      this.howToPlayTabContainer.add([heading, body]);
      startY += body.height + 18;
    });
  }

  /** Tab 4: AI Disclosure Statement */
  private createAITab(x: number, y: number): void {
    this.aiTabContainer = this.add.container(x, y);

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-225, -135, 450, 270, 16);
    cardBg.lineStyle(2, 0xa55eea, 0.85);
    cardBg.strokeRoundedRect(-225, -135, 450, 270, 16);
    this.aiTabContainer.add(cardBg);

    const title = this.add.text(0, -100, '🤖 AI TRANSPARENCY & DISCLOSURE', {
      fontSize: '13.5px',
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

    let currentY = -68;
    statements.forEach((txt, idx) => {
      const isLast = idx === statements.length - 1;
      const t = this.add.text(isLast ? 0 : -205, currentY, txt, {
        fontSize: isLast ? '11px' : '10px',
        color: isLast ? '#feca57' : '#d2dae2',
        fontStyle: isLast ? 'italic bold' : 'normal',
        align: isLast ? 'center' : 'left',
        lineSpacing: 2.5,
        wordWrap: { width: 410 }
      });
      if (isLast) t.setOrigin(0.5, 0);

      this.aiTabContainer.add(t);
      currentY += t.height + 10;
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
