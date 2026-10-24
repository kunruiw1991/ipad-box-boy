/**
 * Dual-Mode iPad Touch & Desktop Keyboard Controller for BoxBoy! + Box Girl!
 * - Mode A: Direct finger-drag on <canvas> from Qbby/Qucy (or in Box Draw mode) to extrude
 *   orthogonal box chains step-by-step + floating one-tap action bubbles.
 * - Mode B: Ergonomic >= 72x72 CSS px non-overlapping on-screen SVG touch buttons + full keyboard.
 */
(function () {
  'use strict';

  class BoxBoyInput {
    constructor() {
      this.engine = null;
      this.renderer = null;
      this.canvas = null;
      this.isDraggingCanvas = false;
      this.dragPointerId = null;
      this.lastGridCell = null;
      this.rafId = null;
      this.lastFrameTime = 0;
    }

    init(engine, renderer, canvas) {
      this.engine = engine;
      this.renderer = renderer;
      this.canvas = canvas;

      this._bindCanvasTouchAndMouse();
      this._bindDOMButtons();
      this._bindKeyboard();

      window.addEventListener('resize', () => {
        if (this.renderer) this.renderer.resize();
      });

      this._startLoop();
    }

    _unlockAudio() {
      if (this.engine && this.engine.audio) {
        this.engine.audio.unlock();
      }
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
            this.engine.extendDir(drawDir);
          } else if (dirKey === 'left' || dirKey === 'right') {
            this.engine.inputState[dirKey] = true;
          } else if (drawDir === 'up') {
            // Up button either enters Goal Door or starts extruding Up
            const gd = this.engine.stage && this.engine.stage.goalDoor;
            const p = this.engine.player;
            if (gd && p && Math.abs(p.x - gd.x) <= 1.1 && Math.abs(p.y - gd.y) <= 0.8) {
              this.engine.injectAction({ type: 'enterDoor' });
            } else {
              this.engine.extendDir('up');
            }
          } else if (drawDir === 'down') {
            this.engine.extendDir('down');
          }
          el.classList.add('pressed');
          this._syncHUDButtons();
          if (this.renderer) this.renderer.render(this.engine);
        };
        const up = (e) => {
          if (e) e.preventDefault();
          if (this.engine && (dirKey === 'left' || dirKey === 'right')) {
            this.engine.inputState[dirKey] = false;
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
        if (this.engine.screen === 'map') {
          this.engine.screen = 'title';
        } else {
          this.engine.screen = 'map';
        }
      });

      bindTap('btn-restart', () => {
        if (this.engine.screen === 'game' || this.engine.screen === 'clear') {
          this.engine.loadStage(this.engine.stageIndex);
        } else {
          this.engine.loadStage(this.engine.stageIndex || 0);
        }
      });

      bindTap('btn-hero', () => {
        this.engine.switchHero();
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
          this.engine.jump();
        }
      });

      bindTap('btn-draw', () => {
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
        const p = this.engine.player;
        if (p && p.activeChain.length === 0) {
          this.engine.extendDir('up');
        }
        this.engine.injectAction({ type: 'throw' });
      });

      bindTap('btn-shoot', () => {
        if (this.engine.screen !== 'game') return;
        const p = this.engine.player;
        if (p && p.activeChain.length === 0 && p.placedChain.length === 0) {
          this.engine.extendDir(p.facing >= 0 ? 'right' : 'left');
        }
        this.engine.injectAction({ type: 'shoot' });
      });

      bindTap('btn-hook', () => {
        if (this.engine.screen !== 'game') return;
        this.engine.injectAction({ type: 'hook' });
      });

      bindTap('btn-erase', () => {
        if (this.engine.screen !== 'game') return;
        this.engine.eraseChain();
      });

      this._syncHUDButtons();
    }

    _syncHUDButtons() {
      if (!this.engine) return;
      const drawBtn = document.getElementById('btn-draw');
      if (drawBtn) {
        drawBtn.classList.toggle('active-mode', Boolean(this.engine.drawMode));
      }
      const muteBtn = document.getElementById('btn-mute');
      if (muteBtn) {
        const isMuted = this.engine.audio && this.engine.audio.muted;
        muteBtn.classList.toggle('muted-mode', Boolean(isMuted));
      }
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
          if (this.engine.drawMode) this.engine.extendDir('left');
          else this.engine.inputState.left = true;
        } else if (code === 'ArrowRight' || code === 'KeyD') {
          e.preventDefault();
          if (this.engine.drawMode) this.engine.extendDir('right');
          else this.engine.inputState.right = true;
        } else if (code === 'ArrowUp' || code === 'KeyW') {
          e.preventDefault();
          if (this.engine.drawMode) this.engine.extendDir('up');
          else this.engine.jump();
        } else if (code === 'ArrowDown' || code === 'KeyS') {
          e.preventDefault();
          if (this.engine.drawMode) this.engine.extendDir('down');
        } else if (code === 'Space' || code === 'Enter') {
          e.preventDefault();
          if (this.engine.screen === 'title') this.engine.screen = 'map';
          else if (this.engine.screen === 'map') this.engine.loadStage(this.engine.stageIndex);
          else if (this.engine.screen === 'clear') this.engine.loadStage((this.engine.stageIndex + 1) % this.engine.stages.length);
          else if (this.engine.player && this.engine.player.activeChain.length > 0) this.engine.placeChain();
          else this.engine.jump();
        } else if (code === 'KeyZ') {
          e.preventDefault();
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
    // 60FPS ANIMATION & PHYSICS LOOP
    // =========================================================================

    _startLoop() {
      const tick = (now) => {
        if (!this.lastFrameTime) this.lastFrameTime = now;
        const elapsed = Math.min(0.05, Math.max(0.005, (now - this.lastFrameTime) / 1000));
        this.lastFrameTime = now;

        if (this.engine && !this.engine.paused) {
          this.engine._stepSingleFrame(1 / 60);
          if (this.renderer) {
            this.renderer.render(this.engine);
          }
        } else if (this.renderer && this.engine) {
          this.renderer.render(this.engine);
        }
        this.rafId = window.requestAnimationFrame(tick);
      };
      this.rafId = window.requestAnimationFrame(tick);
    }
  }

  window.BoxBoyInput = new BoxBoyInput();
})();
