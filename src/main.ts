import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import PreloadScene from './scenes/PreloadScene';
import MenuScene from './scenes/MenuScene';
import CharacterSelectScene from './scenes/CharacterSelectScene';
import ChallengeMapScene from './scenes/ChallengeMapScene';
import GameScene from './scenes/GameScene';
import LobbyScene from './scenes/LobbyScene';
import OptionsMenuScene from './scenes/OptionsMenuScene';
import CharacterProfileScene from './scenes/CharacterProfileScene';
import { GAME_WIDTH, GAME_HEIGHT, CUTE_FONT } from './utils/Constants';

// Globally set the default font family for all Phaser text objects to our cute & legible font
const origSetStyle = (Phaser.GameObjects.TextStyle as any).prototype.setStyle;
(Phaser.GameObjects.TextStyle as any).prototype.setStyle = function (
  style: any,
  updateText: boolean,
  setDefaults: boolean
) {
  if (style && !style.fontFamily) {
    style.fontFamily = CUTE_FONT;
  }
  const result = origSetStyle.call(this, style, updateText, setDefaults);
  if (this.fontFamily === 'Courier' || !this.fontFamily) {
    this.fontFamily = CUTE_FONT;
    this._font = [this.fontStyle, this.fontSize, this.fontFamily].join(' ').trim();
  }
  return result;
};

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  input: {
    gamepad: true
  },
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
    OptionsMenuScene,
    CharacterProfileScene
  ],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
    expandParent: true
  }
};

const game = new Phaser.Game(config);

// Keep container strictly within visible viewport bounds on mobile
function handleViewportResize(): void {
  const container = document.getElementById('game-container');
  if (container) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    container.style.width = `${w}px`;
    container.style.height = `${h}px`;
  }
  if (game?.scale) {
    game.scale.refresh();
  }
}

window.addEventListener('resize', handleViewportResize);
window.addEventListener('orientationchange', () => {
  setTimeout(handleViewportResize, 150);
});
handleViewportResize();

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
