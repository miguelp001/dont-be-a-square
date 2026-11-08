import { Server, Socket } from 'socket.io';

export interface BRCompetitor {
  id: string;
  socketId?: string;
  isBot: boolean;
  displayName: string;
  characterId: string;
  isAlive: boolean;
  stackHeight: number; // 0 to 12
  isDanger: boolean;
  badges: number;
  kosCount: number;
  targetId: string | null;
  targetMode: 'random' | 'attackers' | 'kos' | 'badges' | 'manual';
  manualTargetId?: string;
  lastAttackerId?: string;
  placement?: number;
  botSkill?: number; // 1 (novice) to 5 (grandmaster)
  botClearTimer?: number;
}

export interface BRRoom {
  id: string;
  seed: number;
  phase: 1 | 2 | 3;
  competitors: Map<string, BRCompetitor>;
  aliveCount: number;
  status: 'lobby' | 'playing' | 'ended';
  countdown: number;
  countdownInterval?: NodeJS.Timeout;
  tickInterval?: NodeJS.Timeout;
}

const BOT_NAMES = [
  'SLIME_ACE', 'STAR_POP', 'CHEVRON', 'NEON_FOX', 'RIVER_RUN',
  'EMBER_FANG', 'VOLT_BYTE', 'MOCHA_BEAN', 'SALTY_DOG', 'VOID_SPARK',
  'BANANA_BOT', 'PUZZLE_PRO', 'COMBO_KING', 'CHAIN_QUEEN', 'SUPER_SLIME',
  'MEADOW_BREEZE', 'OCTO_SWAP', 'PILL_POPPER', 'PANEL_HERO', 'TURTLE_BOY',
  'SWIFT_MATCH', 'MAGIC_SLIME', 'COSMIC_DEW', 'FOREST_WALKER', 'BLAZE_KID',
  'AQUA_BLADE', 'THUNDER_CLAW', 'CANDY_CRUSH', 'PIXEL_MAGE'
];

const BOT_CHARACTERS = ['kiri', 'mizu', 'riff', 'mocha', 'ember', 'volt', 'salty', 'poppy', 'void_slime', 'nano_banana'];

export class BattleRoyaleManager {
  private io: Server;
  private queueRoom: BRRoom | null = null;
  private activeRooms = new Map<string, BRRoom>();

  constructor(io: Server) {
    this.io = io;
  }

  public handleSocketConnection(socket: Socket): void {
    // 1. Join Battle Royale Queue
    socket.on('join_br_queue', (data: { characterId?: string; displayName?: string } = {}) => {
      this.joinQueue(socket, data);
    });

    // 2. Leave Queue
    socket.on('leave_br_queue', () => {
      this.leaveQueue(socket);
    });

    // 3. Telemetry update from player board (stack height & danger)
    socket.on('br_telemetry', (data: { roomId: string; stackHeight: number; isDanger: boolean }) => {
      const room = this.activeRooms.get(data.roomId);
      if (!room || room.status !== 'playing') return;
      const comp = room.competitors.get(socket.id);
      if (comp && comp.isAlive) {
        comp.stackHeight = Math.max(0, Math.min(12, Number(data.stackHeight) || 0));
        comp.isDanger = Boolean(data.isDanger);
      }
    });

    // 4. Change targeting doctrine
    socket.on('br_set_target', (data: { roomId: string; targetMode: 'random' | 'attackers' | 'kos' | 'badges' | 'manual'; manualTargetId?: string }) => {
      const room = this.activeRooms.get(data.roomId);
      if (!room || room.status !== 'playing') return;
      const comp = room.competitors.get(socket.id);
      if (comp && comp.isAlive) {
        comp.targetMode = data.targetMode || 'random';
        if (data.manualTargetId) {
          comp.manualTargetId = data.manualTargetId;
        }
        this.resolveTargetForCompetitor(room, comp);
      }
    });

    // 5. Send garbage attack
    socket.on('br_send_garbage', (data: { roomId: string; lines: number; targetMode?: any; manualTargetId?: string }) => {
      const room = this.activeRooms.get(data.roomId);
      if (!room || room.status !== 'playing') return;
      const comp = room.competitors.get(socket.id);
      if (comp && comp.isAlive) {
        if (data.targetMode) comp.targetMode = data.targetMode;
        if (data.manualTargetId) comp.manualTargetId = data.manualTargetId;
        this.dispatchGarbage(room, comp, Number(data.lines) || 1);
      }
    });

    // 6. Player topped out / eliminated
    socket.on('br_topout', (data: { roomId: string }) => {
      const room = this.activeRooms.get(data.roomId);
      if (!room || room.status !== 'playing') return;
      this.eliminateCompetitor(room, socket.id);
    });

    // 7. Socket disconnect handling
    socket.on('disconnect', () => {
      this.leaveQueue(socket);
      for (const room of this.activeRooms.values()) {
        if (room.competitors.has(socket.id)) {
          this.eliminateCompetitor(room, socket.id);
        }
      }
    });
  }

  private joinQueue(socket: Socket, data: { characterId?: string; displayName?: string }): void {
    if (!this.queueRoom) {
      const roomId = `BR_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      this.queueRoom = {
        id: roomId,
        seed: Math.floor(Math.random() * 1000000),
        phase: 1,
        competitors: new Map(),
        aliveCount: 0,
        status: 'lobby',
        countdown: 15
      };

      // Start countdown timer
      this.queueRoom.countdownInterval = setInterval(() => {
        if (!this.queueRoom) return;
        this.queueRoom.countdown--;
        this.io.to(this.queueRoom.id).emit('br_queue_update', {
          roomId: this.queueRoom.id,
          playersCount: this.queueRoom.competitors.size,
          countdown: this.queueRoom.countdown,
          players: Array.from(this.queueRoom.competitors.values()).map((c) => ({
            id: c.id,
            displayName: c.displayName,
            characterId: c.characterId
          }))
        });

        if (this.queueRoom.countdown <= 0) {
          this.startBattleRoyaleMatch(this.queueRoom);
          this.queueRoom = null;
        }
      }, 1000);
    }

    const cleanName = (data.displayName || 'PLAYER').trim().substring(0, 10).toUpperCase() || 'PLAYER';
    const characterId = data.characterId || 'kiri';

    const competitor: BRCompetitor = {
      id: socket.id,
      socketId: socket.id,
      isBot: false,
      displayName: cleanName,
      characterId,
      isAlive: true,
      stackHeight: 3,
      isDanger: false,
      badges: 0,
      kosCount: 0,
      targetId: null,
      targetMode: 'random'
    };

    this.queueRoom.competitors.set(socket.id, competitor);
    socket.join(this.queueRoom.id);

    socket.emit('br_queue_joined', {
      roomId: this.queueRoom.id,
      playerId: socket.id,
      playersCount: this.queueRoom.competitors.size,
      countdown: this.queueRoom.countdown
    });

    // Immediate update
    this.io.to(this.queueRoom.id).emit('br_queue_update', {
      roomId: this.queueRoom.id,
      playersCount: this.queueRoom.competitors.size,
      countdown: this.queueRoom.countdown,
      players: Array.from(this.queueRoom.competitors.values()).map((c) => ({
        id: c.id,
        displayName: c.displayName,
        characterId: c.characterId
      }))
    });

    // If room hits 30 real players, start immediately!
    if (this.queueRoom.competitors.size >= 30) {
      if (this.queueRoom.countdownInterval) clearInterval(this.queueRoom.countdownInterval);
      this.startBattleRoyaleMatch(this.queueRoom);
      this.queueRoom = null;
    }
  }

  private leaveQueue(socket: Socket): void {
    if (!this.queueRoom) return;
    if (this.queueRoom.competitors.has(socket.id)) {
      this.queueRoom.competitors.delete(socket.id);
      socket.leave(this.queueRoom.id);
      socket.emit('br_queue_left');

      if (this.queueRoom.competitors.size === 0) {
        if (this.queueRoom.countdownInterval) clearInterval(this.queueRoom.countdownInterval);
        this.queueRoom = null;
      } else {
        this.io.to(this.queueRoom.id).emit('br_queue_update', {
          roomId: this.queueRoom.id,
          playersCount: this.queueRoom.competitors.size,
          countdown: this.queueRoom.countdown,
          players: Array.from(this.queueRoom.competitors.values()).map((c) => ({
            id: c.id,
            displayName: c.displayName,
            characterId: c.characterId
          }))
        });
      }
    }
  }

  private startBattleRoyaleMatch(room: BRRoom): void {
    if (room.countdownInterval) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = undefined;
    }

    // Backfill remaining slots up to 30 with AI Bots
    const realPlayersCount = room.competitors.size;
    const botFillCount = Math.max(0, 30 - realPlayersCount);

    const shuffledBotNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < botFillCount; i++) {
      const botId = `bot_${room.id}_${i + 1}`;
      const botName = shuffledBotNames[i % shuffledBotNames.length] || `BOT_${i + 1}`;
      const botChar = BOT_CHARACTERS[i % BOT_CHARACTERS.length];
      const botSkill = 1 + (i % 5); // distribution of skills 1-5

      room.competitors.set(botId, {
        id: botId,
        isBot: true,
        displayName: botName,
        characterId: botChar,
        isAlive: true,
        stackHeight: 2 + Math.floor(Math.random() * 3),
        isDanger: false,
        badges: 0,
        kosCount: 0,
        targetId: null,
        targetMode: ['random', 'attackers', 'kos', 'badges'][Math.floor(Math.random() * 4)] as any,
        botSkill,
        botClearTimer: 2000 + Math.random() * 2500
      });
    }

    room.aliveCount = room.competitors.size; // Exactly 30!
    room.status = 'playing';
    room.phase = 1;
    this.activeRooms.set(room.id, room);

    console.log(`Battle Royale match started: ${room.id} with ${realPlayersCount} humans + ${botFillCount} bots (Total 30)`);

    // Assign initial targets for all competitors
    for (const comp of room.competitors.values()) {
      this.resolveTargetForCompetitor(room, comp);
    }

    // Notify all players that match is starting
    this.io.to(room.id).emit('br_match_start', {
      roomId: room.id,
      seed: room.seed,
      totalPlayers: 30,
      competitors: Array.from(room.competitors.values()).map((c) => ({
        id: c.id,
        isBot: c.isBot,
        displayName: c.displayName,
        characterId: c.characterId,
        badges: c.badges,
        stackHeight: c.stackHeight,
        targetId: c.targetId
      }))
    });

    // Start 3 Hz server tick loop
    room.tickInterval = setInterval(() => {
      this.tickBattleRoyale(room, 330);
    }, 330);
  }

  private resolveTargetForCompetitor(room: BRRoom, comp: BRCompetitor): void {
    if (!comp.isAlive) {
      comp.targetId = null;
      return;
    }

    const aliveOthers = Array.from(room.competitors.values()).filter(
      (c) => c.id !== comp.id && c.isAlive
    );

    if (aliveOthers.length === 0) {
      comp.targetId = null;
      return;
    }

    switch (comp.targetMode) {
      case 'manual': {
        if (comp.manualTargetId && room.competitors.get(comp.manualTargetId)?.isAlive) {
          comp.targetId = comp.manualTargetId;
          return;
        }
        // Fallback to random if manual target dead
        comp.targetId = aliveOthers[Math.floor(Math.random() * aliveOthers.length)].id;
        break;
      }
      case 'attackers': {
        const attackers = aliveOthers.filter((c) => c.targetId === comp.id);
        if (attackers.length > 0) {
          comp.targetId = attackers[Math.floor(Math.random() * attackers.length)].id;
          return;
        }
        // Fallback to random if no one attacking
        comp.targetId = aliveOthers[Math.floor(Math.random() * aliveOthers.length)].id;
        break;
      }
      case 'kos': {
        // Target opponent with highest stack height (closest to topout)
        let highest = aliveOthers[0];
        for (const o of aliveOthers) {
          if (o.stackHeight > highest.stackHeight) {
            highest = o;
          }
        }
        comp.targetId = highest.id;
        break;
      }
      case 'badges': {
        // Target opponent with highest badge count
        let mostBadges = aliveOthers[0];
        for (const o of aliveOthers) {
          if (o.badges > mostBadges.badges) {
            mostBadges = o;
          }
        }
        comp.targetId = mostBadges.id;
        break;
      }
      case 'random':
      default: {
        // Only re-roll if current target is invalid or null
        if (!comp.targetId || !room.competitors.get(comp.targetId)?.isAlive) {
          comp.targetId = aliveOthers[Math.floor(Math.random() * aliveOthers.length)].id;
        }
        break;
      }
    }
  }

  private dispatchGarbage(room: BRRoom, sender: BRCompetitor, lines: number): void {
    if (!sender.isAlive || room.status !== 'playing') return;

    // Apply badge multiplier: +25% per badge, max 2.0x (double garbage)
    const multiplier = 1.0 + Math.min(1.0, sender.badges * 0.25);
    const finalLines = Math.max(1, Math.round(lines * multiplier));

    // Re-verify and resolve target
    this.resolveTargetForCompetitor(room, sender);

    // If sender is in 'attackers' mode, split garbage to ALL players attacking them!
    if (sender.targetMode === 'attackers') {
      const attackers = Array.from(room.competitors.values()).filter(
        (c) => c.id !== sender.id && c.isAlive && c.targetId === sender.id
      );
      if (attackers.length > 0) {
        for (const attacker of attackers) {
          this.deliverGarbageTo(room, sender, attacker, finalLines);
        }
        return;
      }
    }

    if (sender.targetId) {
      const target = room.competitors.get(sender.targetId);
      if (target && target.isAlive) {
        this.deliverGarbageTo(room, sender, target, finalLines);
      }
    }
  }

  private deliverGarbageTo(room: BRRoom, sender: BRCompetitor, target: BRCompetitor, lines: number): void {
    target.lastAttackerId = sender.id;

    if (!target.isBot && target.socketId) {
      this.io.to(target.socketId).emit('br_receive_garbage', {
        fromId: sender.id,
        fromName: sender.displayName,
        lines
      });
    } else if (target.isBot) {
      // Bot takes garbage directly to stack
      target.stackHeight = Math.min(12, target.stackHeight + lines);
      if (target.stackHeight >= 10) {
        target.isDanger = true;
      }
    }
  }

  private eliminateCompetitor(room: BRRoom, victimId: string): void {
    const victim = room.competitors.get(victimId);
    if (!victim || !victim.isAlive) return;

    victim.isAlive = false;
    victim.placement = room.aliveCount;
    room.aliveCount--;

    // Determine killer
    let killer: BRCompetitor | undefined;
    if (victim.lastAttackerId && room.competitors.get(victim.lastAttackerId)?.isAlive) {
      killer = room.competitors.get(victim.lastAttackerId);
    } else {
      // Fallback: anyone targeting the victim
      for (const comp of room.competitors.values()) {
        if (comp.isAlive && comp.targetId === victim.id) {
          killer = comp;
          break;
        }
      }
    }

    let killerName = 'THE VOID';
    if (killer) {
      killer.kosCount++;
      // Award badge: 1 + all badges victim held!
      killer.badges += 1 + victim.badges;
      killerName = killer.displayName;
    }

    console.log(`[BR ${room.id}] #${victim.placement} ${victim.displayName} eliminated by ${killerName}! (${room.aliveCount} remain)`);

    // Broadcast elimination
    this.io.to(room.id).emit('br_elimination', {
      victimId: victim.id,
      victimName: victim.displayName,
      killerId: killer?.id || 'none',
      killerName,
      rank: victim.placement,
      aliveCount: room.aliveCount
    });

    if (!victim.isBot && victim.socketId) {
      this.io.to(victim.socketId).emit('br_personal_elimination', {
        placement: victim.placement,
        killerName,
        kosCount: victim.kosCount,
        badges: victim.badges
      });
    }

    // Check Phase Escalation
    if (room.aliveCount <= 5 && room.phase < 3) {
      room.phase = 3;
      this.io.to(room.id).emit('br_phase_escalate', { phase: 3, aliveCount: room.aliveCount });
      console.log(`[BR ${room.id}] Phase 3 Sudden Death activated!`);
    } else if (room.aliveCount <= 15 && room.phase < 2) {
      room.phase = 2;
      this.io.to(room.id).emit('br_phase_escalate', { phase: 2, aliveCount: room.aliveCount });
      console.log(`[BR ${room.id}] Phase 2 Storm Speedup activated!`);
    }

    // Check Victory
    if (room.aliveCount <= 1) {
      const winner = Array.from(room.competitors.values()).find((c) => c.isAlive);
      if (winner) {
        winner.placement = 1;
        this.io.to(room.id).emit('br_match_victory', {
          winnerId: winner.id,
          winnerName: winner.displayName,
          characterId: winner.characterId,
          badges: winner.badges,
          kosCount: winner.kosCount
        });
      }
      this.endMatch(room);
    }
  }

  private endMatch(room: BRRoom): void {
    room.status = 'ended';
    if (room.tickInterval) {
      clearInterval(room.tickInterval);
      room.tickInterval = undefined;
    }
    this.activeRooms.delete(room.id);
  }

  private tickBattleRoyale(room: BRRoom, deltaMs: number): void {
    if (room.status !== 'playing') return;

    // Simulate Bot behaviors
    for (const comp of room.competitors.values()) {
      if (!comp.isAlive || !comp.isBot) continue;

      // Bot stack natural creep based on phase
      const riseRate = room.phase === 3 ? 0.08 : room.phase === 2 ? 0.05 : 0.03;
      if (Math.random() < riseRate) {
        comp.stackHeight = Math.min(12, comp.stackHeight + 1);
        if (comp.stackHeight >= 10) comp.isDanger = true;
      }

      // Bot matching action timer
      comp.botClearTimer = (comp.botClearTimer || 2500) - deltaMs;
      if (comp.botClearTimer <= 0) {
        // Reset timer based on bot skill
        const baseTimer = Math.max(1200, 3200 - (comp.botSkill || 1) * 350);
        comp.botClearTimer = baseTimer + Math.random() * 800;

        // Bot makes a match: lowers stack and potentially sends attack
        comp.stackHeight = Math.max(1, comp.stackHeight - Math.floor(1 + Math.random() * 3));
        if (comp.stackHeight < 9) comp.isDanger = false;

        // Chance to launch attack based on skill and phase
        const attackChance = 0.25 + (comp.botSkill || 1) * 0.1 + (room.phase - 1) * 0.15;
        if (Math.random() < attackChance) {
          const lines = 1 + Math.floor(Math.random() * 3);
          this.dispatchGarbage(room, comp, lines);
        }

        // Re-evaluate target
        this.resolveTargetForCompetitor(room, comp);
      }

      // Check if bot topped out
      if (comp.stackHeight >= 12 && comp.isDanger) {
        if (Math.random() < 0.18) {
          this.eliminateCompetitor(room, comp.id);
        }
      }
    }

    // Re-resolve targets for human players if current target died
    for (const comp of room.competitors.values()) {
      if (comp.isAlive && !comp.isBot) {
        this.resolveTargetForCompetitor(room, comp);
      }
    }

    // Broadcast 3 Hz telemetry snapshot to all clients in the match
    const telemetrySnapshot = Array.from(room.competitors.values()).map((c) => ({
      id: c.id,
      displayName: c.displayName,
      characterId: c.characterId,
      isAlive: c.isAlive,
      stackHeight: c.stackHeight,
      isDanger: c.isDanger,
      badges: c.badges,
      targetId: c.targetId
    }));

    this.io.to(room.id).emit('br_telemetry_snapshot', {
      aliveCount: room.aliveCount,
      phase: room.phase,
      competitors: telemetrySnapshot
    });
  }
}
