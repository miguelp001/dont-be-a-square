import Phaser from 'phaser';
import { CHARACTERS } from '../utils/Constants';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
    
    const loadingText = this.make.text({
      x: width / 2,
      y: height / 2 - 50,
      text: 'Loading...',
      style: {
        font: '20px Arial',
        color: '#ffffff'
      }
    });
    loadingText.setOrigin(0.5, 0.5);
    
    const percentText = this.make.text({
      x: width / 2,
      y: height / 2,
      text: '0%',
      style: {
        font: '18px Arial',
        color: '#ffffff'
      }
    });
    percentText.setOrigin(0.5, 0.5);
    
    this.load.on('progress', (value: number) => {
      percentText.setText(parseInt(String(value * 100)) + '%');
      progressBar.clear();
      progressBar.fillStyle(0xff69b4, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });
    
    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });
    
    // Storybook Environment and UI Assets
    this.load.image('forest_meadow_bg', 'assets/ui/forest_meadow_bg.png');
    this.load.image('forest_autumn_bg', 'assets/ui/forest_autumn_bg.png');
    this.load.image('board_wood_frame', 'assets/ui/board_wood_frame_6x10.png');
    this.load.image('board_wood_backdrop', 'assets/ui/board_wood_backdrop.png');
    this.load.image('wood_plaque_sign', 'assets/ui/wood_plaque_sign.png');
    this.load.image('wood_clock_icon', 'assets/ui/wood_clock_icon.png');

    // Load custom kawaii slime sprites for puzzle panels (panel_0 .. panel_5)
    for (let i = 0; i < 6; i++) {
      if (this.textures.exists(`panel_${i}`)) {
        this.textures.remove(`panel_${i}`);
      }
      this.load.image(`panel_${i}`, `assets/sprites/slimes/panel_${i}.png?v=32px_v3`);
    }

    // Load character portrait assets
    CHARACTERS.forEach(char => {
      this.load.image(char.id, `assets/sprites/characters/${char.id}.png`);
    });

    // Load BGM tracks (from assets/audio/bgm/)
    const bgmTracks = [
      'menu', 'char_select', 'battle_cpu', 'battle_player', 'battle_online', 'panic', 'victory', 'game_over'
    ];
    bgmTracks.forEach(track => {
      this.load.audio(track, `assets/audio/bgm/${track}.mp3`);
    });
  }

  create(): void {
    this.scene.start('MenuScene');
  }
}
