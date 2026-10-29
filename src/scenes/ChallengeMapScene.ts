import Phaser from 'phaser';
import { CHARACTERS } from '../utils/Constants';
import { AI_PERSONALITIES } from '../objects/AIBot';
import { SoundFx } from '../utils/SoundFx';
import { CuteUI } from '../utils/CuteUI';
import { Settings } from '../utils/Settings';

export default class ChallengeMapScene extends Phaser.Scene {
  public characterId: string = 'kiri';
  public defeatedOpponents: string[] = [];

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

    opponents.forEach((opp, i) => {
      const pos = cardPositions[i];
      const isDefeated = this.defeatedOpponents.includes(opp.id);
      const personality = AI_PERSONALITIES[opp.id];

      this.createOpponentCard(pos.x, pos.y, cardW, cardH, opp, personality, isDefeated);
    });

    // Bottom Navigation Buttons
    this.createFooterButton(width / 2 - 110, height - 32, 'CHANGE FIGHTER', () => {
      this.scene.start('CharacterSelectScene', { mode: 'challenge' });
    });

    this.createFooterButton(width / 2 + 110, height - 32, 'MAIN MENU', () => {
      this.scene.start('MenuScene');
    });
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

      // Hit area for clicking the card
      const hitArea = this.add.rectangle(x, y, w, h, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });

      hitArea.on('pointerover', () => {
        card.clear();
        card.fillStyle(0x1e293b, 0.95);
        card.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
        card.lineStyle(3, 0xff4757, 1);
        card.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
        avatar.setDisplaySize(48, 48);
      });

      hitArea.on('pointerout', () => {
        card.clear();
        card.fillStyle(fillColor, fillAlpha);
        card.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
        card.lineStyle(2, borderColor, 1);
        card.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
        avatar.setDisplaySize(44, 44);
      });

      hitArea.on('pointerdown', () => {
        this.sound.stopAll();
        this.scene.start('GameScene', {
          mode: 'challenge',
          characterId: this.characterId,
          opponentCharacterId: char.id,
          defeatedOpponents: this.defeatedOpponents
        });
      });
    }
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

  private createFooterButton(x: number, y: number, text: string, callback: () => void): void {
    CuteUI.createPillButton(this, x, y, text, callback, {
      textureKey: 'pill_sm_pink',
      fontSize: '12px',
      width: 150,
      height: 34
    });
  }
}
