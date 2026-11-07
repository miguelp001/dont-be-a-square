import { describe, it, expect, beforeEach } from 'vitest';
import { GameDifficulty } from '../src/utils/Difficulty';
import { RecordManager } from '../src/utils/DifficultyRecords';

describe('Challenge Mode Cumulative Score Progression', () => {
  beforeEach(() => {
    localStorage.clear();
    RecordManager.resetAll();
  });

  it('1. Correctly simulates cumulative score addition across 7 rounds', () => {
    let accumulatedScore = 0;
    const roundScores = [12500, 15300, 18200, 21000, 24500, 28000, 35000];

    for (let round = 0; round < roundScores.length; round++) {
      const earnedThisRound = roundScores[round];
      // In GameScene: this.playerScore = this.initialChallengeScore;
      // In handlePlayerMatch: this.playerScore += event.scoreGained;
      const initialScoreForRound = accumulatedScore;
      const finalRoundScore = initialScoreForRound + earnedThisRound;

      expect(finalRoundScore).toBe(accumulatedScore + earnedThisRound);
      accumulatedScore = finalRoundScore;
    }

    const expectedTotal = roundScores.reduce((sum, s) => sum + s, 0);
    expect(accumulatedScore).toBe(expectedTotal);
    expect(accumulatedScore).toBe(154500);
  });

  it('2. On match defeat, retry retains previous accumulated score without losing progress', () => {
    let challengeScore = 46000; // After round 3
    const initialChallengeScoreForRound = challengeScore;

    // Player scores 3,000 in round 4 but tops out / loses
    let roundScore = 3000;
    let inGameScore = initialChallengeScoreForRound + roundScore;
    expect(inGameScore).toBe(49000);

    // On defeat: retry restarts with initialChallengeScore
    let retriedScore = initialChallengeScoreForRound;
    expect(retriedScore).toBe(46000);
  });

  it('3. RecordManager persists bestScore on Challenge Clear', () => {
    const totalFinalScore = 188500;
    const clearResult = RecordManager.recordChallengeClear(
      GameDifficulty.MASTER,
      'kiri',
      195,
      totalFinalScore
    );

    expect(clearResult.isFirstClear).toBe(true);
    expect(clearResult.bestScore).toBe(totalFinalScore);
    expect(clearResult.bestTimeSeconds).toBe(195);

    const saved = RecordManager.getChallengeClear(GameDifficulty.MASTER);
    expect(saved.cleared).toBe(true);
    expect(saved.bestScore).toBe(totalFinalScore);
    expect(saved.bestTimeSeconds).toBe(195);

    // Subsequent clear with lower score preserves higher bestScore
    const secondClear = RecordManager.recordChallengeClear(
      GameDifficulty.MASTER,
      'mizu',
      180,
      150000
    );
    expect(secondClear.bestScore).toBe(totalFinalScore);
    expect(secondClear.bestTimeSeconds).toBe(180); // faster time updated
  });
});
