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
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    expandParent: true
  }
};

new Phaser.Game(config);

// -------------------------------------------------------------
// PWA Service Worker Registration & Install Prompt Management
// -------------------------------------------------------------
if ('serviceWorker' in navigator && (window.location.protocol.startsWith('http') || window.location.protocol.startsWith('https'))) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('PWA ServiceWorker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('PWA ServiceWorker registration failed:', error);
      });
  });
}

// Capture install prompt for custom trigger
let deferredInstallPrompt: any = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  (window as any).deferredInstallPrompt = e;
  console.log('PWA install prompt captured and ready');
});

(window as any).promptPwaInstall = () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
      }
      deferredInstallPrompt = null;
      (window as any).deferredInstallPrompt = null;
    });
  } else {
    console.log('PWA install prompt is not available or app is already installed');
  }
};
