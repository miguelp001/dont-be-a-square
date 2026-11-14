import Phaser from 'phaser';
import { PANEL_SIZE, PanelState } from '../utils/Constants';
export { PanelState };

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
  
  /** Kiri's Gear Lock ability state */
  public isLocked: boolean = false;
  /** Set while actively dragged by touch controller to prevent grid snapping conflict */
  public isDragged: boolean = false;
  private lockIcon?: Phaser.GameObjects.Image;
  
  private flashTween?: Phaser.Tweens.Tween;

  private get baseScale(): number {
    return this.width > 0 ? PANEL_SIZE / this.width : 1.0;
  }

  constructor(scene: Phaser.Scene, x: number, y: number, color: number) {
    // Use the color-specific icon texture panel_0..panel_5 if available
    const textureKey = scene.textures.exists(`panel_${color}`) ? `panel_${color}` : 'panel';
    super(scene, x, y, textureKey);
    this.color = color;
    this.setOrigin(0, 0);
    this.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
    this.setDepth(4);
    scene.add.existing(this);
  }

  public setGridPosition(gridX: number, gridY: number): void {
    this.gridX = gridX;
    this.gridY = gridY;
    this.updateLockPosition();
  }

  public setColor(newColor: number): void {
    this.color = newColor;
    const baseKey = this.scene.textures.exists(`panel_${newColor}`) ? `panel_${newColor}` : 'panel';
    this.setTexture(baseKey);
    this.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
  }

  public canSwap(): boolean {
    return this.state === PanelState.IDLE && !this.isLocked;
  }

  public setLocked(locked: boolean): void {
    this.isLocked = locked;
    if (locked) {
      if (!this.lockIcon && this.scene && this.scene.textures.exists('panel_lock_gear')) {
        this.lockIcon = this.scene.add.image(this.x + PANEL_SIZE / 2, this.y + PANEL_SIZE / 2, 'panel_lock_gear');
        this.lockIcon.setDisplaySize(PANEL_SIZE * 0.72, PANEL_SIZE * 0.72);
        this.lockIcon.setDepth(this.depth + 2);
        if (this.parentContainer) {
          this.parentContainer.add(this.lockIcon);
        }
      }
      this.setTint(0xbdc3c7);
    } else {
      if (this.lockIcon) {
        this.lockIcon.destroy();
        this.lockIcon = undefined;
      }
      this.clearTint();
    }
  }

  public updateLockPosition(): void {
    if (this.lockIcon) {
      this.lockIcon.setPosition(this.x + PANEL_SIZE / 2, this.y + PANEL_SIZE / 2);
    }
  }

  public isClearing(): boolean {
    return this.state === PanelState.FLASHING || this.state === PanelState.POPPING || this.state === PanelState.DEAD;
  }

  public isBusy(): boolean {
    return this.state !== PanelState.IDLE;
  }

  /** Animate horizontal swap with 1.05x squash-stretch and 2px overshoot bounce settling in 40ms */
  public startSwap(targetX: number, duration: number = 85): Promise<void> {
    return new Promise((resolve) => {
      this.state = PanelState.SWAPPING;
      const s = this.baseScale;
      const startX = this.x;
      const direction = targetX > startX ? 1 : -1;
      const overshootX = targetX + direction * 2;

      // Phase 1: Slide with 1.05x horizontal stretch and 0.95x vertical squash toward overshoot
      this.scene.tweens.add({
        targets: this,
        x: overshootX,
        scaleX: s * 1.05,
        scaleY: s * 0.95,
        duration: Math.max(20, duration - 40),
        ease: 'Linear',
        onComplete: () => {
          // Phase 2: Snap commit settling overshoot bounce (40ms)
          this.scene.tweens.add({
            targets: this,
            x: targetX,
            scaleX: s,
            scaleY: s,
            duration: 40,
            ease: 'Back.easeOut',
            onComplete: () => {
              if (this.state === PanelState.SWAPPING) {
                this.state = PanelState.IDLE;
              }
              // Authoritative grid snapping prevents drift or desync
              this.x = this.gridX * PANEL_SIZE;
              this.y = this.gridY * PANEL_SIZE;
              this.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
              resolve();
            }
          });
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
          // Authoritative grid snapping prevents drift or desync
          this.x = this.gridX * PANEL_SIZE;
          this.y = this.gridY * PANEL_SIZE;
          this.updateLockPosition();
          resolve();
        }
      });
    });
  }

  /** Squishy bounce on landing */
  public playLandingBounce(): void {
    const baseY = this.gridY * PANEL_SIZE;
    const s = this.baseScale;
    this.scene.tweens.add({
      targets: this,
      scaleY: s * 0.88,
      scaleX: s * 1.12,
      y: baseY + 2,
      duration: 45,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Authoritative grid snapping prevents drift or desync
        this.x = this.gridX * PANEL_SIZE;
        this.y = this.gridY * PANEL_SIZE;
        this.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
        this.updateLockPosition();
      }
    });
  }

  /** Begin high-luminance 300ms strobe animation when a match is detected */
  public startMatch(flashDuration: number = 300, popDelay: number = 0): void {
    this.state = PanelState.FLASHING;
    this.matchTimer = flashDuration;
    this.popDelayTimer = popDelay;

    // Switch to glowing flash slime texture with slight celebratory pop
    const s = this.baseScale;
    this.setScale(s * 1.08);

    if (this.scene.textures.exists('panel_flash')) {
      this.setTexture('panel_flash');
      this.setDisplaySize(PANEL_SIZE * 1.08, PANEL_SIZE * 1.08);
    }

    // High-luminance 300ms strobe (oscillating every 50ms)
    this.flashTween = this.scene.tweens.add({
      targets: this,
      alpha: 0.25,
      duration: 50,
      yoyo: true,
      repeat: Math.floor(flashDuration / 100),
      onComplete: () => {
        this.alpha = 1.0;
        this.setScale(s);
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

      const s = this.baseScale;
      // Pop shrink & brighten tween
      this.scene.tweens.add({
        targets: this,
        scaleX: s * 1.25,
        scaleY: s * 1.25,
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

  public override destroy(fromScene?: boolean): void {
    if (this.scene?.tweens) {
      this.scene.tweens.killTweensOf(this);
    }
    if (this.flashTween) {
      this.flashTween.stop();
      this.flashTween = undefined;
    }
    if (this.lockIcon) {
      if (this.scene?.tweens) {
        this.scene.tweens.killTweensOf(this.lockIcon);
      }
      this.lockIcon.destroy();
      this.lockIcon = undefined;
    }
    super.destroy(fromScene);
  }
}
