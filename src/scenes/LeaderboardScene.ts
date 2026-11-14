import Phaser from 'phaser';
import { CuteUI } from '../utils/CuteUI';
import { Settings } from '../utils/Settings';
import { SoundFx } from '../utils/SoundFx';
import { GameDifficulty, DIFFICULTY_ORDER, getDifficultyInfo } from '../utils/Difficulty';
import { LeaderboardClient, LeaderboardData, LeaderboardRow } from '../utils/LeaderboardClient';
import { CHARACTERS } from '../utils/Constants';

export default class LeaderboardScene extends Phaser.Scene {
  private selectedMode: 'endless' | 'challenge' = 'endless';
  private selectedDifficulty: GameDifficulty = Settings.difficulty || GameDifficulty.ADEPT;
  private returnScene: string = 'MenuScene';

  private tableContainer?: Phaser.GameObjects.Container;
  private diffCenterText!: Phaser.GameObjects.Text;
  private endlessBtn!: Phaser.GameObjects.Container;
  private challengeBtn!: Phaser.GameObjects.Container;
  private loadingText?: Phaser.GameObjects.Text;

  private padRepeatTimer: number = 0;
  private prevPadButtons: Map<number, boolean> = new Map();

  // In-Game Arcade Handle Modal
  private nameModalContainer?: Phaser.GameObjects.Container;
  private nameSlotsText?: Phaser.GameObjects.Text;
  private nameErrorText?: Phaser.GameObjects.Text;
  private inputName: string = '';
  private isUpdatingName: boolean = false;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor() {
    super({ key: 'LeaderboardScene' });
  }

  init(data: any): void {
    this.returnScene = data?.returnScene || 'MenuScene';
    const mode = data?.initialMode || data?.mode;
    if (mode === 'endless' || mode === 'challenge') {
      this.selectedMode = mode;
    }
    const diff = data?.initialDifficulty || data?.difficulty;
    if (diff && DIFFICULTY_ORDER.includes(diff)) {
      this.selectedDifficulty = diff;
    }
  }

  create(): void {
    this.prevPadButtons.clear();

    if (this.cache.audio.exists('menu') && !this.sound.get('menu')?.isPlaying) {
      this.sound.stopAll();
      this.sound.play('menu', { loop: true, volume: Settings.musicVolume });
    }

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const isMobile = width < 600 || height >= width * 1.05;
    const uiScale = isMobile ? 1.0 : CuteUI.getUIScale(this);

    // 3D Parallax fairytale background
    CuteUI.createCuteBackground(this);

    // Title
    const titleY = Math.round((isMobile ? 24 : 30) * uiScale);
    this.add
      .text(width / 2, titleY, '🏆 GLOBAL LEADERBOARDS 🏆', {
        fontSize: `${Math.round((isMobile ? 18 : 22) * uiScale)}px`,
        color: '#feca57',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5);

    // Subtitle instruction
    this.add
      .text(width / 2, titleY + Math.round((isMobile ? 20 : 24) * uiScale), 'Arcade rankings persisted server-side • Zero login needed', {
        fontSize: `${Math.round((isMobile ? 12 : 13) * uiScale)}px`,
        color: '#c8d6e5',
        stroke: '#000000',
        strokeThickness: 1.5
      })
      .setOrigin(0.5);

    // Mode Selector Tabs
    const modeBtnW = isMobile ? Math.min(145, Math.floor((width - 36) / 2)) : Math.round(160 * uiScale);
    const modeBtnH = Math.round((isMobile ? 32 : 36) * uiScale);
    const modeY = titleY + Math.round((isMobile ? 44 : 54) * uiScale);

    this.endlessBtn = CuteUI.createPillButton(
      this,
      width / 2 - modeBtnW / 2 - 6,
      modeY,
      'ENDLESS MARATHON',
      () => this.setMode('endless'),
      { textureKey: this.selectedMode === 'endless' ? 'pill_green' : 'pill_grey', width: modeBtnW, height: modeBtnH, fontSize: `${Math.round((isMobile ? 12 : 13.5) * uiScale)}px`, autoScale: false }
    );

    this.challengeBtn = CuteUI.createPillButton(
      this,
      width / 2 + modeBtnW / 2 + 6,
      modeY,
      'CHALLENGE MODE',
      () => this.setMode('challenge'),
      { textureKey: this.selectedMode === 'challenge' ? 'pill_pink' : 'pill_grey', width: modeBtnW, height: modeBtnH, fontSize: `${Math.round((isMobile ? 12 : 13.5) * uiScale)}px`, autoScale: false }
    );

    // Difficulty Selector Row
    const diffBtnW = isMobile ? Math.min(270, width - 32) : Math.round(290 * uiScale);
    const arrowW = Math.round((isMobile ? 34 : 38) * uiScale);
    const centerW = diffBtnW - (arrowW * 2) - 8;
    const diffY = modeY + Math.round((isMobile ? 38 : 42) * uiScale);

    CuteUI.createPillButton(this, width / 2 - diffBtnW / 2 + arrowW / 2, diffY, '◀', () => {
      this.cycleDifficulty(-1);
    }, { textureKey: 'pill_blue', width: arrowW, height: Math.round(30 * uiScale), fontSize: `${Math.round(14 * uiScale)}px`, autoScale: false });

    const centerPill = CuteUI.createPillButton(this, width / 2, diffY, '', () => {
      this.cycleDifficulty(1);
    }, { textureKey: 'pill_purple', width: centerW, height: Math.round(30 * uiScale), fontSize: `${Math.round(13 * uiScale)}px`, autoScale: false });

    this.diffCenterText = centerPill.list.find((c) => c instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text;

    CuteUI.createPillButton(this, width / 2 + diffBtnW / 2 - arrowW / 2, diffY, '▶', () => {
      this.cycleDifficulty(1);
    }, { textureKey: 'pill_blue', width: arrowW, height: Math.round(30 * uiScale), fontSize: `${Math.round(14 * uiScale)}px`, autoScale: false });

    this.updateDifficultyDisplay();

    // Bottom Navigation Buttons
    const footerBtnW = isMobile ? Math.min(100, Math.floor((width - 32) / 3)) : Math.round(125 * uiScale);
    const footerBtnH = Math.round((isMobile ? 30 : 34) * uiScale);
    const footerY = height - Math.round((isMobile ? 22 : 26) * uiScale);
    const totalFooterW = footerBtnW * 3 + (isMobile ? 12 : 24);
    const footerStartX = width / 2 - totalFooterW / 2 + footerBtnW / 2;
    const footerGap = footerBtnW + (isMobile ? 6 : 12);

    CuteUI.createPillButton(this, footerStartX, footerY, '🔄 REFRESH', () => {
      SoundFx.playCursor();
      this.loadLeaderboardData();
    }, { textureKey: 'pill_blue', width: footerBtnW, height: footerBtnH, fontSize: `${Math.round(12 * uiScale)}px`, autoScale: false });

    CuteUI.createPillButton(this, footerStartX + footerGap, footerY, '✏️ NAME', () => {
      this.promptChangeName();
    }, { textureKey: 'pill_purple', width: footerBtnW, height: footerBtnH, fontSize: `${Math.round(12 * uiScale)}px`, autoScale: false });

    CuteUI.createPillButton(this, footerStartX + footerGap * 2, footerY, 'BACK', () => {
      SoundFx.playCursor();
      this.scene.start(this.returnScene);
    }, { textureKey: 'pill_grey', width: footerBtnW, height: footerBtnH, fontSize: `${Math.round(12 * uiScale)}px`, autoScale: false });

    // Setup Keyboard Shortcuts (bypassed if name modal is active)
    this.input.keyboard?.on('keydown-LEFT', () => {
      if (this.nameModalContainer?.visible) return;
      this.cycleDifficulty(-1);
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      if (this.nameModalContainer?.visible) return;
      this.cycleDifficulty(1);
    });
    this.input.keyboard?.on('keydown-A', () => {
      if (this.nameModalContainer?.visible) return;
      this.cycleDifficulty(-1);
    });
    this.input.keyboard?.on('keydown-D', () => {
      if (this.nameModalContainer?.visible) return;
      this.cycleDifficulty(1);
    });
    this.input.keyboard?.on('keydown-TAB', () => {
      if (this.nameModalContainer?.visible) return;
      this.setMode(this.selectedMode === 'endless' ? 'challenge' : 'endless');
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.nameModalContainer?.visible) {
        this.closeNameModal();
        return;
      }
      SoundFx.playCursor();
      this.scene.start(this.returnScene);
    });

    // Cleanup window listener on shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
        this.keydownHandler = undefined;
      }
      this.input.keyboard?.removeAllListeners();
      this.input.gamepad?.removeAllListeners();
    });

    // Create In-Game Handle Modal UI
    this.createNameModalUI(width / 2, height / 2, uiScale);

    // Load initial data
    this.loadLeaderboardData();
  }

  public update(_time: number, delta: number): void {
    if (this.nameModalContainer?.visible) return;
    this.handleGamepadInput(delta);
  }

  private setMode(mode: 'endless' | 'challenge'): void {
    if (this.selectedMode === mode) return;
    SoundFx.playCursor();
    this.selectedMode = mode;

    // Update tab visual highlights
    this.endlessBtn.list.forEach((obj) => {
      if (obj instanceof Phaser.GameObjects.Image && obj.texture.key.startsWith('pill_')) {
        obj.setTexture(this.selectedMode === 'endless' ? 'pill_green' : 'pill_grey');
      }
    });
    this.challengeBtn.list.forEach((obj) => {
      if (obj instanceof Phaser.GameObjects.Image && obj.texture.key.startsWith('pill_')) {
        obj.setTexture(this.selectedMode === 'challenge' ? 'pill_pink' : 'pill_grey');
      }
    });

    this.loadLeaderboardData();
  }

  private cycleDifficulty(delta: number): void {
    SoundFx.playCursor();
    const currIdx = DIFFICULTY_ORDER.indexOf(this.selectedDifficulty);
    const newIdx = (currIdx + delta + DIFFICULTY_ORDER.length) % DIFFICULTY_ORDER.length;
    this.selectedDifficulty = DIFFICULTY_ORDER[newIdx];
    this.updateDifficultyDisplay();
    this.loadLeaderboardData();
  }

  private updateDifficultyDisplay(): void {
    const info = getDifficultyInfo(this.selectedDifficulty);
    if (this.diffCenterText) {
      this.diffCenterText.setText(`DIFFICULTY: ${info.badge}`);
      this.diffCenterText.setColor(info.hexColor);
    }
  }

  private async loadLeaderboardData(): Promise<void> {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const isMobile = width < 600 || height >= width * 1.05;
    const uiScale = isMobile ? 1.0 : CuteUI.getUIScale(this);

    if (this.tableContainer) {
      this.tableContainer.destroy();
    }

    if (!this.loadingText) {
      this.loadingText = this.add.text(width / 2, height / 2 + 10, 'Loading global scores...', {
        fontSize: `${Math.round(13 * uiScale)}px`,
        color: '#feca57',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);
    } else {
      this.loadingText.setVisible(true);
    }

    const data = await LeaderboardClient.fetchLeaderboard(this.selectedMode, this.selectedDifficulty, 10);
    if (!this.scene || !this.scene.isActive()) return;
    if (this.loadingText) {
      this.loadingText.setVisible(false);
    }

    this.renderTable(data);
  }

  private renderTable(data: LeaderboardData | null): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const isMobile = width < 600 || height >= width * 1.05;
    const uiScale = isMobile ? 1.0 : CuteUI.getUIScale(this);

    this.tableContainer = this.add.container(width / 2, 0);

    const cardW = isMobile ? width - 24 : Math.min(width - 40, Math.round(480 * uiScale));
    const cardTopY = Math.round((isMobile ? 122 : 142) * uiScale);
    const cardBottomY = height - Math.round((isMobile ? 48 : 56) * uiScale);
    const cardH = cardBottomY - cardTopY;

    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(0x0c0618, 0.94);
    bg.fillRoundedRect(-cardW / 2, cardTopY, cardW, cardH, 12);
    bg.lineStyle(2, 0xa55eea, 0.8);
    bg.strokeRoundedRect(-cardW / 2, cardTopY, cardW, cardH, 12);
    this.tableContainer.add(bg);

    if (!data || !Array.isArray(data.top) || data.top.length === 0) {
      const emptyMsg = this.add.text(0, cardTopY + cardH / 2, 'No records recorded yet for this tier.\nBe the first to claim the throne!', {
        fontSize: `${Math.round(12 * uiScale)}px`,
        color: '#a4b0be',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);
      this.tableContainer.add(emptyMsg);
      return;
    }

    // Table Header
    const rowH = Math.min(28, Math.floor((cardH - 42) / 10));
    const headerY = cardTopY + 16;
    const header = this.add.text(-cardW / 2 + 16, headerY, '#   FIGHTER   PLAYER          HIGH SCORE         CHAIN', {
      fontSize: `${Math.round(11 * uiScale)}px`,
      color: '#a4b0be',
      fontStyle: 'bold'
    });
    this.tableContainer.add(header);

    // Divider rule
    const rule = this.add.graphics();
    rule.lineStyle(1, 0xffffff, 0.15);
    rule.strokeLineShape(new Phaser.Geom.Line(-cardW / 2 + 12, headerY + 12, cardW / 2 - 12, headerY + 12));
    this.tableContainer.add(rule);

    const listStartY = headerY + 22;
    const myPlayerId = LeaderboardClient.getPlayerId();

    data.top.slice(0, 8).forEach((row, idx) => {
      const y = listStartY + idx * rowH;
      const isMe = row.playerId === myPlayerId;

      if (isMe) {
        const highlight = this.add.graphics();
        highlight.fillStyle(0xfeca57, 0.18);
        highlight.fillRoundedRect(-cardW / 2 + 6, y - rowH / 2 + 2, cardW - 12, rowH - 2, 4);
        this.tableContainer?.add(highlight);
      }

      // Rank Badge
      const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`;
      const rankText = this.add.text(-cardW / 2 + 14, y, medal, {
        fontSize: `${Math.round((row.rank <= 3 ? 14 : 12) * uiScale)}px`,
        color: row.rank === 1 ? '#feca57' : row.rank === 2 ? '#dfe4ea' : row.rank === 3 ? '#ff9f43' : '#a4b0be',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5);
      this.tableContainer?.add(rankText);

      // Character Avatar
      const charKey = CHARACTERS.find((c) => c.id === row.characterId)?.id || 'kiri';
      const avatar = this.add.image(-cardW / 2 + Math.round(58 * uiScale), y, charKey);
      avatar.setDisplaySize(Math.round(18 * uiScale), Math.round(18 * uiScale));
      this.tableContainer?.add(avatar);

      // Player Name
      const nameText = this.add.text(-cardW / 2 + Math.round(76 * uiScale), y, row.displayName, {
        fontSize: `${Math.round(12.5 * uiScale)}px`,
        color: isMe ? '#feca57' : '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 1
      }).setOrigin(0, 0.5);
      this.tableContainer?.add(nameText);

      // High Score Points
      const scoreLabel = `${row.score.toLocaleString()} pts`;

      const scoreText = this.add.text(cardW / 2 - Math.round(65 * uiScale), y, scoreLabel, {
        fontSize: `${Math.round(12.5 * uiScale)}px`,
        color: this.selectedMode === 'endless' ? '#2ed573' : '#feca57',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 1
      }).setOrigin(1, 0.5);
      this.tableContainer?.add(scoreText);

      // Max Chain Badge
      const chainText = this.add.text(cardW / 2 - 14, y, `x${row.maxChain || 1}`, {
        fontSize: `${Math.round(11.5 * uiScale)}px`,
        color: '#ff9ff3',
        fontStyle: 'bold'
      }).setOrigin(1, 0.5);
      this.tableContainer?.add(chainText);
    });

    // Pinned Bottom Bar: Player's Personal Status
    const pinnedH = Math.round((isMobile ? 26 : 28) * uiScale);
    const pinnedY = cardBottomY - pinnedH / 2 - 4;
    const pinBg = this.add.graphics();
    pinBg.fillStyle(0x1a0f30, 0.98);
    pinBg.fillRoundedRect(-cardW / 2 + 8, pinnedY - pinnedH / 2, cardW - 16, pinnedH, 6);
    pinBg.lineStyle(1.2, 0xfeca57, 0.6);
    pinBg.strokeRoundedRect(-cardW / 2 + 8, pinnedY - pinnedH / 2, cardW - 16, pinnedH, 6);
    this.tableContainer.add(pinBg);

    let pinMsg = '';
    const myName = LeaderboardClient.getDisplayName();
    if (data.playerRank) {
      const myScore = `${data.playerRank.entry.score.toLocaleString()} pts`;
      pinMsg = `⭐ YOUR BEST: #${data.playerRank.rank} • ${data.playerRank.entry.displayName} • ${myScore}  [✏️ EDIT]`;
    } else {
      pinMsg = `⭐ YOUR BEST: Unranked in this tier (${myName})  [✏️ EDIT]`;
    }

    const pinText = this.add.text(0, pinnedY, pinMsg, {
      fontSize: `${Math.round(9.5 * uiScale)}px`,
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(0.5);
    pinText.setInteractive({ useHandCursor: true });
    pinText.on('pointerdown', () => {
      this.promptChangeName();
    });
    this.tableContainer.add(pinText);
  }

  private promptChangeName(): void {
    this.openNameModal();
  }

  /** In-game Arcade Handle modal dialog */
  private createNameModalUI(x: number, y: number, uiScale: number = 1.0): void {
    this.nameModalContainer = this.add.container(x, y);
    this.nameModalContainer.setVisible(false);
    this.nameModalContainer.setDepth(100);

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Fullscreen darken backdrop that absorbs background clicks
    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.78);
    backdrop.setInteractive();

    const isMobile = width < 600 || height >= width * 1.05;
    const modalW = isMobile ? Math.min(width - 24, 340) : Math.round(360 * uiScale);
    const modalH = Math.round(230 * uiScale);

    // Modal Window Box
    const box = this.add.graphics();
    box.fillStyle(0x160d2b, 0.98);
    box.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 14);
    box.lineStyle(2.5, 0xa55eea, 1);
    box.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 14);

    const title = this.add.text(0, -Math.round(82 * uiScale), '✏️ ARCADE HANDLE (NAME)', {
      fontSize: `${Math.round(16 * uiScale)}px`,
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const promptText = this.add.text(0, -Math.round(56 * uiScale), 'Type 2-10 letters/numbers (or use prompt)', {
      fontSize: `${Math.round(11 * uiScale)}px`,
      color: '#a4b0be'
    }).setOrigin(0.5);

    // Text box outline for handle
    const slotW = Math.round(260 * uiScale);
    const slotH = Math.round(34 * uiScale);
    const slotBox = this.add.graphics();
    slotBox.fillStyle(0x0c0618, 0.95);
    slotBox.fillRoundedRect(-slotW / 2, -Math.round(38 * uiScale), slotW, slotH, 8);
    slotBox.lineStyle(1.5, 0xfeca57, 0.8);
    slotBox.strokeRoundedRect(-slotW / 2, -Math.round(38 * uiScale), slotW, slotH, 8);

    this.nameSlotsText = this.add.text(0, -Math.round(21 * uiScale), '', {
      fontSize: `${Math.round(18 * uiScale)}px`,
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.nameErrorText = this.add.text(0, Math.round(6 * uiScale), '', {
      fontSize: `${Math.round(11 * uiScale)}px`,
      color: '#ff4757',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);

    // Row 1: Touch buttons: PROMPT / DEL / CLEAR
    const row1Y = Math.round(38 * uiScale);
    const smBtnOffset = Math.round(88 * uiScale);

    const promptBtn = this.createSmallButton(-smBtnOffset, row1Y, '⌨️ PROMPT', 0x54a0ff, () => {
      const p = window.prompt('Enter your arcade handle (2-10 characters):', this.inputName);
      if (p !== null) {
        const cleaned = p.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 10);
        if (cleaned) {
          this.inputName = cleaned;
          this.updateNameDisplay();
        }
      }
    }, uiScale);

    const delBtn = this.createSmallButton(0, row1Y, '⌫ DEL', 0x9b59b6, () => {
      if (this.inputName.length > 0) {
        SoundFx.playCursor();
        this.inputName = this.inputName.slice(0, -1);
        this.updateNameDisplay();
      }
    }, uiScale);

    const clearBtn = this.createSmallButton(smBtnOffset, row1Y, 'CLEAR', 0x747d8c, () => {
      SoundFx.playCursor();
      this.inputName = '';
      this.updateNameDisplay();
    }, uiScale);

    // Row 2: SAVE and CANCEL buttons
    const row2Y = Math.round(78 * uiScale);
    const lgBtnW = Math.round(118 * uiScale);
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

    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }

    this.keydownHandler = (e: KeyboardEvent) => {
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

    window.addEventListener('keydown', this.keydownHandler);
  }

  private closeNameModal(): void {
    SoundFx.playCancel();
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
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
      if (!this.scene || !this.scene.isActive()) return;

      if (res && res.success) {
        SoundFx.playMatch();
        this.closeNameModal();
        this.loadLeaderboardData();
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

  private createSmallButton(
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

    return CuteUI.createPillButton(this, x, y, text, callback, {
      textureKey: texture,
      fontSize: `${Math.round(10.5 * uiScale)}px`,
      width: Math.round(78 * uiScale),
      height: Math.round(28 * uiScale),
      autoScale: false
    });
  }

  private handleGamepadInput(delta: number): void {
    const pad = this.getActiveGamepad();
    if (!pad) return;

    const isLeft = pad.left || pad.isButtonDown(14);
    const isRight = pad.right || pad.isButtonDown(15);

    if (isLeft || isRight) {
      if (this.padRepeatTimer <= 0) {
        this.cycleDifficulty(isLeft ? -1 : 1);
        this.padRepeatTimer = 250;
      } else {
        this.padRepeatTimer -= delta;
      }
    } else {
      this.padRepeatTimer = 0;
    }

    // Y or X toggles mode
    const yDown = pad.Y || pad.isButtonDown(3) || pad.X || pad.isButtonDown(2);
    const prevY = this.prevPadButtons.get(3) || false;
    if (yDown && !prevY) {
      this.setMode(this.selectedMode === 'endless' ? 'challenge' : 'endless');
    }
    this.prevPadButtons.set(3, yDown);

    // B button returns to previous scene
    const bDown = pad.B || pad.isButtonDown(1);
    const prevB = this.prevPadButtons.get(1) || false;
    if (bDown && !prevB) {
      SoundFx.playCursor();
      this.scene.start(this.returnScene);
    }
    this.prevPadButtons.set(1, bDown);
  }

  private getActiveGamepad(): Phaser.Input.Gamepad.Gamepad | null {
    if (this.input.gamepad && this.input.gamepad.total > 0) {
      for (let i = 0; i < this.input.gamepad.gamepads.length; i++) {
        const pad = this.input.gamepad.gamepads[i];
        if (pad && pad.connected) return pad;
      }
    }
    return null;
  }
}
