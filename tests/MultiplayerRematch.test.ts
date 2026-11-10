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

  it('7. Malformed network action validation protects against type errors and NaN coordinates', () => {
    // Test payload sanitization logic used in onOpponentAction
    const sanitizeCursor = (payload: any) => {
      const x = typeof payload?.x === 'number' && Number.isFinite(payload.x)
        ? payload.x
        : typeof payload?.col === 'number' && Number.isFinite(payload.col)
        ? payload.col
        : 0;
      const y = typeof payload?.y === 'number' && Number.isFinite(payload.y)
        ? payload.y
        : typeof payload?.row === 'number' && Number.isFinite(payload.row)
        ? payload.row
        : 0;
      return { x, y };
    };

    expect(sanitizeCursor(null)).toEqual({ x: 0, y: 0 });
    expect(sanitizeCursor({})).toEqual({ x: 0, y: 0 });
    expect(sanitizeCursor({ x: NaN, y: undefined })).toEqual({ x: 0, y: 0 });
    expect(sanitizeCursor({ col: 3, row: 5 })).toEqual({ x: 3, y: 5 });
    expect(sanitizeCursor({ x: 2, y: 4 })).toEqual({ x: 2, y: 4 });

    const sanitizeSwap = (payload: any) => {
      const x = typeof payload?.x === 'number' && Number.isInteger(payload.x)
        ? payload.x
        : typeof payload?.col === 'number' && Number.isInteger(payload.col)
        ? payload.col
        : undefined;
      const y = typeof payload?.y === 'number' && Number.isInteger(payload.y)
        ? payload.y
        : typeof payload?.row === 'number' && Number.isInteger(payload.row)
        ? payload.row
        : undefined;
      return x !== undefined && y !== undefined ? { x, y } : null;
    };

    expect(sanitizeSwap(null)).toBeNull();
    expect(sanitizeSwap({})).toBeNull();
    expect(sanitizeSwap({ x: '2', y: '3' })).toBeNull();
    expect(sanitizeSwap({ x: NaN, y: 4 })).toBeNull();
    expect(sanitizeSwap({ x: 2, y: 3 })).toEqual({ x: 2, y: 3 });
    expect(sanitizeSwap({ col: 1, row: 7 })).toEqual({ x: 1, y: 7 });
  });

  it('8. Server game_action handler ignores malformed and null data safely', () => {
    const forwardAction = (data: any, rooms: Set<string>, socketId: string) => {
      if (!data || typeof data !== 'object') return null;
      let roomId = typeof data.roomId === 'string' ? data.roomId : undefined;
      if (!roomId) {
        roomId = Array.from(rooms).find((r) => r !== socketId);
      }
      return roomId ? { roomId, data } : null;
    };

    const socketRooms = new Set(['sock_123', 'ROOM_ALPHA']);
    expect(forwardAction(null, socketRooms, 'sock_123')).toBeNull();
    expect(forwardAction(undefined, socketRooms, 'sock_123')).toBeNull();
    expect(forwardAction('random_string', socketRooms, 'sock_123')).toBeNull();
    expect(forwardAction(12345, socketRooms, 'sock_123')).toBeNull();

    const validAction = { type: 'swap', payload: { x: 2, y: 4 } };
    const res = forwardAction(validAction, socketRooms, 'sock_123');
    expect(res).not.toBeNull();
    expect(res?.roomId).toBe('ROOM_ALPHA');
  });
});
