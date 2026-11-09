import type Phaser from 'phaser';
import { BOARD_WIDTH, BOARD_VISIBLE_HEIGHT, PANEL_SIZE } from '../utils/Constants';

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridMetrics extends LayoutRect {
  cellSize: number;
  scale: number;
}

export interface VsLayoutMetrics {
  isMobile: boolean;
  statusBar: LayoutRect;
  threatBuffer: LayoutRect;
  opponentRadar: GridMetrics;
  divider: LayoutRect;
  playerGrid: GridMetrics;
  bottomGutter: LayoutRect;
}

export const RADAR_COLORS = [
  0xd63031, // Red
  0x0984e3, // Blue
  0x00b894, // Green
  0xfdcb6e, // Yellow
  0x6c5ce7, // Purple
  0x00cec9  // Cyan
];

/**
 * Computes exact pixel slots according to the Hero & Radar Asymmetric Blueprint:
 * - Top 8%: Status Bar (Timers, Match Score, Health/Danger)
 * - Top 28%: Threat Buffer / Garbage Queue (Left) & Opponent Radar (Right)
 * - Divider 4%: Chain Multiplier and Stop-Time freeze meter
 * - Bottom 60%: Primary Player Grid (with 48px-56px targets) & Safe Push Gutter
 */
export function computeVsLayout(width: number, height: number): VsLayoutMetrics {
  const isMobile = height >= width * 1.05 || width < 600;

  if (!isMobile) {
    // Desktop Landscape: Side-by-Side Dual Boards
    const gutterH = 40;
    const availH = height - 80 - gutterH;
    const availW = (width - 60) / 2;
    const scale = Math.max(0.8, Math.min(1.4, Math.min(availW / (BOARD_WIDTH * PANEL_SIZE), availH / (BOARD_VISIBLE_HEIGHT * PANEL_SIZE))));
    const boardW = Math.round(BOARD_WIDTH * PANEL_SIZE * scale);
    const boardH = Math.round(BOARD_VISIBLE_HEIGHT * PANEL_SIZE * scale);
    const cellSize = Math.round(PANEL_SIZE * scale);

    return {
      isMobile: false,
      statusBar: { x: 0, y: 0, width, height: 60 },
      threatBuffer: { x: 20, y: 70, width: 200, height: 40 },
      opponentRadar: {
        x: width - boardW - 20,
        y: Math.round((height - boardH) / 2),
        width: boardW,
        height: boardH,
        cellSize,
        scale
      },
      divider: { x: width / 2 - 40, y: 60, width: 80, height: 40 },
      playerGrid: {
        x: 20,
        y: Math.round((height - boardH) / 2),
        width: boardW,
        height: boardH,
        cellSize,
        scale
      },
      bottomGutter: { x: 20, y: height - gutterH - 10, width: boardW, height: gutterH }
    };
  }

  // Mobile Portrait Asymmetric Split
  // 1. Status Bar: Top 8%
  const statusH = Math.max(38, Math.round(height * 0.08));
  const statusBar: LayoutRect = { x: 0, y: 0, width, height: statusH };

  // 2. Opponent Radar & Threat Buffer: Top 28%
  const radarSectionY = statusH;
  const radarSectionH = Math.round(height * 0.28);

  // Radar mini-grid (42% scale, 20px-24px per cell)
  const radarCellSize = Math.max(16, Math.min(24, Math.floor(radarSectionH / BOARD_VISIBLE_HEIGHT)));
  const radarW = radarCellSize * BOARD_WIDTH;
  const radarH = radarCellSize * BOARD_VISIBLE_HEIGHT;
  const radarScale = radarCellSize / PANEL_SIZE;
  const radarX = width - radarW - 12;
  const radarY = radarSectionY + Math.round((radarSectionH - radarH) / 2);

  const opponentRadar: GridMetrics = {
    x: radarX,
    y: radarY,
    width: radarW,
    height: radarH,
    cellSize: radarCellSize,
    scale: radarScale
  };

  // Threat Buffer / Garbage Queue (Left of Radar)
  const threatW = Math.max(80, radarX - 16);
  const threatBuffer: LayoutRect = {
    x: 8,
    y: radarSectionY,
    width: threatW,
    height: radarSectionH
  };

  // 3. Divider: 4%
  const dividerY = radarSectionY + radarSectionH;
  const dividerH = Math.max(22, Math.round(height * 0.04));
  const divider: LayoutRect = { x: 0, y: dividerY, width, height: dividerH };

  // 4. Bottom Safe Gutter (Dedicated Push Stack Tap Trigger outside active playfield)
  const gutterH = Math.max(38, Math.round(height * 0.055));
  const gutterY = height - gutterH - 6;
  const bottomGutter: LayoutRect = { x: 12, y: gutterY, width: width - 24, height: gutterH };

  // 5. Primary Player Grid: Bottom 60% (Large touch targets: 48px-56px per cell)
  const playerAvailableY = dividerY + dividerH + 4;
  const playerAvailableH = gutterY - playerAvailableY - 4;
  const playerAvailableW = width - 16;

  const playerCellH = Math.floor(playerAvailableH / BOARD_VISIBLE_HEIGHT);
  const playerCellW = Math.floor(playerAvailableW / BOARD_WIDTH);
  const playerCellSize = Math.max(34, Math.min(56, Math.min(playerCellH, playerCellW)));
  const playerScale = playerCellSize / PANEL_SIZE;
  const playerGridW = playerCellSize * BOARD_WIDTH;
  const playerGridH = playerCellSize * BOARD_VISIBLE_HEIGHT;
  const playerGridX = Math.round((width - playerGridW) / 2);
  const playerGridY = playerAvailableY + Math.round((playerAvailableH - playerGridH) / 2);

  const playerGrid: GridMetrics = {
    x: playerGridX,
    y: playerGridY,
    width: playerGridW,
    height: playerGridH,
    cellSize: playerCellSize,
    scale: playerScale
  };

  return {
    isMobile: true,
    statusBar,
    threatBuffer,
    opponentRadar,
    divider,
    playerGrid,
    bottomGutter
  };
}

/**
 * Animate a ballistic arc vector traveling from attacker to recipient's garbage queue.
 */
export function animateBallisticGarbageArc(
  scene: Phaser.Scene,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  comboSize: number,
  onComplete?: () => void
): void {
  // Parabolic control point arcing high into the air
  const midX = (startX + endX) / 2;
  const midY = Math.min(startY, endY) - Math.max(60, Math.abs(startX - endX) * 0.35);

  const projectile = scene.add.container(startX, startY);
  projectile.setDepth(50);

  const core = scene.add.circle(0, 0, Math.min(16, 6 + comboSize * 1.5), 0xff4757, 1);
  const glow = scene.add.circle(0, 0, Math.min(24, 10 + comboSize * 2.2), 0xfffa65, 0.65);
  projectile.add([glow, core]);

  // Mini trash block preview riding inside the projectile
  if (scene.textures && scene.textures.exists('garbage_panel')) {
    const trashSprite = scene.add.sprite(0, 0, 'garbage_panel');
    const iconSize = Math.min(22, 12 + comboSize * 1.6);
    trashSprite.setDisplaySize(iconSize, iconSize);
    trashSprite.setOrigin(0.5);
    trashSprite.setAlpha(0.95);
    projectile.add(trashSprite);
  }

  // Quadratic Bezier Arc Tween
  const path = { t: 0 };
  scene.tweens.add({
    targets: path,
    t: 1,
    duration: 480,
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      const t = path.t;
      // B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
      const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * midX + t * t * endX;
      const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * midY + t * t * endY;
      projectile.setPosition(x, y);
      projectile.setRotation(t * Math.PI * 2);

      // Sparkle trail
      if (Math.random() < 0.45) {
        const spark = scene.add.circle(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, 2, 0xffffff, 0.85);
        spark.setDepth(49);
        scene.tweens.add({
          targets: spark,
          alpha: 0,
          scale: 0.2,
          duration: 180,
          onComplete: () => spark.destroy()
        });
      }
    },
    onComplete: () => {
      // Impact burst
      const burst = scene.add.circle(endX, endY, 14, 0xffffff, 0.9);
      burst.setDepth(51);
      scene.tweens.add({
        targets: burst,
        scale: 2.2,
        alpha: 0,
        duration: 160,
        ease: 'Quad.easeOut',
        onComplete: () => burst.destroy()
      });

      projectile.destroy();
      if (onComplete) onComplete();
    }
  });
}
