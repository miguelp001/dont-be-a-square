import Phaser from 'phaser';
import Board from './Board';
import { BOARD_WIDTH, BOARD_VISIBLE_HEIGHT, PANEL_SIZE } from '../utils/Constants';
import { SoundFx } from '../utils/SoundFx';

export default class Cursor extends Phaser.GameObjects.Rectangle {
  public board?: Board;
  public gridX: number = 2;
  public gridY: number = 7;
  public boardOffsetX: number = 64;
  public boardOffsetY: number = 64;
  public stackOffsetPixels: number = 0;

  constructor(scene: Phaser.Scene, boardOrOffsetX: Board | number = 64, offsetY: number = 64) {
    let ox = 64;
    let oy = 64;
    let boardRef: Board | undefined;

    if (boardOrOffsetX instanceof Board) {
      boardRef = boardOrOffsetX;
      ox = boardRef.boardOffsetX;
      oy = boardRef.boardOffsetY;
    } else {
      ox = boardOrOffsetX;
      oy = offsetY;
    }

    super(
      scene,
      ox + 2 * PANEL_SIZE + PANEL_SIZE,
      oy + 7 * PANEL_SIZE + PANEL_SIZE / 2,
      PANEL_SIZE * 2 + 6,
      PANEL_SIZE + 6,
      0xffffff,
      0
    );

    this.board = boardRef;
    this.boardOffsetX = ox;
    this.boardOffsetY = oy;
    this.stackOffsetPixels = boardRef ? boardRef.stackOffsetPixels : 0;

    this.setStrokeStyle(3.5, 0xfff200, 1);
    this.setOrigin(0.5, 0.5);
    this.setDepth(25); // Always render above panels and board elements
    scene.add.existing(this);

    // Subtle pulsing animation for retro arcade feel
    scene.tweens.add({
      targets: this,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 320,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.updatePosition();
  }

  public moveLeft(): void {
    if (this.gridX > 0) {
      this.gridX--;
      this.updatePosition();
      SoundFx.playCursor();
    }
  }

  public moveRight(): void {
    if (this.gridX < BOARD_WIDTH - 2) {
      this.gridX++;
      this.updatePosition();
      SoundFx.playCursor();
    }
  }

  public moveUp(): void {
    if (this.gridY > 0) {
      this.gridY--;
      this.updatePosition();
      SoundFx.playCursor();
    }
  }

  public moveDown(): void {
    if (this.gridY < BOARD_VISIBLE_HEIGHT - 1) {
      this.gridY++;
      this.updatePosition();
      SoundFx.playCursor();
    }
  }

  public setGridPosition(gx: number, gy: number): void {
    this.gridX = Math.max(0, Math.min(gx, BOARD_WIDTH - 2));
    this.gridY = Math.max(0, Math.min(gy, BOARD_VISIBLE_HEIGHT - 1));
    this.updatePosition();
  }

  public setStackOffset(offset: number): void {
    this.stackOffsetPixels = offset;
    this.updatePosition();
  }

  public shiftWithStack(offset?: number): void {
    if (this.gridY > 0) {
      this.gridY--;
    }
    if (offset !== undefined) {
      this.stackOffsetPixels = offset;
    } else if (this.board) {
      this.stackOffsetPixels = this.board.stackOffsetPixels;
    }
    this.updatePosition();
  }

  public updatePosition(): void {
    if (this.board) {
      this.boardOffsetX = this.board.boardOffsetX;
      this.boardOffsetY = this.board.boardOffsetY;
      this.stackOffsetPixels = this.board.stackOffsetPixels;
    }
    this.x = this.boardOffsetX + this.gridX * PANEL_SIZE + PANEL_SIZE;
    this.y = this.boardOffsetY + this.gridY * PANEL_SIZE + PANEL_SIZE / 2 - this.stackOffsetPixels;
  }
}
