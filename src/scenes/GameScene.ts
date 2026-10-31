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
  private boardP1Y: number = 88;
  private boardP2X: number = 296;
  private boardP2Y: number = 88;

  public playerBoardScale: number = 1.0;
  public cpuBoardScale: number = 1.0;
  public isMobileLayout: boolean = false;

  public get boardScale(): number {
    return this.playerBoardScale;
  }
  public set boardScale(val: number) {
    this.playerBoardScale = val;
  }

  public get boardY(): number {
    return this.boardP1Y;
  }
  public set boardY(val: number) {
    this.boardP1Y = val;
  }

  private socketMgr?: SocketManager;
  private gameTime: number = 240;
  private timeText!: Phaser.GameObjects.Text;
  private timerEvent!: Phaser.Time.TimerEvent;
  private isMatchOver: boolean = false;
  private isPaused: boolean = false;
  private pauseModalContainer?: Phaser.GameObjects.Container;
  private pauseModalIndex: number = 0;
  private pauseButtons: Phaser.GameObjects.Container[] = [];
  private pauseActions: (() => void)[] = [];

  // Game Over Modal State
  private gameOverModalContainer?: Phaser.GameObjects.Container;
  private gameOverButtons: Phaser.GameObjects.Container[] = [];
  private gameOverActions: (() => void)[] = [];
  private gameOverModalIndex: number = 0;
  private gameOverPadRepeatTimer: number = 0;

  // Gamepad State (DAS Repeat & Button Tracking)
  private padMoveTimer: number = 0;
  private padLastDir: 'up' | 'down' | 'left' | 'right' | null = null;
  private padPrevButtons: Map<number, boolean> = new Map();
  private pausePadRepeatTimer: number = 0;
  private keydownHandler?: (e: KeyboardEvent) => void;
  private keyupHandler?: (e: KeyboardEvent) => void;

  // Touch & Mobile Gesture State
  private touchSwapped: boolean = false;
  private twoFingerLifting: boolean = false;
  private mouseRightLifting: boolean = false;
  private touchBoardActive: boolean = false;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartGridX: number = 0;
  private touchStartGridY: number = 0;
  private lastMouseX: number = -1;
  private lastMouseY: number = -1;

  // Online Multiplayer State
  private roomId: string = '';
  private isPlayer1: boolean = true;
  private matchSeed: number = 0;
  private lastSentCursorX: number = -1;
  private lastSentCursorY: number = -1;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: any): void {
    this.gameMode = data?.mode || 'challenge';
    this.characterId = data?.characterId || 'kiri';
    this.defeatedOpponents = data?.defeatedOpponents || [];

    if (this.gameMode === 'vs_online') {
      this.socketMgr = SocketManager.getInstance();
      this.roomId = data?.roomId || '';
      this.isPlayer1 = Boolean(data?.isPlayer1);
      this.matchSeed = data?.seed || 12345;
    }

    if (data?.opponentCharacterId) {
      this.opponentCharacterId = data.opponentCharacterId;
    } else if (this.gameMode === 'vs_online') {
      this.opponentCharacterId = 'mizu';
    } else {
      const otherChars = CHARACTERS.filter((c) => c.id !== this.characterId);
      this.opponentCharacterId = otherChars[Math.floor(Math.random() * otherChars.length)].id;
    }

    this.playerScore = 0;
    this.cpuScore = 0;
    this.gameTime = 240;
    this.isMatchOver = false;
    this.gameOverModalContainer = undefined;
    this.gameOverButtons = [];
    this.gameOverActions = [];
    this.gameOverModalIndex = 0;
    this.gameOverPadRepeatTimer = 0;
    this.lastMouseX = -1;
    this.lastMouseY = -1;
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

    const isMobilePortrait = height >= width * 1.05 || width < 600;
    this.isMobileLayout = isMobilePortrait;

    const p1Char = CHARACTERS.find((c) => c.id === this.characterId) || CHARACTERS[0];
    const p2Char = CHARACTERS.find((c) => c.id === this.opponentCharacterId) || CHARACTERS[1];
    const p2Label = this.gameMode === 'vs_online' ? 'P2' : 'CPU';
    const p2Color = 0x54a0ff;

    if (isMobilePortrait) {
      // ===== MOBILE PORTRAIT ADAPTIVE BATTLE LAYOUT =====
      // 1. Bottom Fast-Lift Bar (thumb-friendly target)
      const liftBarH = 36;
      const liftBarY = height - liftBarH / 2 - 8;
      const liftBarTop = liftBarY - liftBarH / 2;

      // 2. Opponent Battle Monitor at Top-Right
      // Keep opponent monitor compact so it never crowds or overlaps the player board
      const opponentTargetW = Math.min(108, Math.max(80, Math.round(width * 0.26)));
      this.cpuBoardScale = opponentTargetW / (BOARD_WIDTH * PANEL_SIZE);
      const p2BoardW = Math.round(BOARD_WIDTH * PANEL_SIZE * this.cpuBoardScale);
      const p2BoardH = Math.round(BOARD_VISIBLE_HEIGHT * PANEL_SIZE * this.cpuBoardScale);
      const p2X = width - p2BoardW - 8;
      const p2Y = 14;

      this.boardP2X = p2X;
      this.boardP2Y = p2Y;

      this.cpuBorder = this.add.graphics();
      this.cpuBorder.setDepth(21);
      this.drawBoardFrame(this.cpuBorder, p2X, p2Y, p2BoardW, p2BoardH, p2Color, false);
      this.cpuBoard = new Board(this, p2X, p2Y, this.cpuBoardScale);
      this.cpuBoard.addInitialPanels(4);
      this.cpuCursor = new Cursor(this, this.cpuBoard);
      this.cpuCursor.setStrokeStyle(3 * this.cpuBoardScale, p2Color);

      this.cpuDangerText = this.add
        .text(p2X + p2BoardW / 2, p2Y - 8, '', {
          fontSize: '10px',
          color: '#ff4757',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2
        })
        .setOrigin(0.5)
        .setDepth(26);

      this.cpuChainText = this.add
        .text(p2X + p2BoardW / 2, p2Y + p2BoardH + 10, '', {
          fontSize: '12px',
          color: '#54a0ff',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3
        })
        .setOrigin(0.5)
        .setDepth(26);

      const topSectionBottom = p2Y + p2BoardH;

      // Left Column: Pause button (at x:24, y:22), Opponent Plaque, Mascot, and Timer
      const leftColStartX = 50; // clears pause button!
      const leftColEndX = p2X - 8;
      const leftColW = Math.max(80, leftColEndX - leftColStartX);
      const leftColCenterX = Math.round(leftColStartX + leftColW / 2);

      // Opponent Info Plaque: right of pause button, top aligned with p2Y
      const p2PlaqueW = Math.min(leftColW, 160);
      const p2Header = this.add.container(leftColCenterX, p2Y + 12);
      p2Header.setDepth(24);
      const p2Sign = this.add.image(0, 0, 'wood_plaque_sign');
      p2Sign.setDisplaySize(p2PlaqueW, 30);

      const p2Badge = CuteUI.createPillButton(this, -p2PlaqueW / 2 + 18, 0, p2Label, () => {}, {
        textureKey: 'pill_blue',
        fontSize: '10px',
        width: 32,
        height: 20,
        shadow: false,
        autoScale: false
      });

      const p2NameText = this.add.text(-p2PlaqueW / 2 + 38, -6, p2Char.name, {
        fontSize: '11px',
        color: '#fff3c4',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: 2
      });

      this.cpuScoreText = this.add.text(-p2PlaqueW / 2 + 38, 6, 'SCORE: 0', {
        fontSize: '9.5px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: 2
      });

      p2Header.add([p2Sign, p2Badge, p2NameText, this.cpuScoreText]);

      // Timer Plaque at bottom of top section
      const timerContainer = this.add.container(leftColCenterX, topSectionBottom - 16);
      timerContainer.setDepth(30);

      const timerPlaque = this.add.image(0, 0, 'wood_plaque_sign');
      timerPlaque.setDisplaySize(Math.min(leftColW, 105), 30);

      const clockIcon = this.add.image(-24, 0, 'wood_clock_icon');
      clockIcon.setDisplaySize(16, 16);

      this.timeText = this.add.text(8, -1, this.formatTime(this.gameTime), {
        fontSize: '13px',
        color: '#fff3c4',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: 2
      }).setOrigin(0.5);

      timerContainer.add([timerPlaque, clockIcon, this.timeText]);

      // Opponent Mascot centered vertically between plaque and timer
      const cpuCharY = Math.round((p2Y + 28 + (topSectionBottom - 30)) / 2);
      const cpuCharH = Math.min(56, Math.max(38, Math.round((topSectionBottom - 30 - (p2Y + 28)) * 0.95)));
      const cpuCharW = cpuCharH;

      this.cpuMascot = this.add.image(leftColCenterX, cpuCharY, p2Char.id);
      this.cpuMascot.setDisplaySize(cpuCharW, cpuCharH);
      this.cpuMascot.setFlipX(true);
      this.cpuMascot.setDepth(15);
      this.tweens.add({
        targets: this.cpuMascot,
        y: cpuCharY - 3,
        duration: 1350,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // 3. Player 1 Board at the bottom - calculated to fit with zero overlap
      const p1TopAvailable = topSectionBottom + 40;
      const p1BottomAvailable = liftBarTop - 8;
      const availableP1H = Math.max(240, p1BottomAvailable - p1TopAvailable);
      const availableP1W = width - 20;

      const scaleByH = availableP1H / (BOARD_VISIBLE_HEIGHT * PANEL_SIZE);
      const scaleByW = availableP1W / (BOARD_WIDTH * PANEL_SIZE);
      this.playerBoardScale = Math.max(0.75, Math.min(1.4, scaleByW, scaleByH));

      const p1BoardW = Math.round(BOARD_WIDTH * PANEL_SIZE * this.playerBoardScale);
      const p1BoardH = Math.round(BOARD_VISIBLE_HEIGHT * PANEL_SIZE * this.playerBoardScale);
      const p1X = Math.round((width - p1BoardW) / 2);
      const p1Y = p1BottomAvailable - p1BoardH;

      this.boardP1X = p1X;
      this.boardP1Y = p1Y;

      // P1 Board Frame & Board
      this.playerBorder = this.add.graphics();
      this.playerBorder.setDepth(21);
      this.drawBoardFrame(this.playerBorder, p1X, p1Y, p1BoardW, p1BoardH, 0xff69b4, true);
      this.playerBoard = new Board(this, p1X, p1Y, this.playerBoardScale);
      this.playerBoard.addInitialPanels(4);
      this.playerCursor = new Cursor(this, this.playerBoard);

      // P1 Header Plaque above board
      const p1PlaqueW = Math.min(p1BoardW - 8, width - 24);
      const p1Header = this.add.container(p1X + p1BoardW / 2, p1Y - 18);
      p1Header.setDepth(24);
      const p1Sign = this.add.image(0, 0, 'wood_plaque_sign');
      p1Sign.setDisplaySize(p1PlaqueW, 32);

      const p1Badge = CuteUI.createPillButton(this, -p1PlaqueW / 2 + 18, 0, 'P1', () => {}, {
        textureKey: 'pill_pink',
        fontSize: '11px',
        width: 32,
        height: 20,
        shadow: false,
        autoScale: false
      });

      this.playerMascot = this.add.image(-p1PlaqueW / 2 + 46, 0, p1Char.id);
      this.playerMascot.setDisplaySize(24, 24);

      const p1NameText = this.add.text(-p1PlaqueW / 2 + 66, -6, p1Char.name, {
        fontSize: '12px',
        color: '#fff3c4',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: 3
      });

      this.playerScoreText = this.add.text(-p1PlaqueW / 2 + 66, 6, 'SCORE: 0', {
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: 2
      });

      p1Header.add([p1Sign, p1Badge, this.playerMascot, p1NameText, this.playerScoreText]);

      this.playerChainText = this.add
        .text(p1X + p1BoardW / 2, p1Y + p1BoardH / 2, '', {
          fontSize: '22px',
          color: '#ff9f43',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4
        })
        .setOrigin(0.5)
        .setDepth(26);

      this.playerDangerText = this.add
        .text(p1X + p1BoardW / 2, p1Y - 36, '', {
          fontSize: '12px',
          color: '#ff4757',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3
        })
        .setOrigin(0.5)
        .setDepth(26);

    } else {
      // ===== DESKTOP / LANDSCAPE SIDE-BY-SIDE EXPANDED LAYOUT =====
      const availableW = width - 80;
      const maxScaleByW = Math.floor((availableW / (2.4 * BOARD_WIDTH * PANEL_SIZE + 24)) * 100) / 100;
      const availableH = height - 160;
      const maxScaleByH = Math.floor((availableH / (1.14 * BOARD_VISIBLE_HEIGHT * PANEL_SIZE)) * 100) / 100;
      this.playerBoardScale = Math.min(2.45, Math.max(0.85, Math.min(maxScaleByW, maxScaleByH)));
      this.cpuBoardScale = this.playerBoardScale;

      const boardScaleRatio = this.playerBoardScale / 1.15;
      const boardW = Math.round(BOARD_WIDTH * PANEL_SIZE * this.playerBoardScale);
      const boardH = Math.round(BOARD_VISIBLE_HEIGHT * PANEL_SIZE * this.playerBoardScale);

      const boardY = height > 550 ? Math.max(90, Math.round((height - boardH - 90) * 0.42)) : 88;
      this.boardP1Y = boardY;
      this.boardP2Y = boardY;

      const centerX = width / 2;
      const boardGap = Math.min(Math.round(110 * boardScaleRatio), Math.max(24, width - boardW * 2 - 32));
      const p1X = Math.round(centerX - boardW - boardGap / 2);
      const p2X = Math.round(centerX + boardGap / 2);

      this.boardP1X = p1X;
      this.boardP2X = p2X;

      // Center Timer Sign between boards
      const timerContainer = this.add.container(centerX, boardY + Math.round(boardH * 0.28));
      timerContainer.setDepth(30);

      const timerPlaqueW = Math.round(120 * boardScaleRatio);
      const timerPlaqueH = Math.round(42 * boardScaleRatio);
      const timerPlaque = this.add.image(0, 0, 'wood_plaque_sign');
      timerPlaque.setDisplaySize(Math.min(boardGap + 36, timerPlaqueW), timerPlaqueH);

      const clockIcon = this.add.image(-Math.round(28 * boardScaleRatio), 0, 'wood_clock_icon');
      clockIcon.setDisplaySize(Math.round(22 * boardScaleRatio), Math.round(22 * boardScaleRatio));

      this.timeText = this.add.text(Math.round(12 * boardScaleRatio), -1, this.formatTime(this.gameTime), {
        fontSize: `${Math.round(16 * boardScaleRatio)}px`,
        color: '#fff3c4',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: Math.round(3 * (boardScaleRatio > 1.3 ? 1.3 : 1.0))
      }).setOrigin(0.5);

      timerContainer.add([timerPlaque, clockIcon, this.timeText]);

      // Setup Player 1 (Left)
      this.playerBorder = this.add.graphics();
      this.playerBorder.setDepth(21);
      this.drawBoardFrame(this.playerBorder, p1X, boardY, boardW, boardH, 0xff69b4, true);
      this.playerBoard = new Board(this, p1X, boardY, this.playerBoardScale);
      this.playerBoard.addInitialPanels(4);
      this.playerCursor = new Cursor(this, this.playerBoard);

      const p1PlaqueW = Math.min(boardW - 6, Math.round(280 * boardScaleRatio));
      const p1PlaqueH = Math.round(40 * boardScaleRatio);
      const p1Header = this.add.container(p1X + boardW / 2, boardY - Math.round(28 * boardScaleRatio));
      p1Header.setDepth(24);
      const p1Sign = this.add.image(0, 0, 'wood_plaque_sign');
      p1Sign.setDisplaySize(p1PlaqueW, p1PlaqueH);

      const badgeW = Math.round(38 * boardScaleRatio);
      const badgeH = Math.round(24 * boardScaleRatio);
      const p1Badge = CuteUI.createPillButton(this, -p1PlaqueW / 2 + Math.round(24 * boardScaleRatio), 0, 'P1', () => {}, {
        textureKey: 'pill_pink',
        fontSize: `${Math.round(11 * boardScaleRatio)}px`,
        width: badgeW,
        height: badgeH,
        shadow: false,
        autoScale: false
      });

      const p1NameText = this.add.text(-p1PlaqueW / 2 + Math.round(50 * boardScaleRatio), -Math.round(7 * boardScaleRatio), p1Char.name, {
        fontSize: `${Math.round(13 * boardScaleRatio)}px`,
        color: '#fff3c4',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: Math.round(3 * (boardScaleRatio > 1.3 ? 1.3 : 1.0))
      });

      this.playerScoreText = this.add.text(-p1PlaqueW / 2 + Math.round(50 * boardScaleRatio), Math.round(7 * boardScaleRatio), 'SCORE: 0', {
        fontSize: `${Math.round(11 * boardScaleRatio)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: 2
      });

      p1Header.add([p1Sign, p1Badge, p1NameText, this.playerScoreText]);

      this.playerChainText = this.add
        .text(p1X + boardW / 2, boardY + boardH + Math.round(18 * boardScaleRatio), '', {
          fontSize: `${Math.round(18 * boardScaleRatio)}px`,
          color: '#ff9f43',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3
        })
        .setOrigin(0.5);

      this.playerDangerText = this.add
        .text(p1X + boardW / 2, boardY - Math.round(52 * boardScaleRatio), '', {
          fontSize: `${Math.round(13 * boardScaleRatio)}px`,
          color: '#ff4757',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3
        })
        .setOrigin(0.5);

      // Setup Opponent (Right)
      this.cpuBorder = this.add.graphics();
      this.cpuBorder.setDepth(21);
      this.drawBoardFrame(this.cpuBorder, p2X, boardY, boardW, boardH, p2Color, false);
      this.cpuBoard = new Board(this, p2X, boardY, this.cpuBoardScale);
      this.cpuBoard.addInitialPanels(4);
      this.cpuCursor = new Cursor(this, this.cpuBoard);
      this.cpuCursor.setStrokeStyle(3 * this.cpuBoardScale, p2Color);

      this.cpuDangerText = this.add
        .text(p2X + boardW / 2, boardY - Math.round(52 * boardScaleRatio), '', {
          fontSize: `${Math.round(13 * boardScaleRatio)}px`,
          color: '#ff4757',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3
        })
        .setOrigin(0.5);

      const p2PlaqueW = Math.min(boardW - 6, Math.round(280 * boardScaleRatio));
      const p2PlaqueH = Math.round(40 * boardScaleRatio);
      const p2Header = this.add.container(p2X + boardW / 2, boardY - Math.round(28 * boardScaleRatio));
      p2Header.setDepth(24);
      const p2Sign = this.add.image(0, 0, 'wood_plaque_sign');
      p2Sign.setDisplaySize(p2PlaqueW, p2PlaqueH);

      const p2Badge = CuteUI.createPillButton(this, -p2PlaqueW / 2 + Math.round(26 * boardScaleRatio), 0, p2Label, () => {}, {
        textureKey: 'pill_blue',
        fontSize: `${Math.round(11 * boardScaleRatio)}px`,
        width: badgeW + 4,
        height: badgeH,
        shadow: false,
        autoScale: false
      });

      const p2NameText = this.add.text(-p2PlaqueW / 2 + Math.round(54 * boardScaleRatio), -Math.round(7 * boardScaleRatio), p2Char.name, {
        fontSize: `${Math.round(13 * boardScaleRatio)}px`,
        color: '#fff3c4',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: Math.round(3 * (boardScaleRatio > 1.3 ? 1.3 : 1.0))
      });

      this.cpuScoreText = this.add.text(-p2PlaqueW / 2 + Math.round(54 * boardScaleRatio), Math.round(7 * boardScaleRatio), 'SCORE: 0', {
        fontSize: `${Math.round(11 * boardScaleRatio)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: 2
      });

      p2Header.add([p2Sign, p2Badge, p2NameText, this.cpuScoreText]);

      this.cpuChainText = this.add
        .text(p2X + boardW / 2, boardY + boardH + Math.round(18 * boardScaleRatio), '', {
          fontSize: `${Math.round(18 * boardScaleRatio)}px`,
          color: '#54a0ff',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3
        })
        .setOrigin(0.5);

      // Full-Body Mascots on Flanks
      const charH = Math.round(180 * Math.min(1.35, this.playerBoardScale));
      const charW = charH;
      const p1CharX = Math.max(70, Math.round(p1X - 85 * boardScaleRatio));
      const p1CharY = Math.round(boardY + boardH - 45 * boardScaleRatio);
      const cpuCharX = Math.min(width - 70, Math.round(p2X + boardW + 85 * boardScaleRatio));
      const cpuCharY = Math.round(boardY + boardH - 45 * boardScaleRatio);

      const shadowG = this.add.graphics();
      shadowG.fillStyle(0x1a3311, 0.38);
      shadowG.fillEllipse(p1CharX, p1CharY + charH * 0.42, charW * 0.48, 14);
      shadowG.fillEllipse(cpuCharX, cpuCharY + charH * 0.42, charW * 0.48, 14);
      shadowG.setDepth(14);

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
    }

    if (this.gameMode === 'vs_cpu' || this.gameMode === 'challenge') {
      this.cpuBot = new AIBot(
        this.cpuBoard!,
        this.cpuCursor!,
        AIDifficulty.NORMAL,
        this.opponentCharacterId,
        this.playerBoard
      );
    }

    // Wire Player Events
    this.playerBoard.on('stackRise', (e: { offset: number }) => this.playerCursor.setStackOffset(e.offset));
    this.playerBoard.on('rowShift', (e: { offset: number }) => this.playerCursor.shiftWithStack(e?.offset));
    this.playerBoard.on('match', (e: MatchEvent) => this.handlePlayerMatch(e));
    this.playerBoard.on('panelPop', (e: { x: number; y: number; color: number }) => {
      this.spawnPopParticles(
        this.boardP1X + (e.x * PANEL_SIZE + PANEL_SIZE / 2) * this.playerBoardScale,
        this.boardP1Y + (e.y * PANEL_SIZE - this.playerBoard.stackOffsetPixels + PANEL_SIZE / 2) * this.playerBoardScale,
        e.color
      );
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
      if (this.gameMode === 'vs_online') {
        this.sendNetAction({ type: 'topOut' });
      }
      this.endMatch('DEFEAT!', false);
    });

    // Wire Opponent Board Events (CPU or Online Rival)
    if (this.cpuBoard) {
      this.cpuBoard.on('stackRise', (e: { offset: number }) => this.cpuCursor?.setStackOffset(e.offset));
      this.cpuBoard.on('rowShift', (e: { offset: number }) => this.cpuCursor?.shiftWithStack(e?.offset));
      this.cpuBoard.on('match', (e: MatchEvent) => this.handleCpuMatch(e));
      this.cpuBoard.on('panelPop', (e: { x: number; y: number; color: number }) => {
        this.spawnPopParticles(
          this.boardP2X + (e.x * PANEL_SIZE + PANEL_SIZE / 2) * this.cpuBoardScale,
          this.boardP2Y + (e.y * PANEL_SIZE - this.cpuBoard!.stackOffsetPixels + PANEL_SIZE / 2) * this.cpuBoardScale,
          e.color
        );
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
        if (action.type === 'cursor' && action.payload) {
          if (this.cpuCursor) {
            this.cpuCursor.setGridPosition(action.payload.x, action.payload.y);
            this.cpuCursor.updatePosition();
          }
        } else if (action.type === 'swap' && action.payload) {
          if (this.cpuBoard) {
            this.cpuBoard.swap(action.payload.x, action.payload.y);
          }
        } else if (action.type === 'lift' && action.payload) {
          if (this.cpuBoard) {
            this.cpuBoard.setLifting(Boolean(action.payload.lifting));
          }
        } else if (action.type === 'board_sync' && action.payload) {
          if (this.cpuBoard && action.payload.grid) {
            this.cpuBoard.applyGridSnapshot(action.payload.grid, action.payload.stackOffset);
          }
        } else if (action.type === 'attack' && action.payload) {
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
        if (!this.isMatchOver) {
          this.endMatch('OPPONENT LEFT - YOU WIN!', true);
        }
      });

      // Periodic board state synchronization (broadcast every 350ms)
      this.time.addEvent({
        delay: 350,
        loop: true,
        callback: () => {
          if (this.isMatchOver || !this.playerBoard || !this.socketMgr) return;
          this.sendNetAction({
            type: 'board_sync',
            payload: {
              grid: this.playerBoard.serializeGrid(),
              stackOffset: this.playerBoard.stackOffsetPixels,
              isDanger: this.playerBoard.isDanger
            }
          });
        }
      });
    }
  }

  /** Setup Single Centered Board for Endless / Solo */
  private setupEndlessMode(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const isMobilePortrait = height >= width * 1.05 || width < 600;
    this.isMobileLayout = isMobilePortrait;

    if (isMobilePortrait) {
      const liftBarH = 36;
      const liftBarY = height - liftBarH / 2 - 8;
      const liftBarTop = liftBarY - liftBarH / 2;

      const availableW = width - 20;
      const scaleByW = availableW / (BOARD_WIDTH * PANEL_SIZE);
      const availableH = liftBarTop - 64;
      const scaleByH = availableH / (BOARD_VISIBLE_HEIGHT * PANEL_SIZE);
      this.playerBoardScale = Math.max(0.75, Math.min(1.4, Math.min(scaleByW, scaleByH)));
    } else {
      const availableW = width - 120;
      const scaleByW = Math.floor((availableW / (1.3 * BOARD_WIDTH * PANEL_SIZE)) * 100) / 100;
      const availableH = height - 160;
      const scaleByH = Math.floor((availableH / (1.14 * BOARD_VISIBLE_HEIGHT * PANEL_SIZE)) * 100) / 100;
      this.playerBoardScale = Math.min(2.5, Math.max(1.0, Math.min(scaleByW, scaleByH)));
    }
    this.cpuBoardScale = this.playerBoardScale;

    const boardScaleRatio = isMobilePortrait ? 1.0 : this.playerBoardScale / 1.15;
    const boardW = Math.round(BOARD_WIDTH * PANEL_SIZE * this.playerBoardScale);
    const boardH = Math.round(BOARD_VISIBLE_HEIGHT * PANEL_SIZE * this.playerBoardScale);
    const boardX = Math.round((width - boardW) / 2);

    let boardY = 88;
    if (isMobilePortrait) {
      const liftBarH = 36;
      const liftBarY = height - liftBarH / 2 - 8;
      boardY = liftBarY - liftBarH / 2 - 8 - boardH;
    } else {
      boardY = height > 550 ? Math.max(88, Math.round((height - boardH - 100) * 0.40)) : 88;
    }

    this.boardP1X = boardX;
    this.boardP1Y = boardY;
    this.boardP2X = boardX;
    this.boardP2Y = boardY;

    this.playerBorder = this.add.graphics();
    this.playerBorder.setDepth(21);
    this.drawBoardFrame(this.playerBorder, boardX, boardY, boardW, boardH, 0xff69b4, true);

    this.playerBoard = new Board(this, boardX, boardY, this.playerBoardScale);
    this.playerBoard.addInitialPanels(5);
    this.playerCursor = new Cursor(this, this.playerBoard);

    const charData = CHARACTERS.find((c) => c.id === this.characterId) || CHARACTERS[0];

    // Wooden Header Plaque above board
    const plaqueW = Math.min(boardW - 6, Math.round(300 * boardScaleRatio));
    const plaqueH = Math.round(42 * boardScaleRatio);
    const header = this.add.container(boardX + boardW / 2, boardY - Math.round(30 * boardScaleRatio));
    header.setDepth(24);

    const sign = this.add.image(0, 0, 'wood_plaque_sign');
    sign.setDisplaySize(plaqueW, plaqueH);

    const badgeW = Math.round(76 * boardScaleRatio);
    const badgeH = Math.round(24 * boardScaleRatio);
    const charBadge = CuteUI.createPillButton(this, -plaqueW / 2 + Math.round(34 * boardScaleRatio), 0, charData.name.toUpperCase(), () => {}, {
      textureKey: 'pill_pink',
      fontSize: `${Math.round(11 * boardScaleRatio)}px`,
      width: badgeW,
      height: badgeH,
      shadow: false,
      autoScale: false
    });

    this.playerScoreText = this.add.text(-plaqueW / 2 + Math.round(78 * boardScaleRatio), -Math.round(8 * boardScaleRatio), 'SCORE: 0', {
      fontSize: `${Math.round(12 * boardScaleRatio)}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#3e2415',
      strokeThickness: 2
    });

    const clockIcon = this.add.image(plaqueW / 2 - Math.round(76 * boardScaleRatio), 0, 'wood_clock_icon');
    clockIcon.setDisplaySize(Math.round(18 * boardScaleRatio), Math.round(18 * boardScaleRatio));

    this.timeText = this.add.text(plaqueW / 2 - Math.round(38 * boardScaleRatio), -1, this.formatTime(this.gameTime), {
      fontSize: `${Math.round(13 * boardScaleRatio)}px`,
      color: '#fff3c4',
      fontStyle: 'bold',
      stroke: '#3e2415',
      strokeThickness: 2
    }).setOrigin(0.5);

    header.add([sign, charBadge, this.playerScoreText, clockIcon, this.timeText]);

    this.playerChainText = this.add
      .text(boardX + boardW / 2, boardY + boardH / 2, '', {
        fontSize: '22px',
        color: '#ff9f43',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(26);

    this.playerDangerText = this.add
      .text(boardX + boardW / 2, boardY - 50, '', {
        fontSize: '13px',
        color: '#ff4757',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(26);

    // Mascot
    const charH = Math.round(180 * Math.min(1.2, this.playerBoardScale));
    const charW = charH;

    let mascotX: number;
    let mascotY: number;

    if (isMobilePortrait) {
      mascotX = Math.max(24, boardX - 14);
      mascotY = boardY - 14;
    } else {
      mascotX = Math.min(width - 90, Math.round(boardX + boardW + 105));
      mascotY = Math.round(boardY + boardH - 60);
    }

    if (!isMobilePortrait) {
      const shadowG = this.add.graphics();
      shadowG.fillStyle(0x1a3311, 0.38);
      shadowG.fillEllipse(mascotX, mascotY + charH * 0.42, charW * 0.48, 15);
      shadowG.setDepth(14);
    }

    this.playerMascot = this.add.image(mascotX, mascotY, charData.id);
    this.playerMascot.setDisplaySize(isMobilePortrait ? 38 : charW, isMobilePortrait ? 38 : charH);
    this.playerMascot.setDepth(25);
    this.tweens.add({
      targets: this.playerMascot,
      y: mascotY - 5,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.playerBoard.on('stackRise', (e: { offset: number }) => this.playerCursor.setStackOffset(e.offset));
    this.playerBoard.on('rowShift', (e: { offset: number }) => this.playerCursor.shiftWithStack(e?.offset));
    this.playerBoard.on('match', (e: MatchEvent) => this.handlePlayerMatch(e));
    this.playerBoard.on('panelPop', (e: { x: number; y: number; color: number }) => {
      this.spawnPopParticles(
        this.boardP1X + (e.x * PANEL_SIZE + PANEL_SIZE / 2) * this.playerBoardScale,
        this.boardP1Y + (e.y * PANEL_SIZE - this.playerBoard.stackOffsetPixels + PANEL_SIZE / 2) * this.playerBoardScale,
        e.color
      );
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
    let backdrop = this.children.getByName(backdropKey) as Phaser.GameObjects.Image;
    if (!backdrop && this.textures.exists('board_wood_backdrop')) {
      backdrop = this.add.image(x, y, 'board_wood_backdrop');
      backdrop.setName(backdropKey);
      backdrop.setOrigin(0, 0);
      backdrop.setDisplaySize(w, h);
      backdrop.setDepth(1); // Behind board container (depth 10)
    } else if (backdrop) {
      backdrop.setPosition(x, y);
      backdrop.setDisplaySize(w, h);
    }

    // 2. High-res carved timber frame with leaves and flowers on top
    const frameKey = isPlayer ? 'p1_wood_frame' : 'cpu_wood_frame';
    let frameImg = this.children.getByName(frameKey) as Phaser.GameObjects.Image;
    if (this.textures.exists('board_wood_frame')) {
      const tex = this.textures.get('board_wood_frame');
      const srcImg = tex?.getSourceImage() as (HTMLImageElement | undefined);
      const srcW = srcImg ? srcImg.width : 720;

      // Dynamically detect border offsets: snug 720x1130 frame vs legacy 1069x1464 frame
      let borderLeft = 60;
      let borderTop = 70;
      let innerW = 600;
      if (srcW > 800) {
        borderLeft = 233;
        borderTop = 231;
      }

      const frameScale = w / innerW;
      const frameX = x - borderLeft * frameScale;
      const frameY = y - borderTop * frameScale;

      if (!frameImg) {
        frameImg = this.add.image(frameX, frameY, 'board_wood_frame');
        frameImg.setName(frameKey);
        frameImg.setOrigin(0, 0);
        frameImg.setScale(frameScale);
        frameImg.setDepth(5); // Render behind slimes (depth 10) so the slimes are ALWAYS 100% visible!

        if (isPlayer) this.playerWoodFrame = frameImg;
        else this.cpuWoodFrame = frameImg;
      } else {
        frameImg.setPosition(frameX, frameY);
        frameImg.setScale(frameScale);
      }
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
    const scale = isPlayer ? this.playerBoardScale : this.cpuBoardScale;
    const boardW = Math.round(BOARD_WIDTH * PANEL_SIZE * scale);
    const boardH = Math.round(BOARD_VISIBLE_HEIGHT * PANEL_SIZE * scale);
    const boardX = isPlayer ? this.boardP1X : this.boardP2X;
    const boardY = isPlayer ? this.boardP1Y : this.boardP2Y;

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

  private sendNetAction(action: GameAction): void {
    if (this.gameMode === 'vs_online' && this.socketMgr) {
      this.socketMgr.sendAction({
        ...action,
        roomId: this.roomId
      });
    }
  }

  private broadcastCursor(): void {
    if (this.gameMode === 'vs_online' && this.socketMgr && this.playerCursor) {
      if (this.playerCursor.gridX !== this.lastSentCursorX || this.playerCursor.gridY !== this.lastSentCursorY) {
        this.lastSentCursorX = this.playerCursor.gridX;
        this.lastSentCursorY = this.playerCursor.gridY;
        this.sendNetAction({
          type: 'cursor',
          payload: { x: this.playerCursor.gridX, y: this.playerCursor.gridY }
        });
      }
    }
  }

  private triggerPlayerSwap(gx: number, gy: number): boolean {
    const success = this.playerBoard.swap(gx, gy);
    if (success && this.gameMode === 'vs_online') {
      this.sendNetAction({
        type: 'swap',
        payload: { x: gx, y: gy }
      });
    }
    return success;
  }

  private setPlayerLifting(lifting: boolean): void {
    this.playerBoard.setLifting(lifting);
    if (this.gameMode === 'vs_online') {
      this.sendNetAction({
        type: 'lift',
        payload: { lifting }
      });
    }
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

      // If game over, keyboard navigates the game over menu
      if (this.isMatchOver) {
        if (event.key === 'ArrowUp' || event.code === 'KeyW') {
          this.navigateGameOverMenu(-1);
        } else if (event.key === 'ArrowDown' || event.code === 'KeyS') {
          this.navigateGameOverMenu(1);
        } else if (event.key === 'Enter' || event.code === 'Space') {
          this.selectGameOverOption();
        }
        return;
      }

      // Gameplay cursor moves
      if (this.matchesAction(event, 'moveLeft', ['LEFT', 'A', 'ArrowLeft'])) {
        this.playerCursor.moveLeft();
        this.broadcastCursor();
      } else if (this.matchesAction(event, 'moveRight', ['RIGHT', 'D', 'ArrowRight'])) {
        this.playerCursor.moveRight();
        this.broadcastCursor();
      } else if (this.matchesAction(event, 'moveUp', ['UP', 'W', 'ArrowUp'])) {
        this.playerCursor.moveUp();
        this.broadcastCursor();
      } else if (this.matchesAction(event, 'moveDown', ['DOWN', 'S', 'ArrowDown'])) {
        this.playerCursor.moveDown();
        this.broadcastCursor();
      }

      // Swap
      if (this.matchesAction(event, 'swap', ['SPACE', 'X', 'C', ' '])) {
        this.triggerPlayerSwap(this.playerCursor.gridX, this.playerCursor.gridY);
      }

      // Lift (Keydown)
      if (this.matchesAction(event, 'lift', ['SHIFT', 'R', 'ShiftLeft', 'ShiftRight'])) {
        this.setPlayerLifting(true);
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
        this.setPlayerLifting(false);
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);

    this.events.once('shutdown', () => {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.keyupHandler) window.removeEventListener('keyup', this.keyupHandler);
    });
  }

  /** Setup mouse & touch controls (Desktop click-to-swap, hover cursor, right-click/wheel lift, mobile gestures) */
  private setupTouchControls(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Prevent default browser context menu on right-click inside the game
    this.input.mouse?.disableContextMenu();
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', onContextMenu);
    this.events.once('shutdown', () => {
      window.removeEventListener('contextmenu', onContextMenu);
    });

    // 1. Mobile & Desktop Pause Button (Top-Left on Mobile, Top-Right on Desktop)
    const pauseBtnX = this.isMobileLayout ? 24 : width - 24;
    const pauseBtn = this.add.container(pauseBtnX, 22);
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

    // 2. Mouse Wheel Scroll -> Quick fast-lift impulse
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any, deltaX: number, deltaY: number) => {
      if (this.isMatchOver || this.isPaused) return;
      if (Math.abs(deltaY) > 0) {
        this.setPlayerLifting(true);
        this.time.delayedCall(220, () => {
          if (!this.mouseRightLifting && !this.twoFingerLifting) {
            this.setPlayerLifting(false);
          }
        });
      }
    });

    // 3. Pointer Down: Left-Click / Tap to swap, Right-Click to fast-lift
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isMatchOver || this.isPaused || !this.playerBoard || !this.playerCursor) return;

      // Method 1 for mouse-only lift: RIGHT-CLICK or Middle Click to fast lift!
      if (pointer.rightButtonDown() || pointer.button === 2 || pointer.button === 1) {
        this.mouseRightLifting = true;
        this.setPlayerLifting(true);
        return;
      }

      // Left Click or Touch on the Player Board
      const bX = this.playerBoard.boardOffsetX;
      const bY = this.playerBoard.boardOffsetY;
      const bW = BOARD_WIDTH * PANEL_SIZE * this.playerBoardScale;
      const bH = BOARD_VISIBLE_HEIGHT * PANEL_SIZE * this.playerBoardScale;
      const padX = 24 * this.playerBoardScale;
      const padY = 36 * this.playerBoardScale;

      if (
        pointer.x >= bX - padX &&
        pointer.x <= bX + bW + padX &&
        pointer.y >= bY - padY &&
        pointer.y <= bY + bH + padY
      ) {
        const localX = (pointer.x - bX) / this.playerBoardScale;
        const localY = (pointer.y - (bY - this.playerBoard.stackOffsetPixels * this.playerBoardScale)) / this.playerBoardScale;

        const rawGx = Math.floor((localX - PANEL_SIZE / 2) / PANEL_SIZE + 0.5);
        const gx = Math.max(0, Math.min(rawGx, BOARD_WIDTH - 2));

        const rawGy = Math.floor(localY / PANEL_SIZE);
        const gy = Math.max(0, Math.min(rawGy, BOARD_VISIBLE_HEIGHT - 1));

        this.touchBoardActive = true;
        this.touchSwapped = false;
        this.touchStartX = pointer.x;
        this.touchStartY = pointer.y;
        this.touchStartGridX = gx;
        this.touchStartGridY = gy;

        // Snap cursor to touched slime pair
        this.playerCursor.setGridPosition(gx, gy);
        this.broadcastCursor();

        // For desktop mouse click, trigger immediate swap on pointerdown
        const isMouse = !pointer.wasTouch && pointer.button === 0;
        if (isMouse) {
          this.triggerPlayerSwap(gx, gy);
          this.touchSwapped = true;
        }
      }
    });

    // 4. Pointer Move: Selection rectangle smoothly follows mouse + drag/flick gestures
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isMatchOver || this.isPaused || !this.playerBoard || !this.playerCursor) return;

      // Selection rectangle directly tracks mouse on hover or drag
      this.updateMouseCursorTracking(pointer);

      // Drag / Flick handling
      if (!this.touchBoardActive || this.touchSwapped) return;

      const dx = pointer.x - this.touchStartX;
      const dy = pointer.y - this.touchStartY;
      const threshold = 16 * this.playerBoardScale;

      // Horizontal flick to swap
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          // Flick Right: swap current panel with the one to its right
          const swapCol = Math.min(this.touchStartGridX, BOARD_WIDTH - 2);
          this.playerCursor.setGridPosition(swapCol, this.touchStartGridY);
          this.broadcastCursor();
          this.triggerPlayerSwap(swapCol, this.touchStartGridY);
        } else {
          // Flick Left: swap current panel with the one to its left
          const swapCol = Math.max(0, this.touchStartGridX - 1);
          this.playerCursor.setGridPosition(swapCol, this.touchStartGridY);
          this.broadcastCursor();
          this.triggerPlayerSwap(swapCol, this.touchStartGridY);
        }
        this.touchSwapped = true;
        this.touchBoardActive = false;
      } else if (dy < -22 * this.playerBoardScale && Math.abs(dy) > Math.abs(dx)) {
        // Upward flick: quick fast-lift impulse
        this.setPlayerLifting(true);
        this.time.delayedCall(220, () => {
          if (!this.mouseRightLifting && !this.twoFingerLifting) {
            this.setPlayerLifting(false);
          }
        });
        this.touchSwapped = true;
        this.touchBoardActive = false;
      }
    });

    // 5. Pointer Up: Tap swap execution, release fast lift & reset gesture
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.mouseRightLifting && (pointer.button === 2 || pointer.button === 1 || !pointer.rightButtonDown())) {
        this.mouseRightLifting = false;
        if (!this.twoFingerLifting) {
          this.setPlayerLifting(false);
        }
      }

      if (this.touchBoardActive && !this.touchSwapped) {
        // Clean tap swap on mobile touch release
        const dist = Math.hypot(pointer.x - this.touchStartX, pointer.y - this.touchStartY);
        if (dist < 14 * this.playerBoardScale) {
          this.triggerPlayerSwap(this.touchStartGridX, this.touchStartGridY);
        }
      }
      this.touchBoardActive = false;
      this.touchSwapped = false;
    });

    // 6. Sleek Fast-Lift Bar (Clickable with mouse or thumb)
    const bW = Math.round(BOARD_WIDTH * PANEL_SIZE * this.playerBoardScale);
    const bH = Math.round(BOARD_VISIBLE_HEIGHT * PANEL_SIZE * this.playerBoardScale);
    const isMobile = this.isMobileLayout;
    const boardScaleRatio = isMobile ? 1.0 : this.playerBoardScale / 1.15;
    const liftBarW = isMobile ? Math.min(bW, width - 24) : Math.min(bW, Math.round(300 * boardScaleRatio));
    const liftBarH = isMobile ? 38 : Math.round(38 * boardScaleRatio);
    const liftBarX = isMobile ? width / 2 : this.boardP1X + bW / 2;
    const liftBarY = isMobile ? height - liftBarH / 2 - 8 : Math.min(height - 48, this.boardP1Y + bH + Math.round(32 * boardScaleRatio));

    this.createMobileLiftBar(liftBarX, liftBarY, liftBarW, liftBarH, isMobile ? '11px' : `${Math.round(11 * boardScaleRatio)}px`);

    // Dynamic control hint for desktop
    if (!isMobile) {
      const hintY = Math.min(height - 14, liftBarY + Math.round(26 * boardScaleRatio));
      this.add.text(width / 2, hintY, 'CLICK / TAP: Swap • RIGHT-CLICK / SCROLL / BAR: Fast Lift', {
        fontSize: `${Math.round(11.5 * boardScaleRatio)}px`,
        color: '#a4b0be',
        stroke: '#000000',
        strokeThickness: 1
      }).setOrigin(0.5).setDepth(35);
    }
  }

  private createMobileLiftBar(x: number, y: number, w: number, h: number = 34, fontSizeStr: string = '11px'): Phaser.GameObjects.Container {
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
      fontSize: fontSizeStr,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, w + 16, h + 10, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });

    hit.on('pointerdown', () => {
      draw(true);
      this.setPlayerLifting(true);
    });

    const stopLift = () => {
      draw(false);
      this.setPlayerLifting(false);
    };

    hit.on('pointerup', stopLift);
    hit.on('pointerout', stopLift);

    container.add([bg, text, hit]);
    return container;
  }

  /** Smoothly update selection rectangle to follow the mouse position over the player board */
  private updateMouseCursorTracking(pointer: Phaser.Input.Pointer): void {
    if (this.isMatchOver || this.isPaused || !this.playerBoard || !this.playerCursor) return;

    // Only update if pointer has moved
    const moved = Math.abs(pointer.x - this.lastMouseX) >= 1.5 || Math.abs(pointer.y - this.lastMouseY) >= 1.5;
    if (!moved) return;

    this.lastMouseX = pointer.x;
    this.lastMouseY = pointer.y;

    const bX = this.playerBoard.boardOffsetX;
    const bY = this.playerBoard.boardOffsetY;
    const bW = BOARD_WIDTH * PANEL_SIZE * this.playerBoardScale;
    const bH = BOARD_VISIBLE_HEIGHT * PANEL_SIZE * this.playerBoardScale;

    // Generous bounding box covering the entire board, wood frame, and rising stack
    const padX = 28 * this.playerBoardScale;
    const padY = 40 * this.playerBoardScale;

    if (
      pointer.x >= bX - padX &&
      pointer.x <= bX + bW + padX &&
      pointer.y >= bY - padY &&
      pointer.y <= bY + bH + padY
    ) {
      const localX = (pointer.x - bX) / this.playerBoardScale;
      // Account for sub-pixel stack rising offset
      const localY = (pointer.y - (bY - this.playerBoard.stackOffsetPixels * this.playerBoardScale)) / this.playerBoardScale;

      // Natural centering: cursor centers under the mouse pointer
      const rawGx = Math.floor((localX - PANEL_SIZE / 2) / PANEL_SIZE + 0.5);
      const gx = Math.max(0, Math.min(rawGx, BOARD_WIDTH - 2));

      const rawGy = Math.floor(localY / PANEL_SIZE);
      const gy = Math.max(0, Math.min(rawGy, BOARD_VISIBLE_HEIGHT - 1));

      if (this.playerCursor.gridX !== gx || this.playerCursor.gridY !== gy) {
        this.playerCursor.setGridPosition(gx, gy);
        this.broadcastCursor();
      }
    }
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
      const uiScale = CuteUI.getUIScale(this);

      this.pauseModalContainer = this.add.container(width / 2, height / 2);
      this.pauseModalContainer.setDepth(100);

      // Dark backdrop
      const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.75);
      backdrop.setInteractive();

      // Card box
      const boxW = Math.round(290 * uiScale);
      const boxH = Math.round(270 * uiScale);
      const box = this.add.graphics();
      box.fillStyle(0x1a1230, 0.98);
      box.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, Math.round(16 * uiScale));
      box.lineStyle(Math.round(2.5 * uiScale), 0xff69b4, 1);
      box.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, Math.round(16 * uiScale));

      const title = this.add.text(0, -Math.round(98 * uiScale), 'GAME PAUSED', {
        fontSize: `${Math.round(22 * uiScale)}px`,
        color: '#ff69b4',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: Math.round(4 * uiScale)
      }).setOrigin(0.5);

      const btnW = Math.round(180 * uiScale);
      const btnH = Math.round(38 * uiScale);
      const btnFont = `${Math.round(14 * uiScale)}px`;
      const btnY1 = -Math.round(46 * uiScale);
      const btnY2 = 0;
      const btnY3 = Math.round(46 * uiScale);
      const btnY4 = Math.round(92 * uiScale);

      const resumeBtn = CuteUI.createPillButton(this, 0, btnY1, 'RESUME', () => {
        this.resumeGame();
      }, { textureKey: 'pill_green', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

      const optionsBtn = CuteUI.createPillButton(this, 0, btnY2, '⚙️ OPTIONS', () => {
        this.resumeGame();
        this.scene.start('OptionsMenuScene', { returnScene: 'GameScene' });
      }, { textureKey: 'pill_purple', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

      const restartBtn = CuteUI.createPillButton(this, 0, btnY3, 'RESTART', () => {
        this.resumeGame();
        this.scene.restart();
      }, { textureKey: 'pill_blue', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

      const menuBtn = CuteUI.createPillButton(this, 0, btnY4, 'MAIN MENU', () => {
        if (this.gameMode === 'vs_online' && this.socketMgr && this.roomId) {
          this.socketMgr.leaveRoom(this.roomId);
        }
        this.resumeGame();
        this.scene.start('MenuScene');
      }, { textureKey: 'pill_grey', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

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
          if (this.gameMode === 'vs_online' && this.socketMgr && this.roomId) {
            this.socketMgr.leaveRoom(this.roomId);
          }
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
    const width = this.cameras.main.width;
    const isMobile = this.isMobileLayout;
    let x: number;
    let y: number;

    if (isMobile) {
      x = width / 2;
      y = isPlayer1 ? Math.max(60, this.boardP1Y - 26) : 38;
    } else {
      x = isPlayer1 ? Math.min(width * 0.25, 90) : Math.max(width * 0.75, width - 90);
      y = 20;
    }

    const bubble = this.add.text(x, y, `"${text}"`, {
      fontSize: '11px',
      color: isPlayer1 ? '#ff9ff3' : '#54a0ff',
      fontStyle: 'bold italic',
      stroke: '#000000',
      strokeThickness: 3
    });
    bubble.setOrigin(isMobile ? 0.5 : (isPlayer1 ? 0 : 1), 0.5);
    bubble.setDepth(35);

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
      star.setDepth(26);
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

    if (this.isMatchOver) {
      this.handleGameOverGamepad(delta);
      return;
    }

    // Multi-touch two-finger lift (tablets / mobile devices)
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    const isTwoFinger = Boolean(p1?.isDown && p2?.isDown);
    if (isTwoFinger && !this.twoFingerLifting) {
      this.twoFingerLifting = true;
      this.setPlayerLifting(true);
    } else if (!isTwoFinger && this.twoFingerLifting) {
      this.twoFingerLifting = false;
      this.setPlayerLifting(false);
    }

    this.playerBoard.update(time, delta);

    if (this.input.activePointer) {
      this.updateMouseCursorTracking(this.input.activePointer);
    }

    this.playerCursor.updatePosition();

    if (this.cpuBoard) {
      this.cpuBoard.update(time, delta);
      this.cpuCursor?.updatePosition();
      if (this.cpuBot) {
        this.cpuBot.update(delta);
      }
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
      this.triggerPlayerSwap(this.playerCursor.gridX, this.playerCursor.gridY);
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
      this.setPlayerLifting(true);
    } else if (!liftDown && prevLift) {
      this.setPlayerLifting(false);
    }
    this.padPrevButtons.set(1, liftDown);
  }

  private executePadMove(dir: 'up' | 'down' | 'left' | 'right'): void {
    if (dir === 'left') this.playerCursor.moveLeft();
    else if (dir === 'right') this.playerCursor.moveRight();
    else if (dir === 'up') this.playerCursor.moveUp();
    else if (dir === 'down') this.playerCursor.moveDown();
    this.broadcastCursor();
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

  private handleGameOverGamepad(delta: number): void {
    const pad = this.getActiveGamepad();
    if (!pad) return;

    // Up / Down navigation in game over menu
    const stickY = pad.leftStick ? pad.leftStick.y : 0;
    const isUp = pad.up || pad.isButtonDown(12) || stickY < -0.45;
    const isDown = pad.down || pad.isButtonDown(13) || stickY > 0.45;

    if (isUp || isDown) {
      if (this.gameOverPadRepeatTimer <= 0) {
        if (isUp) this.navigateGameOverMenu(-1);
        else if (isDown) this.navigateGameOverMenu(1);
        this.gameOverPadRepeatTimer = 220;
      } else {
        this.gameOverPadRepeatTimer -= delta;
      }
    } else {
      this.gameOverPadRepeatTimer = 0;
    }

    // Button 0 (A) selects
    const selectDown = pad.A || pad.isButtonDown(0);
    const prevSelect = this.padPrevButtons.get(0) || false;
    if (selectDown && !prevSelect) {
      this.selectGameOverOption();
    }
    this.padPrevButtons.set(0, selectDown);
  }

  private navigateGameOverMenu(delta: number): void {
    if (this.gameOverButtons.length === 0) return;
    SoundFx.playCursor();
    this.gameOverModalIndex =
      (this.gameOverModalIndex + delta + this.gameOverButtons.length) % this.gameOverButtons.length;
    this.updateGameOverButtonSelection();
  }

  private selectGameOverOption(): void {
    if (this.gameOverActions[this.gameOverModalIndex]) {
      this.gameOverActions[this.gameOverModalIndex]();
    }
  }

  private updateGameOverButtonSelection(): void {
    this.gameOverButtons.forEach((btn, idx) => {
      if (idx === this.gameOverModalIndex) {
        btn.setScale(1.08);
      } else {
        btn.setScale(1.0);
      }
    });
  }

  private endMatch(bannerText: string, isVictory: boolean): void {
    if (this.isMatchOver) return;
    this.isMatchOver = true;

    if (this.gameMode === 'vs_online' && this.socketMgr && this.roomId) {
      this.socketMgr.leaveRoom(this.roomId);
    }

    if (this.timerEvent) {
      this.timerEvent.remove();
    }

    // Soften battle background music so result jingle pops
    if (this.cache.audio.exists('battle_cpu')) {
      const bgm = this.sound.get('battle_cpu');
      if (bgm && bgm.isPlaying) {
        this.tweens.add({
          targets: bgm,
          volume: 0.12,
          duration: 400
        });
      }
    }

    if (isVictory) {
      SoundFx.playVictory();
      // Victory confetti falling over the entire screen at depth 250!
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * this.cameras.main.width;
        const y = -10 - Math.random() * 50;
        const star = this.add.image(x, y, 'sparkle_star');
        star.setDisplaySize(14, 14);
        star.setDepth(250);
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

    // Create Game Over Modal Container at Depth 200 (guaranteed on top of boards, frames, and cursors)
    this.gameOverModalContainer = this.add.container(width / 2, height / 2);
    this.gameOverModalContainer.setDepth(200);

    // 1. Dark fullscreen backdrop to shield underlying game and absorb touch/pointer input
    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.78);
    backdrop.setInteractive();

    // 2. Themed Modal Box
    const uiScale = CuteUI.getUIScale(this);
    const hasThreeButtons = this.gameMode === 'challenge' && !isVictory;
    const cardW = Math.min(width - 36, Math.round(380 * uiScale));
    const cardH = Math.round((hasThreeButtons ? 390 : 330) * uiScale);
    const halfW = cardW / 2;
    const halfH = cardH / 2;

    const box = this.add.graphics();
    const borderColor = isChampion ? 0xfeca57 : isVictory ? 0x2ed573 : 0xff4757;
    box.fillStyle(0x181028, 0.98);
    box.fillRoundedRect(-halfW, -halfH, cardW, cardH, Math.round(20 * uiScale));
    box.lineStyle(Math.round(3 * uiScale), borderColor, 1);
    box.strokeRoundedRect(-halfW, -halfH, cardW, cardH, Math.round(20 * uiScale));

    // Subtle header accent line
    box.lineStyle(Math.round(1.5 * uiScale), borderColor, 0.45);
    box.strokeLineShape(new Phaser.Geom.Line(-halfW + Math.round(24 * uiScale), -halfH + Math.round(68 * uiScale), halfW - Math.round(24 * uiScale), -halfH + Math.round(68 * uiScale)));

    // 3. Banner Title
    const titleColor = isChampion ? '#feca57' : isVictory ? '#2ed573' : '#ff4757';
    const titleText = this.add.text(0, -halfH + Math.round(38 * uiScale), finalBanner, {
      fontSize: `${Math.round(34 * uiScale)}px`,
      color: titleColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: Math.round(5 * uiScale)
    }).setOrigin(0.5);

    // 4. Character Quote / Flavor text
    const winningCharId = isVictory ? this.characterId : this.opponentCharacterId;
    const losingCharId = isVictory ? this.opponentCharacterId : this.characterId;
    const winChar = CHARACTERS.find((c) => c.id === winningCharId);
    const loseChar = CHARACTERS.find((c) => c.id === losingCharId);

    const subQuote = isChampion
      ? `All 7 rivals defeated! ${winChar?.name} is the Slime Champion!`
      : isVictory
      ? `${winChar?.name}: "${winChar?.quote}"`
      : `${loseChar?.name}: "${loseChar?.defeatQuote}"`;

    const quoteText = this.add.text(0, -halfH + Math.round(92 * uiScale), subQuote, {
      fontSize: `${Math.round(12.5 * uiScale)}px`,
      color: isChampion ? '#feca57' : isVictory ? '#7bed9f' : '#dfe4ea',
      fontStyle: 'italic bold',
      stroke: '#000000',
      strokeThickness: Math.round(2.5 * uiScale),
      align: 'center',
      wordWrap: { width: cardW - Math.round(40 * uiScale), useAdvancedWrap: true }
    }).setOrigin(0.5);

    // 5. Score summary pill
    const scoreSummary =
      this.gameMode === 'endless'
        ? `Final Score: ${this.playerScore.toLocaleString()}`
        : `You: ${this.playerScore.toLocaleString()}   |   Opponent: ${this.cpuScore.toLocaleString()}`;

    const scoreBox = this.add.graphics();
    scoreBox.fillStyle(0x0d071c, 0.92);
    scoreBox.fillRoundedRect(-cardW / 2 + Math.round(18 * uiScale), -halfH + Math.round(120 * uiScale), cardW - Math.round(36 * uiScale), Math.round(32 * uiScale), Math.round(10 * uiScale));
    scoreBox.lineStyle(1.2, 0x57606f, 0.6);
    scoreBox.strokeRoundedRect(-cardW / 2 + Math.round(18 * uiScale), -halfH + Math.round(120 * uiScale), cardW - Math.round(36 * uiScale), Math.round(32 * uiScale), Math.round(10 * uiScale));

    const scoreText = this.add.text(0, -halfH + Math.round(136 * uiScale), scoreSummary, {
      fontSize: `${Math.round(14 * uiScale)}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: Math.round(3 * uiScale)
    }).setOrigin(0.5);

    this.gameOverButtons = [];
    this.gameOverActions = [];

    // 6. Action buttons
    const btnW = Math.min(cardW - Math.round(48 * uiScale), Math.round(230 * uiScale));
    const btnH = Math.round(38 * uiScale);
    const btnFont = `${Math.round(13 * uiScale)}px`;
    const startBtnY = -halfH + Math.round(188 * uiScale);
    const btnSpacing = Math.round(52 * uiScale);

    if (this.gameMode === 'challenge') {
      if (isChampion) {
        const claimBtn = CuteUI.createPillButton(this, 0, startBtnY, 'CLAIM CHAMPION CROWN 🏆', () => {
          this.scene.start('ChallengeMapScene', {
            characterId: this.characterId,
            defeatedOpponents: this.defeatedOpponents
          });
        }, { textureKey: 'pill_pink', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

        const menuBtn = CuteUI.createPillButton(this, 0, startBtnY + btnSpacing, 'MAIN MENU', () => {
          this.scene.start('MenuScene');
        }, { textureKey: 'pill_grey', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

        this.gameOverButtons = [claimBtn, menuBtn];
        this.gameOverActions = [
          () => this.scene.start('ChallengeMapScene', { characterId: this.characterId, defeatedOpponents: this.defeatedOpponents }),
          () => this.scene.start('MenuScene')
        ];
      } else if (isVictory) {
        const nextBtn = CuteUI.createPillButton(this, 0, startBtnY, `NEXT CHALLENGER (${this.defeatedOpponents.length}/7)`, () => {
          this.scene.start('ChallengeMapScene', {
            characterId: this.characterId,
            defeatedOpponents: this.defeatedOpponents
          });
        }, { textureKey: 'pill_green', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

        const menuBtn = CuteUI.createPillButton(this, 0, startBtnY + btnSpacing, 'MAIN MENU', () => {
          this.scene.start('MenuScene');
        }, { textureKey: 'pill_grey', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

        this.gameOverButtons = [nextBtn, menuBtn];
        this.gameOverActions = [
          () => this.scene.start('ChallengeMapScene', { characterId: this.characterId, defeatedOpponents: this.defeatedOpponents }),
          () => this.scene.start('MenuScene')
        ];
      } else {
        const retryBtn = CuteUI.createPillButton(this, 0, startBtnY, 'RETRY MATCH', () => {
          this.scene.restart({
            mode: this.gameMode,
            characterId: this.characterId,
            opponentCharacterId: this.opponentCharacterId,
            defeatedOpponents: this.defeatedOpponents
          });
        }, { textureKey: 'pill_blue', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

        const mapBtn = CuteUI.createPillButton(this, 0, startBtnY + btnSpacing, 'CHALLENGE MAP', () => {
          this.scene.start('ChallengeMapScene', {
            characterId: this.characterId,
            defeatedOpponents: this.defeatedOpponents
          });
        }, { textureKey: 'pill_pink', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

        const menuBtn = CuteUI.createPillButton(this, 0, startBtnY + btnSpacing * 2, 'MAIN MENU', () => {
          this.scene.start('MenuScene');
        }, { textureKey: 'pill_grey', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

        this.gameOverButtons = [retryBtn, mapBtn, menuBtn];
        this.gameOverActions = [
          () => this.scene.restart({
            mode: this.gameMode,
            characterId: this.characterId,
            opponentCharacterId: this.opponentCharacterId,
            defeatedOpponents: this.defeatedOpponents
          }),
          () => this.scene.start('ChallengeMapScene', { characterId: this.characterId, defeatedOpponents: this.defeatedOpponents }),
          () => this.scene.start('MenuScene')
        ];
      }
    } else if (this.gameMode === 'vs_online') {
      const lobbyBtn = CuteUI.createPillButton(this, 0, startBtnY, 'FIND NEXT MATCH ⚡', () => {
        this.scene.start('LobbyScene', { characterId: this.characterId });
      }, { textureKey: 'pill_green', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

      const menuBtn = CuteUI.createPillButton(this, 0, startBtnY + btnSpacing, 'MAIN MENU', () => {
        this.scene.start('MenuScene');
      }, { textureKey: 'pill_grey', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

      this.gameOverButtons = [lobbyBtn, menuBtn];
      this.gameOverActions = [
        () => this.scene.start('LobbyScene', { characterId: this.characterId }),
        () => this.scene.start('MenuScene')
      ];
    } else {
      const playAgainBtn = CuteUI.createPillButton(this, 0, startBtnY, 'PLAY AGAIN', () => {
        this.scene.restart({
          mode: this.gameMode,
          characterId: this.characterId,
          opponentCharacterId: this.opponentCharacterId
        });
      }, { textureKey: 'pill_green', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

      const menuBtn = CuteUI.createPillButton(this, 0, startBtnY + btnSpacing, 'MAIN MENU', () => {
        this.scene.start('MenuScene');
      }, { textureKey: 'pill_grey', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

      this.gameOverButtons = [playAgainBtn, menuBtn];
      this.gameOverActions = [
        () => this.scene.restart({
          mode: this.gameMode,
          characterId: this.characterId,
          opponentCharacterId: this.opponentCharacterId
        }),
        () => this.scene.start('MenuScene')
      ];
    }

    this.gameOverModalContainer.add([
      backdrop,
      box,
      titleText,
      quoteText,
      scoreBox,
      scoreText,
      ...this.gameOverButtons
    ]);

    this.gameOverModalIndex = 0;
    this.updateGameOverButtonSelection();

    // Bouncy pop-in tween!
    this.gameOverModalContainer.setScale(0.72);
    this.gameOverModalContainer.setAlpha(0);
    this.tweens.add({
      targets: this.gameOverModalContainer,
      scale: 1,
      alpha: 1,
      duration: 320,
      ease: 'Back.easeOut'
    });
  }
}
