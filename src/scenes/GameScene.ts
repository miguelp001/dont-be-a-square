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
import { Settings } from '../utils/Settings';

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
  private playerAvatar!: Phaser.GameObjects.Image;
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
  private cpuSpeechBubble?: Phaser.GameObjects.Text;
  private cpuDangerText?: Phaser.GameObjects.Text;

  private socketMgr?: SocketManager;
  private gameTime: number = 180;
  private timeText!: Phaser.GameObjects.Text;
  private timerEvent!: Phaser.Time.TimerEvent;
  private isMatchOver: boolean = false;
  private isPaused: boolean = false;
  private pauseModalContainer?: Phaser.GameObjects.Container;

  // Touch & Mobile Gesture State
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
    CuteUI.createCuteBackground(this);

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

    // Bottom Help Text
    this.add
      .text(width / 2, height - 10, 'TOUCH / ARROWS: Move | TAP / SWAP: Switch | LIFT: Raise | ⏸: Menu', {
        fontSize: '10px',
        color: '#c8d6e5',
        stroke: '#000000',
        strokeThickness: 1
      })
      .setOrigin(0.5);
  }

  /** Setup 2-Board Layout for VS CPU and VS Online */
  private setupBattleMode(): void {
    const boardW = BOARD_WIDTH * PANEL_SIZE; // 192px
    const boardH = BOARD_VISIBLE_HEIGHT * PANEL_SIZE; // 320px
    const boardY = 88;

    const p1X = 24;
    const p2X = 296;
    const centerX = 256;

    // Center divider & VS badge
    this.add
      .text(centerX, boardY + 60, 'VS', {
        fontSize: '28px',
        color: '#ff69b4',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5);

    this.timeText = this.add
      .text(centerX, boardY + 110, `${this.gameTime}`, {
        fontSize: '20px',
        color: '#feca57',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5);

    // Setup Player 1 (Left)
    this.playerBorder = this.add.graphics();
    this.drawBoardFrame(this.playerBorder, p1X, boardY, boardW, boardH, 0xff69b4);
    this.playerBoard = new Board(this, p1X, boardY);
    this.playerBoard.addInitialPanels(5);
    this.playerCursor = new Cursor(this, this.playerBoard);

    const p1Char = CHARACTERS.find((c) => c.id === this.characterId) || CHARACTERS[0];
    this.playerAvatar = this.add.image(p1X + 24, 46, p1Char.id);
    this.playerAvatar.setDisplaySize(42, 42);

    this.add.text(p1X + 52, 28, p1Char.name, {
      fontSize: '13px',
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.add.text(p1X + 52, 43, p1Char.species, {
      fontSize: '9px',
      color: '#ff9ff3',
      fontStyle: 'italic bold',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.playerScoreText = this.add.text(p1X + 52, 56, 'SCORE: 0', {
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    });

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
      .text(p1X + boardW / 2, boardY - 14, '', {
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
    this.drawBoardFrame(this.cpuBorder, p2X, boardY, boardW, boardH, p2Color);
    this.cpuBoard = new Board(this, p2X, boardY);
    this.cpuBoard.addInitialPanels(5);
    this.cpuCursor = new Cursor(this, this.cpuBoard);
    this.cpuCursor.setStrokeStyle(3, p2Color);

    this.cpuDangerText = this.add
      .text(p2X + boardW / 2, boardY - 14, '', {
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
    this.cpuAvatar = this.add.image(p2X + boardW - 24, 46, p2Char.id);
    this.cpuAvatar.setDisplaySize(42, 42);

    this.add
      .text(p2X + boardW - 52, 28, `${p2Label}: ${p2Char.name}`, {
        fontSize: '13px',
        color: '#54a0ff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      })
      .setOrigin(1, 0);

    const subTitle = this.cpuBot ? this.cpuBot.personality.title : p2Char.species;
    this.add
      .text(p2X + boardW - 52, 43, subTitle, {
        fontSize: '9px',
        color: '#feca57',
        fontStyle: 'italic bold',
        stroke: '#000000',
        strokeThickness: 2
      })
      .setOrigin(1, 0);

    this.cpuScoreText = this.add
      .text(p2X + boardW - 52, 56, 'SCORE: 0', {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      })
      .setOrigin(1, 0);

    this.cpuChainText = this.add
      .text(p2X + boardW / 2, boardY + boardH + 16, '', {
        fontSize: '17px',
        color: '#54a0ff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5);

    // Wire Player Events
    this.playerBoard.on('stackRise', (e: { offset: number }) => this.playerCursor.setStackOffset(e.offset));
    this.playerBoard.on('rowShift', (e: { offset: number }) => this.playerCursor.shiftWithStack(e?.offset));
    this.playerBoard.on('match', (e: MatchEvent) => this.handlePlayerMatch(e));
    this.playerBoard.on('panelPop', (e: { x: number; y: number; color: number }) => {
      this.spawnPopParticles(p1X + e.x * PANEL_SIZE + PANEL_SIZE / 2, boardY + e.y * PANEL_SIZE - this.playerBoard.stackOffsetPixels + PANEL_SIZE / 2, e.color);
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
        this.spawnPopParticles(p2X + e.x * PANEL_SIZE + PANEL_SIZE / 2, boardY + e.y * PANEL_SIZE - this.cpuBoard!.stackOffsetPixels + PANEL_SIZE / 2, e.color);
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
    const boardW = BOARD_WIDTH * PANEL_SIZE;
    const boardH = BOARD_VISIBLE_HEIGHT * PANEL_SIZE;
    const boardX = Math.floor((width - boardW) / 2);
    const boardY = 75;

    this.playerBorder = this.add.graphics();
    this.drawBoardFrame(this.playerBorder, boardX, boardY, boardW, boardH, 0xff69b4);

    this.playerBoard = new Board(this, boardX, boardY);
    this.playerBoard.addInitialPanels(6);
    this.playerCursor = new Cursor(this, this.playerBoard);

    const charData = CHARACTERS.find((c) => c.id === this.characterId) || CHARACTERS[0];
    this.playerAvatar = this.add.image(42, 42, charData.id);
    this.playerAvatar.setDisplaySize(44, 44);

    this.add.text(72, 22, charData.name, {
      fontSize: '14px',
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.add.text(72, 38, charData.species, {
      fontSize: '10px',
      color: '#ff9ff3',
      fontStyle: 'italic bold',
      stroke: '#000000',
      strokeThickness: 2
    });

    this.playerScoreText = this.add.text(72, 52, 'SCORE: 0', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    });

    this.timeText = this.add
      .text(width - 50, 22, `TIME: ${this.gameTime}`, {
        fontSize: '15px',
        color: '#feca57',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(1, 0.5);

    this.playerChainText = this.add
      .text(width / 2, boardY + boardH + 18, '', {
        fontSize: '20px',
        color: '#ff9f43',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5);

    this.playerDangerText = this.add
      .text(boardX + boardW / 2, boardY - 14, '', {
        fontSize: '12px',
        color: '#ff4757',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5);

    this.playerBoard.on('stackRise', (e: { offset: number }) => this.playerCursor.setStackOffset(e.offset));
    this.playerBoard.on('rowShift', (e: { offset: number }) => this.playerCursor.shiftWithStack(e?.offset));
    this.playerBoard.on('match', (e: MatchEvent) => this.handlePlayerMatch(e));
    this.playerBoard.on('panelPop', (e: { x: number; y: number; color: number }) => {
      this.spawnPopParticles(boardX + e.x * PANEL_SIZE + PANEL_SIZE / 2, boardY + e.y * PANEL_SIZE - this.playerBoard.stackOffsetPixels + PANEL_SIZE / 2, e.color);
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
    borderColor: number
  ): void {
    g.clear();
    g.fillStyle(0x0a0c14, 0.75);
    g.fillRoundedRect(x - 4, y - 4, w + 8, h + 8, 6);
    g.lineStyle(3, borderColor, 1);
    g.strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, 6);

    g.lineStyle(1, 0xffffff, 0.08);
    for (let c = 1; c < BOARD_WIDTH; c++) {
      g.lineBetween(x + c * PANEL_SIZE, y, x + c * PANEL_SIZE, y + h);
    }
  }

  /** Update danger UI, banner countdown text, and board border color */
  private updateDangerUI(isPlayer: boolean, inDanger: boolean, secondsRemaining: number = 6.5): void {
    const textObj = isPlayer ? this.playerDangerText : this.cpuDangerText;
    const borderObj = isPlayer ? this.playerBorder : this.cpuBorder;
    const defaultColor = isPlayer ? 0xff69b4 : 0x54a0ff;
    const boardW = BOARD_WIDTH * PANEL_SIZE;
    const boardH = BOARD_VISIBLE_HEIGHT * PANEL_SIZE;
    const boardX = isPlayer
      ? (this.gameMode === 'endless' ? Math.floor((this.cameras.main.width - boardW) / 2) : 24)
      : 296;
    const boardY = this.gameMode === 'endless' ? 75 : 88;

    if (!borderObj) return;

    if (inDanger) {
      this.drawBoardFrame(borderObj, boardX, boardY, boardW, boardH, 0xff4757);
      if (textObj) {
        textObj.setText(`! DANGER: ${secondsRemaining.toFixed(1)}s !`);
        textObj.setColor(secondsRemaining < 2.5 ? '#ff3838' : '#ff9f43');
      }
    } else {
      this.drawBoardFrame(borderObj, boardX, boardY, boardW, boardH, defaultColor);
      if (textObj) {
        textObj.setText('');
      }
    }
  }

  private setupControls(): void {
    if (!this.input.keyboard) return;

    this.input.keyboard.on('keydown-LEFT', () => this.playerCursor.moveLeft());
    this.input.keyboard.on('keydown-A', () => this.playerCursor.moveLeft());

    this.input.keyboard.on('keydown-RIGHT', () => this.playerCursor.moveRight());
    this.input.keyboard.on('keydown-D', () => this.playerCursor.moveRight());

    this.input.keyboard.on('keydown-UP', () => this.playerCursor.moveUp());
    this.input.keyboard.on('keydown-W', () => this.playerCursor.moveUp());

    this.input.keyboard.on('keydown-DOWN', () => this.playerCursor.moveDown());
    this.input.keyboard.on('keydown-S', () => this.playerCursor.moveDown());

    this.input.keyboard.on('keydown-SPACE', () => {
      if (!this.isMatchOver) this.playerBoard.swap(this.playerCursor.gridX, this.playerCursor.gridY);
    });
    this.input.keyboard.on('keydown-X', () => {
      if (!this.isMatchOver) this.playerBoard.swap(this.playerCursor.gridX, this.playerCursor.gridY);
    });
    this.input.keyboard.on('keydown-C', () => {
      if (!this.isMatchOver) this.playerBoard.swap(this.playerCursor.gridX, this.playerCursor.gridY);
    });

    this.input.keyboard.on('keydown-SHIFT', () => this.playerBoard.setLifting(true));
    this.input.keyboard.on('keyup-SHIFT', () => this.playerBoard.setLifting(false));

    this.input.keyboard.on('keydown-R', () => this.playerBoard.setLifting(true));
    this.input.keyboard.on('keyup-R', () => this.playerBoard.setLifting(false));

    // Garbage Test Hotkeys
    this.input.keyboard.on('keydown-G', () => {
      if (!this.isMatchOver) {
        this.playerBoard.queueGarbage(3, 1);
        this.showAttackAlert(false, 1);
        this.triggerAvatarHurt(true);
        this.cameras.main.shake(100, 0.004);
      }
    });

    this.input.keyboard.on('keydown-H', () => {
      if (!this.isMatchOver) {
        this.playerBoard.queueGarbage(6, 1);
        this.showAttackAlert(false, 1);
        this.triggerAvatarHurt(true);
        this.cameras.main.shake(120, 0.005);
      }
    });

    this.input.keyboard.on('keydown-B', () => {
      if (!this.isMatchOver) {
        this.playerBoard.queueGarbage(6, 2);
        this.showAttackAlert(false, 2);
        this.triggerAvatarHurt(true);
        this.cameras.main.shake(150, 0.007);
      }
    });

    this.input.keyboard.on('keydown-Y', () => {
      if (!this.isMatchOver && this.cpuBoard) {
        this.cpuBoard.queueGarbage(3, 1);
        this.showAttackAlert(true, 1);
        this.triggerAvatarHurt(false);
      }
    });

    this.input.keyboard.on('keydown-ESC', () => {
      this.togglePause();
    });
  }

  /** Setup direct board gestures and mobile on-screen virtual touch controls */
  private setupTouchControls(): void {
    const width = this.cameras.main.width;

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

    // 2. Direct Board Tap & Swipe Handling
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isMatchOver || this.isPaused) return;

      const bX = this.playerBoard.boardOffsetX;
      const bY = this.playerBoard.boardOffsetY;
      const bW = BOARD_WIDTH * PANEL_SIZE;
      const bH = BOARD_VISIBLE_HEIGHT * PANEL_SIZE;

      if (
        pointer.x >= bX &&
        pointer.x <= bX + bW &&
        pointer.y >= bY &&
        pointer.y <= bY + bH
      ) {
        const localX = pointer.x - bX;
        const localY = pointer.y - (bY - this.playerBoard.stackOffsetPixels);
        const gx = Math.floor(localX / PANEL_SIZE);
        const gy = Math.floor(localY / PANEL_SIZE);

        if (gx >= 0 && gx < BOARD_WIDTH && gy >= 0 && gy < BOARD_VISIBLE_HEIGHT) {
          this.touchBoardActive = true;
          this.touchStartX = pointer.x;
          this.touchStartY = pointer.y;
          this.touchStartGridX = gx;
          this.touchStartGridY = gy;
          this.playerCursor.setGridPosition(Math.min(gx, BOARD_WIDTH - 2), gy);
        }
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.touchBoardActive || this.isMatchOver || this.isPaused) return;

      const dx = pointer.x - this.touchStartX;
      const dy = pointer.y - this.touchStartY;

      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 14) {
          // Swipe Right: execute swap at current cursor position
          this.playerBoard.swap(this.playerCursor.gridX, this.playerCursor.gridY);
          this.touchBoardActive = false;
        } else if (dx < -14) {
          // Swipe Left: move cursor left and execute swap
          if (this.playerCursor.gridX > 0) {
            this.playerCursor.gridX--;
            this.playerBoard.swap(this.playerCursor.gridX, this.playerCursor.gridY);
          }
          this.touchBoardActive = false;
        }
      } else if (dy < -20 && Math.abs(dy) > Math.abs(dx)) {
        // Swipe Up: quick fast-lift impulse
        this.playerBoard.setLifting(true);
        this.time.delayedCall(220, () => this.playerBoard.setLifting(false));
        this.touchBoardActive = false;
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.touchBoardActive && !this.isMatchOver && !this.isPaused) {
        const dist = Phaser.Math.Distance.Between(this.touchStartX, this.touchStartY, pointer.x, pointer.y);
        if (dist < 10) {
          // Quick tap in place: execute swap
          this.playerBoard.swap(this.playerCursor.gridX, this.playerCursor.gridY);
        }
      }
      this.touchBoardActive = false;
    });

    // 3. Virtual On-Screen Gamepad Controls at the bottom
    const bottomControls = this.add.container(0, 0);
    bottomControls.setDepth(35);

    // D-Pad Arrows (Left Side)
    const dpadX = 52;
    const dpadY = 464;
    const btnLeft = this.createTouchArrowButton(dpadX - 26, dpadY, '◀', () => this.playerCursor.moveLeft());
    const btnRight = this.createTouchArrowButton(dpadX + 26, dpadY, '▶', () => this.playerCursor.moveRight());
    const btnUp = this.createTouchArrowButton(dpadX, dpadY - 22, '▲', () => this.playerCursor.moveUp());
    const btnDown = this.createTouchArrowButton(dpadX, dpadY + 22, '▼', () => this.playerCursor.moveDown());

    // Center Lift Button
    const liftX = this.gameMode === 'endless' ? 122 : 158;
    const liftBtn = this.createTouchLiftButton(liftX, 464);

    // Right Swap Button (Pill Button on Right Thumb Side)
    const swapX = width - 64;
    const swapBtn = this.createTouchSwapButton(swapX, 464);

    bottomControls.add([btnLeft, btnRight, btnUp, btnDown, liftBtn, swapBtn]);
  }

  private createTouchArrowButton(x: number, y: number, label: string, onMove: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    const draw = (fillAlpha: number, scale: number = 1.0) => {
      bg.clear();
      bg.fillStyle(0x1e272e, fillAlpha);
      bg.fillCircle(0, 0, 15);
      bg.lineStyle(1.8, 0x54a0ff, 0.95);
      bg.strokeCircle(0, 0, 15);
      container.setScale(scale);
    };
    draw(0.75);

    const text = this.add.text(0, -1, label, {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const hit = this.add.circle(0, 0, 22, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });

    let repeatTimer: Phaser.Time.TimerEvent | null = null;

    hit.on('pointerdown', () => {
      draw(0.95, 0.92);
      onMove();
      repeatTimer = this.time.addEvent({
        delay: 140,
        callback: onMove,
        loop: true,
        startAt: -80
      });
    });

    const stopAction = () => {
      draw(0.75, 1.0);
      if (repeatTimer) {
        repeatTimer.remove();
        repeatTimer = null;
      }
    };

    hit.on('pointerup', stopAction);
    hit.on('pointerout', stopAction);

    container.add([bg, text, hit]);
    return container;
  }

  private createTouchLiftButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const w = 74;
    const h = 36;
    const bg = this.add.graphics();
    const draw = (color: number, scale: number = 1.0) => {
      bg.clear();
      bg.fillStyle(color, 0.92);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      bg.lineStyle(2, 0xffffff, 0.95);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      bg.fillStyle(0xffffff, 0.35);
      bg.fillRoundedRect(-w / 2 + 5, -h / 2 + 3, w - 10, h / 2 - 3, h / 4);
      container.setScale(scale);
    };
    draw(0x2ed573);

    const text = this.add.text(0, -1, '⬆ LIFT', {
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });

    hit.on('pointerdown', () => {
      draw(0x10ac84, 0.93);
      this.playerBoard.setLifting(true);
    });

    const stopLift = () => {
      draw(0x2ed573, 1.0);
      this.playerBoard.setLifting(false);
    };

    hit.on('pointerup', stopLift);
    hit.on('pointerout', stopLift);

    container.add([bg, text, hit]);
    return container;
  }

  private createTouchSwapButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const w = 92;
    const h = 38;
    const bg = this.add.graphics();
    const draw = (color: number, scale: number = 1.0) => {
      bg.clear();
      bg.fillStyle(color, 0.95);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      bg.lineStyle(2, 0xffffff, 0.95);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      bg.fillStyle(0xffffff, 0.38);
      bg.fillRoundedRect(-w / 2 + 6, -h / 2 + 3, w - 12, h / 2 - 3, h / 4);
      container.setScale(scale);
    };
    draw(0xff69b4);

    const text = this.add.text(0, -1, 'SWAP 🔄', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });

    hit.on('pointerdown', () => {
      draw(0xff477e, 0.92);
      if (!this.isMatchOver && !this.isPaused) {
        this.playerBoard.swap(this.playerCursor.gridX, this.playerCursor.gridY);
      }
    });

    hit.on('pointerup', () => draw(0xff69b4, 1.0));
    hit.on('pointerout', () => draw(0xff69b4, 1.0));

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

      this.pauseModalContainer.add([backdrop, box, title, resumeBtn, optionsBtn, restartBtn, menuBtn]);
    }

    this.pauseModalContainer.setVisible(true);
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
    if (!avatar) return;

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

    const charId = isPlayer1 ? this.characterId : this.opponentCharacterId;
    const charData = CHARACTERS.find((c) => c.id === charId);
    if (charData && charData.quote) {
      this.showSpeechBubble(isPlayer1, charData.quote);
    }
  }

  /** Animate character avatar hurt/shake when under attack or danger */
  private triggerAvatarHurt(isPlayer1: boolean): void {
    const avatar = isPlayer1 ? this.playerAvatar : this.cpuAvatar;
    if (!avatar) return;

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

  private updateTimer(): void {
    if (this.isMatchOver || this.isPaused) return;
    this.gameTime--;
    this.timeText.setText(`${this.gameTime}`);

    if (this.gameTime <= 0) {
      this.timerEvent.remove();
      const p1Wins = this.playerScore >= this.cpuScore;
      this.endMatch(p1Wins ? 'VICTORY!' : 'TIME UP!', p1Wins);
    }
  }

  public update(time: number, delta: number): void {
    if (this.isMatchOver || this.isPaused) return;

    this.playerBoard.update(time, delta);
    this.playerCursor.updatePosition();

    if (this.cpuBoard && this.cpuBot) {
      this.cpuBoard.update(time, delta);
      this.cpuCursor?.updatePosition();
      this.cpuBot.update(delta);
    }
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
