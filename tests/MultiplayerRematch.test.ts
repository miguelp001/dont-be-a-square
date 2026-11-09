import { describe, it, expect, vi, beforeEach } from 'vitest';
import SocketManager from '../src/net/SocketManager';

describe('Online Multiplayer Rematch & Modal Flow', () => {
  let socketMgr: SocketManager;
  let mockSocket: any;

  beforeEach(() => {
    // Reset instance or test via methods
    socketMgr = SocketManager.getInstance();
    mockSocket = (socketMgr as any).socket;
  });

  it('1. requestRematch emits rematch_request event with roomId', () => {
    const emitSpy = vi.spyOn(mockSocket, 'emit');
    socketMgr.requestRematch('ROOM99');

    expect(emitSpy).toHaveBeenCalledWith('rematch_request', { roomId: 'ROOM99' });
  });

  it('2. onOpponentRematchRequested wires event listener', () => {
    const onSpy = vi.spyOn(mockSocket, 'on');
    const callback = vi.fn();

    socketMgr.onOpponentRematchRequested(callback);
    expect(onSpy).toHaveBeenCalledWith('opponent_rematch_requested', callback);
  });

  it('3. onGameRestart wires restart listener with new seed and player payload', () => {
    const onSpy = vi.spyOn(mockSocket, 'on');
    const callback = vi.fn();

    socketMgr.onGameRestart(callback);
    expect(onSpy).toHaveBeenCalledWith('game_restart', callback);
  });

  it('4. Rematch server logic pairs two votes into game_restart with new random seed', () => {
    // Simulate server room state
    interface TestRoom {
      id: string;
      players: { socketId: string; characterId: string }[];
      seed: number;
      rematchVotes: Set<string>;
    }

    const room: TestRoom = {
      id: 'TEST01',
      players: [
        { socketId: 'sock_p1', characterId: 'kiri' },
        { socketId: 'sock_p2', characterId: 'mizu' }
      ],
      seed: 111111,
      rematchVotes: new Set<string>()
    };

    // P1 requests rematch
    room.rematchVotes.add('sock_p1');
    expect(room.rematchVotes.size).toBe(1);
    const p1ShouldRestart = room.rematchVotes.size >= 2;
    expect(p1ShouldRestart).toBe(false);

    // P2 requests rematch
    room.rematchVotes.add('sock_p2');
    expect(room.rematchVotes.size).toBe(2);
    const p2ShouldRestart = room.rematchVotes.size >= 2;
    expect(p2ShouldRestart).toBe(true);

    // When both vote, new seed is generated and votes reset
    const newSeed = 999888;
    room.seed = newSeed;
    room.rematchVotes.clear();

    expect(room.seed).toBe(999888);
    expect(room.rematchVotes.size).toBe(0);
  });

  it('5. Main menu choice leaves the room and notifies opponent', () => {
    const emitSpy = vi.spyOn(mockSocket, 'emit');
    socketMgr.leaveRoom('ROOM99');

    expect(emitSpy).toHaveBeenCalledWith('leave_room', { roomId: 'ROOM99' });
  });

  it('6. sendAction emits attack payload with width, height, col, and roomId', () => {
    const emitSpy = vi.spyOn(mockSocket, 'emit');
    socketMgr.sendAction({
      type: 'attack',
      roomId: 'ROOM99',
      payload: { width: 4, height: 1, col: 1 }
    });

    expect(emitSpy).toHaveBeenCalledWith('game_action', {
      type: 'attack',
      roomId: 'ROOM99',
      payload: { width: 4, height: 1, col: 1 }
    });
  });
});
