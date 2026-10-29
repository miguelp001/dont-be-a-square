import Phaser from 'phaser';
import { CuteUI } from '../utils/CuteUI';
import { Settings } from '../utils/Settings';
import { SoundFx } from '../utils/SoundFx';

export default class OptionsMenuScene extends Phaser.Scene {
  private returnScene: string = 'MenuScene';
  private currentTab: 'audio' | 'howToPlay' | 'ai' = 'audio';

  private tabButtons: Phaser.GameObjects.Container[] = [];
  private audioTabContainer!: Phaser.GameObjects.Container;
  private howToPlayTabContainer!: Phaser.GameObjects.Container;
  private aiTabContainer!: Phaser.GameObjects.Container;

  // Audio tab text refs
  private musicVolumeText!: Phaser.GameObjects.Text;
  private musicBarGraphics!: Phaser.GameObjects.Graphics;
  private sfxVolumeText!: Phaser.GameObjects.Text;
  private sfxBarGraphics!: Phaser.GameObjects.Graphics;

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

    // Navigation Tabs
    this.createTabs(width / 2, 82);

    // Content Containers
    this.createAudioTab(width / 2, 240);
    this.createHowToPlayTab(width / 2, 240);
    this.createAITab(width / 2, 240);

    // Back Button (Bottom)
    const backBtnText = this.returnScene === 'GameScene' ? 'RESUME GAME' : 'BACK TO MENU';
    CuteUI.createPillButton(
      this,
      width / 2,
      Math.max(468, height - 44),
      backBtnText,
      () => {
        SoundFx.playCursor();
        this.scene.start(this.returnScene);
      },
      { textureKey: 'pill_grey', fontSize: '15px', width: 220, height: 44 }
    );

    // Show initial tab
    this.switchTab(this.currentTab);
  }

  private createTabs(centerX: number, y: number): void {
    const tabs = [
      { id: 'audio', label: '🔊 AUDIO' },
      { id: 'howToPlay', label: '❓ HOW TO PLAY' },
      { id: 'ai', label: '🤖 AI DISCLOSURE' }
    ];

    const tabWidth = 145;
    const startX = centerX - tabWidth;

    tabs.forEach((tab, index) => {
      const x = startX + index * (tabWidth + 6);
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

  private switchTab(tabId: 'audio' | 'howToPlay' | 'ai'): void {
    this.currentTab = tabId;

    this.tabButtons.forEach((btn) => {
      const active = (btn as any).tabId === tabId;
      (btn as any).drawTab(active);
    });

    this.audioTabContainer.setVisible(tabId === 'audio');
    this.howToPlayTabContainer.setVisible(tabId === 'howToPlay');
    this.aiTabContainer.setVisible(tabId === 'ai');
  }

  /** Tab 1: Music & Sound FX Volume Controls */
  private createAudioTab(x: number, y: number): void {
    this.audioTabContainer = this.add.container(x, y);

    // Card frame
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-220, -125, 440, 260, 16);
    cardBg.lineStyle(2, 0x54a0ff, 0.85);
    cardBg.strokeRoundedRect(-220, -125, 440, 260, 16);
    this.audioTabContainer.add(cardBg);

    // 1. Music Volume Row
    const musicLabel = this.add.text(0, -90, '🎵 BGM MUSIC VOLUME', {
      fontSize: '15px',
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.musicBarGraphics = this.add.graphics();
    this.musicVolumeText = this.add.text(0, -42, '', {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const musicMinusBtn = this.createStepButton(-160, -56, '➖', () => {
      Settings.setMusicVolume(Settings.musicVolume - 0.1, this);
      this.updateAudioDisplays();
      SoundFx.playCursor();
    });

    const musicPlusBtn = this.createStepButton(160, -56, '➕', () => {
      Settings.setMusicVolume(Settings.musicVolume + 0.1, this);
      this.updateAudioDisplays();
      SoundFx.playCursor();
    });

    // 2. SFX Volume Row
    const sfxLabel = this.add.text(0, 10, '🔊 SOUND EFFECTS VOLUME', {
      fontSize: '15px',
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.sfxBarGraphics = this.add.graphics();
    this.sfxVolumeText = this.add.text(0, 58, '', {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const sfxMinusBtn = this.createStepButton(-160, 44, '➖', () => {
      Settings.setSfxVolume(Settings.sfxVolume - 0.1);
      this.updateAudioDisplays();
      SoundFx.playSwap();
    });

    const sfxPlusBtn = this.createStepButton(160, 44, '➕', () => {
      Settings.setSfxVolume(Settings.sfxVolume + 0.1);
      this.updateAudioDisplays();
      SoundFx.playMatch();
    });

    // Install App button
    const installBtn = CuteUI.createPillButton(
      this,
      0,
      100,
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

      // Track background
      g.fillStyle(0x0c0818, 0.9);
      g.fillRoundedRect(startX, centerY - barHeight / 2, barWidth, barHeight, 7);
      g.lineStyle(1.5, 0xffffff, 0.35);
      g.strokeRoundedRect(startX, centerY - barHeight / 2, barWidth, barHeight, 7);

      // Active fill
      const fillW = Math.max(0, barWidth * vol);
      if (fillW > 0) {
        g.fillStyle(color, 0.95);
        g.fillRoundedRect(startX + 1, centerY - barHeight / 2 + 1, fillW - 2, barHeight - 2, 6);
      }
    };

    drawVolumeBar(this.musicBarGraphics, -56, Settings.musicVolume, 0xfeca57);
    this.musicVolumeText.setText(`${Math.round(Settings.musicVolume * 100)}%`);

    drawVolumeBar(this.sfxBarGraphics, 44, Settings.sfxVolume, 0xff69b4);
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

  /** Tab 2: How to Play Visual Guide */
  private createHowToPlayTab(x: number, y: number): void {
    this.howToPlayTabContainer = this.add.container(x, y);

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-225, -135, 450, 275, 16);
    cardBg.lineStyle(2, 0x2ed573, 0.85);
    cardBg.strokeRoundedRect(-225, -135, 450, 275, 16);
    this.howToPlayTabContainer.add(cardBg);

    const guideLines = [
      {
        title: '🎯 THE GOAL',
        desc: 'Swap two horizontal slimes to connect 3+ of the same color in a row or column to clear them!'
      },
      {
        title: '🎮 CONTROLS',
        desc: '• Desktop: Arrow keys / WASD to move cursor. Space / X to swap. Shift to lift stack.\n• Mobile: Tap slimes to select, swipe left/right to swap, or use on-screen D-Pad & buttons!'
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

    let startY = -115;
    guideLines.forEach((item) => {
      const heading = this.add.text(-205, startY, item.title, {
        fontSize: '12px',
        color: '#ff9ff3',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      });

      const body = this.add.text(-205, startY + 16, item.desc, {
        fontSize: '10.5px',
        color: '#d2dae2',
        lineSpacing: 2,
        wordWrap: { width: 410 }
      });

      this.howToPlayTabContainer.add([heading, body]);
      startY += body.height + 22;
    });
  }

  /** Tab 3: AI Disclosure Statement */
  private createAITab(x: number, y: number): void {
    this.aiTabContainer = this.add.container(x, y);

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.95);
    cardBg.fillRoundedRect(-220, -125, 440, 260, 16);
    cardBg.lineStyle(2, 0xa55eea, 0.85);
    cardBg.strokeRoundedRect(-220, -125, 440, 260, 16);
    this.aiTabContainer.add(cardBg);

    const title = this.add.text(0, -95, '🤖 AI TRANSPARENCY & DISCLOSURE', {
      fontSize: '14px',
      color: '#a55eea',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const statements = [
      '• Character Concept Art & Chibi Portraits:\nGenerated and styled with the assistance of Google DeepMind AI models.',
      '• Music Themes & Procedural Synthesizers:\nComposed and synthesized with generative AI assistance for authentic retro arcade vibes.',
      '• Code & Game Engine:\nFull physics simulation, panel matching algorithms, WebSocket multiplayer networking, and touch controls engineered with AI pair-programming in TypeScript & Phaser 3.',
      'Built with passion and dedication to classic action puzzle gaming!'
    ];

    let currentY = -60;
    statements.forEach((txt, idx) => {
      const isLast = idx === statements.length - 1;
      const t = this.add.text(isLast ? 0 : -200, currentY, txt, {
        fontSize: isLast ? '11px' : '10.5px',
        color: isLast ? '#feca57' : '#d2dae2',
        fontStyle: isLast ? 'italic bold' : 'normal',
        align: isLast ? 'center' : 'left',
        lineSpacing: 3,
        wordWrap: { width: 400 }
      });
      if (isLast) t.setOrigin(0.5, 0);

      this.aiTabContainer.add(t);
      currentY += t.height + 12;
    });

    this.aiTabContainer.add(title);
  }
}
