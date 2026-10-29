import Phaser from 'phaser';
import { PANEL_SIZE } from '../utils/Constants';
import { SoundFx } from '../utils/SoundFx';

export enum GarbageState {
  FALLING = 'FALLING',
  RESTING = 'RESTING',
  TRANSFORMING = 'TRANSFORMING',
  CLEARED = 'CLEARED'
}

export default class GarbageBlock {
  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public gridX: number;
  public gridY: number;
  public width: number;
  public height: number;
  public state: GarbageState = GarbageState.FALLING;
  public sprites: Phaser.GameObjects.Sprite[][] = [];

  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    gridX: number,
    gridY: number,
    width: number,
    height: number = 1
  ) {
    this.scene = scene;
    this.container = container;
    this.gridX = gridX;
    this.gridY = gridY;
    this.width = width;
    this.height = height;

    this.createSprites();
  }

  private createSprites(): void {
    this.sprites = [];
    for (let r = 0; r < this.height; r++) {
      this.sprites[r] = [];
      for (let c = 0; c < this.width; c++) {
        const sprite = this.scene.add.sprite(
          (this.gridX + c) * PANEL_SIZE,
          (this.gridY + r) * PANEL_SIZE,
          'garbage_panel'
        );
        sprite.setOrigin(0, 0);
        sprite.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
        sprite.setDepth(5);
        this.container.add(sprite);
        this.sprites[r][c] = sprite;
      }
    }
  }

  /** Check if this garbage block occupies a specific cell */
  public occupies(x: number, y: number): boolean {
    if (this.state === GarbageState.CLEARED) return false;
    return (
      x >= this.gridX &&
      x < this.gridX + this.width &&
      y >= this.gridY &&
      y < this.gridY + this.height
    );
  }

  /** Animate falling down by cells */
  public fallTo(targetGridY: number, duration: number = 90): Promise<void> {
    return new Promise((resolve) => {
      this.state = GarbageState.FALLING;
      this.gridY = targetGridY;

      const promises: Promise<void>[] = [];
      for (let r = 0; r < this.height; r++) {
        for (let c = 0; c < this.width; c++) {
          const sprite = this.sprites[r] ? this.sprites[r][c] : null;
          if (!sprite || !sprite.active) continue;

          const targetLocalY = (targetGridY + r) * PANEL_SIZE;
          promises.push(
            new Promise<void>((subResolve) => {
              this.scene.tweens.add({
                targets: sprite,
                y: targetLocalY,
                duration: duration,
                ease: 'Quad.easeIn',
                onComplete: () => subResolve()
              });
            })
          );
        }
      }

      Promise.all(promises).then(() => {
        this.state = GarbageState.RESTING;
        SoundFx.playGarbageLand();
        resolve();
      });
    });
  }

  /** Shift up with the stack */
  public shiftUp(): void {
    this.gridY--;
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        const sprite = this.sprites[r] ? this.sprites[r][c] : null;
        if (sprite && sprite.active) {
          sprite.y = (this.gridY + r) * PANEL_SIZE;
        }
      }
    }
  }

  /**
   * De-transform the bottom row of this garbage block into regular slimes!
   * Returns the list of grid positions to convert into panels.
   */
  public transformBottomRow(): Promise<{ gridX: number; gridY: number }[]> {
    return new Promise((resolve) => {
      this.state = GarbageState.TRANSFORMING;
      SoundFx.playGarbageTransform();

      const bottomRowIndex = this.height - 1;
      const rowSprites = this.sprites[bottomRowIndex] || [];
      for (let c = 0; c < this.width; c++) {
        const sprite = rowSprites[c];

        if (sprite && sprite.active) {
          sprite.setTexture('garbage_flash');

          this.scene.tweens.add({
            targets: sprite,
            alpha: 0.25,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 75,
            yoyo: true,
            repeat: 3,
            onComplete: () => {
              sprite.destroy();
            }
          });
        }
      }

      this.scene.time.delayedCall(420, () => {
        this.height--;
        this.sprites.pop(); // Remove bottom row sprites

        // Dynamically compute the resolved gridY in case shiftUp occurred during the 420ms animation!
        const resolvedGridY = this.gridY + this.height;
        const positions: { gridX: number; gridY: number }[] = [];
        for (let c = 0; c < this.width; c++) {
          positions.push({ gridX: this.gridX + c, gridY: resolvedGridY });
        }

        if (this.height <= 0) {
          this.state = GarbageState.CLEARED;
        } else {
          this.state = GarbageState.RESTING;
        }

        resolve(positions);
      });
    });
  }

  public destroy(): void {
    this.state = GarbageState.CLEARED;
    for (let r = 0; r < this.sprites.length; r++) {
      for (let c = 0; c < this.sprites[r].length; c++) {
        const sprite = this.sprites[r][c];
        if (sprite && sprite.active) {
          sprite.destroy();
        }
      }
    }
    this.sprites = [];
  }
}
