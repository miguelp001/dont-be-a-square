import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface LeaderboardEntry {
  id: string;
  playerId: string;
  displayName: string;
  characterId: string;
  mode: 'endless' | 'challenge';
  difficulty: string;
  score: number; // High score in points for both Endless and Challenge
  maxChain: number;
  submittedAt: string;
}

export interface SubmitScorePayload {
  playerId: string;
  playerSecret: string;
  displayName: string;
  characterId: string;
  mode: 'endless' | 'challenge';
  difficulty: string;
  score: number;
  maxChain?: number;
}

export interface LeaderboardResponse {
  mode: string;
  difficulty: string;
  top: (LeaderboardEntry & { rank: number })[];
  playerRank?: {
    rank: number;
    entry: LeaderboardEntry;
  };
  totalCount: number;
}

interface StoredData {
  entries: LeaderboardEntry[];
  playerSecrets: Record<string, string>; // playerId -> SHA-256 hash
}

const DEFAULT_RIVALS: Omit<LeaderboardEntry, 'id' | 'submittedAt'>[] = [];

export class LeaderboardManager {
  private filePath: string;
  private entries: LeaderboardEntry[] = [];
  private playerSecrets: Record<string, string> = {};
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath;
    } else {
      const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
      this.filePath = path.join(dataDir, 'leaderboards.json');
    }
    this.loadFromDisk();
  }

  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret || '').digest('hex');
  }

  private sanitizeName(raw: string): string {
    if (!raw) return 'PLAYER';
    // Allow uppercase letters, numbers, underscore, space, dash (2 to 10 chars)
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9_\-]/g, '').trim();
    if (cleaned.length < 2) return 'PLAYER';
    return cleaned.slice(0, 10);
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed: StoredData = JSON.parse(raw);
        if (Array.isArray(parsed?.entries)) {
          this.entries = parsed.entries;
          this.playerSecrets = parsed.playerSecrets || {};
          console.log(`Loaded ${this.entries.length} leaderboard records from ${this.filePath}`);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to read leaderboard file, initializing fresh:', err);
    }

    this.entries = [];
    this.playerSecrets = {};
    this.saveToDiskSync();
  }

  public clearAll(): void {
    this.entries = [];
    this.playerSecrets = {};
    this.saveToDiskSync();
  }

  public saveToDiskSync(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const tmpPath = `${this.filePath}.tmp.${Date.now()}`;
      const data: StoredData = {
        entries: this.entries,
        playerSecrets: this.playerSecrets
      };

      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.error('Failed to save leaderboards to disk:', err);
    }
  }

  private queueSave(): void {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveToDiskSync();
    }, 1000);
  }

  public submitScore(payload: SubmitScorePayload): {
    success: boolean;
    error?: string;
    isNewBest: boolean;
    rank: number;
    entry?: LeaderboardEntry;
  } {
    const { playerId, playerSecret, characterId, mode, difficulty, score, maxChain } = payload;

    if (!playerId || typeof playerId !== 'string' || playerId.length > 64) {
      return { success: false, error: 'Invalid playerId', isNewBest: false, rank: -1 };
    }
    if (!playerSecret || typeof playerSecret !== 'string' || playerSecret.length > 64) {
      return { success: false, error: 'Invalid playerSecret', isNewBest: false, rank: -1 };
    }
    if (mode !== 'endless' && mode !== 'challenge') {
      return { success: false, error: 'Invalid mode', isNewBest: false, rank: -1 };
    }
    if (typeof score !== 'number' || isNaN(score) || score <= 0) {
      return { success: false, error: 'Invalid score', isNewBest: false, rank: -1 };
    }

    // Plausibility limits (both endless and challenge mode high score points)
    if (score > 50000000) {
      return { success: false, error: 'Score exceeds maximum threshold', isNewBest: false, rank: -1 };
    }

    // Authenticate playerSecret
    const secretHash = this.hashSecret(playerSecret);
    const existingSecret = this.playerSecrets[playerId];
    if (existingSecret && existingSecret !== secretHash) {
      return { success: false, error: 'Authentication failed for playerId', isNewBest: false, rank: -1 };
    }
    if (!existingSecret) {
      this.playerSecrets[playerId] = secretHash;
    }

    const cleanName = this.sanitizeName(payload.displayName);
    const cleanDiff = (difficulty || 'adept').toLowerCase();
    const cleanChar = characterId || 'kiri';
    const chain = Math.max(1, Math.min(99, Number(maxChain) || 1));

    // Find existing entry for this player in this mode & difficulty
    const existingIndex = this.entries.findIndex(
      (e) => e.playerId === playerId && e.mode === mode && e.difficulty === cleanDiff
    );

    let isNewBest = false;
    let targetEntry: LeaderboardEntry;

    if (existingIndex >= 0) {
      const existing = this.entries[existingIndex];
      // For both endless and challenge, higher score is better
      const isImprovement = score > existing.score;

      if (isImprovement) {
        isNewBest = true;
        existing.score = score;
        existing.maxChain = Math.max(existing.maxChain, chain);
        existing.characterId = cleanChar;
        existing.displayName = cleanName;
        existing.submittedAt = new Date().toISOString();
        this.queueSave();
      } else {
        // Even if not a better score, update display name if edited
        if (existing.displayName !== cleanName) {
          existing.displayName = cleanName;
          this.queueSave();
        }
      }
      targetEntry = existing;
    } else {
      isNewBest = true;
      targetEntry = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        playerId,
        displayName: cleanName,
        characterId: cleanChar,
        mode,
        difficulty: cleanDiff,
        score,
        maxChain: chain,
        submittedAt: new Date().toISOString()
      };
      this.entries.push(targetEntry);
      this.queueSave();
    }

    // Compute player's rank in this category
    const rankedList = this.getSortedEntries(mode, cleanDiff);
    const rank = rankedList.findIndex((e) => e.playerId === playerId) + 1;

    return {
      success: true,
      isNewBest,
      rank,
      entry: targetEntry
    };
  }

  public updatePlayerName(
    playerId: string,
    playerSecret: string,
    newDisplayName: string
  ): { success: boolean; error?: string; displayName?: string; updatedCount?: number } {
    if (!playerId || typeof playerId !== 'string' || playerId.length > 64) {
      return { success: false, error: 'Invalid playerId' };
    }
    if (!playerSecret || typeof playerSecret !== 'string' || playerSecret.length > 64) {
      return { success: false, error: 'Invalid playerSecret' };
    }

    const secretHash = this.hashSecret(playerSecret);
    const existingSecret = this.playerSecrets[playerId];
    if (existingSecret && existingSecret !== secretHash) {
      return { success: false, error: 'Authentication failed for playerId' };
    }
    if (!existingSecret) {
      this.playerSecrets[playerId] = secretHash;
    }

    const cleanName = this.sanitizeName(newDisplayName);
    let updatedCount = 0;
    for (const entry of this.entries) {
      if (entry.playerId === playerId) {
        entry.displayName = cleanName;
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      this.queueSave();
    }

    return { success: true, displayName: cleanName, updatedCount };
  }

  private getSortedEntries(mode: string, difficulty: string): LeaderboardEntry[] {
    const cleanDiff = difficulty.toLowerCase();
    const filtered = this.entries.filter(
      (e) => e.mode === mode && e.difficulty.toLowerCase() === cleanDiff
    );

    filtered.sort((a, b) => {
      // Descending points (highest score first)
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    });

    return filtered;
  }

  public getLeaderboard(
    mode: string,
    difficulty: string,
    playerId?: string,
    limit: number = 20
  ): LeaderboardResponse {
    const sorted = this.getSortedEntries(mode, difficulty);
    const top = sorted.slice(0, Math.max(1, Math.min(100, limit))).map((entry, idx) => ({
      ...entry,
      rank: idx + 1
    }));

    let playerRank: { rank: number; entry: LeaderboardEntry } | undefined = undefined;
    if (playerId) {
      const pIdx = sorted.findIndex((e) => e.playerId === playerId);
      if (pIdx >= 0) {
        playerRank = {
          rank: pIdx + 1,
          entry: sorted[pIdx]
        };
      }
    }

    return {
      mode,
      difficulty: difficulty.toLowerCase(),
      top,
      playerRank,
      totalCount: sorted.length
    };
  }
}
