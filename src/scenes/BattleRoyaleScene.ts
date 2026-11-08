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

    // Draw board frame
    const boardFrame = this.add.graphics();
    boardFrame.setDepth(20);
    this.drawBoardFrame(boardFrame, boardX, boardY, boardPixelW, boardPixelH, 0xff69b4);

    // Player Board instance
    this.playerBoard = new Board(this, boardX, boardY, this.boardScale);
    this.playerBoard.applyDifficulty(GameDifficulty.ADEPT);
    this.playerBoard.addInitialPanels(4, 0);

    // Player Cursor
    this.playerCursor = new Cursor(this, this.playerBoard);

    // Touch controls on mobile
    if (this.sys.game.device.input.touch) {
      this.touchController = new TouchController(this, this.playerBoard, this.playerCursor);
    }

    // Header Plaque
    this.createHeaderHUD(width / 2, Math.round(28 * uiScale), uiScale);

    // 4-Way Tactical Targeter Bar directly below board
    this.targeter = new BattleRoyaleTargeter(this, (mode, manualId) => {
      this.socketMgr.setBRTarget(this.roomId, mode, manualId);
    });
    const targeterW = Math.min(width - 24, Math.round(300 * uiScale));
    const targeterY = boardY + boardPixelH + Math.round(20 * uiScale);
    this.targeter.createUI(width / 2, targeterY, targeterW, uiScale);

    // Thumbnail Matrix
    this.createThumbnailMatrix(width, height, boardX, boardPixelW, isMobile, uiScale);

    // Setup Board Events
    this.setupBoardEvents();

    // Setup Socket.IO Event Listeners
    this.setupSocketListeners();

    // Scene teardown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  private drawBoardFrame(graphics: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): void {
    graphics.clear();
    graphics.fillStyle(0x0c0618, 0.88);
    graphics.fillRoundedRect(x - 6, y - 6, w + 12, h + 12, 10);
    graphics.lineStyle(3, color, 1.0);
    graphics.strokeRoundedRect(x - 6, y - 6, w + 12, h + 12, 10);
    graphics.lineStyle(1.5, 0xffffff, 0.5);
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
      this.showEliminationScreen(data.placement, data.killerName, data.kosCount, data.badges);
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
        this.showVictoryRoyaleScreen(data.badges, data.kosCount);
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

  private showEliminationScreen(placement: number, killerName: string, kos: number, badges: number): void {
    if (this.currentBgm) {
      this.currentBgm.stop();
    }
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const uiScale = CuteUI.getUIScale(this);

    const modal = this.add.container(width / 2, height / 2);
    modal.setDepth(100);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.82);
    backdrop.setInteractive();

    const boxW = Math.min(width - 32, Math.round(360 * uiScale));
    const boxH = Math.round(250 * uiScale);
    const box = this.add.graphics();
    box.fillStyle(0x130a24, 0.95);
    box.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 16);
    box.lineStyle(2, 0xff4757, 1);
    box.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 16);

    const placeTitle = this.add.text(0, -boxH / 2 + Math.round(35 * uiScale), `#${placement} PLACE`, {
      fontFamily: CUTE_FONT,
      fontSize: `${Math.round(26 * uiScale)}px`,
      color: placement <= 3 ? '#feca57' : '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const killerText = this.add.text(0, -boxH / 2 + Math.round(75 * uiScale), `Eliminated by: ${killerName}`, {
      fontSize: `${Math.round(12 * uiScale)}px`,
      color: '#ff6b6b'
    }).setOrigin(0.5);

    const statsText = this.add.text(0, -boxH / 2 + Math.round(105 * uiScale), `KOs: ${kos}  •  Badges: ${badges}`, {
      fontSize: `${Math.round(14 * uiScale)}px`,
      color: '#feca57',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Play Again button
    const playAgainBtn = CuteUI.createPillButton(this, 0, boxH / 2 - Math.round(70 * uiScale), 'PLAY AGAIN 👑', () => {
      this.cleanup();
      this.scene.start('LobbyScene');
    }, { textureKey: 'pill_pink', width: Math.round(200 * uiScale), height: Math.round(36 * uiScale), fontSize: '13px', autoScale: false });

    // Main Menu button
    const menuBtn = CuteUI.createPillButton(this, 0, boxH / 2 - Math.round(25 * uiScale), 'MAIN MENU', () => {
      this.cleanup();
      this.scene.start('MenuScene');
    }, { textureKey: 'pill_grey', width: Math.round(200 * uiScale), height: Math.round(34 * uiScale), fontSize: '12px', autoScale: false });

    modal.add([backdrop, box, placeTitle, killerText, statsText, playAgainBtn, menuBtn]);
  }

  private showVictoryRoyaleScreen(badges: number, kos: number): void {
    this.isVictory = true;
    if (this.currentBgm) {
      this.currentBgm.stop();
    }
    SoundFx.playVictory();

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const uiScale = CuteUI.getUIScale(this);

    // Confetti shower
    for (let i = 0; i < 50; i++) {
      const star = this.add.image(Math.random() * width, -20, 'sparkle_star');
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

    const modal = this.add.container(width / 2, height / 2);
    modal.setDepth(100);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.85);
    backdrop.setInteractive();

    const boxW = Math.min(width - 32, Math.round(380 * uiScale));
    const boxH = Math.round(260 * uiScale);
    const box = this.add.graphics();
    box.fillStyle(0x130a24, 0.95);
    box.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 16);
    box.lineStyle(3, 0xfeca57, 1);
    box.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 16);

    const title = this.add.text(0, -boxH / 2 + Math.round(36 * uiScale), '👑 #1 VICTORY ROYALE! 👑', {
      fontFamily: CUTE_FONT,
      fontSize: `${Math.round(22 * uiScale)}px`,
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    const subTitle = this.add.text(0, -boxH / 2 + Math.round(75 * uiScale), 'SLIME MONARCH CONQUEROR!', {
      fontSize: `${Math.round(13 * uiScale)}px`,
      color: '#2ed573',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const stats = this.add.text(0, -boxH / 2 + Math.round(110 * uiScale), `Total KOs: ${kos}  •  Final Badges: ${badges}`, {
      fontSize: `${Math.round(14 * uiScale)}px`,
      color: '#ff9ff3',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const againBtn = CuteUI.createPillButton(this, 0, boxH / 2 - Math.round(70 * uiScale), 'PLAY AGAIN 👑', () => {
      this.cleanup();
      this.scene.start('LobbyScene');
    }, { textureKey: 'pill_pink', width: Math.round(200 * uiScale), height: Math.round(36 * uiScale), fontSize: '13px', autoScale: false });

    const menuBtn = CuteUI.createPillButton(this, 0, boxH / 2 - Math.round(25 * uiScale), 'MAIN MENU', () => {
      this.cleanup();
      this.scene.start('MenuScene');
    }, { textureKey: 'pill_grey', width: Math.round(200 * uiScale), height: Math.round(34 * uiScale), fontSize: '12px', autoScale: false });

    modal.add([backdrop, box, title, subTitle, stats, againBtn, menuBtn]);
  }

  update(time: number, delta: number): void {
    if (this.isEliminated || this.isVictory) return;

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
