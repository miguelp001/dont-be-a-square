import Phaser from 'phaser';
import { CHARACTERS } from '../utils/Constants';
import { CuteUI } from '../utils/CuteUI';
import { Settings } from '../utils/Settings';
import { SoundFx } from '../utils/SoundFx';

export default class MenuScene extends Phaser.Scene {
  private selectedButtonIndex: number = 0;
  private menuButtons: Phaser.GameObjects.Container[] = [];
  private menuActions: (() => void)[] = [];
  private padRepeatTimer: number = 0;
  private prevPadButtons: Map<number, boolean> = new Map();
  private cursorIndicator?: Phaser.GameObjects.Image;
  private indicatorOffset: number = 140;

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
    const uiScale = CuteUI.getUIScale(this);

    // Slowly drifting cute pastel pattern background
    CuteUI.createCuteBackground(this);

    // Title with cute glow & kawaii stars
    const isMobile = width < 600 || height >= width * 1.05;
    const titleY = Math.round((isMobile ? 52 : 64) * Math.min(1.35, uiScale));
    const titleFontSize = isMobile ? `${Math.min(26, Math.floor(width / 14))}px` : `${Math.round(30 * uiScale)}px`;
    const title = this.add.text(width / 2, titleY, "DON'T BE A SQUARE", {
      fontSize: titleFontSize,
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: Math.round(5 * (uiScale > 1.3 ? 1.4 : 1.0))
    });
    title.setOrigin(0.5);

    // Decorative sparkling stars around title
    const starOffset = isMobile ? Math.min(width / 2 - 14, 150) : Math.round(195 * uiScale);
    const leftStar = this.add.image(width / 2 - starOffset, titleY, 'sparkle_star').setScale((isMobile ? 1.0 : 1.3) * uiScale);
    const rightStar = this.add.image(width / 2 + starOffset, titleY, 'sparkle_star').setScale((isMobile ? 1.0 : 1.3) * uiScale);
    this.tweens.add({
      targets: [leftStar, rightStar],
      angle: 360,
      scaleX: 1.1 * uiScale,
      scaleY: 1.1 * uiScale,
      duration: 3800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Gentle floating bob for main title
    this.tweens.add({
      targets: title,
      y: titleY - 3,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Dynamically adapt button and showcase layout to available viewport height
    const safeBottom = height - Math.round(55 * Math.min(1.3, uiScale));
    const showcaseY = Math.min(safeBottom, Math.max(438, height * 0.88));
    const isNarrow = width < 500;
    const charHeadingY = isNarrow ? showcaseY - 68 : showcaseY - Math.round(52 * uiScale);

    const btnW = Math.round(250 * uiScale);
    const btnH = Math.round(42 * uiScale);
    const btnSpacing = Math.round(58 * uiScale);
    const btnFont = `${Math.round(14.5 * uiScale)}px`;
    const totalBtnSpan = btnSpacing * 3;

    const titleBottom = titleY + Math.round(30 * (isMobile ? 1.0 : Math.min(1.3, uiScale)));
    const availableSpace = charHeadingY - titleBottom;
    const startY = Math.round(titleBottom + Math.max(16, (availableSpace - totalBtnSpan) / 2));

    const btn1 = CuteUI.createPillButton(
      this,
      width / 2,
      startY,
      'CHALLENGE MODE',
      () => {
        this.scene.start('CharacterSelectScene', { mode: 'challenge' });
      },
      { textureKey: 'pill_pink', fontSize: btnFont, width: btnW, height: btnH, autoScale: false }
    );

    const btn2 = CuteUI.createPillButton(
      this,
      width / 2,
      startY + btnSpacing,
      'ENDLESS MARATHON',
      () => {
        this.scene.start('CharacterSelectScene', { mode: 'endless' });
      },
      { textureKey: 'pill_green', fontSize: btnFont, width: btnW, height: btnH, autoScale: false }
    );

    const btn3 = CuteUI.createPillButton(
      this,
      width / 2,
      startY + btnSpacing * 2,
      'ONLINE MULTIPLAYER',
      () => {
        this.scene.start('LobbyScene');
      },
      { textureKey: 'pill_blue', fontSize: btnFont, width: btnW, height: btnH, autoScale: false }
    );

    const btn4 = CuteUI.createPillButton(
      this,
      width / 2,
      startY + btnSpacing * 3,
      '⚙️ OPTIONS & GUIDE',
      () => {
        this.scene.start('OptionsMenuScene', { returnScene: 'MenuScene' });
      },
      { textureKey: 'pill_purple', fontSize: btnFont, width: btnW, height: btnH, autoScale: false }
    );

    this.menuButtons = [btn1, btn2, btn3, btn4];
    this.menuActions = [
      () => this.scene.start('CharacterSelectScene', { mode: 'challenge' }),
      () => this.scene.start('CharacterSelectScene', { mode: 'endless' }),
      () => this.scene.start('LobbyScene'),
      () => this.scene.start('OptionsMenuScene', { returnScene: 'MenuScene' })
    ];

    // Pointer hover syncs selection
    this.menuButtons.forEach((btn, idx) => {
      btn.on('pointerover', () => {
        if (this.selectedButtonIndex !== idx) {
          this.selectedButtonIndex = idx;
          this.updateButtonSelection();
        }
      });
    });

    // Sparkling indicator next to active button
    this.indicatorOffset = Math.round(btnW / 2 + 18);
    this.cursorIndicator = this.add.image(width / 2 - this.indicatorOffset, startY, 'sparkle_star');
    this.cursorIndicator.setDisplaySize(Math.round(16 * uiScale), Math.round(16 * uiScale));
    this.cursorIndicator.setTint(0xfffa65);
    this.tweens.add({
      targets: this.cursorIndicator,
      angle: 360,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 1600,
      repeat: -1,
      yoyo: true
    });

    this.selectedButtonIndex = 0;
    this.updateButtonSelection();
    this.setupKeyboardNavigation();

    // Character showcase section: "Meet the Slime catchers!"
    const headingFont = isNarrow ? '12px' : `${Math.round(15 * uiScale)}px`;
    const charHeading = this.add.text(
      width / 2,
      isNarrow ? showcaseY - 68 : charHeadingY,
      isNarrow ? 'Meet the Slime Catchers! (Tap for Profile)' : 'Meet the Slime Catchers! (Click to View Profile)',
      {
        fontSize: headingFont,
        color: '#ff9ff3',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: Math.round(3 * (uiScale > 1.3 ? 1.3 : 1.0))
      }
    );
    charHeading.setOrigin(0.5);

    if (isNarrow) {
      // 2 rows of 4 characters for compact mobile portrait screens
      const cols = 4;
      const colW = Math.min(74, Math.floor((width - 24) / cols));
      const startX = Math.floor((width - (cols - 1) * colW) / 2);
      const rowH = 64;

      CHARACTERS.forEach((char, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * colW;
        const baseY = showcaseY - 24 + row * rowH;

        const charContainer = this.add.container(x, baseY);
        const hitArea = this.add.rectangle(0, 8, colW - 4, 56, 0x000000, 0);
        hitArea.setInteractive({ useHandCursor: true });

        const sprite = this.add.sprite(0, 0, char.id);
        sprite.setDisplaySize(38, 38);

        const name = this.add.text(0, 26, char.name, {
          fontSize: '10.5px',
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2
        }).setOrigin(0.5);

        charContainer.add([hitArea, sprite, name]);

        hitArea.on('pointerover', () => {
          SoundFx.playCursor();
          this.tweens.add({
            targets: charContainer,
            scale: 1.15,
            duration: 120,
            ease: 'Back.easeOut'
          });
          name.setColor('#feca57');
        });

        hitArea.on('pointerout', () => {
          this.tweens.add({
            targets: charContainer,
            scale: 1.0,
            duration: 120,
            ease: 'Sine.easeOut'
          });
          name.setColor('#ffffff');
        });

        hitArea.on('pointerdown', () => {
          SoundFx.playDecide();
          this.scene.start('CharacterProfileScene', { characterId: char.id, returnScene: 'MenuScene' });
        });

        this.tweens.add({
          targets: charContainer,
          y: baseY - 5,
          duration: 1100 + (i % 3) * 150,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: i * 120
        });
      });
    } else {
      // Show all 8 characters along bottom with gentle floating idle bobs
      const colSpacing = Math.min(Math.floor((width - 40) / CHARACTERS.length), Math.round(68 * uiScale));
      const showStartX = Math.floor((width - (CHARACTERS.length - 1) * colSpacing) / 2);
      const spriteSize = Math.round(44 * uiScale);
      const nameSize = `${Math.round(11.5 * uiScale)}px`;

      CHARACTERS.forEach((char, i) => {
        const x = showStartX + i * colSpacing;
        const baseY = showcaseY;

        const charContainer = this.add.container(x, baseY);

        // Interactive hit area covering both the sprite and name
        const hitArea = this.add.rectangle(0, 10, colSpacing - 6, Math.round(66 * uiScale), 0x000000, 0);
        hitArea.setInteractive({ useHandCursor: true });

        const sprite = this.add.sprite(0, 0, char.id);
        sprite.setDisplaySize(spriteSize, spriteSize);

        const name = this.add.text(0, Math.round(30 * uiScale), char.name, {
          fontSize: nameSize,
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2
        }).setOrigin(0.5);

        charContainer.add([hitArea, sprite, name]);

        hitArea.on('pointerover', () => {
          SoundFx.playCursor();
          this.tweens.add({
            targets: charContainer,
            scale: 1.18,
            duration: 120,
            ease: 'Back.easeOut'
          });
          name.setColor('#feca57');
        });

        hitArea.on('pointerout', () => {
          this.tweens.add({
            targets: charContainer,
            scale: 1.0,
            duration: 120,
            ease: 'Sine.easeOut'
          });
          name.setColor('#ffffff');
        });

        hitArea.on('pointerdown', () => {
          SoundFx.playDecide();
          this.scene.start('CharacterProfileScene', { characterId: char.id, returnScene: 'MenuScene' });
        });

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

  private setupKeyboardNavigation(): void {
    this.input.keyboard?.on('keydown-UP', () => this.navigateMenu(-1));
    this.input.keyboard?.on('keydown-W', () => this.navigateMenu(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.navigateMenu(1));
    this.input.keyboard?.on('keydown-S', () => this.navigateMenu(1));

    this.input.keyboard?.on('keydown-ENTER', () => this.activateSelectedButton());
    this.input.keyboard?.on('keydown-SPACE', () => this.activateSelectedButton());
  }

  private navigateMenu(delta: number): void {
    SoundFx.playCursor();
    this.selectedButtonIndex = (this.selectedButtonIndex + delta + this.menuButtons.length) % this.menuButtons.length;
    this.updateButtonSelection();
  }

  private activateSelectedButton(): void {
    SoundFx.playCursor();
    if (this.menuActions[this.selectedButtonIndex]) {
      this.menuActions[this.selectedButtonIndex]();
    }
  }

  private updateButtonSelection(): void {
    this.menuButtons.forEach((btn, idx) => {
      if (idx === this.selectedButtonIndex) {
        btn.setScale(1.05);
        if (this.cursorIndicator) {
          this.cursorIndicator.setPosition(btn.x - this.indicatorOffset, btn.y);
          this.cursorIndicator.setVisible(true);
        }
      } else {
        btn.setScale(1.0);
      }
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

    const stickY = pad.leftStick ? pad.leftStick.y : 0;
    const isUp = pad.up || pad.isButtonDown(12) || stickY < -0.45;
    const isDown = pad.down || pad.isButtonDown(13) || stickY > 0.45;

    if (isUp || isDown) {
      if (this.padRepeatTimer <= 0) {
        if (isUp) this.navigateMenu(-1);
        else if (isDown) this.navigateMenu(1);
        this.padRepeatTimer = 220;
      } else {
        this.padRepeatTimer -= delta;
      }
    } else {
      this.padRepeatTimer = 0;
    }

    // Button 0 (A) or Button 9 (Start)
    const selectDown = pad.A || pad.isButtonDown(0) || pad.isButtonDown(9);
    const prevSelect = this.prevPadButtons.get(0) || false;
    if (selectDown && !prevSelect) {
      this.activateSelectedButton();
    }
    this.prevPadButtons.set(0, selectDown);
  }
}
