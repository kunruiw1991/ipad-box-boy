/**
 * Dual-Mode iPad Touch & Desktop Keyboard Controller for BoxBoy! + Box Girl!
 * - Mode A: Direct finger-drag on <canvas> from Qbby/Qucy (or in Box Draw mode) to extrude
 *   orthogonal box chains step-by-step + floating one-tap action bubbles.
 * - Mode B: Ergonomic >= 72x72 CSS px non-overlapping on-screen SVG touch buttons + full keyboard.
 * - Guide Coach integration: highlights the ONE button to press next (golden glow + tapping
 *   hand, everything else dimmed), turns a tap on the highlighted arrow into an automatic walk
 *   that stops exactly on the golden pad, and makes the highlighted jump land on the planned spot.
 */
(function () {
  'use strict';

  const STEP_DT = 1 / 60;
  const MOVE_SPEED = 5.5; // must match engine.js
  const HAND_TIP_X = 25; // fingertip inside the 64x64 hand SVG
  const HAND_TIP_Y = 3;
  const HAND_BODY_BELOW_TIP = 68; // tilted hand + tap travel below the fingertip (px)
  const REMINDER_EVERY_S = 6;

  class BoxBoyInput {
    constructor() {
      this.engine = null;
      this.renderer = null;
      this.canvas = null;
      this.coach = null;
      this.isDraggingCanvas = false;
      this.dragPointerId = null;
      this.lastGridCell = null;
      this.rafId = null;
      this.lastFrameTime = 0;
      this.accumulator = 0;
      this.assist = null; // coach-planned jump in flight
      this.autoWalk = null; // coach-planned walk started by one tap
      this.jumpBufferFrames = 0; // early jump press waiting for touchdown
      this.handEl = null;
      this._lastHintKey = null;
      this._remindersPlayed = 0;
    }

    init(engine, renderer, canvas, coach) {
      this.engine = engine;
      this.renderer = renderer;
      this.canvas = canvas;
      this.coach = coach || window.BoxBoyCoach || null;
      this.handEl = document.getElementById('coach-hand');

      this._bindCanvasTouchAndMouse();
      this._bindDOMButtons();
      this._bindKeyboard();

      window.addEventListener('resize', () => {
        if (this.renderer) this.renderer.resize();
        this._lastHintKey = null;
      });

      this._startLoop();
    }

    _unlockAudio() {
      if (this.engine && this.engine.audio) {
        this.engine.audio.unlock();
      }
    }

    _coachOn() {
      return Boolean(this.coach && this.coach.enabled);
    }

    // =========================================================================
    // MODE A: DIRECT CANVAS FINGER-DRAG BOX EXTRUSION & HIT REGIONS
    // =========================================================================

    _bindCanvasTouchAndMouse() {
      if (!this.canvas) return;

      const onDown = (clientX, clientY, pointerId) => {
        this._unlockAudio();
        if (!this.engine || !this.renderer) return;

        // 1. Check interactive canvas hit regions (Title, Map, Clear modal, Floating Action Bubbles)
        const regions = this.renderer.hitRegions || [];
        for (let i = regions.length - 1; i >= 0; i--) {
          const r = regions[i];
          if (clientX >= r.x && clientX <= r.x + r.w && clientY >= r.y && clientY <= r.y + r.h) {
            r.action();
            this.renderer.render(this.engine);
            this._syncHUDButtons();
            return;
          }
        }

        // 2. In Game screen: direct finger-drag from hero or anywhere when drawMode is active
        if (this.engine.screen === 'game' && this.engine.player && !this.engine.stageCleared) {
          const g = this.renderer.screenToGrid(clientX, clientY);
          const p = this.engine.player;
          const distToHero = Math.hypot(g.wx - (p.x + 0.5), g.wy - (p.y + 0.5));
          const tip = p.activeChain.length > 0
            ? p.activeChain[p.activeChain.length - 1]
            : { x: Math.round(p.x), y: Math.round(p.y) };
          const distToTip = Math.hypot(g.wx - (tip.x + 0.5), g.wy - (tip.y + 0.5));

          if (distToHero <= 2.6 || distToTip <= 2.2 || this.engine.drawMode) {
            this._cancelAutoWalk();
            this.isDraggingCanvas = true;
            this.dragPointerId = pointerId;
            this.engine.startDraw();
            this.lastGridCell = { x: tip.x, y: tip.y };
            this._stepDragToward(g.gx, g.gy);
            this.renderer.render(this.engine);
            this._syncHUDButtons();
          }
        }
      };

      const onMove = (clientX, clientY, pointerId) => {
        if (!this.isDraggingCanvas) return;
        if (this.dragPointerId !== null && pointerId !== undefined && pointerId !== this.dragPointerId) return;
        if (!this.engine || !this.renderer || this.engine.screen !== 'game') return;

        const g = this.renderer.screenToGrid(clientX, clientY);
        this._stepDragToward(g.gx, g.gy);
        this.renderer.render(this.engine);
      };

      const onUp = (pointerId) => {
        if (this.dragPointerId !== null && pointerId !== undefined && pointerId !== this.dragPointerId) return;
        this.isDraggingCanvas = false;
        this.dragPointerId = null;
        this.lastGridCell = null;
      };

      this.canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        onDown(e.clientX, e.clientY, e.pointerId);
      }, { passive: false });

      this.canvas.addEventListener('pointermove', (e) => {
        e.preventDefault();
        onMove(e.clientX, e.clientY, e.pointerId);
      }, { passive: false });

      window.addEventListener('pointerup', (e) => {
        onUp(e.pointerId);
      });

      window.addEventListener('pointercancel', (e) => {
        onUp(e.pointerId);
      });
    }

    _stepDragToward(targetGx, targetGy) {
      const p = this.engine.player;
      if (!p) return;

      let safety = 0;
      while (safety < 5) {
        safety++;
        const origin = p.activeChain.length > 0
          ? p.activeChain[p.activeChain.length - 1]
          : { x: Math.round(p.x), y: Math.round(p.y) };

        const dx = targetGx - origin.x;
        const dy = targetGy - origin.y;
        if (dx === 0 && dy === 0) break;

        let dir = null;
        if (Math.abs(dx) >= Math.abs(dy)) {
          dir = dx > 0 ? 'right' : 'left';
        } else {
          dir = dy > 0 ? 'up' : 'down';
        }

        const moved = this.engine.extendDir(dir);
        if (!moved) break;
      }
    }

    // =========================================================================
    // MODE B: ON-SCREEN VIRTUAL GAMEPAD BUTTONS
    // =========================================================================

    _bindDOMButtons() {
      const bindTap = (id, handler) => {
        const el = document.getElementById(id);
        if (!el) return;
        const trigger = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._unlockAudio();
          handler();
          this._syncHUDButtons();
          if (this.renderer && this.engine) {
            this.renderer.render(this.engine);
          }
        };
        el.addEventListener('pointerdown', trigger, { passive: false });
        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      };

      const bindHoldDir = (id, dirKey, drawDir) => {
        const el = document.getElementById(id);
        if (!el) return;
        const down = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._unlockAudio();
          if (!this.engine) return;
          if (this.engine.screen === 'title') {
            this.engine.screen = 'map';
          } else if (this.engine.screen === 'map') {
            const delta = dirKey === 'right' || drawDir === 'down' ? 1 : -1;
            this.engine.stageIndex = (this.engine.stageIndex + delta + this.engine.stages.length) % this.engine.stages.length;
          } else if (this.engine.drawMode) {
            this._cancelAutoWalk();
            this.engine.extendDir(drawDir);
          } else if (dirKey === 'left' || dirKey === 'right') {
            this._startWalk(dirKey, id);
          } else if (drawDir === 'up') {
            // Up button either enters Goal Door or starts extruding Up
            const gd = this.engine.stage && this.engine.stage.goalDoor;
            const p = this.engine.player;
            if (gd && p && Math.abs(p.x - gd.x) <= 1.1 && Math.abs(p.y - gd.y) <= 0.8) {
              this.engine.injectAction({ type: 'enterDoor' });
            } else {
              this._cancelAutoWalk();
              this.engine.extendDir('up');
            }
          } else if (drawDir === 'down') {
            this._cancelAutoWalk();
            this.engine.extendDir('down');
          }
          el.classList.add('pressed');
          this._syncHUDButtons();
          if (this.renderer) this.renderer.render(this.engine);
        };
        const up = (e) => {
          if (e) e.preventDefault();
          if (this.engine && (dirKey === 'left' || dirKey === 'right')) {
            const walkDir = dirKey === 'right' ? 1 : -1;
            // A coach-guided walk keeps going after the finger lifts and stops on the golden pad.
            if (!(this.autoWalk && this.autoWalk.dir === walkDir)) {
              this.engine.inputState[dirKey] = false;
            }
          }
          el.classList.remove('pressed');
        };
        el.addEventListener('pointerdown', down, { passive: false });
        el.addEventListener('pointerup', up, { passive: false });
        el.addEventListener('pointerleave', up, { passive: false });
        el.addEventListener('pointercancel', up, { passive: false });
      };

      // Top bar utility buttons
      bindTap('btn-map', () => {
        this._cancelAutoWalk();
        if (this.engine.screen === 'map') {
          this.engine.screen = 'title';
        } else {
          this.engine.screen = 'map';
        }
      });

      bindTap('btn-restart', () => {
        this._cancelAutoWalk();
        this.assist = null;
        if (this.engine.screen === 'game' || this.engine.screen === 'clear') {
          this.engine.loadStage(this.engine.stageIndex);
        } else {
          this.engine.loadStage(this.engine.stageIndex || 0);
        }
      });

      bindTap('btn-hero', () => {
        this._cancelAutoWalk();
        this.engine.switchHero();
      });

      bindTap('btn-hint', () => {
        if (this.coach) this.coach.toggle();
        this._cancelAutoWalk();
        this._lastHintKey = null;
      });

      bindTap('btn-mute', () => {
        this.engine.injectAction({ type: 'toggleMute' });
      });

      // Bottom-left directional cluster
      bindHoldDir('btn-left', 'left', 'left');
      bindHoldDir('btn-right', 'right', 'right');
      bindHoldDir('btn-up', null, 'up');
      bindHoldDir('btn-down', null, 'down');

      // Bottom-right action cluster
      bindTap('btn-jump', () => {
        if (this.engine.screen === 'title') {
          this.engine.screen = 'map';
        } else if (this.engine.screen === 'map') {
          this.engine.loadStage(this.engine.stageIndex);
        } else if (this.engine.screen === 'clear') {
          this.engine.loadStage((this.engine.stageIndex + 1) % this.engine.stages.length);
        } else {
          this._doJump();
        }
      });

      bindTap('btn-draw', () => {
        this._cancelAutoWalk();
        if (this.engine.screen !== 'game') {
          this.engine.loadStage(this.engine.stageIndex);
          return;
        }
        const p = this.engine.player;
        if (p && p.activeChain.length > 0) {
          this.engine.placeChain();
        } else {
          this.engine.injectAction({ type: 'toggleDraw' });
        }
      });

      bindTap('btn-throw', () => {
        if (this.engine.screen !== 'game') return;
        this._cancelAutoWalk();
        const p = this.engine.player;
        if (p && p.activeChain.length === 0) {
          this.engine.extendDir('up');
        }
        this.engine.injectAction({ type: 'throw' });
      });

      bindTap('btn-shoot', () => {
        if (this.engine.screen !== 'game') return;
        this._cancelAutoWalk();
        const p = this.engine.player;
        if (p && p.activeChain.length === 0 && p.placedChain.length === 0) {
          this.engine.extendDir(p.facing >= 0 ? 'right' : 'left');
        }
        this.engine.injectAction({ type: 'shoot' });
      });

      bindTap('btn-hook', () => {
        if (this.engine.screen !== 'game') return;
        this._cancelAutoWalk();
        this.engine.injectAction({ type: 'hook' });
      });

      bindTap('btn-erase', () => {
        if (this.engine.screen !== 'game') return;
        this._cancelAutoWalk();
        this.engine.eraseChain();
      });

      this._syncHUDButtons();
    }

    // =========================================================================
    // COACH-GUIDED WALKING & JUMPING
    // =========================================================================

    _startWalk(dirKey, buttonId) {
      const eng = this.engine;
      const walkDir = dirKey === 'right' ? 1 : -1;
      const target = this._coachOn() ? this.coach.walkTarget() : null;
      const hint = this._coachOn() ? this.coach.hint : null;
      if (target && hint && hint.button === buttonId && target.dir === walkDir) {
        this.autoWalk = { dir: walkDir, stuckFrames: 0, lastX: eng.player ? eng.player.x : 0 };
      } else {
        this.autoWalk = null;
      }
      eng.inputState.left = dirKey === 'left';
      eng.inputState.right = dirKey === 'right';
    }

    _cancelAutoWalk() {
      if (!this.autoWalk) return;
      this.autoWalk = null;
      if (this.engine) {
        this.engine.inputState.left = false;
        this.engine.inputState.right = false;
      }
    }

    _doJump(fromBuffer) {
      const eng = this.engine;
      const p = eng.player;
      if (!p) return false;
      if (!p.grounded || p.chainState === 'retracting') {
        // Pressed a moment too early (still landing): remember it briefly and jump on touchdown.
        if (!fromBuffer) this.jumpBufferFrames = 9;
        return false;
      }
      this.jumpBufferFrames = 0;
      const plan = this._coachOn() ? this.coach.jumpAssist() : null;
      if (plan && p.chainState !== 'retracting') {
        this._cancelAutoWalk();
        this.assist = {
          dir: plan.dir,
          targetX: plan.targetX,
          maxFrames: plan.frames || 65,
          frames: 0,
          reached: false
        };
        eng.inputState.left = plan.dir < 0;
        eng.inputState.right = plan.dir > 0;
        if (plan.dir !== 0) p.facing = plan.dir > 0 ? 1 : -1;
      }
      const ok = eng.jump();
      if (!ok && this.assist && this.assist.frames === 0) {
        this.assist = null;
        eng.inputState.left = false;
        eng.inputState.right = false;
      }
      return ok;
    }

    _applyGuidanceBeforeStep(dt) {
      const eng = this.engine;
      const p = eng.player;
      if (!p || eng.screen !== 'game' || eng.stageCleared) {
        this.assist = null;
        this.autoWalk = null;
        this.jumpBufferFrames = 0;
        return;
      }

      // 0. Buffered jump press fires on the first grounded frame.
      if (this.jumpBufferFrames > 0) {
        this.jumpBufferFrames -= 1;
        if (p.grounded && !this.assist) this._doJump(true);
      }

      // 1. Planned jump: same horizontal hold window and landing clamp the verified solution uses.
      if (this.assist) {
        const a = this.assist;
        let hold = a.dir !== 0 && !a.reached && a.frames < a.maxFrames;
        if (hold && a.targetX !== null) {
          const reached = a.dir > 0 ? p.x >= a.targetX : p.x <= a.targetX;
          if (reached) {
            p.x = a.targetX;
            p.vx = 0;
            a.reached = true;
            hold = false;
          }
        }
        eng.inputState.left = hold && a.dir < 0;
        eng.inputState.right = hold && a.dir > 0;
        return;
      }

      const walk = this._coachOn() ? this.coach.walkTarget() : null;

      // 2. One-tap guided walk keeps walking until the golden pad.
      if (this.autoWalk) {
        const aw = this.autoWalk;
        if (!walk || walk.dir !== aw.dir || eng.drawMode) {
          this._cancelAutoWalk();
        } else {
          eng.inputState.left = aw.dir < 0;
          eng.inputState.right = aw.dir > 0;
          if (p.grounded && Math.abs(p.x - aw.lastX) < 0.001) aw.stuckFrames += 1;
          else aw.stuckFrames = 0;
          aw.lastX = p.x;
          if (aw.stuckFrames > 12) this._cancelAutoWalk();
        }
      }

      // 3. Park exactly on the golden pad (also for a held arrow or keyboard).
      if (walk && walk.park && p.grounded && !eng.drawMode) {
        const moving = walk.dir > 0 ? eng.inputState.right : eng.inputState.left;
        if (moving) {
          const dx = walk.x - p.x;
          const reach = MOVE_SPEED * dt + 0.01;
          if ((walk.dir > 0 && dx <= reach) || (walk.dir < 0 && dx >= -reach)) {
            if (Math.abs(dx) <= 0.6) {
              p.x = walk.x;
              p.vx = 0;
            }
            this.autoWalk = null;
            eng.inputState.left = false;
            eng.inputState.right = false;
          }
        }
      }
    }

    _applyGuidanceAfterStep() {
      if (!this.assist) return;
      const eng = this.engine;
      const p = eng.player;
      this.assist.frames += 1;
      if (!p || eng.screen !== 'game' || (this.assist.frames > 6 && p.grounded) || this.assist.frames > 150) {
        this.assist = null;
        eng.inputState.left = false;
        eng.inputState.right = false;
      }
    }

    // =========================================================================
    // HUD BUTTON STATE + GUIDE COACH HIGHLIGHT / HAND
    // =========================================================================

    _syncHUDButtons() {
      if (!this.engine) return;
      const eng = this.engine;
      const inGame = eng.screen === 'game';
      const p = eng.player;

      const drawBtn = document.getElementById('btn-draw');
      if (drawBtn) {
        drawBtn.classList.toggle('active-mode', Boolean(inGame && eng.drawMode));
        drawBtn.classList.toggle('has-chain', Boolean(inGame && p && p.activeChain.length > 0));
      }
      document.body.classList.toggle('draw-mode', Boolean(inGame && eng.drawMode));

      const muteBtn = document.getElementById('btn-mute');
      if (muteBtn) {
        const isMuted = eng.audio && eng.audio.muted;
        muteBtn.classList.toggle('muted-mode', Boolean(isMuted));
      }

      const hintBtn = document.getElementById('btn-hint');
      if (hintBtn) hintBtn.classList.toggle('hint-off', !this._coachOn());

      // Throw / Hook / Shoot appear once the stage that teaches them is reached.
      ['throw', 'hook', 'shoot'].forEach((m) => {
        const el = document.getElementById('btn-' + m);
        if (el && typeof eng.isMechanicUnlocked === 'function') {
          el.classList.toggle('locked', !eng.isMechanicUnlocked(m));
        }
      });
    }

    _syncCoachDOM() {
      const coach = this.coach;
      const hint = this._coachOn() ? coach.hint : null;
      const key = hint ? hint.key : 'none';
      if (key !== this._lastHintKey) {
        this._lastHintKey = key;
        this._remindersPlayed = 0;
        document.body.classList.toggle('coach-on', Boolean(hint));
        const buttons = document.querySelectorAll('.touch-btn');
        for (let i = 0; i < buttons.length; i++) {
          const b = buttons[i];
          const isTarget = Boolean(hint && hint.button === b.id);
          b.classList.toggle('coach-target', isTarget);
          b.classList.toggle('coach-dim', Boolean(hint) && !isTarget && b.id !== 'btn-hint');
        }
      }

      // Gentle reminder when the player has not acted on the same hint for a while.
      const idle = hint ? coach.idleSeconds() : 0;
      document.body.classList.toggle('coach-urgent', Boolean(hint) && idle >= REMINDER_EVERY_S);
      if (hint && idle >= REMINDER_EVERY_S * (this._remindersPlayed + 1) && this._remindersPlayed < 3) {
        this._remindersPlayed += 1;
        if (this.engine.audio && typeof this.engine.audio.hintChime === 'function') this.engine.audio.hintChime();
      }

      this._positionHand(hint);
    }

    _positionHand(hint) {
      const hand = this.handEl;
      if (!hand) return;
      let rect = null;
      if (hint && hint.button) {
        const el = document.getElementById(hint.button);
        if (el && !el.classList.contains('locked')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) rect = { left: r.left, top: r.top, width: r.width, height: r.height };
        }
      } else if (hint && hint.region && this.renderer && this.renderer.regions) {
        const r = this.renderer.regions[hint.region];
        if (r) rect = { left: r.x, top: r.y, width: r.w, height: r.h };
      }
      if (!rect) {
        hand.classList.remove('show');
        return;
      }
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const onRight = cx > window.innerWidth * 0.5;
      // Fingertip rests on the lower inner corner of the icon so the icon stays readable;
      // for bottom-row buttons it moves up so the whole hand stays on screen.
      const tipX = cx + (onRight ? -1 : 1) * rect.width * 0.16;
      const tipY = Math.min(cy + rect.height * 0.18, window.innerHeight - HAND_BODY_BELOW_TIP);
      hand.style.left = Math.round(tipX - HAND_TIP_X) + 'px';
      hand.style.top = Math.round(tipY - HAND_TIP_Y) + 'px';
      hand.classList.toggle('lean-left', onRight);
      hand.classList.add('show');
    }

    // =========================================================================
    // DESKTOP KEYBOARD SUPPORT
    // =========================================================================

    _bindKeyboard() {
      window.addEventListener('keydown', (e) => {
        this._unlockAudio();
        if (!this.engine) return;
        const code = e.code;

        if (code === 'ArrowLeft' || code === 'KeyA') {
          e.preventDefault();
          this._cancelAutoWalk();
          if (this.engine.drawMode) this.engine.extendDir('left');
          else this.engine.inputState.left = true;
        } else if (code === 'ArrowRight' || code === 'KeyD') {
          e.preventDefault();
          this._cancelAutoWalk();
          if (this.engine.drawMode) this.engine.extendDir('right');
          else this.engine.inputState.right = true;
        } else if (code === 'ArrowUp' || code === 'KeyW') {
          e.preventDefault();
          if (this.engine.drawMode) this.engine.extendDir('up');
          else if (this.engine.screen === 'game') this._doJump();
        } else if (code === 'ArrowDown' || code === 'KeyS') {
          e.preventDefault();
          if (this.engine.drawMode) this.engine.extendDir('down');
        } else if (code === 'Space' || code === 'Enter') {
          e.preventDefault();
          if (this.engine.screen === 'title') this.engine.screen = 'map';
          else if (this.engine.screen === 'map') this.engine.loadStage(this.engine.stageIndex);
          else if (this.engine.screen === 'clear') this.engine.loadStage((this.engine.stageIndex + 1) % this.engine.stages.length);
          else if (this.engine.player && this.engine.player.activeChain.length > 0) this.engine.placeChain();
          else this._doJump();
        } else if (code === 'KeyZ') {
          e.preventDefault();
          this._cancelAutoWalk();
          if (this.engine.player && this.engine.player.activeChain.length > 0) {
            this.engine.placeChain();
          } else {
            this.engine.injectAction({ type: 'toggleDraw' });
          }
        } else if (code === 'KeyX') {
          e.preventDefault();
          this.engine.injectAction({ type: 'shoot' });
        } else if (code === 'KeyC') {
          e.preventDefault();
          this.engine.injectAction({ type: 'hook' });
        } else if (code === 'KeyT') {
          e.preventDefault();
          this.engine.injectAction({ type: 'throw' });
        } else if (code === 'KeyV' || code === 'Backspace') {
          e.preventDefault();
          this.engine.eraseChain();
        } else if (code === 'KeyQ' || code === 'Tab') {
          e.preventDefault();
          this.engine.switchHero();
        } else if (code === 'KeyR') {
          e.preventDefault();
          this.engine.loadStage(this.engine.stageIndex);
        } else if (code === 'KeyM') {
          e.preventDefault();
          this.engine.injectAction({ type: 'toggleMute' });
        } else if (code === 'KeyH') {
          e.preventDefault();
          if (this.coach) this.coach.toggle();
        }
        this._syncHUDButtons();
      });

      window.addEventListener('keyup', (e) => {
        if (!this.engine) return;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          this.engine.inputState.left = false;
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          this.engine.inputState.right = false;
        }
      });
    }

    // =========================================================================
    // FIXED-STEP 60FPS ANIMATION & PHYSICS LOOP
    // =========================================================================

    /**
     * Advances exactly one 1/60 s simulation frame: Guide Coach update, guided
     * walk/jump assists, engine physics. `force` runs even while the engine is
     * paused (used by automated hint-following playtests).
     */
    frame(dt = STEP_DT, force = false) {
      const eng = this.engine;
      if (!eng) return;
      if (eng.paused && !force) return;
      if (this.coach) this.coach.update(dt);
      this._applyGuidanceBeforeStep(dt);
      eng._stepSingleFrame(dt);
      this._applyGuidanceAfterStep();
    }

    _startLoop() {
      const tick = (now) => {
        if (!this.lastFrameTime) this.lastFrameTime = now;
        let elapsed = Math.min(0.1, Math.max(0, (now - this.lastFrameTime) / 1000));
        this.lastFrameTime = now;
        // Snap normal 60 Hz jitter to exactly one step; 120 Hz ProMotion iPads step every other frame.
        if (Math.abs(elapsed - STEP_DT) < 0.004) elapsed = STEP_DT;
        this.accumulator = Math.min(this.accumulator + elapsed, STEP_DT * 4);

        let steps = 0;
        while (this.accumulator >= STEP_DT - 1e-6 && steps < 4) {
          this.frame(STEP_DT, false);
          this.accumulator -= STEP_DT;
          steps++;
        }

        if (this.engine) {
          this._syncHUDButtons();
          this._syncCoachDOM();
          if (this.renderer) this.renderer.render(this.engine);
        }
        this.rafId = window.requestAnimationFrame(tick);
      };
      this.rafId = window.requestAnimationFrame(tick);
    }
  }

  window.BoxBoyInput = new BoxBoyInput();
})();
