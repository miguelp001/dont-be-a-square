import Phaser from 'phaser';
import { Settings } from '../utils/Settings';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const graphics = this.add.graphics();
    const size = 32;

    // Helper to draw a super cute squishy kawaii slime
    const drawCuteSlime = (
      key: string,
      mainColor: number,
      darkColor: number,
      accentColor: number,
      decorType: 'heart' | 'drop' | 'leaf' | 'star' | 'horn' | 'bubble',
      expression: 'happy' | 'sleepy' | 'open' | 'wink' | 'cat' | 'derp'
    ) => {
      graphics.clear();

      // 1. Soft tile base/shadow plate for puzzle grid readability
      graphics.fillStyle(darkColor, 0.45);
      graphics.fillRoundedRect(1, 1, size - 2, size - 2, 6);

      // 2. Slime bottom shadow
      graphics.fillStyle(darkColor, 0.8);
      graphics.fillEllipse(16, 26, 24, 8);

      // 3. Slime main body (plump squishy jelly)
      graphics.fillStyle(mainColor, 1);
      graphics.fillRoundedRect(4, 8, 24, 19, 9);
      graphics.fillEllipse(16, 12, 18, 12);
      graphics.fillEllipse(16, 23, 23, 10);

      // 4. Unique top decoration / personality crest
      graphics.fillStyle(accentColor, 1);
      if (decorType === 'heart') {
        // Mini heart
        graphics.fillCircle(14.5, 6, 2.5);
        graphics.fillCircle(17.5, 6, 2.5);
        graphics.fillTriangle(12.5, 6.5, 19.5, 6.5, 16, 10);
      } else if (decorType === 'drop') {
        // Water droplet tip
        graphics.fillTriangle(16, 2.5, 13, 8, 19, 8);
        graphics.fillCircle(16, 8, 3.5);
      } else if (decorType === 'leaf') {
        // Nature sprout / leaf
        graphics.fillEllipse(14, 5, 5, 2.5);
        graphics.fillEllipse(18, 4.5, 4.5, 2);
        graphics.fillRect(15.5, 6, 1.5, 3);
      } else if (decorType === 'star') {
        // Mini star crest
        graphics.fillTriangle(16, 2.5, 14, 8, 18, 8);
        graphics.fillTriangle(16, 10, 14, 6, 18, 6);
        graphics.fillTriangle(12, 6.5, 16, 4.5, 16, 8.5);
        graphics.fillTriangle(20, 6.5, 16, 4.5, 16, 8.5);
      } else if (decorType === 'horn') {
        // Tiny cute horns
        graphics.fillTriangle(10, 5, 8, 9, 12, 9);
        graphics.fillTriangle(22, 5, 20, 9, 24, 9);
      } else if (decorType === 'bubble') {
        // Mini shiny bubble
        graphics.fillCircle(16, 4.5, 3);
        graphics.fillStyle(0xffffff, 0.7);
        graphics.fillCircle(15, 3.5, 1);
      }

      // 5. Glossy Jelly Highlights (Top-left shine)
      graphics.fillStyle(0xffffff, 0.55);
      graphics.fillEllipse(10, 11, 6, 3);
      graphics.fillStyle(0xffffff, 0.85);
      graphics.fillCircle(8, 11, 1.2);
      graphics.fillCircle(14, 9.5, 1.0);

      // 6. Cute Rosy Cheek Blush
      graphics.fillStyle(0xff477e, 0.55);
      graphics.fillCircle(8, 19, 2.2);
      graphics.fillCircle(24, 19, 2.2);

      // 7. Kawaii Anime Eyes & Expression
      graphics.fillStyle(0x1e272e, 1); // Dark eye color
      if (expression === 'wink') {
        // Left eye winking ('>'), Right eye open with sparkle
        graphics.lineStyle(1.8, 0x1e272e, 1);
        graphics.lineBetween(9, 15, 12, 17);
        graphics.lineBetween(9, 19, 12, 17);
        // Right eye open
        graphics.fillCircle(21, 16.5, 2.4);
        graphics.fillStyle(0xffffff, 0.95);
        graphics.fillCircle(20.2, 15.6, 1.0);
      } else if (expression === 'happy') {
        // Happy arcs ('^^')
        graphics.lineStyle(1.8, 0x1e272e, 1);
        graphics.lineBetween(9.5, 17, 11.5, 15);
        graphics.lineBetween(11.5, 15, 13.5, 17);
        graphics.lineBetween(18.5, 17, 20.5, 15);
        graphics.lineBetween(20.5, 15, 22.5, 17);
      } else if (expression === 'cat') {
        // Beady eyes + cute ':3' mouth
        graphics.fillCircle(11, 16.5, 2.2);
        graphics.fillCircle(21, 16.5, 2.2);
        graphics.fillStyle(0xffffff, 0.95);
        graphics.fillCircle(10.2, 15.6, 0.9);
        graphics.fillCircle(20.2, 15.6, 0.9);
        // :3 mouth
        graphics.lineStyle(1.4, 0x1e272e, 0.9);
        graphics.lineBetween(14, 20, 15, 20.5);
        graphics.lineBetween(15, 20.5, 16, 20);
        graphics.lineBetween(16, 20, 17, 20.5);
        graphics.lineBetween(17, 20.5, 18, 20);
      } else if (expression === 'open') {
        // Big round sparkling eyes + open happy mouth
        graphics.fillCircle(11, 16, 2.5);
        graphics.fillCircle(21, 16, 2.5);
        graphics.fillStyle(0xffffff, 0.95);
        graphics.fillCircle(10.2, 15.2, 1.1);
        graphics.fillCircle(20.2, 15.2, 1.1);
        // Open mouth
        graphics.fillStyle(0xff4757, 1);
        graphics.fillTriangle(14, 19, 18, 19, 16, 22.5);
      } else {
        // Default sweet round eyes + smile
        graphics.fillCircle(11, 16.5, 2.3);
        graphics.fillCircle(21, 16.5, 2.3);
        graphics.fillStyle(0xffffff, 0.95);
        graphics.fillCircle(10.2, 15.6, 1.0);
        graphics.fillCircle(20.2, 15.6, 1.0);
        // Sweet smile
        graphics.lineStyle(1.4, 0x1e272e, 0.85);
        graphics.lineBetween(14.5, 20, 16, 21);
        graphics.lineBetween(16, 21, 17.5, 20);
      }

      graphics.generateTexture(key, size, size);
    };

    // 0: Red Strawberry Slime (Heart, Happy blush)
    drawCuteSlime('panel_0', 0xff4757, 0x991b28, 0xff7986, 'heart', 'happy');

    // 1: Blue Ocean Slime (Waterdrop, Cat ':3' mouth)
    drawCuteSlime('panel_1', 0x3742fa, 0x19218c, 0x70a1ff, 'drop', 'cat');

    // 2: Green Sprout Slime (Leaf sprout, Big open mouth)
    drawCuteSlime('panel_2', 0x2ed573, 0x116b35, 0x7bed9f, 'leaf', 'open');

    // 3: Yellow Star Slime (Star crest, Energetic wink)
    drawCuteSlime('panel_3', 0xffbe1a, 0xa67400, 0xfffa65, 'star', 'wink');

    // 4: Purple Magic Slime (Bat horns, Cute smile)
    drawCuteSlime('panel_4', 0xa55eea, 0x5b298c, 0xd6a2e8, 'horn', 'happy');

    // 5: Cyan Frost Slime (Floating bubble, Sweet calm eyes)
    drawCuteSlime('panel_5', 0x00d2d3, 0x00696a, 0x7efff5, 'bubble', 'derp');

    // Flash panel (when matched: glowing white smiling slime)
    graphics.clear();
    graphics.fillStyle(0xffffff, 0.95);
    graphics.fillRoundedRect(2, 2, size - 4, size - 4, 8);
    graphics.lineStyle(2, 0xffeb3b, 1);
    graphics.strokeRoundedRect(1, 1, size - 2, size - 2, 8);
    // Sparkle eyes on flash
    graphics.fillStyle(0xff69b4, 1);
    graphics.fillCircle(11, 16, 2.5);
    graphics.fillCircle(21, 16, 2.5);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(10, 15, 1.2);
    graphics.fillCircle(20, 15, 1.2);
    graphics.generateTexture('panel_flash', size, size);

    // Garbage Tile (Sleeping Heavy Stone Slime)
    graphics.clear();
    // Dark stone border
    graphics.fillStyle(0x2d3436, 1);
    graphics.fillRoundedRect(0, 0, size, size, 4);
    // Dark slate face
    graphics.fillStyle(0x636e72, 1);
    graphics.fillRoundedRect(2, 2, size - 4, size - 4, 3);
    // Bevel highlights
    graphics.fillStyle(0xb2bec3, 0.45);
    graphics.fillRect(3, 3, size - 6, 2);
    graphics.fillRect(3, 3, 2, size - 6);
    // Cute sleeping eyes (-.-)
    graphics.lineStyle(1.8, 0x2d3436, 1);
    graphics.lineBetween(9, 16, 13, 16);
    graphics.lineBetween(19, 16, 23, 16);
    // Cute snoring z
    graphics.fillStyle(0xdfe6e9, 0.85);
    graphics.fillRect(24, 7, 3, 1);
    graphics.fillRect(26, 8, 1, 1);
    graphics.fillRect(24, 9, 3, 1);
    graphics.generateTexture('garbage_panel', size, size);

    // Transforming Garbage Tile (Sparkling gold/rainbow)
    graphics.clear();
    graphics.fillStyle(0xf1c40f, 1);
    graphics.fillRoundedRect(1, 1, size - 2, size - 2, 4);
    graphics.lineStyle(2, 0xffffff, 1);
    graphics.strokeRoundedRect(1, 1, size - 2, size - 2, 4);
    graphics.fillStyle(0xffffff, 0.85);
    graphics.fillCircle(16, 16, 4);
    graphics.generateTexture('garbage_flash', size, size);

    // Sparkle star particle
    graphics.clear();
    graphics.fillStyle(0xfff200, 1);
    graphics.fillTriangle(6, 0, 4, 6, 8, 6);
    graphics.fillTriangle(6, 12, 4, 6, 8, 6);
    graphics.fillTriangle(0, 6, 6, 4, 6, 8);
    graphics.fillTriangle(12, 6, 6, 4, 6, 8);
    graphics.generateTexture('sparkle_star', 12, 12);

    // Generic panel fallback
    graphics.clear();
    graphics.fillStyle(0xffffff);
    graphics.fillRoundedRect(0, 0, size, size, 4);
    graphics.lineStyle(2, 0x000000, 0.3);
    graphics.strokeRoundedRect(0, 0, size, size, 4);
    graphics.generateTexture('panel', size, size);
    graphics.clear();
    
    // Character placeholder
    graphics.fillStyle(0xff69b4);
    graphics.fillCircle(32, 32, 28);
    graphics.generateTexture('char_placeholder', 64, 64);
    graphics.clear();

    // -------------------------------------------------------------
    // Cute Scrolling Background Texture (128x128 seamless tile)
    // -------------------------------------------------------------
    const bgSize = 128;
    graphics.clear();
    // Deep candy night base (soft, rich, high-contrast for slimes & text)
    graphics.fillStyle(0x1a1230, 1);
    graphics.fillRect(0, 0, bgSize, bgSize);

    // Subtle candy grid lattice lines
    graphics.lineStyle(1, 0x2e1f54, 0.45);
    graphics.strokeRect(0, 0, bgSize, bgSize);

    // Soft pastel polka dots
    graphics.fillStyle(0x4834d4, 0.28);
    graphics.fillCircle(16, 20, 2.5);
    graphics.fillCircle(80, 28, 2);
    graphics.fillCircle(112, 84, 2.5);
    graphics.fillCircle(36, 100, 2);
    graphics.fillCircle(96, 116, 2.5);

    // Kawaii 4-point golden sparkle stars
    const drawBgStar = (sx: number, sy: number, r: number) => {
      graphics.fillStyle(0xfeca57, 0.55);
      graphics.fillTriangle(sx, sy - r, sx - r * 0.4, sy, sx + r * 0.4, sy);
      graphics.fillTriangle(sx, sy + r, sx - r * 0.4, sy, sx + r * 0.4, sy);
      graphics.fillTriangle(sx - r, sy, sx, sy - r * 0.4, sx, sy + r * 0.4);
      graphics.fillTriangle(sx + r, sy, sx, sy - r * 0.4, sx, sy + r * 0.4);
      graphics.fillStyle(0xffffff, 0.85);
      graphics.fillCircle(sx, sy, 1.2);
    };
    drawBgStar(48, 24, 4.5);
    drawBgStar(112, 28, 3.5);
    drawBgStar(28, 64, 4.0);
    drawBgStar(88, 76, 5.0);

    // Sweet mini hearts
    const drawBgHeart = (hx: number, hy: number, scale: number) => {
      graphics.fillStyle(0xff69b4, 0.42);
      graphics.fillCircle(hx - 2 * scale, hy - 1.5 * scale, 2.2 * scale);
      graphics.fillCircle(hx + 2 * scale, hy - 1.5 * scale, 2.2 * scale);
      graphics.fillTriangle(hx - 4.2 * scale, hy - 1 * scale, hx + 4.2 * scale, hy - 1 * scale, hx, hy + 4.5 * scale);
    };
    drawBgHeart(16, 80, 0.85);
    drawBgHeart(80, 108, 0.95);
    drawBgHeart(112, 120, 0.75);
    drawBgHeart(60, 52, 0.8);

    // Cute mini blushing slime silhouettes
    const drawBgMiniSlime = (mx: number, my: number) => {
      graphics.fillStyle(0x54a0ff, 0.35);
      graphics.fillRoundedRect(mx - 8, my - 6, 16, 12, 5);
      graphics.fillCircle(mx, my - 5, 5);
      // Cheerful eyes
      graphics.fillStyle(0xffffff, 0.75);
      graphics.fillCircle(mx - 3, my - 1, 1.1);
      graphics.fillCircle(mx + 3, my - 1, 1.1);
      // Blush
      graphics.fillStyle(0xff477e, 0.5);
      graphics.fillCircle(mx - 5, my + 1.5, 1.0);
      graphics.fillCircle(mx + 5, my + 1.5, 1.0);
    };
    drawBgMiniSlime(40, 88);
    drawBgMiniSlime(100, 48);

    graphics.generateTexture('cute_bg_pattern', bgSize, bgSize);
    graphics.clear();

    // -------------------------------------------------------------
    // Glossy Candy Pill Button Textures
    // -------------------------------------------------------------
    const generatePillButtonTexture = (
      key: string,
      w: number,
      h: number,
      mainColor: number,
      darkColor: number,
      highlightColor: number = 0xffffff
    ) => {
      graphics.clear();
      const r = h / 2;

      // 1. Soft 3D bottom bevel/shadow
      graphics.fillStyle(darkColor, 1);
      graphics.fillRoundedRect(0, 0, w, h, r);

      // 2. Main pill capsule face
      graphics.fillStyle(mainColor, 1);
      graphics.fillRoundedRect(0, 0, w, h - 4, r);

      // 3. Glossy upper candy sheen (horizontal highlight bar across top)
      graphics.fillStyle(highlightColor, 0.38);
      graphics.fillRoundedRect(8, 3, w - 16, (h / 2) - 4, (h / 4));

      // Extra bright shine spot on left
      graphics.fillStyle(0xffffff, 0.75);
      graphics.fillCircle(20, 8, 2.5);
      graphics.fillCircle(28, 8, 1.5);

      // 4. Clean white crisp border
      graphics.lineStyle(2, 0xffffff, 0.9);
      graphics.strokeRoundedRect(1, 1, w - 2, h - 5, r);

      graphics.generateTexture(key, w, h);
    };

    // Standard 230x46 pill buttons
    generatePillButtonTexture('button', 230, 46, 0xff69b4, 0xb8255f); // Default juicy bubblegum pink pill
    generatePillButtonTexture('pill_pink', 230, 46, 0xff69b4, 0xb8255f);
    generatePillButtonTexture('pill_blue', 230, 46, 0x54a0ff, 0x1e3799);
    generatePillButtonTexture('pill_green', 230, 46, 0x2ed573, 0x079992);
    generatePillButtonTexture('pill_purple', 230, 46, 0xa55eea, 0x4834d4);
    generatePillButtonTexture('pill_grey', 230, 46, 0x57606f, 0x2f3542);

    // Compact 120x34 pill buttons for submenus/dialogs
    generatePillButtonTexture('pill_sm_pink', 120, 34, 0xff69b4, 0xb8255f);
    generatePillButtonTexture('pill_sm_blue', 120, 34, 0x54a0ff, 0x1e3799);
    generatePillButtonTexture('pill_sm_green', 120, 34, 0x2ed573, 0x079992);
    generatePillButtonTexture('pill_sm_grey', 120, 34, 0x57606f, 0x2f3542);
    graphics.clear();
  }

  create(): void {
    Settings.load(this);
    this.scene.start('PreloadScene');
  }
}
