import Phaser from 'phaser';
import { CHARACTERS, CUTE_FONT } from '../utils/Constants';
import { AI_PERSONALITIES } from '../objects/AIBot';
import { CuteUI } from '../utils/CuteUI';
import { Settings } from '../utils/Settings';
import { SoundFx } from '../utils/SoundFx';

const THEME_COLORS: Record<string, { primary: number; hex: string; light: string }> = {
  kiri: { primary: 0xff9f43, hex: '#ff9f43', light: '#feca57' },
  mizu: { primary: 0x00d2d3, hex: '#00d2d3', light: '#48dbfb' },
  riff: { primary: 0xfeca57, hex: '#feca57', light: '#fffa65' },
  mocha: { primary: 0xa55eea, hex: '#a55eea', light: '#d980fa' },
  ember: { primary: 0xff6b6b, hex: '#ff6b6b', light: '#ff9ff3' },
  volt: { primary: 0x1dd1a1, hex: '#1dd1a1', light: '#55efc4' },
  salty: { primary: 0x54a0ff, hex: '#54a0ff', light: '#70a1ff' },
  poppy: { primary: 0xff69b4, hex: '#ff69b4', light: '#ff9ff3' }
};

export default class CharacterProfileScene extends Phaser.Scene {
  private currentIndex: number = 0;
  private returnScene: string = 'MenuScene';

  private cardContainer?: Phaser.GameObjects.Container;
  private padRepeatTimer: number = 0;
  private prevPadButtons: Map<number, boolean> = new Map();

  constructor() {
    super({ key: 'CharacterProfileScene' });
  }

  init(data: any): void {
    this.returnScene = data?.returnScene || 'MenuScene';
    const targetId = data?.characterId || 'kiri';
    const foundIndex = CHARACTERS.findIndex((c) => c.id === targetId);
    this.currentIndex = foundIndex >= 0 ? foundIndex : 0;
  }

  create(): void {
    if (this.cache.audio.exists('char_select') && !this.sound.get('char_select')?.isPlaying) {
      this.sound.stopAll();
      this.sound.play('char_select', { loop: true, volume: Settings.musicVolume });
    }

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Drifting fairytale meadow background
    CuteUI.createCuteBackground(this, 'meadow');

    // Header Title
    this.add
      .text(width / 2, 38, 'SLIME CATCHER PROFILE', {
        fontFamily: CUTE_FONT,
        fontSize: '22px',
        color: '#ff69b4',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5);

    // Render character profile card
    this.renderProfileCard();

    // Bottom Action Buttons
    const isNarrow = width < 450;
    const safeBottom = height - (isNarrow ? 22 : 42);

    if (isNarrow) {
      const btnW = Math.min(width - 40, 240);
      CuteUI.createPillButton(
        this,
        width / 2,
        safeBottom - 84,
        'PLAY CHALLENGE 🏆',
        () => {
          const char = CHARACTERS[this.currentIndex];
          this.scene.start('ChallengeMapScene', { characterId: char.id, defeatedOpponents: [] });
        },
        { textureKey: 'pill_pink', fontSize: '12px', width: btnW, height: 34 }
      );

      CuteUI.createPillButton(
        this,
        width / 2,
        safeBottom - 44,
        'PLAY ENDLESS ⏳',
        () => {
          const char = CHARACTERS[this.currentIndex];
          this.scene.start('GameScene', { mode: 'endless', characterId: char.id });
        },
        { textureKey: 'pill_green', fontSize: '12px', width: btnW, height: 34 }
      );

      CuteUI.createPillButton(
        this,
        width / 2,
        safeBottom - 4,
        'BACK TO MENU',
        () => {
          SoundFx.playCursor();
          this.scene.start(this.returnScene);
        },
        { textureKey: 'pill_grey', fontSize: '12px', width: btnW, height: 34 }
      );
    } else {
      const btnW = Math.min(width - 48, 200);

      CuteUI.createPillButton(
        this,
        width / 2 - 110,
        safeBottom - 50,
        'PLAY CHALLENGE 🏆',
        () => {
          const char = CHARACTERS[this.currentIndex];
          this.scene.start('ChallengeMapScene', { characterId: char.id, defeatedOpponents: [] });
        },
        { textureKey: 'pill_pink', fontSize: '12px', width: btnW, height: 38 }
      );

      CuteUI.createPillButton(
        this,
        width / 2 + 110,
        safeBottom - 50,
        'PLAY ENDLESS ⏳',
        () => {
          const char = CHARACTERS[this.currentIndex];
          this.scene.start('GameScene', { mode: 'endless', characterId: char.id });
        },
        { textureKey: 'pill_green', fontSize: '12px', width: btnW, height: 38 }
      );

      CuteUI.createPillButton(
        this,
        width / 2,
        safeBottom,
        'BACK TO MENU',
        () => {
          SoundFx.playCursor();
          this.scene.start(this.returnScene);
        },
        { textureKey: 'pill_grey', fontSize: '13px', width: Math.min(width - 48, 220), height: 38 }
      );
    }

    // Keyboard navigation
    this.input.keyboard?.on('keydown-LEFT', () => this.navigate(-1));
    this.input.keyboard?.on('keydown-A', () => this.navigate(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.navigate(1));
    this.input.keyboard?.on('keydown-D', () => this.navigate(1));
    this.input.keyboard?.on('keydown-ESC', () => {
      SoundFx.playCursor();
      this.scene.start(this.returnScene);
    });
  }

  private navigate(delta: number): void {
    SoundFx.playCursor();
    this.currentIndex = (this.currentIndex + delta + CHARACTERS.length) % CHARACTERS.length;
    this.renderProfileCard();
  }

  private renderProfileCard(): void {
    if (this.cardContainer) {
      this.cardContainer.destroy();
    }

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const char = CHARACTERS[this.currentIndex];
    const personality = AI_PERSONALITIES[char.id] || AI_PERSONALITIES['mizu'];
    const theme = THEME_COLORS[char.id] || { primary: 0xff69b4, hex: '#ff69b4', light: '#ff9ff3' };

    const cardW = Math.min(width - 32, 430);
    const cardH = Math.min(height - 180, 420);
    const cardY = 66 + cardH / 2;

    this.cardContainer = this.add.container(width / 2, cardY);

    // 1. Card Background
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x181028, 0.96);
    cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);
    cardBg.lineStyle(3, theme.primary, 1);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);

    // Card header dividing rule
    cardBg.lineStyle(1.5, theme.primary, 0.35);
    cardBg.strokeLineShape(new Phaser.Geom.Line(-cardW / 2 + 20, -cardH / 2 + 106, cardW / 2 - 20, -cardH / 2 + 106));

    // 2. Navigation Arrows (Left / Right)
    const arrowY = -cardH / 2 + 48;
    const prevArrow = this.add
      .text(-cardW / 2 + 24, arrowY, '◀', {
        fontFamily: CUTE_FONT,
        fontSize: '22px',
        color: '#ffffff'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    prevArrow.on('pointerdown', () => this.navigate(-1));
    prevArrow.on('pointerover', () => prevArrow.setScale(1.2).setColor(theme.hex));
    prevArrow.on('pointerout', () => prevArrow.setScale(1.0).setColor('#ffffff'));

    const nextArrow = this.add
      .text(cardW / 2 - 24, arrowY, '▶', {
        fontFamily: CUTE_FONT,
        fontSize: '22px',
        color: '#ffffff'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    nextArrow.on('pointerdown', () => this.navigate(1));
    nextArrow.on('pointerover', () => nextArrow.setScale(1.2).setColor(theme.hex));
    nextArrow.on('pointerout', () => nextArrow.setScale(1.0).setColor('#ffffff'));

    // Roster count badge
    const badgeText = this.add
      .text(0, -cardH / 2 + 18, `RIVAL ${this.currentIndex + 1} OF ${CHARACTERS.length}`, {
        fontFamily: CUTE_FONT,
        fontSize: '11px',
        color: '#a4b0be',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    // 3. Mascot Portrait
    const avatarHalo = this.add.graphics();
    avatarHalo.fillStyle(theme.primary, 0.2);
    avatarHalo.fillCircle(-cardW / 2 + 76, -cardH / 2 + 62, 34);
    avatarHalo.lineStyle(2, theme.primary, 0.8);
    avatarHalo.strokeCircle(-cardW / 2 + 76, -cardH / 2 + 62, 34);

    const mascot = this.add.sprite(-cardW / 2 + 76, -cardH / 2 + 62, char.id);
    mascot.setDisplaySize(58, 58);

    // Gentle idle floating tween
    this.tweens.add({
      targets: mascot,
      y: -cardH / 2 + 58,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 4. Character Name & Species Title
    const nameText = this.add
      .text(-cardW / 2 + 124, -cardH / 2 + 45, char.name, {
        fontFamily: CUTE_FONT,
        fontSize: '26px',
        color: theme.hex,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0, 0.5);

    const speciesText = this.add
      .text(-cardW / 2 + 126, -cardH / 2 + 72, `${char.species} • ${personality.title}`, {
        fontFamily: CUTE_FONT,
        fontSize: '12px',
        color: '#dfe4ea',
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5);

    // 5. Quotes Speech Capsule
    const quoteBox = this.add.graphics();
    const quoteBoxY = -cardH / 2 + 118;
    const quoteBoxH = 60;
    quoteBox.fillStyle(0x0e081c, 0.88);
    quoteBox.fillRoundedRect(-cardW / 2 + 18, quoteBoxY, cardW - 36, quoteBoxH, 12);
    quoteBox.lineStyle(1.2, theme.primary, 0.5);
    quoteBox.strokeRoundedRect(-cardW / 2 + 18, quoteBoxY, cardW - 36, quoteBoxH, 12);

    const quoteText = this.add
      .text(0, quoteBoxY + 18, `💬 "${char.quote}"`, {
        fontFamily: CUTE_FONT,
        fontSize: '13px',
        color: '#fff3c4',
        fontStyle: 'italic bold',
        stroke: '#000000',
        strokeThickness: 2
      })
      .setOrigin(0.5);

    const defeatText = this.add
      .text(0, quoteBoxY + 42, `Defeat: "${char.defeatQuote}"`, {
        fontFamily: CUTE_FONT,
        fontSize: '11px',
        color: '#a4b0be',
        fontStyle: 'italic'
      })
      .setOrigin(0.5);

    // 6. Bio Description & AI Combat Style
    const bioHeader = this.add
      .text(-cardW / 2 + 22, -cardH / 2 + 196, 'ABOUT & BATTLE STRATEGY', {
        fontFamily: CUTE_FONT,
        fontSize: '11.5px',
        color: theme.light,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5);

    const bioBody = this.add
      .text(
        -cardW / 2 + 22,
        -cardH / 2 + 212,
        `${char.description}\n\n${personality.description}`,
        {
          fontFamily: CUTE_FONT,
          fontSize: '11.5px',
          color: '#ffffff',
          lineSpacing: 4,
          wordWrap: { width: cardW - 44 }
        }
      )
      .setOrigin(0, 0);

    // 7. Combat Stats Display (Speed, Combo Mastery, Garbage Defense)
    const statsY = Math.min(-cardH / 2 + 330, cardH / 2 - 50);
    const statBoxW = (cardW - 44) / 3;

    // Stat 1: Speed (derived from baseInterval: 120ms = 5★, 220ms = 1★)
    const speedRating = Math.max(1, Math.min(5, Math.round((240 - personality.baseInterval) / 24)));
    // Stat 2: Combos (derived from comboBias: 1.0 = 2★, 1.4 = 5★)
    const comboRating = Math.max(1, Math.min(5, Math.round(personality.comboBias * 3.2)));
    // Stat 3: Defense (derived from garbageBias: 1.0 = 2★, 2.6 = 5★)
    const defRating = Math.max(1, Math.min(5, Math.round(personality.garbageBias * 1.8)));

    const createStatCell = (cx: number, label: string, stars: number) => {
      const starStr = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      const cellBg = this.add.graphics();
      cellBg.fillStyle(0x0e081c, 0.85);
      cellBg.fillRoundedRect(cx - statBoxW / 2 + 4, statsY, statBoxW - 8, 40, 8);
      cellBg.lineStyle(1, 0x57606f, 0.5);
      cellBg.strokeRoundedRect(cx - statBoxW / 2 + 4, statsY, statBoxW - 8, 40, 8);

      const l = this.add
        .text(cx, statsY + 11, label, {
          fontFamily: CUTE_FONT,
          fontSize: '10px',
          color: '#a4b0be',
          fontStyle: 'bold'
        })
        .setOrigin(0.5);

      const s = this.add
        .text(cx, statsY + 27, starStr, {
          fontFamily: CUTE_FONT,
          fontSize: '11px',
          color: '#feca57'
        })
        .setOrigin(0.5);

      return [cellBg, l, s];
    };

    const s1 = createStatCell(-cardW / 2 + 22 + statBoxW * 0.5, 'SPEED', speedRating);
    const s2 = createStatCell(-cardW / 2 + 22 + statBoxW * 1.5, 'COMBOS', comboRating);
    const s3 = createStatCell(-cardW / 2 + 22 + statBoxW * 2.5, 'DEFENSE', defRating);

    this.cardContainer.add([
      cardBg,
      badgeText,
      prevArrow,
      nextArrow,
      avatarHalo,
      mascot,
      nameText,
      speciesText,
      quoteBox,
      quoteText,
      defeatText,
      bioHeader,
      bioBody,
      ...s1,
      ...s2,
      ...s3
    ]);

    // Bouncy spring transition on character change
    this.cardContainer.setScale(0.96);
    this.tweens.add({
      targets: this.cardContainer,
      scale: 1,
      duration: 180,
      ease: 'Back.easeOut'
    });
  }

  public update(_time: number, delta: number): void {
    const pad = this.getActiveGamepad();
    if (!pad) return;

    const stickX = pad.leftStick ? pad.leftStick.x : 0;
    const isLeft = pad.left || pad.isButtonDown(14) || stickX < -0.45;
    const isRight = pad.right || pad.isButtonDown(15) || stickX > 0.45;

    if (isLeft || isRight) {
      if (this.padRepeatTimer <= 0) {
        if (isLeft) this.navigate(-1);
        else if (isRight) this.navigate(1);
        this.padRepeatTimer = 220;
      } else {
        this.padRepeatTimer -= delta;
      }
    } else {
      this.padRepeatTimer = 0;
    }

    // Button B (1) goes back
    const backDown = pad.B || pad.isButtonDown(1);
    const prevBack = this.prevPadButtons.get(1) || false;
    if (backDown && !prevBack) {
      SoundFx.playCursor();
      this.scene.start(this.returnScene);
    }
    this.prevPadButtons.set(1, backDown);
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
}
