import Phaser from 'phaser';
import Board, { MatchEvent, GarbageLandEvent } from '../objects/Board';
import Cursor from '../objects/Cursor';
import AIBot, { AIDifficulty } from '../objects/AIBot';
import SocketManager, { GameAction } from '../net/SocketManager';
import { TouchController } from '../input/TouchController';
import { computeVsLayout, animateBallisticGarbageArc } from '../ui/VsLayout';
import {
  BOARD_WIDTH,
  BOARD_VISIBLE_HEIGHT,
  PANEL_SIZE,
  CHARACTERS
} from '../utils/Constants';
import { SoundFx } from '../utils/SoundFx';
import { CuteUI } from '../utils/CuteUI';
import { randomInt } from '../utils/Helpers';
import { Settings, KeyBindings } from '../utils/Settings';
import { GameDifficulty, getDifficultyInfo } from '../utils/Difficulty';
import { RecordManager } from '../utils/DifficultyRecords';
import { LeaderboardClient } from '../utils/LeaderboardClient';
import { StatsManager } from '../utils/StatsManager';
import { TelemetryClient } from '../utils/TelemetryClient';

export default class GameScene extends Phaser.Scene {
  public gameMode: 'vs_cpu' | 'endless' | 'vs_online' | 'challenge' = 'challenge';
  public characterId: string = 'kiri';
  public opponentCharacterId: string = 'mizu';
  public defeatedOpponents: string[] = [];
  public difficulty: GameDifficulty = GameDifficulty.ADEPT;
  public initialChallengeScore: number = 0;
  public roundScore: number = 0;
  public cumulativeChallengeTime: number = 0;
  private endlessBestText?: Phaser.GameObjects.Text;

  // Match-scoped Telemetry
  private matchSwaps: number = 0;
  private matchFastLifts: number = 0;
  private matchPanelsCleared: number = 0;
  private matchGarbageCleared: number = 0;
  private matchCombos4: number = 0;
  private matchCombos5: number = 0;
  private matchCombos6Plus: number = 0;
  private matchChains2: number = 0;
  private matchChains3: number = 0;
  private matchChains4: number = 0;
  private matchChains5Plus: number = 0;
  private playerPowerActivationsCount: number = 0;
  private cpuPowerActivationsCount: number = 0;
  private lastInputDevice: 'keyboard' | 'touch' | 'gamepad' = 'keyboard';

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
  private playerWoodBackdrop?: Phaser.GameObjects.Image;
  private playerSpeechBubble?: Phaser.GameObjects.Text;
  private playerDangerText?: Phaser.GameObjects.Text;
  private playerHazardVignette?: Phaser.GameObjects.Graphics;
  private playerHazardTween?: Phaser.Tweens.Tween;

  // Super Power HUD
  private playerPowerContainer?: Phaser.GameObjects.Container;
  private playerPowerBar?: Phaser.GameObjects.Graphics;
  private playerPowerText?: Phaser.GameObjects.Text;
  private playerPowerGlowTween?: Phaser.Tweens.Tween;
  private lastPlayerPowerMeter: number = -1;
  private lastPlayerPowerReady: boolean = false;

  private cpuPowerContainer?: Phaser.GameObjects.Container;
  private cpuPowerBar?: Phaser.GameObjects.Graphics;
  private cpuPowerText?: Phaser.GameObjects.Text;
  private lastCpuPowerMeter: number = -1;

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
  private cpuWoodBackdrop?: Phaser.GameObjects.Image;
  private cpuSpeechBubble?: Phaser.GameObjects.Text;
  private cpuDangerText?: Phaser.GameObjects.Text;
  private lastRiffPowerChordTime: number = 0;

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
  private matchStartTimeMs: number = 0;
  private fpsSampleTimer: number = 0;
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
  private touchController?: TouchController;

  // Online Multiplayer State
  private roomId: string = '';
  private isPlayer1: boolean = true;
  private matchSeed: number = 0;
  private lastSentCursorX: number = -1;
  private lastSentCursorY: number = -1;
  private isRematchRequested: boolean = false;
  private opponentWantsRematch: boolean = false;
  private opponentDisconnected: boolean = false;
  private onlinePlayAgainBtnText?: Phaser.GameObjects.Text;
  public matchBackgroundKey: string = '';

  private initialData: any = {};

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: any): void {
    this.initialData = data ? { ...data } : {};
    this.gameMode = data?.mode || 'challenge';
    this.characterId = data?.characterId || 'kiri';
    this.defeatedOpponents = data?.defeatedOpponents || [];
    this.difficulty = this.gameMode === 'vs_online'
      ? GameDifficulty.ADEPT
      : (data?.difficulty || Settings.difficulty || GameDifficulty.ADEPT);

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

    // Determine custom thematically appropriate background and grid frame
    this.matchBackgroundKey = this.getMatchBackgroundKey();
    const bgKey = `bg_${this.matchBackgroundKey}`;
    if (!this.textures.exists(bgKey)) {
      this.load.image(bgKey, `assets/ui/backgrounds/bg_${this.matchBackgroundKey}.webp?v=bg_v1`);
    }
    const frameKey = `board_frame_${this.matchBackgroundKey}`;
    if (!this.textures.exists(frameKey)) {
      this.load.image(frameKey, `assets/ui/frames/board_frame_${this.matchBackgroundKey}.webp?v=fr_v1`);
    }

    this.playerWoodFrame = undefined;
    this.cpuWoodFrame = undefined;
    this.playerWoodBackdrop = undefined;
    this.cpuWoodBackdrop = undefined;

    // On-demand load character attack spritesheets and battle music if not already in cache
    const matchChars = [this.characterId, this.opponentCharacterId].filter(Boolean);
    matchChars.forEach((cid) => {
      const sheetKey = `${cid}_attack`;
      if (!this.textures.exists(sheetKey)) {
        this.load.spritesheet(sheetKey, `assets/sprites/characters/${cid}_attack.webp?v=wbp_v3`, {
          frameWidth: 256,
          frameHeight: 256
        });
      }
    });
    if (!this.cache.audio.exists('battle_cpu')) {
      this.load.audio('battle_cpu', 'assets/audio/bgm/battle_cpu.mp3');
    }
    if (!this.cache.audio.exists('panic')) {
      this.load.audio('panic', 'assets/audio/bgm/panic.mp3');
    }
    if (this.load.list.size > 0) {
      this.load.start();
    }

    this.initialChallengeScore = (this.gameMode === 'challenge') ? (Number(data?.challengeScore) || 0) : 0;
    this.cumulativeChallengeTime = (this.gameMode === 'challenge') ? (Number(data?.challengeElapsedSeconds) || 0) : 0;
    this.roundScore = 0;
    this.playerScore = this.initialChallengeScore;
    this.cpuScore = 0;
    this.gameTime = (this.gameMode === 'endless') ? 0 : 240;
    this.isMatchOver = false;
    this.isPaused = false;
    this.pauseModalContainer = undefined;
    this.pauseButtons = [];
    this.pauseActions = [];
    this.pauseModalIndex = 0;
    this.isRematchRequested = false;
    this.opponentWantsRematch = false;
    this.opponentDisconnected = false;
    this.onlinePlayAgainBtnText = undefined;
    this.gameOverModalContainer = undefined;
    this.gameOverButtons = [];
    this.gameOverActions = [];
    this.gameOverModalIndex = 0;
    this.gameOverPadRepeatTimer = 0;
    this.lastMouseX = -1;
    this.lastMouseY = -1;

    this.matchSwaps = 0;
    this.matchFastLifts = 0;
    this.matchPanelsCleared = 0;
    this.matchGarbageCleared = 0;
    this.matchCombos4 = 0;
    this.matchCombos5 = 0;
    this.matchCombos6Plus = 0;
    this.matchChains2 = 0;
    this.matchChains3 = 0;
    this.matchChains4 = 0;
    this.matchChains5Plus = 0;
    this.playerPowerActivationsCount = 0;
    this.cpuPowerActivationsCount = 0;
    this.lastInputDevice = 'keyboard';
  }

  /**
   * Determine the custom thematic background key for the match:
   * - In an online match, chosen at random (synced across room via match seed if present).
   * - In endless mode, chosen at random across all character stages.
   * - When facing a character (challenge mode, vs_cpu, etc.), custom background of that character.
   */
  public getMatchBackgroundKey(): string {
    return CuteUI.selectMatchBackground({
      gameMode: this.gameMode,
      characterId: this.characterId,
      opponentCharacterId: this.opponentCharacterId,
      matchSeed: this.matchSeed
    });
  }

  create(): void {
    if (this.cache.audio.exists('battle_cpu')) {
      this.sound.stopAll();
      this.sound.play('battle_cpu', { loop: true, volume: Settings.musicVolume });
    }

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Custom thematically appropriate battle stage background with matching ambient particles
    CuteUI.createCuteBackground(this, this.matchBackgroundKey || this.getMatchBackgroundKey());

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

    // Telemetry tracking
    this.matchStartTimeMs = Date.now();
    this.fpsSampleTimer = 0;
    StatsManager.recordMatchStart(this.gameMode, this.characterId);
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
    const diffInfo = getDifficultyInfo(this.difficulty);

    if (isMobilePortrait) {
      // ===== PHASE 4 HERO & RADAR ASYMMETRIC MOBILE LAYOUT =====
      const vsLayout = computeVsLayout(width, height);

      // 1. Bottom Fast-Lift Bar (thumb-friendly target)
      const liftBarH = vsLayout.bottomGutter.height;
      const liftBarY = vsLayout.bottomGutter.y + liftBarH / 2;
      const liftBarTop = vsLayout.bottomGutter.y;

      // 2. Opponent Radar Monitor at Top-Right (Top 28%)
      this.cpuBoardScale = vsLayout.opponentRadar.scale;
      const p2BoardW = vsLayout.opponentRadar.width;
      const p2BoardH = vsLayout.opponentRadar.height;
      const p2X = vsLayout.opponentRadar.x;
      const p2Y = vsLayout.opponentRadar.y;

      this.boardP2X = p2X;
      this.boardP2Y = p2Y;

      this.cpuBorder = this.add.graphics();
      this.cpuBorder.setDepth(21);
      this.drawBoardFrame(this.cpuBorder, p2X, p2Y, p2BoardW, p2BoardH, p2Color, false);
      this.cpuBoard = new Board(this, p2X, p2Y, this.cpuBoardScale);
      this.cpuBoard.characterId = this.opponentCharacterId;
      this.cpuBoard.applyDifficulty(this.difficulty);
      this.cpuBoard.addInitialPanels(Math.min(diffInfo.initialRows, 5), diffInfo.initialGarbageSlabs);
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
      p2Sign.setDisplaySize(p2PlaqueW, 34);

      const p2Badge = CuteUI.createPillButton(this, -p2PlaqueW / 2 + 18, 0, p2Label, () => {}, {
        textureKey: 'pill_blue',
        fontSize: '12px',
        width: 36,
        height: 22,
        shadow: false,
        autoScale: false
      });

      const p2NameText = this.add.text(-p2PlaqueW / 2 + 40, -7, p2Char.name, {
        fontSize: '14px',
        color: '#fff3c4',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: 2
      });

      this.cpuScoreText = this.add.text(-p2PlaqueW / 2 + 40, 7, 'SCORE: 0', {
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: 2
      });

      this.cpuPowerText = this.add.text(p2PlaqueW / 2 - 24, 0, '⚡ 0%', {
        fontSize: '11px',
        color: '#54a0ff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);

      p2Header.add([p2Sign, p2Badge, p2NameText, this.cpuScoreText, this.cpuPowerText]);

      // Timer Plaque at bottom of top section
      const timerContainer = this.add.container(leftColCenterX, topSectionBottom - 16);
      timerContainer.setDepth(30);

      const timerPlaque = this.add.image(0, 0, 'wood_plaque_sign');
      timerPlaque.setDisplaySize(Math.min(leftColW, 110), 32);

      const clockIcon = this.add.image(-26, 0, 'wood_clock_icon');
      clockIcon.setDisplaySize(18, 18);

      this.timeText = this.add.text(8, -1, this.formatTime(this.gameTime), {
        fontSize: '15px',
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

      // 3. Player 1 Board at the bottom (Hero 60% viewport with 48px-56px touch targets)
      this.playerBoardScale = vsLayout.playerGrid.scale;
      const p1BoardW = vsLayout.playerGrid.width;
      const p1BoardH = vsLayout.playerGrid.height;
      const p1X = vsLayout.playerGrid.x;
      const p1Y = vsLayout.playerGrid.y;

      this.boardP1X = p1X;
      this.boardP1Y = p1Y;

      // P1 Board Frame & Board
      this.playerBorder = this.add.graphics();
      this.playerBorder.setDepth(21);
      this.drawBoardFrame(this.playerBorder, p1X, p1Y, p1BoardW, p1BoardH, 0xff69b4, true);
      this.playerBoard = new Board(this, p1X, p1Y, this.playerBoardScale);
      this.playerBoard.characterId = this.characterId;
      this.playerBoard.applyDifficulty(this.difficulty);
      this.playerBoard.addInitialPanels(Math.min(diffInfo.initialRows, 5), diffInfo.initialGarbageSlabs);
      this.playerCursor = new Cursor(this, this.playerBoard);

      // P1 Header Plaque above board
      const p1PlaqueW = Math.min(p1BoardW - 8, width - 24);
      const p1Header = this.add.container(p1X + p1BoardW / 2, p1Y - 18);
      p1Header.setDepth(24);
      const p1Sign = this.add.image(0, 0, 'wood_plaque_sign');
      p1Sign.setDisplaySize(p1PlaqueW, 34);

      const p1Badge = CuteUI.createPillButton(this, -p1PlaqueW / 2 + 18, 0, 'P1', () => {}, {
        textureKey: 'pill_pink',
        fontSize: '12px',
        width: 34,
        height: 22,
        shadow: false,
        autoScale: false
      });

      this.playerMascot = this.add.image(-p1PlaqueW / 2 + 46, 0, p1Char.id);
      this.playerMascot.setDisplaySize(26, 26);

      const p1NameText = this.add.text(-p1PlaqueW / 2 + 66, -7, p1Char.name, {
        fontSize: '14px',
        color: '#fff3c4',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: 2
      });

      this.playerScoreText = this.add.text(-p1PlaqueW / 2 + 66, 7, `SCORE: ${this.playerScore.toLocaleString()}`, {
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: 2
      });

      const p1DiffBadge = this.add.text(p1PlaqueW / 2 - 38, 0, diffInfo.badgeText, {
        fontSize: '12px',
        color: diffInfo.hexColor,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);

      p1Header.add([p1Sign, p1Badge, this.playerMascot, p1NameText, this.playerScoreText, p1DiffBadge]);

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
      this.playerBoard.characterId = this.characterId;
      this.playerBoard.applyDifficulty(this.difficulty);
      this.playerBoard.addInitialPanels(Math.min(diffInfo.initialRows, 5), diffInfo.initialGarbageSlabs);
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
        fontSize: `${Math.round(12.5 * boardScaleRatio)}px`,
        width: badgeW,
        height: badgeH,
        shadow: false,
        autoScale: false
      });

      const p1NameText = this.add.text(-p1PlaqueW / 2 + Math.round(50 * boardScaleRatio), -Math.round(7 * boardScaleRatio), p1Char.name, {
        fontSize: `${Math.round(15 * boardScaleRatio)}px`,
        color: '#fff3c4',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: Math.round(2.5 * (boardScaleRatio > 1.3 ? 1.3 : 1.0))
      });

      this.playerScoreText = this.add.text(-p1PlaqueW / 2 + Math.round(50 * boardScaleRatio), Math.round(7 * boardScaleRatio), `SCORE: ${this.playerScore.toLocaleString()}`, {
        fontSize: `${Math.round(13.5 * boardScaleRatio)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: 2
      });

      const p1DiffBadge = this.add.text(p1PlaqueW / 2 - Math.round(38 * boardScaleRatio), 0, diffInfo.badgeText, {
        fontSize: `${Math.round(12.5 * boardScaleRatio)}px`,
        color: diffInfo.hexColor,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);

      p1Header.add([p1Sign, p1Badge, p1NameText, this.playerScoreText, p1DiffBadge]);

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
      this.cpuBoard.characterId = this.opponentCharacterId;
      this.cpuBoard.applyDifficulty(this.difficulty);
      this.cpuBoard.addInitialPanels(Math.min(diffInfo.initialRows, 5), diffInfo.initialGarbageSlabs);
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
        fontSize: `${Math.round(12.5 * boardScaleRatio)}px`,
        width: badgeW + 4,
        height: badgeH,
        shadow: false,
        autoScale: false
      });

      const p2NameText = this.add.text(-p2PlaqueW / 2 + Math.round(54 * boardScaleRatio), -Math.round(7 * boardScaleRatio), p2Char.name, {
        fontSize: `${Math.round(15 * boardScaleRatio)}px`,
        color: '#fff3c4',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: Math.round(2.5 * (boardScaleRatio > 1.3 ? 1.3 : 1.0))
      });

      this.cpuScoreText = this.add.text(-p2PlaqueW / 2 + Math.round(54 * boardScaleRatio), Math.round(7 * boardScaleRatio), 'SCORE: 0', {
        fontSize: `${Math.round(13.5 * boardScaleRatio)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#3e2415',
        strokeThickness: 2
      });

      const p2DiffBadge = this.add.text(p2PlaqueW / 2 - Math.round(38 * boardScaleRatio), 0, diffInfo.badgeText, {
        fontSize: `${Math.round(12.5 * boardScaleRatio)}px`,
        color: diffInfo.hexColor,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);

      this.cpuPowerText = this.add.text(p2PlaqueW / 2 - Math.round(94 * boardScaleRatio), 0, '⚡ 0%', {
        fontSize: `${Math.round(12 * boardScaleRatio)}px`,
        color: '#54a0ff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);

      p2Header.add([p2Sign, p2Badge, p2NameText, this.cpuScoreText, this.cpuPowerText, p2DiffBadge]);

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
        this.difficulty,
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
    this.playerBoard.on('garbageLand', (e: GarbageLandEvent) => this.handleGarbageLand(e, true));
    this.playerBoard.on('garbageCleared', (e: { count: number }) => {
      this.matchGarbageCleared += (e.count || 1);
      StatsManager.recordGarbageCleared(e.count);
    });
    this.playerBoard.on('dangerStart', () => {
      this.triggerAvatarHurt(true);
      this.updateDangerUI(true, true, this.playerBoard.dangerGraceDuration / 1000);
      this.setBgmTension(true);
    });
    this.playerBoard.on('dangerPulse', (e: { remainingMs: number }) => {
      this.updateDangerUI(true, true, e.remainingMs / 1000);
    });
    this.playerBoard.on('dangerEnd', () => {
      this.updateDangerUI(true, false);
      if (!this.cpuBoard?.isDanger) {
        this.setBgmTension(false);
      }
    });
    this.playerBoard.on('topOut', () => {
      if (this.gameMode === 'vs_online') {
        this.sendNetAction({ type: 'topOut' });
      }
      this.endMatch('DEFEAT!', false);
    });

    // Wire Player 1 Super Power Events
    this.playerBoard.on('powerMeterChange', (e: { meter: number }) => this.updatePlayerPowerUI(e.meter));
    this.playerBoard.on('powerReady', () => {
      SoundFx.playVictory();
    });
    this.playerBoard.on('powerActivated', (data: any) => {
      this.playerPowerActivationsCount++;
      this.showSuperPowerBanner(true, data.characterId, data.powerName);
      this.triggerAvatarAttack(true);
      this.triggerPowerVisualEffects(true, data.characterId);
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
      this.cpuBoard.on('garbageLand', (e: GarbageLandEvent) => this.handleGarbageLand(e, false));
      this.cpuBoard.on('dangerStart', () => {
        this.triggerAvatarHurt(false);
        this.updateDangerUI(false, true, this.cpuBoard!.dangerGraceDuration / 1000);
      });
      this.cpuBoard.on('dangerPulse', (e: { remainingMs: number }) => {
        this.updateDangerUI(false, true, e.remainingMs / 1000);
      });
      this.cpuBoard.on('dangerEnd', () => {
        this.updateDangerUI(false, false);
        if (!this.playerBoard.isDanger) {
          this.setBgmTension(false);
        }
      });
      if (this.gameMode !== 'vs_online') {
        this.cpuBoard.on('topOut', () => this.endMatch('VICTORY!', true));
      }

      // Wire CPU Super Power Events
      this.cpuBoard.on('powerMeterChange', (e: { meter: number }) => this.updateCpuPowerUI(e.meter));
      this.cpuBoard.on('powerActivated', (data: any) => {
        this.cpuPowerActivationsCount++;
        this.showSuperPowerBanner(false, data.characterId, data.powerName);
        this.triggerAvatarAttack(false);
        this.triggerPowerVisualEffects(false, data.characterId);
      });
    }

    // Wire Online Network Events
    if (this.gameMode === 'vs_online' && this.socketMgr) {
      this.socketMgr.onOpponentAction((action: GameAction) => {
        try {
          if (!action || typeof action !== 'object' || !this.scene.isActive()) return;

          if (action.type === 'cursor' && action.payload) {
            if (this.cpuCursor) {
              const x = typeof action.payload.x === 'number' && Number.isFinite(action.payload.x)
                ? action.payload.x
                : typeof action.payload.col === 'number' && Number.isFinite(action.payload.col)
                ? action.payload.col
                : 0;
              const y = typeof action.payload.y === 'number' && Number.isFinite(action.payload.y)
                ? action.payload.y
                : typeof action.payload.row === 'number' && Number.isFinite(action.payload.row)
                ? action.payload.row
                : 0;
              this.cpuCursor.setGridPosition(x, y);
              this.cpuCursor.updatePosition();
            }
          } else if (action.type === 'swap' && action.payload) {
            if (this.cpuBoard) {
              const x = typeof action.payload.x === 'number' && Number.isInteger(action.payload.x)
                ? action.payload.x
                : typeof action.payload.col === 'number' && Number.isInteger(action.payload.col)
                ? action.payload.col
                : undefined;
              const y = typeof action.payload.y === 'number' && Number.isInteger(action.payload.y)
                ? action.payload.y
                : typeof action.payload.row === 'number' && Number.isInteger(action.payload.row)
                ? action.payload.row
                : undefined;
              if (x !== undefined && y !== undefined) {
                this.cpuBoard.swap(x, y);
              }
            }
          } else if (action.type === 'lift' && action.payload) {
            if (this.cpuBoard) {
              this.cpuBoard.setLifting(Boolean(action.payload.lifting));
            }
          } else if (action.type === 'board_sync' && action.payload) {
            if (this.cpuBoard && Array.isArray(action.payload.grid)) {
              this.cpuBoard.applyGridSnapshot(
                action.payload.grid,
                typeof action.payload.stackOffset === 'number' && Number.isFinite(action.payload.stackOffset)
                  ? action.payload.stackOffset
                  : undefined,
                Array.isArray(action.payload.garbage) ? action.payload.garbage : undefined
              );
            }
          } else if (action.type === 'attack' && action.payload) {
            const width = Math.max(1, Math.min(BOARD_WIDTH, Number(action.payload.width) || 3));
            const height = Math.max(1, Math.min(4, Number(action.payload.height) || 1));
            const col = typeof action.payload.col === 'number' && Number.isFinite(action.payload.col) ? action.payload.col : undefined;

            const startX = this.boardP2X + (BOARD_WIDTH * PANEL_SIZE * this.cpuBoardScale) / 2;
            const startY = this.boardP2Y;
            const endX = this.boardP1X + (BOARD_WIDTH * PANEL_SIZE * this.playerBoardScale) / 2;
            const endY = this.boardP1Y - 12;

            this.triggerAvatarAttack(false);
            animateBallisticGarbageArc(this, startX, startY, endX, endY, width, () => {
              try {
                if (!this.scene.isActive() || !this.playerBoard) return;
                this.playerBoard.queueGarbage(width, height, col);
                this.showAttackAlert(false, height, width);
                this.triggerAvatarHurt(true);
                this.cameras?.main?.shake(60, 0.002);
              } catch (err) {
                console.warn('Error in incoming attack animation complete:', err);
              }
            });
          } else if (action.type === 'super_power_activated' && action.payload) {
            if (this.cpuBoard) {
              this.cpuBoard.activatePower(this.playerBoard);
            }
          } else if (action.type === 'topOut') {
            this.endMatch('VICTORY!', true);
          }
        } catch (err) {
          console.warn('Error handling opponent action:', err);
        }
      });

      this.socketMgr.onOpponentRematchRequested(() => {
        this.opponentWantsRematch = true;
        SoundFx.playDecide();
        if (this.onlinePlayAgainBtnText && !this.isRematchRequested) {
          this.onlinePlayAgainBtnText.setText('PLAY AGAIN (READY!)');
        }
      });

      this.socketMgr.onGameRestart((payload: any) => {
        SoundFx.playMatch();
        if (this.onlinePlayAgainBtnText) {
          this.onlinePlayAgainBtnText.setText('REMATCH STARTING!');
        }
        this.time.delayedCall(500, () => {
          this.isRematchRequested = true;
          this.scene.restart({
            mode: 'vs_online',
            roomId: payload.roomId || this.roomId,
            seed: payload.seed,
            characterId: this.characterId,
            opponentCharacterId: this.opponentCharacterId,
            isPlayer1: this.isPlayer1
          });
        });
      });

      this.socketMgr.onOpponentDisconnected(() => {
        this.opponentDisconnected = true;
        if (!this.isMatchOver) {
          this.endMatch('OPPONENT LEFT - YOU WIN!', true);
        } else if (this.onlinePlayAgainBtnText) {
          this.onlinePlayAgainBtnText.setText('OPPONENT LEFT');
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
              isDanger: this.playerBoard.isDanger,
              garbage: this.playerBoard.serializeGarbage()
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
    this.playerBoard.characterId = this.characterId;
    this.playerBoard.applyDifficulty(this.difficulty);
    const diffInfo = getDifficultyInfo(this.difficulty);
    this.playerBoard.addInitialPanels(diffInfo.initialRows, diffInfo.initialGarbageSlabs);
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
      fontSize: `${Math.round(12.5 * boardScaleRatio)}px`,
      width: badgeW,
      height: badgeH,
      shadow: false,
      autoScale: false
    });

    this.playerScoreText = this.add.text(-plaqueW / 2 + Math.round(78 * boardScaleRatio), -Math.round(8 * boardScaleRatio), `SCORE: ${this.playerScore.toLocaleString()}`, {
      fontSize: `${Math.round(14 * boardScaleRatio)}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#3e2415',
      strokeThickness: 2
    });

    const diffBadge = this.add.text(-plaqueW / 2 + Math.round(78 * boardScaleRatio), Math.round(7 * boardScaleRatio), diffInfo.badge, {
      fontSize: `${Math.round(12.5 * boardScaleRatio)}px`,
      color: diffInfo.hexColor,
      fontStyle: 'bold',
      stroke: '#3e2415',
      strokeThickness: 2
    });

    const bestScore = RecordManager.getEndlessHighScore(this.difficulty);
    this.endlessBestText = this.add.text(-plaqueW / 2 + Math.round(175 * boardScaleRatio), -Math.round(8 * boardScaleRatio), `BEST: ${bestScore > 0 ? bestScore.toLocaleString() : '---'}`, {
      fontSize: `${Math.round(13.5 * boardScaleRatio)}px`,
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#3e2415',
      strokeThickness: 2
    });

    const clockIcon = this.add.image(plaqueW / 2 - Math.round(76 * boardScaleRatio), 0, 'wood_clock_icon');
    clockIcon.setDisplaySize(Math.round(18 * boardScaleRatio), Math.round(18 * boardScaleRatio));

    this.timeText = this.add.text(plaqueW / 2 - Math.round(38 * boardScaleRatio), -1, this.formatTime(this.gameTime), {
      fontSize: `${Math.round(15 * boardScaleRatio)}px`,
      color: '#fff3c4',
      fontStyle: 'bold',
      stroke: '#3e2415',
      strokeThickness: 2
    }).setOrigin(0.5);

    header.add([sign, charBadge, this.playerScoreText, diffBadge, this.endlessBestText, clockIcon, this.timeText]);

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
    this.playerBoard.on('garbageLand', (e: GarbageLandEvent) => this.handleGarbageLand(e, true));
    this.playerBoard.on('garbageCleared', (e: { count: number }) => {
      this.matchGarbageCleared += (e.count || 1);
      StatsManager.recordGarbageCleared(e.count);
    });
    this.playerBoard.on('dangerStart', () => {
      this.triggerAvatarHurt(true);
      this.updateDangerUI(true, true, this.playerBoard.dangerGraceDuration / 1000);
      this.setBgmTension(true);
    });
    this.playerBoard.on('dangerPulse', (e: { remainingMs: number }) => {
      this.updateDangerUI(true, true, e.remainingMs / 1000);
    });
    this.playerBoard.on('dangerEnd', () => {
      this.updateDangerUI(true, false);
      this.setBgmTension(false);
    });
    this.playerBoard.on('topOut', () => this.endMatch('TOP OUT!', false));

    // Wire Endless Mode Power Events
    this.playerBoard.on('powerMeterChange', (e: { meter: number }) => this.updatePlayerPowerUI(e.meter));
    this.playerBoard.on('powerReady', () => {
      SoundFx.playVictory();
    });
    this.playerBoard.on('powerActivated', (data: any) => {
      this.playerPowerActivationsCount++;
      this.showSuperPowerBanner(true, data.characterId, data.powerName);
      this.triggerAvatarAttack(true);
      this.triggerPowerVisualEffects(true, data.characterId);
    });

    // Periodic arcade garbage challenge in Endless mode
    this.time.addEvent({
      delay: 22000,
      callback: () => {
        if (!this.isMatchOver && !this.playerBoard.isDanger && !this.playerBoard.isTopOut) {
          const width = Math.random() < 0.6 ? 3 : 6;
          this.playerBoard.queueGarbage(width, 1);
          this.showAttackAlert(false, 1);
          this.triggerAvatarHurt(true);
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
    let backdrop = isPlayer ? this.playerWoodBackdrop : this.cpuWoodBackdrop;
    if (!backdrop && this.textures.exists('board_wood_backdrop')) {
      backdrop = this.add.image(x, y, 'board_wood_backdrop');
      backdrop.setName(isPlayer ? 'p1_wood_backdrop' : 'cpu_wood_backdrop');
      backdrop.setOrigin(0, 0);
      backdrop.setDisplaySize(w, h);
      backdrop.setDepth(1); // Behind board container (depth 10)
      if (isPlayer) this.playerWoodBackdrop = backdrop;
      else this.cpuWoodBackdrop = backdrop;
    } else if (backdrop) {
      backdrop.setPosition(x, y);
      backdrop.setDisplaySize(w, h);
    }

    // 2. High-res themed frame for the grid matching the current background
    let frameImg = isPlayer ? this.playerWoodFrame : this.cpuWoodFrame;
    const themedFrameKey = `board_frame_${this.matchBackgroundKey}`;
    const frameKey = (this.matchBackgroundKey && this.textures.exists(themedFrameKey))
      ? themedFrameKey
      : (this.textures.exists('board_wood_frame') ? 'board_wood_frame' : '');

    if (frameKey && this.textures.exists(frameKey)) {
      const tex = this.textures.get(frameKey);
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
        frameImg = this.add.image(frameX, frameY, frameKey);
        frameImg.setName(isPlayer ? 'p1_wood_frame' : 'cpu_wood_frame');
        frameImg.setOrigin(0, 0);
        frameImg.setScale(frameScale);
        frameImg.setDepth(5); // Render behind slimes (depth 10) so the slimes are ALWAYS 100% visible!

        if (isPlayer) this.playerWoodFrame = frameImg;
        else this.cpuWoodFrame = frameImg;
      } else {
        frameImg.setTexture(frameKey);
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

      if (isPlayer) {
        if (!this.playerHazardVignette) {
          this.playerHazardVignette = this.add.graphics();
          this.playerHazardVignette.setDepth(20);
        }
        this.playerHazardVignette.clear();
        this.playerHazardVignette.setVisible(true);

        // Ceiling danger hazard overlay across top rows (rows 10-12)
        const ceilingH = Math.round(3 * PANEL_SIZE * scale);
        // Red gradient wash
        this.playerHazardVignette.fillGradientStyle(0xff4757, 0xff4757, 0xff0000, 0x000000, 0.65, 0.65, 0.05, 0.0);
        this.playerHazardVignette.fillRect(boardX, boardY, boardW, ceilingH);

        // Warning hazard stripe accents along ceiling border
        this.playerHazardVignette.lineStyle(2, 0xffffff, 0.4);
        for (let i = 0; i < boardW; i += 16) {
          this.playerHazardVignette.lineBetween(boardX + i, boardY, boardX + i + 8, boardY + 12);
        }

        // Pulse tween
        if (!this.playerHazardTween) {
          this.playerHazardTween = this.tweens.add({
            targets: this.playerHazardVignette,
            alpha: 0.25,
            duration: 320,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }
      }
    } else {
      this.drawBoardFrame(borderObj, boardX, boardY, boardW, boardH, defaultColor, isPlayer);
      if (textObj) {
        textObj.setText('');
      }
      if (isPlayer && this.playerHazardVignette) {
        if (this.playerHazardTween) {
          this.playerHazardTween.stop();
          this.playerHazardTween = undefined;
        }
        this.playerHazardVignette.setVisible(false);
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

  private triggerPlayerSwap(gx: number, gy: number, inputType: 'keyboard' | 'touch' | 'gamepad' = 'keyboard'): boolean {
    const success = this.playerBoard.swap(gx, gy);
    if (success) {
      this.matchSwaps++;
      this.lastInputDevice = inputType;
      StatsManager.recordSwap(inputType);
      if (this.gameMode === 'vs_online') {
        this.sendNetAction({
          type: 'swap',
          payload: { x: gx, y: gy }
        });
      }
    }
    return success;
  }

  private setPlayerLifting(lifting: boolean): void {
    if (lifting && this.playerBoard && !this.playerBoard.isLifting) {
      this.matchFastLifts++;
      StatsManager.recordFastLift();
    }
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

      // Super Power Burst (E / Q / Z / F / custom key)
      if (this.matchesAction(event, 'power', ['E', 'KeyE', 'Q', 'KeyQ', 'Z', 'KeyZ', 'F', 'KeyF'])) {
        this.triggerPlayerPower();
      }

      // Lift (Keydown)
      if (this.matchesAction(event, 'lift', ['SHIFT', 'R', 'ShiftLeft', 'ShiftRight'])) {
        this.setPlayerLifting(true);
      }

      // Garbage Test Hotkeys (Development only)
      if ((import.meta as any).env?.DEV) {
        if (event.code === 'KeyG') {
          this.playerBoard.queueGarbage(3, 1);
          this.showAttackAlert(false, 1);
          this.triggerAvatarHurt(true);
        } else if (event.code === 'KeyH') {
          this.playerBoard.queueGarbage(6, 1);
          this.showAttackAlert(false, 1);
          this.triggerAvatarHurt(true);
        } else if (event.code === 'KeyB') {
          this.playerBoard.queueGarbage(6, 2);
          this.showAttackAlert(false, 2);
          this.triggerAvatarHurt(true);
        } else if (event.code === 'KeyY' && this.cpuBoard) {
          this.cpuBoard.queueGarbage(3, 1);
          this.showAttackAlert(true, 1);
          this.triggerAvatarHurt(false);
        }
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
      if (this.touchController) {
        this.touchController.destroy();
        this.touchController = undefined;
      }
      if (this.cpuBot) {
        this.cpuBot.destroy();
        this.cpuBot = undefined;
      }
      if (this.playerBoard) {
        this.playerBoard.destroy();
      }
      if (this.cpuBoard) {
        this.cpuBoard.destroy();
        this.cpuBoard = undefined;
      }
      if (this.socketMgr) {
        this.socketMgr.removeGameListeners();
      }
      if (this.gameMode === 'vs_online' && this.socketMgr && this.roomId && !this.isRematchRequested) {
        this.socketMgr.leaveRoom(this.roomId);
      }
      SoundFx.stopAll();
      this.time.removeAllEvents();
      this.tweens.killAll();
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

    // Initialize Phase 2 Mobile Touch Controller (single-axis lock, 1:1 reciprocal drag, 0px offset for tactile precision)
    if (this.playerBoard) {
      this.touchController = new TouchController(this, this.playerBoard, this.playerCursor, {
        occlusionOffsetY: 0,
        onSwapCommit: (col, row) => {
          this.matchSwaps++;
          this.lastInputDevice = 'touch';
          StatsManager.recordSwap('touch');
          this.broadcastCursor();
          if (this.gameMode === 'vs_online') {
            this.sendNetAction({
              type: 'swap',
              payload: { x: col, y: row }
            });
          }
        }
      });
    }

    // 3. Pointer Down: Left-Click / Tap to swap, Right-Click to fast-lift
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isMatchOver || this.isPaused || !this.playerBoard || !this.playerCursor) return;

      // Method 1 for mouse-only lift: RIGHT-CLICK or Middle Click to fast lift!
      if (pointer.rightButtonDown() || pointer.button === 2 || pointer.button === 1) {
        this.mouseRightLifting = true;
        this.setPlayerLifting(true);
        return;
      }

      if (this.touchController) {
        this.touchController.handlePointerDown(pointer);
      }
    });

    // 4. Pointer Move: Selection rectangle smoothly follows mouse + 1:1 reciprocal drag gestures
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isMatchOver || this.isPaused || !this.playerBoard || !this.playerCursor) return;

      // If actively dragging via touch controller, give it exclusive control so cursor remains locked to touch row
      if (this.touchController?.isDragging) {
        this.touchController.handlePointerMove(pointer);
        return;
      }

      // Selection rectangle directly tracks mouse on hover or non-drag move
      this.updateMouseCursorTracking(pointer);

      if (this.touchController) {
        this.touchController.handlePointerMove(pointer);
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

      if (this.touchController) {
        this.touchController.handlePointerUp(pointer);
      }
    });

    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => {
      if (this.touchController) {
        this.touchController.handlePointerUp(pointer);
      }
    });

    this.input.on('gameout', () => {
      if (this.touchController) {
        this.touchController.handlePointerCancel();
      }
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

    this.createBottomActionBars(liftBarX, liftBarY, liftBarW, liftBarH, isMobile, boardScaleRatio);

    // Dynamic control hint for desktop
    if (!isMobile) {
      const hintY = Math.min(height - 14, liftBarY + Math.round(26 * boardScaleRatio));
      this.add.text(width / 2, hintY, 'CLICK/TAP: Swap • RIGHT-CLICK/BAR: Fast Lift • E/SPACE: Burst Power', {
        fontSize: `${Math.round(13 * boardScaleRatio)}px`,
        color: '#dfe4ea',
        stroke: '#000000',
        strokeThickness: 1.5
      }).setOrigin(0.5).setDepth(35);
    }
  }

  private createBottomActionBars(x: number, y: number, totalW: number, h: number = 38, isMobile: boolean = false, boardScaleRatio: number = 1.0): void {
    const isNano = this.characterId === 'nano_banana';
    const char = CHARACTERS.find((c) => c.id === this.characterId);
    const powerName = char?.powerName || 'POWER';

    const gap = Math.round(8 * boardScaleRatio);
    const burstW = Math.round(totalW * (isMobile ? 0.42 : 0.40));
    const liftW = totalW - burstW - gap;

    const liftX = x - totalW / 2 + liftW / 2;
    const burstX = x + totalW / 2 - burstW / 2;

    const fontSizeStr = isMobile ? '11.5px' : `${Math.round(12 * boardScaleRatio)}px`;

    // 1. FAST LIFT BAR
    const liftContainer = this.add.container(liftX, y);
    liftContainer.setDepth(35);

    const liftBg = this.add.graphics();
    const drawLift = (active: boolean) => {
      liftBg.clear();
      liftBg.fillStyle(active ? 0x10ac84 : 0x1e272e, 0.9);
      liftBg.fillRoundedRect(-liftW / 2, -h / 2, liftW, h, 8);
      liftBg.lineStyle(1.8, active ? 0x2ed573 : 0x54a0ff, 0.85);
      liftBg.strokeRoundedRect(-liftW / 2, -h / 2, liftW, h, 8);
      liftBg.fillStyle(0xffffff, active ? 0.25 : 0.12);
      liftBg.fillRoundedRect(-liftW / 2 + 3, -h / 2 + 2, liftW - 6, Math.round(h / 2) - 2, 4);
    };
    drawLift(false);

    const liftText = this.add.text(0, -1, '▲ FAST LIFT ▲', {
      fontSize: fontSizeStr,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    const liftHit = this.add.rectangle(0, 0, liftW + 8, h + 8, 0x000000, 0);
    liftHit.setInteractive({ useHandCursor: true });
    liftHit.on('pointerdown', () => {
      drawLift(true);
      this.setPlayerLifting(true);
    });
    const stopLift = () => {
      drawLift(false);
      this.setPlayerLifting(false);
    };
    liftHit.on('pointerup', stopLift);
    liftHit.on('pointerout', stopLift);
    liftContainer.add([liftBg, liftText, liftHit]);

    // 2. SUPER POWER / BURST BUTTON
    this.playerPowerContainer = this.add.container(burstX, y);
    this.playerPowerContainer.setDepth(35);

    this.playerPowerBar = this.add.graphics();
    this.playerPowerContainer.add(this.playerPowerBar);

    this.playerPowerText = this.add.text(0, -1, isNano ? '🚫 NO POWER' : `⚡ ${powerName.toUpperCase()} 0%`, {
      fontSize: fontSizeStr,
      color: isNano ? '#747d8c' : '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    const burstHit = this.add.rectangle(0, 0, burstW + 8, h + 8, 0x000000, 0);
    burstHit.setInteractive({ useHandCursor: !isNano });
    burstHit.on('pointerdown', () => {
      this.triggerPlayerPower();
    });

    this.playerPowerContainer.add([this.playerPowerText, burstHit]);

    // Draw initial 0% state
    this.renderPowerBar(this.playerPowerBar, burstW, h, 0, false, isNano);
  }

  private renderPowerBar(
    g: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    percent: number,
    isReady: boolean,
    isNano: boolean = false
  ): void {
    g.clear();
    const halfW = w / 2;
    const halfH = h / 2;

    // Dark track background
    g.fillStyle(0x0c0618, 0.95);
    g.fillRoundedRect(-halfW, -halfH, w, h, 8);

    if (isNano) {
      g.lineStyle(1.8, 0x57606f, 0.6);
      g.strokeRoundedRect(-halfW, -halfH, w, h, 8);
      return;
    }

    // Fill level
    const fillW = Math.max(0, (w - 6) * (percent / 100));
    if (fillW > 0) {
      const fillColor = isReady ? 0xfeca57 : percent > 50 ? 0xa55eea : 0x54a0ff;
      g.fillStyle(fillColor, 0.9);
      g.fillRoundedRect(-halfW + 3, -halfH + 3, fillW, h - 6, 6);
    }

    // Border
    const borderColor = isReady ? 0xfff200 : 0xa55eea;
    g.lineStyle(isReady ? 2.5 : 1.8, borderColor, isReady ? 1.0 : 0.8);
    g.strokeRoundedRect(-halfW, -halfH, w, h, 8);

    // Glass gloss highlight
    g.fillStyle(0xffffff, 0.16);
    g.fillRoundedRect(-halfW + 3, -halfH + 2, w - 6, Math.round(h / 2) - 2, 4);
  }

  private updatePlayerPowerUI(meter: number): void {
    if (!this.playerPowerContainer || !this.playerPowerBar || !this.playerPowerText) return;
    if (this.characterId === 'nano_banana') return;

    const rounded = Math.round(meter);
    const isReady = rounded >= 100;
    if (rounded === this.lastPlayerPowerMeter && isReady === this.lastPlayerPowerReady) {
      return;
    }
    this.lastPlayerPowerMeter = rounded;
    this.lastPlayerPowerReady = isReady;

    const char = CHARACTERS.find((c) => c.id === this.characterId);
    const powerName = char?.powerName || 'POWER';
    const isMobile = this.isMobileLayout;
    const w = this.playerPowerBar ? Math.round((isMobile ? Math.min(this.cameras.main.width - 24, 340) : 300) * 0.4) : 120;
    const h = 38;

    this.renderPowerBar(this.playerPowerBar, w, h, rounded, isReady, false);

    if (isReady) {
      this.playerPowerText.setText(`⚡ ${powerName.toUpperCase()} READY! ⚡`);
      this.playerPowerText.setColor('#fff200');

      if (!this.playerPowerGlowTween) {
        this.playerPowerGlowTween = this.tweens.add({
          targets: this.playerPowerContainer,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 350,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    } else {
      this.playerPowerText.setText(`⚡ ${powerName.toUpperCase()} ${rounded}%`);
      this.playerPowerText.setColor('#ffffff');

      if (this.playerPowerGlowTween) {
        this.playerPowerGlowTween.stop();
        this.playerPowerGlowTween = undefined;
        this.playerPowerContainer.setScale(1.0);
      }
    }
  }

  private updateCpuPowerUI(meter: number): void {
    if (this.cpuPowerText) {
      const rounded = Math.round(meter);
      if (rounded === this.lastCpuPowerMeter) return;
      this.lastCpuPowerMeter = rounded;
      const isReady = rounded >= 100;
      this.cpuPowerText.setText(isReady ? '⚡ BURST READY!' : `⚡ POWER: ${rounded}%`);
      this.cpuPowerText.setColor(isReady ? '#fff200' : '#54a0ff');
    }
  }

  private triggerPlayerPower(): void {
    if (!this.playerBoard || this.isMatchOver || this.isPaused) return;
    if (!this.playerBoard.canActivatePower()) {
      SoundFx.playCancel();
      return;
    }

    const res = this.playerBoard.activatePower(this.cpuBoard);
    if (res.success) {
      if (this.gameMode === 'vs_online') {
        this.sendNetAction({
          type: 'super_power_activated',
          payload: {
            characterId: this.characterId,
            powerName: res.powerName
          }
        });
      }
    }
  }

  private showSuperPowerBanner(fromPlayer: boolean, charId: string, powerName: string): void {
    const width = this.cameras?.main?.width || 800;
    const height = this.cameras?.main?.height || 600;
    const char = CHARACTERS.find((c) => c.id === charId);
    const charName = char ? char.name.toUpperCase() : charId.toUpperCase();
    const bannerY = this.isMobileLayout ? (fromPlayer ? height * 0.44 : height * 0.22) : height * 0.35;

    const container = this.add.container(width / 2, bannerY);
    container.setDepth(60);

    const bannerW = Math.min(width - 32, 380);
    const bannerH = 46;

    const bg = this.add.graphics();
    bg.fillStyle(fromPlayer ? 0x2c0b3d : 0x0c2461, 0.94);
    bg.fillRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 12);
    bg.lineStyle(2.5, fromPlayer ? 0xff69b4 : 0x54a0ff, 1);
    bg.strokeRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 12);

    const text = this.add.text(
      0,
      0,
      `⚡ ${charName}: ${powerName.toUpperCase()}! ⚡`,
      {
        fontSize: '16px',
        color: fromPlayer ? '#feca57' : '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      }
    ).setOrigin(0.5);

    container.add([bg, text]);
    container.setScale(0.5);
    container.setAlpha(0);

    this.tweens.add({
      targets: container,
      scaleX: 1.05,
      scaleY: 1.05,
      alpha: 1,
      duration: 180,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(1100, () => {
          this.tweens.add({
            targets: container,
            y: bannerY - 30,
            alpha: 0,
            duration: 350,
            ease: 'Quad.easeIn',
            onComplete: () => container.destroy()
          });
        });
      }
    });
  }

  /** Trigger rich character-specific particle bursts and visual aura animations for super powers (optimized) */
  private triggerPowerVisualEffects(fromPlayer: boolean, charId: string): void {
    if (!this.scene || !this.scene.isActive()) return;

    const userIsP1 = fromPlayer;
    const hasOpponent = !!this.cpuBoard;

    const sourceX = userIsP1 ? this.boardP1X : this.boardP2X;
    const sourceY = userIsP1 ? this.boardP1Y : this.boardP2Y;
    const sourceScale = userIsP1 ? this.playerBoardScale : this.cpuBoardScale;
    const sourceW = BOARD_WIDTH * PANEL_SIZE * sourceScale;
    const sourceH = BOARD_VISIBLE_HEIGHT * PANEL_SIZE * sourceScale;

    const targetX = userIsP1 ? (hasOpponent ? this.boardP2X : this.boardP1X) : this.boardP1X;
    const targetY = userIsP1 ? (hasOpponent ? this.boardP2Y : this.boardP1Y) : this.boardP1Y;
    const targetScale = userIsP1 ? (hasOpponent ? this.cpuBoardScale : this.playerBoardScale) : this.playerBoardScale;
    const targetW = BOARD_WIDTH * PANEL_SIZE * targetScale;
    const targetH = BOARD_VISIBLE_HEIGHT * PANEL_SIZE * targetScale;

    switch (charId) {
      case 'ember': {
        const glow = this.add.graphics();
        glow.fillStyle(0xff4757, 0.35);
        glow.fillRoundedRect(sourceX, sourceY, sourceW, sourceH, 6);
        glow.lineStyle(2.5, 0xffa502, 0.85);
        glow.strokeRoundedRect(sourceX, sourceY, sourceW, sourceH, 6);
        glow.setDepth(25);
        this.tweens.add({
          targets: glow,
          alpha: 0,
          duration: 450,
          ease: 'Quad.easeOut',
          onComplete: () => glow.destroy()
        });

        // Lightweight 10-particle flame burst
        for (let i = 0; i < 10; i++) {
          const px = sourceX + (0.15 + i * 0.08) * sourceW;
          const py = sourceY + sourceH * (0.5 + Math.random() * 0.4);
          const flame = this.add.image(px, py, 'particle_flame');
          flame.setDepth(27);
          flame.setScale(0.8);
          this.tweens.add({
            targets: flame,
            y: py - 60 - Math.random() * 50,
            x: px + (Math.random() - 0.5) * 30,
            scaleX: 0.1,
            scaleY: 0.1,
            alpha: 0,
            duration: 400 + Math.random() * 200,
            ease: 'Cubic.easeOut',
            onComplete: () => flame.destroy()
          });
        }
        this.cameras.main.shake(100, 0.0025);
        break;
      }

      case 'mizu': {
        const waterVeil = this.add.graphics();
        waterVeil.fillStyle(0x00d2d3, 0.22);
        waterVeil.fillRoundedRect(sourceX, sourceY, sourceW, sourceH, 6);
        waterVeil.lineStyle(2, 0x54a0ff, 0.8);
        waterVeil.strokeRoundedRect(sourceX, sourceY, sourceW, sourceH, 6);
        waterVeil.setDepth(25);

        // 6 cascading droplets with staggered tweens
        for (let d = 0; d < 6; d++) {
          const dx = sourceX + (0.15 + d * 0.14) * sourceW;
          const drop = this.add.image(dx, sourceY, 'particle_water');
          drop.setDepth(27);
          drop.setScale(0.8);
          drop.setAlpha(0);
          this.tweens.add({
            targets: drop,
            y: sourceY + sourceH,
            alpha: { from: 0.9, to: 0 },
            delay: d * 220,
            duration: 800,
            ease: 'Quad.easeIn',
            onComplete: () => drop.destroy()
          });
        }

        this.tweens.add({
          targets: waterVeil,
          alpha: 0,
          delay: 2400,
          duration: 600,
          onComplete: () => waterVeil.destroy()
        });
        break;
      }

      case 'volt': {
        const zapFlash = this.add.graphics();
        zapFlash.fillStyle(0xfffa65, 0.45);
        zapFlash.fillRoundedRect(targetX, targetY, targetW, targetH, 6);
        zapFlash.lineStyle(2.5, 0x00d2d3, 0.9);
        zapFlash.strokeRoundedRect(targetX, targetY, targetW, targetH, 6);
        zapFlash.setDepth(25);
        this.tweens.add({
          targets: zapFlash,
          alpha: 0,
          duration: 200,
          onComplete: () => zapFlash.destroy()
        });

        // 6 crisp sparks over time
        for (let s = 0; s < 6; s++) {
          this.time.delayedCall(s * 350, () => {
            if (!this.scene || !this.scene.isActive()) return;
            const sx = targetX + Math.random() * targetW;
            const sy = targetY + Math.random() * targetH;
            const spark = this.add.image(sx, sy, 'particle_spark');
            spark.setDepth(27);
            spark.setScale(0.9);
            this.tweens.add({
              targets: spark,
              scaleX: 1.3,
              scaleY: 1.3,
              alpha: 0,
              duration: 180,
              onComplete: () => spark.destroy()
            });
          });
        }
        break;
      }

      case 'poppy': {
        const bottomH = 2 * PANEL_SIZE * sourceScale;
        const bottomY = sourceY + sourceH - bottomH;
        const centerX = sourceX + sourceW / 2;
        const centerY = bottomY + bottomH / 2;

        const ring = this.add.image(centerX, centerY, 'particle_ring');
        ring.setDepth(28);
        ring.setScale(0.4);
        ring.setTint(0xff69b4);
        this.tweens.add({
          targets: ring,
          scaleX: 3.0,
          scaleY: 1.5,
          alpha: 0,
          duration: 400,
          ease: 'Quad.easeOut',
          onComplete: () => ring.destroy()
        });

        for (let i = 0; i < 10; i++) {
          const star = this.add.image(centerX + (Math.random() - 0.5) * sourceW * 0.7, centerY, 'sparkle_star');
          star.setDepth(29);
          const tints = [0xff69b4, 0xfeca57, 0xffffff];
          star.setTint(tints[i % tints.length]);
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.7;
          const speed = 70 + Math.random() * 60;
          this.tweens.add({
            targets: star,
            x: star.x + Math.cos(angle) * speed,
            y: star.y + Math.sin(angle) * speed,
            scaleX: 0.1,
            scaleY: 0.1,
            alpha: 0,
            duration: 450,
            ease: 'Quad.easeOut',
            onComplete: () => star.destroy()
          });
        }
        this.cameras.main.shake(100, 0.003);
        break;
      }

      case 'salty': {
        const frostGlow = this.add.graphics();
        frostGlow.fillStyle(0xdff9fb, 0.28);
        frostGlow.fillRoundedRect(targetX, targetY, targetW, targetH, 6);
        frostGlow.lineStyle(2.5, 0x00d2d3, 0.9);
        frostGlow.strokeRoundedRect(targetX, targetY, targetW, targetH, 6);
        frostGlow.setDepth(25);

        for (let f = 0; f < 6; f++) {
          this.time.delayedCall(f * 380, () => {
            if (!this.scene || !this.scene.isActive()) return;
            const fx = targetX + (0.15 + f * 0.14) * targetW;
            const flake = this.add.image(fx, targetY, 'particle_frost');
            flake.setDepth(27);
            flake.setScale(0.8);
            this.tweens.add({
              targets: flake,
              y: targetY + targetH,
              alpha: { from: 0.9, to: 0 },
              duration: 900,
              ease: 'Sine.easeInOut',
              onComplete: () => flake.destroy()
            });
          });
        }

        this.tweens.add({
          targets: frostGlow,
          alpha: 0,
          delay: 2800,
          duration: 500,
          onComplete: () => frostGlow.destroy()
        });
        break;
      }

      case 'kiri': {
        for (let g = 0; g < 3; g++) {
          const startX = sourceX + sourceW / 2;
          const startY = sourceY + sourceH * 0.3;
          const destX = targetX + (0.25 + g * 0.25) * targetW;
          const destY = targetY + (0.35 + (g % 2) * 0.25) * targetH;

          const gear = this.add.image(startX, startY, 'panel_lock_gear');
          gear.setDepth(50);
          gear.setScale(0.6);

          this.tweens.add({
            targets: gear,
            x: destX,
            y: destY,
            angle: 360,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 320 + g * 50,
            ease: 'Back.easeIn',
            onComplete: () => {
              gear.destroy();
              const ring = this.add.image(destX, destY, 'particle_ring');
              ring.setDepth(28);
              ring.setTint(0xf39c12);
              this.tweens.add({
                targets: ring,
                scaleX: 1.5,
                scaleY: 1.5,
                alpha: 0,
                duration: 200,
                onComplete: () => ring.destroy()
              });
            }
          });
        }
        break;
      }

      case 'mocha': {
        const splash = this.add.graphics();
        splash.fillStyle(0xa55eea, 0.35);
        splash.fillRoundedRect(targetX, targetY, targetW, targetH, 6);
        splash.lineStyle(2.5, 0xd6a2e8, 0.9);
        splash.strokeRoundedRect(targetX, targetY, targetW, targetH, 6);
        splash.setDepth(25);
        this.tweens.add({
          targets: splash,
          alpha: 0,
          duration: 400,
          onComplete: () => splash.destroy()
        });

        for (let b = 0; b < 8; b++) {
          const bx = targetX + (0.15 + b * 0.1) * targetW;
          const by = targetY + targetH * (0.5 + Math.random() * 0.4);
          const bubble = this.add.image(bx, by, 'particle_bubble');
          bubble.setDepth(27);
          bubble.setScale(0.7);
          this.tweens.add({
            targets: bubble,
            y: by - 55,
            scaleX: 1.0,
            scaleY: 1.0,
            alpha: 0,
            duration: 450 + Math.random() * 200,
            ease: 'Cubic.easeOut',
            onComplete: () => bubble.destroy()
          });
        }
        break;
      }

      case 'void_slime': {
        const vortexX = targetX + targetW / 2;
        const vortexY = targetY + targetH * 0.4;
        const siphonDestX = sourceX + sourceW / 2;
        const siphonDestY = sourceY + sourceH * 0.4;

        for (let v = 0; v < 6; v++) {
          this.time.delayedCall(v * 50, () => {
            if (!this.scene || !this.scene.isActive()) return;
            const voidParticle = this.add.image(vortexX + (Math.random() - 0.5) * 30, vortexY + (Math.random() - 0.5) * 30, 'particle_void');
            voidParticle.setDepth(50);
            voidParticle.setScale(0.75);

            this.tweens.add({
              targets: voidParticle,
              x: siphonDestX,
              y: siphonDestY,
              scaleX: 0.2,
              scaleY: 0.2,
              alpha: 0.2,
              duration: 380,
              ease: 'Cubic.easeInOut',
              onComplete: () => voidParticle.destroy()
            });
          });
        }
        break;
      }

      case 'riff': {
        const centerX = sourceX + sourceW / 2;
        const centerY = sourceY + sourceH / 2;
        const ring = this.add.image(centerX, centerY, 'particle_ring');
        ring.setDepth(28);
        ring.setScale(0.5);
        ring.setTint(0xff69b4);
        this.tweens.add({
          targets: ring,
          scaleX: 2.5,
          scaleY: 3.0,
          alpha: 0,
          duration: 400,
          ease: 'Quad.easeOut',
          onComplete: () => ring.destroy()
        });

        for (let n = 0; n < 6; n++) {
          this.time.delayedCall(n * 350, () => {
            if (!this.scene || !this.scene.isActive()) return;
            const nx = sourceX + (0.15 + n * 0.14) * sourceW;
            const ny = sourceY + sourceH * 0.7;
            const note = this.add.image(nx, ny, 'particle_note');
            note.setDepth(27);
            note.setScale(0.8);
            const tints = [0xff69b4, 0x00d2d3, 0xfffa65];
            note.setTint(tints[n % tints.length]);
            this.tweens.add({
              targets: note,
              y: ny - 60,
              alpha: 0,
              duration: 700,
              ease: 'Sine.easeOut',
              onComplete: () => note.destroy()
            });
          });
        }
        break;
      }

      case 'nano_banana': {
        const centerX = sourceX + sourceW / 2;
        const centerY = sourceY + sourceH * 0.45;

        for (let i = 0; i < 6; i++) {
          const star = this.add.image(centerX, centerY, 'sparkle_star');
          star.setDepth(29);
          star.setTint(0xfffa65);
          const angle = (i * Math.PI) / 3;
          this.tweens.add({
            targets: star,
            x: centerX + Math.cos(angle) * 45,
            y: centerY + Math.sin(angle) * 45,
            alpha: 0,
            scaleX: 0.2,
            scaleY: 0.2,
            duration: 350,
            onComplete: () => star.destroy()
          });
        }

        const popup = this.add.text(centerX, centerY, 'NO POWER! 🍌 PURE SKILL!', {
          fontSize: '15px',
          color: '#fffa65',
          fontStyle: 'bold',
          stroke: '#2c3e50',
          strokeThickness: 3
        }).setOrigin(0.5).setDepth(60);

        this.tweens.add({
          targets: popup,
          y: centerY - 30,
          alpha: 0,
          duration: 900,
          ease: 'Back.easeOut',
          onComplete: () => popup.destroy()
        });
        break;
      }
    }
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
    if (this.isMatchOver || this.gameMode === 'vs_online') return;
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  private pauseGame(): void {
    if (this.gameMode === 'vs_online') return;
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
        this.scene.start('OptionsMenuScene', { returnScene: 'GameScene', returnData: this.initialData });
      }, { textureKey: 'pill_purple', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

      const restartBtn = CuteUI.createPillButton(this, 0, btnY3, 'RESTART', () => {
        this.resumeGame();
        this.scene.restart(this.initialData);
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
          this.scene.start('OptionsMenuScene', { returnScene: 'GameScene', returnData: this.initialData });
        },
        () => {
          this.resumeGame();
          this.scene.restart(this.initialData);
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
      if (mascot.getData('baselineY') === undefined) {
        mascot.setData('baselineY', mascot.y);
      }
      const baselineY = mascot.getData('baselineY') as number;
      this.tweens.killTweensOf(mascot);
      this.tweens.add({
        targets: mascot,
        y: baselineY - 20,
        duration: 160,
        yoyo: true,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (mascot.active) {
            mascot.y = baselineY;
          }
        }
      });
    }

    const charId = isPlayer1 ? this.characterId : this.opponentCharacterId;
    this.playCharacterGarbageAttack(charId, isPlayer1);

    const charData = CHARACTERS.find((c) => c.id === charId);
    if (charData && charData.quote) {
      this.showSpeechBubble(isPlayer1, charData.quote);
    }
  }

  /** Character Garbage Attack profiles containing SFX, comic banners, particles and animation sequences */
  private getCharacterAttackProfile(charId: string) {
    switch (charId) {
      case 'kiri':
        return {
          banner: '🔧 WRENCH SLAM! ⚙️',
          bannerColor: '#ffa502',
          ringColorPrimary: 0xffa502,
          ringColorSecondary: 0xffffff,
          particles: ['⚙️', '💥', '🔩'],
          particleColors: ['#ffa502', '#eccc68'],
          playSfx: () => SoundFx.playWrenchClank(),
          framePrefix: 'kiri_attack_',
          totalFrames: 6
        };
      case 'mizu':
        return {
          banner: '🌊 TIDAL SLASH! ⚔️',
          bannerColor: '#70a1ff',
          ringColorPrimary: 0x70a1ff,
          ringColorSecondary: 0x00d2d3,
          particles: ['💧', '🌊', '✨'],
          particleColors: ['#70a1ff', '#00d2d3'],
          playSfx: () => SoundFx.playWaterSlash(),
          framePrefix: 'mizu_attack_',
          totalFrames: 6
        };
      case 'mocha':
        return {
          banner: '✨ MAGIC BREW! 🧪',
          bannerColor: '#ff9ff3',
          ringColorPrimary: 0xff9ff3,
          ringColorSecondary: 0xfeca57,
          particles: ['🫧', '✨', '⭐'],
          particleColors: ['#ff9ff3', '#54a0ff'],
          playSfx: () => SoundFx.playPotionBubble(),
          framePrefix: 'mocha_attack_',
          totalFrames: 6
        };
      case 'ember':
        return {
          banner: '🔥 FIRE VORTEX! 🪭',
          bannerColor: '#ff6b6b',
          ringColorPrimary: 0xff6b6b,
          ringColorSecondary: 0xff9f43,
          particles: ['🔥', '✨', '💥'],
          particleColors: ['#ff6b6b', '#ff9f43'],
          playSfx: () => SoundFx.playFireWhoosh(),
          framePrefix: 'ember_attack_',
          totalFrames: 6
        };
      case 'volt':
        return {
          banner: '⚡ TESLA ZAP! 🔋',
          bannerColor: '#1dd1a1',
          ringColorPrimary: 0x1dd1a1,
          ringColorSecondary: 0x54a0ff,
          particles: ['⚡', '✨', '💡'],
          particleColors: ['#1dd1a1', '#feca57'],
          playSfx: () => SoundFx.playElectricZap(),
          framePrefix: 'volt_attack_',
          totalFrames: 6
        };
      case 'salty':
        return {
          banner: '💣 CANNON BLAST! 🪙',
          bannerColor: '#eccc68',
          ringColorPrimary: 0xeccc68,
          ringColorSecondary: 0xff6348,
          particles: ['🪙', '💨', '💣'],
          particleColors: ['#eccc68', '#f1f2f6'],
          playSfx: () => SoundFx.playCannonBoom(),
          framePrefix: 'salty_attack_',
          totalFrames: 6
        };
      case 'poppy':
        return {
          banner: '💖 IDOL SPARKLE! 🎤',
          bannerColor: '#ff78ae',
          ringColorPrimary: 0xff78ae,
          ringColorSecondary: 0xffd32a,
          particles: ['💖', '⭐', '🎶'],
          particleColors: ['#ff78ae', '#ffd32a'],
          playSfx: () => SoundFx.playSparkleIdol(),
          framePrefix: 'poppy_attack_',
          totalFrames: 6
        };
      case 'void_slime':
        return {
          banner: '🌌 COSMIC VOID! 🪐',
          bannerColor: '#a55eea',
          ringColorPrimary: 0xa55eea,
          ringColorSecondary: 0x48dbfb,
          particles: ['✨', '🪐', '💫'],
          particleColors: ['#a55eea', '#48dbfb'],
          playSfx: () => SoundFx.playMatch(),
          framePrefix: 'void_slime_attack_',
          totalFrames: 6
        };
      case 'nano_banana':
        return {
          banner: '🍌 GLITCH PEEL! 👾',
          bannerColor: '#feca57',
          ringColorPrimary: 0xfeca57,
          ringColorSecondary: 0x1dd1a1,
          particles: ['🍌', '👾', '⚡'],
          particleColors: ['#feca57', '#1dd1a1'],
          playSfx: () => SoundFx.playCombo(3),
          framePrefix: 'nano_banana_attack_',
          totalFrames: 6
        };
      case 'riff':
      default:
        return {
          banner: '🎸 POWER CHORD! ⚡',
          bannerColor: '#fffa65',
          ringColorPrimary: 0xfffa65,
          ringColorSecondary: 0x00d2d3,
          particles: ['⚡', '♪'],
          particleColors: ['#fffa65', '#00d2d3'],
          playSfx: () => SoundFx.playPowerChord(),
          framePrefix: 'riff_chord_',
          totalFrames: 6
        };
    }
  }

  /** Play character attack animation and thematic effects when garbage is launched */
  private playCharacterGarbageAttack(charId: string, isPlayer1: boolean): void {
    const now = this.time.now;
    if (now - this.lastRiffPowerChordTime < 650) return;
    this.lastRiffPowerChordTime = now;

    const profile = this.getCharacterAttackProfile(charId);
    profile.playSfx();

    const mascot = isPlayer1 ? this.playerMascot : this.cpuMascot;
    if (!mascot || !mascot.active) return;

    this.tweens.killTweensOf(mascot);

    if (mascot.getData('baselineY') === undefined) {
      mascot.setData('baselineY', mascot.y);
    }
    const origY = mascot.getData('baselineY') as number;
    const origScaleX = mascot.scaleX;
    const origScaleY = mascot.scaleY;
    const origDisplayW = mascot.displayWidth;
    const origDisplayH = mascot.displayHeight;

    // Calculate mascot world position for visual effects
    let worldX = mascot.x;
    let worldY = mascot.y;
    if (mascot.parentContainer) {
      const matrix = mascot.getWorldTransformMatrix();
      worldX = matrix.tx;
      worldY = matrix.ty;
    }

    // Temporarily pop scale for clear animation visibility on small icons
    if (origDisplayW < 36) {
      mascot.setDisplaySize(38, 38);
    }

    // 6-frame sequential animation stepping
    const frameDelays = [0, 110, 190, 300, 500, 700];

    frameDelays.forEach((delay, idx) => {
      this.time.delayedCall(delay, () => {
        if (!mascot.active) return;
        const sheetKey = `${charId}_attack`;
        const frameKey = `${profile.framePrefix}${idx + 1}`;
        if (this.textures.exists(sheetKey)) {
          mascot.setTexture(sheetKey, idx);
        } else if (this.textures.exists(frameKey)) {
          mascot.setTexture(frameKey);
        } else if (idx === 0) {
          // If frame sprite not loaded, perform dynamic mascot action punch
          this.tweens.add({
            targets: mascot,
            scaleX: origScaleX * 1.35,
            scaleY: origScaleY * 1.35,
            angle: isPlayer1 ? -12 : 12,
            duration: 150,
            yoyo: true,
            ease: 'Back.easeOut'
          });
        }

        if (idx === 2) {
          // Strike Flash & Particle Burst
          this.createAttackSparks(worldX, worldY, mascot.depth + 1, profile);
        } else if (idx === 3) {
          // Attack Apex Roar & Screen Micro-Shake
          this.cameras?.main?.shake(120, 0.005);
          this.showAttackBanner(worldX, worldY, mascot.depth + 2, profile);
        }
      });
    });

    // Reset back to idle texture
    this.time.delayedCall(960, () => {
      if (!mascot.active) return;
      mascot.setTexture(charId);
      mascot.setDisplaySize(origDisplayW, origDisplayH);
      mascot.setScale(origScaleX, origScaleY);
      mascot.setAngle(0);
      mascot.y = origY;

      this.tweens.add({
        targets: mascot,
        y: origY - 5,
        duration: 1300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });
  }

  /** Visual FX: Shockwave ring and character-themed particle sparks */
  private createAttackSparks(x: number, y: number, depth: number, profile: any): void {
    const ring = this.add.graphics();
    ring.setDepth(depth);

    const tweenObj = { radius: 8, alpha: 1 };
    this.tweens.add({
      targets: tweenObj,
      radius: 60,
      alpha: 0,
      duration: 380,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        if (!ring.active) return;
        ring.clear();
        ring.lineStyle(3, profile.ringColorPrimary, tweenObj.alpha);
        ring.strokeCircle(x, y, tweenObj.radius);
        ring.lineStyle(1.5, profile.ringColorSecondary, tweenObj.alpha * 0.8);
        ring.strokeCircle(x, y, tweenObj.radius * 0.7);
      },
      onComplete: () => ring.destroy()
    });

    // Burst 8 character-themed particles
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 32 + Math.random() * 26;
      const particleChar = profile.particles[i % profile.particles.length];
      const particleColor = profile.particleColors[i % profile.particleColors.length];
      const spark = this.add.text(x, y, particleChar, {
        fontSize: '13px',
        color: particleColor
      }).setOrigin(0.5).setDepth(depth + 1);

      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: { from: 1, to: 0 },
        scaleX: { from: 1.2, to: 0.4 },
        scaleY: { from: 1.2, to: 0.4 },
        duration: 450,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy()
      });
    }
  }

  /** Visual FX: Floating animated Attack banner */
  private showAttackBanner(x: number, y: number, depth: number, profile: any): void {
    const banner = this.add.text(x, y - 28, profile.banner, {
      fontSize: '14.5px',
      color: profile.bannerColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2.5
    }).setOrigin(0.5).setDepth(depth);

    this.tweens.add({
      targets: banner,
      y: y - 56,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: { from: 1, to: 0 },
      duration: 750,
      ease: 'Back.easeOut',
      onComplete: () => banner.destroy()
    });
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
      this.time.delayedCall(300, () => {
        if (avatar && avatar.active) avatar.clearTint();
      });
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
      this.time.delayedCall(350, () => {
        if (mascot && mascot.active) mascot.clearTint();
      });
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
      fontSize: '13px',
      color: isPlayer1 ? '#ff9ff3' : '#54a0ff',
      fontStyle: 'bold italic',
      stroke: '#000000',
      strokeThickness: 2.5
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

  /** Handle screen shake impact when garbage block drops and lands */
  private handleGarbageLand(e: GarbageLandEvent, isPlayerBoard: boolean): void {
    if (!e || !this.scene.isActive() || !e.isLarge) return;

    if (isPlayerBoard) {
      // Intense screen shake for impacts on player board
      const duration = e.height >= 3 ? 280 : e.height >= 2 ? 220 : 160;
      const intensity = e.height >= 3 ? 0.016 : e.height >= 2 ? 0.012 : 0.008;
      this.cameras?.main?.shake(duration, intensity, true);
    } else {
      // Satisfying but slightly lighter rumble for impacts on opponent board
      const duration = e.height >= 3 ? 240 : e.height >= 2 ? 180 : 140;
      const intensity = e.height >= 3 ? 0.012 : e.height >= 2 ? 0.009 : 0.006;
      this.cameras?.main?.shake(duration, intensity, true);
    }
  }

  private handlePlayerMatch(event: MatchEvent): void {
    this.matchPanelsCleared += Math.max(3, event.comboSize);
    if (event.comboSize === 4) this.matchCombos4++;
    else if (event.comboSize === 5) this.matchCombos5++;
    else if (event.comboSize >= 6) this.matchCombos6Plus++;

    if (event.chainLevel === 2) this.matchChains2++;
    else if (event.chainLevel === 3) this.matchChains3++;
    else if (event.chainLevel === 4) this.matchChains4++;
    else if (event.chainLevel >= 5) this.matchChains5Plus++;

    StatsManager.recordMatchEvent(event.comboSize, event.chainLevel);
    this.playerScore += event.scoreGained;
    this.roundScore += event.scoreGained;
    this.playerScoreText.setText(`SCORE: ${this.playerScore.toLocaleString()}`);

    if (this.gameMode === 'endless' && this.endlessBestText) {
      const best = Math.max(RecordManager.getEndlessHighScore(this.difficulty), this.playerScore);
      this.endlessBestText.setText(`BEST: ${best.toLocaleString()}`);
    }

    if (this.playerMascot && (event.comboSize >= 4 || event.chainLevel > 1)) {
      if (this.playerMascot.getData('baselineY') === undefined) {
        this.playerMascot.setData('baselineY', this.playerMascot.y);
      }
      const baselineY = this.playerMascot.getData('baselineY') as number;
      this.tweens.killTweensOf(this.playerMascot);
      this.tweens.add({
        targets: this.playerMascot,
        y: baselineY - 18,
        duration: 160,
        yoyo: true,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (this.playerMascot?.active) {
            this.playerMascot.y = baselineY;
          }
        }
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
      const safeWidth = Math.min(garbageWidth, BOARD_WIDTH);
      const maxStartCol = BOARD_WIDTH - safeWidth;
      const startCol = randomInt(0, Math.max(0, maxStartCol));

      if ((this.gameMode === 'vs_cpu' || this.gameMode === 'challenge') && this.cpuBoard) {
        // Animate ballistic arc vector traveling from attacker board to recipient queue
        const startX = this.boardP1X + (BOARD_WIDTH * PANEL_SIZE * this.playerBoardScale) / 2;
        const startY = this.boardP1Y;
        const endX = this.boardP2X + (BOARD_WIDTH * PANEL_SIZE * this.cpuBoardScale) / 2;
        const endY = this.boardP2Y - 12;

        animateBallisticGarbageArc(this, startX, startY, endX, endY, event.comboSize, () => {
          try {
            if (!this.scene.isActive() || !this.cpuBoard) return;
            this.cpuBoard.queueGarbage(garbageWidth, garbageHeight, startCol);
            this.showAttackAlert(true, garbageHeight, garbageWidth);
            this.triggerAvatarHurt(false);
            this.cameras?.main?.shake(60, 0.002);
          } catch (err) {
            console.warn('Error in attack animation callback:', err);
          }
        });
      } else if (this.gameMode === 'vs_online' && this.socketMgr) {
        this.sendNetAction({
          type: 'attack',
          payload: { width: garbageWidth, height: garbageHeight, col: startCol }
        });

        if (this.cpuBoard) {
          const startX = this.boardP1X + (BOARD_WIDTH * PANEL_SIZE * this.playerBoardScale) / 2;
          const startY = this.boardP1Y;
          const endX = this.boardP2X + (BOARD_WIDTH * PANEL_SIZE * this.cpuBoardScale) / 2;
          const endY = this.boardP2Y - 12;

          animateBallisticGarbageArc(this, startX, startY, endX, endY, event.comboSize, () => {
            try {
              if (!this.scene.isActive() || !this.cpuBoard) return;
              this.cpuBoard.queueGarbage(garbageWidth, garbageHeight, startCol);
              this.showAttackAlert(true, garbageHeight, garbageWidth);
              this.triggerAvatarHurt(false);
              this.cameras?.main?.shake(60, 0.002);
            } catch (err) {
              console.warn('Error in online attack animation callback:', err);
            }
          });
        } else {
          this.showAttackAlert(true, garbageHeight, garbageWidth);
        }
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

    if (this.gameMode === 'vs_online') {
      // In online multiplayer, opponent attacks arrive via authoritative 'attack' network actions
      return;
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
      this.triggerAvatarAttack(false);
      // Animate ballistic arc vector traveling from CPU board to player board
      const startX = this.boardP2X + (BOARD_WIDTH * PANEL_SIZE * this.cpuBoardScale) / 2;
      const startY = this.boardP2Y;
      const endX = this.boardP1X + (BOARD_WIDTH * PANEL_SIZE * this.playerBoardScale) / 2;
      const endY = this.boardP1Y - 12;

      animateBallisticGarbageArc(this, startX, startY, endX, endY, event.comboSize, () => {
        if (!this.scene.isActive() || !this.playerBoard) return;
        this.playerBoard.queueGarbage(garbageWidth, garbageHeight);
        this.showAttackAlert(false, garbageHeight, garbageWidth);
        this.triggerAvatarHurt(true);
        this.cameras?.main?.shake(60, 0.002);
      });
    }
  }

  private showAttackAlert(fromPlayer: boolean, height: number, width: number = BOARD_WIDTH): void {
    const centerX = (this.cameras?.main?.width || 800) / 2;
    const flyY = 160 + (fromPlayer ? 0 : 50);
    const label =
      width < BOARD_WIDTH
        ? (fromPlayer ? `SENT ${width}-WIDE TRASH!` : `INCOMING ${width}-WIDE TRASH!`)
        : (fromPlayer ? `SENT +${height} TRASH SLAB!` : `INCOMING +${height} TRASH SLAB!`);
    const attackText = this.add.text(
      centerX,
      flyY,
      label,
      {
        fontSize: '14px',
        color: fromPlayer ? '#ff69b4' : '#ff4757',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2.5
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

    if (this.gameMode === 'endless') {
      this.gameTime++;
      this.timeText.setText(this.formatTime(this.gameTime));
      return;
    }

    this.gameTime--;
    this.timeText.setText(this.formatTime(this.gameTime));

    if (this.gameTime <= 0) {
      this.timerEvent.remove();
      const p1Wins = (this.gameMode === 'challenge' ? this.roundScore : this.playerScore) >= this.cpuScore;
      this.endMatch(p1Wins ? 'VICTORY!' : 'TIME UP!', p1Wins);
    }
  }

  public update(time: number, delta: number): void {
    this.handleGamepadInput(delta);

    this.fpsSampleTimer += delta;
    if (this.fpsSampleTimer >= 3000) {
      this.fpsSampleTimer = 0;
      if (this.game.loop.actualFps > 0) {
        StatsManager.recordFps(Math.round(this.game.loop.actualFps));
      }
    }

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
      this.triggerPlayerSwap(this.playerCursor.gridX, this.playerCursor.gridY, 'gamepad');
    }
    this.padPrevButtons.set(0, swapDown);

    // Button 3 (Y) for Super Power Burst
    const powerDown = Boolean(pad.Y || pad.isButtonDown(3));
    const prevPower = this.padPrevButtons.get(3) || false;
    if (powerDown && !prevPower) {
      this.triggerPlayerPower();
    }
    this.padPrevButtons.set(3, powerDown);

    // Button 1 (B), L1 (4), R1 (5), L2, R2 for FAST LIFT
    const liftDown = Boolean(
      pad.B || pad.L1 || pad.R1 ||
      pad.isButtonDown(1) || pad.isButtonDown(4) || pad.isButtonDown(5) ||
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

    if (this.isPaused) {
      this.isPaused = false;
      if (this.pauseModalContainer) {
        this.pauseModalContainer.setVisible(false);
      }
    }

    const matchDurationSec = Math.max(1, Math.round((Date.now() - this.matchStartTimeMs) / 1000));
    StatsManager.recordMatchEnd(this.gameMode, matchDurationSec, isVictory, this.difficulty);

    TelemetryClient.submitMatchTelemetry({
      mode: this.gameMode,
      difficulty: this.difficulty,
      characterId: this.characterId,
      opponentCharacterId: this.opponentCharacterId || undefined,
      isVictory: isVictory,
      score: this.playerScore,
      maxChain: this.playerBoard?.maxChain || 1,
      matchDurationSeconds: matchDurationSec,
      panelsCleared: this.matchPanelsCleared,
      garbageCleared: this.matchGarbageCleared,
      swaps: this.matchSwaps,
      fastLifts: this.matchFastLifts,
      combos4: this.matchCombos4,
      combos5: this.matchCombos5,
      combos6Plus: this.matchCombos6Plus,
      chains2: this.matchChains2,
      chains3: this.matchChains3,
      chains4: this.matchChains4,
      chains5Plus: this.matchChains5Plus,
      powerActivations: {
        [this.characterId]: this.playerPowerActivationsCount,
        ...(this.opponentCharacterId ? { [this.opponentCharacterId]: this.cpuPowerActivationsCount } : {})
      },
      inputDevice: this.lastInputDevice
    }).catch(() => {});

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

    let isNewRecord = false;
    let previousBest = 0;
    const isMasterTier = this.difficulty === GameDifficulty.MASTER;
    const isGrandmasterTier = this.difficulty === GameDifficulty.GRANDMASTER;
    const targetBossId = isMasterTier ? 'void_slime' : isGrandmasterTier ? 'nano_banana' : null;
    const isSecretBossPending = Boolean(
      targetBossId &&
      this.characterId !== targetBossId &&
      !this.defeatedOpponents.includes(targetBossId)
    );
    const neededVictories = targetBossId && this.characterId !== targetBossId ? 8 : 7;
    const isChampion = this.gameMode === 'challenge' && isVictory && (
      isSecretBossPending ? false : this.defeatedOpponents.length >= neededVictories
    );

    if (this.gameMode === 'endless') {
      const res = RecordManager.recordEndlessScore(this.difficulty, this.playerScore);
      isNewRecord = res.isNewRecord;
      previousBest = res.previousRecord;
      if (isNewRecord) {
        SoundFx.playVictory();
      }
      LeaderboardClient.submitScore(
        'endless',
        this.difficulty,
        this.characterId,
        this.playerScore,
        this.playerBoard.maxChain
      ).catch(() => {});
    } else if (this.gameMode === 'challenge') {
      const thisRoundElapsed = Math.max(1, 240 - this.gameTime);
      const totalElapsedSeconds = this.cumulativeChallengeTime + thisRoundElapsed;
      if (isChampion) {
        RecordManager.recordChallengeClear(this.difficulty, this.characterId, totalElapsedSeconds, this.playerScore);
        if (this.opponentCharacterId === 'void_slime' || this.defeatedOpponents.includes('void_slime')) {
          RecordManager.recordVoidSlimeDefeat();
        }
        if (this.opponentCharacterId === 'nano_banana' || this.defeatedOpponents.includes('nano_banana')) {
          RecordManager.recordNanoBananaDefeat();
        }
      }
      if (this.playerScore > 0) {
        LeaderboardClient.submitScore(
          'challenge',
          this.difficulty,
          this.characterId,
          this.playerScore,
          this.playerBoard.maxChain
        ).catch(() => {});
      }
    }

    const finalBanner = isChampion
      ? 'CHAMPION! 👑'
      : (this.gameMode === 'endless' && isNewRecord)
      ? 'NEW RECORD! 🏆'
      : bannerText;

    // Create Game Over Modal Container at Depth 200 (guaranteed on top of boards, frames, and cursors)
    this.gameOverModalContainer = this.add.container(width / 2, height / 2);
    this.gameOverModalContainer.setDepth(200);

    // 1. Dark fullscreen backdrop to shield underlying game and absorb touch/pointer input
    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.78);
    backdrop.setInteractive();

    // 2. Themed Modal Box
    const uiScale = CuteUI.getUIScale(this);
    const hasThreeButtons = (this.gameMode === 'challenge' && !isVictory) ||
                            (this.gameMode === 'challenge' && isChampion) ||
                            (this.gameMode === 'endless');
    const cardW = Math.min(width - 36, Math.round(380 * uiScale));
    const cardH = Math.round((hasThreeButtons ? 390 : 330) * uiScale);
    const halfW = cardW / 2;
    const halfH = cardH / 2;

    const box = this.add.graphics();
    const borderColor = isChampion || (this.gameMode === 'endless' && isNewRecord) ? 0xfeca57 : isVictory ? 0x2ed573 : 0xff4757;
    box.fillStyle(0x181028, 0.98);
    box.fillRoundedRect(-halfW, -halfH, cardW, cardH, Math.round(20 * uiScale));
    box.lineStyle(Math.round(3 * uiScale), borderColor, 1);
    box.strokeRoundedRect(-halfW, -halfH, cardW, cardH, Math.round(20 * uiScale));

    // Subtle header accent line
    box.lineStyle(Math.round(1.5 * uiScale), borderColor, 0.45);
    box.strokeLineShape(new Phaser.Geom.Line(-halfW + Math.round(24 * uiScale), -halfH + Math.round(68 * uiScale), halfW - Math.round(24 * uiScale), -halfH + Math.round(68 * uiScale)));

    // 3. Banner Title
    const titleColor = isChampion || (this.gameMode === 'endless' && isNewRecord) ? '#feca57' : isVictory ? '#2ed573' : '#ff4757';
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
      ? (this.defeatedOpponents.includes('nano_banana')
          ? `Hidden Boss Nano Banana conquered! ${winChar?.name} is the Grandmaster Legend!`
          : this.defeatedOpponents.includes('void_slime')
          ? `Void Slime Champion conquered! ${winChar?.name} is the Master Slime Champion!`
          : `All rivals defeated! ${winChar?.name} is the Slime Champion!`)
      : (isSecretBossPending && this.defeatedOpponents.length >= 7)
      ? (isGrandmasterTier
          ? `All 7 rivals fallen! But reality is peeling open... Nano Banana emerges!`
          : `All 7 rivals fallen! But an ominous cosmic aura stirs... The Void Slime awakens!`)
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
    const diffInfo = getDifficultyInfo(this.difficulty);
    let scoreSummary = '';
    if (this.gameMode === 'endless') {
      if (isNewRecord && previousBest > 0) {
        scoreSummary = `🏆 NEW BEST: ${this.playerScore.toLocaleString()} (Prev: ${previousBest.toLocaleString()})`;
      } else {
        const best = RecordManager.getEndlessHighScore(this.difficulty);
        scoreSummary = `[${diffInfo.badgeText}] Score: ${this.playerScore.toLocaleString()}  |  Best: ${best.toLocaleString()}`;
      }
    } else if (this.gameMode === 'challenge') {
      scoreSummary = `[${diffInfo.badgeText}]  Round: +${this.roundScore.toLocaleString()}  |  Total: ${this.playerScore.toLocaleString()}`;
    } else {
      scoreSummary = `[${diffInfo.badgeText}]  You: ${this.playerScore.toLocaleString()}  |  Opponent: ${this.cpuScore.toLocaleString()}`;
    }

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
      const thisRoundElapsed = Math.max(1, 240 - this.gameTime);
      const totalElapsedSeconds = this.cumulativeChallengeTime + thisRoundElapsed;

      if (isChampion) {
        const claimBtn = CuteUI.createPillButton(this, 0, startBtnY, 'CLAIM CHAMPION CROWN 🏆', () => {
          this.scene.start('ChallengeMapScene', {
            characterId: this.characterId,
            defeatedOpponents: this.defeatedOpponents,
            difficulty: this.difficulty,
            challengeScore: this.playerScore,
            challengeElapsedSeconds: totalElapsedSeconds
          });
        }, { textureKey: 'pill_pink', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

        const lbBtn = CuteUI.createPillButton(this, 0, startBtnY + btnSpacing, 'GLOBAL LEADERBOARD 🏆', () => {
          this.scene.start('LeaderboardScene', {
            returnScene: 'MenuScene',
            initialMode: 'challenge',
            initialDifficulty: this.difficulty
          });
        }, { textureKey: 'pill_blue', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

        const menuBtn = CuteUI.createPillButton(this, 0, startBtnY + btnSpacing * 2, 'MAIN MENU', () => {
          this.scene.start('MenuScene');
        }, { textureKey: 'pill_grey', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

        this.gameOverButtons = [claimBtn, lbBtn, menuBtn];
        this.gameOverActions = [
          () => this.scene.start('ChallengeMapScene', {
            characterId: this.characterId,
            defeatedOpponents: this.defeatedOpponents,
            difficulty: this.difficulty,
            challengeScore: this.playerScore,
            challengeElapsedSeconds: totalElapsedSeconds
          }),
          () => this.scene.start('LeaderboardScene', { returnScene: 'MenuScene', initialMode: 'challenge', initialDifficulty: this.difficulty }),
          () => this.scene.start('MenuScene')
        ];
      } else if (isVictory) {
        const nextLabel = (isSecretBossPending && this.defeatedOpponents.length >= 7)
          ? (isGrandmasterTier ? '🍌 CONFRONT NANO BANANA 🍌' : '👑 CONFRONT VOID SLIME 👑')
          : `NEXT CHALLENGER (${this.defeatedOpponents.length}/7)`;
        const nextBtn = CuteUI.createPillButton(this, 0, startBtnY, nextLabel, () => {
          this.scene.start('ChallengeMapScene', {
            characterId: this.characterId,
            defeatedOpponents: this.defeatedOpponents,
            difficulty: this.difficulty,
            challengeScore: this.playerScore,
            challengeElapsedSeconds: totalElapsedSeconds
          });
        }, { textureKey: 'pill_green', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

        const menuBtn = CuteUI.createPillButton(this, 0, startBtnY + btnSpacing, 'MAIN MENU', () => {
          this.scene.start('MenuScene');
        }, { textureKey: 'pill_grey', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

        this.gameOverButtons = [nextBtn, menuBtn];
        this.gameOverActions = [
          () => this.scene.start('ChallengeMapScene', {
            characterId: this.characterId,
            defeatedOpponents: this.defeatedOpponents,
            difficulty: this.difficulty,
            challengeScore: this.playerScore,
            challengeElapsedSeconds: totalElapsedSeconds
          }),
          () => this.scene.start('MenuScene')
        ];
      } else {
        const retryBtn = CuteUI.createPillButton(this, 0, startBtnY, 'RETRY MATCH', () => {
          this.scene.restart({
            mode: this.gameMode,
            characterId: this.characterId,
            opponentCharacterId: this.opponentCharacterId,
            defeatedOpponents: this.defeatedOpponents,
            difficulty: this.difficulty,
            challengeScore: this.initialChallengeScore,
            challengeElapsedSeconds: this.cumulativeChallengeTime
          });
        }, { textureKey: 'pill_blue', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

        const mapBtn = CuteUI.createPillButton(this, 0, startBtnY + btnSpacing, 'CHALLENGE MAP', () => {
          this.scene.start('ChallengeMapScene', {
            characterId: this.characterId,
            defeatedOpponents: this.defeatedOpponents,
            difficulty: this.difficulty,
            challengeScore: this.initialChallengeScore,
            challengeElapsedSeconds: this.cumulativeChallengeTime
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
            defeatedOpponents: this.defeatedOpponents,
            difficulty: this.difficulty,
            challengeScore: this.initialChallengeScore,
            challengeElapsedSeconds: this.cumulativeChallengeTime
          }),
          () => this.scene.start('ChallengeMapScene', {
            characterId: this.characterId,
            defeatedOpponents: this.defeatedOpponents,
            difficulty: this.difficulty,
            challengeScore: this.initialChallengeScore,
            challengeElapsedSeconds: this.cumulativeChallengeTime
          }),
          () => this.scene.start('MenuScene')
        ];
      }
    } else if (this.gameMode === 'vs_online') {
      const initialBtnText = this.opponentDisconnected
        ? 'OPPONENT LEFT'
        : this.opponentWantsRematch
        ? 'PLAY AGAIN (READY!)'
        : 'PLAY AGAIN';

      const handlePlayAgain = () => {
        if (this.opponentDisconnected) {
          SoundFx.playDecide();
          if (this.socketMgr && this.roomId) {
            this.socketMgr.leaveRoom(this.roomId);
          }
          this.scene.start('LobbyScene', { characterId: this.characterId });
          return;
        }

        if (this.isRematchRequested) return;

        this.isRematchRequested = true;
        SoundFx.playDecide();
        if (this.onlinePlayAgainBtnText) {
          this.onlinePlayAgainBtnText.setText('WAITING FOR OPPONENT...');
        }
        if (this.socketMgr && this.roomId) {
          this.socketMgr.requestRematch(this.roomId);
        }
      };

      const handleMainMenu = () => {
        SoundFx.playDecide();
        if (this.socketMgr && this.roomId) {
          this.socketMgr.leaveRoom(this.roomId);
        }
        this.scene.start('MenuScene');
      };

      const playAgainBtn = CuteUI.createPillButton(
        this,
        0,
        startBtnY,
        initialBtnText,
        handlePlayAgain,
        { textureKey: 'pill_green', fontSize: btnFont, width: btnW, height: btnH, autoScale: false }
      );

      this.onlinePlayAgainBtnText = playAgainBtn.list.find((child) => child instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined;

      const menuBtn = CuteUI.createPillButton(
        this,
        0,
        startBtnY + btnSpacing,
        'MAIN MENU',
        handleMainMenu,
        { textureKey: 'pill_grey', fontSize: btnFont, width: btnW, height: btnH, autoScale: false }
      );

      this.gameOverButtons = [playAgainBtn, menuBtn];
      this.gameOverActions = [handlePlayAgain, handleMainMenu];
    } else if (this.gameMode === 'endless') {
      const playAgainBtn = CuteUI.createPillButton(this, 0, startBtnY, 'PLAY AGAIN', () => {
        this.scene.restart({
          mode: this.gameMode,
          characterId: this.characterId,
          opponentCharacterId: this.opponentCharacterId,
          difficulty: this.difficulty
        });
      }, { textureKey: 'pill_green', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

      const lbBtn = CuteUI.createPillButton(this, 0, startBtnY + btnSpacing, 'GLOBAL LEADERBOARD 🏆', () => {
        this.scene.start('LeaderboardScene', {
          returnScene: 'MenuScene',
          initialMode: 'endless',
          initialDifficulty: this.difficulty
        });
      }, { textureKey: 'pill_blue', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

      const menuBtn = CuteUI.createPillButton(this, 0, startBtnY + btnSpacing * 2, 'MAIN MENU', () => {
        this.scene.start('MenuScene');
      }, { textureKey: 'pill_grey', fontSize: btnFont, width: btnW, height: btnH, autoScale: false });

      this.gameOverButtons = [playAgainBtn, lbBtn, menuBtn];
      this.gameOverActions = [
        () => this.scene.restart({
          mode: this.gameMode,
          characterId: this.characterId,
          opponentCharacterId: this.opponentCharacterId,
          difficulty: this.difficulty
        }),
        () => this.scene.start('LeaderboardScene', { returnScene: 'MenuScene', initialMode: 'endless', initialDifficulty: this.difficulty }),
        () => this.scene.start('MenuScene')
      ];
    } else {
      const playAgainBtn = CuteUI.createPillButton(this, 0, startBtnY, 'PLAY AGAIN', () => {
        this.scene.restart({
          mode: this.gameMode,
          characterId: this.characterId,
          opponentCharacterId: this.opponentCharacterId,
          difficulty: this.difficulty
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
          opponentCharacterId: this.opponentCharacterId,
          difficulty: this.difficulty
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

  private setBgmTension(active: boolean): void {
    if (this.cache.audio.exists('battle_cpu')) {
      const bgm = this.sound.get('battle_cpu');
      if (bgm && bgm.isPlaying) {
        const targetRate = active
          ? (this.difficulty === GameDifficulty.GRANDMASTER ? 1.22 : this.difficulty === GameDifficulty.MASTER ? 1.15 : 1.10)
          : 1.0;
        this.tweens.add({
          targets: bgm,
          rate: targetRate,
          duration: 350
        });
      }
    }
  }
}
