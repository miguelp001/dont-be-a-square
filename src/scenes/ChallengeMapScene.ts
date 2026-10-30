import Phaser from 'phaser';
import { CHARACTERS } from '../utils/Constants';
import { AI_PERSONALITIES } from '../objects/AIBot';
import { SoundFx } from '../utils/SoundFx';
import { CuteUI } from '../utils/CuteUI';
import { Settings } from '../utils/Settings';

export default class ChallengeMapScene extends Phaser.Scene {
  public characterId: string = 'kiri';
  public defeatedOpponents: string[] = [];

  private selectedIndex: number = 0;
  private selectableItems: {
    highlight: (on: boolean) => void;
    activate: () => void;
  }[] = [];
  private padRepeatTimer: number = 0;
  private prevPadButtons: Map<number, boolean> = new Map();

  constructor() {
    super({ key: 'ChallengeMapScene' });
  }

  init(data: any): void {
    this.characterId = data?.characterId || 'kiri';
    this.defeatedOpponents = data?.defeatedOpponents || [];
  }

  create(): void {
    if (this.cache.audio.exists('menu') && !this.sound.get('menu')?.isPlaying) {
      this.sound.stopAll();
      this.sound.play('menu', { loop: true, volume: Settings.musicVolume });
    }

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const isMobile = width < 600 || height >= width * 1.05;
    const uiScale = isMobile ? 1.0 : CuteUI.getUIScale(this);
    const cardScale = isMobile ? 1.0 : Math.min(1.35, uiScale);

    // Slowly drifting cute pastel pattern background
    CuteUI.createCuteBackground(this);

    const playerChar = CHARACTERS.find((c) => c.id === this.characterId) || CHARACTERS[0];
    const totalOpponents = CHARACTERS.length - 1; // 7 opponents
    const isAllDefeated = this.defeatedOpponents.length >= totalOpponents;

    if (isAllDefeated) {
      this.createChampionCelebration(playerChar);
      return;
    }

    // Top Header Banner
    const titleTextStr = isMobile ? 'CHALLENGE MODE' : 'CHALLENGE MODE: ROAD TO CHAMPION';
    const title = this.add.text(width / 2, isMobile ? 24 : Math.round(30 * uiScale), titleTextStr, {
      fontSize: isMobile ? '18px' : Math.round(20 * uiScale) + 'px',
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: Math.max(3, Math.round(4 * uiScale))
    });
    title.setOrigin(0.5);

    // Subtitle instruction
    this.add
      .text(width / 2, isMobile ? 46 : Math.round(54 * uiScale), 'Defeat all 7 challengers in any order to claim the crown!', {
        fontSize: isMobile ? '10px' : Math.round(11 * uiScale) + 'px',
        color: '#c8d6e5',
        stroke: '#000000',
        strokeThickness: 2
      })
      .setOrigin(0.5);

    // Header bar with Player Portrait & Champion Progress
    const barW = isMobile ? width - 24 : Math.min(width - 40, Math.round(760 * uiScale));
    const barH = isMobile ? 38 : Math.round(48 * uiScale);
    const barX = (width - barW) / 2;
    const barY = isMobile ? 60 : Math.round(68 * uiScale);

    const headerBar = this.add.graphics();
    headerBar.fillStyle(0x000000, 0.45);
    headerBar.fillRoundedRect(barX, barY, barW, barH, 8);
    headerBar.lineStyle(1, 0xffffff, 0.15);
    headerBar.strokeRoundedRect(barX, barY, barW, barH, 8);

    // Player Avatar badge
    const pAvatar = this.add.image(barX + (isMobile ? 20 : Math.round(24 * uiScale)), barY + barH / 2, playerChar.id);
    const pAvatarSize = isMobile ? 28 : Math.round(38 * cardScale);
    pAvatar.setDisplaySize(pAvatarSize, pAvatarSize);

    if (isMobile) {
      this.add.text(barX + 38, barY + barH / 2, `Fighter: ${playerChar.name}`, {
        fontSize: '11.5px',
        color: '#ff69b4',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0, 0.5);
    } else {
      this.add.text(barX + Math.round(50 * uiScale), barY + barH / 2 - Math.round(10 * uiScale), `Fighter: ${playerChar.name}`, {
        fontSize: Math.round(13 * uiScale) + 'px',
        color: '#ff69b4',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      });
      this.add.text(barX + Math.round(50 * uiScale), barY + barH / 2 + Math.round(7 * uiScale), playerChar.species, {
        fontSize: Math.round(10.5 * uiScale) + 'px',
        color: '#ff9ff3',
        fontStyle: 'italic',
        stroke: '#000000',
        strokeThickness: 1
      });
    }

    // Progress counter on right
    const progressLabel = isMobile
      ? `🏆 ${this.defeatedOpponents.length}/${totalOpponents} DEFEATED`
      : `🏆 PROGRESS: ${this.defeatedOpponents.length} / ${totalOpponents} DEFEATED`;
    const progressText = this.add.text(
      barX + barW - (isMobile ? 12 : Math.round(16 * uiScale)),
      barY + barH / 2,
      progressLabel,
      {
        fontSize: isMobile ? '11px' : Math.round(12.5 * uiScale) + 'px',
        color: '#feca57',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }
    );
    progressText.setOrigin(1, 0.5);

    // Challengers Grid (7 opponents)
    const opponents = CHARACTERS.filter((c) => c.id !== this.characterId);
    let cardPositions: { x: number; y: number }[] = [];
    let cardW: number;
    let cardH: number;
    let cardsBottom: number;

    if (isMobile) {
      // 2-Column Responsive Layout for Mobile Phone screens
      cardW = Math.min(156, Math.floor((width - 32) / 2));
      const availH = height - (barY + barH) - 75;
      cardH = Math.min(94, Math.max(78, Math.floor(availH / 4.2)));
      const colSpacing = cardW + 10;
      const rowSpacing = cardH + 8;
      const startY = barY + barH + 12 + cardH / 2;

      cardPositions = [
        { x: width / 2 - colSpacing / 2, y: startY },
        { x: width / 2 + colSpacing / 2, y: startY },
        { x: width / 2 - colSpacing / 2, y: startY + rowSpacing },
        { x: width / 2 + colSpacing / 2, y: startY + rowSpacing },
        { x: width / 2 - colSpacing / 2, y: startY + rowSpacing * 2 },
        { x: width / 2 + colSpacing / 2, y: startY + rowSpacing * 2 },
        { x: width / 2, y: startY + rowSpacing * 3 }
      ];
      cardsBottom = startY + rowSpacing * 3 + cardH / 2;
    } else {
      // Widescreen / Desktop Layout (Row 1: 4 cards, Row 2: 3 cards)
      cardW = Math.round(108 * cardScale);
      cardH = Math.round(130 * cardScale);
      const spacingX = Math.round(122 * cardScale);
      const row1Y = barY + barH + Math.round(18 * uiScale) + cardH / 2;
      const row2Y = row1Y + cardH + Math.round(16 * uiScale);

      cardPositions = [
        { x: width / 2 - 1.5 * spacingX, y: row1Y },
        { x: width / 2 - 0.5 * spacingX, y: row1Y },
        { x: width / 2 + 0.5 * spacingX, y: row1Y },
        { x: width / 2 + 1.5 * spacingX, y: row1Y },
        { x: width / 2 - spacingX, y: row2Y },
        { x: width / 2, y: row2Y },
        { x: width / 2 + spacingX, y: row2Y }
      ];
      cardsBottom = row2Y + cardH / 2;
    }

    opponents.forEach((opp, i) => {
      const pos = cardPositions[i];
      const isDefeated = this.defeatedOpponents.includes(opp.id);
      const personality = AI_PERSONALITIES[opp.id];

      this.createOpponentCard(pos.x, pos.y, cardW, cardH, opp, personality, isDefeated, cardScale, isMobile);
    });

    // Bottom Navigation Buttons
    const footerBtnW = isMobile ? Math.min(145, Math.floor((width - 32) / 2)) : Math.round(150 * uiScale);
    const footerBtnH = isMobile ? 32 : Math.round(34 * uiScale);
    const safeBottom = height - Math.round(24 * uiScale);
    const footerY = isMobile
      ? Math.min(safeBottom, cardsBottom + 26)
      : Math.min(safeBottom, cardsBottom + Math.round(38 * uiScale));
    const btnSpacing = isMobile ? Math.round(footerBtnW / 2 + 6) : Math.round(125 * uiScale);

    this.createFooterButton(width / 2 - btnSpacing, footerY, 'CHANGE FIGHTER', () => {
      this.scene.start('CharacterSelectScene', { mode: 'challenge' });
    }, uiScale, footerBtnW, footerBtnH);

    this.createFooterButton(width / 2 + btnSpacing, footerY, 'MAIN MENU', () => {
      this.scene.start('MenuScene');
    }, uiScale, footerBtnW, footerBtnH);

    this.selectedIndex = 0;
    this.selectableItems[0]?.highlight(true);
    this.setupNavigation();
  }

  private setupNavigation(): void {
    const isMobile = this.cameras.main.width < 600 || this.cameras.main.height >= this.cameras.main.width * 1.05;

    const moveSelection = (dx: number, dy: number) => {
      let nextIndex = this.selectedIndex;

      if (isMobile) {
        if (dy > 0) {
          if (this.selectedIndex <= 3) nextIndex = this.selectedIndex + 2;
          else if (this.selectedIndex <= 5) nextIndex = 6;
          else if (this.selectedIndex === 6) nextIndex = 7;
        } else if (dy < 0) {
          if (this.selectedIndex >= 7) nextIndex = 6;
          else if (this.selectedIndex === 6) nextIndex = 4;
          else if (this.selectedIndex >= 2) nextIndex = this.selectedIndex - 2;
        } else if (dx > 0) {
          if (this.selectedIndex % 2 === 0 && this.selectedIndex < 6) nextIndex = this.selectedIndex + 1;
          else if (this.selectedIndex === 7) nextIndex = 8;
        } else if (dx < 0) {
          if (this.selectedIndex % 2 === 1 && this.selectedIndex <= 5) nextIndex = this.selectedIndex - 1;
          else if (this.selectedIndex === 8) nextIndex = 7;
        }
      } else {
        if (dy !== 0) {
          if (dy > 0) {
            if (this.selectedIndex <= 3) nextIndex = Math.min(4 + this.selectedIndex, 6);
            else if (this.selectedIndex <= 6) nextIndex = this.selectedIndex <= 5 ? 7 : 8;
          } else {
            if (this.selectedIndex >= 7) nextIndex = this.selectedIndex === 7 ? 4 : 6;
            else if (this.selectedIndex >= 4) nextIndex = Math.min(this.selectedIndex - 4, 3);
          }
        } else if (dx !== 0) {
          if (this.selectedIndex <= 3) {
            nextIndex = (this.selectedIndex + dx + 4) % 4;
          } else if (this.selectedIndex <= 6) {
            nextIndex = 4 + (this.selectedIndex - 4 + dx + 3) % 3;
          } else {
            nextIndex = 7 + (this.selectedIndex - 7 + dx + 2) % 2;
          }
        }
      }

      if (nextIndex !== this.selectedIndex && this.selectableItems[nextIndex]) {
        SoundFx.playCursor();
        this.selectableItems[this.selectedIndex]?.highlight(false);
        this.selectedIndex = nextIndex;
        this.selectableItems[this.selectedIndex]?.highlight(true);
      }
    };

    this.input.keyboard?.on('keydown-LEFT', () => moveSelection(-1, 0));
    this.input.keyboard?.on('keydown-A', () => moveSelection(-1, 0));
    this.input.keyboard?.on('keydown-RIGHT', () => moveSelection(1, 0));
    this.input.keyboard?.on('keydown-D', () => moveSelection(1, 0));
    this.input.keyboard?.on('keydown-UP', () => moveSelection(0, -1));
    this.input.keyboard?.on('keydown-W', () => moveSelection(0, -1));
    this.input.keyboard?.on('keydown-DOWN', () => moveSelection(0, 1));
    this.input.keyboard?.on('keydown-S', () => moveSelection(0, 1));

    this.input.keyboard?.on('keydown-ENTER', () => {
      this.selectableItems[this.selectedIndex]?.activate();
    });
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.selectableItems[this.selectedIndex]?.activate();
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      SoundFx.playCursor();
      this.scene.start('CharacterSelectScene', { mode: 'challenge' });
    });
  }

  public update(_time: number, delta: number): void {
    this.handleGamepadInput(delta);
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

    const stickX = pad.leftStick ? pad.leftStick.x : 0;
    const stickY = pad.leftStick ? pad.leftStick.y : 0;

    const isLeft = pad.left || pad.isButtonDown(14) || stickX < -0.45;
    const isRight = pad.right || pad.isButtonDown(15) || stickX > 0.45;
    const isUp = pad.up || pad.isButtonDown(12) || stickY < -0.45;
    const isDown = pad.down || pad.isButtonDown(13) || stickY > 0.45;

    if (isLeft || isRight || isUp || isDown) {
      if (this.padRepeatTimer <= 0) {
        let dx = 0;
        let dy = 0;
        if (isLeft) dx = -1;
        else if (isRight) dx = 1;
        if (isUp) dy = -1;
        else if (isDown) dy = 1;

        const isMobile = this.cameras.main.width < 600 || this.cameras.main.height >= this.cameras.main.width * 1.05;
        let nextIndex = this.selectedIndex;

        if (isMobile) {
          if (dy > 0) {
            if (this.selectedIndex <= 3) nextIndex = this.selectedIndex + 2;
            else if (this.selectedIndex <= 5) nextIndex = 6;
            else if (this.selectedIndex === 6) nextIndex = 7;
          } else if (dy < 0) {
            if (this.selectedIndex >= 7) nextIndex = 6;
            else if (this.selectedIndex === 6) nextIndex = 4;
            else if (this.selectedIndex >= 2) nextIndex = this.selectedIndex - 2;
          } else if (dx > 0) {
            if (this.selectedIndex % 2 === 0 && this.selectedIndex < 6) nextIndex = this.selectedIndex + 1;
            else if (this.selectedIndex === 7) nextIndex = 8;
          } else if (dx < 0) {
            if (this.selectedIndex % 2 === 1 && this.selectedIndex <= 5) nextIndex = this.selectedIndex - 1;
            else if (this.selectedIndex === 8) nextIndex = 7;
          }
        } else {
          if (dy !== 0) {
            if (dy > 0) {
              if (this.selectedIndex <= 3) nextIndex = Math.min(4 + this.selectedIndex, 6);
              else if (this.selectedIndex <= 6) nextIndex = this.selectedIndex <= 5 ? 7 : 8;
            } else {
              if (this.selectedIndex >= 7) nextIndex = this.selectedIndex === 7 ? 4 : 6;
              else if (this.selectedIndex >= 4) nextIndex = Math.min(this.selectedIndex - 4, 3);
            }
          } else if (dx !== 0) {
            if (this.selectedIndex <= 3) {
              nextIndex = (this.selectedIndex + dx + 4) % 4;
            } else if (this.selectedIndex <= 6) {
              nextIndex = 4 + (this.selectedIndex - 4 + dx + 3) % 3;
            } else {
              nextIndex = 7 + (this.selectedIndex - 7 + dx + 2) % 2;
            }
          }
        }

        if (nextIndex !== this.selectedIndex && this.selectableItems[nextIndex]) {
          SoundFx.playCursor();
          this.selectableItems[this.selectedIndex]?.highlight(false);
          this.selectedIndex = nextIndex;
          this.selectableItems[this.selectedIndex]?.highlight(true);
        }

        this.padRepeatTimer = 220;
      } else {
        this.padRepeatTimer -= delta;
      }
    } else {
      this.padRepeatTimer = 0;
    }

    // Button 0 (A) or Start confirms
    const selectDown = pad.A || pad.isButtonDown(0) || pad.isButtonDown(9);
    const prevSelect = this.prevPadButtons.get(0) || false;
    if (selectDown && !prevSelect) {
      this.selectableItems[this.selectedIndex]?.activate();
    }
    this.prevPadButtons.set(0, selectDown);

    // Button 1 (B) returns
    const backDown = pad.B || pad.isButtonDown(1);
    const prevBack = this.prevPadButtons.get(1) || false;
    if (backDown && !prevBack) {
      SoundFx.playCursor();
      this.scene.start('CharacterSelectScene', { mode: 'challenge' });
    }
    this.prevPadButtons.set(1, backDown);
  }

  /** Render an interactive challenger card */
  private createOpponentCard(
    x: number,
    y: number,
    w: number,
    h: number,
    char: any,
    personality: any,
    isDefeated: boolean,
    cardScale: number = 1.0,
    isMobile: boolean = false
  ): void {
    const card = this.add.graphics();
    const borderColor = isDefeated ? 0x2ed573 : 0x54a0ff;
    const fillColor = isDefeated ? 0x1e272e : 0x0f172a;
    const fillAlpha = isDefeated ? 0.65 : 0.85;

    card.fillStyle(fillColor, fillAlpha);
    card.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    card.lineStyle(2, borderColor, isDefeated ? 0.6 : 1.0);
    card.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);

    // Positions based on mobile (horizontal) vs desktop (vertical)
    const avatarX = isMobile ? x - w / 2 + 28 : x;
    const avatarY = isMobile ? y : y - Math.round(28 * cardScale);
    const normalSize = isMobile ? 38 : Math.round(44 * cardScale);
    const hoverSize = isMobile ? 42 : Math.round(48 * cardScale);

    const avatar = this.add.image(avatarX, avatarY, char.id);
    avatar.setDisplaySize(normalSize, normalSize);
    if (isDefeated) {
      avatar.setTint(0x7f8c8d);
      avatar.setAlpha(0.65);
    }

    const contentX = isMobile ? x + 18 : x;
    const nameY = isMobile ? y - 18 : y + Math.round(2 * cardScale);
    const nameText = this.add.text(contentX, nameY, char.name, {
      fontSize: isMobile ? '12px' : Math.round(12 * cardScale) + 'px',
      color: isDefeated ? '#a4b0be' : '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    });
    nameText.setOrigin(0.5);

    const titleY = isMobile ? y - 5 : y + Math.round(17 * cardScale);
    const titleText = this.add.text(contentX, titleY, personality?.title || char.species, {
      fontSize: isMobile ? '8px' : Math.round(8.5 * cardScale) + 'px',
      color: isDefeated ? '#747d8c' : '#feca57',
      fontStyle: 'italic',
      stroke: '#000000',
      strokeThickness: 1,
      align: 'center'
    });
    titleText.setOrigin(0.5);

    const cardIndex = this.selectableItems.length;

    const setCardHighlight = (on: boolean) => {
      card.clear();
      card.fillStyle(on ? 0x1e293b : fillColor, on ? 0.95 : fillAlpha);
      card.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
      card.lineStyle(on ? 3 : 2, on ? 0xff4757 : borderColor, on ? 1.0 : (isDefeated ? 0.6 : 1.0));
      card.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
      avatar.setDisplaySize(on ? hoverSize : normalSize, on ? hoverSize : normalSize);
    };

    const startBattleAction = () => {
      this.sound.stopAll();
      this.scene.start('GameScene', {
        mode: 'challenge',
        characterId: this.characterId,
        opponentCharacterId: char.id,
        defeatedOpponents: this.defeatedOpponents
      });
    };

    this.selectableItems.push({
      highlight: setCardHighlight,
      activate: startBattleAction
    });

    const actionY = isMobile ? y + 17 : y + Math.round(44 * cardScale);

    if (isDefeated) {
      const clearBadge = this.add.text(contentX, actionY, '✓ DEFEATED', {
        fontSize: isMobile ? '10px' : Math.round(11 * cardScale) + 'px',
        color: '#2ed573',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      });
      clearBadge.setOrigin(0.5);
    } else {
      const btnW = isMobile ? 68 : Math.round(76 * cardScale);
      const btnH = isMobile ? 22 : Math.round(24 * cardScale);
      const btnBg = this.add.graphics();
      btnBg.fillStyle(0xff4757, 1);
      btnBg.fillRoundedRect(contentX - btnW / 2, actionY - btnH / 2, btnW, btnH, 6);
      btnBg.lineStyle(1, 0xffffff, 0.4);
      btnBg.strokeRoundedRect(contentX - btnW / 2, actionY - btnH / 2, btnW, btnH, 6);

      const battleText = this.add.text(contentX, actionY, 'BATTLE!', {
        fontSize: isMobile ? '10px' : Math.round(11 * cardScale) + 'px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      });
      battleText.setOrigin(0.5);
    }

    // Hit area for clicking the card
    const hitArea = this.add.rectangle(x, y, w, h, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      if (this.selectedIndex !== cardIndex) {
        this.selectableItems[this.selectedIndex]?.highlight(false);
        this.selectedIndex = cardIndex;
        setCardHighlight(true);
      }
    });

    hitArea.on('pointerout', () => {
      if (this.selectedIndex !== cardIndex) {
        setCardHighlight(false);
      }
    });

    hitArea.on('pointerdown', startBattleAction);
  }

  /** Grand Champion Celebration Screen */
  private createChampionCelebration(playerChar: any): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const isMobile = width < 600 || height >= width * 1.05;
    const uiScale = isMobile ? 1.0 : CuteUI.getUIScale(this);

    SoundFx.playVictory();

    // Confetti shower
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width;
      const y = -10 - Math.random() * 80;
      const star = this.add.image(x, y, 'sparkle_star');
      star.setDisplaySize(Math.round(14 * uiScale), Math.round(14 * uiScale));
      star.setTint([0xfff200, 0xff69b4, 0x00d2d3, 0x2ed573, 0xff9f43][Math.floor(Math.random() * 5)]);

      this.tweens.add({
        targets: star,
        y: height + 20,
        x: x + (Math.random() - 0.5) * 100,
        rotation: Math.PI * 6,
        duration: 1800 + Math.random() * 1500,
        repeat: -1,
        ease: 'Sine.easeIn'
      });
    }

    // Trophy Badge
    this.add
      .text(width / 2, isMobile ? 45 : Math.round(70 * uiScale), '🏆', {
        fontSize: isMobile ? '40px' : Math.round(54 * uiScale) + 'px'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, isMobile ? 88 : Math.round(130 * uiScale), 'CONGRATULATIONS!', {
        fontSize: isMobile ? '22px' : Math.round(28 * uiScale) + 'px',
        color: '#feca57',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: isMobile ? 3 : Math.max(3, Math.round(5 * uiScale))
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, isMobile ? 116 : Math.round(165 * uiScale), 'YOU ARE THE GRAND SLIME CHAMPION!', {
        fontSize: isMobile ? '13px' : Math.round(18 * uiScale) + 'px',
        color: '#2ed573',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: isMobile ? 2 : Math.max(2, Math.round(4 * uiScale))
      })
      .setOrigin(0.5);

    // Champion Portrait
    const avatar = this.add.image(width / 2, isMobile ? 180 : Math.round(235 * uiScale), playerChar.id);
    const champSize = isMobile ? 64 : Math.round(80 * uiScale);
    avatar.setDisplaySize(champSize, champSize);

    // Pulsing glow circle behind champion
    const glow = this.add.graphics();
    glow.lineStyle(Math.max(2, Math.round(4 * uiScale)), 0xfeca57, 0.8);
    glow.strokeCircle(width / 2, isMobile ? 180 : Math.round(235 * uiScale), Math.round(champSize * 0.6));

    this.add
      .text(width / 2, isMobile ? 234 : Math.round(295 * uiScale), `${playerChar.name}: "${playerChar.quote}"`, {
        fontSize: isMobile ? '12px' : Math.round(14 * uiScale) + 'px',
        color: '#ffffff',
        fontStyle: 'italic bold',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
        wordWrap: { width: width - 40 }
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, isMobile ? 268 : Math.round(325 * uiScale), 'You conquered all 7 challenger personalities with pride!', {
        fontSize: isMobile ? '10.5px' : Math.round(12 * uiScale) + 'px',
        color: '#c8d6e5',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
        wordWrap: { width: width - 40 }
      })
      .setOrigin(0.5);

    // Action buttons
    const btnW = isMobile ? Math.min(140, Math.floor((width - 32) / 2)) : Math.round(150 * uiScale);
    const btnH = isMobile ? 32 : Math.round(34 * uiScale);
    const btnSpacing = isMobile ? btnW / 2 + 6 : Math.round(125 * uiScale);
    const btnY = isMobile ? 320 : Math.round(410 * uiScale);

    this.createFooterButton(width / 2 - btnSpacing, btnY, 'PLAY AGAIN', () => {
      this.scene.start('ChallengeMapScene', {
        characterId: this.characterId,
        defeatedOpponents: []
      });
    }, uiScale, btnW, btnH);

    this.createFooterButton(width / 2 + btnSpacing, btnY, 'MAIN MENU', () => {
      this.scene.start('MenuScene');
    }, uiScale, btnW, btnH);
  }

  private createFooterButton(
    x: number,
    y: number,
    text: string,
    callback: () => void,
    uiScale: number = 1.0,
    btnWidth?: number,
    btnHeight?: number
  ): Phaser.GameObjects.Container {
    const w = btnWidth || Math.round(150 * uiScale);
    const h = btnHeight || Math.round(34 * uiScale);
    const btn = CuteUI.createPillButton(this, x, y, text, callback, {
      textureKey: 'pill_sm_pink',
      fontSize: `${Math.max(10, Math.round(12 * (w / 150)))}px`,
      width: w,
      height: h,
      autoScale: false
    });
    this.selectableItems.push({
      highlight: (on: boolean) => btn.setScale(on ? 1.08 : 1.0),
      activate: callback
    });
    return btn;
  }
}
