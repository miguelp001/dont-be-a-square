import Phaser from 'phaser';
import SocketManager, { GameStartPayload } from '../net/SocketManager';
import { CHARACTERS } from '../utils/Constants';
import { SoundFx } from '../utils/SoundFx';
import { CuteUI } from '../utils/CuteUI';

export default class LobbyScene extends Phaser.Scene {
  private socketMgr!: SocketManager;
  private characterIndex: number = 0;
  private currentRoomId: string = '';

  // UI Containers & Elements
  private charAvatar!: Phaser.GameObjects.Image;
  private charNameText!: Phaser.GameObjects.Text;
  private serverStatusText!: Phaser.GameObjects.Text;
  private mainButtonsContainer!: Phaser.GameObjects.Container;
  private waitingRoomContainer!: Phaser.GameObjects.Container;
  private joinModalContainer!: Phaser.GameObjects.Container;

  // Waiting Room Elements
  private roomCodeDisplay!: Phaser.GameObjects.Text;
  private waitingStatusText!: Phaser.GameObjects.Text;
  private copyFeedbackText!: Phaser.GameObjects.Text;

  // Join Room Elements
  private inputCode: string = '';
  private codeSlotsText!: Phaser.GameObjects.Text;
  private joinErrorText!: Phaser.GameObjects.Text;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  init(data: any): void {
    const passedCharId = data?.characterId || 'kiri';
    const foundIndex = CHARACTERS.findIndex((c) => c.id === passedCharId);
    this.characterIndex = foundIndex >= 0 ? foundIndex : 0;
    this.currentRoomId = '';
    this.inputCode = '';
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.socketMgr = SocketManager.getInstance();

    // Slowly drifting cute pastel pattern background
    CuteUI.createCuteBackground(this);

    // Header Title
    const title = this.add.text(width / 2, 48, 'ONLINE MULTIPLAYER', {
      fontSize: '26px',
      color: '#ff69b4',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    });
    title.setOrigin(0.5);

    // Server connection indicator
    this.serverStatusText = this.add.text(
      width / 2,
      78,
      this.socketMgr.isConnected ? '🟢 Server Connected' : '🟡 Connecting to Server...',
      {
        fontSize: '11px',
        color: this.socketMgr.isConnected ? '#2ed573' : '#feca57',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }
    ).setOrigin(0.5);

    // Periodic check to update server connection text
    this.time.addEvent({
      delay: 1500,
      loop: true,
      callback: () => {
        if (!this.serverStatusText || !this.serverStatusText.active) return;
        if (this.socketMgr.isConnected) {
          this.serverStatusText.setText('🟢 Server Connected');
          this.serverStatusText.setColor('#2ed573');
        } else {
          this.serverStatusText.setText('🔴 Server Offline (Reconnecting...)');
          this.serverStatusText.setColor('#ff4757');
        }
      }
    });

    // Character Selection Banner
    this.createCharacterBanner(width / 2, 126);

    // Main 3 Buttons: CREATE ROOM, JOIN BY CODE, BACK TO MENU
    this.createMainButtons(width / 2, 235);

    // Waiting Room UI (hidden by default)
    this.createWaitingRoomUI(width / 2, 280);

    // Join Code Modal UI (hidden by default)
    this.createJoinModalUI(width / 2, height / 2);

    // Wire Socket Events
    this.setupSocketEvents();
  }

  /** Character selector allowing quick switching before entering rooms */
  private createCharacterBanner(x: number, y: number): void {
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x000000, 0.45);
    cardBg.fillRoundedRect(x - 170, y - 30, 340, 60, 10);
    cardBg.lineStyle(1.5, 0x54a0ff, 0.8);
    cardBg.strokeRoundedRect(x - 170, y - 30, 340, 60, 10);

    const char = CHARACTERS[this.characterIndex];

    // Left Arrow
    const leftArrow = this.add.text(x - 145, y, '◀', {
      fontSize: '20px',
      color: '#54a0ff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    leftArrow.on('pointerdown', () => this.cycleCharacter(-1));
    leftArrow.on('pointerover', () => leftArrow.setColor('#ff69b4'));
    leftArrow.on('pointerout', () => leftArrow.setColor('#54a0ff'));

    // Avatar Sprite
    this.charAvatar = this.add.image(x - 90, y, char.id);
    this.charAvatar.setDisplaySize(44, 44);
    this.charAvatar.setInteractive({ useHandCursor: true });
    this.charAvatar.on('pointerdown', () => this.cycleCharacter(1));

    // Name & Title
    this.charNameText = this.add.text(x - 50, y - 10, `Fighter: ${char.name}`, {
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    });

    const subText = this.add.text(x - 50, y + 10, `${char.species} (Click to switch)`, {
      fontSize: '11px',
      color: '#a4b0be'
    });

    // Right Arrow
    const rightArrow = this.add.text(x + 145, y, '▶', {
      fontSize: '20px',
      color: '#54a0ff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    rightArrow.on('pointerdown', () => this.cycleCharacter(1));
    rightArrow.on('pointerover', () => rightArrow.setColor('#ff69b4'));
    rightArrow.on('pointerout', () => rightArrow.setColor('#54a0ff'));
  }

  private cycleCharacter(dir: number): void {
    SoundFx.playCursor();
    this.characterIndex = (this.characterIndex + dir + CHARACTERS.length) % CHARACTERS.length;
    const char = CHARACTERS[this.characterIndex];
    this.charAvatar.setTexture(char.id);
    this.charNameText.setText(`Fighter: ${char.name}`);
  }

  private get selectedCharacterId(): string {
    return CHARACTERS[this.characterIndex].id;
  }

  /** The 3 required buttons under Online Multiplayer */
  private createMainButtons(x: number, startY: number): void {
    this.mainButtonsContainer = this.add.container(0, 0);

    const btnSpacing = 62;

    // 1. CREATE ROOM
    const createBtn = CuteUI.createPillButton(this, x, startY, 'CREATE ROOM', () => {
      this.handleCreateRoom();
    }, { textureKey: 'pill_green', fontSize: '15px' });

    // 2. JOIN BY CODE
    const joinBtn = CuteUI.createPillButton(this, x, startY + btnSpacing, 'JOIN BY CODE', () => {
      this.openJoinModal();
    }, { textureKey: 'pill_blue', fontSize: '15px' });

    // 3. BACK TO MENU
    const backBtn = CuteUI.createPillButton(this, x, startY + btnSpacing * 2, 'BACK TO MENU', () => {
      this.handleBackToMenu();
    }, { textureKey: 'pill_grey', fontSize: '15px' });

    this.mainButtonsContainer.add([createBtn, joinBtn, backBtn]);
  }

  /** Waiting Room card shown after clicking CREATE ROOM */
  private createWaitingRoomUI(x: number, y: number): void {
    this.waitingRoomContainer = this.add.container(x, y);
    this.waitingRoomContainer.setVisible(false);

    // Card background
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x0c2461, 0.95);
    cardBg.fillRoundedRect(-180, -90, 360, 200, 14);
    cardBg.lineStyle(2.5, 0xfeca57, 1);
    cardBg.strokeRoundedRect(-180, -90, 360, 200, 14);
    this.waitingRoomContainer.add(cardBg);

    // Room Code Title
    const label = this.add.text(0, -66, 'SHARE ROOM CODE', {
      fontSize: '13px',
      color: '#a4b0be',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Big Room Code Text
    this.roomCodeDisplay = this.add.text(0, -32, '------', {
      fontSize: '32px',
      color: '#feca57',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // Copy Code Button
    const copyBtn = this.createSmallButton(0, 8, '📋 COPY CODE', 0x1e90ff, () => {
      if (this.currentRoomId && navigator.clipboard) {
        navigator.clipboard.writeText(this.currentRoomId).then(() => {
          this.copyFeedbackText.setText('Code copied to clipboard!').setColor('#2ed573');
          this.time.delayedCall(2000, () => {
            if (this.copyFeedbackText.active) this.copyFeedbackText.setText('');
          });
        }).catch(() => {});
      }
    });

    this.copyFeedbackText = this.add.text(0, 34, '', {
      fontSize: '11px',
      color: '#2ed573',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Waiting Status
    this.waitingStatusText = this.add.text(0, 56, 'Waiting for opponent to connect...', {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Pulsing animation for waiting text
    this.tweens.add({
      targets: this.waitingStatusText,
      alpha: 0.45,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Cancel Button
    const cancelBtn = this.createSmallButton(0, 88, 'CANCEL', 0xff4757, () => {
      this.cancelWaitingRoom();
    });

    this.waitingRoomContainer.add([
      label,
      this.roomCodeDisplay,
      copyBtn,
      this.copyFeedbackText,
      this.waitingStatusText,
      cancelBtn
    ]);
  }

  /** Modal for entering room code */
  private createJoinModalUI(x: number, y: number): void {
    this.joinModalContainer = this.add.container(x, y);
    this.joinModalContainer.setVisible(false);
    this.joinModalContainer.setDepth(50);

    // Fullscreen darken backdrop
    const backdrop = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7);
    backdrop.setInteractive(); // block background clicks

    // Modal Window Box
    const box = this.add.graphics();
    box.fillStyle(0x1e272e, 0.98);
    box.fillRoundedRect(-170, -115, 340, 230, 14);
    box.lineStyle(2.5, 0x54a0ff, 1);
    box.strokeRoundedRect(-170, -115, 340, 230, 14);

    const title = this.add.text(0, -88, 'JOIN ROOM BY CODE', {
      fontSize: '18px',
      color: '#54a0ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const promptText = this.add.text(0, -60, 'Type 6-Letter Room Code:', {
      fontSize: '12px',
      color: '#d2dae2'
    }).setOrigin(0.5);

    // Code input slots display
    this.codeSlotsText = this.add.text(0, -24, '_ _ _ _ _ _', {
      fontSize: '28px',
      color: '#feca57',
      fontStyle: 'bold',
      letterSpacing: 4,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    // Error feedback text
    this.joinErrorText = this.add.text(0, 12, '', {
      fontSize: '12px',
      color: '#ff4757',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 300 }
    }).setOrigin(0.5);

    // Paste from clipboard button
    const pasteBtn = this.createSmallButton(-95, 46, '📋 PASTE', 0x57606f, () => {
      if (navigator.clipboard) {
        navigator.clipboard.readText().then((clipText) => {
          const cleaned = clipText.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
          if (cleaned) {
            this.inputCode = cleaned;
            this.updateCodeSlotsDisplay();
          }
        }).catch(() => {});
      }
    });

    // Mobile on-screen typing trigger
    const typeBtn = this.createSmallButton(0, 46, '⌨️ TYPE', 0x54a0ff, () => {
      const code = window.prompt('Enter 6-Letter Room Code:', this.inputCode);
      if (code) {
        const cleaned = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
        if (cleaned) {
          this.inputCode = cleaned;
          this.updateCodeSlotsDisplay();
        }
      }
    });

    // Join Button
    const submitBtn = this.createSmallButton(95, 46, 'JOIN', 0x2ed573, () => {
      this.submitJoinCode();
    });

    // Cancel Button
    const closeBtn = this.createSmallButton(0, 84, 'CANCEL', 0xff4757, () => {
      this.closeJoinModal();
    });

    this.joinModalContainer.add([
      backdrop,
      box,
      title,
      promptText,
      this.codeSlotsText,
      this.joinErrorText,
      pasteBtn,
      typeBtn,
      submitBtn,
      closeBtn
    ]);
  }

  private updateCodeSlotsDisplay(): void {
    let display = '';
    for (let i = 0; i < 6; i++) {
      if (i < this.inputCode.length) {
        display += this.inputCode[i] + ' ';
      } else {
        display += '_ ';
      }
    }
    this.codeSlotsText.setText(display.trim());
  }

  private openJoinModal(): void {
    SoundFx.playCursor();
    this.inputCode = '';
    this.updateCodeSlotsDisplay();
    this.joinErrorText.setText('');
    this.joinModalContainer.setVisible(true);

    // Register keyboard typing listener
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeJoinModal();
        return;
      }
      if (e.key === 'Enter') {
        this.submitJoinCode();
        return;
      }
      if (e.key === 'Backspace') {
        if (this.inputCode.length > 0) {
          SoundFx.playCursor();
          this.inputCode = this.inputCode.slice(0, -1);
          this.updateCodeSlotsDisplay();
        }
        return;
      }
      if (/^[a-zA-Z0-9]$/.test(e.key) && this.inputCode.length < 6) {
        SoundFx.playCursor();
        this.inputCode += e.key.toUpperCase();
        this.updateCodeSlotsDisplay();
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
  }

  private closeJoinModal(): void {
    SoundFx.playCursor();
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    this.joinModalContainer.setVisible(false);
  }

  private submitJoinCode(): void {
    if (this.inputCode.length !== 6) {
      this.joinErrorText.setText('Please enter a full 6-letter room code!');
      return;
    }

    this.joinErrorText.setText(`Connecting to ${this.inputCode}...`).setColor('#54a0ff');
    this.socketMgr.joinRoom(this.inputCode, this.selectedCharacterId);
  }

  private handleCreateRoom(): void {
    SoundFx.playCursor();
    this.mainButtonsContainer.setVisible(false);
    this.waitingRoomContainer.setVisible(true);
    this.roomCodeDisplay.setText('GENERATING...');
    this.waitingStatusText.setText('Creating room on server...');
    this.copyFeedbackText.setText('');

    this.socketMgr.createRoom(this.selectedCharacterId);
  }

  private cancelWaitingRoom(): void {
    SoundFx.playCursor();
    if (this.currentRoomId) {
      this.socketMgr.leaveRoom(this.currentRoomId);
      this.currentRoomId = '';
    }
    this.waitingRoomContainer.setVisible(false);
    this.mainButtonsContainer.setVisible(true);
  }

  private handleBackToMenu(): void {
    SoundFx.playCursor();
    if (this.currentRoomId) {
      this.socketMgr.leaveRoom(this.currentRoomId);
      this.currentRoomId = '';
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    this.scene.start('MenuScene');
  }

  private setupSocketEvents(): void {
    this.socketMgr.onRoomCreated((data) => {
      this.currentRoomId = data.roomId;
      this.roomCodeDisplay.setText(data.roomId);
      this.waitingStatusText.setText('Waiting for opponent to connect...');
    });

    this.socketMgr.onRoomJoined((data) => {
      this.currentRoomId = data.roomId;
      if (this.joinModalContainer.visible) {
        this.joinErrorText.setText('Joined! Starting game...').setColor('#2ed573');
      }
    });

    this.socketMgr.onRoomError((data) => {
      if (this.joinModalContainer.visible) {
        this.joinErrorText.setText(data.message || 'Room not found or full!').setColor('#ff4757');
      } else {
        this.waitingStatusText.setText(`Error: ${data.message}`).setColor('#ff4757');
      }
    });

    this.socketMgr.onGameStart((data: GameStartPayload) => {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
        this.keydownHandler = undefined;
      }

      const myId = this.socketMgr.getSocketId();
      const isPlayer1 = data.player1.socketId === myId;
      const opponentChar = isPlayer1 ? data.player2.characterId : data.player1.characterId;

      if (this.waitingStatusText.active) {
        this.waitingStatusText.setText('Opponent Found! Launching match...').setColor('#2ed573');
      }
      if (this.joinErrorText.active) {
        this.joinErrorText.setText('Opponent Found! Launching match...').setColor('#2ed573');
      }

      SoundFx.playMatch();

      this.time.delayedCall(800, () => {
        this.scene.start('GameScene', {
          mode: 'vs_online',
          roomId: data.roomId,
          characterId: this.selectedCharacterId,
          opponentCharacterId: opponentChar,
          isPlayer1
        });
      });
    });
  }

  /** Helper to create styled main buttons */
  private createStyledButton(
    x: number,
    y: number,
    text: string,
    accentColor: number,
    callback: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const btnWidth = 230;
    const btnHeight = 44;

    const bg = this.add.graphics();
    const drawBg = (color: number, strokeColor: number, fillAlpha: number = 0.9) => {
      bg.clear();
      bg.fillStyle(color, fillAlpha);
      bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 8);
      bg.lineStyle(2, strokeColor, 1);
      bg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 8);
    };

    drawBg(0x1e272e, accentColor);

    const label = this.add.text(0, 0, text, {
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const hitArea = this.add.rectangle(0, 0, btnWidth, btnHeight, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      drawBg(accentColor, 0xffffff, 1.0);
      label.setColor('#ffffff');
      container.setScale(1.03);
    });

    hitArea.on('pointerout', () => {
      drawBg(0x1e272e, accentColor);
      label.setColor('#ffffff');
      container.setScale(1.0);
    });

    hitArea.on('pointerdown', callback);

    container.add([bg, label, hitArea]);
    return container;
  }

  /** Helper for smaller modal/card buttons */
  private createSmallButton(
    x: number,
    y: number,
    text: string,
    color: number,
    callback: () => void
  ): Phaser.GameObjects.Container {
    // Map color to pill small texture
    let texture = 'pill_sm_grey';
    if (color === 0x2ed573) texture = 'pill_sm_green';
    else if (color === 0x1e90ff || color === 0x54a0ff) texture = 'pill_sm_blue';
    else if (color === 0xff4757 || color === 0xff69b4) texture = 'pill_sm_pink';

    return CuteUI.createPillButton(this, x, y, text, callback, {
      textureKey: texture,
      fontSize: '11px',
      width: 110,
      height: 30
    });
  }
}
