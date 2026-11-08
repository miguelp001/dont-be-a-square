import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PANEL_SIZE, PanelState } from '../src/utils/Constants';

// Mock Panel class to test squishy animations independently of Phaser's canvas initialization
class MockPanel {
  public gridX: number = 0;
  public gridY: number = 0;
  public x: number = 0;
  public y: number = 0;
  public scaleX: number = 1.0;
  public scaleY: number = 1.0;
  public angle: number = 0;
  public state: PanelState = PanelState.IDLE;
  public isAnimatingSquish: boolean = false;
  public isPanicShaking: boolean = false;
  private idleBlinkTimer: number = 3000;
  private dangerShakeTween?: any;

  constructor(public scene: any, x: number, y: number, public color: number) {
    this.x = x;
    this.y = y;
  }

  private get baseScale(): number {
    return 1.0;
  }

  public startSwap(targetX: number, duration: number = 85): Promise<void> {
    return new Promise((resolve) => {
      this.state = PanelState.SWAPPING;
      this.isAnimatingSquish = true;
      const s = this.baseScale;
      const startX = this.x;
      const direction = targetX > startX ? 1 : -1;
      const overshootX = targetX + direction * 2;

      this.scene.tweens.add({
        targets: this,
        x: overshootX,
        scaleX: s * 1.10,
        scaleY: s * 0.90,
        angle: direction * 5,
        duration: Math.max(20, duration - 40),
        onComplete: () => {
          this.scene.tweens.add({
            targets: this,
            x: targetX,
            scaleX: s,
            scaleY: s,
            angle: 0,
            duration: 40,
            onComplete: () => {
              this.state = PanelState.IDLE;
              this.isAnimatingSquish = false;
              this.x = targetX;
              resolve();
            }
          });
        }
      });
    });
  }

  public playLandingBounce(): void {
    if (this.state !== PanelState.IDLE) return;
    const baseY = this.gridY * PANEL_SIZE;
    const s = this.baseScale;
    this.isAnimatingSquish = true;

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scaleX: s * 1.25,
      scaleY: s * 0.78,
      y: baseY + 3,
      duration: 50,
      onComplete: () => {
        this.scene.tweens.add({
          targets: this,
          scaleX: s * 0.90,
          scaleY: s * 1.15,
          y: baseY - 2.5,
          duration: 60,
          onComplete: () => {
            this.scene.tweens.add({
              targets: this,
              scaleX: s,
              scaleY: s,
              duration: 45,
              onComplete: () => {
                this.isAnimatingSquish = false;
              }
            });
          }
        });
      }
    });
  }

  public updateIdleAnimation(delta: number): void {
    if (this.state !== PanelState.IDLE || this.isAnimatingSquish || this.isPanicShaking) return;
    this.idleBlinkTimer -= delta;
    if (this.idleBlinkTimer <= 0) {
      this.idleBlinkTimer = 4000;
      this.playIdleBlinkSquish();
    }
  }

  public playIdleBlinkSquish(): void {
    const s = this.baseScale;
    this.isAnimatingSquish = true;
    this.scene.tweens.add({
      targets: this,
      scaleY: s * 0.82,
      scaleX: s * 1.08,
      duration: 70,
      yoyo: true,
      onComplete: () => {
        this.isAnimatingSquish = false;
      }
    });
  }

  public setDangerPanic(inDanger: boolean): void {
    if (inDanger) {
      if (this.isPanicShaking || this.state !== PanelState.IDLE) return;
      this.isPanicShaking = true;
      const baseX = this.gridX * PANEL_SIZE;
      const s = this.baseScale;
      this.scene.tweens.killTweensOf(this);
      this.dangerShakeTween = this.scene.tweens.add({
        targets: this,
        x: baseX + 1.5,
        scaleX: s * 1.08,
        scaleY: s * 0.94,
        duration: 40,
        repeat: -1
      });
    } else {
      if (!this.isPanicShaking) return;
      this.isPanicShaking = false;
      const baseY = this.gridY * PANEL_SIZE;
      const s = this.baseScale;
      this.scene.tweens.add({
        targets: this,
        y: baseY - 3,
        scaleY: s * 1.10,
        scaleX: s * 0.94,
        duration: 75
      });
    }
  }
}

describe('Squishy Slime Panel Animation Engine', () => {
  let mockScene: any;
  let addedTweens: any[] = [];

  beforeEach(() => {
    addedTweens = [];
    mockScene = {
      tweens: {
        add: vi.fn((config: any) => {
          addedTweens.push(config);
          return { stop: vi.fn() };
        }),
        killTweensOf: vi.fn()
      }
    };
  });

  it('1. playLandingBounce triggers multi-stage gelatinous squish and rebound', () => {
    const panel = new MockPanel(mockScene, 0, 0, 0);
    panel.gridX = 2;
    panel.gridY = 5;
    panel.state = PanelState.IDLE;

    panel.playLandingBounce();

    expect(panel.isAnimatingSquish).toBe(true);
    expect(addedTweens.length).toBeGreaterThan(0);
    const stage1 = addedTweens[0];
    expect(stage1.scaleX).toBeGreaterThan(1.0);
    expect(stage1.scaleY).toBeLessThan(1.0);
    expect(stage1.y).toBe(5 * PANEL_SIZE + 3);
  });

  it('2. updateIdleAnimation triggers cute kawaii blink squish when timer expires', () => {
    const panel = new MockPanel(mockScene, 0, 0, 1);
    panel.gridX = 1;
    panel.gridY = 3;
    panel.state = PanelState.IDLE;

    panel.updateIdleAnimation(5000);

    expect(addedTweens.length).toBe(1);
    const blinkTween = addedTweens[0];
    expect(blinkTween.scaleY).toBeLessThan(1.0);
    expect(blinkTween.scaleX).toBeGreaterThan(1.0);
  });

  it('3. setDangerPanic(true) starts nervous trembling and setDangerPanic(false) executes relief hop', () => {
    const panel = new MockPanel(mockScene, 0, 0, 2);
    panel.gridX = 3;
    panel.gridY = 0;
    panel.state = PanelState.IDLE;

    // Enter danger panic
    panel.setDangerPanic(true);
    expect(panel.isPanicShaking).toBe(true);
    expect(mockScene.tweens.killTweensOf).toHaveBeenCalledWith(panel);
    expect(addedTweens.length).toBe(1);

    // Relief when danger clears
    addedTweens = [];
    panel.setDangerPanic(false);
    expect(panel.isPanicShaking).toBe(false);
    expect(addedTweens.length).toBe(1);
    const reliefTween = addedTweens[0];
    expect(reliefTween.y).toBe(0 * PANEL_SIZE - 3);
  });

  it('4. startSwap applies directional jelly lean angle during horizontal slide', async () => {
    const panel = new MockPanel(mockScene, 1 * PANEL_SIZE, 4 * PANEL_SIZE, 3);
    panel.gridX = 1;
    panel.gridY = 4;

    const targetX = 2 * PANEL_SIZE;
    panel.startSwap(targetX, 85);

    expect(panel.state).toBe(PanelState.SWAPPING);
    expect(panel.isAnimatingSquish).toBe(true);
    expect(addedTweens.length).toBeGreaterThan(0);
    const slideTween = addedTweens[0];
    expect(slideTween.angle).toBe(5);
  });
});
