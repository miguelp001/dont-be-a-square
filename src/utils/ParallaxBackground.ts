import Phaser from 'phaser';

export interface ParallaxLayerConfig {
  key: string;
  depth: number;
  factorX: number;
  factorY: number;
  baseScale?: number;
}

export class ParallaxBackground {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private layers: { sprite: Phaser.GameObjects.Image; config: ParallaxLayerConfig }[] = [];
  private particles: Phaser.GameObjects.Image[] = [];

  // Normalized target & smoothed offsets (-1.0 to 1.0)
  private targetNormX: number = 0;
  private targetNormY: number = 0;
  private currentNormX: number = 0;
  private currentNormY: number = 0;

  // Maximum pixel displacement amplitude for the nearest layer
  private maxPixelShiftX: number = 38;
  private maxPixelShiftY: number = 24;

  // Gyroscope listener handle
  private orientationHandler?: (e: DeviceOrientationEvent) => void;
  private updateHandler?: (time: number, delta: number) => void;
  private resizeHandler?: (gameSize: Phaser.Structs.Size) => void;
  private isUsingGyro: boolean = false;
  private lastInputTime: number = 0;

  public static isAvailable(scene: Phaser.Scene): boolean {
    return scene.textures.exists('parallax_sky');
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(-100);

    this.initLayers();
    this.setupPointerListeners();
    this.setupGyroListeners();
    this.setupLifecycleHooks();
  }

  private setupLifecycleHooks(): void {
    // Automatically bind to scene update loop
    this.updateHandler = (time: number, delta: number) => {
      this.update(time, delta);
    };
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateHandler);

    // Automatically handle window/viewport resize
    this.resizeHandler = (gameSize: Phaser.Structs.Size) => {
      this.resize(gameSize.width, gameSize.height);
    };
    this.scene.scale.on('resize', this.resizeHandler);

    // Cleanup on scene shutdown or destroy
    const cleanup = () => {
      if (this.orientationHandler && typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', this.orientationHandler);
      }
      if (this.updateHandler) {
        this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateHandler);
      }
      if (this.resizeHandler) {
        this.scene.scale.off('resize', this.resizeHandler);
      }
      this.container.destroy();
    };

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  private initLayers(): void {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    const layerConfigs: ParallaxLayerConfig[] = [
      { key: 'parallax_sky', depth: -100, factorX: 0.15, factorY: 0.12 },
      { key: 'parallax_far_hills', depth: -90, factorX: 0.38, factorY: 0.30 },
      { key: 'parallax_mid_forest', depth: -80, factorX: 0.72, factorY: 0.58 },
      { key: 'parallax_near_canopy', depth: -70, factorX: 1.00, factorY: 0.85 }
    ];

    for (const config of layerConfigs) {
      if (this.scene.textures.exists(config.key)) {
        const sprite = this.scene.add.image(width / 2, height / 2, config.key);
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(config.depth);
        this.container.add(sprite);
        this.layers.push({ sprite, config });
      }
    }

    // Add ambient floating magical sparkles between layers
    const particleCount = 10;
    for (let i = 0; i < particleCount; i++) {
      const px = Math.random() * width;
      const py = Math.random() * height;
      const p = this.scene.add.image(px, py, 'sparkle_star');
      p.setDisplaySize(7 + Math.random() * 6, 7 + Math.random() * 6);
      p.setTint([0xff9ff3, 0xfeca57, 0x54a0ff, 0x1dd1a1][Math.floor(Math.random() * 4)]);
      p.setAlpha(0.6 + Math.random() * 0.3);
      p.setDepth(-75);
      this.container.add(p);
      this.particles.push(p);

      // Floating gentle bob & drift
      this.scene.tweens.add({
        targets: p,
        x: px + (Math.random() - 0.5) * 60,
        y: py + (Math.random() - 0.5) * 40,
        alpha: { from: 0.3, to: 0.85 },
        scaleX: { from: 0.8, to: 1.25 },
        scaleY: { from: 0.8, to: 1.25 },
        duration: 2500 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 150
      });
    }

    this.resize(width, height);
  }

  public resize(width: number, height: number): void {
    // Give layers ~16% margin overflow buffer so shifting never shows raw edges
    const bufferMultiplier = 1.16;

    this.layers.forEach(({ sprite }) => {
      if (!sprite || !sprite.width || !sprite.height) return;
      const scaleX = (width / sprite.width) * bufferMultiplier;
      const scaleY = (height / sprite.height) * bufferMultiplier;
      const finalScale = Math.max(scaleX, scaleY);
      sprite.setScale(finalScale);
      sprite.setPosition(width / 2, height / 2);
    });
  }

  private setupPointerListeners(): void {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isUsingGyro) return;
      this.lastInputTime = Date.now();
      const halfW = width / 2;
      const halfH = height / 2;
      this.targetNormX = Phaser.Math.Clamp((pointer.x - halfW) / halfW, -1, 1);
      this.targetNormY = Phaser.Math.Clamp((pointer.y - halfH) / halfH, -1, 1);
    });
  }

  private setupGyroListeners(): void {
    if (typeof window === 'undefined') return;

    this.orientationHandler = (event: DeviceOrientationEvent) => {
      // gamma: left-to-right tilt in [-90, 90]
      // beta: front-to-back tilt in [-180, 180]
      if (event.gamma !== null && event.beta !== null) {
        this.isUsingGyro = true;
        this.lastInputTime = Date.now();

        // Normal holding position for phones is ~45 degrees pitch (beta = 45)
        const normalizedGamma = Phaser.Math.Clamp(event.gamma / 30, -1, 1);
        const normalizedBeta = Phaser.Math.Clamp((event.beta - 45) / 30, -1, 1);

        this.targetNormX = normalizedGamma;
        this.targetNormY = normalizedBeta;
      }
    };

    try {
      window.addEventListener('deviceorientation', this.orientationHandler, { passive: true });
    } catch {
      // Device orientation not supported in this environment
    }
  }


  public update(time: number, _delta: number): void {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Ambient fairytale breathing wave when no sudden input is occurring
    const idleSwayX = Math.sin(time * 0.0008) * 0.18;
    const idleSwayY = Math.cos(time * 0.0011) * 0.12;

    const effectiveTargetX = Phaser.Math.Clamp(this.targetNormX + idleSwayX, -1.2, 1.2);
    const effectiveTargetY = Phaser.Math.Clamp(this.targetNormY + idleSwayY, -1.2, 1.2);

    // Silky smooth exponential damping (lerp)
    this.currentNormX += (effectiveTargetX - this.currentNormX) * 0.065;
    this.currentNormY += (effectiveTargetY - this.currentNormY) * 0.065;

    // Displace each layer according to its individual depth factor
    this.layers.forEach(({ sprite, config }) => {
      const shiftX = this.currentNormX * this.maxPixelShiftX * config.factorX;
      const shiftY = this.currentNormY * this.maxPixelShiftY * config.factorY;
      sprite.setPosition(centerX + shiftX, centerY + shiftY);
    });
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
