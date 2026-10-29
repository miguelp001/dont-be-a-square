import Phaser from 'phaser';
import { CHARACTERS } from '../utils/Constants';
import { CuteUI } from '../utils/CuteUI';
import { Settings } from '../utils/Settings';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
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

    // Title with cute glow & kawaii stars
    const title = this.add.text(width / 2, 64, "DON'T BE A SQUARE", {
      fontSize: '30px',
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5
    });
    title.setOrigin(0.5);

    // Decorative sparkling stars around title
    const leftStar = this.add.image(width / 2 - 180, 64, 'sparkle_star').setScale(1.3);
    const rightStar = this.add.image(width / 2 + 180, 64, 'sparkle_star').setScale(1.3);
    this.tweens.add({
      targets: [leftStar, rightStar],
      angle: 360,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 3800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Gentle floating bob for main title
    this.tweens.add({
      targets: title,
      y: 61,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Large pill-shaped menu buttons
    const btnSpacing = 52;
    const startY = 138;

    CuteUI.createPillButton(
      this,
      width / 2,
      startY,
      'CHALLENGE MODE',
      () => {
        this.scene.start('CharacterSelectScene', { mode: 'challenge' });
      },
      { textureKey: 'pill_pink', fontSize: '15px', height: 42 }
    );

    CuteUI.createPillButton(
      this,
      width / 2,
      startY + btnSpacing,
      'ENDLESS MARATHON',
      () => {
        this.scene.start('CharacterSelectScene', { mode: 'endless' });
      },
      { textureKey: 'pill_green', fontSize: '15px', height: 42 }
    );

    CuteUI.createPillButton(
      this,
      width / 2,
      startY + btnSpacing * 2,
      'ONLINE MULTIPLAYER',
      () => {
        this.scene.start('LobbyScene');
      },
      { textureKey: 'pill_blue', fontSize: '15px', height: 42 }
    );

    CuteUI.createPillButton(
      this,
      width / 2,
      startY + btnSpacing * 3,
      '⚙️ OPTIONS & GUIDE',
      () => {
        this.scene.start('OptionsMenuScene', { returnScene: 'MenuScene' });
      },
      { textureKey: 'pill_purple', fontSize: '15px', height: 42 }
    );

    // Character showcase section: "Meet the Slime catchers!"
    const charHeading = this.add.text(width / 2, 382, 'Meet the Slime catchers!', {
      fontSize: '15px',
      color: '#ff9ff3',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    });
    charHeading.setOrigin(0.5);

    // Show all 8 characters along bottom with gentle floating idle bobs
    const showStartX = Math.floor((width - (CHARACTERS.length - 1) * 58) / 2);
    CHARACTERS.forEach((char, i) => {
      const x = showStartX + i * 58;
      const baseY = 438;

      const charContainer = this.add.container(x, baseY);

      const sprite = this.add.sprite(0, 0, char.id);
      sprite.setDisplaySize(42, 42);

      const name = this.add.text(0, 30, char.name, {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);

      charContainer.add([sprite, name]);

      // Staggered cute sinusoidal bobbing animation
      this.tweens.add({
        targets: charContainer,
        y: baseY - 6,
        duration: 1100 + (i % 3) * 150,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 140
      });
    });
  }
}
