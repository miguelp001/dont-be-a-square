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

  /** True while performing landing squish or idle blink so safety snaps don't interrupt it */
  public isAnimatingSquish: boolean = false;
  /** True while trembling in the danger ceiling zone */
  public isPanicShaking: boolean = false;

  private idleBlinkTimer: number = Math.random() * 3500 + 1800;
  private dangerShakeTween?: Phaser.Tweens.Tween;
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
  }

  public setColor(newColor: number): void {
    this.color = newColor;
    const baseKey = this.scene.textures.exists(`panel_${newColor}`) ? `panel_${newColor}` : 'panel';
    this.setTexture(baseKey);
    this.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
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

  /** Animate horizontal swap with cute directional jelly lean and 2px overshoot bounce */
  public startSwap(targetX: number, duration: number = 85): Promise<void> {
    return new Promise((resolve) => {
      this.state = PanelState.SWAPPING;
      this.isAnimatingSquish = true;
      const s = this.baseScale;
      const startX = this.x;
      const direction = targetX > startX ? 1 : -1;
      const overshootX = targetX + direction * 2;

      // Phase 1: Slide with 1.10x stretch, 0.90x squash, and cute 5-deg dynamic lean
      this.scene.tweens.add({
        targets: this,
        x: overshootX,
        scaleX: s * 1.10,
        scaleY: s * 0.90,
        angle: direction * 5,
        duration: Math.max(20, duration - 40),
        ease: 'Linear',
        onComplete: () => {
          // Phase 2: Snap commit settling overshoot bounce and upright angle
          this.scene.tweens.add({
            targets: this,
            x: targetX,
            scaleX: s,
            scaleY: s,
            angle: 0,
            duration: 40,
            ease: 'Back.easeOut',
            onComplete: () => {
              if (this.state === PanelState.SWAPPING) {
                this.state = PanelState.IDLE;
              }
              this.isAnimatingSquish = false;
              // Authoritative grid snapping prevents drift or desync
              this.x = this.gridX * PANEL_SIZE;
              this.y = this.gridY * PANEL_SIZE;
              this.setAngle(0);
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
          resolve();
        }
      });
    });
  }

  /** Springy multi-stage gelatinous pudding bounce on landing */
  public playLandingBounce(): void {
    if (this.state !== PanelState.IDLE) return;
    const baseY = this.gridY * PANEL_SIZE;
    const baseX = this.gridX * PANEL_SIZE;
    const s = this.baseScale;
    this.isAnimatingSquish = true;

    this.scene.tweens.killTweensOf(this);

    // Stage 1: Impact pancake compression + lateral belly bulge
    this.scene.tweens.add({
      targets: this,
      scaleX: s * 1.25,
      scaleY: s * 0.78,
      y: baseY + 3,
      duration: 50,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (this.state !== PanelState.IDLE) {
          this.isAnimatingSquish = false;
          return;
        }
        // Stage 2: Springy vertical overshoot rebound
        this.scene.tweens.add({
          targets: this,
          scaleX: s * 0.90,
          scaleY: s * 1.15,
          y: baseY - 2.5,
          duration: 60,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            if (this.state !== PanelState.IDLE) {
              this.isAnimatingSquish = false;
              return;
            }
            // Stage 3: Elastic settle back to crisp grid bounds
            this.scene.tweens.add({
              targets: this,
              scaleX: s,
              scaleY: s,
              x: baseX,
              y: baseY,
              duration: 45,
              ease: 'Back.easeOut',
              onComplete: () => {
                this.isAnimatingSquish = false;
                this.x = baseX;
                this.y = baseY;
                this.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
              }
            });
          }
        });
      }
    });
  }

  /** Subtle idle breathing squish & blink */
  public updateIdleAnimation(delta: number): void {
    if (this.state !== PanelState.IDLE || this.isAnimatingSquish || this.isPanicShaking) return;

    this.idleBlinkTimer -= delta;
    if (this.idleBlinkTimer <= 0) {
      this.idleBlinkTimer = Math.random() * 4500 + 3200;
      this.playIdleBlinkSquish();
    }
  }

  /** Quick cute horizontal eyelid squish that simulates a kawaii blink */
  private playIdleBlinkSquish(): void {
    if (this.state !== PanelState.IDLE || this.isAnimatingSquish || this.isPanicShaking) return;
    const baseY = this.gridY * PANEL_SIZE;
    const baseX = this.gridX * PANEL_SIZE;
    const s = this.baseScale;
    this.isAnimatingSquish = true;

    this.scene.tweens.add({
      targets: this,
      scaleY: s * 0.82,
      scaleX: s * 1.08,
      y: baseY + 1.5,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeInOut',
      onComplete: () => {
        this.isAnimatingSquish = false;
        this.x = baseX;
        this.y = baseY;
        this.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
      }
    });
  }

  /** Set shivering nervous panic state when in the danger ceiling zone */
  public setDangerPanic(inDanger: boolean): void {
    if (inDanger) {
      if (this.isPanicShaking || this.state !== PanelState.IDLE) return;
      this.isPanicShaking = true;
      const baseX = this.gridX * PANEL_SIZE;
      const baseY = this.gridY * PANEL_SIZE;
      const s = this.baseScale;

      this.scene.tweens.killTweensOf(this);
      this.dangerShakeTween = this.scene.tweens.add({
        targets: this,
        x: baseX + 1.5,
        scaleX: s * 1.08,
        scaleY: s * 0.94,
        duration: 40,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else {
      if (!this.isPanicShaking) return;
      this.isPanicShaking = false;
      if (this.dangerShakeTween) {
        this.dangerShakeTween.stop();
        this.dangerShakeTween = undefined;
      }
      const baseX = this.gridX * PANEL_SIZE;
      const baseY = this.gridY * PANEL_SIZE;
      const s = this.baseScale;

      // Relief hop: little spring of joy when danger recedes
      this.scene.tweens.add({
        targets: this,
        y: baseY - 3,
        scaleY: s * 1.10,
        scaleX: s * 0.94,
        duration: 75,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.x = baseX;
          this.y = baseY;
          this.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
        }
      });
    }
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
}
