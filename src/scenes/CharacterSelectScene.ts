import Phaser from 'phaser';
import { CHARACTERS } from '../utils/Constants';
import { AI_PERSONALITIES } from '../objects/AIBot';
import { CuteUI } from '../utils/CuteUI';
import { Settings } from '../utils/Settings';
import { SoundFx } from '../utils/SoundFx';

export default class CharacterSelectScene extends Phaser.Scene {
  private mode: string = 'challenge';
  private selectedIndex: number = 0;
  private charSprites: Phaser.GameObjects.Sprite[] = [];
  private charText!: Phaser.GameObjects.Text;
  private padRepeatTimer: number = 0;
  private prevPadButtons: Map<number, boolean> = new Map();
  
  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  init(data: any): void {
    this.mode = data?.mode || 'challenge';
  }

  create(): void {
    if (this.cache.audio.exists('char_select') && !this.sound.get('char_select')?.isPlaying) {
      this.sound.stopAll();
      this.sound.play('char_select', { loop: true, volume: Settings.musicVolume });
    }

    // Slowly drifting cute pastel pattern background
    CuteUI.createCuteBackground(this);

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const titleText = this.mode === 'challenge' ? 'CHALLENGE: PICK YOUR SLIME CATCHER' : 'SELECT YOUR SLIME CATCHER';
    const title = this.add.text(width / 2, 45, titleText, {
      fontSize: this.mode === 'challenge' ? '18px' : '22px',
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    });
    title.setOrigin(0.5);
    
    // Create character grid centered
    const gridStartX = Math.floor((width - 3 * 96) / 2);
    CHARACTERS.forEach((char, i) => {
      const x = gridStartX + (i % 4) * 96;
      const y = 140 + Math.floor(i / 4) * 105;
      
      const sprite = this.add.sprite(x, y, char.id);
      sprite.setDisplaySize(58, 58);
      sprite.setInteractive({ useHandCursor: true });
      
      const nameText = this.add.text(x, y + 42, char.name, {
        fontSize: '12px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 1
      });
      nameText.setOrigin(0.5);
      
      sprite.on('pointerover', () => {
        this.selectCharacter(i);
      });
      
      sprite.on('pointerdown', () => {
        this.selectCharacter(i);
      });
      
      this.charSprites.push(sprite);
    });
    
    // Responsive button and info positioning
    const backBtnY = Math.max(468, height - 44);
    const startBtnY = backBtnY - 53;
    const charTextY = Math.max(335, startBtnY - 72);

    // Character info
    this.charText = this.add.text(width / 2, charTextY, '', {
      fontSize: '12px',
      color: '#ffffff',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: { width: 380 }
    });
    this.charText.setOrigin(0.5);
    
    this.selectCharacter(0);
    
    // Action buttons
    CuteUI.createPillButton(this, width / 2, startBtnY, 'START GAME', () => {
      this.startGame();
    }, { textureKey: 'pill_pink' });

    CuteUI.createPillButton(this, width / 2, backBtnY, 'BACK TO MENU', () => {
      this.scene.start('MenuScene');
    }, { textureKey: 'pill_grey' });
    
    // Keyboard controls
    const moveSelection = (dx: number, dy: number) => {
      SoundFx.playCursor();
      let row = Math.floor(this.selectedIndex / 4);
      let col = this.selectedIndex % 4;

      if (dx !== 0) col = (col + dx + 4) % 4;
      if (dy !== 0) row = (row + dy + 2) % 2;

      this.selectCharacter(row * 4 + col);
    };

    this.input.keyboard!.on('keydown-LEFT', () => moveSelection(-1, 0));
    this.input.keyboard!.on('keydown-A', () => moveSelection(-1, 0));
    this.input.keyboard!.on('keydown-RIGHT', () => moveSelection(1, 0));
    this.input.keyboard!.on('keydown-D', () => moveSelection(1, 0));
    this.input.keyboard!.on('keydown-UP', () => moveSelection(0, -1));
    this.input.keyboard!.on('keydown-W', () => moveSelection(0, -1));
    this.input.keyboard!.on('keydown-DOWN', () => moveSelection(0, 1));
    this.input.keyboard!.on('keydown-S', () => moveSelection(0, 1));

    this.input.keyboard!.on('keydown-ENTER', () => this.startGame());
    this.input.keyboard!.on('keydown-SPACE', () => this.startGame());
    this.input.keyboard!.on('keydown-ESC', () => {
      SoundFx.playCursor();
      this.scene.start('MenuScene');
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
        SoundFx.playCursor();
        let row = Math.floor(this.selectedIndex / 4);
        let col = this.selectedIndex % 4;

        if (isLeft) col = (col - 1 + 4) % 4;
        else if (isRight) col = (col + 1) % 4;

        if (isUp) row = (row - 1 + 2) % 2;
        else if (isDown) row = (row + 1) % 2;

        this.selectCharacter(row * 4 + col);
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
      this.startGame();
    }
    this.prevPadButtons.set(0, selectDown);

    // Button 1 (B) returns to MenuScene
    const backDown = pad.B || pad.isButtonDown(1);
    const prevBack = this.prevPadButtons.get(1) || false;
    if (backDown && !prevBack) {
      SoundFx.playCursor();
      this.scene.start('MenuScene');
    }
    this.prevPadButtons.set(1, backDown);
  }

  private startGame(): void {
    const selectedChar = CHARACTERS[this.selectedIndex];
    if (this.mode === 'endless') {
      this.scene.start('GameScene', { mode: 'endless', characterId: selectedChar.id });
    } else {
      this.scene.start('ChallengeMapScene', { characterId: selectedChar.id, defeatedOpponents: [] });
    }
  }
  
  private selectCharacter(index: number): void {
    this.selectedIndex = index;
    this.charSprites.forEach((sprite, i) => {
      if (i === index) {
        sprite.setDisplaySize(64, 64);
        sprite.clearTint();
        sprite.setAlpha(1.0);
      } else {
        sprite.setDisplaySize(52, 52);
        sprite.setTint(0xcccccc);
        sprite.setAlpha(0.75);
      }
    });
    
    const char = CHARACTERS[index];
    const personality = AI_PERSONALITIES[char.id];
    const styleLine = personality ? `\n\nAI Style: ${personality.title}\n"${personality.description}"` : '';
    this.charText.setText(`${char.name} - ${char.species}\n${char.description}${styleLine}`);
  }
  
  private createButton(x: number, y: number, text: string, callback: () => void): void {
    const button = this.add.sprite(x, y, 'button');
    button.setInteractive({ useHandCursor: true });
    
    const buttonText = this.add.text(x, y, text, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    buttonText.setOrigin(0.5);
    
    button.on('pointerover', () => button.setTint(0xff69b4));
    button.on('pointerout', () => button.clearTint());
    button.on('pointerdown', callback);
  }
}
