import Phaser from 'phaser';
import Board, { MatchEvent } from '../objects/Board';
import Cursor from '../objects/Cursor';
import AIBot, { AIDifficulty } from '../objects/AIBot';
import SocketManager, { GameAction } from '../net/SocketManager';
import {
  BOARD_WIDTH,
  BOARD_VISIBLE_HEIGHT,
  PANEL_SIZE,
  CHARACTERS
} from '../utils/Constants';
import { SoundFx } from '../utils/SoundFx';
import { CuteUI } from '../utils/CuteUI';
import { Settings, KeyBindings } from '../utils/Settings';

export default class GameScene extends Phaser.Scene {
  public gameMode: 'vs_cpu' | 'endless' | 'vs_online' | 'challenge' = 'challenge';
  public characterId: string = 'kiri';
  public opponentCharacterId: string = 'mizu';
  public defeatedOpponents: string[] = [];

  // Player 1
  private playerBoard!: Board;
  private playerCursor!: Cursor;
  private playerScore: number = 0;
  private playerScoreText!: Phaser.GameObjects.Text;
  private playerChainText!: Phaser.GameObjects.Text;
  private playerBorder!: Phaser.GameObjects.Graphics;
  private playerAvatar?: Phaser.GameObjects.Image;
  private playerMascot?: Phaser.GameObjects.Image;
  private playerWoodFrame?: Phaser.GameObjects.Image;
  private playerSpeechBubble?: Phaser.GameObjects.Text;
  private playerDangerText?: Phaser.GameObjects.Text;

  // Opponent (CPU or Online)
  private cpuBoard?: Board;
  private cpuCursor?: Cursor;
  private cpuBot?: AIBot;
  private cpuScore: number = 0;
  private cpuScoreText?: Phaser.GameObjects.Text;
  private cpuChainText?: Phaser.GameObjects.Text;
  private cpuBorder?: Phaser.GameObjects.Graphics;
  private cpuAvatar?: Phaser.GameObjects.Image;
  private cpuMascot?: Phaser.GameObjects.Image;
  private cpuWoodFrame?: Phaser.GameObjects.Image;
  private cpuSpeechBubble?: Phaser.GameObjects.Text;
  private cpuDangerText?: Phaser.GameObjects.Text;

  private boardP1X: number = 24;
  private boardP2X: number = 296;
  private boardY: number = 88;

  private socketMgr?: SocketManager;
  private gameTime: number = 180;
  private timeText!: Phaser.GameObjects.Text;
  private timerEvent!: Phaser.Time.TimerEvent;
  private isMatchOver: boolean = false;
  private isPaused: boolean = false;
  private pauseModalContainer?: Phaser.GameObjects.Container;
  private pauseModalIndex: number = 0;
  private pauseButtons: Phaser.GameObjects.Container[] = [];
  private pauseActions: (() => void)[] = [];

  // Gamepad State (DAS Repeat & Button Tracking)
  private padMoveTimer: number = 0;
  private padLastDir: 'up' | 'down' | 'left' | 'right' | null = null;
  private padPrevButtons: Map<number, boolean> = new Map();
  private pausePadRepeatTimer: number = 0;
  private keydownHandler?: (e: KeyboardEvent) => void;
  private keyupHandler?: (e: KeyboardEvent) => void;

  // Touch & Mobile Gesture State
  private boardScale: number = 1.0;
  private twoFingerLifting: boolean = false;
  private touchBoardActive: boolean = false;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartGridX: number = 0;
  private touchStartGridY: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: any): void {
    this.gameMode = data?.mode || 'challenge';
    this.characterId = data?.characterId || 'kiri';
    this.defeatedOpponents = data?.defeatedOpponents || [];

    if (data?.opponentCharacterId) {
      this.opponentCharacterId = data.opponentCharacterId;
    } else if (this.gameMode === 'vs_online') {
      this.opponentCharacterId = 'mizu';
      this.socketMgr = SocketManager.getInstance();
    } else {
      const otherChars = CHARACTERS.filter((c) => c.id !== this.characterId);
      this.opponentCharacterId = otherChars[Math.floor(Math.random() * otherChars.length)].id;
    }

    this.playerScore = 0;
    this.cpuScore = 0;
    this.gameTime = 180;
    this.isMatchOver = false;
  }

  create(): void {
    if (this.cache.audio.exists('battle_cpu')) {
      this.sound.stopAll();
      this.sound.play('battle_cpu', { loop: true, volume: Settings.musicVolume });
    }

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Slowly drifting cute pastel pattern background
    CuteUI.createCuteBackground(this, this.gameMode === 'challenge' ? 'autumn' : 'meadow');

    // Support multi-touch (e.g. 2-finger lift on mobile/tablet)
    this.input.addPointer(2);

    if (this.gameMode === 'endless') {
      this.setupEndlessMode();
    } else {
      this.setupBattleMode();
    }

    // Common countdown timer
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    });

    // Setup player keyboard & touch controls
    this.setupControls();
    this.setupTouchControls();
  }

  /** Setup 2-Board Layout for VS CPU and VS Online */
  private setupBattleMode(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Responsive board scaling for mobile/desktop
    const availableW = width - 36;
    const scaleByW = Math.min(1.2, Math.max(0.9, Math.floor((availableW / (2 * BOARD_WIDTH * PANEL_SIZE + 20)) * 100) / 100));
    const availableH = height - 150;
    const scaleByH = Math.min(1.2, Math.max(0.9, Math.floor((availableH / (BOARD_VISIBLE_HEIGHT * PANEL_SIZE)) * 100) / 100));
    this.boardScale = Math.min(scaleByW, scaleByH);

    const boardW = Math.round(BOARD_WIDTH * PANEL_SIZE * this.boardScale);
    const boardH = Math.round(BOARD_VISIBLE_HEIGHT * PANEL_SIZE * this.boardScale);

    // Adaptive vertical positioning on mobile / tall screens
    const boardY = height > 550 ? Math.max(90, Math.round((height - boardH - 100) * 0.38)) : 88;

    const centerX = width / 2;
    const boardGap = Math.min(50, Math.max(14, width - boardW * 2 - 24));
    const p1X = Math.round(centerX - boardW - boardGap / 2);
    const p2X = Math.round(centerX + boardGap / 2);

    this.boardP1X = p1X;
    this.boardP2X = p2X;
    this.boardY = boardY;

    // Center Timer Sign between boards (Hanging Wood Plaque with Clock Icon)
    const timerContainer = this.add.container(centerX, boardY + Math.round(boardH * 0.28));
    timerContainer.setDepth(30);

    const timerPlaque = this.add.image(0, 0, 'wood_plaque_sign');
    timerPlaque.setDisplaySize(Math.min(boardGap + 44, 114), 38);

    const clockIcon = this.add.image(-28, 0, 'wood_clock_icon');
    clockIcon.setDisplaySize(20, 20);

    this.timeText = this.add.text(12, -1, this.formatTime(this.gameTime), {
      fontSize: '15px',
      color: '#fff3c4',
      fontStyle: 'bold',
      stroke: '#3e2415',
      strokeThickness: 3
    }).setOrigin(0.5);

    timerContainer.add([timerPlaque, clockIcon, this.timeText]);

    // Setup Player 1 (Left)
    this.playerBorder = this.add.graphics();
    this.drawBoardFrame(this.playerBorder, p1X, boardY, boardW, boardH, 0xff69b4, true);
    this.playerBoard = new Board(this, p1X, boardY, this.boardScale);
    this.playerBoard.addInitialPanels(5);
    this.playerCursor = new Cursor(this, this.playerBoard);

    const p1Char = CHARACTERS.find((c) => c.id === this.characterId) || CHARACTERS[0];

    // Player 1 Header Wooden Plaque
    const p1PlaqueW = Math.min(boardW - 6, 210);
    const p1Header = this.add.container(p1X + boardW / 2, boardY - 32);
    p1Header.setDepth(24);
    const p1Sign = this.add.image(0, 0, 'wood_plaque_sign');
    p1Sign.setDisplaySize(p1PlaqueW, 38);

    const p1Badge = CuteUI.createPillButton(this, -p1PlaqueW / 2 + 24, 0, 'P1', () => {}, {
      textureKey: 'pill_pink',
      fontSize: '11px',
      width: 36,
      height: 22,
      shadow: false
    });

    const p1NameText = this.add.text(-p1PlaqueW / 2 + 48, -7, p1Char.name, {
      fontSize: '12px',
      color: '#fff3c4',
      fontStyle: 'bold',
      stroke: '#3e2415',
      strokeThickness: 3
    });

    this.playerScoreText = this.add.text(-p1PlaqueW / 2 + 48, 6, 'SCORE: 0', {
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#3e2415',
      strokeThickness: 2
    });

    p1Header.add([p1Sign, p1Badge, p1NameText, this.playerScoreText]);

    this.playerChainText = this.add
      .text(p1X + boardW / 2, boardY + boardH + 16, '', {
        fontSize: '17px',
        color: '#ff9f43',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5);

    this.playerDangerText = this.add
      .text(p1X + boardW / 2, boardY - 50, '', {
        fontSize: '12px',
        color: '#ff4757',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5);

    // Setup Opponent (Right)
    const p2Label = this.gameMode === 'vs_online' ? 'P2' : 'CPU';
    const p2Color = 0x54a0ff;
    this.cpuBorder = this.add.graphics();
    this.drawBoardFrame(this.cpuBorder, p2X, boardY, boardW, boardH, p2Color, false);
    this.cpuBoard = new Board(this, p2X, boardY, this.boardScale);
    this.cpuBoard.addInitialPanels(5);
    this.cpuCursor = new Cursor(this, this.cpuBoard);
    this.cpuCursor.setStrokeStyle(3 * this.boardScale, p2Color);

    this.cpuDangerText = this.add
      .text(p2X + boardW / 2, boardY - 50, '', {
        fontSize: '12px',
        color: '#ff4757',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5);

    if (this.gameMode === 'vs_cpu' || this.gameMode === 'challenge') {
      this.cpuBot = new AIBot(
        this.cpuBoard,
        this.cpuCursor,
        AIDifficulty.NORMAL,
        this.opponentCharacterId,
        this.playerBoard
      );
    }

    const p2Char = CHARACTERS.find((c) => c.id === this.opponentCharacterId) || CHARACTERS[1];

    // CPU / Opponent Header Wooden Plaque
    const p2PlaqueW = Math.min(boardW - 6, 210);
    const p2Header = this.add.container(p2X + boardW / 2, boardY - 32);
    p2Header.setDepth(24);
    const p2Sign = this.add.image(0, 0, 'wood_plaque_sign');
    p2Sign.setDisplaySize(p2PlaqueW, 38);

    const p2Badge = CuteUI.createPillButton(this, -p2PlaqueW / 2 + 26, 0, p2Label, () => {}, {
      textureKey: 'pill_blue',
      fontSize: '11px',
      width: 40,
      height: 22,
      shadow: false
    });

    const p2NameText = this.add.text(-p2PlaqueW / 2 + 52, -7, p2Char.name, {
      fontSize: '12px',
      color: '#fff3c4',
      fontStyle: 'bold',
      stroke: '#3e2415',
      strokeThickness: 3
    });

    this.cpuScoreText = this.add.text(-p2PlaqueW / 2 + 52, 6, 'SCORE: 0', {
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#3e2415',
      strokeThickness: 2
    });

    p2Header.add([p2Sign, p2Badge, p2NameText, this.cpuScoreText]);

    this.cpuChainText = this.add
      .text(p2X + boardW / 2, boardY + boardH + 16, '', {
        fontSize: '17px',
        color: '#54a0ff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5);

    // Full-Body Mascot Characters Standing on the Meadow (Storybook Animal Crossing / Ghibli Style)
    const charH = Math.round(180 * Math.min(1.15, this.boardScale));
    const charW = charH;
    const isMobilePortrait = height > 600 && width <= 540;

    let p1CharX: number;
    let p1CharY: number;
    let cpuCharX: number;
    let cpuCharY: number;

    if (isMobilePortrait) {
      p1CharX = Math.round(p1X + 44);
      p1CharY = Math.round(boardY + boardH + 105);
      cpuCharX = Math.round(p2X + boardW - 44);
      cpuCharY = Math.round(boardY + boardH + 105);
    } else {
      p1CharX = Math.max(70, Math.round(p1X - 75));
      p1CharY = Math.round(boardY + boardH - 45);
      cpuCharX = Math.min(width - 70, Math.round(p2X + boardW + 75));
      cpuCharY = Math.round(boardY + boardH - 45);
    }

    // Ground Contact Shadows
    const shadowG = this.add.graphics();
    shadowG.fillStyle(0x1a3311, 0.38);
    shadowG.fillEllipse(p1CharX, p1CharY + charH * 0.42, charW * 0.48, 14);
    shadowG.fillEllipse(cpuCharX, cpuCharY + charH * 0.42, charW * 0.48, 14);
    shadowG.setDepth(14);

    // Player 1 Mascot
    this.playerMascot = this.add.image(p1CharX, p1CharY, p1Char.id);
    this.playerMascot.setDisplaySize(charW, charH);
    this.playerMascot.setDepth(15);
    this.tweens.add({
      targets: this.playerMascot,
      y: p1CharY - 5,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Opponent Mascot (facing inwards towards battle)
    this.cpuMascot = this.add.image(cpuCharX, cpuCharY, p2Char.id);
    this.cpuMascot.setDisplaySize(charW, charH);
    this.cpuMascot.setFlipX(true);
    this.cpuMascot.setDepth(15);
    this.tweens.add({
      targets: this.cpuMascot,
      y: cpuCharY - 5,
      duration: 1350,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Wire Player Events
    this.playerBoard.on('stackRise', (e: { offset: number }) => this.playerCursor.setStackOffset(e.offset));
    this.playerBoard.on('rowShift', (e: { offset: number }) => this.playerCursor.shiftWithStack(e?.offset));
    this.playerBoard.on('match', (e: MatchEvent) => this.handlePlayerMatch(e));
    this.playerBoard.on('panelPop', (e: { x: number; y: number; color: number }) => {
      this.spawnPopParticles(p1X + (e.x * PANEL_SIZE + PANEL_SIZE / 2) * this.boardScale, boardY + (e.y * PANEL_SIZE - this.playerBoard.stackOffsetPixels + PANEL_SIZE / 2) * this.boardScale, e.color);
    });
    this.playerBoard.on('chainEnd', () => this.playerChainText.setText(''));
    this.playerBoard.on('dangerStart', () => {
      this.triggerAvatarHurt(true);
      this.updateDangerUI(true, true, 6.5);
    });
    this.playerBoard.on('dangerPulse', (e: { remainingMs: number }) => {
      this.updateDangerUI(true, true, e.remainingMs / 1000);
    });
    this.playerBoard.on('dangerEnd', () => {
      this.updateDangerUI(true, false);
    });
    this.playerBoard.on('topOut', () => {
      if (this.gameMode === 'vs_online' && this.socketMgr) {
        this.socketMgr.sendAction({ type: 'topOut' });
      }
      this.endMatch('DEFEAT!', false);
    });

    // Wire CPU Events
    if ((this.gameMode === 'vs_cpu' || this.gameMode === 'challenge') && this.cpuBoard) {
      this.cpuBoard.on('stackRise', (e: { offset: number }) => this.cpuCursor?.setStackOffset(e.offset));
      this.cpuBoard.on('rowShift', (e: { offset: number }) => this.cpuCursor?.shiftWithStack(e?.offset));
      this.cpuBoard.on('match', (e: MatchEvent) => this.handleCpuMatch(e));
      this.cpuBoard.on('panelPop', (e: { x: number; y: number; color: number }) => {
        this.spawnPopParticles(p2X + (e.x * PANEL_SIZE + PANEL_SIZE / 2) * this.boardScale, boardY + (e.y * PANEL_SIZE - this.cpuBoard!.stackOffsetPixels + PANEL_SIZE / 2) * this.boardScale, e.color);
      });
      this.cpuBoard.on('chainEnd', () => this.cpuChainText?.setText(''));
      this.cpuBoard.on('dangerStart', () => {
        this.triggerAvatarHurt(false);
        this.updateDangerUI(false, true, 6.5);
      });
      this.cpuBoard.on('dangerPulse', (e: { remainingMs: number }) => {
        this.updateDangerUI(false, true, e.remainingMs / 1000);
      });
      this.cpuBoard.on('dangerEnd', () => {
        this.updateDangerUI(false, false);
      });
      this.cpuBoard.on('topOut', () => this.endMatch('VICTORY!', true));
    }

    // Wire Online Network Events
    if (this.gameMode === 'vs_online' && this.socketMgr) {
      this.socketMgr.onOpponentAction((action: GameAction) => {
        if (action.type === 'attack') {
          this.playerBoard.queueGarbage(action.payload.width, action.payload.height);
          this.showAttackAlert(false, action.payload.height);
          this.triggerAvatarAttack(false);
          this.triggerAvatarHurt(true);
          this.cameras.main.shake(120, 0.005);
        } else if (action.type === 'topOut') {
          this.endMatch('VICTORY!', true);
        }
      });

      this.socketMgr.onOpponentDisconnected(() => {
        this.endMatch('OPPONENT LEFT - YOU WIN!', true);
      });
    }
  }

  /** Setup Single Centered Board for Endless / Solo */
  private setupEndlessMode(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Single-board scaling: can expand significantly on mobile portrait & desktop
    const availableW = width - 40;
    const scaleByW = Math.min(1.45, Math.max(1.0, Math.floor((availableW / (BOARD_WIDTH * PANEL_SIZE)) * 100) / 100));
    const availableH = height - 160;
    const scaleByH = Math.min(1.45, Math.max(1.0, Math.floor((availableH / (BOARD_VISIBLE_HEIGHT * PANEL_SIZE)) * 100) / 100));
    this.boardScale = Math.min(scaleByW, scaleByH);

    const boardW = Math.round(BOARD_WIDTH * PANEL_SIZE * this.boardScale);
    const boardH = Math.round(BOARD_VISIBLE_HEIGHT * PANEL_SIZE * this.boardScale);
    const boardX = Math.round((width - boardW) / 2);
    const boardY = height > 550 ? Math.max(88, Math.round((height - boardH - 100) * 0.38)) : 88;
    this.boardP1X = boardX;
    this.boardY = boardY;

    this.playerBorder = this.add.graphics();
    this.drawBoardFrame(this.playerBorder, boardX, boardY, boardW, boardH, 0xff69b4, true);

    this.playerBoard = new Board(this, boardX, boardY, this.boardScale);
    this.playerBoard.addInitialPanels(6);
    this.playerCursor = new Cursor(this, this.playerBoard);

    const charData = CHARACTERS.find((c) => c.id === this.characterId) || CHARACTERS[0];

    // Wooden Header Plaque above board
    const plaqueW = Math.min(boardW - 6, 260);
    const header = this.add.container(boardX + boardW / 2, boardY - 34);
    header.setDepth(24);

    const sign = this.add.image(0, 0, 'wood_plaque_sign');
    sign.setDisplaySize(plaqueW, 40);

    const charBadge = CuteUI.createPillButton(this, -plaqueW / 2 + 30, 0, charData.name.toUpperCase(), () => {}, {
      textureKey: 'pill_pink',
      fontSize: '11px',
      width: 76,
      height: 24,
      shadow: false
    });

    this.playerScoreText = this.add.text(-plaqueW / 2 + 76, -8, 'SCORE: 0', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#3e2415',
      strokeThickness: 2
    });

    const clockIcon = this.add.image(plaqueW / 2 - 76, 0, 'wood_clock_icon');
    clockIcon.setDisplaySize(18, 18);

    this.timeText = this.add.text(plaqueW / 2 - 38, -1, this.formatTime(this.gameTime), {
      fontSize: '13px',
      color: '#fff3c4',
      fontStyle: 'bold',
      stroke: '#3e2415',
      strokeThickness: 2
    }).setOrigin(0.5);

    header.add([sign, charBadge, this.playerScoreText, clockIcon, this.timeText]);

    this.playerChainText = this.add
      .text(boardX + boardW / 2, boardY + boardH + 18, '', {
        fontSize: '20px',
        color: '#ff9f43',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5);

    this.playerDangerText = this.add
      .text(boardX + boardW / 2, boardY - 50, '', {
        fontSize: '12px',
        color: '#ff4757',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5);

    // Full-Body Mascot Standing on the Meadow (matching Reference 2)
    const charH = Math.round(200 * Math.min(1.2, this.boardScale));
    const charW = charH;
    const isMobilePortrait = height > 600 && width <= 540;

    let mascotX: number;
    let mascotY: number;

    if (isMobilePortrait) {
      mascotX = Math.round(width / 2 + boardW * 0.32);
      mascotY = Math.round(boardY + boardH + 90);
    } else {
      mascotX = Math.min(width - 90, Math.round(boardX + boardW + 105));
      mascotY = Math.round(boardY + boardH - 60);
    }

    const shadowG = this.add.graphics();
    shadowG.fillStyle(0x1a3311, 0.38);
    shadowG.fillEllipse(mascotX, mascotY + charH * 0.42, charW * 0.48, 15);
    shadowG.setDepth(14);

    this.playerMascot = this.add.image(mascotX, mascotY, charData.id);
    this.playerMascot.setDisplaySize(charW, charH);
    this.playerMascot.setDepth(15);
    this.tweens.add({
      targets: this.playerMascot,
      y: mascotY - 6,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.playerBoard.on('stackRise', (e: { offset: number }) => this.playerCursor.setStackOffset(e.offset));
    this.playerBoard.on('rowShift', (e: { offset: number }) => this.playerCursor.shiftWithStack(e?.offset));
    this.playerBoard.on('match', (e: MatchEvent) => this.handlePlayerMatch(e));
    this.playerBoard.on('panelPop', (e: { x: number; y: number; color: number }) => {
      this.spawnPopParticles(boardX + (e.x * PANEL_SIZE + PANEL_SIZE / 2) * this.boardScale, boardY + (e.y * PANEL_SIZE - this.playerBoard.stackOffsetPixels + PANEL_SIZE / 2) * this.boardScale, e.color);
    });
    this.playerBoard.on('chainEnd', () => this.playerChainText.setText(''));
    this.playerBoard.on('dangerStart', () => {
      this.triggerAvatarHurt(true);
      this.updateDangerUI(true, true, 6.5);
    });
    this.playerBoard.on('dangerPulse', (e: { remainingMs: number }) => {
      this.updateDangerUI(true, true, e.remainingMs / 1000);
    });
    this.playerBoard.on('dangerEnd', () => {
      this.updateDangerUI(true, false);
    });
    this.playerBoard.on('topOut', () => this.endMatch('TOP OUT!', false));

    // Periodic arcade garbage challenge in Endless mode
    this.time.addEvent({
      delay: 22000,
      callback: () => {
        if (!this.isMatchOver && !this.playerBoard.isDanger && !this.playerBoard.isTopOut) {
          const width = Math.random() < 0.6 ? 3 : 6;
          this.playerBoard.queueGarbage(width, 1);
          this.showAttackAlert(false, 1);
          this.triggerAvatarHurt(true);
          this.cameras.main.shake(120, 0.005);
        }
      },
      loop: true
    });
  }

  private drawBoardFrame(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    borderColor: number,
    isPlayer: boolean = true
  ): void {
    g.clear();

    // 1. Dark warm wood backdrop behind board grid
    const backdropKey = isPlayer ? 'p1_wood_backdrop' : 'cpu_wood_backdrop';
    if (!this.children.getByName(backdropKey) && this.textures.exists('board_wood_backdrop')) {
      const backdrop = this.add.image(x, y, 'board_wood_backdrop');
      backdrop.setName(backdropKey);
      backdrop.setOrigin(0, 0);
      backdrop.setDisplaySize(w, h);
      backdrop.setDepth(2);
    }

    // 2. High-res carved timber frame with leaves and flowers on top
    const frameKey = isPlayer ? 'p1_wood_frame' : 'cpu_wood_frame';
    let frameImg = this.children.getByName(frameKey) as Phaser.GameObjects.Image;
    if (!frameImg && this.textures.exists('board_wood_frame')) {
      // board_wood_frame_6x10 is 1069x1464 with inner opening 600x1000 at (233, 231)
      const frameScale = w / 600;
      const frameX = x - 233 * frameScale;
      const frameY = y - 231 * frameScale;

      frameImg = this.add.image(frameX, frameY, 'board_wood_frame');
      frameImg.setName(frameKey);
      frameImg.setOrigin(0, 0);
      frameImg.setScale(frameScale);
      frameImg.setDepth(22); // Above panels, below cursor (cursor is 25)

      if (isPlayer) this.playerWoodFrame = frameImg;
      else this.cpuWoodFrame = frameImg;

      // Cute mini slimes peeking over the top beam of the wooden board
      const pColor1 = isPlayer ? 'panel_2' : 'panel_0';
      const pColor2 = isPlayer ? 'panel_3' : 'panel_1';
      const peek1 = this.add.image(x + w * 0.28, y - 6 * this.boardScale, pColor1);
      peek1.setDisplaySize(18 * this.boardScale, 18 * this.boardScale);
      peek1.setDepth(23);
      const peek2 = this.add.image(x + w * 0.72, y - 6 * this.boardScale, pColor2);
      peek2.setDisplaySize(18 * this.boardScale, 18 * this.boardScale);
      peek2.setDepth(23);
    }

    // 3. Danger border indicator
    const isDanger = borderColor === 0xff4757;
    if (isDanger) {
      g.lineStyle(3.5, 0xff4757, 0.95);
      g.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, 6);
      if (frameImg) frameImg.setTint(0xff7675);
    } else {
      if (frameImg) frameImg.clearTint();
    }
  }

  /** Update danger UI, banner countdown text, and board border color */
  private updateDangerUI(isPlayer: boolean, inDanger: boolean, secondsRemaining: number = 6.5): void {
    const textObj = isPlayer ? this.playerDangerText : this.cpuDangerText;
    const borderObj = isPlayer ? this.playerBorder : this.cpuBorder;
    const defaultColor = isPlayer ? 0xff69b4 : 0x54a0ff;
    const boardW = Math.round(BOARD_WIDTH * PANEL_SIZE * this.boardScale);
    const boardH = Math.round(BOARD_VISIBLE_HEIGHT * PANEL_SIZE * this.boardScale);
    const boardX = isPlayer ? this.boardP1X : this.boardP2X;
    const boardY = this.boardY;

    if (!borderObj) return;

    if (inDanger) {
      this.drawBoardFrame(borderObj, boardX, boardY, boardW, boardH, 0xff4757, isPlayer);
      if (textObj) {
        textObj.setText(`! DANGER: ${secondsRemaining.toFixed(1)}s !`);
        textObj.setColor(secondsRemaining < 2.5 ? '#ff3838' : '#ff9f43');
      }
    } else {
      this.drawBoardFrame(borderObj, boardX, boardY, boardW, boardH, defaultColor, isPlayer);
      if (textObj) {
        textObj.setText('');
      }
    }
  }

  private matchesAction(event: KeyboardEvent, action: keyof KeyBindings, defaultCodes: string[]): boolean {
    const customKey = Settings.keyBindings[action]?.toUpperCase();
    let pressed = event.key.toUpperCase();
    if (event.code.startsWith('Key')) pressed = event.code.replace('Key', '').toUpperCase();
    else if (event.code.startsWith('Digit')) pressed = event.code.replace('Digit', '');
    else if (event.code === 'ArrowUp') pressed = 'UP';
    else if (event.code === 'ArrowDown') pressed = 'DOWN';
    else if (event.code === 'ArrowLeft') pressed = 'LEFT';
    else if (event.code === 'ArrowRight') pressed = 'RIGHT';
    else if (event.code === 'Space') pressed = 'SPACE';
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') pressed = 'SHIFT';
    else if (event.code === 'Escape') pressed = 'ESCAPE';
    else if (event.code === 'Enter') pressed = 'ENTER';

    if (customKey && (pressed === customKey || event.code.toUpperCase() === customKey)) return true;
    if (defaultCodes.includes(pressed) || defaultCodes.includes(event.code)) return true;
    return false;
  }

  private setupControls(): void {
    this.keydownHandler = (event: KeyboardEvent) => {
      // Pause handling
      if (this.matchesAction(event, 'pause', ['ESCAPE', 'Escape', 'Esc'])) {
        this.togglePause();
        return;
      }

      // If paused, keyboard navigates the pause menu
      if (this.isPaused) {
        if (event.key === 'ArrowUp' || event.code === 'KeyW') {
          this.navigatePauseMenu(-1);
        } else if (event.key === 'ArrowDown' || event.code === 'KeyS') {
          this.navigatePauseMenu(1);
        } else if (event.key === 'Enter' || event.code === 'Space') {
          this.selectPauseMenuOption();
        }
        return;
      }

      if (this.isMatchOver) return;

      // Gameplay cursor moves
      if (this.matchesAction(event, 'moveLeft', ['LEFT', 'A', 'ArrowLeft'])) {
        this.playerCursor.moveLeft();
      } else if (this.matchesAction(event, 'moveRight', ['RIGHT', 'D', 'ArrowRight'])) {
        this.playerCursor.moveRight();
      } else if (this.matchesAction(event, 'moveUp', ['UP', 'W', 'ArrowUp'])) {
        this.playerCursor.moveUp();
      } else if (this.matchesAction(event, 'moveDown', ['DOWN', 'S', 'ArrowDown'])) {
        this.playerCursor.moveDown();
      }

      // Swap
      if (this.matchesAction(event, 'swap', ['SPACE', 'X', 'C', ' '])) {
        this.playerBoard.swap(this.playerCursor.gridX, this.playerCursor.gridY);
      }

      // Lift (Keydown)
      if (this.matchesAction(event, 'lift', ['SHIFT', 'R', 'ShiftLeft', 'ShiftRight'])) {
        this.playerBoard.setLifting(true);
      }

      // Garbage Test Hotkeys
      if (event.code === 'KeyG') {
        this.playerBoard.queueGarbage(3, 1);
        this.showAttackAlert(false, 1);
        this.triggerAvatarHurt(true);
        this.cameras.main.shake(100, 0.004);
      } else if (event.code === 'KeyH') {
        this.playerBoard.queueGarbage(6, 1);
        this.showAttackAlert(false, 1);
        this.triggerAvatarHurt(true);
        this.cameras.main.shake(120, 0.005);
      } else if (event.code === 'KeyB') {
        this.playerBoard.queueGarbage(6, 2);
        this.showAttackAlert(false, 2);
        this.triggerAvatarHurt(true);
        this.cameras.main.shake(150, 0.007);
      } else if (event.code === 'KeyY' && this.cpuBoard) {
        this.cpuBoard.queueGarbage(3, 1);
        this.showAttackAlert(true, 1);
        this.triggerAvatarHurt(false);
      }
    };

    this.keyupHandler = (event: KeyboardEvent) => {
      if (this.matchesAction(event, 'lift', ['SHIFT', 'R', 'ShiftLeft', 'ShiftRight'])) {
        this.playerBoard.setLifting(false);
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);

    this.events.once('shutdown', () => {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.keyupHandler) window.removeEventListener('keyup', this.keyupHandler);
    });
  }

  /** Setup direct board gestures and mobile on-screen controls */
  private setupTouchControls(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 1. Mobile Pause Button (Top-Right)
    const pauseBtn = this.add.container(width - 24, 22);
    pauseBtn.setDepth(45);
    const pauseBg = this.add.graphics();
    pauseBg.fillStyle(0x1e272e, 0.85);
    pauseBg.fillCircle(0, 0, 16);
    pauseBg.lineStyle(1.8, 0xff69b4, 1);
    pauseBg.strokeCircle(0, 0, 16);

    const pauseIcon = this.add.text(0, -1, '⏸', {
      fontSize: '13px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const pauseHit = this.add.circle(0, 0, 22, 0x000000, 0);
    pauseHit.setInteractive({ useHandCursor: true });
    pauseHit.on('pointerdown', () => this.togglePause());
    pauseBtn.add([pauseBg, pauseIcon, pauseHit]);

    // 2. Direct Board Touch Gestures (Tap slime to swap, flick left/right to swap, flick up to pulse lift)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isMatchOver || this.isPaused) return;

      const bX = this.playerBoard.boardOffsetX;
      const bY = this.playerBoard.boardOffsetY;
      const bW = BOARD_WIDTH * PANEL_SIZE * this.boardScale;
      const bH = BOARD_VISIBLE_HEIGHT * PANEL_SIZE * this.boardScale;

      if (
        pointer.x >= bX &&
        pointer.x <= bX + bW &&
        pointer.y >= bY &&
        pointer.y <= bY + bH
      ) {
        const localX = (pointer.x - bX) / this.boardScale;
        const localY = (pointer.y - (bY - this.playerBoard.stackOffsetPixels * this.boardScale)) / this.boardScale;
        const gx = Math.floor(localX / PANEL_SIZE);
        const gy = Math.floor(localY / PANEL_SIZE);

        if (gx >= 0 && gx < BOARD_WIDTH && gy >= 0 && gy < BOARD_VISIBLE_HEIGHT) {
          this.touchBoardActive = true;
          this.touchStartX = pointer.x;
          this.touchStartY = pointer.y;
          this.touchStartGridX = gx;
          this.touchStartGridY = gy;
          // Position cursor directly at the touched pair
          const curX = Math.min(gx, BOARD_WIDTH - 2);
          this.playerCursor.setGridPosition(curX, gy);
        }
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.touchBoardActive || this.isMatchOver || this.isPaused) return;

      const dx = pointer.x - this.touchStartX;
      const dy = pointer.y - this.touchStartY;
      const threshold = 12 * this.boardScale;

      // Horizontal flick to swap
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          // Flick Right: swap column with right neighbor
          const swapCol = Math.min(this.touchStartGridX, BOARD_WIDTH - 2);
          this.playerCursor.setGridPosition(swapCol, this.touchStartGridY);
          this.playerBoard.swap(swapCol, this.touchStartGridY);
        } else {
          // Flick Left: swap column with left neighbor
          const swapCol = Math.max(0, this.touchStartGridX - 1);
          this.playerCursor.setGridPosition(swapCol, this.touchStartGridY);
          this.playerBoard.swap(swapCol, this.touchStartGridY);
        }
        this.touchBoardActive = false;
      } else if (dy < -22 * this.boardScale && Math.abs(dy) > Math.abs(dx)) {
        // Upward flick: quick fast-lift impulse
        this.playerBoard.setLifting(true);
        this.time.delayedCall(220, () => this.playerBoard.setLifting(false));
        this.touchBoardActive = false;
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.touchBoardActive && !this.isMatchOver && !this.isPaused) {
        const dist = Phaser.Math.Distance.Between(this.touchStartX, this.touchStartY, pointer.x, pointer.y);
        if (dist < 10) {
          // Direct slime tap: swap with neighbor
          const swapCol = Math.min(this.touchStartGridX, BOARD_WIDTH - 2);
          this.playerCursor.setGridPosition(swapCol, this.touchStartGridY);
          this.playerBoard.swap(swapCol, this.touchStartGridY);
        }
      }
      this.touchBoardActive = false;
    });

    // 3. Sleek Mobile Fast-Lift Bar anchored directly below player board
    const bW = Math.round(BOARD_WIDTH * PANEL_SIZE * this.boardScale);
    const bH = Math.round(BOARD_VISIBLE_HEIGHT * PANEL_SIZE * this.boardScale);
    const liftBarW = Math.min(bW, 260);
    const liftBarX = this.boardP1X + bW / 2;
    const liftBarY = Math.min(height - 48, this.boardY + bH + 42);

    this.createMobileLiftBar(liftBarX, liftBarY, liftBarW, 34);

    // Subtle touch control hint
    const hintY = Math.min(height - 14, liftBarY + 28);
    this.add.text(width / 2, hintY, 'TAP / FLICK SLIME: Swap • 2 FINGERS / BAR: Lift', {
      fontSize: '10px',
      color: '#a4b0be',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(0.5).setDepth(35);
  }

  private createMobileLiftBar(x: number, y: number, w: number, h: number = 34): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(35);

    const bg = this.add.graphics();
    const draw = (active: boolean) => {
      bg.clear();
      bg.fillStyle(active ? 0x10ac84 : 0x1e272e, 0.88);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      bg.lineStyle(1.8, active ? 0x2ed573 : 0x54a0ff, 0.85);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
      // Subtle top highlight
      bg.fillStyle(0xffffff, active ? 0.25 : 0.12);
      bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, Math.round(h / 2) - 3, 4);
    };
    draw(false);

    const text = this.add.text(0, -1, '▲  HOLD TO FAST LIFT  ▲', {
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, w + 16, h + 10, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });

    hit.on('pointerdown', () => {
      draw(true);
      this.playerBoard.setLifting(true);
    });

    const stopLift = () => {
      draw(false);
      this.playerBoard.setLifting(false);
    };

    hit.on('pointerup', stopLift);
    hit.on('pointerout', stopLift);

    container.add([bg, text, hit]);
    return container;
  }

  private togglePause(): void {
    if (this.isMatchOver) return;
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  private pauseGame(): void {
    this.isPaused = true;
    SoundFx.playCursor();

    if (!this.pauseModalContainer) {
      const width = this.cameras.main.width;
      const height = this.cameras.main.height;

      this.pauseModalContainer = this.add.container(width / 2, height / 2);
      this.pauseModalContainer.setDepth(100);

      // Dark backdrop
      const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.75);
      backdrop.setInteractive();

      // Card box
      const box = this.add.graphics();
      box.fillStyle(0x1a1230, 0.98);
      box.fillRoundedRect(-140, -130, 280, 260, 16);
      box.lineStyle(2.5, 0xff69b4, 1);
      box.strokeRoundedRect(-140, -130, 280, 260, 16);

      const title = this.add.text(0, -95, 'GAME PAUSED', {
        fontSize: '22px',
        color: '#ff69b4',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5);

      const resumeBtn = CuteUI.createPillButton(this, 0, -45, 'RESUME', () => {
        this.resumeGame();
      }, { textureKey: 'pill_green', fontSize: '14px', width: 170, height: 36 });

      const optionsBtn = CuteUI.createPillButton(this, 0, 0, '⚙️ OPTIONS', () => {
        this.resumeGame();
        this.scene.start('OptionsMenuScene', { returnScene: 'GameScene' });
      }, { textureKey: 'pill_purple', fontSize: '14px', width: 170, height: 36 });

      const restartBtn = CuteUI.createPillButton(this, 0, 45, 'RESTART', () => {
        this.resumeGame();
        this.scene.restart();
      }, { textureKey: 'pill_blue', fontSize: '14px', width: 170, height: 36 });

      const menuBtn = CuteUI.createPillButton(this, 0, 90, 'MAIN MENU', () => {
        this.resumeGame();
        this.scene.start('MenuScene');
      }, { textureKey: 'pill_grey', fontSize: '14px', width: 170, height: 36 });

      this.pauseButtons = [resumeBtn, optionsBtn, restartBtn, menuBtn];
      this.pauseActions = [
        () => this.resumeGame(),
        () => {
          this.resumeGame();
          this.scene.start('OptionsMenuScene', { returnScene: 'GameScene' });
        },
        () => {
          this.resumeGame();
          this.scene.restart();
        },
        () => {
          this.resumeGame();
          this.scene.start('MenuScene');
        }
      ];

      this.pauseModalContainer.add([backdrop, box, title, resumeBtn, optionsBtn, restartBtn, menuBtn]);
    }

    this.pauseModalIndex = 0;
    this.updatePauseButtonSelection();
    this.pauseModalContainer.setVisible(true);
  }

  private navigatePauseMenu(delta: number): void {
    SoundFx.playCursor();
    this.pauseModalIndex = (this.pauseModalIndex + delta + this.pauseButtons.length) % this.pauseButtons.length;
    this.updatePauseButtonSelection();
  }

  private selectPauseMenuOption(): void {
    if (this.pauseActions[this.pauseModalIndex]) {
      this.pauseActions[this.pauseModalIndex]();
    }
  }

  private updatePauseButtonSelection(): void {
    this.pauseButtons.forEach((btn, idx) => {
      if (idx === this.pauseModalIndex) {
        btn.setScale(1.08);
      } else {
        btn.setScale(1.0);
      }
    });
  }

  private resumeGame(): void {
    this.isPaused = false;
    SoundFx.playCursor();
    if (this.pauseModalContainer) {
      this.pauseModalContainer.setVisible(false);
    }
  }

  /** Animate character avatar bounce and quote when attacking */
  private triggerAvatarAttack(isPlayer1: boolean): void {
    const avatar = isPlayer1 ? this.playerAvatar : this.cpuAvatar;
    if (avatar) {
      const originalY = avatar.y;
      const baseScaleX = avatar.scaleX;
      const baseScaleY = avatar.scaleY;

      this.tweens.add({
        targets: avatar,
        y: originalY - 12,
        scaleX: baseScaleX * 1.15,
        scaleY: baseScaleY * 1.15,
        duration: 120,
        yoyo: true,
        ease: 'Back.easeOut',
        onComplete: () => {
          avatar.y = originalY;
          avatar.setDisplaySize(42, 42);
        }
      });
    }

    const mascot = isPlayer1 ? this.playerMascot : this.cpuMascot;
    if (mascot) {
      this.tweens.add({
        targets: mascot,
        y: mascot.y - 20,
        duration: 160,
        yoyo: true,
        ease: 'Back.easeOut'
      });
    }

    const charId = isPlayer1 ? this.characterId : this.opponentCharacterId;
    const charData = CHARACTERS.find((c) => c.id === charId);
    if (charData && charData.quote) {
      this.showSpeechBubble(isPlayer1, charData.quote);
    }
  }

  /** Animate character avatar hurt/shake when under attack or danger */
  private triggerAvatarHurt(isPlayer1: boolean): void {
    const avatar = isPlayer1 ? this.playerAvatar : this.cpuAvatar;
    if (avatar) {
      const originalX = avatar.x;
      this.tweens.add({
        targets: avatar,
        x: originalX + 4,
        duration: 40,
        yoyo: true,
        repeat: 4,
        onComplete: () => {
          avatar.x = originalX;
        }
      });
      avatar.setTint(0xff4757);
      this.time.delayedCall(300, () => avatar.clearTint());
    }

    const mascot = isPlayer1 ? this.playerMascot : this.cpuMascot;
    if (mascot) {
      const origX = mascot.x;
      this.tweens.add({
        targets: mascot,
        x: origX + 6,
        duration: 40,
        yoyo: true,
        repeat: 5,
        onComplete: () => { mascot.x = origX; }
      });
      mascot.setTint(0xff7675);
      this.time.delayedCall(350, () => mascot.clearTint());
    }
  }

  /** Display speech bubble above character */
  private showSpeechBubble(isPlayer1: boolean, text: string): void {
    const x = isPlayer1 ? 64 : 448;
    const y = 20;

    const bubble = this.add.text(x, y, `"${text}"`, {
      fontSize: '11px',
      color: isPlayer1 ? '#ff9ff3' : '#54a0ff',
      fontStyle: 'bold italic',
      stroke: '#000000',
      strokeThickness: 3
    });
    bubble.setOrigin(isPlayer1 ? 0 : 1, 0.5);

    this.tweens.add({
      targets: bubble,
      y: y - 8,
      alpha: 0,
      duration: 1100,
      ease: 'Quad.easeOut',
      onComplete: () => bubble.destroy()
    });
  }

  /** Spawn star particles on slime clear */
  private spawnPopParticles(x: number, y: number, colorIndex: number): void {
    const colors = [0xff4757, 0x3742fa, 0x2ed573, 0xfffa65, 0xa55eea, 0x00d2d3];
    const particleColor = colors[colorIndex] || 0xffffff;

    for (let i = 0; i < 5; i++) {
      const star = this.add.image(x, y, 'sparkle_star');
      star.setDisplaySize(11, 11);
      star.setTint(particleColor);
      const angle = Math.random() * Math.PI * 2;
      const speed = 15 + Math.random() * 20;

      this.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 350 + Math.random() * 150,
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy()
      });
    }
  }

  private handlePlayerMatch(event: MatchEvent): void {
    this.playerScore += event.scoreGained;
    this.playerScoreText.setText(`SCORE: ${this.playerScore}`);

    if (this.playerMascot && (event.comboSize >= 4 || event.chainLevel > 1)) {
      this.tweens.add({
        targets: this.playerMascot,
        y: this.playerMascot.y - 18,
        duration: 160,
        yoyo: true,
        ease: 'Back.easeOut'
      });
    }

    if (event.chainLevel > 1) {
      this.playerChainText.setText(`CHAIN x${event.chainLevel}!`);
    }

    let garbageWidth = 0;
    let garbageHeight = 1;

    if (event.chainLevel > 1) {
      garbageWidth = BOARD_WIDTH;
      garbageHeight = Math.min(event.chainLevel - 1, 3);
    } else if (event.comboSize >= 4) {
      if (event.comboSize === 4) garbageWidth = 3;
      else if (event.comboSize === 5) garbageWidth = 4;
      else garbageWidth = BOARD_WIDTH;
    }

    if (garbageWidth > 0) {
      this.triggerAvatarAttack(true);
      if ((this.gameMode === 'vs_cpu' || this.gameMode === 'challenge') && this.cpuBoard) {
        this.cpuBoard.queueGarbage(garbageWidth, garbageHeight);
        this.showAttackAlert(true, garbageHeight);
        this.triggerAvatarHurt(false);
        this.cameras.main.shake(100, 0.004);
      } else if (this.gameMode === 'vs_online' && this.socketMgr) {
        this.socketMgr.sendAction({
          type: 'attack',
          payload: { width: garbageWidth, height: garbageHeight }
        });
        this.showAttackAlert(true, garbageHeight);
      }
    }
  }

  private handleCpuMatch(event: MatchEvent): void {
    this.cpuScore += event.scoreGained;
    if (this.cpuScoreText) {
      this.cpuScoreText.setText(`SCORE: ${this.cpuScore}`);
    }

    if (this.cpuMascot && (event.comboSize >= 4 || event.chainLevel > 1)) {
      this.tweens.add({
        targets: this.cpuMascot,
        y: this.cpuMascot.y - 18,
        duration: 160,
        yoyo: true,
        ease: 'Back.easeOut'
      });
    }

    if (event.chainLevel > 1 && this.cpuChainText) {
      this.cpuChainText.setText(`CHAIN x${event.chainLevel}!`);
    }

    let garbageWidth = 0;
    let garbageHeight = 1;

    if (event.chainLevel > 1) {
      garbageWidth = BOARD_WIDTH;
      garbageHeight = Math.min(event.chainLevel - 1, 3);
    } else if (event.comboSize >= 4) {
      if (event.comboSize === 4) garbageWidth = 3;
      else if (event.comboSize === 5) garbageWidth = 4;
      else garbageWidth = BOARD_WIDTH;
    }

    if (garbageWidth > 0) {
      this.playerBoard.queueGarbage(garbageWidth, garbageHeight);
      this.showAttackAlert(false, garbageHeight);
      this.triggerAvatarAttack(false);
      this.triggerAvatarHurt(true);
      this.cameras.main.shake(120, 0.005);
    }
  }

  private showAttackAlert(fromPlayer: boolean, height: number): void {
    const centerX = this.cameras.main.width / 2;
    const flyY = 160 + (fromPlayer ? 0 : 50);
    const attackText = this.add.text(
      centerX,
      flyY,
      fromPlayer ? `ATTACK! +${height} SLAB` : `INCOMING! +${height} SLAB`,
      {
        fontSize: '12px',
        color: fromPlayer ? '#ff69b4' : '#ff4757',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      }
    );
    attackText.setOrigin(0.5);

    this.tweens.add({
      targets: attackText,
      y: flyY - 25,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => attackText.destroy()
    });
  }

  private formatTime(secs: number): string {
    const m = Math.floor(Math.max(0, secs) / 60);
    const s = Math.max(0, secs) % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  private updateTimer(): void {
    if (this.isMatchOver || this.isPaused) return;
    this.gameTime--;
    this.timeText.setText(this.formatTime(this.gameTime));

    if (this.gameTime <= 0) {
      this.timerEvent.remove();
      const p1Wins = this.playerScore >= this.cpuScore;
      this.endMatch(p1Wins ? 'VICTORY!' : 'TIME UP!', p1Wins);
    }
  }

  public update(time: number, delta: number): void {
    this.handleGamepadInput(delta);

    if (this.isPaused) {
      this.handlePauseGamepad(delta);
      return;
    }

    if (this.isMatchOver) return;

    // Multi-touch two-finger lift (tablets / mobile devices)
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    const isTwoFinger = Boolean(p1?.isDown && p2?.isDown);
    if (isTwoFinger && !this.twoFingerLifting) {
      this.twoFingerLifting = true;
      this.playerBoard.setLifting(true);
    } else if (!isTwoFinger && this.twoFingerLifting) {
      this.twoFingerLifting = false;
      this.playerBoard.setLifting(false);
    }

    this.playerBoard.update(time, delta);
    this.playerCursor.updatePosition();

    if (this.cpuBoard && this.cpuBot) {
      this.cpuBoard.update(time, delta);
      this.cpuCursor?.updatePosition();
      this.cpuBot.update(delta);
    }
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

  private handleGamepadInput(delta: number): void {
    const pad = this.getActiveGamepad();
    if (!pad) return;

    // Start (btn 9) or Select (btn 8) toggles pause
    const pauseDown = pad.isButtonDown(9) || pad.isButtonDown(8);
    const prevPause = this.padPrevButtons.get(9) || false;
    if (pauseDown && !prevPause) {
      this.togglePause();
    }
    this.padPrevButtons.set(9, pauseDown);

    if (this.isPaused || this.isMatchOver) return;

    // Directional DAS repeat (D-pad & Left Stick)
    let dir: 'up' | 'down' | 'left' | 'right' | null = null;
    const stickX = pad.leftStick ? pad.leftStick.x : 0;
    const stickY = pad.leftStick ? pad.leftStick.y : 0;

    if (pad.left || pad.isButtonDown(14) || stickX < -0.45) {
      dir = 'left';
    } else if (pad.right || pad.isButtonDown(15) || stickX > 0.45) {
      dir = 'right';
    } else if (pad.up || pad.isButtonDown(12) || stickY < -0.45) {
      dir = 'up';
    } else if (pad.down || pad.isButtonDown(13) || stickY > 0.45) {
      dir = 'down';
    }

    if (dir) {
      if (this.padLastDir !== dir) {
        this.padLastDir = dir;
        this.executePadMove(dir);
        this.padMoveTimer = 160;
      } else {
        this.padMoveTimer -= delta;
        if (this.padMoveTimer <= 0) {
          this.executePadMove(dir);
          this.padMoveTimer = 75;
        }
      }
    } else {
      this.padLastDir = null;
      this.padMoveTimer = 0;
    }

    // Button 0 (A) or Button 2 (X) for SWAP
    const swapDown = pad.A || pad.X || pad.isButtonDown(0) || pad.isButtonDown(2);
    const prevSwap = this.padPrevButtons.get(0) || false;
    if (swapDown && !prevSwap) {
      this.playerBoard.swap(this.playerCursor.gridX, this.playerCursor.gridY);
    }
    this.padPrevButtons.set(0, swapDown);

    // Button 1 (B), Button 3 (Y), L1 (4), R1 (5), L2, R2 for FAST LIFT
    const liftDown = Boolean(
      pad.B || pad.Y || pad.L1 || pad.R1 ||
      pad.isButtonDown(1) || pad.isButtonDown(3) || pad.isButtonDown(4) || pad.isButtonDown(5) ||
      (pad.L2 > 0.3) || (pad.R2 > 0.3)
    );
    const prevLift = this.padPrevButtons.get(1) || false;

    if (liftDown && !prevLift) {
      this.playerBoard.setLifting(true);
    } else if (!liftDown && prevLift) {
      this.playerBoard.setLifting(false);
    }
    this.padPrevButtons.set(1, liftDown);
  }

  private executePadMove(dir: 'up' | 'down' | 'left' | 'right'): void {
    if (dir === 'left') this.playerCursor.moveLeft();
    else if (dir === 'right') this.playerCursor.moveRight();
    else if (dir === 'up') this.playerCursor.moveUp();
    else if (dir === 'down') this.playerCursor.moveDown();
  }

  private handlePauseGamepad(delta: number): void {
    const pad = this.getActiveGamepad();
    if (!pad) return;

    // Up / Down navigation in pause menu
    const stickY = pad.leftStick ? pad.leftStick.y : 0;
    const isUp = pad.up || pad.isButtonDown(12) || stickY < -0.45;
    const isDown = pad.down || pad.isButtonDown(13) || stickY > 0.45;

    if (isUp || isDown) {
      if (this.pausePadRepeatTimer <= 0) {
        if (isUp) this.navigatePauseMenu(-1);
        else if (isDown) this.navigatePauseMenu(1);
        this.pausePadRepeatTimer = 220;
      } else {
        this.pausePadRepeatTimer -= delta;
      }
    } else {
      this.pausePadRepeatTimer = 0;
    }

    // Button 0 (A) selects
    const selectDown = pad.A || pad.isButtonDown(0);
    const prevSelect = this.padPrevButtons.get(0) || false;
    if (selectDown && !prevSelect) {
      this.selectPauseMenuOption();
    }
    this.padPrevButtons.set(0, selectDown);

    // Button 1 (B) resumes
    const backDown = pad.B || pad.isButtonDown(1);
    const prevBack = this.padPrevButtons.get(1) || false;
    if (backDown && !prevBack) {
      this.resumeGame();
    }
    this.padPrevButtons.set(1, backDown);
  }

  private endMatch(bannerText: string, isVictory: boolean): void {
    this.isMatchOver = true;
    if (this.timerEvent) {
      this.timerEvent.remove();
    }

    if (isVictory) {
      SoundFx.playVictory();
      // Victory confetti!
      for (let i = 0; i < 28; i++) {
        const x = Math.random() * this.cameras.main.width;
        const y = -10 - Math.random() * 50;
        const star = this.add.image(x, y, 'sparkle_star');
        star.setDisplaySize(14, 14);
        star.setTint([0xfff200, 0xff69b4, 0x00d2d3, 0x2ed573, 0xff9f43][Math.floor(Math.random() * 5)]);

        this.tweens.add({
          targets: star,
          y: this.cameras.main.height + 20,
          x: x + (Math.random() - 0.5) * 80,
          rotation: Math.PI * 4,
          duration: 1600 + Math.random() * 1200,
          ease: 'Sine.easeIn',
          onComplete: () => star.destroy()
        });
      }
    } else {
      SoundFx.playTopOut();
    }

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    if (this.gameMode === 'challenge' && isVictory) {
      if (!this.defeatedOpponents.includes(this.opponentCharacterId)) {
        this.defeatedOpponents.push(this.opponentCharacterId);
      }
    }

    const isChampion = this.gameMode === 'challenge' && this.defeatedOpponents.length >= 7;
    const finalBanner = isChampion ? 'CHAMPION!' : bannerText;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.78);
    overlay.fillRect(0, 0, width, height);

    this.add
      .text(width / 2, height / 2 - 70, finalBanner, {
        fontSize: '44px',
        color: isChampion ? '#feca57' : isVictory ? '#2ed573' : '#ff4757',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6
      })
      .setOrigin(0.5);

    // Defeat/victory quote
    const winningCharId = isVictory ? this.characterId : this.opponentCharacterId;
    const losingCharId = isVictory ? this.opponentCharacterId : this.characterId;
    const winChar = CHARACTERS.find((c) => c.id === winningCharId);
    const loseChar = CHARACTERS.find((c) => c.id === losingCharId);

    const subQuote = isChampion
      ? `All 7 rivals defeated! ${winChar?.name} is the Slime Champion!`
      : isVictory
      ? `${winChar?.name}: "${winChar?.quote}"`
      : `${loseChar?.name}: "${loseChar?.defeatQuote}"`;

    this.add
      .text(width / 2, height / 2 - 25, subQuote, {
        fontSize: '13px',
        color: isChampion ? '#feca57' : isVictory ? '#2ed573' : '#c8d6e5',
        fontStyle: 'italic bold',
        stroke: '#000000',
        strokeThickness: 2
      })
      .setOrigin(0.5);

    const scoreSummary =
      this.gameMode === 'endless'
        ? `Final Score: ${this.playerScore}`
        : `You: ${this.playerScore}   |   Opponent: ${this.cpuScore}`;

    this.add
      .text(width / 2, height / 2 + 8, scoreSummary, {
        fontSize: '16px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5);

    if (this.gameMode === 'challenge') {
      if (isChampion) {
        CuteUI.createPillButton(this, width / 2, height / 2 + 55, 'CLAIM CHAMPION CROWN 🏆', () => {
          this.scene.start('ChallengeMapScene', {
            characterId: this.characterId,
            defeatedOpponents: this.defeatedOpponents
          });
        }, { textureKey: 'pill_pink', fontSize: '13px', width: 220, height: 40 });

        CuteUI.createPillButton(this, width / 2, height / 2 + 105, 'MAIN MENU', () => {
          this.scene.start('MenuScene');
        }, { textureKey: 'pill_grey', fontSize: '13px', width: 220, height: 40 });
      } else if (isVictory) {
        CuteUI.createPillButton(this, width / 2, height / 2 + 55, `NEXT CHALLENGER (${this.defeatedOpponents.length}/7)`, () => {
          this.scene.start('ChallengeMapScene', {
            characterId: this.characterId,
            defeatedOpponents: this.defeatedOpponents
          });
        }, { textureKey: 'pill_green', fontSize: '13px', width: 220, height: 40 });

        CuteUI.createPillButton(this, width / 2, height / 2 + 105, 'MAIN MENU', () => {
          this.scene.start('MenuScene');
        }, { textureKey: 'pill_grey', fontSize: '13px', width: 220, height: 40 });
      } else {
        CuteUI.createPillButton(this, width / 2, height / 2 + 45, 'RETRY MATCH', () => {
          this.scene.restart({
            mode: this.gameMode,
            characterId: this.characterId,
            opponentCharacterId: this.opponentCharacterId,
            defeatedOpponents: this.defeatedOpponents
          });
        }, { textureKey: 'pill_blue', fontSize: '13px', width: 200, height: 38 });

        CuteUI.createPillButton(this, width / 2, height / 2 + 92, 'CHALLENGE MAP', () => {
          this.scene.start('ChallengeMapScene', {
            characterId: this.characterId,
            defeatedOpponents: this.defeatedOpponents
          });
        }, { textureKey: 'pill_pink', fontSize: '13px', width: 200, height: 38 });

        CuteUI.createPillButton(this, width / 2, height / 2 + 138, 'MAIN MENU', () => {
          this.scene.start('MenuScene');
        }, { textureKey: 'pill_grey', fontSize: '13px', width: 200, height: 38 });
      }
    } else {
      CuteUI.createPillButton(this, width / 2, height / 2 + 55, 'PLAY AGAIN', () => {
        this.scene.restart({
          mode: this.gameMode,
          characterId: this.characterId,
          opponentCharacterId: this.opponentCharacterId
        });
      }, { textureKey: 'pill_green', fontSize: '14px', width: 200, height: 40 });

      CuteUI.createPillButton(this, width / 2, height / 2 + 105, 'MAIN MENU', () => {
        this.scene.start('MenuScene');
      }, { textureKey: 'pill_grey', fontSize: '14px', width: 200, height: 40 });
    }
  }
}
