import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './Constants';
import { SoundFx } from './SoundFx';

export interface PillButtonOptions {
  textureKey?: string;
  fontSize?: string;
  fontColor?: string;
  strokeColor?: string;
  strokeThickness?: number;
  width?: number;
  height?: number;
}

export class CuteUI {
  /**
   * Create a continuously drifting cute pattern background.
   * Attaches an event listener to the scene's update loop so scenes don't need manual update wiring.
   */
  public static createCuteBackground(scene: Phaser.Scene): Phaser.GameObjects.TileSprite {
    const width = scene.cameras?.main?.width || GAME_WIDTH;
    const height = scene.cameras?.main?.height || GAME_HEIGHT;

    const bg = scene.add.tileSprite(0, 0, width, height, 'cute_bg_pattern');
    bg.setOrigin(0, 0);
    bg.setDepth(-100);

    const updateListener = (time: number, delta: number) => {
      if (!bg || !bg.active) return;
      bg.tilePositionX += delta * 0.016;
      bg.tilePositionY += delta * 0.011;
    };

    scene.events.on('update', updateListener);
    scene.events.once('shutdown', () => {
      scene.events.off('update', updateListener);
    });

    return bg;
  }

  /**
   * Create a glossy, squishy candy pill button with rich bouncy interaction
   */
  public static createPillButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    callback: () => void,
    options: PillButtonOptions = {}
  ): Phaser.GameObjects.Container {
    const textureKey = options.textureKey || 'button';
    const fontSize = options.fontSize || '15px';
    const fontColor = options.fontColor || '#ffffff';
    const strokeColor = options.strokeColor || '#000000';
    const strokeThickness = options.strokeThickness ?? 3;

    const container = scene.add.container(x, y);

    const sprite = scene.add.sprite(0, 0, textureKey);
    sprite.setOrigin(0.5, 0.5);
    sprite.setInteractive({ useHandCursor: true });

    if (options.width && options.height) {
      sprite.setDisplaySize(options.width, options.height);
    }

    const label = scene.add.text(0, -1, text, {
      fontSize,
      color: fontColor,
      fontStyle: 'bold',
      stroke: strokeColor,
      strokeThickness
    }).setOrigin(0.5, 0.5);

    // Bouncy squishy hover and click feel
    sprite.on('pointerover', () => {
      SoundFx.playCursor();
      scene.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 140,
        ease: 'Back.easeOut'
      });
      sprite.setTint(0xfff0f5);
    });

    sprite.on('pointerout', () => {
      scene.tweens.add({
        targets: container,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 120,
        ease: 'Sine.easeOut'
      });
      sprite.clearTint();
    });

    sprite.on('pointerdown', () => {
      SoundFx.playSwap();
      scene.tweens.add({
        targets: container,
        scaleX: 1.03,
        scaleY: 0.92,
        duration: 65,
        yoyo: true,
        ease: 'Quad.easeInOut',
        onComplete: () => {
          callback();
        }
      });
    });

    container.add([sprite, label]);
    return container;
  }
}
