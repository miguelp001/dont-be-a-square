import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LeaderboardManager } from '../server/leaderboard';
import { LeaderboardClient } from '../src/utils/LeaderboardClient';

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

  it('1. Initializes cleanly with empty records', () => {
    const endlessAdept = mgr.getLeaderboard('endless', 'adept');
    expect(endlessAdept.top.length).toBe(0);
    expect(endlessAdept.totalCount).toBe(0);
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

  it('4. Orders Challenge High Scores in descending order (highest points wins)', () => {
    mgr.submitScore({
      playerId: 'runner_1',
      playerSecret: 'sec_1',
      displayName: 'CHAMP1',
      characterId: 'volt',
      mode: 'challenge',
      difficulty: 'grandmaster',
      score: 140000
    });

    mgr.submitScore({
      playerId: 'runner_2',
      playerSecret: 'sec_2',
      displayName: 'CHAMP2',
      characterId: 'nano_banana',
      mode: 'challenge',
      difficulty: 'grandmaster',
      score: 195000 // 195,000 points (higher!)
    });

    const board = mgr.getLeaderboard('challenge', 'grandmaster');
    expect(board.top[0].playerId).toBe('runner_2'); // 195,000 is rank 1
    expect(board.top[0].score).toBe(195000);
    expect(board.top[1].playerId).toBe('runner_1'); // 140,000 is rank 2
    expect(board.top[1].score).toBe(140000);
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

  it('6. Updates player display name across all leaderboard categories', () => {
    // Submit scores in two different modes/difficulties
    mgr.submitScore({
      playerId: 'player_namechange',
      playerSecret: 'super_secret_123',
      displayName: 'OLD_NAME',
      characterId: 'kiri',
      mode: 'endless',
      difficulty: 'adept',
      score: 50000
    });

    mgr.submitScore({
      playerId: 'player_namechange',
      playerSecret: 'super_secret_123',
      displayName: 'OLD_NAME',
      characterId: 'mizu',
      mode: 'challenge',
      difficulty: 'expert',
      score: 80000
    });

    // Attempt to update with wrong secret
    const failUpdate = mgr.updatePlayerName('player_namechange', 'wrong_secret', 'NEW_NAME');
    expect(failUpdate.success).toBe(false);
    expect(failUpdate.error).toContain('Authentication failed');

    // Update with correct secret
    const okUpdate = mgr.updatePlayerName('player_namechange', 'super_secret_123', 'NEW_NAME');
    expect(okUpdate.success).toBe(true);
    expect(okUpdate.displayName).toBe('NEW_NAME');
    expect(okUpdate.updatedCount).toBe(2);

    // Verify name changed in both boards
    const endlessBoard = mgr.getLeaderboard('endless', 'adept');
    const endlessRow = endlessBoard.top.find((e) => e.playerId === 'player_namechange');
    expect(endlessRow?.displayName).toBe('NEW_NAME');

    const challengeBoard = mgr.getLeaderboard('challenge', 'expert');
    const challengeRow = challengeBoard.top.find((e) => e.playerId === 'player_namechange');
    expect(challengeRow?.displayName).toBe('NEW_NAME');
  });

  it('7. Sanitizes player display names when updating', () => {
    // Register player
    mgr.submitScore({
      playerId: 'player_sanitize',
      playerSecret: 'san_sec',
      displayName: 'INITIAL',
      characterId: 'kiri',
      mode: 'endless',
      difficulty: 'novice',
      score: 10000
    });

    // Update with extra spaces and symbols - symbols like @#$% stripped, limited to 10 chars
    const res = mgr.updatePlayerName('player_sanitize', 'san_sec', '  Super_Pro!  ');
    expect(res.success).toBe(true);
    // 'SUPER_PRO' after stripping '!', trimming, and uppercase conversion
    expect(res.displayName).toBe('SUPER_PRO');

    const board = mgr.getLeaderboard('endless', 'novice');
    expect(board.top[0].displayName).toBe('SUPER_PRO');
  });

  it('8. LeaderboardClient sanitizes and sets display name for Options Menu & UI', () => {
    const sanitized1 = LeaderboardClient.setDisplayName('cool_pilot_99');
    expect(sanitized1).toBe('COOL_PILOT'); // uppercase, max 10 chars
    expect(LeaderboardClient.getDisplayName()).toBe('COOL_PILOT');

    // Invalid characters stripped
    const sanitized2 = LeaderboardClient.setDisplayName('A!@#$%^B');
    expect(sanitized2).toBe('AB');
    expect(LeaderboardClient.getDisplayName()).toBe('AB');

    // Too short (less than 2 chars) defaults safely to PLAYER
    const sanitized3 = LeaderboardClient.setDisplayName('X');
    expect(sanitized3).toBe('PLAYER');
    expect(LeaderboardClient.getDisplayName()).toBe('PLAYER');
  });

  it('9. Rejects null, undefined, and non-object payloads safely without exceptions', () => {
    expect(() => mgr.submitScore(null as any)).not.toThrow();
    expect(mgr.submitScore(null as any).success).toBe(false);

    expect(() => mgr.submitScore(undefined as any)).not.toThrow();
    expect(mgr.submitScore(undefined as any).success).toBe(false);

    expect(() => mgr.submitScore('malicious_string' as any)).not.toThrow();
    expect(mgr.submitScore('malicious_string' as any).success).toBe(false);
  });
});
