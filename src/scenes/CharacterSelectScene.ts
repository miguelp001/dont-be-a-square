import Phaser from 'phaser';
import { CHARACTERS } from '../utils/Constants';
import { AI_PERSONALITIES } from '../objects/AIBot';
import { CuteUI } from '../utils/CuteUI';
import { Settings } from '../utils/Settings';

export default class CharacterSelectScene extends Phaser.Scene {
  private mode: string = 'challenge';
  private selectedIndex: number = 0;
  private charSprites: Phaser.GameObjects.Sprite[] = [];
  private charText!: Phaser.GameObjects.Text;
  
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
    this.input.keyboard!.on('keydown-LEFT', () => {
      this.selectedIndex = (this.selectedIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
      this.selectCharacter(this.selectedIndex);
    });
    
    this.input.keyboard!.on('keydown-RIGHT', () => {
      this.selectedIndex = (this.selectedIndex + 1) % CHARACTERS.length;
      this.selectCharacter(this.selectedIndex);
    });

    this.input.keyboard!.on('keydown-ENTER', () => {
      this.startGame();
    });

    this.input.keyboard!.on('keydown-SPACE', () => {
      this.startGame();
    });
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
