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
    const title = this.add.text(width / 2, 32, 'CHALLENGE MODE: ROAD TO CHAMPION', {
      fontSize: '20px',
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    });
    title.setOrigin(0.5);

    // Subtitle instruction
    this.add
      .text(width / 2, 54, 'Defeat all 7 challengers in any order to claim the crown!', {
        fontSize: '11px',
        color: '#c8d6e5',
        stroke: '#000000',
        strokeThickness: 2
      })
      .setOrigin(0.5);

    // Header bar with Player Portrait & Champion Progress
    const headerBar = this.add.graphics();
    headerBar.fillStyle(0x000000, 0.45);
    headerBar.fillRoundedRect(20, 68, width - 40, 48, 8);
    headerBar.lineStyle(1, 0xffffff, 0.15);
    headerBar.strokeRoundedRect(20, 68, width - 40, 48, 8);

    // Player Avatar badge
    const pAvatar = this.add.image(44, 92, playerChar.id);
    pAvatar.setDisplaySize(38, 38);

    this.add.text(70, 78, `Fighter: ${playerChar.name}`, {
      fontSize: '13px',
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.add.text(70, 94, playerChar.species, {
      fontSize: '10px',
      color: '#ff9ff3',
      fontStyle: 'italic',
      stroke: '#000000',
      strokeThickness: 1
    });

    // Progress counter on right
    const progressText = this.add.text(
      width - 36,
      92,
      `🏆 PROGRESS: ${this.defeatedOpponents.length} / ${totalOpponents} DEFEATED`,
      {
        fontSize: '13px',
        color: '#feca57',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }
    );
    progressText.setOrigin(1, 0.5);

    // Challengers Grid (7 opponents)
    // Row 1: 4 cards, Row 2: 3 cards
    const opponents = CHARACTERS.filter((c) => c.id !== this.characterId);
    const cardW = 108;
    const cardH = 130;

    // Positions for 7 cards
    const cardPositions = [
      { x: 74, y: 195 },
      { x: 195, y: 195 },
      { x: 316, y: 195 },
      { x: 437, y: 195 },
      { x: 135, y: 345 },
      { x: 256, y: 345 },
      { x: 377, y: 345 }
    ];

    const xOffset = Math.round(width / 2 - 256);

    opponents.forEach((opp, i) => {
      const pos = cardPositions[i];
      const isDefeated = this.defeatedOpponents.includes(opp.id);
      const personality = AI_PERSONALITIES[opp.id];

      this.createOpponentCard(pos.x + xOffset, pos.y, cardW, cardH, opp, personality, isDefeated);
    });

    // Bottom Navigation Buttons
    const cardsBottom = 345 + 65; // 410
    const safeBottom = height - 42;
    const footerY = Math.min(safeBottom, Math.max(cardsBottom + 45, 465));

    this.createFooterButton(width / 2 - 110, footerY, 'CHANGE FIGHTER', () => {
      this.scene.start('CharacterSelectScene', { mode: 'challenge' });
    });

    this.createFooterButton(width / 2 + 110, footerY, 'MAIN MENU', () => {
      this.scene.start('MenuScene');
    });

    this.selectedIndex = 0;
    this.selectableItems[0]?.highlight(true);
    this.setupNavigation();
  }

  private setupNavigation(): void {
    const moveSelection = (dx: number, dy: number) => {
      let nextIndex = this.selectedIndex;

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

        let nextIndex = this.selectedIndex;
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
    isDefeated: boolean
  ): void {
    const card = this.add.graphics();
    const borderColor = isDefeated ? 0x2ed573 : 0x54a0ff;
    const fillColor = isDefeated ? 0x1e272e : 0x0f172a;
    const fillAlpha = isDefeated ? 0.65 : 0.85;

    card.fillStyle(fillColor, fillAlpha);
    card.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    card.lineStyle(2, borderColor, isDefeated ? 0.6 : 1.0);
    card.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);

    // Opponent Portrait
    const avatar = this.add.image(x, y - 28, char.id);
    avatar.setDisplaySize(44, 44);
    if (isDefeated) {
      avatar.setTint(0x7f8c8d);
      avatar.setAlpha(0.65);
    }

    // Name
    const nameText = this.add.text(x, y + 2, char.name, {
      fontSize: '12px',
      color: isDefeated ? '#a4b0be' : '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    });
    nameText.setOrigin(0.5);

    // AI Title / Archetype
    const titleText = this.add.text(x, y + 17, personality?.title || char.species, {
      fontSize: '8.5px',
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
      avatar.setDisplaySize(on ? 48 : 44, on ? 48 : 44);
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

    if (isDefeated) {
      // Golden / Green Crown / Checkmark
      const clearBadge = this.add.text(x, y + 44, '✓ DEFEATED', {
        fontSize: '11px',
        color: '#2ed573',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      });
      clearBadge.setOrigin(0.5);
    } else {
      // Interactive Battle Button
      const btnBg = this.add.graphics();
      btnBg.fillStyle(0xff4757, 1);
      btnBg.fillRoundedRect(x - 38, y + 32, 76, 24, 6);
      btnBg.lineStyle(1, 0xffffff, 0.4);
      btnBg.strokeRoundedRect(x - 38, y + 32, 76, 24, 6);

      const battleText = this.add.text(x, y + 44, 'BATTLE!', {
        fontSize: '11px',
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

    SoundFx.playVictory();

    // Confetti shower
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width;
      const y = -10 - Math.random() * 80;
      const star = this.add.image(x, y, 'sparkle_star');
      star.setDisplaySize(14, 14);
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
      .text(width / 2, 70, '🏆', {
        fontSize: '54px'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 130, 'CONGRATULATIONS!', {
        fontSize: '28px',
        color: '#feca57',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 5
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 165, 'YOU ARE THE GRAND SLIME CHAMPION!', {
        fontSize: '18px',
        color: '#2ed573',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5);

    // Champion Portrait
    const avatar = this.add.image(width / 2, 235, playerChar.id);
    avatar.setDisplaySize(80, 80);

    // Pulsing glow circle behind champion
    const glow = this.add.graphics();
    glow.lineStyle(4, 0xfeca57, 0.8);
    glow.strokeCircle(width / 2, 235, 48);

    this.add
      .text(width / 2, 295, `${playerChar.name}: "${playerChar.quote}"`, {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'italic bold',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 325, 'You conquered all 7 challenger personalities with pride!', {
        fontSize: '12px',
        color: '#c8d6e5',
        stroke: '#000000',
        strokeThickness: 2
      })
      .setOrigin(0.5);

    // Action buttons
    this.createFooterButton(width / 2 - 110, 410, 'PLAY AGAIN', () => {
      this.scene.start('ChallengeMapScene', {
        characterId: this.characterId,
        defeatedOpponents: []
      });
    });

    this.createFooterButton(width / 2 + 110, 410, 'MAIN MENU', () => {
      this.scene.start('MenuScene');
    });
  }

  private createFooterButton(x: number, y: number, text: string, callback: () => void): Phaser.GameObjects.Container {
    const btn = CuteUI.createPillButton(this, x, y, text, callback, {
      textureKey: 'pill_sm_pink',
      fontSize: '12px',
      width: 150,
      height: 34
    });
    this.selectableItems.push({
      highlight: (on: boolean) => btn.setScale(on ? 1.08 : 1.0),
      activate: callback
    });
    return btn;
  }
}
