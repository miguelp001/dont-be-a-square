import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import PreloadScene from './scenes/PreloadScene';
import MenuScene from './scenes/MenuScene';
import CharacterSelectScene from './scenes/CharacterSelectScene';
import ChallengeMapScene from './scenes/ChallengeMapScene';
import GameScene from './scenes/GameScene';
import LobbyScene from './scenes/LobbyScene';
import OptionsMenuScene from './scenes/OptionsMenuScene';
import { GAME_WIDTH, GAME_HEIGHT } from './utils/Constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    CharacterSelectScene,
    ChallengeMapScene,
    GameScene,
    LobbyScene,
    OptionsMenuScene
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);
