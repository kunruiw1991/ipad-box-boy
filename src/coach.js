/**
 * Zero-Text Step-by-Step Guide Coach for BoxBoy! + Box Girl! (iPad Edition).
 *
 * Every stage ships a verified solution (src/stages.js). The coach replays that
 * solution once in a hidden headless engine to record a per-step trace
 * (pre/post snapshots of hero position, box chains, crowns and switches). Each
 * frame it matches the live game against the trace and publishes exactly ONE
 * next action: the on-screen button to tap, plus a canvas preview of the target
 * (walk pad, jump arc, ghost boxes, hook path, slide path, door).
 *
 * When the player drifts off the plan it walks them back to the right spot,
 * rewinds to rebuild a missing box chain, or, as a last resort, points at the
 * restart button. Outside gameplay it points at the Play button, the next
 * uncleared stage on the map, and the Next button on the Stage Clear card.
 */
(function () {
  'use strict';

  const HINT_STORAGE_KEY = 'boxboy_ipad_hints_v1';
  const WALK_TOL = 0.22; // walk target reached
  const LAND_TOL = 0.45; // jump / hook landing reached
  // Building and jumping start from the exact planned spot (walk hints park the hero
  // there precisely), so a half-tile offset can never misplace a box or a jump.
  const TAKEOFF_TOL = 0.15;
  const BUILD_TOL = 0.15;
  const Y_TOL = 0.35; // same floor level
  const LOST_GRACE_S = 1.2; // seconds off-plan before pointing at restart

  const CHAIN_ACTIONS = { place: true, throw: true, hook: true, shoot: true };
  const OWN_CHAIN_STEPS = { createChain: true, place: true, throw: true, hook: true, shoot: true };
  const DIR_BUTTON = { up: 'btn-up', down: 'btn-down', left: 'btn-left', right: 'btn-right' };

  function cellsOf(chain) {
    return (chain || []).map((b) => ({ x: Math.round(b.x), y: Math.round(b.y) }));
  }

  function sameCells(a, b) {
    const aa = a || [];
    const bb = b || [];
    if (aa.length !== bb.length) return false;
    const keys = new Set(aa.map((c) => c.x + ',' + c.y));
    return bb.every((c) => keys.has(c.x + ',' + c.y));
  }

  function isOrderedPrefix(live, target) {
    if (live.length > target.length) return false;
    for (let i = 0; i < live.length; i++) {
      if (live[i].x !== target[i].x || live[i].y !== target[i].y) return false;
    }
    return true;
  }

  function snapshot(eng) {
    const heroes = {};
    Object.keys(eng.heroes).forEach((k) => {
      const h = eng.heroes[k];
      heroes[k] = {
        x: h.x,
        y: h.y,
        grounded: h.grounded,
        chainState: h.chainState,
        active: cellsOf(h.activeChain),
        placed: h.chainState === 'placed' ? cellsOf(h.placedChain) : []
      };
    });
    const p = eng.player;
    return {
      char: eng.activeChar,
      x: p ? p.x : 0,
      y: p ? p.y : 0,
      grounded: p ? p.grounded : true,
      drawMode: Boolean(eng.drawMode),
      heroes,
      crowns: eng.crowns.filter((c) => c.collected).map((c) => c.id),
      switches: eng.switches.filter((s) => s.active).map((s) => s.id),
      cleared: Boolean(eng.stageCleared)
    };
  }

  // A placed chain matters to a step when it lies on (or right next to) the
  // stretch of ground the hero covers during that step: stair boxes, bridges,
  // spike shields and laser caps all qualify.
  function chainUsedByStep(cells, pre, post) {
    const lo = Math.min(pre.x, post.x) - 0.5;
    const hi = Math.max(pre.x, post.x) + 1.5;
    return cells.some((c) => c.x >= lo && c.x <= hi);
  }

  class BoxBoyCoach {
    constructor(engine) {
      this.engine = engine;
      this.enabled = this._loadEnabled();
      this.trace = null;
      this.traceKey = null;
      this.idx = 0;
      this.epoch = -1;
      this.flags = this._emptyFlags();
      this.hint = null;
      this.hintKey = 'none';
      this.hintSince = 0;
      this.time = 0;
      this.unmatchedSince = null;
      if (engine && typeof engine.addListener === 'function') {
        engine.addListener((type) => this._onEngineEvent(type));
      }
    }

    // -----------------------------------------------------------------------
    // Settings
    // -----------------------------------------------------------------------

    _loadEnabled() {
      try {
        const v = window.localStorage.getItem(HINT_STORAGE_KEY);
        return v === null ? true : v === '1';
      } catch (e) {
        return true;
      }
    }

    setEnabled(on) {
      this.enabled = Boolean(on);
      try {
        window.localStorage.setItem(HINT_STORAGE_KEY, this.enabled ? '1' : '0');
      } catch (e) {}
      if (!this.enabled) this._setHint(null);
      return this.enabled;
    }

    toggle() {
      return this.setEnabled(!this.enabled);
    }

    _emptyFlags() {
      return { jumped: false, thrown: false, hooked: false, shot: false };
    }

    _onEngineEvent(type) {
      if (type === 'jump') this.flags.jumped = true;
      else if (type === 'throw') this.flags.thrown = true;
      else if (type === 'hook') this.flags.hooked = true;
      else if (type === 'shoot') this.flags.shot = true;
    }

    // -----------------------------------------------------------------------
    // Trace construction: hidden headless replay of the verified solution
    // -----------------------------------------------------------------------

    _ensureTrace() {
      const eng = this.engine;
      const st = eng.stage;
      if (!st) return null;
      const key = st.partnerSpawn ? st.id : st.id + ':' + eng.activeChar;
      if (this.traceKey === key && this.trace) return this.trace;
      this.traceKey = key;
      this.trace = this._buildTrace(eng.stageIndex, st.partnerSpawn ? null : eng.activeChar);
      this.idx = 0;
      this.flags = this._emptyFlags();
      return this.trace;
    }

    _buildTrace(stageIndex, soloHero) {
      const Cls = window.BoxBoyEngineClass;
      if (!Cls) return null;
      let shadow = null;
      try {
        shadow = new Cls({ headless: true });
        if (soloHero) shadow.selectedHero = soloHero;
        shadow._initStageState(stageIndex, true);
      } catch (e) {
        return null;
      }
      const solution = (shadow.stage && shadow.stage.solution) || [];
      const steps = [];
      const chainStartBy = {};
      const placedBy = {};
      for (let i = 0; i < solution.length; i++) {
        const step = solution[i];
        const pre = snapshot(shadow);
        const rec = {
          i,
          step,
          type: step.type,
          pre,
          post: null,
          chainStart: chainStartBy[pre.char] !== undefined ? chainStartBy[pre.char] : -1,
          placedOrigin: Object.assign({}, placedBy),
          needs: {}
        };
        if (step.type === 'createChain') {
          rec.chainStart = i;
          chainStartBy[pre.char] = i;
        }
        try {
          shadow.injectAction(step);
          // Let an airborne hero land before snapshotting: some planned jumps only
          // hold the direction for a fixed number of frames. Live play cannot act
          // mid-air either (the hint waits for touchdown), so post states are
          // always grounded, reachable resting spots.
          shadow.inputState.left = false;
          shadow.inputState.right = false;
          for (let f = 0; f < 120 && shadow.player && !shadow.player.grounded && !shadow.stageCleared; f++) {
            shadow._stepSingleFrame(1 / 60);
          }
        } catch (e) {
          break;
        }
        rec.post = snapshot(shadow);

        Object.keys(pre.heroes).forEach((k) => {
          const cells = pre.heroes[k].placed;
          if (!cells.length) return;
          if (k === pre.char && OWN_CHAIN_STEPS[step.type]) return;
          if (chainUsedByStep(cells, pre, rec.post)) rec.needs[k] = true;
        });

        if (step.type === 'createChain' || step.type === 'erase') delete placedBy[pre.char];
        if (step.type === 'place' || step.type === 'throw' || step.type === 'shoot') {
          placedBy[pre.char] = rec.chainStart;
        }
        steps.push(rec);
      }
      return { stageIndex, steps, solved: Boolean(shadow.stageCleared) };
    }

    // -----------------------------------------------------------------------
    // Per-frame update
    // -----------------------------------------------------------------------

    update(dt) {
      this.time += dt || 0;
      const eng = this.engine;
      if (!this.enabled || !eng) return this._setHint(null);

      if (eng.screen === 'title') {
        return this._setHint({ region: 'play', mode: 'tap', key: 'region:play' });
      }
      if (eng.screen === 'map') {
        const target = this._suggestedStage();
        return this._setHint({ region: 'map' + target, mode: 'tap', key: 'region:map' + target });
      }
      if (eng.screen === 'clear') {
        return this._setHint({ region: 'clearNext', mode: 'tap', key: 'region:clearNext' });
      }
      if (eng.screen !== 'game' || !eng.stage || !eng.player) return this._setHint(null);

      if (eng.stageEpoch !== this.epoch) {
        this.epoch = eng.stageEpoch;
        this.idx = 0;
        this.flags = this._emptyFlags();
        this.unmatchedSince = null;
      }
      const trace = this._ensureTrace();
      if (!trace || trace.steps.length === 0) return this._setHint(null);

      const live = snapshot(eng);
      let hint = null;
      for (let guard = 0; guard < 16; guard++) {
        const rec = trace.steps[this.idx];
        if (!rec) {
          hint = null;
          break;
        }
        if (this._isDone(rec, live)) {
          this._goto(this.idx + 1);
          continue;
        }
        if (this._inMotion(live)) {
          hint = this._stepHint(rec, live);
          break;
        }
        const fix = this._preconditions(rec, live);
        if (fix && fix.goto !== undefined && fix.goto !== this.idx) {
          this._goto(fix.goto);
          continue;
        }
        if (fix && fix.resync) {
          const k = this._resync(live);
          if (k !== -1 && k !== this.idx) {
            this._goto(k);
            continue;
          }
          hint = this._lostHint();
          break;
        }
        this.unmatchedSince = null;
        hint = (fix && fix.hint) || this._stepHint(rec, live);
        break;
      }
      return this._setHint(hint);
    }

    _goto(i) {
      this.idx = Math.max(0, i);
      this.flags = this._emptyFlags();
    }

    _multiHero() {
      return Object.keys(this.engine.heroes).length > 1;
    }

    _inMotion(live) {
      if (!live.grounded) return true;
      return Object.keys(live.heroes).some((k) => {
        const cs = live.heroes[k].chainState;
        return cs === 'thrown' || cs === 'sliding' || cs === 'retracting';
      });
    }

    _suggestedStage() {
      const eng = this.engine;
      for (let i = 0; i < eng.stages.length; i++) {
        const pr = eng.progress[eng.stages[i].id];
        if (!pr || !pr.cleared) return i;
      }
      return eng.stageIndex;
    }

    // -----------------------------------------------------------------------
    // Step completion
    // -----------------------------------------------------------------------

    _isDone(rec, live) {
      const pre = rec.pre;
      const post = rec.post;
      if (!post) return false;
      if (this._multiHero() && rec.type !== 'switchHero' && live.char !== post.char) return false;
      const liveH = live.heroes[live.char] || { active: [], placed: [] };
      const postH = post.heroes[post.char] || { active: [], placed: [] };
      const crownsOk = post.crowns.every((id) => pre.crowns.indexOf(id) !== -1 || live.crowns.indexOf(id) !== -1);
      const switchesOk = post.switches.every((id) => pre.switches.indexOf(id) !== -1 || live.switches.indexOf(id) !== -1);
      const near = (tol) => Math.abs(live.x - post.x) <= tol && Math.abs(live.y - post.y) <= Y_TOL;

      switch (rec.type) {
        case 'walkTo':
          return live.grounded && near(WALK_TOL) && crownsOk && switchesOk;
        case 'jump':
          return this.flags.jumped && live.grounded && near(LAND_TOL) && crownsOk && switchesOk;
        case 'createChain':
          return sameCells(liveH.active, postH.active);
        case 'place':
          return liveH.active.length === 0 && liveH.chainState === 'placed' && sameCells(liveH.placed, postH.placed);
        case 'throw':
          return this.flags.thrown && liveH.chainState === 'placed' && sameCells(liveH.placed, postH.placed);
        case 'shoot':
          return this.flags.shot && liveH.chainState === 'placed' && sameCells(liveH.placed, postH.placed) && switchesOk;
        case 'hook':
          return this.flags.hooked && liveH.chainState !== 'retracting' && live.grounded && near(LAND_TOL) && crownsOk;
        case 'switchHero':
          return live.char === post.char;
        case 'enterDoor':
          return live.cleared;
        default:
          return true;
      }
    }

    // -----------------------------------------------------------------------
    // Preconditions & recovery
    // -----------------------------------------------------------------------

    _missingChain(rec, live) {
      const keys = Object.keys(rec.needs || {});
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const want = rec.pre.heroes[k].placed;
        const liveH = live.heroes[k];
        if (liveH && liveH.chainState === 'placed' && sameCells(liveH.placed, want)) continue;
        if (liveH && (liveH.chainState === 'thrown' || liveH.chainState === 'sliding')) continue;
        return { hero: k, origin: rec.placedOrigin[k] !== undefined ? rec.placedOrigin[k] : -1 };
      }
      return null;
    }

    _preconditions(rec, live) {
      const pre = rec.pre;
      const liveH = live.heroes[live.char] || { active: [], placed: [] };

      // 1. Co-op finale: the planned hero must be the active one.
      if (this._multiHero() && rec.type !== 'switchHero' && live.char !== pre.char) {
        return { hint: this._heroHint(pre.char) };
      }

      // 2. Boxes this step stands on / relies on must still be there.
      const missing = this._missingChain(rec, live);
      if (missing) {
        if (missing.origin >= 0 && missing.origin < this.idx) return { goto: missing.origin };
        return { resync: true };
      }

      // 3. Drop / throw / hook / shoot need exactly the planned held chain.
      if (CHAIN_ACTIONS[rec.type]) {
        if (!sameCells(liveH.active, pre.heroes[pre.char].active)) {
          return rec.chainStart >= 0 && rec.chainStart < this.idx ? { goto: rec.chainStart } : { resync: true };
        }
        return null;
      }

      // 4. Stand on the planned spot before building boxes or jumping.
      if (rec.type === 'createChain' || rec.type === 'jump') {
        if (rec.type === 'createChain' && liveH.active.length > 0) return null; // building in progress
        const dx = Math.abs(live.x - pre.x);
        const dy = Math.abs(live.y - pre.y);
        const atSpot = rec.type === 'createChain'
          ? dx <= BUILD_TOL && dy <= Y_TOL && Math.round(live.x) === Math.round(pre.x)
          : dx <= TAKEOFF_TOL && dy <= Y_TOL;
        if (atSpot) {
          if (rec.type === 'jump' && this.engine.drawMode) return { hint: this._exitDrawHint(live, pre) };
          return null;
        }
        if (dy <= Y_TOL && this._walkable(live, pre.x)) {
          return { hint: this._walkHint(pre.x, pre.y, live, false), walkable: true };
        }
        return { resync: true };
      }

      // 5. Walking: must start on the planned floor (or already be on the goal floor).
      if (rec.type === 'walkTo') {
        if (Math.abs(live.y - pre.y) > Y_TOL && Math.abs(live.y - rec.post.y) > Y_TOL) return { resync: true };
      }
      return null;
    }

    _resync(live) {
      const steps = this.trace.steps;
      const fits = (k) => {
        const rec = steps[k];
        if (CHAIN_ACTIONS[rec.type] || rec.type === 'switchHero' || rec.type === 'enterDoor') return false;
        if (this._multiHero() && rec.pre.char !== live.char) return false;
        if (Math.abs(live.y - rec.pre.y) > Y_TOL) return false;
        if (this._missingChain(rec, live)) return false;
        return this._walkable(live, rec.pre.x);
      };
      for (let k = this.idx + 1; k < steps.length; k++) {
        if (fits(k)) return k;
      }
      for (let k = this.idx - 1; k >= 0; k--) {
        if (fits(k)) return k;
      }
      return -1;
    }

    _laserAt(gx, gy) {
      return this.engine.lasers.some((ls) => ls.activeCells.some((c) => c.x === gx && c.y === gy));
    }

    // Can the hero walk along its current floor to targetX without a wall,
    // gap, unshielded spike or live laser in between?
    _walkable(live, targetX) {
      const eng = this.engine;
      const y = Math.round(live.y);
      const x0 = Math.round(live.x);
      const x1 = Math.round(targetX);
      const dir = x1 >= x0 ? 1 : -1;
      for (let x = x0; ; x += dir) {
        if (x !== x0 && eng.isSolidForPlayer(x, y)) return false;
        if (!eng.isSolidForPlayer(x, y - 1)) return false;
        if (eng.isSpikeAt(x, y) && !eng.isPlacedBoxAt(x, y, null) && !eng.isPlacedBoxAt(x, y + 1, null)) return false;
        if (this._laserAt(x, y)) return false;
        if (x === x1) break;
      }
      return true;
    }

    _lostHint() {
      if (this.unmatchedSince === null) this.unmatchedSince = this.time;
      if (this.time - this.unmatchedSince < LOST_GRACE_S) {
        return this.hint && this.hint.button !== 'btn-restart' ? this.hint : null;
      }
      return { button: 'btn-restart', mode: 'tap', overlay: null, key: 'restart' };
    }

    // -----------------------------------------------------------------------
    // Hints
    // -----------------------------------------------------------------------

    _heroHint(char) {
      return { button: 'btn-hero', mode: 'tap', overlay: { type: 'hero', hero: char }, key: 'hero:' + char };
    }

    _exitDrawHint(live, target) {
      const liveH = live.heroes[live.char] || { active: [] };
      const overlay = target ? { type: 'walk', x: target.x, y: target.y } : null;
      if (liveH.active.length > 0) {
        return { button: 'btn-erase', mode: 'tap', overlay, key: 'erase-first:' + this.idx };
      }
      return { button: 'btn-draw', mode: 'tap', overlay, key: 'exit-draw:' + this.idx };
    }

    _walkHint(targetX, targetY, live, passThrough) {
      const liveH = live.heroes[live.char] || { active: [] };
      if (liveH.active.length > 0 || this.engine.drawMode) {
        return this._exitDrawHint(live, { x: targetX, y: targetY });
      }
      const dir = targetX >= live.x ? 1 : -1;
      return {
        button: dir > 0 ? 'btn-right' : 'btn-left',
        mode: 'tap',
        walk: { x: targetX, dir, park: !passThrough },
        overlay: { type: 'walk', x: targetX, y: targetY },
        key: 'walk:' + targetX.toFixed(2) + ':' + dir
      };
    }

    _stepHint(rec, live) {
      const pre = rec.pre;
      const post = rec.post;
      const s = rec.step;
      const liveH = live.heroes[live.char] || { active: [], placed: [] };
      switch (rec.type) {
        case 'walkTo': {
          const next = this.trace.steps[rec.i + 1];
          const dir = post.x >= live.x ? 1 : -1;
          const pass = Boolean(
            next && next.type === 'walkTo' && next.post &&
            Math.sign(next.post.x - post.x) === dir &&
            Math.abs(next.pre.y - post.y) <= Y_TOL
          );
          return this._walkHint(post.x, post.y, live, pass);
        }
        case 'jump':
          return {
            button: 'btn-jump',
            mode: 'tap',
            assist: {
              dir: Number(s.dir) || 0,
              targetX: s.targetX !== undefined && Number.isFinite(Number(s.targetX)) ? Number(s.targetX) : null,
              // Same horizontal hold window the verified solution uses (engine default 65).
              frames: s.frames !== undefined && Number.isFinite(Number(s.frames)) ? Number(s.frames) : 65
            },
            overlay: { type: 'jump', from: { x: pre.x, y: pre.y }, to: { x: post.x, y: post.y } },
            key: 'jump:' + rec.i
          };
        case 'createChain': {
          const target = post.heroes[post.char].active;
          const have = liveH.active;
          const origin = { x: Math.round(pre.x), y: Math.round(pre.y) };
          if (!isOrderedPrefix(have, target)) {
            return { button: 'btn-erase', mode: 'tap', overlay: { type: 'boxes', cells: target, next: -1, origin }, key: 'erase:' + rec.i };
          }
          if (!this.engine.drawMode && have.length === 0) {
            return { button: 'btn-draw', mode: 'tap', overlay: { type: 'boxes', cells: target, next: 0, origin }, key: 'draw:' + rec.i };
          }
          const n = have.length;
          const dir = s.dirs[n];
          return {
            button: DIR_BUTTON[dir],
            mode: 'tap',
            overlay: { type: 'boxes', cells: target, next: n, origin, dir },
            key: 'extend:' + rec.i + ':' + n
          };
        }
        case 'place':
          return { button: 'btn-draw', mode: 'tap', overlay: { type: 'drop', cells: post.heroes[post.char].placed }, key: 'place:' + rec.i };
        case 'throw':
          return { button: 'btn-throw', mode: 'tap', overlay: { type: 'throw', cells: post.heroes[post.char].placed }, key: 'throw:' + rec.i };
        case 'hook':
          return {
            button: 'btn-hook',
            mode: 'tap',
            overlay: { type: 'hook', path: pre.heroes[pre.char].active, to: { x: post.x, y: post.y } },
            key: 'hook:' + rec.i
          };
        case 'shoot': {
          const newly = post.switches.filter((id) => pre.switches.indexOf(id) === -1);
          const sws = this.engine.switches.filter((sw) => newly.indexOf(sw.id) !== -1).map((sw) => ({ x: sw.x, y: sw.y }));
          return {
            button: 'btn-shoot',
            mode: 'tap',
            overlay: { type: 'shoot', from: pre.heroes[pre.char].active, cells: post.heroes[post.char].placed, switches: sws },
            key: 'shoot:' + rec.i
          };
        }
        case 'switchHero':
          return this._heroHint(post.char);
        case 'enterDoor': {
          const gd = this.engine.stage.goalDoor;
          return { button: 'btn-up', mode: 'tap', overlay: { type: 'door', x: gd.x, y: gd.y }, key: 'door' };
        }
        default:
          return null;
      }
    }

    _setHint(h) {
      const key = h ? h.key : 'none';
      if (key !== this.hintKey) {
        this.hintKey = key;
        this.hintSince = this.time;
      }
      this.hint = h;
      return h;
    }

    // -----------------------------------------------------------------------
    // Public helpers for input.js / renderer.js / tests
    // -----------------------------------------------------------------------

    jumpAssist() {
      const h = this.hint;
      return this.enabled && h && h.assist ? h.assist : null;
    }

    walkTarget() {
      const h = this.hint;
      return this.enabled && h && h.walk ? h.walk : null;
    }

    idleSeconds() {
      return this.time - this.hintSince;
    }

    getSummary() {
      const h = this.hint;
      const rec = this.trace ? this.trace.steps[this.idx] : null;
      return {
        enabled: this.enabled,
        key: this.hintKey,
        button: h && h.button ? h.button : null,
        region: h && h.region ? h.region : null,
        mode: h ? h.mode : null,
        overlay: h && h.overlay ? h.overlay.type : null,
        stepIndex: this.idx,
        stepCount: this.trace ? this.trace.steps.length : 0,
        stepType: rec ? rec.type : null,
        traceSolved: this.trace ? this.trace.solved : null
      };
    }
  }

  window.BoxBoyCoach = new BoxBoyCoach(window.BoxBoyEngine);
})();
