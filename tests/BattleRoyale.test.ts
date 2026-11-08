import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BattleRoyaleManager, BRRoom, BRCompetitor } from '../server/battle_royale';

// Helper to create mock Socket.IO server
function createMockServer() {
  const emittedEvents: { event: string; data: any; room?: string }[] = [];

  const ioMock: any = {
    to: (roomId: string) => ({
      emit: (event: string, data: any) => {
        emittedEvents.push({ event, data, room: roomId });
      }
    }),
    emit: (event: string, data: any) => {
      emittedEvents.push({ event, data });
    },
    _emittedEvents: emittedEvents
  };

  return ioMock;
}

// Helper to create mock Socket
function createMockSocket(id: string) {
  const handlers = new Map<string, (...args: any[]) => void>();
  const emittedToSocket: { event: string; data: any }[] = [];

  const socket: any = {
    id,
    on: (event: string, handler: (...args: any[]) => void) => {
      handlers.set(event, handler);
    },
    emit: (event: string, data: any) => {
      emittedToSocket.push({ event, data });
    },
    join: vi.fn(),
    leave: vi.fn(),
    _trigger: (event: string, ...args: any[]) => {
      const handler = handlers.get(event);
      if (handler) handler(...args);
    },
    _emitted: emittedToSocket
  };

  return socket;
}

describe('Battle Royale Server Engine (30-Player FFA)', () => {
  let io: any;
  let manager: BattleRoyaleManager;

  beforeEach(() => {
    vi.useFakeTimers();
    io = createMockServer();
    manager = new BattleRoyaleManager(io);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('initializes queue and backfills 29 AI bots to reach exactly 30 competitors', () => {
    const socket = createMockSocket('player_1');
    manager.handleSocketConnection(socket);

    // Human player joins queue
    socket._trigger('join_br_queue', { characterId: 'kiri', displayName: 'PlayerOne' });

    // Expect queue joined event
    expect(socket._emitted.length).toBeGreaterThan(0);
    const queueEvent = socket._emitted.find((e) => e.event === 'br_queue_joined');
    expect(queueEvent).toBeDefined();
    expect(queueEvent.data.playersCount).toBe(1);

    // Fast-forward 15s queue countdown
    vi.advanceTimersByTime(16000);

    // Check match start broadcast
    const startEvent = io._emittedEvents.find((e: any) => e.event === 'br_match_start');
    expect(startEvent).toBeDefined();
    expect(startEvent.data.totalPlayers).toBe(30);
    expect(startEvent.data.competitors.length).toBe(30);

    // Verify 1 human + 29 bots
    const competitors = startEvent.data.competitors;
    const humans = competitors.filter((c: any) => !c.isBot);
    const bots = competitors.filter((c: any) => c.isBot);
    expect(humans.length).toBe(1);
    expect(humans[0].displayName.toUpperCase()).toBe('PLAYERONE');
    expect(bots.length).toBe(29);
  });

  it('correctly resolves 4-way tactical targeting doctrines', () => {
    const socket = createMockSocket('test_player');
    manager.handleSocketConnection(socket);
    socket._trigger('join_br_queue', { characterId: 'mizu', displayName: 'TargetTester' });
    vi.advanceTimersByTime(16000);

    const startEvent = io._emittedEvents.find((e: any) => e.event === 'br_match_start');
    const roomId = startEvent.data.roomId;
    const room = (manager as any).activeRooms.get(roomId) as BRRoom;
    expect(room).toBeDefined();

    // Pause tick interval for deterministic target testing
    if (room.tickInterval) clearInterval(room.tickInterval);

    const playerComp = room.competitors.get('test_player')!;
    const bots = Array.from(room.competitors.values()).filter((c) => c.isBot && c.isAlive);

    // 1. KOs Targeting Doctrine: targets opponent with highest stack height
    bots[5].stackHeight = 11;
    bots[5].isDanger = true;
    bots[10].stackHeight = 4;

    socket._trigger('br_set_target', { roomId, targetMode: 'kos' });
    expect(playerComp.targetMode).toBe('kos');
    expect(playerComp.targetId).toBe(bots[5].id);

    // 2. BADGES Targeting Doctrine: targets opponent with most badges
    bots[12].badges = 4;
    socket._trigger('br_set_target', { roomId, targetMode: 'badges' });
    expect(playerComp.targetMode).toBe('badges');
    expect(playerComp.targetId).toBe(bots[12].id);

    // 3. ATTACKERS / REVENGE Doctrine: targets who is targeting player
    bots[3].targetId = 'test_player';
    bots[4].targetId = 'test_player';
    socket._trigger('br_set_target', { roomId, targetMode: 'attackers' });
    expect(playerComp.targetMode).toBe('attackers');
    expect(room.competitors.get(playerComp.targetId!)?.targetId).toBe('test_player');

    // 4. MANUAL Targeting: explicitly designated opponent
    socket._trigger('br_set_target', { roomId, targetMode: 'manual', manualTargetId: bots[8].id });
    expect(playerComp.targetMode).toBe('manual');
    expect(playerComp.targetId).toBe(bots[8].id);
  });

  it('calculates badge multipliers correctly (+25% per badge up to 2.0x)', () => {
    const socket = createMockSocket('attacker_player');
    manager.handleSocketConnection(socket);
    socket._trigger('join_br_queue', { characterId: 'riff', displayName: 'Attacker' });
    vi.advanceTimersByTime(16000);

    const startEvent = io._emittedEvents.find((e: any) => e.event === 'br_match_start');
    const roomId = startEvent.data.roomId;
    const room = (manager as any).activeRooms.get(roomId) as BRRoom;
    if (room.tickInterval) clearInterval(room.tickInterval);

    const playerComp = room.competitors.get('attacker_player')!;
    const targetBot = Array.from(room.competitors.values()).find((c) => c.isBot)!;
    playerComp.targetMode = 'manual';
    playerComp.manualTargetId = targetBot.id;
    playerComp.targetId = targetBot.id;

    // 0 Badges -> 1.0x (2 lines sent -> 2 lines delivered)
    targetBot.stackHeight = 0;
    socket._trigger('br_send_garbage', { roomId, lines: 2 });
    expect(targetBot.stackHeight).toBe(2);

    // 2 Badges -> 1.5x (2 lines sent -> 3 lines delivered)
    playerComp.badges = 2;
    targetBot.stackHeight = 0;
    socket._trigger('br_send_garbage', { roomId, lines: 2 });
    expect(targetBot.stackHeight).toBe(3);

    // 4 Badges -> 2.0x (2 lines sent -> 4 lines delivered)
    playerComp.badges = 4;
    targetBot.stackHeight = 0;
    socket._trigger('br_send_garbage', { roomId, lines: 2 });
    expect(targetBot.stackHeight).toBe(4);

    // 8 Badges -> capped at 2.0x max (2 lines sent -> 4 lines delivered)
    playerComp.badges = 8;
    targetBot.stackHeight = 0;
    socket._trigger('br_send_garbage', { roomId, lines: 2 });
    expect(targetBot.stackHeight).toBe(4);
  });

  it('inherits victim badges on knockout and increments KOs', () => {
    const socket = createMockSocket('hero_player');
    manager.handleSocketConnection(socket);
    socket._trigger('join_br_queue', { characterId: 'kiri', displayName: 'Hero' });
    vi.advanceTimersByTime(16000);

    const startEvent = io._emittedEvents.find((e: any) => e.event === 'br_match_start');
    const roomId = startEvent.data.roomId;
    const room = (manager as any).activeRooms.get(roomId) as BRRoom;
    if (room.tickInterval) clearInterval(room.tickInterval);

    const hero = room.competitors.get('hero_player')!;
    const victimBot = Array.from(room.competitors.values()).find((c) => c.isBot)!;
    victimBot.badges = 3;

    // Hero attacks victimBot
    hero.targetMode = 'manual';
    hero.manualTargetId = victimBot.id;
    hero.targetId = victimBot.id;
    socket._trigger('br_send_garbage', { roomId, lines: 4 });

    // Victim tops out
    (manager as any).eliminateCompetitor(room, victimBot.id);

    expect(victimBot.isAlive).toBe(false);
    expect(hero.kosCount).toBe(1);
    // Killer receives 1 + victim's 3 badges = +4 badges
    expect(hero.badges).toBe(4);
  });

  it('splits revenge garbage to all attackers when in attackers mode', () => {
    const socket = createMockSocket('defender_player');
    manager.handleSocketConnection(socket);
    socket._trigger('join_br_queue', { characterId: 'poppy', displayName: 'Defender' });
    vi.advanceTimersByTime(16000);

    const startEvent = io._emittedEvents.find((e: any) => e.event === 'br_match_start');
    const roomId = startEvent.data.roomId;
    const room = (manager as any).activeRooms.get(roomId) as BRRoom;
    if (room.tickInterval) clearInterval(room.tickInterval);

    const defender = room.competitors.get('defender_player')!;
    const bots = Array.from(room.competitors.values()).filter((c) => c.isBot);
    const attacker1 = bots[0];
    const attacker2 = bots[1];
    const attacker3 = bots[2];

    attacker1.targetId = 'defender_player';
    attacker2.targetId = 'defender_player';
    attacker3.targetId = 'defender_player';

    attacker1.stackHeight = 0;
    attacker2.stackHeight = 0;
    attacker3.stackHeight = 0;

    // Set defender to attackers doctrine
    defender.targetMode = 'attackers';
    socket._trigger('br_send_garbage', { roomId, lines: 3, targetMode: 'attackers' });

    // All three attackers receive the counter-attack!
    expect(attacker1.stackHeight).toBe(3);
    expect(attacker2.stackHeight).toBe(3);
    expect(attacker3.stackHeight).toBe(3);
  });

  it('escalates phases dynamically at 15 and 5 remaining players', () => {
    const socket = createMockSocket('survivor_player');
    manager.handleSocketConnection(socket);
    socket._trigger('join_br_queue', { characterId: 'volt', displayName: 'Survivor' });
    vi.advanceTimersByTime(16000);

    const startEvent = io._emittedEvents.find((e: any) => e.event === 'br_match_start');
    const roomId = startEvent.data.roomId;
    const room = (manager as any).activeRooms.get(roomId) as BRRoom;
    if (room.tickInterval) clearInterval(room.tickInterval);

    expect(room.phase).toBe(1);
    expect(room.aliveCount).toBe(30);

    // Eliminate bots until 15 remain
    const bots = Array.from(room.competitors.values()).filter((c) => c.isBot);
    for (let i = 0; i < 15; i++) {
      (manager as any).eliminateCompetitor(room, bots[i].id);
    }

    expect(room.aliveCount).toBe(15);
    expect(room.phase).toBe(2);

    const phase2Events = io._emittedEvents.filter((e: any) => e.event === 'br_phase_escalate');
    expect(phase2Events.length).toBeGreaterThan(0);
    expect(phase2Events[phase2Events.length - 1].data.phase).toBe(2);

    // Eliminate bots until 5 remain
    for (let i = 15; i < 25; i++) {
      (manager as any).eliminateCompetitor(room, bots[i].id);
    }

    expect(room.aliveCount).toBe(5);
    expect(room.phase).toBe(3);

    const phase3Events = io._emittedEvents.filter((e: any) => e.event === 'br_phase_escalate');
    expect(phase3Events.length).toBeGreaterThan(0);
    expect(phase3Events[phase3Events.length - 1].data.phase).toBe(3);
  });

  it('declares #1 Victory Royale when last opponent is eliminated', () => {
    const socket = createMockSocket('champion_player');
    manager.handleSocketConnection(socket);
    socket._trigger('join_br_queue', { characterId: 'void_slime', displayName: 'Champion' });
    vi.advanceTimersByTime(16000);

    const startEvent = io._emittedEvents.find((e: any) => e.event === 'br_match_start');
    const roomId = startEvent.data.roomId;
    const room = (manager as any).activeRooms.get(roomId) as BRRoom;
    if (room.tickInterval) clearInterval(room.tickInterval);

    // Eliminate all 29 bots
    const bots = Array.from(room.competitors.values()).filter((c) => c.isBot);
    for (const b of bots) {
      (manager as any).eliminateCompetitor(room, b.id);
    }

    expect(room.aliveCount).toBe(1);
    expect(room.status).toBe('ended');

    const victoryEvent = io._emittedEvents.find((e: any) => e.event === 'br_match_victory');
    expect(victoryEvent).toBeDefined();
    expect(victoryEvent.data.winnerId).toBe('champion_player');
    expect(victoryEvent.data.winnerName.toUpperCase()).toBe('CHAMPION');
  });
});
