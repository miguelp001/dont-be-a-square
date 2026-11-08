import Phaser from 'phaser';
import { CuteUI } from './CuteUI';
import { SoundFx } from './SoundFx';

export type BRTargetMode = 'random' | 'attackers' | 'kos' | 'badges' | 'manual';

export class BattleRoyaleTargeter {
  private scene: Phaser.Scene;
  private currentMode: BRTargetMode = 'random';
  private manualTargetId: string | null = null;
  private onTargetChanged: (mode: BRTargetMode, manualTargetId?: string) => void;

  public container!: Phaser.GameObjects.Container;
  private buttons: Map<BRTargetMode, { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics }> = new Map();
  private manualText?: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    onTargetChanged: (mode: BRTargetMode, manualTargetId?: string) => void
  ) {
    this.scene = scene;
    this.onTargetChanged = onTargetChanged;
  }

  public createUI(x: number, y: number, width: number, uiScale: number = 1.0): Phaser.GameObjects.Container {
    this.container = this.scene.add.container(x, y);

    const modes: { id: BRTargetMode; label: string; key: string }[] = [
      { id: 'random', label: '🎲 RANDOM', key: '1 / ◀' },
      { id: 'attackers', label: '⚔️ REVENGE', key: '2 / ▲' },
      { id: 'kos', label: '💀 KOs', key: '3 / ▼' },
      { id: 'badges', label: '🎖️ BADGES', key: '4 / ▶' }
    ];

    const spacing = 4;
    const btnW = Math.floor((width - (modes.length - 1) * spacing) / modes.length);
    const btnH = Math.round(26 * uiScale);
    const startX = -width / 2 + btnW / 2;

    modes.forEach((m, idx) => {
      const btnX = startX + idx * (btnW + spacing);
      const btnContainer = this.scene.add.container(btnX, 0);

      const bg = this.scene.add.graphics();
      btnContainer.add(bg);

      const text = this.scene.add.text(0, -1, m.label, {
        fontSize: `${Math.max(9, Math.round(10 * uiScale))}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);
      btnContainer.add(text);

      const hit = this.scene.add.rectangle(0, 0, btnW, btnH, 0x000000, 0);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.setMode(m.id);
      });
      btnContainer.add(hit);

      this.buttons.set(m.id, { container: btnContainer, bg });
      this.container.add(btnContainer);
    });

    this.updatePillStyles(btnW, btnH);
    this.setupKeyboardListeners();

    return this.container;
  }

  public setMode(mode: BRTargetMode, manualTargetId?: string): void {
    if (this.currentMode === mode && this.manualTargetId === (manualTargetId || null)) {
      return;
    }
    SoundFx.playCursor();
    this.currentMode = mode;
    this.manualTargetId = manualTargetId || null;

    const btnW = 70;
    const btnH = 26;
    this.updatePillStyles(btnW, btnH);
    this.onTargetChanged(this.currentMode, this.manualTargetId || undefined);
  }

  public setManualTarget(targetId: string, targetName: string): void {
    this.setMode('manual', targetId);
  }

  public get mode(): BRTargetMode {
    return this.currentMode;
  }

  public get manualId(): string | null {
    return this.manualTargetId;
  }

  private updatePillStyles(btnW: number, btnH: number): void {
    const halfW = btnW / 2;
    const halfH = btnH / 2;

    for (const [id, btn] of this.buttons.entries()) {
      const isSelected = this.currentMode === id;
      btn.bg.clear();
      btn.bg.fillStyle(isSelected ? 0xff4757 : 0x0d071c, isSelected ? 0.95 : 0.75);
      btn.bg.fillRoundedRect(-halfW, -halfH, btnW, btnH, 6);
      btn.bg.lineStyle(isSelected ? 2 : 1, isSelected ? 0xfeca57 : 0x57606f, isSelected ? 1 : 0.6);
      btn.bg.strokeRoundedRect(-halfW, -halfH, btnW, btnH, 6);
    }
  }

  private keyListeners: { event: string; fn: () => void }[] = [];

  public destroy(): void {
    const k = this.scene.input.keyboard;
    if (k) {
      for (const kl of this.keyListeners) {
        k.off(kl.event, kl.fn);
      }
    }
    this.keyListeners = [];
  }

  private setupKeyboardListeners(): void {
    const k = this.scene.input.keyboard;
    if (!k) return;

    // Numerical keys 1-4 for quick target mode switching (tetris 99 style)
    // NOTE: Arrow keys are preserved strictly for player board cursor navigation!
    const binds: [string, BRTargetMode][] = [
      ['keydown-ONE', 'random'],
      ['keydown-TWO', 'attackers'],
      ['keydown-THREE', 'kos'],
      ['keydown-FOUR', 'badges'],
      ['keydown-NUMPAD_ONE', 'random'],
      ['keydown-NUMPAD_TWO', 'attackers'],
      ['keydown-NUMPAD_THREE', 'kos'],
      ['keydown-NUMPAD_FOUR', 'badges']
    ];

    for (const [evt, mode] of binds) {
      const fn = () => this.setMode(mode);
      k.on(evt, fn);
      this.keyListeners.push({ event: evt, fn });
    }
  }
}
