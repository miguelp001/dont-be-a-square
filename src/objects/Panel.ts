import Phaser from 'phaser';
import { PANEL_SIZE } from '../utils/Constants';

export enum PanelState {
  IDLE = 'IDLE',
  SWAPPING = 'SWAPPING',
  HOVER = 'HOVER',
  FALLING = 'FALLING',
  FLASHING = 'FLASHING',
  POPPING = 'POPPING',
  DEAD = 'DEAD'
}

export default class Panel extends Phaser.GameObjects.Sprite {
  public gridX: number = 0;
  public gridY: number = 0;
  public color: number = 0;
  public state: PanelState = PanelState.IDLE;
  
  /** Indicates if this panel dropped due to a previous clear and can extend a chain */
  public chainEligible: boolean = false;
  
  public hoverTimer: number = 0;
  public matchTimer: number = 0;
  public popDelayTimer: number = 0;
  
  private flashTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, color: number) {
    // Use the color-specific icon texture panel_0..panel_5 if available
    const textureKey = scene.textures.exists(`panel_${color}`) ? `panel_${color}` : 'panel';
    super(scene, x, y, textureKey);
    this.color = color;
    this.setOrigin(0, 0);
    this.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
    scene.add.existing(this);
  }

  public setGridPosition(gridX: number, gridY: number): void {
    this.gridX = gridX;
    this.gridY = gridY;
  }

  public canSwap(): boolean {
    return this.state === PanelState.IDLE;
  }

  public isClearing(): boolean {
    return this.state === PanelState.FLASHING || this.state === PanelState.POPPING || this.state === PanelState.DEAD;
  }

  public isBusy(): boolean {
    return this.state !== PanelState.IDLE;
  }

  /** Animate horizontal swap */
  public startSwap(targetX: number, duration: number = 90): Promise<void> {
    return new Promise((resolve) => {
      this.state = PanelState.SWAPPING;
      this.scene.tweens.add({
        targets: this,
        x: targetX,
        duration: duration,
        ease: 'Linear',
        onComplete: () => {
          if (this.state === PanelState.SWAPPING) {
            this.state = PanelState.IDLE;
          }
          resolve();
        }
      });
    });
  }

  /** Enter hover state before dropping */
  public startHover(durationMs: number = 90): void {
    this.state = PanelState.HOVER;
    this.hoverTimer = durationMs;
  }

  /** Animate vertical fall to target world Y */
  public fallTo(targetY: number, duration: number = 70): Promise<void> {
    return new Promise((resolve) => {
      this.state = PanelState.FALLING;
      this.scene.tweens.add({
        targets: this,
        y: targetY,
        duration: duration,
        ease: 'Linear',
        onComplete: () => {
          if (this.state === PanelState.FALLING) {
            this.state = PanelState.IDLE;
          }
          this.y = targetY;
          resolve();
        }
      });
    });
  }

  /** Squishy bounce on landing */
  public playLandingBounce(): void {
    const baseY = this.gridY * PANEL_SIZE;
    this.scene.tweens.add({
      targets: this,
      scaleY: 0.86,
      scaleX: 1.14,
      y: baseY + 3,
      duration: 45,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.y = this.gridY * PANEL_SIZE;
        this.scaleX = 1.0;
        this.scaleY = 1.0;
        this.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
      }
    });
  }

  /** Begin flashing animation when a match is detected */
  public startMatch(flashDuration: number = 380, popDelay: number = 0): void {
    this.state = PanelState.FLASHING;
    this.matchTimer = flashDuration;
    this.popDelayTimer = popDelay;

    // Switch to glowing flash slime texture
    if (this.scene.textures.exists('panel_flash')) {
      this.setTexture('panel_flash');
      this.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
    }

    // Alternate texture or alpha to simulate bright flashing
    this.flashTween = this.scene.tweens.add({
      targets: this,
      alpha: 0.35,
      duration: 65,
      yoyo: true,
      repeat: Math.floor(flashDuration / 130),
      onComplete: () => {
        this.alpha = 1.0;
        const baseKey = this.scene.textures.exists(`panel_${this.color}`) ? `panel_${this.color}` : 'panel';
        this.setTexture(baseKey);
        this.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
      }
    });
  }

  /** Pop and disappear */
  public pop(): Promise<void> {
    return new Promise((resolve) => {
      this.state = PanelState.POPPING;
      if (this.flashTween) {
        this.flashTween.stop();
      }
      this.alpha = 1.0;

      // Pop shrink & brighten tween
      this.scene.tweens.add({
        targets: this,
        scaleX: 1.25,
        scaleY: 1.25,
        alpha: 0,
        x: this.x - (PANEL_SIZE * 0.125),
        y: this.y - (PANEL_SIZE * 0.125),
        duration: 120,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.state = PanelState.DEAD;
          this.destroy();
          resolve();
        }
      });
    });
  }
}
