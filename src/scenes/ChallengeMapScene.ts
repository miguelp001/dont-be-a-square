import Phaser from 'phaser';
import { CHARACTERS } from '../utils/Constants';
import { AI_PERSONALITIES } from '../objects/AIBot';
import { SoundFx } from '../utils/SoundFx';
import { CuteUI } from '../utils/CuteUI';
import { Settings } from '../utils/Settings';
import { GameDifficulty, getDifficultyInfo } from '../utils/Difficulty';
import { RecordManager } from '../utils/DifficultyRecords';
import { LeaderboardClient } from '../utils/LeaderboardClient';

export default class ChallengeMapScene extends Phaser.Scene {
  public characterId: string = 'kiri';
  public defeatedOpponents: string[] = [];
  public difficulty: GameDifficulty = GameDifficulty.ADEPT;
  public challengeScore: number = 0;

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
    this.difficulty = data?.difficulty || Settings.difficulty || GameDifficulty.ADEPT;
    this.challengeScore = Number(data?.challengeScore) || 0;
  }

  create(): void {
    this.selectableItems = [];
    this.selectedIndex = 0;
    this.prevPadButtons.clear();

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
    const isSecretPlayer = playerChar.isSecret;
    const opponents = isSecretPlayer
      ? CHARACTERS.filter((c) => c.id !== this.characterId).slice(0, 7)
      : CHARACTERS.filter((c) => !c.isSecret && c.id !== this.characterId);
    const totalOpponents = opponents.length; // 7 opponents
    const standardDefeatedCount = opponents.filter((c) => this.defeatedOpponents.includes(c.id)).length;
    const isAllStandardDefeated = standardDefeatedCount >= totalOpponents;

    const isMasterTier = this.difficulty === GameDifficulty.MASTER;
    const isGrandmasterTier = this.difficulty === GameDifficulty.GRANDMASTER;
    const targetBossId: 'void_slime' | 'nano_banana' | null = isMasterTier ? 'void_slime' : isGrandmasterTier ? 'nano_banana' : null;

    const isSecretBossRun = Boolean(
      targetBossId &&
      this.characterId !== targetBossId &&
      !this.defeatedOpponents.includes(targetBossId)
    );

    if (isAllStandardDefeated) {
      if (isSecretBossRun && targetBossId) {
        this.createSecretBossEncounter(playerChar, targetBossId);
        return;
      }
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

    // Subtitle instruction with Difficulty Badge
    const diffInfo = getDifficultyInfo(this.difficulty);
    this.add
      .text(width / 2, isMobile ? 46 : Math.round(54 * uiScale), `[${diffInfo.badgeText}] • Defeat all 7 challengers in any order to claim the crown!`, {
        fontSize: isMobile ? '12px' : Math.round(13 * uiScale) + 'px',
        color: diffInfo.hexColor,
        stroke: '#000000',
        strokeThickness: 1.5
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
      this.add.text(barX + 38, barY + barH / 2 - 7, `${playerChar.name}`, {
        fontSize: '13px',
        color: '#ff69b4',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 1.5
      });
      this.add.text(barX + 38, barY + barH / 2 + 7, `⭐ ${this.challengeScore.toLocaleString()} PTS`, {
        fontSize: '12px',
        color: '#2ed573',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 1.5
      });
    } else {
      this.add.text(barX + Math.round(50 * uiScale), barY + barH / 2 - Math.round(10 * uiScale), `Fighter: ${playerChar.name}`, {
        fontSize: Math.round(15 * uiScale) + 'px',
        color: '#ff69b4',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      });
      this.add.text(barX + Math.round(50 * uiScale), barY + barH / 2 + Math.round(7 * uiScale), playerChar.species, {
        fontSize: Math.round(12.5 * uiScale) + 'px',
        color: '#ff9ff3',
        fontStyle: 'italic',
        stroke: '#000000',
        strokeThickness: 1
      });

      this.add.text(
        barX + barW / 2,
        barY + barH / 2,
        `⭐ TOTAL SCORE: ${this.challengeScore.toLocaleString()}`,
        {
          fontSize: Math.round(13 * uiScale) + 'px',
          color: '#2ed573',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2
        }
      ).setOrigin(0.5);
    }

    // Progress counter on right
    const progressLabel = isMobile
      ? `🏆 ${standardDefeatedCount}/${totalOpponents} DEFEATED`
      : `🏆 PROGRESS: ${standardDefeatedCount} / ${totalOpponents} DEFEATED`;
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
      fontSize: isMobile ? '13px' : Math.round(14 * cardScale) + 'px',
      color: isDefeated ? '#a4b0be' : '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1.5
    });
    nameText.setOrigin(0.5);

    const titleY = isMobile ? y - 5 : y + Math.round(17 * cardScale);
    const titleText = this.add.text(contentX, titleY, personality?.title || char.species, {
      fontSize: isMobile ? '11px' : Math.round(11.5 * cardScale) + 'px',
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
        defeatedOpponents: this.defeatedOpponents,
        difficulty: this.difficulty,
        challengeScore: this.challengeScore
      });
    };

    this.selectableItems.push({
      highlight: setCardHighlight,
      activate: startBattleAction
    });

    const actionY = isMobile ? y + 17 : y + Math.round(44 * cardScale);

    if (isDefeated) {
      const clearBadge = this.add.text(contentX, actionY, '✓ DEFEATED', {
        fontSize: isMobile ? '11.5px' : Math.round(12.5 * cardScale) + 'px',
        color: '#2ed573',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 1.5
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
        fontSize: isMobile ? '11.5px' : Math.round(12.5 * cardScale) + 'px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 1.5
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

  /** Secret Boss Encounter Screen (Void Slime Champion for Master, Nano Banana for Grandmaster) */
  private createSecretBossEncounter(playerChar: any, bossId: 'void_slime' | 'nano_banana'): void {
    const isVoidSlime = bossId === 'void_slime';
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const isMobile = width < 600 || height >= width * 1.05;
    const uiScale = isMobile ? 1.0 : CuteUI.getUIScale(this);
    const cardScale = isMobile ? 1.0 : Math.min(1.3, uiScale);

    if (this.cache.audio.exists('panic') && !this.sound.get('panic')?.isPlaying) {
      this.sound.stopAll();
      this.sound.play('panic', { loop: true, volume: Settings.musicVolume });
    }

    // Dark cosmic void backdrop
    const voidBg = this.add.graphics();
    voidBg.fillStyle(isVoidSlime ? 0x0e061e : 0x080414, 0.96);
    voidBg.fillRect(0, 0, width, height);

    // Drifting cosmic / void stars
    for (let i = 0; i < 30; i++) {
      const sx = Math.random() * width;
      const sy = Math.random() * height;
      const star = this.add.image(sx, sy, 'sparkle_star');
      star.setDisplaySize(Math.round(11 * uiScale), Math.round(11 * uiScale));
      const starColors = isVoidSlime
        ? [0xa55eea, 0x00d2d3, 0xff9ff3, 0x54a0ff]
        : [0xfffa65, 0x00d2d3, 0xff4757, 0xa55eea];
      star.setTint(starColors[Math.floor(Math.random() * starColors.length)]);
      star.setAlpha(0.65);
      this.tweens.add({
        targets: star,
        alpha: { from: 0.2, to: 0.95 },
        scale: { from: 0.8, to: 1.35 },
        duration: 900 + Math.random() * 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    // Warning Header Banner
    const warningLabel = isVoidSlime
      ? '👑 EMERGENCY BOSS INVASION 👑'
      : '🍌⚠️ HIDDEN GRANDMASTER ANOMALY ⚠️🍌';
    const warningText = this.add.text(width / 2, isMobile ? 24 : Math.round(30 * uiScale), warningLabel, {
      fontSize: isMobile ? '16px' : Math.round(19 * uiScale) + 'px',
      color: isVoidSlime ? '#feca57' : '#ff4757',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.tweens.add({
      targets: warningText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const diffInfo = getDifficultyInfo(this.difficulty);
    const subLabel = isVoidSlime
      ? `[${diffInfo.badgeText}] • An ultra-cute crowned Void Slime Champion descends with space magic!`
      : `[${diffInfo.badgeText}] • The fabric of reality is peeling... Nano Banana has emerged!`;
    this.add.text(width / 2, isMobile ? 46 : Math.round(54 * uiScale), subLabel, {
      fontSize: isMobile ? '9.5px' : Math.round(10.5 * uiScale) + 'px',
      color: isVoidSlime ? '#ff9ff3' : '#00d2d3',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Boss Card
    const cardW = isMobile ? Math.min(width - 32, 310) : Math.round(340 * cardScale);
    const cardH = isMobile ? Math.min(height - 150, 315) : Math.round(330 * cardScale);
    const cardX = width / 2;
    const cardY = height / 2 - (isMobile ? 10 : Math.round(8 * uiScale));

    const card = this.add.graphics();
    card.fillStyle(isVoidSlime ? 0x170b2c : 0x130924, 0.96);
    card.fillRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 16);
    card.lineStyle(3, isVoidSlime ? 0xa55eea : 0xfeca57, 1);
    card.strokeRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 16);

    // Glowing cosmic outline
    card.lineStyle(1.5, isVoidSlime ? 0x00d2d3 : 0xff4757, 0.7);
    card.strokeRoundedRect(cardX - cardW / 2 + 3, cardY - cardH / 2 + 3, cardW - 6, cardH - 6, 14);

    // Boss Avatar
    const bossAvatarSize = isMobile ? 80 : Math.round(100 * cardScale);
    const bossAvatarY = cardY - cardH / 2 + Math.round(62 * cardScale);
    const bossAvatar = this.add.image(cardX, bossAvatarY, bossId);
    bossAvatar.setDisplaySize(bossAvatarSize, bossAvatarSize);

    this.tweens.add({
      targets: bossAvatar,
      y: bossAvatarY - 6,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Boss Titles
    const nameY = bossAvatarY + bossAvatarSize / 2 + Math.round(14 * cardScale);
    const nameLabel = isVoidSlime ? 'VOID SLIME CHAMPION 👑' : 'NANO BANANA 🍌👑';
    this.add.text(cardX, nameY, nameLabel, {
      fontSize: isMobile ? '16px' : Math.round(19 * cardScale) + 'px',
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const titleY = nameY + Math.round(17 * cardScale);
    const titleLabel = isVoidSlime
      ? 'Cosmic Void Monarch • Ultra Cute Space Magic Slime'
      : 'Glitch Nanite Overlord • Fabric of Reality Peeler';
    this.add.text(cardX, titleY, titleLabel, {
      fontSize: isMobile ? '9.5px' : Math.round(10.5 * cardScale) + 'px',
      color: isVoidSlime ? '#ff9ff3' : '#00d2d3',
      fontStyle: 'italic',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    const quoteY = titleY + Math.round(18 * cardScale);
    const quoteLabel = isVoidSlime
      ? '"The cosmic void calls... squish!"'
      : '"Reality is ripe for peeling!"';
    this.add.text(cardX, quoteY, quoteLabel, {
      fontSize: isMobile ? '10.5px' : Math.round(11.5 * cardScale) + 'px',
      color: '#dfe4ea',
      fontStyle: 'italic bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    const statsY = quoteY + Math.round(20 * cardScale);
    const statsLabel = isVoidSlime
      ? '✨ 170ms Reflexes  |  🌀 2.5x Combos & 2.2x Cascades  |  🌌 6 Slime Colors'
      : '⚡ 130ms Twitch Instincts  |  🌀 3.0x Cascade Chains  |  🌌 2 Handicap Slabs';
    this.add.text(cardX, statsY, statsLabel, {
      fontSize: isMobile ? '8.5px' : Math.round(9.5 * cardScale) + 'px',
      color: isVoidSlime ? '#00d2d3' : '#ff9ff3',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center'
    }).setOrigin(0.5);

    // Battle Button
    const btnW = isMobile ? Math.min(240, cardW - 32) : Math.round(250 * cardScale);
    const btnH = isMobile ? 36 : Math.round(40 * cardScale);
    const btnY = cardY + cardH / 2 - Math.round(30 * cardScale);

    const startBossBattle = () => {
      this.sound.stopAll();
      this.scene.start('GameScene', {
        mode: 'challenge',
        characterId: this.characterId,
        opponentCharacterId: bossId,
        defeatedOpponents: this.defeatedOpponents,
        difficulty: this.difficulty,
        challengeScore: this.challengeScore
      });
    };

    const battleBtnLabel = isVoidSlime ? '⚔️ CHALLENGE THE VOID SLIME ⚔️' : '⚔️ CONFRONT NANO BANANA ⚔️';
    const battleBtn = CuteUI.createPillButton(this, cardX, btnY, battleBtnLabel, startBossBattle, {
      textureKey: 'pill_pink',
      fontSize: isMobile ? '10.5px' : `${Math.round(12 * cardScale)}px`,
      width: btnW,
      height: btnH,
      autoScale: false
    });

    this.tweens.add({
      targets: battleBtn,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Bottom Navigation Buttons
    const footerY = height - Math.round(26 * uiScale);
    this.createFooterButton(width / 2, footerY, 'MAIN MENU', () => {
      this.scene.start('MenuScene');
    }, uiScale, Math.round(150 * uiScale), Math.round(32 * uiScale));

    this.selectedIndex = 0;
    this.selectableItems = [
      {
        highlight: (on: boolean) => battleBtn.setScale(on ? 1.08 : 1.0),
        activate: startBossBattle
      }
    ];
    this.setupNavigation();
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

    const hasDefeatedVoidSlime = this.defeatedOpponents.includes('void_slime');
    const hasDefeatedNanoBanana = this.defeatedOpponents.includes('nano_banana');

    if (hasDefeatedVoidSlime) {
      RecordManager.recordVoidSlimeDefeat();
    }
    if (hasDefeatedNanoBanana) {
      RecordManager.recordNanoBananaDefeat();
    }

    const champTitle = hasDefeatedNanoBanana
      ? 'GRANDMASTER LEGEND & ANOMALY CONQUEROR!'
      : hasDefeatedVoidSlime
      ? 'TRUE VOID SLAYER & MASTER SLIME CHAMPION!'
      : 'YOU ARE THE GRAND SLIME CHAMPION!';

    this.add
      .text(width / 2, isMobile ? 116 : Math.round(165 * uiScale), champTitle, {
        fontSize: isMobile ? '12px' : Math.round(16 * uiScale) + 'px',
        color: '#2ed573',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: isMobile ? 2 : Math.max(2, Math.round(4 * uiScale))
      })
      .setOrigin(0.5);

    const diffInfo = getDifficultyInfo(this.difficulty);
    RecordManager.recordChallengeClear(this.difficulty, playerChar.id, 0, this.challengeScore);
    if (this.challengeScore > 0) {
      LeaderboardClient.submitScore('challenge', this.difficulty, playerChar.id, this.challengeScore, 1).catch(() => {});
    }

    const bannerMsg = hasDefeatedNanoBanana
      ? '🍌👑 NANO BANANA CONQUERED • REALITY RESTORED! 👑🍌'
      : hasDefeatedVoidSlime
      ? '👑 VOID SLIME CHAMPION DEFEATED! 👑'
      : `👑 CONQUERED ON [${diffInfo.badgeText}] DIFFICULTY! 👑`;

    this.add
      .text(width / 2, isMobile ? 138 : Math.round(195 * uiScale), bannerMsg, {
        fontSize: isMobile ? '11px' : Math.round(14 * uiScale) + 'px',
        color: (hasDefeatedNanoBanana || hasDefeatedVoidSlime) ? '#feca57' : diffInfo.hexColor,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      })
      .setOrigin(0.5);

    // Champion Portrait
    const avatar = this.add.image(width / 2, isMobile ? 186 : Math.round(245 * uiScale), playerChar.id);
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

    const congratsText = hasDefeatedNanoBanana
      ? '🎉 Nano Banana defeated! Nano Banana is now UNLOCKED across all modes!'
      : hasDefeatedVoidSlime
      ? '🎉 Void Slime Champion defeated! Void Slime is now UNLOCKED for Online Multiplayer & Single Player!'
      : (this.difficulty === GameDifficulty.NOVICE || this.difficulty === GameDifficulty.ADEPT || this.difficulty === GameDifficulty.EXPERT)
      ? 'You conquered all 7 challenger personalities with pride!\n(Tip: Conquer Master to face the Void Slime, and Grandmaster to face Nano Banana!)'
      : 'You conquered the Road to Champion with supreme mastery!';

    this.add
      .text(width / 2, isMobile ? 268 : Math.round(325 * uiScale), congratsText, {
        fontSize: isMobile ? '10px' : Math.round(11.5 * uiScale) + 'px',
        color: (hasDefeatedNanoBanana || hasDefeatedVoidSlime) ? '#feca57' : '#c8d6e5',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
        wordWrap: { width: width - 40 }
      })
      .setOrigin(0.5);

    // Final Combined Score Display
    this.add
      .text(width / 2, isMobile ? 298 : Math.round(365 * uiScale), `✨ FINAL SCORE: ${this.challengeScore.toLocaleString()} PTS ✨`, {
        fontSize: isMobile ? '12.5px' : `${Math.round(15 * uiScale)}px`,
        color: '#2ed573',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5);

    // Action buttons
    const btnW = isMobile ? Math.min(108, Math.floor((width - 32) / 3)) : Math.round(135 * uiScale);
    const btnH = isMobile ? 32 : Math.round(34 * uiScale);
    const totalW = btnW * 3 + (isMobile ? 12 : 24);
    const startX = width / 2 - totalW / 2 + btnW / 2;
    const btnGap = btnW + (isMobile ? 6 : 12);
    const btnY = isMobile ? 336 : Math.round(416 * uiScale);

    this.createFooterButton(startX, btnY, 'PLAY AGAIN', () => {
      this.scene.start('ChallengeMapScene', {
        characterId: this.characterId,
        defeatedOpponents: [],
        challengeScore: 0
      });
    }, uiScale, btnW, btnH);

    this.createFooterButton(startX + btnGap, btnY, 'LEADERBOARD 🏆', () => {
      this.scene.start('LeaderboardScene', {
        returnScene: 'ChallengeMapScene',
        initialMode: 'challenge',
        initialDifficulty: this.difficulty
      });
    }, uiScale, btnW, btnH);

    this.createFooterButton(startX + btnGap * 2, btnY, 'MAIN MENU', () => {
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
