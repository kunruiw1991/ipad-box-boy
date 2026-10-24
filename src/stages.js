/**
 * 12 Deterministic Grid-Aligned Stages for BoxBoy! + Box Girl! (Zero-Text Web Edition)
 * Coordinate System:
 *   - x: column from left (0 .. width - 1)
 *   - y: row from bottom (0 .. height - 1, where y=0 is bottom row)
 *   - A solid tile at (gx, gy) spans [gx, gx+1] x [gy, gy+1], supporting entities at y = gy + 1.
 */
(function () {
  'use strict';

  function makeGrid(width, height) {
    const tiles = [];
    for (let y = 0; y < height; y++) {
      const row = new Array(width).fill(null);
      tiles.push(row);
    }
    return tiles;
  }

  function fillRect(tiles, x1, y1, x2, y2, type, extra) {
    const minX = Math.max(0, Math.min(x1, x2));
    const maxX = Math.min(tiles[0].length - 1, Math.max(x1, x2));
    const minY = Math.max(0, Math.min(y1, y2));
    const maxY = Math.min(tiles.length - 1, Math.max(y1, y2));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        tiles[y][x] = Object.assign({ type }, extra || {});
      }
    }
  }

  function buildStage(cfg) {
    const width = cfg.width || 36;
    const height = cfg.height || 11;
    const tiles = makeGrid(width, height);
    (cfg.rects || []).forEach((r) => {
      fillRect(tiles, r[0], r[1], r[2], r[3], r[4] || 'grass', r[5]);
    });
    return {
      index: cfg.index,
      id: cfg.id,
      world: cfg.world,
      stage: cfg.stage,
      theme: cfg.theme || 'grass',
      width,
      height,
      boxLimit: cfg.boxLimit,
      targetBoxBudget: cfg.targetBoxBudget,
      spawn: cfg.spawn,
      partnerSpawn: cfg.partnerSpawn || null,
      goalDoor: cfg.goalDoor,
      crowns: (cfg.crowns || []).map((c, idx) => ({
        id: idx,
        x: c.x,
        y: c.y
      })),
      spikes: cfg.spikes || [],
      lasers: cfg.lasers || [],
      switches: cfg.switches || [],
      phaseBlocks: cfg.phaseBlocks || [],
      tutorials: cfg.tutorials || [],
      tiles,
      solution: cfg.solution || []
    };
  }

  const STAGES = [
    // =========================================================================
    // STAGE 1: W1S1 — Single-Box Step & Elevated Crown (P1)
    // boxLimit: 1 | Crowns: 1 | targetBoxBudget: 3 (optimal: 2)
    // =========================================================================
    buildStage({
      index: 0,
      id: 'W1S1',
      world: 1,
      stage: 1,
      width: 28,
      height: 11,
      boxLimit: 1,
      targetBoxBudget: 3,
      spawn: { x: 2, y: 2, hero: 'qbby' },
      goalDoor: { x: 24, y: 4 },
      rects: [
        [0, 0, 8, 1, 'grass'],     // Start floor (surface y=2)
        [9, 0, 10, 3, 'grass'],    // 2-tile wall (surface y=4)
        [11, 0, 14, 1, 'grass'],   // Middle floor (surface y=2)
        [15, 0, 17, 2, 'grass'],   // Step 1 (surface y=3)
        [18, 0, 21, 4, 'grass'],   // Crown plateau (surface y=5)
        [22, 0, 27, 3, 'grass']    // Goal platform (surface y=4)
      ],
      crowns: [{ x: 19.5, y: 6.2 }],
      tutorials: [
        { x: 4.5, y: 6.2, kind: 'step1' }
      ],
      solution: [
        { type: 'walkTo', x: 7.0 },
        { type: 'createChain', dirs: ['right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 8.0 },
        { type: 'jump', dir: 1, targetX: 9.5 },
        { type: 'walkTo', x: 14.0 },
        { type: 'jump', dir: 1, targetX: 15.5 },
        { type: 'walkTo', x: 16.0 },
        { type: 'createChain', dirs: ['right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 17.0 },
        { type: 'jump', dir: 1, targetX: 18.5 },
        { type: 'walkTo', x: 19.5 },
        { type: 'jump', dir: 0 },
        { type: 'walkTo', x: 24.0 },
        { type: 'enterDoor' }
      ]
    }),

    // =========================================================================
    // STAGE 2: W1S2 — Single-Box Throw & Floating Crown Stand (P2)
    // boxLimit: 1 | Crowns: 1 | targetBoxBudget: 4 (optimal: 3)
    // =========================================================================
    buildStage({
      index: 1,
      id: 'W1S2',
      world: 1,
      stage: 2,
      width: 37,
      height: 11,
      boxLimit: 1,
      targetBoxBudget: 4,
      spawn: { x: 2, y: 2, hero: 'qbby' },
      goalDoor: { x: 33.5, y: 6 },
      rects: [
        [0, 0, 8, 1, 'grass'],     // Start floor (surface y=2)
        [9, 0, 10, 3, 'grass'],    // 2-tile ledge (surface y=4)
        [11, 0, 14, 1, 'grass'],   // Pre-pit floor (surface y=2)
        // x=15 is 1-tile pit
        [16, 0, 18, 2, 'grass'],   // Middle island (surface y=3)
        // x=19 is 1-tile pit
        [20, 0, 27, 1, 'grass'],   // Crown flat floor (surface y=2)
        [28, 0, 29, 2, 'grass'],   // Stair 1 (surface y=3)
        [30, 0, 31, 3, 'grass'],   // Stair 2 (surface y=4)
        [32, 0, 36, 5, 'grass']    // Goal plateau (surface y=6)
      ],
      crowns: [{ x: 25.0, y: 4.2 }],
      tutorials: [
        { x: 23.0, y: 6.2, kind: 'throw1' }
      ],
      solution: [
        { type: 'walkTo', x: 7.0 },
        { type: 'createChain', dirs: ['right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 8.0 },
        { type: 'jump', dir: 1, targetX: 9.5 },
        { type: 'walkTo', x: 14.0 },
        { type: 'jump', dir: 1, targetX: 16.5 },
        { type: 'walkTo', x: 18.0 },
        { type: 'jump', dir: 1, targetX: 20.5 },
        { type: 'walkTo', x: 23.0 },
        { type: 'createChain', dirs: ['up'] },
        { type: 'throw' },
        { type: 'walkTo', x: 24.0 },
        { type: 'jump', dir: 1, targetX: 25.0 },
        { type: 'jump', dir: 0 },
        { type: 'walkTo', x: 27.0 },
        { type: 'jump', dir: 1, targetX: 28.5 },
        { type: 'walkTo', x: 29.0 },
        { type: 'jump', dir: 1, targetX: 30.0 },
        { type: 'createChain', dirs: ['right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 31.0 },
        { type: 'jump', dir: 1, targetX: 32.5 },
        { type: 'walkTo', x: 33.5 },
        { type: 'enterDoor' }
      ]
    }),

    // =========================================================================
    // STAGE 3: W1S3 — 2-Box Bridges & Narrow Chasm Pillar (P3)
    // boxLimit: 2 | Crowns: 1 | targetBoxBudget: 5 (optimal: 4)
    // =========================================================================
    buildStage({
      index: 2,
      id: 'W1S3',
      world: 1,
      stage: 3,
      width: 35,
      height: 11,
      boxLimit: 2,
      targetBoxBudget: 5,
      spawn: { x: 2, y: 2, hero: 'qbby' },
      goalDoor: { x: 30, y: 4 },
      rects: [
        [0, 0, 8, 1, 'grass'],     // Start floor (surface y=2)
        // x=9 is pit bridged by 2-box chain onto x=10 support
        [10, 0, 10, 1, 'grass'],   // Pit right support (surface y=2)
        [11, 0, 15, 3, 'grass'],   // Middle plateau (surface y=4)
        // x=16 is 1-tile gap
        [17, 0, 20, 4, 'grass'],   // Upper plateau (surface y=5)
        [21, 0, 23, 5, 'grass'],   // High cliff (surface y=6)
        // x=24..26 chasm with narrow 1-tile pillar at x=25
        [25, 0, 25, 2, 'grass'],   // Narrow pillar (surface y=3)
        [27, 0, 34, 3, 'grass']    // Goal plateau (surface y=4)
      ],
      crowns: [{ x: 25.0, y: 4.3 }],
      tutorials: [
        { x: 5.0, y: 6.2, kind: 'bridge2' }
      ],
      solution: [
        { type: 'walkTo', x: 8.0 },
        { type: 'createChain', dirs: ['right', 'right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 9.5 },
        { type: 'jump', dir: 1, targetX: 11.5 },
        { type: 'walkTo', x: 14.0 },
        { type: 'createChain', dirs: ['right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 15.0 },
        { type: 'jump', dir: 1, targetX: 17.5 },
        { type: 'walkTo', x: 20.0 },
        { type: 'jump', dir: 1, targetX: 21.5 },
        { type: 'walkTo', x: 23.0 },
        { type: 'createChain', dirs: ['up'] },
        { type: 'throw' },
        { type: 'jump', dir: 1, targetX: 25.0 },
        { type: 'jump', dir: 1, targetX: 27.5 },
        { type: 'walkTo', x: 30.0 },
        { type: 'enterDoor' }
      ]
    }),

    // =========================================================================
    // STAGE 4: W1S4 — 3-Box L-Staircases & Chasm Cantilever Bridge (P4)
    // boxLimit: 3 | Crowns: 1 | targetBoxBudget: 7 (optimal: 7)
    // =========================================================================
    buildStage({
      index: 3,
      id: 'W1S4',
      world: 1,
      stage: 4,
      width: 35,
      height: 11,
      boxLimit: 3,
      targetBoxBudget: 7,
      spawn: { x: 2, y: 2, hero: 'qbby' },
      goalDoor: { x: 29, y: 5 },
      rects: [
        [0, 0, 9, 1, 'grass'],     // Start floor (surface y=2)
        [10, 0, 14, 4, 'grass'],   // 3-tile high wall (surface y=5)
        [15, 0, 16, 2, 'grass'],   // Recessed notch (surface y=3)
        [17, 0, 18, 5, 'grass'],   // High pillar (surface y=6)
        [19, 0, 23, 3, 'grass'],   // Pre-chasm ledge (surface y=4)
        // x=24..25 is 2-tile bottomless chasm
        [26, 0, 34, 4, 'grass']    // Goal cliff (surface y=5)
      ],
      crowns: [{ x: 25.0, y: 5.3 }],
      tutorials: [
        { x: 5.5, y: 6.2, kind: 'stair3' }
      ],
      solution: [
        { type: 'walkTo', x: 7.0 },
        { type: 'createChain', dirs: ['right', 'right', 'up'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 8.0 },
        { type: 'jump', dir: 1, targetX: 9.0 },
        { type: 'jump', dir: 1, targetX: 10.5 },
        { type: 'walkTo', x: 13.0 },
        { type: 'createChain', dirs: ['right', 'right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 15.0 },
        { type: 'jump', dir: 1, targetX: 17.5 },
        { type: 'walkTo', x: 22.0 },
        { type: 'createChain', dirs: ['right', 'right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 24.0 },
        { type: 'jump', dir: 1, targetX: 26.5 },
        { type: 'walkTo', x: 29.0 },
        { type: 'enterDoor' }
      ]
    }),

    // =========================================================================
    // STAGE 5: W1S5 — 4-Box Floor Spike Bridges & L-Shaped Crown Bridge (P5)
    // boxLimit: 4 | Crowns: 1 | targetBoxBudget: 11 (optimal: 11)
    // =========================================================================
    buildStage({
      index: 4,
      id: 'W1S5',
      world: 1,
      stage: 5,
      width: 47,
      height: 11,
      boxLimit: 4,
      targetBoxBudget: 11,
      spawn: { x: 2, y: 3, hero: 'qbby' },
      goalDoor: { x: 43.5, y: 6 },
      rects: [
        [0, 8, 10, 10, 'grass'],   // Green ceiling overhang in Room 1
        [0, 0, 8, 2, 'grass'],     // Start floor (surface y=3)
        [9, 0, 11, 1, 'grass'],    // Spike pit 1 bed (spikes at y=2)
        [12, 0, 17, 3, 'grass'],   // Ledge 2 (surface y=4)
        [18, 0, 21, 2, 'grass'],   // Spike pit 2 bed (spikes at y=3)
        [22, 0, 26, 3, 'grass'],   // Ledge 3 (surface y=4)
        [27, 0, 28, 1, 'grass'],   // Deep spike pit 3 bed (spikes at y=2)
        [29, 0, 31, 4, 'grass'],   // High cliff (surface y=5)
        [32, 0, 35, 3, 'grass'],   // Ledge 4 (surface y=4)
        [36, 0, 39, 2, 'grass'],   // Spike pit 4 bed (spikes at y=3)
        [40, 0, 41, 4, 'grass'],   // Step (surface y=5)
        [42, 0, 46, 5, 'grass']    // Goal plateau (surface y=6)
      ],
      spikes: [
        { x: 9, y: 2 }, { x: 10, y: 2 }, { x: 11, y: 2 },
        { x: 18, y: 3 }, { x: 19, y: 3 }, { x: 20, y: 3 }, { x: 21, y: 3 },
        { x: 27, y: 2 }, { x: 28, y: 2 },
        { x: 36, y: 3 }, { x: 37, y: 3 }, { x: 38, y: 3 }, { x: 39, y: 3 }
      ],
      crowns: [{ x: 38.0, y: 6.2 }],
      tutorials: [
        { x: 14.5, y: 7.2, kind: 'spike4' }
      ],
      solution: [
        // Obstacle 1: 1 box thrown onto spike pit 1 (x=10, y=3)
        { type: 'walkTo', x: 8.0 },
        { type: 'createChain', dirs: ['up'] },
        { type: 'throw' },
        { type: 'jump', dir: 1, targetX: 10.0 },
        { type: 'jump', dir: 1, targetX: 12.5 },
        // Obstacle 2: 2 boxes thrown onto spike pit 2 (x=19..20, y=4)
        { type: 'walkTo', x: 17.0 },
        { type: 'createChain', dirs: ['up', 'right'] },
        { type: 'throw' },
        { type: 'jump', dir: 1, targetX: 19.5 },
        { type: 'walkTo', x: 20.2 },
        { type: 'jump', dir: 1, targetX: 22.5 },
        // Obstacle 3: 4 boxes [right, down, right, up] into spike shaft (x=27..28, y=3..4)
        { type: 'walkTo', x: 26.0 },
        { type: 'createChain', dirs: ['right', 'down', 'right', 'up'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 27.5 },
        { type: 'walkTo', x: 35.0 },
        // Obstacle 4: 4 boxes [right, right, right, up] onto spike pit 4 under Crown
        { type: 'createChain', dirs: ['right', 'right', 'right', 'up'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 36.5 },
        { type: 'walkTo', x: 37.0 },
        { type: 'jump', dir: 1, targetX: 38.0 },
        { type: 'jump', dir: 1, targetX: 40.5 },
        { type: 'walkTo', x: 41.0 },
        { type: 'jump', dir: 1, targetX: 42.5 },
        { type: 'walkTo', x: 43.5 },
        { type: 'enterDoor' }
      ]
    }),

    // =========================================================================
    // STAGE 6: W1S6 — Vertical Yellow Laser Bridges (P6)
    // boxLimit: 3 | Crowns: 1 | targetBoxBudget: 10 (optimal: 9)
    // =========================================================================
    buildStage({
      index: 5,
      id: 'W1S6',
      world: 1,
      stage: 6,
      width: 36,
      height: 11,
      boxLimit: 3,
      targetBoxBudget: 10,
      spawn: { x: 2, y: 2, hero: 'qbby' },
      goalDoor: { x: 33, y: 1 },
      rects: [
        [0, 0, 6, 1, 'grass'],     // Start floor (surface y=2)
        [7, 0, 7, 0, 'grass'],     // Laser 1 floor (emitter at x=7, y=1..2)
        [8, 0, 13, 2, 'grass'],    // Platform 2 (surface y=3)
        [14, 0, 15, 0, 'grass'],   // Laser 2 notch (emitter at x=14, y=1..2)
        [16, 0, 20, 2, 'grass'],   // Platform 3 (surface y=3)
        [21, 0, 22, 0, 'grass'],   // Laser 3 pit (emitter at x=21, y=1..2)
        [23, 0, 27, 2, 'grass'],   // Platform 4 (surface y=3)
        [28, 0, 35, 0, 'grass'],   // Lower goal floor (surface y=1)
        [31, 4, 35, 10, 'grass']   // Green ceiling overhang above goal
      ],
      lasers: [
        { id: 0, x: 7, y: 1, maxY: 2 },
        { id: 1, x: 14, y: 1, maxY: 2 },
        { id: 2, x: 21, y: 1, maxY: 2 },
        { id: 3, x: 29, y: 1, maxY: 2 }
      ],
      crowns: [{ x: 29.0, y: 4.3 }],
      tutorials: [
        { x: 4.5, y: 6.2, kind: 'laser3' }
      ],
      solution: [
        // Obstacle 1: Block Laser #1 (x=7) with 2 vertical boxes at (7,2) and (7,1) resting on (7,0)
        { type: 'walkTo', x: 6.0 },
        { type: 'createChain', dirs: ['right', 'down'] },
        { type: 'place' },
        { type: 'jump', dir: 1, frames: 24 },
        { type: 'walkTo', x: 12.0 },
        // Obstacle 2: Cap Laser #2 (x=14) with 2 boxes supported on x=13, y=2
        { type: 'createChain', dirs: ['right', 'right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, frames: 20 },
        { type: 'walkTo', x: 14.0 },
        { type: 'jump', dir: 1, frames: 26 },
        { type: 'walkTo', x: 19.0 },
        // Obstacle 3: Cap Laser #3 (x=21) with 2 boxes supported on x=20, y=2
        { type: 'createChain', dirs: ['right', 'right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, frames: 20 },
        { type: 'walkTo', x: 21.0 },
        { type: 'jump', dir: 1, frames: 26 },
        { type: 'walkTo', x: 26.0 },
        // Obstacle 4: Cap Laser #4 (x=29) with 3 boxes [27, 28, 29] at y=3, grab Crown, drop to Goal Door
        { type: 'createChain', dirs: ['right', 'right', 'right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, frames: 20 },
        { type: 'walkTo', x: 29.0 },
        { type: 'walkTo', x: 33.0 },
        { type: 'enterDoor' }
      ]
    }),

    // =========================================================================
    // STAGE 7: W1S7 — Grey Speckled Stone Overhangs & Hook / Retract Grapple (P7)
    // boxLimit: 5 | Crowns: 1 | targetBoxBudget: 20 (optimal: 18)
    // =========================================================================
    buildStage({
      index: 6,
      id: 'W1S7',
      world: 1,
      stage: 7,
      width: 36,
      height: 11,
      boxLimit: 5,
      targetBoxBudget: 20,
      spawn: { x: 2, y: 2, hero: 'qbby' },
      goalDoor: { x: 33, y: 2 },
      rects: [
        [0, 0, 5, 1, 'grass'],     // Start floor (surface y=2)
        [6, 0, 9, 1, 'grass'],     // Base under stone overhang
        [6, 3, 6, 4, 'stone'],     // Inverted-L stone overhang lip
        [7, 2, 9, 4, 'stone'],     // Stone block mass (surface y=5)
        [10, 0, 13, 1, 'stone'],   // Recessed stone chamber floor (surface y=2)
        [10, 6, 12, 7, 'stone'],   // Hanging stone ceiling over chamber
        [14, 0, 18, 3, 'grass'],   // Middle green platform (surface y=4)
        // x=19..21 is 3-tile bottomless chasm
        [22, 0, 24, 2, 'stone'],   // C-shaped catch floor (surface y=3)
        [22, 5, 23, 7, 'stone'],   // C-shaped upper overhang
        [25, 0, 25, 4, 'stone'],   // Pillar A (surface y=5)
        [25, 7, 28, 10, 'grass'],  // High ceiling above chimney
        [27, 0, 27, 4, 'stone'],   // Pillar B (surface y=5)
        [28, 0, 28, 1, 'stone'],   // Pillar B right L-step (surface y=2)
        // x=29..30 is bottomless pit
        [31, 0, 35, 1, 'grass']    // Goal platform (surface y=2)
      ],
      crowns: [{ x: 26.0, y: 5.2 }],
      tutorials: [
        { x: 3.5, y: 6.2, kind: 'hook5' }
      ],
      solution: [
        // Obstacle 1: Hook 4 boxes [up, up, up, right] onto stone overhang (x=6, y=5)
        { type: 'walkTo', x: 5.0 },
        { type: 'createChain', dirs: ['up', 'up', 'up', 'right'] },
        { type: 'hook' },
        // Drop into recessed chamber and walk to shaft x=13, y=2
        { type: 'walkTo', x: 13.0 },
        // Obstacle 2: Hook 3 boxes [up, up, right] onto (x=14, y=4)
        { type: 'createChain', dirs: ['up', 'up', 'right'] },
        { type: 'hook' },
        // Obstacle 3: Walk to chasm edge x=18, y=4 and hook 5 boxes into C-mouth (x=22, y=3)
        { type: 'walkTo', x: 18.0 },
        { type: 'createChain', dirs: ['right', 'right', 'right', 'right', 'down'] },
        { type: 'hook' },
        // Obstacle 4: Walk to x=24, y=3 and hook 3 boxes onto Pillar A (x=25, y=5)
        { type: 'walkTo', x: 24.0 },
        { type: 'createChain', dirs: ['up', 'up', 'right'] },
        { type: 'hook' },
        // Jump across chimney gap x=26 (collecting Crown #1) onto Pillar B and drop to (x=28, y=2)
        { type: 'jump', dir: 1, targetX: 27.2 },
        { type: 'walkTo', x: 28.0 },
        // Obstacle 5: Hook 3 boxes across final pit onto Goal platform (x=31, y=2)
        { type: 'createChain', dirs: ['right', 'right', 'right'] },
        { type: 'hook' },
        { type: 'walkTo', x: 33.0 },
        { type: 'enterDoor' }
      ]
    }),

    // =========================================================================
    // STAGE 8: W1S8 — Box Push / Slide (Shoot) & Dotted Phase Bridges (P8)
    // boxLimit: 4 | Crowns: 1 | targetBoxBudget: 8 (optimal: 7)
    // =========================================================================
    buildStage({
      index: 7,
      id: 'W1S8',
      world: 1,
      stage: 8,
      width: 38,
      height: 11,
      boxLimit: 4,
      targetBoxBudget: 8,
      spawn: { x: 2, y: 2, hero: 'qbby' },
      goalDoor: { x: 36, y: 4 },
      rects: [
        [0, 0, 5, 1, 'grass'],     // Start floor (surface y=2)
        [12, 0, 17, 2, 'grass'],   // Platform 2 (surface y=3)
        [25, 0, 29, 2, 'grass'],   // Platform 3 base (surface y=3)
        [26, 3, 29, 3, 'grass'],   // Step up to surface y=4
        [34, 0, 37, 3, 'grass'],   // Goal platform (surface y=4)
        [34, 4, 34, 4, 'grass']    // Switch 3 & Crown block (surface y=5)
      ],
      phaseBlocks: [
        // Bridge 1: Blue (x=6..11, y=1)
        { x: 6, y: 1, color: 'blue', group: 'b1' },
        { x: 7, y: 1, color: 'blue', group: 'b1' },
        { x: 8, y: 1, color: 'blue', group: 'b1' },
        { x: 9, y: 1, color: 'blue', group: 'b1' },
        { x: 10, y: 1, color: 'blue', group: 'b1' },
        { x: 11, y: 1, color: 'blue', group: 'b1' },
        // Bridge 2: Red (x=18..22, y=2)
        { x: 18, y: 2, color: 'red', group: 'r1' },
        { x: 19, y: 2, color: 'red', group: 'r1' },
        { x: 20, y: 2, color: 'red', group: 'r1' },
        { x: 21, y: 2, color: 'red', group: 'r1' },
        { x: 22, y: 2, color: 'red', group: 'r1' },
        // Bridge 3: Blue (x=30..33, y=3)
        { x: 30, y: 3, color: 'blue', group: 'b2' },
        { x: 31, y: 3, color: 'blue', group: 'b2' },
        { x: 32, y: 3, color: 'blue', group: 'b2' },
        { x: 33, y: 3, color: 'blue', group: 'b2' }
      ],
      switches: [
        { id: 0, x: 12, y: 2, color: 'blue', group: 'b1', side: 'left' },
        { id: 1, x: 26, y: 3, color: 'red', group: 'r1', side: 'left' },
        { id: 2, x: 34, y: 4, color: 'blue', group: 'b2', side: 'left' }
      ],
      crowns: [{ x: 34.0, y: 5.3 }],
      tutorials: [
        { x: 3.5, y: 6.2, kind: 'shoot4' }
      ],
      solution: [
        // Obstacle 1: Shoot 1 box across Blue dotted bridge to hit Blue Switch #1 at (12, 2)
        { type: 'walkTo', x: 4.0 },
        { type: 'createChain', dirs: ['right'] },
        { type: 'shoot' },
        { type: 'walkTo', x: 10.0 },
        { type: 'jump', dir: 1, targetX: 11.0 },
        { type: 'jump', dir: 1, targetX: 12.5 },
        // Obstacle 2: Shoot 4 boxes across Red dotted bridge + 2-tile gap into Red Switch #2 at (26, 3)
        { type: 'walkTo', x: 16.0 },
        { type: 'createChain', dirs: ['right', 'right', 'right', 'right'] },
        { type: 'shoot' },
        { type: 'walkTo', x: 21.0 },
        { type: 'jump', dir: 1, targetX: 22.5 },
        // Obstacle 3: Shoot 2 boxes across Blue bridge #2 to hit Blue Switch #3 at (34, 4)
        { type: 'walkTo', x: 28.0 },
        { type: 'createChain', dirs: ['right', 'right'] },
        { type: 'shoot' },
        { type: 'walkTo', x: 31.0 },
        { type: 'jump', dir: 1, targetX: 32.5 },
        { type: 'walkTo', x: 34.0 },
        { type: 'walkTo', x: 36.0 },
        { type: 'enterDoor' }
      ]
    }),

    // =========================================================================
    // STAGE 9: W2S1 (Bonus 1) — Laser Shielding + Phase Switch Combo (P9)
    // boxLimit: 4 | Crowns: 2 | targetBoxBudget: 9 (optimal: 8)
    // =========================================================================
    buildStage({
      index: 8,
      id: 'W2S1',
      world: 2,
      stage: 1,
      width: 34,
      height: 11,
      boxLimit: 4,
      targetBoxBudget: 9,
      spawn: { x: 2, y: 2, hero: 'qbby' },
      goalDoor: { x: 31, y: 4 },
      rects: [
        [0, 0, 5, 1, 'grass'],     // Start floor (surface y=2)
        [6, 0, 11, 0, 'grass'],    // Laser 1 floor under Blue phase bridge
        [12, 0, 17, 2, 'grass'],   // Middle platform (surface y=3)
        [18, 0, 19, 0, 'grass'],   // Laser 2 pit floor
        [20, 0, 23, 2, 'grass'],   // Island platform (surface y=3)
        [28, 0, 33, 3, 'grass']    // Goal platform (surface y=4)
      ],
      phaseBlocks: [
        // Blue bridge at y=1 (when solid, blocks Laser #1 at x=8, y=0!)
        { x: 6, y: 1, color: 'blue', group: 'b1' },
        { x: 7, y: 1, color: 'blue', group: 'b1' },
        { x: 8, y: 1, color: 'blue', group: 'b1' },
        { x: 9, y: 1, color: 'blue', group: 'b1' },
        { x: 10, y: 1, color: 'blue', group: 'b1' },
        { x: 11, y: 1, color: 'blue', group: 'b1' },
        // Red bridge at y=2
        { x: 24, y: 2, color: 'red', group: 'r1' },
        { x: 25, y: 2, color: 'red', group: 'r1' },
        { x: 26, y: 2, color: 'red', group: 'r1' },
        { x: 27, y: 2, color: 'red', group: 'r1' }
      ],
      lasers: [
        { id: 0, x: 8, y: 1, maxY: 5 },
        { id: 1, x: 19, y: 1, maxY: 2 }
      ],
      switches: [
        { id: 0, x: 12, y: 2, color: 'blue', group: 'b1', side: 'left' },
        { id: 1, x: 28, y: 3, color: 'red', group: 'r1', side: 'left' }
      ],
      crowns: [
        { x: 10.5, y: 3.3 },
        { x: 26.0, y: 4.3 }
      ],
      tutorials: [],
      solution: [
        // Step 1: Shoot 2 boxes through Laser #1 to hit Blue Switch #1, solidifying bridge & capping Laser #1
        { type: 'walkTo', x: 4.0 },
        { type: 'createChain', dirs: ['right', 'right'] },
        { type: 'shoot' },
        { type: 'walkTo', x: 9.0 },
        { type: 'jump', dir: 1, targetX: 10.5 },
        { type: 'jump', dir: 1, targetX: 12.5 },
        // Step 2: Place 3-box bridge across Laser #2 (x=17..19, y=3)
        { type: 'walkTo', x: 16.0 },
        { type: 'createChain', dirs: ['right', 'right', 'right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 17.5 },
        { type: 'walkTo', x: 19.0 },
        { type: 'jump', dir: 1, targetX: 20.5 },
        // Step 3: Shoot 3 boxes across Red bridge to hit Red Switch #2 at (28, 3)
        { type: 'walkTo', x: 22.0 },
        { type: 'createChain', dirs: ['right', 'right', 'right'] },
        { type: 'shoot' },
        { type: 'walkTo', x: 24.0 },
        { type: 'jump', dir: 1, targetX: 25.5 },
        { type: 'walkTo', x: 26.5 },
        { type: 'jump', dir: 1, targetX: 28.5 },
        { type: 'walkTo', x: 31.0 },
        { type: 'enterDoor' }
      ]
    }),

    // =========================================================================
    // STAGE 10: W2S2 (Bonus 2) — Spike Pit + Grey Stone Hook Grapple Combo (P9)
    // boxLimit: 5 | Crowns: 2 | targetBoxBudget: 14 (optimal: 13)
    // =========================================================================
    buildStage({
      index: 9,
      id: 'W2S2',
      world: 2,
      stage: 2,
      width: 33,
      height: 11,
      boxLimit: 5,
      targetBoxBudget: 14,
      spawn: { x: 2, y: 2, hero: 'qbby' },
      goalDoor: { x: 29, y: 2 },
      rects: [
        [0, 0, 5, 1, 'grass'],     // Start floor (surface y=2)
        [6, 0, 8, 0, 'grass'],     // Spike bed 1 floor
        [7, 3, 11, 4, 'stone'],    // Grey stone overhang 1 (surface y=5)
        [9, 0, 11, 2, 'stone'],    // Stone support 1
        [12, 0, 15, 1, 'grass'],   // Safe island (surface y=2)
        [16, 0, 17, 0, 'grass'],   // Spike bed 2 floor
        [17, 3, 20, 4, 'stone'],   // Grey stone overhang 2 (surface y=5)
        [18, 0, 20, 2, 'stone'],   // Stone support 2
        [21, 0, 22, 1, 'grass'],   // Pre-tunnel floor (surface y=2)
        [23, 0, 25, 0, 'grass'],   // Spike bed 3 floor
        [23, 5, 25, 7, 'stone'],   // Low stone ceiling over spikes
        [26, 0, 32, 1, 'grass']    // Goal platform (surface y=2)
      ],
      spikes: [
        { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 },
        { x: 16, y: 1 }, { x: 17, y: 1 },
        { x: 23, y: 1 }, { x: 24, y: 1 }, { x: 25, y: 1 }
      ],
      crowns: [
        { x: 9.0, y: 5.3 },
        { x: 18.5, y: 5.3 }
      ],
      tutorials: [],
      solution: [
        // Room 1: Hook 5 boxes [up, up, up, right, right] over spikes onto stone overhang (x=7, y=5)
        { type: 'walkTo', x: 5.0 },
        { type: 'createChain', dirs: ['up', 'up', 'up', 'right', 'right'] },
        { type: 'hook' },
        { type: 'walkTo', x: 15.0 },
        // Room 2: Hook 5 boxes [up, up, up, right, right] onto second stone overhang (x=17, y=5)
        { type: 'createChain', dirs: ['up', 'up', 'up', 'right', 'right'] },
        { type: 'hook' },
        { type: 'walkTo', x: 22.0 },
        // Room 3: Place 3 horizontal boxes onto floor spikes (x=23..25, y=2)
        { type: 'createChain', dirs: ['right', 'right', 'right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 23.5 },
        { type: 'walkTo', x: 29.0 },
        { type: 'enterDoor' }
      ]
    }),

    // =========================================================================
    // STAGE 11: W2S3 (Bonus 3) — Shoot + Laser + Dual Phase Bridge Gauntlet (P9)
    // boxLimit: 4 | Crowns: 2 | targetBoxBudget: 11 (optimal: 10)
    // =========================================================================
    buildStage({
      index: 10,
      id: 'W2S3',
      world: 2,
      stage: 3,
      width: 35,
      height: 11,
      boxLimit: 4,
      targetBoxBudget: 11,
      spawn: { x: 2, y: 2, hero: 'qbby' },
      goalDoor: { x: 31, y: 4 },
      rects: [
        [0, 0, 4, 1, 'grass'],     // Start floor (surface y=2)
        [10, 0, 14, 2, 'grass'],   // Platform 2 (surface y=3)
        [15, 0, 17, 0, 'grass'],   // Twin laser pit floor
        [18, 0, 21, 2, 'grass'],   // Platform 3 (surface y=3)
        [25, 0, 26, 0, 'grass'],   // Laser 3 pit floor
        [27, 0, 34, 2, 'grass'],   // Platform 4 base (surface y=3)
        [28, 3, 34, 3, 'grass']    // Goal platform top (surface y=4)
      ],
      phaseBlocks: [
        { x: 5, y: 1, color: 'blue', group: 'b1' },
        { x: 6, y: 1, color: 'blue', group: 'b1' },
        { x: 7, y: 1, color: 'blue', group: 'b1' },
        { x: 8, y: 1, color: 'blue', group: 'b1' },
        { x: 9, y: 1, color: 'blue', group: 'b1' },
        { x: 22, y: 2, color: 'red', group: 'r1' },
        { x: 23, y: 2, color: 'red', group: 'r1' },
        { x: 24, y: 2, color: 'red', group: 'r1' }
      ],
      lasers: [
        { id: 0, x: 15, y: 1, maxY: 2 },
        { id: 1, x: 16, y: 1, maxY: 2 },
        { id: 2, x: 25, y: 1, maxY: 2 }
      ],
      switches: [
        { id: 0, x: 10, y: 2, color: 'blue', group: 'b1', side: 'left' },
        { id: 1, x: 28, y: 3, color: 'red', group: 'r1', side: 'left' }
      ],
      crowns: [
        { x: 8.5, y: 3.3 },
        { x: 25.0, y: 4.3 }
      ],
      tutorials: [],
      solution: [
        // Room 1: Shoot 2 boxes across Blue bridge to hit Blue Switch #1 at (10, 2)
        { type: 'walkTo', x: 3.0 },
        { type: 'createChain', dirs: ['right', 'right'] },
        { type: 'shoot' },
        { type: 'walkTo', x: 7.0 },
        { type: 'jump', dir: 1, targetX: 8.5 },
        { type: 'jump', dir: 1, targetX: 10.5 },
        // Room 2: Place 4 boxes across twin lasers (x=14..17, y=3)
        { type: 'walkTo', x: 13.0 },
        { type: 'createChain', dirs: ['right', 'right', 'right', 'right'] },
        { type: 'place' },
        { type: 'jump', dir: 1, targetX: 14.5 },
        { type: 'walkTo', x: 17.0 },
        { type: 'jump', dir: 1, targetX: 18.5 },
        // Room 3: Shoot 4 boxes across Red bridge & Laser #3 into Red Switch #2 at (28, 3)
        { type: 'walkTo', x: 20.0 },
        { type: 'createChain', dirs: ['right', 'right', 'right', 'right'] },
        { type: 'shoot' },
        { type: 'walkTo', x: 23.0 },
        { type: 'jump', dir: 1, targetX: 24.5 },
        { type: 'walkTo', x: 31.0 },
        { type: 'enterDoor' }
      ]
    }),

    // =========================================================================
    // STAGE 12: W2S4 (Bonus 4 Finale) — Qucy + Qbby Dual-Character Co-Op Finale (P9)
    // boxLimit: 4 | Crowns: 2 | targetBoxBudget: 14 (optimal: 8)
    // =========================================================================
    buildStage({
      index: 11,
      id: 'W2S4',
      world: 2,
      stage: 4,
      width: 34,
      height: 11,
      boxLimit: 4,
      targetBoxBudget: 14,
      spawn: { x: 2, y: 5, hero: 'qucy' },
      partnerSpawn: { x: 2, y: 2, hero: 'qbby' },
      goalDoor: { x: 29, y: 2 },
      rects: [
        [0, 4, 5, 4, 'grass'],     // Qucy upper left deck (surface y=5)
        [0, 0, 5, 1, 'grass'],     // Qbby lower left floor (surface y=2)
        [6, 0, 9, 0, 'grass'],     // Laser 1 floor under lower Blue bridge
        [10, 4, 14, 4, 'grass'],   // Upper central deck (surface y=5)
        [10, 0, 16, 1, 'grass'],   // Lower central plaza (surface y=2)
        [17, 0, 19, 0, 'grass'],   // Co-op spike pit floor (spikes at y=1)
        [20, 0, 20, 1, 'grass'],   // Safe post after spikes (surface y=2)
        [19, 4, 23, 4, 'stone'],   // Grey stone overhang (surface y=5, open at y=3 below)
        [23, 5, 23, 5, 'stone'],   // Red Switch #2 post on overhang
        [25, 0, 33, 1, 'grass']    // Final goal platform (surface y=2)
      ],
      phaseBlocks: [
        // Upper Blue bridge (x=6..9, y=4)
        { x: 6, y: 4, color: 'blue', group: 'b1' },
        { x: 7, y: 4, color: 'blue', group: 'b1' },
        { x: 8, y: 4, color: 'blue', group: 'b1' },
        { x: 9, y: 4, color: 'blue', group: 'b1' },
        // Lower Blue bridge (x=6..9, y=1) — caps Laser #1 at x=7 when solid!
        { x: 6, y: 1, color: 'blue', group: 'b1' },
        { x: 7, y: 1, color: 'blue', group: 'b1' },
        { x: 8, y: 1, color: 'blue', group: 'b1' },
        { x: 9, y: 1, color: 'blue', group: 'b1' },
        // Lower Red bridge (x=21..24, y=1)
        { x: 21, y: 1, color: 'red', group: 'r1' },
        { x: 22, y: 1, color: 'red', group: 'r1' },
        { x: 23, y: 1, color: 'red', group: 'r1' },
        { x: 24, y: 1, color: 'red', group: 'r1' }
      ],
      spikes: [
        { x: 17, y: 1 }, { x: 18, y: 1 }, { x: 19, y: 1 }
      ],
      lasers: [
        { id: 0, x: 7, y: 1, maxY: 3 }
      ],
      switches: [
        { id: 0, x: 10, y: 5, color: 'blue', group: 'b1', side: 'left' },
        { id: 1, x: 23, y: 5, color: 'red', group: 'r1', side: 'left' }
      ],
      crowns: [
        { x: 8.0, y: 2.3 },
        { x: 21.0, y: 5.3 }
      ],
      tutorials: [],
      solution: [
        // Step 1 (Qucy): Shoot 2 boxes across upper deck to hit Blue Switch #1 at (10, 5)
        { type: 'walkTo', x: 4.0 },
        { type: 'createChain', dirs: ['right', 'right'] },
        { type: 'shoot' },
        // Qucy crosses upper Blue bridge and drops to Lower Plaza at x=15
        { type: 'walkTo', x: 7.0 },
        { type: 'jump', dir: 1, targetX: 8.5 },
        { type: 'walkTo', x: 15.0 },
        // Step 2 (Qbby): Switch to Qbby, walk across newly-solid lower Blue bridge (collecting Crown #1) to x=16
        { type: 'switchHero', hero: 'qbby' },
        { type: 'walkTo', x: 16.0 },
        // Step 3 (Qbby): Place persistent 3-box spike shield onto floor spikes x=17..19, y=2
        { type: 'createChain', dirs: ['right', 'right', 'right'] },
        { type: 'place' },
        // Step 4 (Qucy): Switch to Qucy, hop onto Qbby's spike bridge at x=18, y=3, and hook 3 boxes onto stone overhang (x=19, y=5)
        { type: 'switchHero', hero: 'qucy' },
        { type: 'walkTo', x: 16.0 },
        { type: 'jump', dir: 1, targetX: 18.0 },
        { type: 'createChain', dirs: ['up', 'up', 'right'] },
        { type: 'hook' },
        // Qucy walks across stone overhang (collecting Crown #2 at x=21 and touching Red Switch #2 at x=23), then drops to Goal Door
        { type: 'walkTo', x: 22.0 },
        { type: 'jump', dir: 1, targetX: 24.5 },
        { type: 'walkTo', x: 29.0 },
        // Step 5 (Qbby): Switch to Qbby, hop onto his spike bridge and walk across solid Red bridge to join Qucy at Goal Door
        { type: 'switchHero', hero: 'qbby' },
        { type: 'jump', dir: 1, targetX: 17.5 },
        { type: 'walkTo', x: 29.0 },
        { type: 'enterDoor' }
      ]
    })
  ];

  window.BoxBoyStages = STAGES;
})();
