import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LeaderboardManager } from '../server/leaderboard';

const TEST_DB_PATH = path.join(process.cwd(), 'tests', 'test_leaderboards.json');

describe('Server-Side Accountless Leaderboard System', () => {
  let mgr: LeaderboardManager;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    mgr = new LeaderboardManager(TEST_DB_PATH);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it('1. Initializes with default baseline rival records', () => {
    const endlessAdept = mgr.getLeaderboard('endless', 'adept');
    expect(endlessAdept.top.length).toBeGreaterThan(0);
    expect(endlessAdept.top[0].mode).toBe('endless');
    expect(endlessAdept.top[0].difficulty).toBe('adept');
  });

  it('2. Submits Endless score and ranks in descending order', () => {
    const res1 = mgr.submitScore({
      playerId: 'player_123',
      playerSecret: 'secret_abc',
      displayName: 'ACE',
      characterId: 'void_slime',
      mode: 'endless',
      difficulty: 'master',
      score: 150000,
      maxChain: 12
    });

    expect(res1.success).toBe(true);
    expect(res1.isNewBest).toBe(true);
    expect(res1.rank).toBe(1);

    const board = mgr.getLeaderboard('endless', 'master', 'player_123');
    expect(board.top[0].playerId).toBe('player_123');
    expect(board.top[0].displayName).toBe('ACE');
    expect(board.top[0].score).toBe(150000);
    expect(board.playerRank?.rank).toBe(1);
  });

  it('3. Updates existing player score without duplicate rows', () => {
    mgr.submitScore({
      playerId: 'player_dup',
      playerSecret: 'secret_dup',
      displayName: 'POP',
      characterId: 'poppy',
      mode: 'endless',
      difficulty: 'adept',
      score: 40000
    });

    // Submit higher score
    const res2 = mgr.submitScore({
      playerId: 'player_dup',
      playerSecret: 'secret_dup',
      displayName: 'POPPER',
      characterId: 'poppy',
      mode: 'endless',
      difficulty: 'adept',
      score: 75000
    });

    expect(res2.success).toBe(true);
    expect(res2.isNewBest).toBe(true);

    const board = mgr.getLeaderboard('endless', 'adept');
    const playerEntries = board.top.filter((e) => e.playerId === 'player_dup');
    expect(playerEntries.length).toBe(1); // Exactly 1 row!
    expect(playerEntries[0].score).toBe(75000);
    expect(playerEntries[0].displayName).toBe('POPPER');

    // Submit lower score (should not overwrite)
    const res3 = mgr.submitScore({
      playerId: 'player_dup',
      playerSecret: 'secret_dup',
      displayName: 'POPPER',
      characterId: 'poppy',
      mode: 'endless',
      difficulty: 'adept',
      score: 50000
    });

    expect(res3.success).toBe(true);
    expect(res3.isNewBest).toBe(false);
    expect(playerEntries[0].score).toBe(75000);
  });

  it('4. Orders Challenge Speedrun scores in ascending order (fastest time wins)', () => {
    mgr.submitScore({
      playerId: 'runner_1',
      playerSecret: 'sec_1',
      displayName: 'FAST',
      characterId: 'volt',
      mode: 'challenge',
      difficulty: 'grandmaster',
      score: 140 // 140 seconds
    });

    mgr.submitScore({
      playerId: 'runner_2',
      playerSecret: 'sec_2',
      displayName: 'FLASH',
      characterId: 'nano_banana',
      mode: 'challenge',
      difficulty: 'grandmaster',
      score: 95 // 95 seconds (faster!)
    });

    const board = mgr.getLeaderboard('challenge', 'grandmaster');
    expect(board.top[0].playerId).toBe('runner_2'); // 95s is rank 1 (faster than seed bot_nano at 135s)
    expect(board.top[0].score).toBe(95);
    expect(board.top[1].playerId).toBe('bot_nano'); // 135s baseline rival is rank 2
    expect(board.top[2].playerId).toBe('runner_1'); // 140s is rank 3
  });

  it('5. Protects player records with secret token verification', () => {
    // First submission registers secret
    mgr.submitScore({
      playerId: 'victim_user',
      playerSecret: 'correct_secret',
      displayName: 'REAL',
      characterId: 'kiri',
      mode: 'endless',
      difficulty: 'novice',
      score: 60000
    });

    // Impersonator with wrong secret is rejected
    const hacked = mgr.submitScore({
      playerId: 'victim_user',
      playerSecret: 'wrong_secret',
      displayName: 'HACKER',
      characterId: 'kiri',
      mode: 'endless',
      difficulty: 'novice',
      score: 999999
    });

    expect(hacked.success).toBe(false);
    expect(hacked.error).toContain('Authentication failed');

    // Legitimate update with correct secret works
    const legit = mgr.submitScore({
      playerId: 'victim_user',
      playerSecret: 'correct_secret',
      displayName: 'REAL',
      characterId: 'kiri',
      mode: 'endless',
      difficulty: 'novice',
      score: 70000
    });

    expect(legit.success).toBe(true);
  });
});
