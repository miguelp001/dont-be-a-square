import Phaser from 'phaser';
import Board, { MatchEvent } from '../objects/Board';
import Cursor from '../objects/Cursor';
import SocketManager from '../net/SocketManager';
import { CuteUI } from '../utils/CuteUI';
import { SoundFx } from '../utils/SoundFx';
import { Settings } from '../utils/Settings';
import { GameDifficulty, getDifficultyInfo } from '../utils/Difficulty';
import { CHARACTERS, BOARD_WIDTH, BOARD_HEIGHT, CUTE_FONT } from '../utils/Constants';
import { TouchController } from '../input/TouchController';
import { BattleRoyaleTargeter, BRTargetMode } from '../utils/BattleRoyaleTargeter';
import { RecordManager } from '../utils/DifficultyRecords';
import { LeaderboardClient } from '../utils/LeaderboardClient';

interface BRThumbnail {
  id: string;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  stackBar: Phaser.GameObjects.Graphics;
  avatar: Phaser.GameObjects.Image;
  nameText: Phaser.GameObjects.Text;
  badgeText: Phaser.GameObjects.Text;
  threatIcon: Phaser.GameObjects.Text;
  width: number;
  height: number;
  x: number;
  y: number;
}

export default class BattleRoyaleScene extends Phaser.Scene {
  private socketMgr!: SocketManager;
  private roomId: string = '';
  private myId: string = '';
  private characterId: string = 'kiri';

  // Core Player Board & Cursor
  private playerBoard!: Board;
  private playerCursor!: Cursor;
  private touchController?: TouchController;
  private targeter!: BattleRoyaleTargeter;

  // Battle Royale State
  private aliveCount: number = 30;
  private currentPhase: 1 | 2 | 3 = 1;
  private myBadges: number = 0;
  private myKOs: number = 0;
  private currentTargetId: string | null = null;
  private competitors: Map<string, any> = new Map();
  private thumbnails: Map<string, BRThumbnail> = new Map();

  // HUD & Display Elements
  private aliveText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private badgeText!: Phaser.GameObjects.Text;
  private threatText!: Phaser.GameObjects.Text;
  private killfeedText!: Phaser.GameObjects.Text;
  private laserGraphics!: Phaser.GameObjects.Graphics;
  private telemetryTimer: number = 0;
  private isEliminated: boolean = false;
  private isVictory: boolean = false;

  // BGM Audio Controllers
  private currentBgm?: Phaser.Sound.BaseSound;
  private isTop5MusicPlaying: boolean = false;

  // Gameplay Input Controllers
  private keydownHandler?: (e: KeyboardEvent) => void;
  private keyupHandler?: (e: KeyboardEvent) => void;
  private gamepadRepeatTimer: number = 0;
  private gamepadLastDir: 'up' | 'down' | 'left' | 'right' | null = null;
  private gamepadPrevButtons: Map<number, boolean> = new Map();

  // End Modal Navigation State
  private endModalActive: boolean = false;
  private endModalIndex: number = 0;
  private endModalButtons: Phaser.GameObjects.Container[] = [];
  private endModalKeyHandler?: (e: KeyboardEvent) => void;
  private endModalTitleText?: Phaser.GameObjects.Text;
  private endModalSubText?: Phaser.GameObjects.Text;
  private endModalKillerText?: Phaser.GameObjects.Text;
  private endModalStatsText?: Phaser.GameObjects.Text;
  private padRepeatTimer: number = 0;
  private prevPadButtons: Map<number, boolean> = new Map();

  // Board Geometry
  private boardCenterX: number = 0;
  private boardCenterY: number = 0;
  private boardScale: number = 1.0;

  constructor() {
    super({ key: 'BattleRoyaleScene' });
  }

  init(data: any): void {
    this.roomId = data?.roomId || '';
    this.characterId = data?.characterId || 'kiri';
    this.aliveCount = 30;
    this.currentPhase = 1;
    this.myBadges = 0;
    this.myKOs = 0;
    this.currentTargetId = null;
    this.competitors.clear();
    this.thumbnails.clear();
    this.isEliminated = false;
    this.isVictory = false;
    this.telemetryTimer = 0;
    this.isTop5MusicPlaying = false;
    this.currentBgm = undefined;
    this.endModalActive = false;
    this.endModalIndex = 0;
    this.endModalButtons = [];
    this.padRepeatTimer = 0;
    this.prevPadButtons.clear();
  }

  create(): void {
    this.socketMgr = SocketManager.getInstance();
    this.myId = this.socketMgr.getSocketId();

    // Start Battle Royale background music (Pixel_Shuffle.mp3)
    const bgmKey = this.cache.audio.exists('br_bgm') ? 'br_bgm' : (this.cache.audio.exists('Pixel_Shuffle') ? 'Pixel_Shuffle' : '');
    if (bgmKey) {
      this.sound.stopAll();
      this.currentBgm = this.sound.add(bgmKey, { loop: true, volume: Settings.musicVolume });
      this.currentBgm.play();
    }

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const isMobile = width < 600 || height >= width * 1.05;
    const uiScale = isMobile ? 1.0 : CuteUI.getUIScale(this);

    // Drifting fairytale meadow background
    CuteUI.createCuteBackground(this, 'autumn');

    // Laser layer for targeting lines
    this.laserGraphics = this.add.graphics();
    this.laserGraphics.setDepth(15);

    // Layout configuration
    this.boardScale = isMobile ? Math.min(1.0, width / 340) : Math.min(1.15, height / 580);
    const boardPixelW = 192 * this.boardScale;
    const boardPixelH = 384 * this.boardScale;

    this.boardCenterX = isMobile ? width / 2 : width / 2;
    this.boardCenterY = isMobile ? height / 2 + 15 : height / 2 + 25;
    const boardX = this.boardCenterX - boardPixelW / 2;
    const boardY = this.boardCenterY - boardPixelH / 2;

    // 1. Board Backdrop (drawn behind panels at depth 1)
    const boardBackdrop = this.add.graphics();
    boardBackdrop.setDepth(1);
    boardBackdrop.fillStyle(0x0a0518, 0.65);
    boardBackdrop.fillRoundedRect(boardX - 6, boardY - 6, boardPixelW + 12, boardPixelH + 12, 10);

    // 2. Board Frame (outline only at depth 20 - NO opaque fill on top of panels!)
    const boardFrame = this.add.graphics();
    boardFrame.setDepth(20);
    this.drawBoardFrame(boardFrame, boardX, boardY, boardPixelW, boardPixelH, 0xff69b4);

    // 3. Player Board instance
    this.playerBoard = new Board(this, boardX, boardY, this.boardScale);
    this.playerBoard.applyDifficulty(GameDifficulty.ADEPT);
    this.playerBoard.addInitialPanels(4, 0);
    this.playerBoard.container.setDepth(10);

    // 4. Player Cursor
    this.playerCursor = new Cursor(this, this.playerBoard);
    this.playerCursor.setDepth(25);

    // 5. Header Plaque
    this.createHeaderHUD(width / 2, Math.round(28 * uiScale), uiScale);

    // 6. 4-Way Tactical Targeter Bar directly below board
    this.targeter = new BattleRoyaleTargeter(this, (mode, manualId) => {
      this.socketMgr.setBRTarget(this.roomId, mode, manualId);
    });
    const targeterW = Math.min(width - 24, Math.round(300 * uiScale));
    const targeterY = boardY + boardPixelH + Math.round(18 * uiScale);
    this.targeter.createUI(width / 2, targeterY, targeterW, uiScale);

    // 7. Fast Lift Button directly below targeter
    const liftBtnW = Math.min(width - 32, Math.round(180 * uiScale));
    const liftBtnH = Math.round(28 * uiScale);
    const liftBtnY = targeterY + Math.round(26 * uiScale);
    const liftBtn = CuteUI.createPillButton(this, width / 2, liftBtnY, '⚡ FAST LIFT', () => {}, {
      textureKey: 'pill_blue',
      width: liftBtnW,
      height: liftBtnH,
      fontSize: `${Math.round(11 * uiScale)}px`,
      autoScale: false
    });
    liftBtn.setDepth(30);
    liftBtn.on('pointerdown', () => {
      if (this.playerBoard && !this.isEliminated && !this.endModalActive) {
        this.playerBoard.isLifting = true;
      }
    });
    liftBtn.on('pointerup', () => {
      if (this.playerBoard) this.playerBoard.isLifting = false;
    });
    liftBtn.on('pointerout', () => {
      if (this.playerBoard) this.playerBoard.isLifting = false;
    });

    // 8. Gameplay Input Setup (Keyboard, Touch/Mouse, Gamepad)
    this.setupGameplayInput();

    // 9. Thumbnail Matrix
    this.createThumbnailMatrix(width, height, boardX, boardPixelW, isMobile, uiScale);

    // 10. Setup Board Events & Socket Listeners
    this.setupBoardEvents();
    this.setupSocketListeners();

    // Scene teardown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  private drawBoardFrame(graphics: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): void {
    graphics.clear();
    // Stroke outline ONLY. Do NOT fill with opaque rectangle so panels underneath are crisp and bright!
    graphics.lineStyle(3, color, 1.0);
    graphics.strokeRoundedRect(x - 6, y - 6, w + 12, h + 12, 10);
    graphics.lineStyle(1.5, 0xffffff, 0.6);
    graphics.strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, 8);
  }

  private createHeaderHUD(centerX: number, y: number, uiScale: number): void {
    const barW = Math.min(this.cameras.main.width - 20, Math.round(520 * uiScale));
    const barH = Math.round(42 * uiScale);

    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x000000, 0.75);
    hudBg.fillRoundedRect(centerX - barW / 2, y - barH / 2, barW, barH, 8);
    hudBg.lineStyle(1.5, 0xfeca57, 0.9);
    hudBg.strokeRoundedRect(centerX - barW / 2, y - barH / 2, barW, barH, 8);
    hudBg.setDepth(25);

    // Alive Counter
    this.aliveText = this.add.text(centerX - barW / 2 + Math.round(16 * uiScale), y, `👑 30 ALIVE`, {
      fontFamily: CUTE_FONT,
      fontSize: `${Math.round(14 * uiScale)}px`,
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5).setDepth(26);

    // Phase Indicator
    this.phaseText = this.add.text(centerX, y - Math.round(6 * uiScale), `PHASE 1`, {
      fontFamily: CUTE_FONT,
      fontSize: `${Math.round(11 * uiScale)}px`,
      color: '#2ed573',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(26);

    // Threat Alert
    this.threatText = this.add.text(centerX, y + Math.round(8 * uiScale), `SAFE (0 Threats)`, {
      fontFamily: CUTE_FONT,
      fontSize: `${Math.round(9 * uiScale)}px`,
      color: '#a4b0be',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(0.5).setDepth(26);

    // Badges & KOs
    this.badgeText = this.add.text(centerX + barW / 2 - Math.round(16 * uiScale), y, `⭐ 0 | KOs: 0`, {
      fontFamily: CUTE_FONT,
      fontSize: `${Math.round(13 * uiScale)}px`,
      color: '#ff9ff3',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(1, 0.5).setDepth(26);

    // Killfeed notification text
    this.killfeedText = this.add.text(centerX, y + barH / 2 + Math.round(10 * uiScale), '', {
      fontFamily: CUTE_FONT,
      fontSize: `${Math.round(11 * uiScale)}px`,
      color: '#fffa65',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(26);
  }

  private createThumbnailMatrix(width: number, height: number, boardLeftX: number, boardW: number, isMobile: boolean, uiScale: number): void {
    // Generate placeholder 29 opponents
    const thumbW = isMobile ? 38 : Math.round(44 * uiScale);
    const thumbH = isMobile ? 32 : Math.round(36 * uiScale);
    const cols = isMobile ? 2 : 2;
    const rowsPerWing = isMobile ? 7 : 8;

    let index = 0;

    // Helper to spawn a thumbnail
    const spawnThumbnail = (x: number, y: number, id: string, name: string, charId: string) => {
      const container = this.add.container(x, y);
      container.setDepth(18);

      const bg = this.add.graphics();
      const stackBar = this.add.graphics();

      const avatar = this.add.image(-thumbW / 2 + Math.round(11 * (isMobile ? 0.8 : 1.0)), 0, charId);
      const avatarSize = isMobile ? 18 : Math.round(20 * uiScale);
      avatar.setDisplaySize(avatarSize, avatarSize);

      const nameText = this.add.text(-thumbW / 2 + Math.round(23 * (isMobile ? 0.8 : 1.0)), -thumbH / 2 + 3, name.substring(0, 5), {
        fontSize: `${isMobile ? 7.5 : 8.5}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 1
      });

      const badgeText = this.add.text(-thumbW / 2 + Math.round(23 * (isMobile ? 0.8 : 1.0)), thumbH / 2 - 10, '', {
        fontSize: `${isMobile ? 7 : 8}px`,
        color: '#feca57',
        fontStyle: 'bold'
      });

      const threatIcon = this.add.text(thumbW / 2 - 4, -thumbH / 2 + 2, '', {
        fontSize: '9px',
        color: '#ff4757',
        fontStyle: 'bold'
      }).setOrigin(1, 0);

      // Interactive hit area for manual targeting
      const hit = this.add.rectangle(0, 0, thumbW, thumbH, 0x000000, 0);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.targeter.setManualTarget(id, name);
      });

      container.add([bg, stackBar, avatar, nameText, badgeText, threatIcon, hit]);

      this.thumbnails.set(id, {
        id,
        container,
        bg,
        stackBar,
        avatar,
        nameText,
        badgeText,
        threatIcon,
        width: thumbW,
        height: thumbH,
        x,
        y
      });

      this.drawThumbnailBorder(bg, thumbW, thumbH, false, false, false);
    };

    if (isMobile) {
      // 2 columns on left and right borders of phone
      const leftColX = 24;
      const rightColX = width - 24;
      const startY = 70;
      const stepY = (height - 130) / 8;

      for (let i = 0; i < 7; i++) {
        const id = `op_${index++}`;
        spawnThumbnail(leftColX, startY + i * stepY, id, `P${index}`, 'kiri');
      }
      for (let i = 0; i < 7; i++) {
        const id = `op_${index++}`;
        spawnThumbnail(rightColX, startY + i * stepY, id, `P${index}`, 'mizu');
      }
      // Remaining 15 in a neat footer ribbon
      const botStartX = 30;
      const botW = (width - 60) / 15;
      for (let i = 0; i < 15; i++) {
        const id = `op_${index++}`;
        spawnThumbnail(botStartX + i * botW, height - 18, id, `P${index}`, 'riff');
      }
    } else {
      // Desktop wings: Left Wing (14 opponents) & Right Wing (15 opponents)
      const leftStartX = Math.max(thumbW, boardLeftX - thumbW * 2.5 - 12);
      const rightStartX = boardLeftX + boardW + 16 + thumbW / 2;
      const startY = height / 2 - (rowsPerWing * (thumbH + 6)) / 2 + thumbH / 2 + 10;
      const gapX = thumbW + 6;
      const gapY = thumbH + 6;

      // Left Wing: 2 cols x 7 rows
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 2; c++) {
          const id = `op_${index++}`;
          spawnThumbnail(leftStartX + c * gapX, startY + r * gapY, id, `P${index}`, 'kiri');
        }
      }
      // Right Wing: 2 cols x 7.5 rows (15 opponents)
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 2; c++) {
          if (index >= 29) break;
          const id = `op_${index++}`;
          spawnThumbnail(rightStartX + c * gapX, startY + r * gapY, id, `P${index}`, 'mizu');
        }
      }
    }
  }

  private drawThumbnailBorder(bg: Phaser.GameObjects.Graphics, w: number, h: number, isTarget: boolean, isThreat: boolean, isDanger: boolean): void {
    bg.clear();
    const halfW = w / 2;
    const halfH = h / 2;

    bg.fillStyle(0x0a0518, 0.85);
    bg.fillRoundedRect(-halfW, -halfH, w, h, 4);

    let borderColor = 0x57606f;
    let strokeW = 1;

    if (isTarget) {
      borderColor = 0xfeca57;
      strokeW = 2.5;
    } else if (isThreat) {
      borderColor = 0xff4757;
      strokeW = 2;
    } else if (isDanger) {
      borderColor = 0xff6b6b;
      strokeW = 1.5;
    }

    bg.lineStyle(strokeW, borderColor, 1.0);
    bg.strokeRoundedRect(-halfW, -halfH, w, h, 4);
  }

  private setupGameplayInput(): void {
    // Touch & reciprocal gesture controller
    this.touchController = new TouchController(this, this.playerBoard, this.playerCursor, {
      occlusionOffsetY: 0
    });

    // Pointer events on scene
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isEliminated || this.isVictory || this.endModalActive) return;

      // Right-click or middle-click fast lift
      if (pointer.rightButtonDown() || pointer.button === 2 || pointer.button === 1) {
        this.playerBoard.isLifting = true;
        return;
      }

      if (this.touchController) {
        this.touchController.handlePointerDown(pointer);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isEliminated || this.isVictory || this.endModalActive) return;

      if (this.touchController) {
        this.touchController.handlePointerMove(pointer);
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isEliminated || this.isVictory || this.endModalActive) return;

      this.playerBoard.isLifting = false;

      if (this.touchController) {
        this.touchController.handlePointerUp(pointer);
      }
    });

    // Mouse Wheel Scroll -> Quick lift impulse
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
      if (this.isEliminated || this.isVictory || this.endModalActive) return;
      if (deltaY > 0) {
        this.playerBoard.isLifting = true;
        this.time.delayedCall(160, () => {
          if (this.playerBoard) this.playerBoard.isLifting = false;
        });
      }
    });

    // Keyboard listeners
    this.keydownHandler = (event: KeyboardEvent) => {
      if (this.endModalActive || this.isEliminated || this.isVictory) return;

      const code = event.code;
      const key = event.key;

      // Cursor movement
      if (key === 'ArrowLeft' || code === 'KeyA') {
        this.playerCursor.moveLeft();
      } else if (key === 'ArrowRight' || code === 'KeyD') {
        this.playerCursor.moveRight();
      } else if (key === 'ArrowUp' || code === 'KeyW') {
        this.playerCursor.moveUp();
      } else if (key === 'ArrowDown' || code === 'KeyS') {
        this.playerCursor.moveDown();
      }

      // Slime Swap
      if (code === 'Space' || key === ' ' || code === 'KeyX' || code === 'KeyC') {
        this.triggerPlayerSwap();
      }

      // Fast Lift
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyR' || key === 'Shift') {
        this.playerBoard.isLifting = true;
      }
    };

    this.keyupHandler = (event: KeyboardEvent) => {
      const code = event.code;
      const key = event.key;
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyR' || key === 'Shift') {
        if (this.playerBoard) {
          this.playerBoard.isLifting = false;
        }
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
  }

  private triggerPlayerSwap(): void {
    if (this.isEliminated || this.isVictory || this.endModalActive) return;
    this.playerBoard.swap(this.playerCursor.gridX, this.playerCursor.gridY);
  }

  private handleGameplayGamepadInput(delta: number): void {
    if (!this.input.gamepad || this.input.gamepad.total === 0) return;
    const pad = this.input.gamepad.gamepads[0];
    if (!pad || !pad.connected) return;

    // Movement: D-pad & Left Stick with DAS repeat
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
      if (this.gamepadLastDir !== dir) {
        this.gamepadLastDir = dir;
        this.executePadMove(dir);
        this.gamepadRepeatTimer = 160;
      } else {
        this.gamepadRepeatTimer -= delta;
        if (this.gamepadRepeatTimer <= 0) {
          this.executePadMove(dir);
          this.gamepadRepeatTimer = 75;
        }
      }
    } else {
      this.gamepadLastDir = null;
      this.gamepadRepeatTimer = 0;
    }

    // Swap: A (btn 0) or X (btn 2)
    const swapDown = pad.A || pad.X || pad.isButtonDown(0) || pad.isButtonDown(2);
    const prevSwap = this.gamepadPrevButtons.get(0) || false;
    if (swapDown && !prevSwap) {
      this.triggerPlayerSwap();
    }
    this.gamepadPrevButtons.set(0, swapDown);

    // Lift: B (1), Y (3), L1/R1 (4/5), L2/R2
    const liftDown = Boolean(
      pad.B || pad.Y || pad.L1 || pad.R1 ||
      pad.isButtonDown(1) || pad.isButtonDown(3) || pad.isButtonDown(4) || pad.isButtonDown(5) ||
      (pad.L2 > 0.3) || (pad.R2 > 0.3)
    );
    const prevLift = this.gamepadPrevButtons.get(1) || false;
    if (liftDown && !prevLift) {
      this.playerBoard.isLifting = true;
    } else if (!liftDown && prevLift) {
      this.playerBoard.isLifting = false;
    }
    this.gamepadPrevButtons.set(1, liftDown);
  }

  private executePadMove(dir: 'up' | 'down' | 'left' | 'right'): void {
    if (dir === 'left') this.playerCursor.moveLeft();
    else if (dir === 'right') this.playerCursor.moveRight();
    else if (dir === 'up') this.playerCursor.moveUp();
    else if (dir === 'down') this.playerCursor.moveDown();
  }

  private setupBoardEvents(): void {
    // 1. Combo / Chain Attack
    this.playerBoard.on('match', (event: MatchEvent) => {
      let lines = 0;
      if (event.comboSize === 4) lines += 1;
      else if (event.comboSize === 5) lines += 2;
      else if (event.comboSize >= 6) lines += 3;

      if (event.chainLevel === 2) lines += 2;
      else if (event.chainLevel === 3) lines += 3;
      else if (event.chainLevel >= 4) lines += 4;

      if (lines > 0) {
        SoundFx.playDecide();
        this.socketMgr.sendBRGarbage(this.roomId, lines, this.targeter.mode, this.targeter.manualId || undefined);
      }
    });

    // 2. Top-Out Elimination
    this.playerBoard.on('topOut', () => {
      if (this.isEliminated || this.isVictory) return;
      this.isEliminated = true;
      SoundFx.playTopOut();
      this.socketMgr.sendBRTopout(this.roomId);
      this.showChampionScreen(this.aliveCount, '', this.myKOs, this.myBadges);
    });
  }

  private setupSocketListeners(): void {
    // 1. Telemetry Snapshot (3 Hz)
    this.socketMgr.onBRTelemetrySnapshot((data) => {
      this.aliveCount = data.aliveCount;
      this.currentPhase = data.phase;
      this.aliveText.setText(`👑 ${this.aliveCount} ALIVE`);
      this.phaseText.setText(`PHASE ${this.currentPhase}`);
      this.checkTop5Music();

      // Count threats aiming at me
      let threatCount = 0;

      data.competitors.forEach((comp) => {
        if (comp.id === this.myId) {
          this.myBadges = comp.badges;
          return;
        }

        if (comp.targetId === this.myId && comp.isAlive) {
          threatCount++;
        }

        const thumb = this.thumbnails.get(comp.id);
        if (thumb) {
          const isTarget = this.currentTargetId === comp.id;
          const isThreat = comp.targetId === this.myId && comp.isAlive;
          thumb.threatIcon.setText(isThreat ? '⚡' : '');

          if (!comp.isAlive) {
            thumb.container.setAlpha(0.25);
            thumb.nameText.setColor('#747d8c');
            thumb.badgeText.setText('DEAD');
            thumb.stackBar.clear();
          } else {
            thumb.container.setAlpha(1.0);
            thumb.nameText.setText(comp.displayName.substring(0, 5));
            thumb.badgeText.setText(comp.badges > 0 ? `⭐${comp.badges}` : '');

            // Stack meter bar
            const meterW = 4;
            const meterH = Math.min(thumb.height - 8, Math.round((comp.stackHeight / 12) * (thumb.height - 8)));
            thumb.stackBar.clear();
            thumb.stackBar.fillStyle(comp.isDanger ? 0xff4757 : comp.stackHeight > 6 ? 0xfeca57 : 0x2ed573, 0.9);
            thumb.stackBar.fillRoundedRect(thumb.width / 2 - meterW - 3, thumb.height / 2 - 4 - meterH, meterW, meterH, 2);

            this.drawThumbnailBorder(thumb.bg, thumb.width, thumb.height, isTarget, isThreat, comp.isDanger);
          }
        }
      });

      if (threatCount > 0) {
        this.threatText.setText(`⚠️ TARGETED BY ${threatCount}!`).setColor('#ff4757');
      } else {
        this.threatText.setText(`SAFE (0 Threats)`).setColor('#a4b0be');
      }

      this.badgeText.setText(`⭐ ${this.myBadges} | KOs: ${this.myKOs}`);
      this.drawLaserLines();
    });

    // 2. Receive Incoming Garbage
    this.socketMgr.onBRReceiveGarbage((data) => {
      if (this.isEliminated || this.isVictory) return;
      SoundFx.playDangerBeep();
      for (let i = 0; i < data.lines; i++) {
        this.playerBoard.queueGarbage(BOARD_WIDTH, 1);
      }
    });

    // 3. Elimination Feed
    this.socketMgr.onBRElimination((data) => {
      this.aliveCount = data.aliveCount;
      this.checkTop5Music();

      this.killfeedText.setText(`⚡ ${data.killerName} KO'd ${data.victimName} (#${data.rank})`);
      this.time.delayedCall(2400, () => {
        if (this.killfeedText.active) this.killfeedText.setText('');
      });

      if (data.killerId === this.myId) {
        this.myKOs++;
        SoundFx.playCombo(3);
      }
    });

    // 4. Personal Elimination Modal
    this.socketMgr.onBRPersonalElimination((data) => {
      this.showChampionScreen(data.placement, data.killerName, data.kosCount, data.badges);
    });

    // 5. Phase Escalation
    this.socketMgr.onBRPhaseEscalate((data) => {
      SoundFx.playVictory();
      this.currentPhase = data.phase;
      const banner = data.phase === 3 ? '🔥 SUDDEN DEATH • TOP 5! 🔥' : '⚡ PHASE 2: STORM SPEEDUP! ⚡';
      this.showPhaseBanner(banner);

      if (data.phase === 3 || data.aliveCount <= 5) {
        this.playTop5Music();
      }

      // Increase stack speed
      if (data.phase === 2) {
        this.playerBoard.applyDifficulty(GameDifficulty.EXPERT);
      } else if (data.phase === 3) {
        this.playerBoard.applyDifficulty(GameDifficulty.MASTER);
      }
    });

    // 6. Match Victory Royale
    this.socketMgr.onBRMatchVictory((data) => {
      if (data.winnerId === this.myId) {
        this.showChampionScreen(1, '', data.kosCount, data.badges);
      }
    });
  }

  private drawLaserLines(): void {
    this.laserGraphics.clear();

    // Outbound yellow laser to our current target
    if (this.currentTargetId) {
      const targetThumb = this.thumbnails.get(this.currentTargetId);
      if (targetThumb && targetThumb.container.alpha > 0.4) {
        this.laserGraphics.lineStyle(2, 0xfeca57, 0.7);
        this.laserGraphics.lineBetween(this.boardCenterX, this.boardCenterY - 60, targetThumb.x, targetThumb.y);
      }
    }
  }

  private checkTop5Music(): void {
    if (this.isTop5MusicPlaying || this.aliveCount > 5) return;
    this.playTop5Music();
  }

  private playTop5Music(): void {
    if (this.isTop5MusicPlaying) return;
    this.isTop5MusicPlaying = true;

    const stressKey = this.cache.audio.exists('br_stress_bgm')
      ? 'br_stress_bgm'
      : (this.cache.audio.exists('Pixel_stress') ? 'Pixel_stress' : (this.cache.audio.exists('panic') ? 'panic' : ''));
    if (!stressKey) return;

    if (this.currentBgm && (this.currentBgm as any).isPlaying) {
      this.tweens.add({
        targets: this.currentBgm,
        volume: 0,
        duration: 400,
        onComplete: () => {
          if (this.currentBgm) {
            this.currentBgm.stop();
            this.currentBgm.destroy();
          }
          this.currentBgm = this.sound.add(stressKey, { loop: true, volume: Settings.musicVolume });
          this.currentBgm.play();
        }
      });
    } else {
      this.sound.stopAll();
      this.currentBgm = this.sound.add(stressKey, { loop: true, volume: Settings.musicVolume });
      this.currentBgm.play();
    }
  }

  private showPhaseBanner(text: string): void {
    const width = this.cameras.main.width;
    const banner = this.add.text(width / 2, this.boardCenterY - 40, text, {
      fontFamily: CUTE_FONT,
      fontSize: '20px',
      color: '#fffa65',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(40);

    this.tweens.add({
      targets: banner,
      scaleX: 1.25,
      scaleY: 1.25,
      y: banner.y - 30,
      alpha: 0,
      duration: 1800,
      onComplete: () => banner.destroy()
    });
  }

  private showChampionScreen(placement: number, killerName: string, kos: number, badges: number): void {
    if (this.endModalActive) {
      // If already open, update text with official server values
      const subStr = placement === 1
        ? 'SLIME MONARCH CONQUEROR!'
        : `FINISHED #${placement} / 30 • SLIME CONTENDER!`;
      if (this.endModalSubText) this.endModalSubText.setText(subStr);
      if (this.endModalKillerText && placement > 1 && killerName && killerName !== 'none') {
        this.endModalKillerText.setText(`Eliminated by: ${killerName}`);
      }
      if (this.endModalStatsText) {
        this.endModalStatsText.setText(`Total KOs: ${kos}  •  Final Badges: ${badges}`);
      }
      return;
    }

    this.endModalActive = true;
    this.isEliminated = true;
    if (placement === 1) this.isVictory = true;

    if (this.currentBgm) {
      this.currentBgm.stop();
    }
    SoundFx.playVictory();

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const uiScale = CuteUI.getUIScale(this);

    // 1. Confetti shower celebration
    for (let i = 0; i < 45; i++) {
      const star = this.add.image(Math.random() * width, -20, 'sparkle_star');
      star.setDepth(152);
      star.setTint([0xfff200, 0xff69b4, 0x00d2d3, 0x2ed573, 0xff9f43][Math.floor(Math.random() * 5)]);
      this.tweens.add({
        targets: star,
        y: height + 20,
        x: star.x + (Math.random() - 0.5) * 80,
        rotation: Math.PI * 4,
        duration: 1500 + Math.random() * 1200,
        repeat: -1
      });
    }

    // 2. Fullscreen vibrant victory royale background artwork (bright and crisp!)
    if (this.textures.exists('victory_royale_bg')) {
      const bgImg = this.add.image(width / 2, height / 2, 'victory_royale_bg');
      const scale = Math.max(width / bgImg.width, height / bgImg.height);
      bgImg.setScale(scale).setDepth(150);

      // Light transparent overlay (only 22% alpha) to keep artwork bright and visible
      const softOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.22);
      softOverlay.setDepth(151);
    } else {
      const softOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.70);
      softOverlay.setDepth(151);
    }

    // 3. Modal Plaque Box
    const boxW = Math.min(width - 32, Math.round(380 * uiScale));
    const boxH = Math.round(270 * uiScale);
    const boxX = width / 2;
    const boxY = height / 2;

    const box = this.add.graphics();
    box.setDepth(155);
    box.fillStyle(0x130a24, 0.90);
    box.fillRoundedRect(boxX - boxW / 2, boxY - boxH / 2, boxW, boxH, 16);
    box.lineStyle(3, 0xfeca57, 1);
    box.strokeRoundedRect(boxX - boxW / 2, boxY - boxH / 2, boxW, boxH, 16);

    // 4. Header Titles
    const titleStr = placement === 1 ? '👑 #1 VICTORY ROYALE! 👑' : '👑 BATTLE ROYALE CHAMPION 👑';
    const subStr = placement === 1
      ? 'SLIME MONARCH CONQUEROR!'
      : `FINISHED #${placement} / 30 • SLIME CONTENDER!`;

    this.endModalTitleText = this.add.text(boxX, boxY - boxH / 2 + Math.round(34 * uiScale), titleStr, {
      fontFamily: CUTE_FONT,
      fontSize: `${Math.round(20 * uiScale)}px`,
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(156);

    this.endModalSubText = this.add.text(boxX, boxY - boxH / 2 + Math.round(68 * uiScale), subStr, {
      fontFamily: CUTE_FONT,
      fontSize: `${Math.round(13 * uiScale)}px`,
      color: placement === 1 ? '#2ed573' : '#ff9ff3',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(156);

    let statsY = boxY - boxH / 2 + Math.round(108 * uiScale);
    if (placement > 1 && killerName && killerName !== 'none') {
      this.endModalKillerText = this.add.text(boxX, boxY - boxH / 2 + Math.round(92 * uiScale), `Eliminated by: ${killerName}`, {
        fontFamily: CUTE_FONT,
        fontSize: `${Math.round(11.5 * uiScale)}px`,
        color: '#ff6b6b'
      }).setOrigin(0.5).setDepth(156);
      statsY = boxY - boxH / 2 + Math.round(118 * uiScale);
    }

    this.endModalStatsText = this.add.text(boxX, statsY, `Total KOs: ${kos}  •  Final Badges: ${badges}`, {
      fontFamily: CUTE_FONT,
      fontSize: `${Math.round(14 * uiScale)}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(156);

    // 5. Action Buttons directly on scene (Depth 160)
    const btnY1 = boxY + boxH / 2 - Math.round(75 * uiScale);
    const btnY2 = boxY + boxH / 2 - Math.round(28 * uiScale);

    const playAgainBtn = CuteUI.createPillButton(this, boxX, btnY1, 'PLAY AGAIN 👑', () => {
      this.cleanup();
      this.scene.start('LobbyScene');
    }, {
      textureKey: 'pill_pink',
      width: Math.round(210 * uiScale),
      height: Math.round(38 * uiScale),
      fontSize: `${Math.round(13 * uiScale)}px`,
      autoScale: false
    });
    playAgainBtn.setDepth(160);

    const menuBtn = CuteUI.createPillButton(this, boxX, btnY2, 'MAIN MENU', () => {
      this.cleanup();
      this.scene.start('MenuScene');
    }, {
      textureKey: 'pill_grey',
      width: Math.round(210 * uiScale),
      height: Math.round(36 * uiScale),
      fontSize: `${Math.round(12 * uiScale)}px`,
      autoScale: false
    });
    menuBtn.setDepth(160);

    this.endModalButtons = [playAgainBtn, menuBtn];
    this.endModalIndex = 0;
    this.updateEndModalButtonVisuals();

    // Mouse Hover listeners
    playAgainBtn.on('pointerover', () => {
      this.endModalIndex = 0;
      this.updateEndModalButtonVisuals();
    });
    menuBtn.on('pointerover', () => {
      this.endModalIndex = 1;
      this.updateEndModalButtonVisuals();
    });

    // Keyboard listener
    this.endModalKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.code === 'KeyW' || e.code === 'KeyS') {
        SoundFx.playCursor();
        this.endModalIndex = this.endModalIndex === 0 ? 1 : 0;
        this.updateEndModalButtonVisuals();
      } else if (e.key === 'Enter' || e.code === 'Space') {
        if (this.endModalIndex === 0) {
          this.cleanup();
          this.scene.start('LobbyScene');
        } else {
          this.cleanup();
          this.scene.start('MenuScene');
        }
      } else if (e.key === 'Escape') {
        this.cleanup();
        this.scene.start('MenuScene');
      }
    };
    window.addEventListener('keydown', this.endModalKeyHandler);
  }

  private updateEndModalButtonVisuals(): void {
    this.endModalButtons.forEach((btn, idx) => {
      btn.setScale(idx === this.endModalIndex ? 1.08 : 1.0);
    });
  }

  private handleEndModalGamepadInput(delta: number): void {
    if (!this.input.gamepad || this.input.gamepad.total === 0) return;
    const pad = this.input.gamepad.gamepads[0];
    if (!pad || !pad.connected) return;

    const stickY = pad.leftStick ? pad.leftStick.y : 0;
    const isUp = pad.up || pad.isButtonDown(12) || stickY < -0.45;
    const isDown = pad.down || pad.isButtonDown(13) || stickY > 0.45;

    if (isUp || isDown) {
      if (this.padRepeatTimer <= 0) {
        SoundFx.playCursor();
        this.endModalIndex = this.endModalIndex === 0 ? 1 : 0;
        this.updateEndModalButtonVisuals();
        this.padRepeatTimer = 220;
      } else {
        this.padRepeatTimer -= delta;
      }
    } else {
      this.padRepeatTimer = 0;
    }

    const selectDown = pad.A || pad.isButtonDown(0) || pad.isButtonDown(9);
    const prevSelect = this.prevPadButtons.get(0) || false;
    if (selectDown && !prevSelect) {
      if (this.endModalIndex === 0) {
        this.cleanup();
        this.scene.start('LobbyScene');
      } else {
        this.cleanup();
        this.scene.start('MenuScene');
      }
    }
    this.prevPadButtons.set(0, selectDown);

    const backDown = pad.B || pad.isButtonDown(1);
    const prevBack = this.prevPadButtons.get(1) || false;
    if (backDown && !prevBack) {
      this.cleanup();
      this.scene.start('MenuScene');
    }
    this.prevPadButtons.set(1, backDown);
  }

  update(time: number, delta: number): void {
    if (this.endModalActive) {
      this.handleEndModalGamepadInput(delta);
      return;
    }
    if (this.isEliminated || this.isVictory) return;

    this.handleGameplayGamepadInput(delta);
    this.playerCursor.update(delta);
    this.playerBoard.update(time, delta);

    // 3 Hz Telemetry heartbeat to server
    this.telemetryTimer += delta;
    if (this.telemetryTimer >= 330) {
      this.telemetryTimer = 0;
      const currentStack = Math.round(this.playerBoard.getStackHeight());
      this.socketMgr.sendBRTelemetry(this.roomId, currentStack, this.playerBoard.isDanger);
    }
  }

  private cleanup(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    if (this.keyupHandler) {
      window.removeEventListener('keyup', this.keyupHandler);
      this.keyupHandler = undefined;
    }
    if (this.endModalKeyHandler) {
      window.removeEventListener('keydown', this.endModalKeyHandler);
      this.endModalKeyHandler = undefined;
    }
    if (this.touchController) {
      this.touchController.destroy();
      this.touchController = undefined;
    }
    if (this.targeter) {
      this.targeter.destroy();
    }
    if (this.currentBgm) {
      this.currentBgm.stop();
      this.currentBgm.destroy();
      this.currentBgm = undefined;
    }
    this.sound.stopAll();
    this.socketMgr.cleanBRListeners();
    this.socketMgr.leaveRoom(this.roomId);
  }
}
