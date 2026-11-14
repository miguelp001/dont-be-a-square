import Phaser from 'phaser';
import { CHARACTERS } from '../utils/Constants';
import { AI_PERSONALITIES } from '../objects/AIBot';
import { CuteUI } from '../utils/CuteUI';
import { Settings } from '../utils/Settings';
import { SoundFx } from '../utils/SoundFx';
import { GameDifficulty, DIFFICULTY_ORDER, getDifficultyInfo } from '../utils/Difficulty';
import { RecordManager } from '../utils/DifficultyRecords';

export default class CharacterSelectScene extends Phaser.Scene {
  private mode: string = 'challenge';
  private selectedIndex: number = 0;
  private selectedDifficulty: GameDifficulty = Settings.difficulty || GameDifficulty.ADEPT;
  private charSprites: Phaser.GameObjects.Sprite[] = [];
  private charText!: Phaser.GameObjects.Text;
  private diffCenterText?: Phaser.GameObjects.Text;
  private diffDescText?: Phaser.GameObjects.Text;
  private diffRecordText?: Phaser.GameObjects.Text;
  private padRepeatTimer: number = 0;
  private prevPadButtons: Map<number, boolean> = new Map();
  
  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  init(data: any): void {
    this.mode = data?.mode || 'challenge';
  }

  create(): void {
    this.charSprites = [];
    this.selectedIndex = 0;
    this.prevPadButtons.clear();

    if (this.cache.audio.exists('char_select') && !this.sound.get('char_select')?.isPlaying) {
      this.sound.stopAll();
      this.sound.play('char_select', { loop: true, volume: Settings.musicVolume });
    }

    // Slowly drifting cute pastel pattern background
    CuteUI.createCuteBackground(this);

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const uiScale = CuteUI.getUIScale(this);
    
    const isMobile = width < 600 || (height >= width * 1.05 && width < 768);
    const titleText = isMobile
      ? (this.mode === 'challenge' ? 'PICK YOUR FIGHTER' : 'SELECT FIGHTER')
      : (this.mode === 'challenge' ? 'CHALLENGE: PICK YOUR SLIME CATCHER' : 'SELECT YOUR SLIME CATCHER');
    const titleY = Math.round((isMobile ? 36 : 48) * Math.min(1.3, uiScale));
    const titleFontSize = isMobile ? '20px' : `${Math.round((this.mode === 'challenge' ? 19 : 23) * uiScale)}px`;
    const title = this.add.text(width / 2, titleY, titleText, {
      fontSize: titleFontSize,
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: Math.round(4 * (uiScale > 1.3 ? 1.3 : 1.0))
    });
    title.setOrigin(0.5);
    
    // Create character grid centered (5 columns x 2 rows = 10 characters)
    const colSpacing = isMobile
      ? Math.min(62, Math.floor((width - 24) / 5))
      : Math.min(94, Math.round(86 * uiScale));
    const gridStartX = Math.floor((width - 4 * colSpacing) / 2);
    const startGridY = Math.round((isMobile ? 86 : 98) * Math.min(1.2, uiScale));
    const rowSpacing = isMobile ? 66 : Math.round(76 * Math.min(1.2, uiScale));
    const baseSpriteSize = isMobile ? 36 : Math.round(42 * Math.min(1.3, uiScale));

    CHARACTERS.forEach((char, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = gridStartX + col * colSpacing;
      const y = startGridY + row * rowSpacing;
      const isCharUnlocked = RecordManager.isCharacterUnlocked(char.id);
      
      const sprite = this.add.sprite(x, y, char.id);
      sprite.setDisplaySize(baseSpriteSize, baseSpriteSize);
      sprite.setInteractive({ useHandCursor: isCharUnlocked });

      if (!isCharUnlocked) {
        sprite.setTint(0x1a1a1a);
        sprite.setAlpha(0.6);
      }
      
      const labelText = !isCharUnlocked ? '???' : (char.isSecret ? `${char.name} 👑` : char.name);
      const nameText = this.add.text(x, y + Math.round((isMobile ? 24 : 28) * Math.min(1.3, uiScale)), labelText, {
        fontSize: `${Math.round((isMobile ? 12 : 13) * Math.min(1.3, uiScale))}px`,
        color: !isCharUnlocked ? '#747d8c' : (char.isSecret ? '#feca57' : '#ffffff'),
        stroke: '#000000',
        strokeThickness: 2
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
    const safeBottom = height - (isMobile ? 22 : Math.round(44 * Math.min(1.3, uiScale)));
    const btnSpacing = isMobile ? 38 : Math.round(46 * uiScale);
    const backBtnY = isMobile ? Math.min(safeBottom, height - 26) : Math.min(safeBottom, Math.max(470, height * 0.88));
    const startBtnY = backBtnY - btnSpacing;
    const diffBtnY = startBtnY - (isMobile ? 50 : Math.round(54 * uiScale));
    const diffDescY = diffBtnY + (isMobile ? 22 : Math.round(24 * uiScale));
    const gridBottomY = startGridY + rowSpacing + Math.round((isMobile ? 26 : 30) * Math.min(1.3, uiScale));
    const charTextY = Math.max(gridBottomY + 16, (gridBottomY + 10 + diffBtnY) / 2);

    // Character info
    this.charText = this.add.text(width / 2, charTextY, '', {
      fontSize: `${Math.round((isMobile ? 13 : 14.5) * uiScale)}px`,
      color: '#ffffff',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: { width: Math.min(width - 32, Math.round(500 * uiScale)) }
    });
    this.charText.setOrigin(0.5);
    
    this.selectCharacter(0);
    
    // Action buttons
    const btnW = isMobile ? Math.min(220, width - 40) : Math.round(240 * uiScale);
    const btnH = isMobile ? 36 : Math.round(42 * uiScale);
    const btnFont = `${Math.round((isMobile ? 14 : 15.5) * uiScale)}px`;

    // Difficulty Selector Row
    const diffBtnW = isMobile ? Math.min(260, width - 36) : Math.round(280 * uiScale);
    const arrowW = isMobile ? 36 : Math.round(40 * uiScale);
    const centerW = diffBtnW - (arrowW * 2) - 8;
    const diffFont = `${Math.round((isMobile ? 13 : 14.5) * uiScale)}px`;

    CuteUI.createPillButton(this, (width / 2) - (diffBtnW / 2) + (arrowW / 2), diffBtnY, '◀', () => {
      this.cycleDifficulty(-1);
    }, { textureKey: 'pill_blue', width: arrowW, height: isMobile ? 32 : Math.round(36 * uiScale), fontSize: `${Math.round((isMobile ? 14 : 16) * uiScale)}px`, autoScale: false });

    const centerPill = CuteUI.createPillButton(this, width / 2, diffBtnY, '', () => {
      this.cycleDifficulty(1);
    }, { textureKey: 'pill_pink', width: centerW, height: isMobile ? 32 : Math.round(36 * uiScale), fontSize: diffFont, autoScale: false });

    this.diffCenterText = centerPill.list.find((c) => c instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text;

    CuteUI.createPillButton(this, (width / 2) + (diffBtnW / 2) - (arrowW / 2), diffBtnY, '▶', () => {
      this.cycleDifficulty(1);
    }, { textureKey: 'pill_blue', width: arrowW, height: isMobile ? 32 : Math.round(36 * uiScale), fontSize: `${Math.round((isMobile ? 14 : 16) * uiScale)}px`, autoScale: false });

    this.diffDescText = this.add.text(width / 2, diffDescY - (isMobile ? 4 : 5), '', {
      fontSize: `${Math.round((isMobile ? 12 : 13) * uiScale)}px`,
      color: '#54a0ff',
      align: 'center',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1.5
    }).setOrigin(0.5);

    this.diffRecordText = this.add.text(width / 2, diffDescY + (isMobile ? 10 : 12), '', {
      fontSize: `${Math.round((isMobile ? 11.5 : 12.5) * uiScale)}px`,
      color: '#feca57',
      align: 'center',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1.5
    }).setOrigin(0.5);

    this.updateDifficultyDisplay();

    CuteUI.createPillButton(this, width / 2, startBtnY, 'START GAME', () => {
      this.startGame();
    }, { textureKey: 'pill_pink', width: btnW, height: btnH, fontSize: btnFont, autoScale: false });

    CuteUI.createPillButton(this, width / 2, backBtnY, 'BACK TO MENU', () => {
      this.scene.start('MenuScene');
    }, { textureKey: 'pill_grey', width: btnW, height: btnH, fontSize: btnFont, autoScale: false });
    
    // Keyboard controls
    const moveSelection = (dx: number, dy: number) => {
      SoundFx.playCursor();
      let row = Math.floor(this.selectedIndex / 5);
      let col = this.selectedIndex % 5;

      if (dx !== 0) col = (col + dx + 5) % 5;
      if (dy !== 0) row = (row + dy + 2) % 2;

      this.selectCharacter(row * 5 + col);
    };

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-LEFT', () => moveSelection(-1, 0));
      this.input.keyboard.on('keydown-A', () => moveSelection(-1, 0));
      this.input.keyboard.on('keydown-RIGHT', () => moveSelection(1, 0));
      this.input.keyboard.on('keydown-D', () => moveSelection(1, 0));
      this.input.keyboard.on('keydown-UP', () => moveSelection(0, -1));
      this.input.keyboard.on('keydown-W', () => moveSelection(0, -1));
      this.input.keyboard.on('keydown-DOWN', () => moveSelection(0, 1));
      this.input.keyboard.on('keydown-S', () => moveSelection(0, 1));

      // Difficulty shortcuts
      this.input.keyboard.on('keydown-Q', () => this.cycleDifficulty(-1));
      this.input.keyboard.on('keydown-E', () => this.cycleDifficulty(1));

      this.input.keyboard.on('keydown-ENTER', () => this.startGame());
      this.input.keyboard.on('keydown-SPACE', () => this.startGame());
      this.input.keyboard.on('keydown-ESC', () => {
        SoundFx.playCursor();
        this.scene.start('MenuScene');
      });
    }

    this.events.once('shutdown', () => {
      this.input.keyboard?.removeAllListeners();
      this.input.gamepad?.removeAllListeners();
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
        let row = Math.floor(this.selectedIndex / 5);
        let col = this.selectedIndex % 5;

        if (isLeft) col = (col - 1 + 5) % 5;
        else if (isRight) col = (col + 1) % 5;

        if (isUp) row = (row - 1 + 2) % 2;
        else if (isDown) row = (row + 1) % 2;

        this.selectCharacter(row * 5 + col);
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

    // Shoulder buttons (L1/R1 or LB/RB) cycle difficulty
    const l1Down = pad.isButtonDown(4);
    const prevL1 = this.prevPadButtons.get(4) || false;
    if (l1Down && !prevL1) {
      this.cycleDifficulty(-1);
    }
    this.prevPadButtons.set(4, l1Down);

    const r1Down = pad.isButtonDown(5);
    const prevR1 = this.prevPadButtons.get(5) || false;
    if (r1Down && !prevR1) {
      this.cycleDifficulty(1);
    }
    this.prevPadButtons.set(5, r1Down);
  }

  private cycleDifficulty(delta: number): void {
    const currentIndex = DIFFICULTY_ORDER.indexOf(this.selectedDifficulty);
    const newIndex = (currentIndex + delta + DIFFICULTY_ORDER.length) % DIFFICULTY_ORDER.length;
    this.selectedDifficulty = DIFFICULTY_ORDER[newIndex];
    Settings.setDifficulty(this.selectedDifficulty);
    SoundFx.playCursor();
    this.updateDifficultyDisplay();
  }

  private updateDifficultyDisplay(): void {
    const info = getDifficultyInfo(this.selectedDifficulty);
    if (this.diffCenterText) {
      this.diffCenterText.setText(`DIFFICULTY: ${info.badge}`);
    }
    if (this.diffDescText) {
      this.diffDescText.setText(info.description);
      this.diffDescText.setColor(info.hexColor);
    }
    if (this.diffRecordText) {
      if (this.mode === 'endless') {
        const best = RecordManager.getEndlessHighScore(this.selectedDifficulty);
        this.diffRecordText.setText(best > 0 ? `🏆 Personal Best: ${best.toLocaleString()} pts` : 'No score record yet');
        this.diffRecordText.setColor('#feca57');
      } else {
        const clearRec = RecordManager.getChallengeClear(this.selectedDifficulty);
        if (clearRec.cleared) {
          const m = Math.floor(clearRec.bestTimeSeconds / 60);
          const s = clearRec.bestTimeSeconds % 60;
          const timeStr = m > 0 ? `${m}m ${s < 10 ? '0' : ''}${s}s` : `${s}s`;
          this.diffRecordText.setText(`👑 Conquered! (Fastest Clear: ${timeStr})`);
          this.diffRecordText.setColor('#2ed573');
        } else {
          this.diffRecordText.setText('⭐ Unconquered (Defeat all 7 rivals to claim Crown)');
          this.diffRecordText.setColor('#c8d6e5');
        }
      }
    }
  }

  private startGame(): void {
    const selectedChar = CHARACTERS[this.selectedIndex];
    const isUnlocked = RecordManager.isCharacterUnlocked(selectedChar.id);
    if (!isUnlocked) {
      SoundFx.playCancel();
      return;
    }

    if (this.mode === 'endless') {
      this.scene.start('GameScene', {
        mode: 'endless',
        characterId: selectedChar.id,
        difficulty: this.selectedDifficulty
      });
    } else {
      this.scene.start('ChallengeMapScene', {
        characterId: selectedChar.id,
        defeatedOpponents: [],
        difficulty: this.selectedDifficulty,
        challengeScore: 0
      });
    }
  }
  
  private selectCharacter(index: number): void {
    this.selectedIndex = index;
    const uiScale = CuteUI.getUIScale(this);
    const selSize = Math.round(52 * Math.min(1.4, uiScale));
    const unselSize = Math.round(40 * Math.min(1.4, uiScale));

    this.charSprites.forEach((sprite, i) => {
      const charObj = CHARACTERS[i];
      const isCharUnlocked = RecordManager.isCharacterUnlocked(charObj.id);
      if (i === index) {
        sprite.setDisplaySize(selSize, selSize);
        if (isCharUnlocked) {
          sprite.clearTint();
          sprite.setAlpha(1.0);
        } else {
          sprite.setTint(0x444444);
          sprite.setAlpha(0.85);
        }
      } else {
        sprite.setDisplaySize(unselSize, unselSize);
        if (isCharUnlocked) {
          sprite.setTint(0xcccccc);
          sprite.setAlpha(0.75);
        } else {
          sprite.setTint(0x1a1a1a);
          sprite.setAlpha(0.5);
        }
      }
    });
    
    const char = CHARACTERS[index];
    const isCharUnlocked = RecordManager.isCharacterUnlocked(char.id);

    if (!isCharUnlocked) {
      if (char.id === 'void_slime') {
        this.charText.setText(
          `??? - Void Slime Champion\nConquer Challenge Mode on Master difficulty to defeat the Void Slime Champion and unlock it for Multiplayer & Single Player!`
        );
      } else {
        this.charText.setText(
          `??? - Nano Banana (Hidden Grandmaster Anomaly)\nConquer Challenge Mode on Grandmaster difficulty to awaken and conquer the legendary Nano Banana!`
        );
      }
    } else {
      const personality = AI_PERSONALITIES[char.id];
      const secretBadge = char.id === 'void_slime'
        ? '👑 [UNLOCKED: MASTER VOID CHAMPION]\n'
        : char.id === 'nano_banana'
        ? '🍌👑 [UNLOCKED: GRANDMASTER HIDDEN BOSS]\n'
        : '';
      const powerLine = char.powerName ? `\n⚡ Super Power: ${char.powerName} — ${char.powerDescription}` : '';
      const styleLine = personality ? `\nAI Style: ${personality.title} • "${personality.description}"` : '';
      this.charText.setText(`${secretBadge}${char.name} — ${char.species}\n"${char.description}"${powerLine}${styleLine}`);
    }
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
