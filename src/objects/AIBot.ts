import Board from './Board';
import Cursor from './Cursor';
import { BOARD_WIDTH, BOARD_VISIBLE_HEIGHT } from '../utils/Constants';

export enum AIDifficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD'
}

export interface AIPersonality {
  id: string;
  name: string;
  title: string;
  description: string;
  baseInterval: number; // ms per action step
  indecisiveness: number; // 0.0 to 1.0 (chance to abandon target move and switch mind)
  jitterChance: number; // chance to make a nervous or exploratory swap
  comboBias: number; // multiplier for prioritizing 4+ and 5+ combos
  garbageBias: number; // multiplier for clearing tiles touching garbage slabs
  chainBias: number; // multiplier for drop-down cascade matches
  liftThreshold: number; // row height at which bot auto-lifts stack
  liftFrequency: number; // ms interval between offensive lift surges
  liftDuration: number; // ms duration of offensive lift surge
  burstSteps: number; // number of steps taken in a rapid burst
  burstCooldown: number; // ms pause after completing a burst
  panicSpeedup: number; // speed multiplier when in danger
}

export const AI_PERSONALITIES: Record<string, AIPersonality> = {
  kiri: {
    id: 'kiri',
    name: 'Kiri',
    title: 'Precision Mechanic',
    description: 'Methodical and precise. Dismantles garbage blocks like clockwork with zero hesitation.',
    baseInterval: 145,
    indecisiveness: 0.02,
    jitterChance: 0.04,
    comboBias: 1.25,
    garbageBias: 2.6, // High focus on dismantling garbage slabs
    chainBias: 1.3,
    liftThreshold: 7,
    liftFrequency: 15000,
    liftDuration: 750,
    burstSteps: 1,
    burstCooldown: 0,
    panicSpeedup: 1.15
  },
  mizu: {
    id: 'mizu',
    name: 'Mizu',
    title: 'Fluid Counter-Blade',
    description: 'Calm and patient. Specializes in cascading chain reactions and deadly counter-attacks.',
    baseInterval: 165,
    indecisiveness: 0.05,
    jitterChance: 0.05,
    comboBias: 1.1,
    garbageBias: 1.5,
    chainBias: 2.6, // Master of multi-tier chain reactions
    liftThreshold: 8,
    liftFrequency: 22000,
    liftDuration: 600,
    burstSteps: 1,
    burstCooldown: 0,
    panicSpeedup: 1.05 // Never panics; maintains composure in danger
  },
  riff: {
    id: 'riff',
    name: 'Riff',
    title: 'Hyper Shredder',
    description: 'Blazing speed and loud 4+ combos! Constantly fast-lifts the stack to keep the tempo rockin\'.',
    baseInterval: 80, // Blistering fast!
    indecisiveness: 0.12,
    jitterChance: 0.18,
    comboBias: 2.2, // Loves loud 4+ combos
    garbageBias: 0.85, // Reckless; ignores garbage until forced
    chainBias: 1.2,
    liftThreshold: 4, // Keeps stack towering high
    liftFrequency: 6000, // Frequent offensive fast lifts
    liftDuration: 1200,
    burstSteps: 1,
    burstCooldown: 0,
    panicSpeedup: 1.4
  },
  mocha: {
    id: 'mocha',
    name: 'Mocha',
    title: 'Indecisive Alchemist',
    description: 'Switches tiles at lightning speed, but frequently changes her mind mid-route like mixing chaotic potions!',
    baseInterval: 90, // Fast switcher!
    indecisiveness: 0.42, // Highly indecisive! Frequently re-routes mid-move
    jitterChance: 0.38, // Randomly stirs and swaps panels
    comboBias: 1.35,
    garbageBias: 1.2,
    chainBias: 1.5,
    liftThreshold: 6,
    liftFrequency: 12000,
    liftDuration: 800,
    burstSteps: 2,
    burstCooldown: 120,
    panicSpeedup: 1.35
  },
  ember: {
    id: 'ember',
    name: 'Ember',
    title: 'Fireworks Fanatic',
    description: 'Refuses to settle for simple 3-matches! Obsessively sets up massive 4+ and 5-in-a-row fireworks.',
    baseInterval: 130,
    indecisiveness: 0.06,
    jitterChance: 0.08,
    comboBias: 3.2, // Extreme focus on 4+ and 5+ combos and cross clears
    garbageBias: 1.3,
    chainBias: 1.1,
    liftThreshold: 5,
    liftFrequency: 9000,
    liftDuration: 1000,
    burstSteps: 1,
    burstCooldown: 0,
    panicSpeedup: 1.2
  },
  volt: {
    id: 'volt',
    name: 'Volt',
    title: 'Twitchy Glitch Genius',
    description: 'Moves in rapid 4-step bursts then freezes to recalculate. Circuits overdrive into hyper-speed when in danger.',
    baseInterval: 55, // Hyper-fast during burst
    indecisiveness: 0.18,
    jitterChance: 0.24,
    comboBias: 1.3,
    garbageBias: 1.5,
    chainBias: 1.4,
    liftThreshold: 6,
    liftFrequency: 11000,
    liftDuration: 700,
    burstSteps: 4, // Moves 4 steps in a flash!
    burstCooldown: 360, // Then pauses to recalculate
    panicSpeedup: 1.75 // Overclocked speed in danger!
  },
  salty: {
    id: 'salty',
    name: 'Salty',
    title: 'Relentless Raider',
    description: 'Aggressive buccaneer. Sends heavy slabs and goes full pirate raid when he sees you in danger!',
    baseInterval: 110,
    indecisiveness: 0.05,
    jitterChance: 0.06,
    comboBias: 1.6,
    garbageBias: 1.4,
    chainBias: 1.3,
    liftThreshold: 5,
    liftFrequency: 7500,
    liftDuration: 1100,
    burstSteps: 1,
    burstCooldown: 0,
    panicSpeedup: 1.25
  },
  poppy: {
    id: 'poppy',
    name: 'Poppy',
    title: 'Rhythm Idol',
    description: 'Dances across the board with rhythmic flair, orchestrating cascading multi-tier chain performances.',
    baseInterval: 125,
    indecisiveness: 0.15,
    jitterChance: 0.16,
    comboBias: 1.4,
    garbageBias: 1.3,
    chainBias: 2.5, // High idol cascade focus
    liftThreshold: 6,
    liftFrequency: 13000,
    liftDuration: 900,
    burstSteps: 2,
    burstCooldown: 110,
    panicSpeedup: 1.3
  }
};

interface Move {
  x: number;
  y: number;
  score: number;
}

export default class AIBot {
  public board: Board;
  public cursor: Cursor;
  public difficulty: AIDifficulty;
  public personality: AIPersonality;
  public opponentBoard?: Board;

  private actionTimer: number = 0;
  private actionInterval: number = 170; // Computed ms per step
  private targetMove: Move | null = null;
  private attackTimer: number = 0;
  private currentBurstCount: number = 0;
  private isBurstCooling: boolean = false;
  private burstCooldownTimer: number = 0;

  constructor(
    board: Board,
    cursor: Cursor,
    difficulty: AIDifficulty = AIDifficulty.NORMAL,
    characterId: string = 'mizu',
    opponentBoard?: Board
  ) {
    this.board = board;
    this.cursor = cursor;
    this.difficulty = difficulty;
    this.opponentBoard = opponentBoard;

    this.personality = AI_PERSONALITIES[characterId] || AI_PERSONALITIES['mizu'];
    this.recomputeActionInterval();
  }

  private recomputeActionInterval(): void {
    let interval = this.personality.baseInterval;

    switch (this.difficulty) {
      case AIDifficulty.EASY:
        interval *= 1.45;
        break;
      case AIDifficulty.NORMAL:
        interval *= 1.0;
        break;
      case AIDifficulty.HARD:
        interval *= 0.72;
        break;
    }

    if (this.board.isDanger) {
      interval /= this.personality.panicSpeedup;
    }

    this.actionInterval = Math.max(35, interval);
  }

  public update(delta: number): void {
    if (this.board.isTopOut) return;

    this.recomputeActionInterval();

    // Handle Volt/Poppy/Mocha burst cooldown pause
    if (this.isBurstCooling) {
      this.burstCooldownTimer -= delta;
      if (this.burstCooldownTimer <= 0) {
        this.isBurstCooling = false;
        this.currentBurstCount = 0;
      }
      return;
    }

    this.actionTimer += delta;
    if (this.actionTimer >= this.actionInterval) {
      this.actionTimer = 0;
      this.step();

      if (this.personality.burstSteps > 1) {
        this.currentBurstCount++;
        if (this.currentBurstCount >= this.personality.burstSteps) {
          this.isBurstCooling = true;
          this.burstCooldownTimer = this.personality.burstCooldown;
        }
      }
    }

    // Offensive lift timer based on personality
    this.updateOffensiveLift(delta);
  }

  private updateOffensiveLift(delta: number): void {
    let freq = this.personality.liftFrequency;

    // Salty's opportunism: If opponent is in danger, surge attacks!
    if (this.personality.id === 'salty' && this.opponentBoard?.isDanger) {
      freq *= 0.45;
    }

    this.attackTimer += delta;
    if (this.attackTimer >= freq) {
      this.attackTimer = 0;
      if (!this.board.isDanger && !this.board.isTopOut) {
        this.board.setLifting(true);
        setTimeout(() => {
          if (!this.board.isDanger) {
            this.board.setLifting(false);
          }
        }, this.personality.liftDuration);
      }
    }
  }

  private step(): void {
    // 1. Stack Management
    if (this.board.isDanger) {
      this.board.setLifting(false);
    } else {
      let highestPanelRow = BOARD_VISIBLE_HEIGHT;
      for (let r = 0; r < BOARD_VISIBLE_HEIGHT; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) {
          if (this.board.getPanelAt(c, r) !== null) {
            highestPanelRow = Math.min(highestPanelRow, r);
            break;
          }
        }
      }

      if (highestPanelRow > this.personality.liftThreshold && !this.board.isChainActive) {
        this.board.setLifting(true);
      } else {
        this.board.setLifting(false);
      }
    }

    // 2. Indecisiveness mechanic: Chance to abandon current target and change mind
    if (this.targetMove && Math.random() < this.personality.indecisiveness) {
      this.targetMove = null; // Changed mind!
    }

    // 3. Find or update target move
    if (!this.targetMove || !this.isMoveStillValid(this.targetMove)) {
      this.targetMove = this.findBestMove();
    }

    // 4. Move cursor towards target
    if (this.targetMove) {
      if (this.cursor.gridX < this.targetMove.x) {
        this.cursor.moveRight();
      } else if (this.cursor.gridX > this.targetMove.x) {
        this.cursor.moveLeft();
      } else if (this.cursor.gridY < this.targetMove.y) {
        this.cursor.moveDown();
      } else if (this.cursor.gridY > this.targetMove.y) {
        this.cursor.moveUp();
      } else {
        // Arrived at target: execute swap!
        this.board.swap(this.targetMove.x, this.targetMove.y);
        this.targetMove = null;
      }
    } else {
      // Idle wander / jitter based on personality
      if (Math.random() < this.personality.jitterChance) {
        const rand = Math.random();
        if (rand < 0.35) this.cursor.moveLeft();
        else if (rand < 0.70) this.cursor.moveRight();
        else if (rand < 0.85) this.cursor.moveUp();
        else this.cursor.moveDown();

        // Mocha / Volt jitter swap: occasionally swap randomly while wandering
        if (Math.random() < this.personality.jitterChance * 0.6) {
          this.board.swap(this.cursor.gridX, this.cursor.gridY);
        }
      }
    }
  }

  private isMoveStillValid(move: Move): boolean {
    const left = this.board.getPanelAt(move.x, move.y);
    const right = this.board.getPanelAt(move.x + 1, move.y);
    return (left !== null || right !== null) && !this.board.isCellOccupiedByGarbage(move.x, move.y);
  }

  private findBestMove(): Move | null {
    let bestMove: Move | null = null;
    let highestScore = -Infinity;

    for (let y = BOARD_VISIBLE_HEIGHT - 1; y >= 0; y--) {
      for (let x = 0; x < BOARD_WIDTH - 1; x++) {
        if (this.board.isCellOccupiedByGarbage(x, y) || this.board.isCellOccupiedByGarbage(x + 1, y)) {
          continue;
        }

        const left = this.board.getPanelAt(x, y);
        const right = this.board.getPanelAt(x + 1, y);

        if (!left && !right) continue;
        if (left && right && left.color === right.color) continue; // Same color swap is useless

        const score = this.evaluateSwap(x, y, left?.color ?? -1, right?.color ?? -1);
        if (score > highestScore) {
          highestScore = score;
          bestMove = { x, y, score };
        }
      }
    }

    return highestScore > 0 ? bestMove : null;
  }

  /** Evaluate score for swapping (x, y) with (x+1, y) incorporating character personality biases */
  private evaluateSwap(x: number, y: number, leftColor: number, rightColor: number): number {
    let score = 0;

    // Simulate placing rightColor at (x, y) and leftColor at (x+1, y)
    if (rightColor !== -1) {
      const matchCount = this.countSimulatedMatches(x, y, rightColor);
      if (matchCount >= 3) {
        score += matchCount * 120 + y * 10;
        if (matchCount >= 4) {
          // Weighted by personality comboBias (Ember, Riff, etc.)
          const comboBase = 700 + (matchCount - 4) * 450;
          score += comboBase * this.personality.comboBias;
        }
      }
    }

    if (leftColor !== -1) {
      const matchCount = this.countSimulatedMatches(x + 1, y, leftColor);
      if (matchCount >= 3) {
        score += matchCount * 120 + y * 10;
        if (matchCount >= 4) {
          const comboBase = 700 + (matchCount - 4) * 450;
          score += comboBase * this.personality.comboBias;
        }
      }
    }

    // Prioritize clearing near resting garbage blocks (Weighted by personality garbageBias: Kiri, Salty)
    if (score > 0) {
      const touchesGarbage =
        (y > 0 && (this.board.isCellOccupiedByGarbage(x, y - 1) || this.board.isCellOccupiedByGarbage(x + 1, y - 1))) ||
        (y < BOARD_VISIBLE_HEIGHT - 1 && (this.board.isCellOccupiedByGarbage(x, y + 1) || this.board.isCellOccupiedByGarbage(x + 1, y + 1))) ||
        (x > 0 && this.board.isCellOccupiedByGarbage(x - 1, y)) ||
        (x + 2 < BOARD_WIDTH && this.board.isCellOccupiedByGarbage(x + 2, y));

      if (touchesGarbage) {
        score += 850 * this.personality.garbageBias;
      }
    }

    // Cascade / Chain Potential evaluation (Weighted by personality chainBias: Mizu, Poppy)
    if (score > 0 && y > 1) {
      // Check if panels above will drop and create a secondary match
      const aboveLeft = this.board.getPanelAt(x, y - 1);
      const aboveRight = this.board.getPanelAt(x + 1, y - 1);
      if (aboveLeft || aboveRight) {
        score += 350 * this.personality.chainBias;
      }
    }

    return score;
  }

  private countSimulatedMatches(targetX: number, targetY: number, color: number): number {
    let horizontal = 1;
    let nx = targetX - 1;
    while (nx >= 0) {
      const p = this.board.getPanelAt(nx, targetY);
      if (p && p.color === color) {
        horizontal++;
        nx--;
      } else break;
    }
    nx = targetX + 1;
    while (nx < BOARD_WIDTH) {
      const p = this.board.getPanelAt(nx, targetY);
      if (p && p.color === color) {
        horizontal++;
        nx++;
      } else break;
    }

    let vertical = 1;
    let ny = targetY - 1;
    while (ny >= 0) {
      const p = this.board.getPanelAt(targetX, ny);
      if (p && p.color === color) {
        vertical++;
        ny--;
      } else break;
    }
    ny = targetY + 1;
    while (ny < BOARD_VISIBLE_HEIGHT) {
      const p = this.board.getPanelAt(targetX, ny);
      if (p && p.color === color) {
        vertical++;
        ny++;
      } else break;
    }

    let maxMatch = 0;
    if (horizontal >= 3) maxMatch += horizontal;
    if (vertical >= 3) maxMatch += vertical;
    return maxMatch;
  }
}
