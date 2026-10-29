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
  shadow?: boolean;
  shadowColor?: number;
  shadowOffset?: number;
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

    const resizeListener = (gameSize: Phaser.Structs.Size) => {
      if (!bg || !bg.active) return;
      bg.setSize(gameSize.width, gameSize.height);
    };

    scene.events.on('update', updateListener);
    scene.scale.on('resize', resizeListener);
    scene.events.once('shutdown', () => {
      scene.events.off('update', updateListener);
      scene.scale.off('resize', resizeListener);
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

    const frame = scene.textures.getFrame(textureKey);
    const nativeWidth = frame ? frame.width : 230;
    const nativeHeight = frame ? frame.height : 46;

    const btnWidth = options.width ?? (options.height ? Math.round(nativeWidth * (options.height / nativeHeight)) : nativeWidth);
    const btnHeight = options.height ?? (options.width ? Math.round(nativeHeight * (options.width / nativeWidth)) : nativeHeight);

    // Cast a distinct, soft diffused shadow on the background behind the pill button
    const hasShadow = options.shadow !== false;
    const baseShadowOffset = options.shadowOffset ?? 7;
    let shadow: Phaser.GameObjects.Graphics | null = null;

    if (hasShadow) {
      shadow = scene.add.graphics();
      const shadowColor = options.shadowColor ?? 0x000000;
      const r = btnHeight / 2;

      // Layer 1: Soft outer feathered bloom (visible around sides and below)
      shadow.fillStyle(shadowColor, 0.28);
      shadow.fillRoundedRect(-btnWidth / 2 - 5, -btnHeight / 2 - 2, btnWidth + 10, btnHeight + 8, r + 3);

      // Layer 2: Intermediate penumbra
      shadow.fillStyle(shadowColor, 0.45);
      shadow.fillRoundedRect(-btnWidth / 2 - 2.5, -btnHeight / 2 - 1, btnWidth + 5, btnHeight + 6, r + 1.5);

      // Layer 3: Deep rich direct contact shadow
      shadow.fillStyle(shadowColor, 0.70);
      shadow.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight + 2, r);

      shadow.setPosition(0, baseShadowOffset);
      container.add(shadow);
    }

    const sprite = scene.add.sprite(0, 0, textureKey);
    sprite.setOrigin(0.5, 0.5);
    sprite.setInteractive({ useHandCursor: true });

    if (options.width || options.height) {
      sprite.setDisplaySize(btnWidth, btnHeight);
    }

    const label = scene.add.text(0, -1, text, {
      fontSize,
      color: fontColor,
      fontStyle: 'bold',
      stroke: strokeColor,
      strokeThickness
    }).setOrigin(0.5, 0.5);

    // Bouncy squishy hover and click feel with reactive shadow elevation
    sprite.on('pointerover', () => {
      SoundFx.playCursor();
      scene.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 140,
        ease: 'Back.easeOut'
      });
      if (shadow) {
        scene.tweens.add({
          targets: shadow,
          y: baseShadowOffset + 4,
          alpha: 0.85,
          duration: 140,
          ease: 'Back.easeOut'
        });
      }
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
      if (shadow) {
        scene.tweens.add({
          targets: shadow,
          y: baseShadowOffset,
          alpha: 1.0,
          duration: 120,
          ease: 'Sine.easeOut'
        });
      }
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
      if (shadow) {
        scene.tweens.add({
          targets: shadow,
          y: 2,
          duration: 65,
          yoyo: true,
          ease: 'Quad.easeInOut'
        });
      }
    });

    container.add([sprite, label]);
    return container;
  }
}
