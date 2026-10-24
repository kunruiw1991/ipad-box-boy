/**
 * Core Game & Deterministic 2D Physics Engine for BoxBoy! + Box Girl! (Zero-Text Web Edition)
 * Implements all 6 Box Actions (Create, Place, Throw, Hook/Retract, Push/Shoot, Erase),
 * Lasers, Floor Spikes, Grey Stone Overhangs, Blue/Red Wall Switches & Phase Blocks,
 * Dual-Hero Co-Op (Qbby + Qucy), and the window.__BOXBOY__ programmatic verification contract.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'boxboy_ipad_progress_v1';
  const GRAVITY = 28.0;
  const JUMP_VEL = 9.2;
  const MOVE_SPEED = 5.5;
  const RETRACT_SPEED = 15.0;
  const SHOOT_SPEED = 16.0;

  const DIR_DELTAS = {
    up: { dx: 0, dy: 1 },
    down: { dx: 0, dy: -1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 }
  };

  class BoxBoyEngine {
    constructor() {
      this.stages = window.BoxBoyStages || [];
      this.audio = window.BoxBoyAudio || null;

      this.screen = 'title'; // 'title' | 'map' | 'game' | 'clear'
      this.selectedHero = 'qbby'; // 'qbby' | 'qucy'
      this.stageIndex = 0;
      this.stage = null;
      this.paused = false;
      this.time = 0;

      // Persistent progression
      this.progress = this._loadProgress();

      // Per-stage runtime state
      this.heroes = {};
      this.activeChar = 'qbby';
      this.boxesUsed = 0;
      this.drawMode = false;
      this.crowns = [];
      this.switches = [];
      this.phaseBlocks = [];
      this.lasers = [];
      this.spikes = [];
      this.particles = [];
      this.ghostTrails = [];
      this.doorOpenProgress = 0;
      this.goalReached = false;
      this.stageCleared = false;
      this.medalEarned = 0;

      this.mechanicsExercised = this._emptyMechanics();
      this.inputState = { left: false, right: false };

      if (this.stages.length > 0) {
        this._initStageState(0, false);
      }
    }

    _emptyMechanics() {
      return {
        create: false,
        place: false,
        throw: false,
        hook: false,
        shoot: false,
        erase: false,
        spikeShield: false,
        laserBlock: false,
        switchToggle: false,
        heroSwitch: false
      };
    }

    _loadProgress() {
      const def = {};
      (this.stages || []).forEach((s) => {
        def[s.id] = { cleared: false, crowns: 0, crownsTotal: s.crowns.length, medal: 0, bestBoxes: null };
      });
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          Object.keys(def).forEach((k) => {
            if (parsed && parsed[k]) {
              def[k] = Object.assign({}, def[k], parsed[k]);
            }
          });
        }
      } catch (e) {}
      return def;
    }

    _saveProgress() {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
      } catch (e) {}
    }

    _resolveStageIndex(stageIndexOrId) {
      if (typeof stageIndexOrId === 'string') {
        const upper = stageIndexOrId.trim().toUpperCase();
        const found = this.stages.findIndex((s) => s.id.toUpperCase() === upper);
        if (found !== -1) return found;
        const num = parseInt(upper, 10);
        if (!Number.isNaN(num)) stageIndexOrId = num;
      }
      if (typeof stageIndexOrId === 'number' && !Number.isNaN(stageIndexOrId)) {
        const idx = Math.floor(stageIndexOrId);
        if (idx >= 0 && idx < this.stages.length) return idx;
        if (idx === this.stages.length) return this.stages.length - 1;
      }
      return -1;
    }

    _makeHeroEntity(spawn, defaultHero) {
      const heroType = spawn.hero || defaultHero || 'qbby';
      return {
        hero: heroType,
        x: spawn.x,
        y: spawn.y,
        vx: 0,
        vy: 0,
        grounded: true,
        facing: 1,
        eyeState: 'normal', // 'normal' | 'creating' | 'hurt' | 'clear'
        animState: 'idle',  // 'idle' | 'walk' | 'jump' | 'retract' | 'clear'
        walkPhase: 0,
        scaleX: 1,
        scaleY: 1,
        activeChain: [],
        placedChain: [],
        chainState: 'none', // 'none' | 'placed' | 'thrown' | 'sliding' | 'retracting'
        motionChain: null,  // { boxes: [{x,y}], vx, vy, originX, targetX }
        retractQueue: [],
        retractTimer: 0,
        inDoor: false
      };
    }

    _initStageState(index, enterGameScreen = true) {
      const st = this.stages[index];
      if (!st) return null;
      this.stageIndex = index;
      this.stage = st;
      if (enterGameScreen) {
        this.screen = 'game';
      }

      const primaryType = st.partnerSpawn ? (st.spawn.hero || 'qucy') : (this.selectedHero || st.spawn.hero || 'qbby');
      this.heroes = {};
      this.heroes[primaryType] = this._makeHeroEntity(st.spawn, primaryType);
      this.activeChar = primaryType;

      if (st.partnerSpawn) {
        const partnerType = st.partnerSpawn.hero || (primaryType === 'qucy' ? 'qbby' : 'qucy');
        this.heroes[partnerType] = this._makeHeroEntity(st.partnerSpawn, partnerType);
      }

      this.boxesUsed = 0;
      this.drawMode = false;
      this.inputState = { left: false, right: false };
      this.crowns = st.crowns.map((c) => ({ id: c.id, x: c.x, y: c.y, collected: false, bobPhase: c.id * 1.3 }));
      this.switches = st.switches.map((sw) => Object.assign({}, sw, { active: false }));
      this.phaseBlocks = st.phaseBlocks.map((pb) => Object.assign({}, pb, { solid: false }));
      this.spikes = st.spikes.map((sp) => Object.assign({}, sp));
      this.lasers = st.lasers.map((ls) => Object.assign({}, ls, { activeCells: [], blockedByBox: false }));
      this.particles = [];
      this.ghostTrails = [];
      this.doorOpenProgress = 0;
      this.goalReached = false;
      this.stageCleared = false;
      this.medalEarned = 0;

      this._updateLasers();
      return this.getState();
    }

    loadStage(stageIndexOrId) {
      this.progress = this._loadProgress();
      let idx = this._resolveStageIndex(stageIndexOrId);
      if (idx === -1) {
        idx = 0;
      }
      return this._initStageState(idx, true);
    }

    get player() {
      return this.heroes[this.activeChar] || Object.values(this.heroes)[0];
    }

    get partner() {
      const keys = Object.keys(this.heroes);
      if (keys.length < 2) return null;
      const otherKey = keys.find((k) => k !== this.activeChar);
      return otherKey ? this.heroes[otherKey] : null;
    }

    // =========================================================================
    // WORLD QUERIES (TERRAIN, PHASE BLOCKS, SPIKES, BOXES, SWITCHES, LASERS)
    // =========================================================================

    isTerrainSolid(gx, gy) {
      if (!this.stage) return false;
      if (gx < 0 || gx >= this.stage.width) return true; // stage side boundaries
      if (gy < 0 || gy >= this.stage.height) return false;
      const t = this.stage.tiles[gy] && this.stage.tiles[gy][gx];
      if (t && (t.type === 'grass' || t.type === 'stone')) return true;
      for (let i = 0; i < this.phaseBlocks.length; i++) {
        const pb = this.phaseBlocks[i];
        if (pb.solid && pb.x === gx && pb.y === gy) return true;
      }
      return false;
    }

    isPhaseDottedAt(gx, gy) {
      for (let i = 0; i < this.phaseBlocks.length; i++) {
        const pb = this.phaseBlocks[i];
        if (!pb.solid && pb.x === gx && pb.y === gy) return true;
      }
      return false;
    }

    isSpikeAt(gx, gy) {
      for (let i = 0; i < this.spikes.length; i++) {
        const sp = this.spikes[i];
        if (sp.x === gx && sp.y === gy) return true;
      }
      return false;
    }

    isPlacedBoxAt(gx, gy, excludeHeroKey = null) {
      const keys = Object.keys(this.heroes);
      for (let k = 0; k < keys.length; k++) {
        const hKey = keys[k];
        if (hKey === excludeHeroKey) continue;
        const h = this.heroes[hKey];
        if (h.chainState === 'placed' && h.placedChain) {
          for (let i = 0; i < h.placedChain.length; i++) {
            const b = h.placedChain[i];
            if (Math.round(b.x) === gx && Math.round(b.y) === gy) return true;
          }
        }
      }
      return false;
    }

    isAnyBoxAt(gx, gy) {
      const keys = Object.keys(this.heroes);
      for (let k = 0; k < keys.length; k++) {
        const h = this.heroes[keys[k]];
        for (let i = 0; i < h.activeChain.length; i++) {
          const b = h.activeChain[i];
          if (Math.round(b.x) === gx && Math.round(b.y) === gy) return true;
        }
        for (let i = 0; i < h.placedChain.length; i++) {
          const b = h.placedChain[i];
          if (Math.round(b.x) === gx && Math.round(b.y) === gy) return true;
        }
      }
      return false;
    }

    isSolidForPlayer(gx, gy) {
      return this.isTerrainSolid(gx, gy) || this.isPlacedBoxAt(gx, gy, null);
    }

    _activateSwitch(sw) {
      if (sw.active) return;
      sw.active = true;
      this.mechanicsExercised.switchToggle = true;
      for (let i = 0; i < this.phaseBlocks.length; i++) {
        const pb = this.phaseBlocks[i];
        if (pb.group === sw.group || (!pb.group && pb.color === sw.color)) {
          pb.solid = true;
        }
      }
      this._spawnParticles(sw.x + 0.5, sw.y + 0.5, sw.color === 'red' ? '#ef5350' : '#29b6f6', 8);
      if (this.audio) this.audio.switchToggle(sw.color);
      this._updateLasers();
    }

    _checkSwitchAtCell(gx, gy) {
      let triggered = false;
      for (let i = 0; i < this.switches.length; i++) {
        const sw = this.switches[i];
        if (!sw.active) {
          // A switch mounted on the left face of (sw.x, sw.y) triggers when an entity/box enters (sw.x - 1, sw.y) or (sw.x, sw.y)
          if ((gx === sw.x || gx === sw.x - 1) && gy === sw.y) {
            this._activateSwitch(sw);
            triggered = true;
          }
        }
      }
      return triggered;
    }

    _updateLasers() {
      for (let i = 0; i < this.lasers.length; i++) {
        const ls = this.lasers[i];
        const cells = [];
        let blocked = false;
        // First check if a solid phase block or box caps the emitter at y
        for (let cy = ls.y; cy <= ls.maxY + 1; cy++) {
          if (this.isTerrainSolid(ls.x, cy) || this.isAnyBoxAt(ls.x, cy)) {
            blocked = true;
            this.mechanicsExercised.laserBlock = true;
            break;
          }
          if (cy <= ls.maxY) {
            cells.push({ x: ls.x, y: cy });
          }
        }
        ls.activeCells = cells;
        ls.blockedByBox = blocked;
      }
    }

    _spawnParticles(wx, wy, color = '#7b7d80', count = 6) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = 1.5 + Math.random() * 2.5;
        this.particles.push({
          x: wx,
          y: wy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed + 1.0,
          size: 0.14 + Math.random() * 0.12,
          color,
          life: 0.35 + Math.random() * 0.2,
          maxLife: 0.55
        });
      }
    }

    // =========================================================================
    // 6 BOX MANIPULATION ACTIONS
    // =========================================================================

    // Action 1: Extend / Draw Box Chain (Create)
    startDraw() {
      const p = this.player;
      if (!p || this.screen !== 'game' || this.stageCleared) return this.getState();
      this.drawMode = true;
      p.eyeState = 'creating';
      return this.getState();
    }

    extendDir(dir) {
      const p = this.player;
      if (!p || this.screen !== 'game' || this.stageCleared) return false;
      const d = DIR_DELTAS[dir];
      if (!d) return false;

      if (d.dx !== 0) p.facing = d.dx > 0 ? 1 : -1;
      p.eyeState = 'creating';
      this.drawMode = true;

      const px = Math.round(p.x);
      const py = Math.round(p.y);

      // Backtracking check: if dragging back onto previous box in chain, pop tip and refund 1 box
      if (p.activeChain.length >= 2) {
        const tip = p.activeChain[p.activeChain.length - 1];
        const prev = p.activeChain[p.activeChain.length - 2];
        if (tip.x + d.dx === prev.x && tip.y + d.dy === prev.y) {
          p.activeChain.pop();
          this.boxesUsed = Math.max(0, this.boxesUsed - 1);
          if (this.audio) this.audio.boxCreate(p.activeChain.length);
          this._updateLasers();
          return true;
        }
      } else if (p.activeChain.length === 1) {
        const tip = p.activeChain[0];
        if (tip.x + d.dx === px && tip.y + d.dy === py) {
          p.activeChain.pop();
          this.boxesUsed = Math.max(0, this.boxesUsed - 1);
          this._updateLasers();
          return true;
        }
      }

      if (p.activeChain.length >= this.stage.boxLimit) {
        return false;
      }

      // Dissolve this hero's previous placedChain when starting a new chain (1 active placed chain per hero)
      if (p.activeChain.length === 0 && p.placedChain.length > 0) {
        this._dissolvePlacedChain(p);
      }

      const origin = p.activeChain.length === 0 ? { x: px, y: py } : p.activeChain[p.activeChain.length - 1];
      const next = { x: origin.x + d.dx, y: origin.y + d.dy };

      if (next.x < 0 || next.x >= this.stage.width || next.y < 0 || next.y >= this.stage.height) {
        return false;
      }
      if (next.x === px && next.y === py) {
        return false;
      }
      for (let i = 0; i < p.activeChain.length; i++) {
        if (p.activeChain[i].x === next.x && p.activeChain[i].y === next.y) {
          return false; // No self-intersection
        }
      }
      if (this.isTerrainSolid(next.x, next.y) || this.isPlacedBoxAt(next.x, next.y, this.activeChar)) {
        return false; // Cannot extrude inside solid wall
      }

      p.activeChain.push(next);
      this.boxesUsed += 1;
      this.mechanicsExercised.create = true;
      if (this.audio) this.audio.boxCreate(p.activeChain.length);
      this._checkSwitchAtCell(next.x, next.y);
      this._updateLasers();
      return true;
    }

    createChain(dirs = []) {
      const p = this.player;
      if (!p) return this.getState();
      p.activeChain = [];
      for (let i = 0; i < dirs.length; i++) {
        this.extendDir(dirs[i]);
      }
      return this.getState();
    }

    // Action 2: Drop / Place (Place)
    placeChain() {
      const p = this.player;
      if (!p || p.activeChain.length === 0) {
        this.drawMode = false;
        if (p) p.eyeState = 'normal';
        return false;
      }
      if (p.placedChain.length > 0) {
        this._dissolvePlacedChain(p);
      }
      p.placedChain = p.activeChain.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y) }));
      p.activeChain = [];
      p.chainState = 'placed';
      p.eyeState = 'normal';
      this.drawMode = false;
      this.mechanicsExercised.place = true;
      if (this.audio) this.audio.boxPlace();

      this._settlePlacedChain(p);
      this._updateLasers();
      return true;
    }

    _isChainSupported(boxes, heroKey) {
      for (let i = 0; i < boxes.length; i++) {
        const bx = Math.round(boxes[i].x);
        const by = Math.round(boxes[i].y);
        // Supported by solid terrain or solid phase block directly below
        if (this.isTerrainSolid(bx, by - 1) || this.isPlacedBoxAt(bx, by - 1, heroKey)) {
          return true;
        }
        // Supported by floor spikes at (bx, by - 1) — resting flat atop spike tips!
        if (this.isSpikeAt(bx, by - 1)) {
          this.mechanicsExercised.spikeShield = true;
          return true;
        }
      }
      return false;
    }

    _settlePlacedChain(heroObj) {
      if (!heroObj || heroObj.chainState !== 'placed' || heroObj.placedChain.length === 0) return;
      const heroKey = heroObj.hero;
      let safety = 0;
      while (!this._isChainSupported(heroObj.placedChain, heroKey) && safety < 15) {
        safety++;
        for (let i = 0; i < heroObj.placedChain.length; i++) {
          heroObj.placedChain[i].y -= 1;
        }
        // If fallen below bottom of map, dissolve
        if (heroObj.placedChain.every((b) => b.y < 0)) {
          heroObj.placedChain = [];
          heroObj.chainState = 'none';
          return;
        }
      }
      // Check switches & spike shield after settling
      for (let i = 0; i < heroObj.placedChain.length; i++) {
        const b = heroObj.placedChain[i];
        if (this.isSpikeAt(b.x, b.y - 1) || this.isSpikeAt(b.x, b.y)) {
          this.mechanicsExercised.spikeShield = true;
        }
        this._checkSwitchAtCell(b.x, b.y);
      }
    }

    // Action 3: Throw / Toss (Throw)
    throwChain() {
      const p = this.player;
      if (!p || p.activeChain.length === 0) return false;
      if (p.placedChain.length > 0) {
        this._dissolvePlacedChain(p);
      }

      const facing = p.facing || 1;
      const px = Math.round(p.x);
      const py = Math.round(p.y);

      // Normalize chain relative to its minimum x and y so thrown shape lands 2 tiles ahead of player
      const minX = Math.min(...p.activeChain.map((b) => b.x));
      const minY = Math.min(...p.activeChain.map((b) => b.y));
      const startBoxes = p.activeChain.map((b) => ({
        x: px + (b.x - minX) + facing * 0.5,
        y: py + 1.0 + (b.y - minY),
        relX: b.x - minX,
        relY: b.y - minY
      }));

      p.activeChain = [];
      p.placedChain = startBoxes;
      p.chainState = 'thrown';
      p.motionChain = {
        facing,
        startX: px,
        targetLeadX: px + facing * 2,
        vx: facing * 7.5,
        vy: 3.5,
        elapsed: 0
      };
      p.eyeState = 'normal';
      this.drawMode = false;
      this.mechanicsExercised.throw = true;
      if (this.audio) this.audio.boxThrow();
      return true;
    }

    // Action 4: Hook / Retract (Pull / Grapple)
    hookChain() {
      const p = this.player;
      if (!p || p.activeChain.length === 0) return false;

      // Determine anchor point along activeChain (distal box resting on ledge/wall or lateral hook)
      let anchorIdx = -1;
      for (let i = p.activeChain.length - 1; i >= 0; i--) {
        const b = p.activeChain[i];
        if (this.isTerrainSolid(b.x, b.y - 1) || this.isPlacedBoxAt(b.x, b.y - 1, this.activeChar)) {
          anchorIdx = i;
          break;
        }
      }

      // If chain has no solid ledge anchor (e.g. straight vertical chain in open air), retract chain into hero
      if (anchorIdx === -1) {
        p.activeChain = [];
        p.retractQueue = [];
        p.chainState = 'none';
        p.eyeState = 'normal';
        this.drawMode = false;
        this.mechanicsExercised.hook = true;
        if (this.audio) this.audio.boxHook(1);
        return true;
      }

      const waypoints = [];
      for (let i = 0; i <= anchorIdx; i++) {
        waypoints.push({ x: p.activeChain[i].x, y: p.activeChain[i].y });
      }

      p.retractQueue = waypoints;
      p.chainState = 'retracting';
      p.animState = 'retract';
      p.vx = 0;
      p.vy = 0;
      p.eyeState = 'creating';
      this.drawMode = false;
      this.mechanicsExercised.hook = true;
      if (this.audio) this.audio.boxHook(1);
      return true;
    }

    // Action 5: Push / Slide (Shoot)
    shootChain() {
      const p = this.player;
      if (!p) return false;
      let sourceBoxes = [];
      if (p.activeChain.length > 0) {
        sourceBoxes = p.activeChain.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y) }));
        p.activeChain = [];
      } else if (p.placedChain.length > 0) {
        sourceBoxes = p.placedChain.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y) }));
      } else {
        return false;
      }

      const facing = p.facing || 1;
      const py = Math.round(p.y);
      const minY = Math.min(...sourceBoxes.map((b) => b.y));
      // Align bottom of shot chain with player's standing elevation py so it slides across floor/phase bridge
      const aligned = sourceBoxes.map((b) => ({
        x: b.x,
        y: py + (b.y - minY)
      }));

      p.placedChain = aligned;
      p.chainState = 'sliding';
      p.motionChain = {
        facing,
        vx: facing * SHOOT_SPEED
      };
      p.eyeState = 'normal';
      this.drawMode = false;
      this.mechanicsExercised.shoot = true;
      if (this.audio) this.audio.boxShoot();
      return true;
    }

    // Action 6: Erase / Recall (Erase)
    eraseChain() {
      const p = this.player;
      if (!p) return false;
      let hadBoxes = false;
      if (p.activeChain.length > 0) {
        p.activeChain.forEach((b) => this._spawnParticles(b.x + 0.5, b.y + 0.5, '#ffffff', 5));
        p.activeChain = [];
        hadBoxes = true;
      }
      if (p.placedChain.length > 0) {
        this._dissolvePlacedChain(p);
        hadBoxes = true;
      }
      p.eyeState = 'normal';
      this.drawMode = false;
      if (hadBoxes) {
        this.mechanicsExercised.erase = true;
        if (this.audio) this.audio.boxErase();
      }
      this._updateLasers();
      return hadBoxes;
    }

    _dissolvePlacedChain(heroObj) {
      if (!heroObj || !heroObj.placedChain) return;
      heroObj.placedChain.forEach((b) => this._spawnParticles(b.x + 0.5, b.y + 0.5, '#7b7d80', 5));
      heroObj.placedChain = [];
      heroObj.chainState = 'none';
      heroObj.motionChain = null;
    }

    switchHero(targetHero) {
      const isValidHero = targetHero === 'qbby' || targetHero === 'qucy';
      if (this.screen !== 'game') {
        if (isValidHero) {
          this.selectedHero = targetHero;
        } else if (!targetHero) {
          this.selectedHero = this.selectedHero === 'qbby' ? 'qucy' : 'qbby';
        }
        return this.getState();
      }
      const keys = Object.keys(this.heroes);
      if (keys.length >= 2) {
        if (isValidHero && this.heroes[targetHero]) {
          this.activeChar = targetHero;
        } else if (!targetHero) {
          this.activeChar = keys.find((k) => k !== this.activeChar) || this.activeChar;
        }
        this.mechanicsExercised.heroSwitch = true;
        if (this.audio) this.audio.jump();
      } else {
        // Solo stage: toggle visual character between Qbby and Qucy only for valid IDs
        const cur = this.player;
        if (isValidHero) {
          cur.hero = targetHero;
          this.selectedHero = targetHero;
        } else if (!targetHero) {
          const nextType = cur.hero === 'qbby' ? 'qucy' : 'qbby';
          cur.hero = nextType;
          this.selectedHero = nextType;
        }
      }
      return this.getState();
    }

    // =========================================================================
    // DETERMINISTIC PHYSICS LOOP (dt = 1/60s)
    // =========================================================================

    step(dtSeconds = 1 / 60, frames = 1) {
      const dt = Math.min(1 / 30, Math.max(1 / 240, Number(dtSeconds) || 1 / 60));
      const count = Math.max(1, Math.min(600, Math.floor(frames || 1)));
      for (let f = 0; f < count; f++) {
        this._stepSingleFrame(dt);
      }
      if (window.BoxBoyRenderer) {
        window.BoxBoyRenderer.render(this);
      }
      return this.getState();
    }

    _stepSingleFrame(dt) {
      this.time += dt;

      // Update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy -= 9.0 * dt;
        pt.life -= dt;
        if (pt.life <= 0) this.particles.splice(i, 1);
      }

      // Fade ghost trails
      for (let i = this.ghostTrails.length - 1; i >= 0; i--) {
        this.ghostTrails[i].alpha -= dt * 3.2;
        if (this.ghostTrails[i].alpha <= 0) this.ghostTrails.splice(i, 1);
      }

      if (this.screen !== 'game' || !this.stage) return;

      // Update each hero's box chains & physics
      const keys = Object.keys(this.heroes);
      for (let k = 0; k < keys.length; k++) {
        const h = this.heroes[keys[k]];
        this._updateHeroChains(h, dt);
        this._updateHeroPhysics(h, keys[k] === this.activeChar, dt);
      }

      this._updateLasers();
      this._checkCrownsAndHazards();

      if (this.goalReached && this.doorOpenProgress < 1) {
        this.doorOpenProgress = Math.min(1, this.doorOpenProgress + dt * 3.5);
      }
    }

    _updateHeroChains(h, dt) {
      // 1. Thrown chain ballistic arc
      if (h.chainState === 'thrown' && h.motionChain) {
        const mc = h.motionChain;
        mc.elapsed += dt;
        const stepX = mc.vx * dt;
        const stepY = mc.vy * dt;
        mc.vy -= GRAVITY * 0.72 * dt;

        // Advance horizontally up to targetLeadX (2 tiles ahead of throw origin)
        for (let i = 0; i < h.placedChain.length; i++) {
          const b = h.placedChain[i];
          const targetX = mc.targetLeadX + b.relX;
          if ((mc.facing > 0 && b.x + stepX <= targetX) || (mc.facing < 0 && b.x + stepX >= targetX)) {
            if (!this.isTerrainSolid(Math.round(b.x + stepX), Math.round(b.y))) {
              b.x += stepX;
            }
          } else {
            b.x = targetX;
          }
          b.y += stepY;
        }

        // Check landing once descending (vy <= 0)
        if (mc.vy <= 0) {
          const snapped = h.placedChain.map((b) => ({
            x: Math.round(b.x),
            y: Math.max(0, Math.floor(b.y))
          }));
          if (this._isChainSupported(snapped, h.hero) || mc.elapsed > 0.45) {
            h.placedChain = snapped;
            h.chainState = 'placed';
            h.motionChain = null;
            this._settlePlacedChain(h);
            if (this.audio) this.audio.boxPlace();
          }
        }
      }

      // 2. Sliding / Shot chain (Push / Shoot)
      if (h.chainState === 'sliding' && h.motionChain) {
        const mc = h.motionChain;
        const dir = mc.facing;
        const moveX = mc.vx * dt;

        // Record motion blur trail
        h.placedChain.forEach((b) => {
          this.ghostTrails.push({ x: b.x, y: b.y, alpha: 0.38 });
        });

        const leadX = dir > 0
          ? Math.max(...h.placedChain.map((b) => b.x))
          : Math.min(...h.placedChain.map((b) => b.x));
        const newLeadX = leadX + moveX;
        const probeCol = dir > 0 ? Math.floor(newLeadX + 1.0) : Math.floor(newLeadX);
        const leadY = Math.round(h.placedChain[0].y);

        // Check if leading edge hits a Wall Switch first
        let hitSwitch = false;
        for (let i = 0; i < this.switches.length; i++) {
          const sw = this.switches[i];
          if (!sw.active && sw.y === leadY && probeCol === sw.x) {
            this._activateSwitch(sw);
            hitSwitch = true;
          }
        }

        // Check if leading edge hits a solid wall
        let hitWall = false;
        for (let i = 0; i < h.placedChain.length; i++) {
          const b = h.placedChain[i];
          const bNewX = b.x + moveX;
          const bProbeCol = dir > 0 ? Math.floor(bNewX + 1.0) : Math.floor(bNewX);
          if (this.isTerrainSolid(bProbeCol, Math.round(b.y))) {
            hitWall = true;
            break;
          }
        }

        if (hitSwitch || hitWall) {
          const snapLeadX = dir > 0 ? probeCol - 1 : probeCol + 1;
          h.placedChain = h.placedChain.map((b) => ({
            x: snapLeadX - Math.round(leadX - b.x),
            y: Math.round(b.y)
          }));
          h.chainState = 'placed';
          h.motionChain = null;
          this._settlePlacedChain(h);
          this._updateLasers();
        } else {
          for (let i = 0; i < h.placedChain.length; i++) {
            h.placedChain[i].x += moveX;
          }
        }
      }

      // 3. Hook / Retract grapple trajectory
      if (h.chainState === 'retracting') {
        if (h.retractQueue.length === 0) {
          h.chainState = 'none';
          h.activeChain = [];
          h.animState = 'idle';
          h.eyeState = 'normal';
          return;
        }
        const target = h.retractQueue[0];
        const dx = target.x - h.x;
        const dy = target.y - h.y;
        const dist = Math.hypot(dx, dy);
        const stepDist = RETRACT_SPEED * dt;
        if (dist <= stepDist) {
          h.x = target.x;
          h.y = target.y;
          h.retractQueue.shift();
          if (h.activeChain.length > 0) h.activeChain.shift();
          if (this.audio && h.retractQueue.length > 0) {
            this.audio.boxHook(6 - Math.min(5, h.retractQueue.length));
          }
        } else {
          h.x += (dx / dist) * stepDist;
          h.y += (dy / dist) * stepDist;
        }
        h.vx = 0;
        h.vy = 0;
        h.grounded = false;
      }
    }

    _updateHeroPhysics(h, isActive, dt) {
      if (h.chainState === 'retracting' || this.stageCleared) return;

      // Smooth squash & stretch recovery
      h.scaleX += (1.0 - h.scaleX) * Math.min(1, dt * 14);
      h.scaleY += (1.0 - h.scaleY) * Math.min(1, dt * 14);

      // Horizontal velocity from input
      let moveDir = 0;
      if (isActive && !this.drawMode) {
        if (this.inputState.left) moveDir -= 1;
        if (this.inputState.right) moveDir += 1;
      }
      if (moveDir !== 0) {
        h.facing = moveDir;
        h.vx = moveDir * MOVE_SPEED;
        if (h.grounded) {
          h.animState = 'walk';
          h.walkPhase += dt * 16;
          if (this.audio) this.audio.step();
        }
      } else {
        h.vx = 0;
        if (h.grounded) h.animState = 'idle';
      }

      // Move horizontally & resolve X collisions
      if (h.vx !== 0) {
        const nextX = h.x + h.vx * dt;
        if (!this._collidesHeroAABB(nextX, h.y)) {
          h.x = nextX;
          // Shift held activeChain with hero if walking
          if (h.activeChain.length > 0) {
            for (let i = 0; i < h.activeChain.length; i++) {
              h.activeChain[i].x += h.vx * dt;
            }
          }
        } else {
          if (h.vx > 0) {
            h.x = Math.floor(nextX + 0.88) - 0.8801;
          } else {
            h.x = Math.floor(nextX + 0.12) + 1 - 0.1199;
          }
          h.vx = 0;
        }
      }

      // Apply gravity & resolve Y collisions
      h.vy = Math.max(-18.0, h.vy - GRAVITY * dt);
      const nextY = h.y + h.vy * dt;

      if (!this._collidesHeroAABB(h.x, nextY)) {
        h.y = nextY;
        h.grounded = false;
        if (Math.abs(h.vy) > 0.5) h.animState = 'jump';
      } else {
        if (h.vy < 0) {
          // Landed on floor/box
          const landedRow = Math.floor(nextY) + 1;
          if (!h.grounded && h.vy < -3.0) {
            h.scaleX = 1.16;
            h.scaleY = 0.84;
          }
          h.y = landedRow;
          h.vy = 0;
          h.grounded = true;
        } else {
          // Hit ceiling
          h.y = Math.floor(nextY);
          h.vy = 0;
        }
      }

      // Touching a wall switch directly with hero body activates it
      const gx = Math.round(h.x);
      const gy = Math.round(h.y);
      this._checkSwitchAtCell(gx, gy);
      this._checkSwitchAtCell(gx + h.facing, gy);

      // Check bottomless pit fall
      if (h.y < -1.5) {
        this._onHeroHazardHit(h);
      }
    }

    _collidesHeroAABB(hx, hy) {
      // Hero hitbox: horizontally [hx + 0.12, hx + 0.88], vertically [hy + 0.02, hy + 0.88]
      const minX = Math.floor(hx + 0.12);
      const maxX = Math.floor(hx + 0.88);
      const minY = Math.floor(hy + 0.02);
      const maxY = Math.floor(hy + 0.88);

      for (let gy = minY; gy <= maxY; gy++) {
        for (let gx = minX; gx <= maxX; gx++) {
          if (this.isSolidForPlayer(gx, gy)) {
            return true;
          }
        }
      }
      return false;
    }

    _checkCrownsAndHazards() {
      const keys = Object.keys(this.heroes);
      for (let k = 0; k < keys.length; k++) {
        const h = this.heroes[keys[k]];
        const cx = h.x + 0.5;
        const cy = h.y + 0.45;

        // 1. Collectible Crowns
        for (let i = 0; i < this.crowns.length; i++) {
          const cr = this.crowns[i];
          if (!cr.collected) {
            if (Math.abs(cx - (cr.x + 0.5)) < 0.78 && Math.abs(cy - (cr.y + 0.4)) < 0.85) {
              cr.collected = true;
              this._spawnParticles(cr.x + 0.5, cr.y + 0.5, '#ffd426', 10);
              if (this.audio) this.audio.crownPickup();
            }
          }
        }

        if (h.chainState === 'retracting') continue;

        // 2. Floor Spikes (lethal unless shielded by a placed box at the spike cell)
        const gx = Math.round(h.x);
        const gy = Math.floor(h.y + 0.15);
        if (this.isSpikeAt(gx, gy) && !this.isPlacedBoxAt(gx, gy, null) && !this.isPlacedBoxAt(gx, gy + 1, null)) {
          this._onHeroHazardHit(h);
          return;
        }

        // 3. Active Vertical Yellow Lasers
        for (let i = 0; i < this.lasers.length; i++) {
          const ls = this.lasers[i];
          for (let j = 0; j < ls.activeCells.length; j++) {
            const lc = ls.activeCells[j];
            if (Math.abs(cx - (lc.x + 0.5)) < 0.65 && Math.abs(cy - (lc.y + 0.5)) < 0.65) {
              this._onHeroHazardHit(h);
              return;
            }
          }
        }

        // 4. Goal Door proximity check
        const gd = this.stage.goalDoor;
        if (gd && Math.abs(h.x - gd.x) <= 0.85 && Math.abs(h.y - gd.y) <= 0.6 && h.grounded) {
          h.inDoor = true;
        } else {
          h.inDoor = false;
        }
      }

      // Auto-complete stage when all heroes in stage are at Goal Door
      const allInDoor = Object.values(this.heroes).every((h) => h.inDoor);
      if (allInDoor && !this.stageCleared) {
        this._completeStage();
      }
    }

    _onHeroHazardHit(h) {
      h.eyeState = 'hurt';
      this._spawnParticles(h.x + 0.5, h.y + 0.5, '#ffffff', 10);
      if (this.audio) this.audio.hurt();
      // Reset current stage attempt cleanly so budget medal remains achievable
      this._initStageState(this.stageIndex, true);
    }

    _completeStage() {
      if (this.stageCleared) return;
      this.goalReached = true;
      this.stageCleared = true;
      this.doorOpenProgress = 1;
      this.screen = 'clear';

      Object.values(this.heroes).forEach((h) => {
        h.eyeState = 'clear';
        h.animState = 'clear';
        h.vx = 0;
      });

      const crownsCollected = this.crowns.filter((c) => c.collected).length;
      const crownsTotal = this.crowns.length;
      const allCrowns = crownsCollected >= crownsTotal;
      const withinBudget = this.boxesUsed <= this.stage.targetBoxBudget;

      if (allCrowns && withinBudget) {
        this.medalEarned = 3; // Gold ⭐⭐⭐
      } else if (allCrowns || withinBudget) {
        this.medalEarned = 2; // Silver ⭐⭐
      } else {
        this.medalEarned = 1; // Bronze ⭐
      }

      // Persist best result to localStorage
      const prev = this.progress[this.stage.id] || { cleared: false, crowns: 0, crownsTotal, medal: 0, bestBoxes: null };
      this.progress[this.stage.id] = {
        cleared: true,
        crowns: Math.max(prev.crowns || 0, crownsCollected),
        crownsTotal,
        medal: Math.max(prev.medal || 0, this.medalEarned),
        bestBoxes: prev.bestBoxes === null ? this.boxesUsed : Math.min(prev.bestBoxes, this.boxesUsed)
      };
      this._saveProgress();

      if (this.audio) this.audio.stageClear();
    }

    // =========================================================================
    // ACTION INJECTION & AUTOMATED SOLUTION RUNNER (window.__BOXBOY__)
    // =========================================================================

    jump() {
      const p = this.player;
      if (!p || this.screen !== 'game' || this.stageCleared) return false;
      if (p.grounded && p.chainState !== 'retracting') {
        p.vy = JUMP_VEL;
        p.grounded = false;
        p.animState = 'jump';
        p.scaleX = 0.86;
        p.scaleY = 1.16;
        if (this.audio) this.audio.jump();
        return true;
      }
      return false;
    }

    injectAction(action) {
      if (!action) return this.getState();
      if (typeof action === 'string') {
        action = { type: action };
      }

      const type = action.type;
      const p = this.player;

      switch (type) {
        case 'navigate': {
          if (action.stageIndex !== undefined) {
            this.loadStage(action.stageIndex);
          }
          if (action.screen) {
            this.screen = action.screen;
          }
          break;
        }
        case 'move': {
          const dir = Number(action.dir) || 0;
          this.inputState.left = dir < 0;
          this.inputState.right = dir > 0;
          if (dir !== 0 && p) p.facing = dir > 0 ? 1 : -1;
          if (action.frames) {
            this.step(1 / 60, action.frames);
            this.inputState.left = false;
            this.inputState.right = false;
          }
          break;
        }
        case 'walkTo': {
          const targetX = Number(action.x);
          const maxFrames = action.maxFrames || 360;
          for (let f = 0; f < maxFrames; f++) {
            const cur = this.player;
            if (!cur || this.stageCleared) break;
            const diff = targetX - cur.x;
            if (Math.abs(diff) <= 0.09 && cur.grounded) {
              cur.x = targetX;
              cur.vx = 0;
              break;
            }
            const dir = diff > 0 ? 1 : -1;
            this.inputState.left = dir < 0;
            this.inputState.right = dir > 0;
            this._stepSingleFrame(1 / 60);
          }
          this.inputState.left = false;
          this.inputState.right = false;
          // Settle on ground if descending from a ledge
          for (let s = 0; s < 25 && this.player && !this.player.grounded && !this.stageCleared; s++) {
            this._stepSingleFrame(1 / 60);
          }
          if (this.player && Math.abs(this.player.x - targetX) <= 0.15) {
            this.player.x = targetX;
          }
          break;
        }
        case 'jump': {
          const dir = action.dir !== undefined ? Number(action.dir) : 0;
          const hasTargetX = action.targetX !== undefined && Number.isFinite(Number(action.targetX));
          const targetX = hasTargetX ? Number(action.targetX) : null;
          this.inputState.left = dir < 0;
          this.inputState.right = dir > 0;
          if (dir !== 0 && p) p.facing = dir > 0 ? 1 : -1;
          this.jump();
          const frames = action.frames !== undefined ? Number(action.frames) : 65;
          for (let f = 0; f < frames && !this.stageCleared; f++) {
            if (hasTargetX && this.player) {
              if ((dir > 0 && this.player.x >= targetX) || (dir < 0 && this.player.x <= targetX)) {
                this.player.x = targetX;
                this.player.vx = 0;
                this.inputState.left = false;
                this.inputState.right = false;
              }
            }
            this._stepSingleFrame(1 / 60);
            if (f > 6 && this.player && this.player.grounded) break;
          }
          this.inputState.left = false;
          this.inputState.right = false;
          break;
        }
        case 'startDraw':
        case 'toggleDraw': {
          this.drawMode = !this.drawMode;
          if (p) p.eyeState = this.drawMode ? 'creating' : 'normal';
          break;
        }
        case 'extendDir': {
          this.extendDir(action.dir);
          break;
        }
        case 'createChain': {
          this.createChain(action.dirs || []);
          break;
        }
        case 'place':
        case 'drop': {
          this.placeChain();
          this.step(1 / 60, 4);
          break;
        }
        case 'throw': {
          this.throwChain();
          for (let f = 0; f < 45 && this.player && this.player.chainState === 'thrown'; f++) {
            this._stepSingleFrame(1 / 60);
          }
          break;
        }
        case 'hook':
        case 'retract':
        case 'pull': {
          this.hookChain();
          for (let f = 0; f < 90 && this.player && this.player.chainState === 'retracting'; f++) {
            this._stepSingleFrame(1 / 60);
          }
          for (let s = 0; s < 15 && this.player && !this.player.grounded && !this.stageCleared; s++) {
            this._stepSingleFrame(1 / 60);
          }
          break;
        }
        case 'shoot':
        case 'push':
        case 'slide': {
          this.shootChain();
          for (let f = 0; f < 90 && this.player && this.player.chainState === 'sliding'; f++) {
            this._stepSingleFrame(1 / 60);
          }
          break;
        }
        case 'erase': {
          this.eraseChain();
          break;
        }
        case 'switchHero': {
          this.switchHero(action.hero);
          break;
        }
        case 'enterDoor': {
          const gd = this.stage && this.stage.goalDoor;
          if (gd && p && Math.abs(p.x - gd.x) <= 1.2 && Math.abs(p.y - gd.y) <= 1.0) {
            p.inDoor = true;
            this._completeStage();
          }
          break;
        }
        case 'toggleMute': {
          if (this.audio) {
            if (typeof action.muted === 'boolean') {
              this.audio.setMuted(action.muted);
            } else {
              this.audio.toggleMute();
            }
          }
          break;
        }
        default:
          break;
      }

      if (window.BoxBoyRenderer) {
        window.BoxBoyRenderer.render(this);
      }
      return this.getState();
    }

    runStageSolution(stageIndexOrId) {
      const idx = this._resolveStageIndex(stageIndexOrId);
      if (idx === -1) {
        return { ok: false, error: 'Invalid stage index or ID' };
      }
      this._initStageState(idx, true);
      const steps = this.stage.solution || [];
      for (let i = 0; i < steps.length; i++) {
        this.injectAction(steps[i]);
      }
      const st = this.getState();
      return {
        ok: Boolean(st.stageCleared && st.crownsCollected === st.crownsTotal && st.boxesUsed <= st.targetBoxBudget),
        stageIndex: st.stageIndex,
        stageId: st.stageId,
        goalReached: st.goalReached,
        stageCleared: st.stageCleared,
        crownsCollected: st.crownsCollected,
        crownsTotal: st.crownsTotal,
        totalCrowns: st.crownsTotal,
        boxesUsed: st.boxesUsed,
        targetBoxBudget: st.targetBoxBudget,
        medalEarned: st.medalEarned,
        mechanicsExercised: Object.assign({}, st.mechanicsExercised)
      };
    }

    runAllSolutions() {
      const results = [];
      for (let i = 0; i < this.stages.length; i++) {
        results.push(this.runStageSolution(i));
      }
      return results;
    }

    getState() {
      const p = this.player;
      const part = this.partner;
      const crownsCollected = this.crowns.filter((c) => c.collected).length;
      const crownsTotal = this.crowns.length;

      return {
        screen: this.screen,
        stageIndex: this.stageIndex,
        stageId: this.stage ? this.stage.id : null,
        world: this.stage ? this.stage.world : 1,
        stage: this.stage ? this.stage.stage : 1,
        hero: p ? p.hero : this.selectedHero,
        activeChar: this.activeChar,
        player: p
          ? {
              x: Number(p.x.toFixed(3)),
              y: Number(p.y.toFixed(3)),
              vx: Number(p.vx.toFixed(3)),
              vy: Number(p.vy.toFixed(3)),
              grounded: p.grounded,
              facing: p.facing,
              eyeState: p.eyeState,
              animState: p.animState
            }
          : null,
        partner: part
          ? {
              hero: part.hero,
              x: Number(part.x.toFixed(3)),
              y: Number(part.y.toFixed(3)),
              vx: Number(part.vx.toFixed(3)),
              vy: Number(part.vy.toFixed(3)),
              grounded: part.grounded,
              facing: part.facing,
              eyeState: part.eyeState
            }
          : null,
        boxLimit: this.stage ? this.stage.boxLimit : 1,
        targetBoxBudget: this.stage ? this.stage.targetBoxBudget : 3,
        boxesUsed: this.boxesUsed,
        drawMode: this.drawMode,
        activeChain: p ? p.activeChain.map((b) => ({ x: Number(b.x.toFixed(2)), y: Number(b.y.toFixed(2)) })) : [],
        placedChain: p ? p.placedChain.map((b) => ({ x: Number(b.x.toFixed(2)), y: Number(b.y.toFixed(2)) })) : [],
        partnerPlacedChain: part ? part.placedChain.map((b) => ({ x: Number(b.x.toFixed(2)), y: Number(b.y.toFixed(2)) })) : [],
        crownsTotal,
        totalCrowns: crownsTotal,
        crownsCollected,
        crowns: this.crowns.map((c) => ({ id: c.id, x: c.x, y: c.y, collected: c.collected })),
        switches: this.switches.map((s) => ({ id: s.id, color: s.color, x: s.x, y: s.y, active: s.active })),
        lasers: this.lasers.map((l) => ({
          id: l.id,
          x: l.x,
          y: l.y,
          maxY: l.maxY,
          dir: 'up',
          blockedByBox: l.blockedByBox,
          activeCells: l.activeCells
        })),
        goalDoor: this.stage ? this.stage.goalDoor : null,
        goalReached: this.goalReached,
        stageCleared: this.stageCleared,
        medalEarned: this.medalEarned,
        muted: this.audio ? this.audio.muted : false,
        mechanicsExercised: Object.assign({}, this.mechanicsExercised),
        progress: JSON.parse(JSON.stringify(this.progress))
      };
    }
  }

  const engine = new BoxBoyEngine();
  window.BoxBoyEngine = engine;

  window.__BOXBOY__ = {
    loadStage: (idx) => engine.loadStage(idx),
    getState: () => engine.getState(),
    step: (dt, frames) => engine.step(dt, frames),
    pause: () => {
      engine.paused = true;
    },
    resume: () => {
      engine.paused = false;
    },
    injectAction: (action) => engine.injectAction(action),
    runStageSolution: (idx) => engine.runStageSolution(idx),
    runAllSolutions: () => engine.runAllSolutions()
  };
})();
