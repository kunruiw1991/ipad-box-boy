/**
 * 100% Zero-Text <canvas> Renderer for BoxBoy! + Box Girl! (Zero-Text Web Edition)
 * Strictly graphical rendering: zero ctx.fillText / ctx.strokeText calls anywhere.
 * Faithfully recreates the P1-P9 Bilibili reference aesthetic (sky equalizer bands,
 * green grid grass, grey speckled stone, floor spikes, spiky yellow lasers,
 * blue/red switches & dotted/solid phase blocks, Qbby & Qucy with ribbon bow,
 * graphical box-pip HUD, animated tutorial thought-bubbles, Title, Map, and Stage Clear modal).
 */
(function () {
  'use strict';

  class BoxBoyRenderer {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.width = 1180;
      this.height = 820;
      this.dpr = 1;

      // Camera & world-to-screen transform
      this.tileSize = 42;
      this.cameraX = 0;
      this.cameraY = 0;
      this.viewOriginX = 0;
      this.viewOriginY = 0;

      // Interactive canvas hit regions for Title, Map, Clear, and Mode A action bubbles
      this.hitRegions = [];
      // Named screen-space rects (play button, map nodes, clear-card buttons) the
      // Guide Coach points its hand at.
      this.regions = {};
    }

    attach(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
    }

    resize() {
      if (!this.canvas) return;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.width = window.innerWidth || 1180;
      this.height = window.innerHeight || 820;
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.canvas.style.width = this.width + 'px';
      this.canvas.style.height = this.height + 'px';
      if (window.BoxBoyEngine) {
        this.render(window.BoxBoyEngine);
      }
    }

    worldToScreen(wx, wy, stageHeight) {
      const H = stageHeight || (window.BoxBoyEngine && window.BoxBoyEngine.stage ? window.BoxBoyEngine.stage.height : 11);
      return {
        x: this.viewOriginX + (wx - this.cameraX) * this.tileSize,
        y: this.viewOriginY + (H - wy) * this.tileSize
      };
    }

    gridCellToRect(gx, gy, stageHeight) {
      const H = stageHeight || (window.BoxBoyEngine && window.BoxBoyEngine.stage ? window.BoxBoyEngine.stage.height : 11);
      return {
        x: this.viewOriginX + (gx - this.cameraX) * this.tileSize,
        y: this.viewOriginY + (H - gy - 1) * this.tileSize,
        w: this.tileSize,
        h: this.tileSize
      };
    }

    screenToGrid(clientX, clientY) {
      const eng = window.BoxBoyEngine;
      const H = eng && eng.stage ? eng.stage.height : 11;
      const wx = (clientX - this.viewOriginX) / this.tileSize + this.cameraX;
      const wy = H - (clientY - this.viewOriginY) / this.tileSize;
      return {
        wx,
        wy,
        gx: Math.floor(wx),
        gy: Math.floor(wy)
      };
    }

    render(engine) {
      if (!this.ctx || !engine) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.scale(this.dpr, this.dpr);
      this.hitRegions = [];
      this.regions = {};

      this._drawSkyBackground(ctx, engine.time);

      if (engine.screen === 'title') {
        this._drawTitleScreen(ctx, engine);
      } else if (engine.screen === 'map') {
        this._drawMapScreen(ctx, engine);
      } else if (engine.screen === 'game' || engine.screen === 'clear') {
        this._drawGameStage(ctx, engine);
        this._drawTopRightHUD(ctx, engine);
        if (engine.screen === 'clear') {
          this._drawStageClearModal(ctx, engine);
        }
      }

      this._drawCoachRegionGlow(ctx, engine);

      ctx.restore();
    }

    // =========================================================================
    // SKY BACKGROUND (Pastel Cyan Bands + Vertical Sine Wave Equalizer Bars)
    // =========================================================================

    _drawSkyBackground(ctx, time) {
      const W = this.width;
      const H = this.height;
      const bands = ['#b7f0ff', '#cbf5ff', '#dff9ff', '#effcff', '#f8feff'];
      const bandH = H / bands.length;
      for (let i = 0; i < bands.length; i++) {
        ctx.fillStyle = bands[i];
        ctx.fillRect(0, i * bandH, W, bandH + 2);
      }

      // Vertical white translucent equalizer bars across the background (as in sheet_p1-p8)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
      const barStep = 10;
      for (let x = 0; x < W; x += barStep) {
        const wave = Math.sin(x * 0.014 + time * 0.8) * 55 + Math.cos(x * 0.007 - time * 0.4) * 35;
        const topY = H * 0.34 + wave;
        ctx.fillRect(x, topY, 5, H - topY);
      }

      // Twinkling 4-point white diamond sparkles
      const sparkles = [
        { x: W * 0.18, y: H * 0.18, p: 0.0 },
        { x: W * 0.46, y: H * 0.14, p: 1.7 },
        { x: W * 0.76, y: H * 0.22, p: 3.1 },
        { x: W * 0.62, y: H * 0.32, p: 4.5 }
      ];
      sparkles.forEach((sp) => {
        const s = 4 + Math.sin(time * 2.5 + sp.p) * 2.5;
        if (s > 1) {
          this._drawSparkle(ctx, sp.x, sp.y, s, 'rgba(255,255,255,0.85)');
        }
      });
    }

    _drawSparkle(ctx, cx, cy, r, color) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 1.8);
      ctx.quadraticCurveTo(cx, cy, cx + r * 1.8, cy);
      ctx.quadraticCurveTo(cx, cy, cx, cy + r * 1.8);
      ctx.quadraticCurveTo(cx, cy, cx - r * 1.8, cy);
      ctx.quadraticCurveTo(cx, cy, cx, cy - r * 1.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // =========================================================================
    // TITLE SCREEN (100% Zero-Text Iconic Block Diorama + Qbby & Qucy Toggle)
    // =========================================================================

    _drawTitleScreen(ctx, engine) {
      const W = this.width;
      const H = this.height;
      const cx = W * 0.5;
      const isPortrait = H > W;
      const unit = Math.min(W, H) * (isPortrait ? 0.062 : 0.068);

      // Interactive green grass ground floor at bottom
      const floorY = H * 0.76;
      const cols = Math.ceil(W / unit) + 2;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < cols; c++) {
          this._drawGrassCellScreen(ctx, c * unit, floorY + r * unit, unit, r === 0, false, false, false);
        }
      }

      // Two Stacked Black Logo Banner Blocks with pure geometric box/bow emblems (zero letters!)
      const bannerW = Math.min(W * 0.78, unit * 11.2);
      const bannerH = unit * 1.55;
      const bannerX = cx - bannerW * 0.5;
      const banner1Y = H * 0.16;
      const banner2Y = banner1Y + bannerH + unit * 0.28;

      // Upper Black Block (BoxBoy geometric emblem: 6 crisp white box-grid glyphs)
      ctx.fillStyle = '#111111';
      this._roundRect(ctx, bannerX, banner1Y, bannerW, bannerH, 6);
      ctx.fill();

      const cellS = bannerH * 0.56;
      const startGlyphX = bannerX + (bannerW - 6 * (cellS * 1.32)) * 0.5;
      for (let i = 0; i < 6; i++) {
        const gx = startGlyphX + i * cellS * 1.32;
        const gy = banner1Y + (bannerH - cellS) * 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(gx, gy, cellS, cellS);
        ctx.fillStyle = '#111111';
        if (i === 0 || i === 3) {
          // Box with inner square
          ctx.fillRect(gx + cellS * 0.28, gy + cellS * 0.28, cellS * 0.44, cellS * 0.44);
        } else if (i === 1 || i === 4) {
          // Mini Qbby eyes inside block
          ctx.fillRect(gx + cellS * 0.26, gy + cellS * 0.34, cellS * 0.14, cellS * 0.14);
          ctx.fillRect(gx + cellS * 0.60, gy + cellS * 0.34, cellS * 0.14, cellS * 0.14);
        } else if (i === 2) {
          // L-staircase cutout
          ctx.fillRect(gx + cellS * 0.52, gy, cellS * 0.48, cellS * 0.48);
        } else {
          // Crown silhouette inside block
          this._drawCrownIcon(ctx, gx + cellS * 0.5, gy + cellS * 0.54, cellS * 0.34, '#111111', '#ffffff');
        }
      }

      // Plus (+) connector between the two stacked black blocks
      const plusS = unit * 0.52;
      const plusY = banner1Y + bannerH + (banner2Y - (banner1Y + bannerH)) * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(cx - plusS * 0.5, plusY - plusS * 0.18, plusS, plusS * 0.36);
      ctx.rect(cx - plusS * 0.18, plusY - plusS * 0.5, plusS * 0.36, plusS);
      ctx.fill();
      ctx.stroke();

      // Lower Black Block (Box Girl geometric emblem with pink ribbon bow & connected chain)
      ctx.fillStyle = '#111111';
      this._roundRect(ctx, bannerX, banner2Y, bannerW, bannerH, 6);
      ctx.fill();

      for (let i = 0; i < 6; i++) {
        const gx = startGlyphX + i * cellS * 1.32;
        const gy = banner2Y + (bannerH - cellS) * 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(gx, gy, cellS, cellS);
        ctx.fillStyle = '#111111';
        if (i === 1) {
          // Mini Qucy with ribbon bow
          ctx.fillRect(gx + cellS * 0.26, gy + cellS * 0.38, cellS * 0.14, cellS * 0.14);
          ctx.fillRect(gx + cellS * 0.60, gy + cellS * 0.38, cellS * 0.14, cellS * 0.14);
          this._drawQucyBow(ctx, gx + cellS * 0.22, gy + cellS * 0.08, cellS * 0.42);
        } else if (i === 3) {
          // Red directional arrow inside block
          ctx.fillStyle = '#e60012';
          ctx.beginPath();
          ctx.moveTo(gx + cellS * 0.3, gy + cellS * 0.24);
          ctx.lineTo(gx + cellS * 0.76, gy + cellS * 0.5);
          ctx.lineTo(gx + cellS * 0.3, gy + cellS * 0.76);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(gx + cellS * 0.3, gy + cellS * 0.3, cellS * 0.4, cellS * 0.4);
        }
      }

      // Qucy & Qbby perched happily atop the upper logo block (exact P1 Title Screen pose!)
      const bounce = Math.abs(Math.sin(engine.time * 3.2)) * 6;
      this._drawHeroScreen(ctx, bannerX + unit * 0.8, banner1Y - unit * 0.96 - bounce, unit * 0.88, 'qucy', 1, 'normal', engine.time * 8, 1, 1);
      this._drawHeroScreen(ctx, bannerX + unit * 1.9, banner1Y - unit * 0.96 - bounce * 0.6, unit * 0.88, 'qbby', 1, 'normal', engine.time * 8 + 1, 1, 1);

      // Two Portrait Character Select Cards ("A Tale for One" Qbby vs "A Tale for Two" Qucy) with Red Corner Brackets
      const cardW = unit * 2.7;
      const cardH = unit * 2.2;
      const cardY = banner2Y + bannerH + unit * 0.45;
      const card1X = cx - cardW - unit * 0.4;
      const card2X = cx + unit * 0.4;

      [
        { hero: 'qbby', x: card1X, y: cardY },
        { hero: 'qucy', x: card2X, y: cardY }
      ].forEach((c) => {
        const selected = engine.selectedHero === c.hero;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 3;
        this._roundRect(ctx, c.x, c.y, cardW, cardH, 8);
        ctx.fill();
        ctx.stroke();

        if (selected) {
          this._drawRedSelectionBrackets(ctx, c.x - 6, c.y - 6, cardW + 12, cardH + 12, 14);
        }

        if (c.hero === 'qbby') {
          this._drawHeroScreen(ctx, c.x + cardW * 0.5 - unit * 0.5, c.y + cardH * 0.32, unit, 'qbby', 1, selected ? 'clear' : 'normal', engine.time * 6, 1, 1);
        } else {
          this._drawHeroScreen(ctx, c.x + cardW * 0.24, c.y + cardH * 0.34, unit * 0.92, 'qucy', 1, selected ? 'clear' : 'normal', engine.time * 6, 1, 1);
          this._drawHeroScreen(ctx, c.x + cardW * 0.54, c.y + cardH * 0.34, unit * 0.92, 'qbby', -1, selected ? 'clear' : 'normal', engine.time * 6 + 1, 1, 1);
        }

        this.hitRegions.push({
          x: c.x,
          y: c.y,
          w: cardW,
          h: cardH,
          action: () => {
            engine.selectedHero = c.hero;
            if (engine.audio) engine.audio.boxCreate(c.hero === 'qucy' ? 3 : 1);
          }
        });
      });

      // Large Pulsing Play Button [ ▶ ] on the grass floor
      const playW = unit * 2.8;
      const playH = unit * 1.35;
      const playX = cx - playW * 0.5;
      const playY = floorY - playH * 0.55;
      const pulse = 1 + Math.sin(engine.time * 4) * 0.04;

      ctx.save();
      ctx.translate(cx, playY + playH * 0.5);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#111111';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      this._roundRect(ctx, -playW * 0.5, -playH * 0.5, playW, playH, 14);
      ctx.fill();
      ctx.stroke();

      // Crisp red & white Play Triangle
      ctx.fillStyle = '#e60012';
      ctx.beginPath();
      ctx.moveTo(-unit * 0.32, -unit * 0.36);
      ctx.lineTo(unit * 0.42, 0);
      ctx.lineTo(-unit * 0.32, unit * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      this.regions.play = { x: playX, y: playY, w: playW, h: playH };
      this.hitRegions.push({
        x: playX - 10,
        y: playY - 10,
        w: playW + 20,
        h: playH + 20,
        action: () => {
          if (engine.audio) engine.audio.crownPickup();
          engine.screen = 'map';
        }
      });
    }

    _drawRedSelectionBrackets(ctx, x, y, w, h, len) {
      ctx.save();
      ctx.strokeStyle = '#e60012';
      ctx.lineWidth = 4;
      ctx.beginPath();
      // Top-left
      ctx.moveTo(x, y + len);
      ctx.lineTo(x, y);
      ctx.lineTo(x + len, y);
      // Top-right
      ctx.moveTo(x + w - len, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + len);
      // Bottom-left
      ctx.moveTo(x, y + h - len);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + len, y + h);
      // Bottom-right
      ctx.moveTo(x + w - len, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + h - len);
      ctx.stroke();
      ctx.restore();
    }

    // =========================================================================
    // 12-STAGE VISUAL MAP SCREEN (8 World 1 Nodes + 4 World 2 Bonus Nodes)
    // =========================================================================

    _drawMapScreen(ctx, engine) {
      const W = this.width;
      const H = this.height;
      const isPortrait = H > W;
      const nodeSize = Math.min(W / (isPortrait ? 5.6 : 10.2), H / (isPortrait ? 8.5 : 5.6), 78);

      // Draw World 1 track (8 stages: 2 rows of 4 in Portrait, 1 row of 8 in Landscape)
      // and World 2 Bonus track (4 stages below)
      const nodes = [];
      if (isPortrait) {
        const gapX = nodeSize * 1.48;
        const startX = W * 0.5 - 1.5 * gapX - nodeSize * 0.5;
        for (let i = 0; i < 4; i++) {
          nodes.push({ idx: i, x: startX + i * gapX, y: H * 0.22 });
        }
        for (let i = 4; i < 8; i++) {
          nodes.push({ idx: i, x: startX + (i - 4) * gapX, y: H * 0.44 });
        }
        for (let i = 8; i < 12; i++) {
          nodes.push({ idx: i, x: startX + (i - 8) * gapX, y: H * 0.68 });
        }
      } else {
        const gapX = nodeSize * 1.32;
        const startX1 = W * 0.5 - 3.5 * gapX - nodeSize * 0.5;
        for (let i = 0; i < 8; i++) {
          nodes.push({ idx: i, x: startX1 + i * gapX, y: H * 0.30 });
        }
        const startX2 = W * 0.5 - 1.5 * gapX - nodeSize * 0.5;
        for (let i = 8; i < 12; i++) {
          nodes.push({ idx: i, x: startX2 + (i - 8) * gapX, y: H * 0.62 });
        }
      }

      // Draw track connector lines
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 4;
      for (let i = 0; i < nodes.length - 1; i++) {
        if (i === 7) continue; // Separate World 1 and World 2 tracks
        if (isPortrait && i === 3) continue;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x + nodeSize * 0.5, nodes[i].y + nodeSize * 0.5);
        ctx.lineTo(nodes[i + 1].x + nodeSize * 0.5, nodes[i + 1].y + nodeSize * 0.5);
        ctx.stroke();
      }

      // Draw each stage node
      nodes.forEach((n) => {
        const st = engine.stages[n.idx];
        const prog = engine.progress[st.id] || { cleared: false, crowns: 0, medal: 0 };
        const isSelected = engine.stageIndex === n.idx;
        const isWorld2 = st.world === 2;

        // Pendant medal tab below node
        const pendantW = nodeSize * 0.86;
        const pendantH = nodeSize * 0.42;
        const pendantX = n.x + (nodeSize - pendantW) * 0.5;
        const pendantY = n.y + nodeSize - 2;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 2.5;
        this._roundRect(ctx, pendantX, pendantY, pendantW, pendantH, 5);
        ctx.fill();
        ctx.stroke();

        // Draw 3 medal chevron pips + crown indicator inside pendant
        for (let m = 0; m < 3; m++) {
          const mx = pendantX + pendantW * (0.24 + m * 0.26);
          const my = pendantY + pendantH * 0.54;
          this._drawMiniStar(ctx, mx, my, nodeSize * 0.09, m < prog.medal ? '#ffd426' : '#d8d8d8', '#111111');
        }

        // Node Square Frame
        ctx.fillStyle = isWorld2 ? '#fff4f7' : '#ffffff';
        ctx.strokeStyle = isSelected ? '#e60012' : '#111111';
        ctx.lineWidth = isSelected ? 4 : 3;
        this._roundRect(ctx, n.x, n.y, nodeSize, nodeSize, 8);
        ctx.fill();
        ctx.stroke();

        // Colored world strip at bottom of node
        ctx.fillStyle = isWorld2 ? '#ff8da1' : '#1cc800';
        ctx.fillRect(n.x + 3, n.y + nodeSize - 10, nodeSize - 6, 7);

        // Cleared Star OR Stage Mechanic Mini-Pictogram + Dot Pips
        if (prog.cleared) {
          this._drawMiniStar(ctx, n.x + nodeSize * 0.5, n.y + nodeSize * 0.42, nodeSize * 0.24, '#111111', '#111111');
        } else {
          // Draw boxLimit mini-squares in the center of the node
          const bl = st.boxLimit;
          const pipS = Math.min(9, (nodeSize * 0.65) / bl);
          const startPipX = n.x + (nodeSize - bl * (pipS + 2)) * 0.5;
          for (let b = 0; b < bl; b++) {
            ctx.fillStyle = '#7b7d80';
            ctx.fillRect(startPipX + b * (pipS + 2), n.y + nodeSize * 0.36, pipS, pipS);
          }
        }

        // Stage index dot-pips along top inside node (1..8 or 1..4 dots — zero numerals!)
        const dotCount = st.stage;
        const dotGap = Math.min(8, (nodeSize - 14) / Math.max(1, dotCount));
        const dotStartX = n.x + (nodeSize - (dotCount - 1) * dotGap) * 0.5;
        for (let d = 0; d < dotCount; d++) {
          ctx.fillStyle = isWorld2 ? '#c62828' : '#111111';
          ctx.beginPath();
          ctx.arc(dotStartX + d * dotGap, n.y + 9, 2.3, 0, Math.PI * 2);
          ctx.fill();
        }

        // If selected, draw Qbby/Qucy standing on top of this stage node!
        if (isSelected) {
          const heroToDraw = n.idx === 11 ? 'qucy' : engine.selectedHero;
          const heroS = nodeSize * 0.68;
          this._drawHeroScreen(
            ctx,
            n.x + (nodeSize - heroS) * 0.5,
            n.y - heroS - 4,
            heroS,
            heroToDraw,
            1,
            'normal',
            engine.time * 7,
            1,
            1
          );
          this._drawRedSelectionBrackets(ctx, n.x - 5, n.y - 5, nodeSize + 10, nodeSize + 10, 10);
        }

        this.regions['map' + n.idx] = { x: n.x, y: n.y, w: nodeSize, h: nodeSize };
        this.hitRegions.push({
          x: n.x - 4,
          y: n.y - 4,
          w: nodeSize + 8,
          h: nodeSize + pendantH + 8,
          action: () => {
            if (engine.audio) engine.audio.boxCreate(2);
            engine.loadStage(n.idx);
          }
        });
      });
    }

    // =========================================================================
    // IN-GAME STAGE RENDERING
    // =========================================================================

    _drawGameStage(ctx, engine) {
      const st = engine.stage;
      if (!st) return;

      const W = this.width;
      const H = this.height;
      const isPortrait = H > W;

      // Reserve bottom band for touch controls so gameplay never overlaps buttons
      const topSafe = 78;
      const bottomSafe = isPortrait ? 185 : 135;
      const availH = Math.max(220, H - topSafe - bottomSafe);
      this.tileSize = Math.max(24, Math.min(54, Math.floor(availH / st.height)));

      // Smoothly center camera horizontally around active hero, clamped to stage bounds
      const visibleCols = W / this.tileSize;
      const p = engine.player;
      const focusX = p ? p.x + 2.5 : st.width * 0.5;
      if (st.width <= visibleCols - 1) {
        this.cameraX = -(visibleCols - st.width) * 0.5;
      } else {
        const targetCamX = Math.max(-0.8, Math.min(st.width - visibleCols + 0.8, focusX - visibleCols * 0.38));
        this.cameraX = targetCamX;
      }

      this.viewOriginX = 0;
      this.viewOriginY = topSafe + Math.max(0, (availH - st.height * this.tileSize) * 0.5);

      const T = this.tileSize;

      // 1. Draw Floating White Tutorial Thought-Bubbles (in background sky behind entities)
      (st.tutorials || []).forEach((tut) => {
        this._drawTutorialBubble(ctx, tut, st.height, engine.time);
      });

      // 2. Draw Pit Floor Shadows at y=0
      for (let gx = 0; gx < st.width; gx++) {
        if (!engine.isTerrainSolid(gx, 0)) {
          const r = this.gridCellToRect(gx, 0, st.height);
          const grad = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
          grad.addColorStop(0, 'rgba(0,0,0,0.0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.28)');
          ctx.fillStyle = grad;
          ctx.fillRect(r.x, r.y, r.w + 1, r.h * 1.4);
        }
      }

      // 3. Draw Terrain Tiles (Green Grid Grass & Grey Speckled Stone)
      for (let gy = 0; gy < st.height; gy++) {
        for (let gx = 0; gx < st.width; gx++) {
          const cell = st.tiles[gy][gx];
          if (!cell) continue;
          const r = this.gridCellToRect(gx, gy, st.height);
          if (r.x + r.w < -10 || r.x > W + 10) continue;

          const sameTop = gy + 1 < st.height && st.tiles[gy + 1][gx] && st.tiles[gy + 1][gx].type === cell.type;
          const sameBot = gy - 1 >= 0 && st.tiles[gy - 1][gx] && st.tiles[gy - 1][gx].type === cell.type;
          const sameLeft = gx - 1 >= 0 && st.tiles[gy][gx - 1] && st.tiles[gy][gx - 1].type === cell.type;
          const sameRight = gx + 1 < st.width && st.tiles[gy][gx + 1] && st.tiles[gy][gx + 1].type === cell.type;

          if (cell.type === 'grass') {
            this._drawGrassCellScreen(ctx, r.x, r.y, r.w, !sameTop, !sameBot, !sameLeft, !sameRight);
          } else if (cell.type === 'stone') {
            this._drawStoneCellScreen(ctx, r.x, r.y, r.w, gx, gy, !sameTop, !sameBot, !sameLeft, !sameRight);
          }
        }
      }

      // 4. Draw Dotted & Solid Phase Blocks (W1S8, W2S1, W2S3, W2S4)
      engine.phaseBlocks.forEach((pb) => {
        const r = this.gridCellToRect(pb.x, pb.y, st.height);
        this._drawPhaseBlock(ctx, r.x, r.y, r.w, pb.color, pb.solid);
      });

      // 5. Draw Recessed Blue & Red Wall Switches
      engine.switches.forEach((sw) => {
        const r = this.gridCellToRect(sw.x, sw.y, st.height);
        this._drawWallSwitch(ctx, r.x, r.y, r.w, sw.color, sw.active);
      });

      // 6. Draw Floor Spikes (W1S5, W2S2, W2S4)
      engine.spikes.forEach((sp) => {
        const r = this.gridCellToRect(sp.x, sp.y, st.height);
        this._drawSpikeCell(ctx, r.x, r.y, r.w);
      });

      // 7. Draw Vertical Yellow Lasers (W1S6, W2S1, W2S3, W2S4)
      engine.lasers.forEach((ls) => {
        this._drawLaser(ctx, ls, st.height, engine.time);
      });

      // 8. Draw Double-Leaf White Goal Door
      if (st.goalDoor) {
        const r = this.gridCellToRect(st.goalDoor.x, st.goalDoor.y, st.height);
        this._drawGoalDoor(ctx, r.x, r.y, T, engine.doorOpenProgress);
      }

      // 9. Draw Collectible Crowns
      engine.crowns.forEach((cr) => {
        if (!cr.collected) {
          const pos = this.worldToScreen(cr.x + 0.5, cr.y + 0.5, st.height);
          const bob = Math.sin(engine.time * 3.5 + cr.bobPhase) * 3.5;
          this._drawCrownIcon(ctx, pos.x, pos.y + bob, T * 0.42, '#111111', '#ffffff');
          if (Math.sin(engine.time * 5 + cr.id) > 0.3) {
            this._drawSparkle(ctx, pos.x + T * 0.28, pos.y - T * 0.28 + bob, 3.5, '#ffffff');
          }
        }
      });

      // 10. Draw Motion-Blur Ghost Trails for Shot Boxes
      engine.ghostTrails.forEach((gt) => {
        const r = this.gridCellToRect(gt.x, gt.y, st.height);
        ctx.fillStyle = `rgba(123, 125, 128, ${Math.max(0, gt.alpha)})`;
        ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      });

      // 11. Draw Placed Box Chains & Active Extruded Box Chains for all Heroes
      const heroKeys = Object.keys(engine.heroes);
      heroKeys.forEach((k) => {
        const h = engine.heroes[k];
        // Placed boxes (dark slate grey #7b7d80)
        h.placedChain.forEach((b) => {
          const r = this.gridCellToRect(b.x, b.y, st.height);
          this._drawBoxCell(ctx, r.x, r.y, r.w, false, 0, false);
        });
      });

      // 12. Draw Heroes (Partner first, then Active Hero on top)
      heroKeys.forEach((k) => {
        if (k !== engine.activeChar) {
          this._drawHeroWorld(ctx, engine.heroes[k], st.height, false, engine.time);
        }
      });
      if (engine.player) {
        this._drawHeroWorld(ctx, engine.player, st.height, heroKeys.length > 1, engine.time);
      }

      // 13. Draw Active Held/Extruded Chain + Red Directional Preview Arrows + Mode A Action Bubbles
      if (engine.player && (engine.player.activeChain.length > 0 || engine.drawMode)) {
        const act = engine.player.activeChain;
        act.forEach((b, idx) => {
          const r = this.gridCellToRect(b.x, b.y, st.height);
          const isTip = idx === act.length - 1;
          this._drawBoxCell(ctx, r.x, r.y, r.w, true, idx + 1, isTip);
        });

        // Draw red directional preview arrowheads around chain tip (or player if chain empty)
        if (act.length < st.boxLimit && engine.player.chainState !== 'retracting') {
          const tip = act.length > 0 ? act[act.length - 1] : { x: Math.round(engine.player.x), y: Math.round(engine.player.y) };
          const tr = this.gridCellToRect(tip.x, tip.y, st.height);
          this._drawDirectionalPreviewArrows(ctx, tr.x, tr.y, tr.w, engine, tip);
        }

        // Draw floating one-tap Mode A action bubbles near the active chain when chain has >= 1 box.
        // Hidden while the Guide Coach is on so exactly one highlighted control is ever suggested.
        const coach = window.BoxBoyCoach;
        const coachOn = Boolean(coach && coach.enabled);
        if (act.length > 0 && engine.player.chainState !== 'retracting' && !coachOn) {
          this._drawFloatingChainActionBubbles(ctx, engine, act[act.length - 1], st.height);
        }
      }

      // 13b. Guide Coach target preview (walk pad, jump arc, ghost boxes, hook/slide paths)
      if (engine.screen === 'game') {
        this._drawCoachOverlay(ctx, engine);
      }

      // 14. Draw Puff & Sparkle Particles
      engine.particles.forEach((pt) => {
        const pos = this.worldToScreen(pt.x, pt.y, st.height);
        const s = pt.size * T * (pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 1.5;
        ctx.fillRect(pos.x - s * 0.5, pos.y - s * 0.5, s, s);
        ctx.strokeRect(pos.x - s * 0.5, pos.y - s * 0.5, s, s);
      });
    }

    // =========================================================================
    // TERRAIN, HAZARDS, LASERS, SWITCHES, DOORS & CROWNS
    // =========================================================================

    _drawGrassCellScreen(ctx, x, y, s, topEdge, botEdge, leftEdge, rightEdge) {
      ctx.fillStyle = '#1cc800';
      ctx.fillRect(x, y, s + 0.8, s + 0.8);

      // Inner lighter-green rounded grid inset (matches sheet_p1-p8!)
      const m = Math.max(3, s * 0.13);
      ctx.fillStyle = '#32df14';
      this._roundRect(ctx, x + m, y + m, s - m * 2, s - m * 2, Math.max(2, s * 0.12));
      ctx.fill();

      // Subtle grid seam
      ctx.strokeStyle = 'rgba(10, 90, 0, 0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);

      // Crisp dark outer contour on exposed air edges
      ctx.strokeStyle = '#0c5200';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      if (topEdge) {
        ctx.moveTo(x, y + 1);
        ctx.lineTo(x + s, y + 1);
      }
      if (botEdge) {
        ctx.moveTo(x, y + s - 1);
        ctx.lineTo(x + s, y + s - 1);
      }
      if (leftEdge) {
        ctx.moveTo(x + 1, y);
        ctx.lineTo(x + 1, y + s);
      }
      if (rightEdge) {
        ctx.moveTo(x + s - 1, y);
        ctx.lineTo(x + s - 1, y + s);
      }
      ctx.stroke();
    }

    _drawStoneCellScreen(ctx, x, y, s, gx, gy, topEdge, botEdge, leftEdge, rightEdge) {
      // Unified granite grey fill (#a6a6a6) with speckles and exposed perimeter border (sheet_p7.jpg)
      ctx.fillStyle = '#a6a6a6';
      ctx.fillRect(x, y, s + 0.9, s + 0.9);

      // Deterministic granite speckles
      const seed = (gx * 73 + gy * 37) % 17;
      ctx.fillStyle = '#dcdcdc';
      ctx.fillRect(x + ((seed * 5) % Math.max(4, s - 6)) + 2, y + ((seed * 11) % Math.max(4, s - 6)) + 2, 2.5, 2.5);
      ctx.fillRect(x + ((seed * 13 + 7) % Math.max(4, s - 6)) + 2, y + ((seed * 3 + 9) % Math.max(4, s - 6)) + 2, 2, 2);
      ctx.fillStyle = '#6e6e6e';
      ctx.fillRect(x + ((seed * 9 + 3) % Math.max(4, s - 6)) + 2, y + ((seed * 7 + 5) % Math.max(4, s - 6)) + 2, 2.5, 2.5);

      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (topEdge) {
        ctx.moveTo(x, y + 1);
        ctx.lineTo(x + s, y + 1);
      }
      if (botEdge) {
        ctx.moveTo(x, y + s - 1);
        ctx.lineTo(x + s, y + s - 1);
      }
      if (leftEdge) {
        ctx.moveTo(x + 1, y);
        ctx.lineTo(x + 1, y + s);
      }
      if (rightEdge) {
        ctx.moveTo(x + s - 1, y);
        ctx.lineTo(x + s - 1, y + s);
      }
      ctx.stroke();
    }

    _drawSpikeCell(ctx, x, y, s) {
      const teeth = 4;
      const tw = s / teeth;
      const spikeH = s * 0.72;
      const baseY = y + s;
      for (let i = 0; i < teeth; i++) {
        const tx = x + i * tw;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx + 1, baseY);
        ctx.lineTo(tx + tw * 0.5, baseY - spikeH);
        ctx.lineTo(tx + tw - 1, baseY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    _drawLaser(ctx, ls, stageHeight, time) {
      // Draw emitter nozzle embedded at top of (ls.x, ls.y - 1)
      const baseRect = this.gridCellToRect(ls.x, ls.y - 1, stageHeight);
      ctx.fillStyle = '#333333';
      ctx.fillRect(baseRect.x + baseRect.w * 0.15, baseRect.y, baseRect.w * 0.7, 6);
      ctx.fillStyle = '#ffd426';
      ctx.fillRect(baseRect.x + baseRect.w * 0.28, baseRect.y, baseRect.w * 0.44, 3);

      // Draw each active vertical laser cell as a spiky yellow electric square (sheet_p6.jpg!)
      const jitter = Math.sin(time * 42) * 1.4;
      ls.activeCells.forEach((cell) => {
        const r = this.gridCellToRect(cell.x, cell.y, stageHeight);
        const cx = r.x + r.w * 0.5 + jitter * 0.5;
        const cy = r.y + r.h * 0.5;
        const rad = r.w * 0.46;

        // Spiky sawtooth outer burst
        ctx.fillStyle = '#ffd426';
        ctx.strokeStyle = '#ffab00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const points = 16;
        for (let i = 0; i < points * 2; i++) {
          const angle = (i * Math.PI) / points;
          const dist = i % 2 === 0 ? rad * 1.06 : rad * 0.76;
          const px = cx + Math.cos(angle) * dist;
          const py = cy + Math.sin(angle) * dist;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crisp white-yellow rectangular core
        const coreS = r.w * 0.48;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - coreS * 0.5, cy - coreS * 0.5, coreS, coreS);
      });
    }

    _drawPhaseBlock(ctx, x, y, s, color, solid) {
      const hex = color === 'red' ? '#ef5350' : '#29b6f6';
      if (solid) {
        ctx.fillStyle = '#181818';
        ctx.fillRect(x, y, s, s);
        ctx.strokeStyle = hex;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 4, y + 4, s - 8, s - 8);
        ctx.fillStyle = hex;
        ctx.fillRect(x + s * 0.38, y + s * 0.38, s * 0.24, s * 0.24);
      } else {
        // Dotted outline phase block with center colored square (sheet_p8.jpg)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
        ctx.save();
        ctx.strokeStyle = hex;
        ctx.lineWidth = 2.2;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
        ctx.restore();
        ctx.fillStyle = hex;
        ctx.fillRect(x + s * 0.38, y + s * 0.38, s * 0.24, s * 0.24);
      }
    }

    _drawWallSwitch(ctx, x, y, s, color, active) {
      const fill = color === 'red' ? '#ef5350' : '#29b6f6';
      const dark = color === 'red' ? '#b71c1c' : '#0277bd';
      const swW = active ? s * 0.12 : s * 0.28;
      const swH = s * 0.76;
      const swX = x - swW + 2;
      const swY = y + (s - swH) * 0.5;

      ctx.fillStyle = fill;
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2.2;
      this._roundRect(ctx, swX, swY, swW, swH, 4);
      ctx.fill();
      ctx.stroke();
    }

    _drawGoalDoor(ctx, x, y, s, openProgress) {
      const doorW = s * 1.5;
      const doorH = s * 1.75;
      const dx = x - (doorW - s) * 0.5;
      const dy = y + s - doorH;

      // Dark grey interior
      ctx.fillStyle = '#7b7d80';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.5;
      ctx.fillRect(dx, dy, doorW, doorH);
      ctx.strokeRect(dx, dy, doorW, doorH);

      const leafW = doorW * 0.5 * (1 - openProgress * 0.65);
      ctx.fillStyle = '#ffffff';
      // Left door leaf
      ctx.fillRect(dx, dy, leafW, doorH);
      ctx.strokeRect(dx, dy, leafW, doorH);
      // Right door leaf
      ctx.fillRect(dx + doorW - leafW, dy, leafW, doorH);
      ctx.strokeRect(dx + doorW - leafW, dy, leafW, doorH);

      // Door handles
      if (openProgress < 0.8) {
        ctx.fillStyle = '#111111';
        ctx.fillRect(dx + leafW - 6, dy + doorH * 0.45, 2.5, doorH * 0.16);
        ctx.fillRect(dx + doorW - leafW + 3.5, dy + doorH * 0.45, 2.5, doorH * 0.16);
      }
    }

    _drawCrownIcon(ctx, cx, cy, r, fill = '#111111', gemFill = '#ffffff') {
      ctx.save();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.85, cy + r * 0.55);
      ctx.lineTo(cx - r * 0.95, cy - r * 0.25);
      ctx.lineTo(cx - r * 0.42, cy + r * 0.12);
      ctx.lineTo(cx, cy - r * 0.45);
      ctx.lineTo(cx + r * 0.42, cy + r * 0.12);
      ctx.lineTo(cx + r * 0.95, cy - r * 0.25);
      ctx.lineTo(cx + r * 0.85, cy + r * 0.55);
      ctx.closePath();
      ctx.fill();

      // 3 floating diamond prong tips above crown (signature BoxBoy! crown style)
      const tips = [
        { x: cx - r * 0.95, y: cy - r * 0.52 },
        { x: cx, y: cy - r * 0.72 },
        { x: cx + r * 0.95, y: cy - r * 0.52 }
      ];
      tips.forEach((t) => {
        ctx.beginPath();
        ctx.moveTo(t.x, t.y - r * 0.14);
        ctx.lineTo(t.x + r * 0.14, t.y);
        ctx.lineTo(t.x, t.y + r * 0.14);
        ctx.lineTo(t.x - r * 0.14, t.y);
        ctx.closePath();
        ctx.fill();
      });

      // Center white diamond gem
      ctx.fillStyle = gemFill;
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.02);
      ctx.lineTo(cx + r * 0.16, cy + r * 0.24);
      ctx.lineTo(cx, cy + r * 0.44);
      ctx.lineTo(cx - r * 0.16, cy + r * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // =========================================================================
    // HERO RENDERING (QBBY & QUCY WITH PINK RIBBON BOW + EXPRESSIVE EYES)
    // =========================================================================

    _drawHeroWorld(ctx, h, stageHeight, showActivePointer, time) {
      const r = this.gridCellToRect(h.x, h.y, stageHeight);
      this._drawHeroScreen(ctx, r.x, r.y, r.w, h.hero, h.facing, h.eyeState, h.walkPhase, h.scaleX, h.scaleY);

      if (showActivePointer) {
        // Bouncing red indicator triangle above currently active co-op hero
        const cx = r.x + r.w * 0.5;
        const py = r.y - 14 + Math.sin(time * 6) * 3;
        ctx.fillStyle = '#e60012';
        ctx.beginPath();
        ctx.moveTo(cx - 6, py - 7);
        ctx.lineTo(cx + 6, py - 7);
        ctx.lineTo(cx, py);
        ctx.closePath();
        ctx.fill();
      }
    }

    _drawHeroScreen(ctx, x, y, s, heroType, facing, eyeState, walkPhase, scaleX = 1, scaleY = 1) {
      ctx.save();
      const legH = s * 0.18;
      const bodyS = s * 0.82;
      const baseX = x + s * 0.5;
      const baseY = y + s;

      // Apply squash and stretch anchored at feet
      ctx.translate(baseX, baseY - legH);
      ctx.scale(scaleX, scaleY);

      // Stick legs with 60fps walk swing
      const swing = Math.sin(walkPhase || 0) * (s * 0.08);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      // Left leg
      ctx.moveTo(-bodyS * 0.24, 0);
      ctx.lineTo(-bodyS * 0.24 + swing, legH);
      ctx.lineTo(-bodyS * 0.24 + swing + (facing >= 0 ? 4 : -4), legH);
      // Right leg
      ctx.moveTo(bodyS * 0.24, 0);
      ctx.lineTo(bodyS * 0.24 - swing, legH);
      ctx.lineTo(bodyS * 0.24 - swing + (facing >= 0 ? 4 : -4), legH);
      ctx.stroke();

      // Crisp 1x1 White Square Body
      const bx = -bodyS * 0.5;
      const by = -bodyS;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.6;
      ctx.fillRect(bx, by, bodyS, bodyS);
      ctx.strokeRect(bx, by, bodyS, bodyS);

      // Expressive Eyes shifted slightly toward facing direction
      const eyeOffsetX = (facing || 1) * bodyS * 0.09;
      const leftEyeX = -bodyS * 0.18 + eyeOffsetX;
      const rightEyeX = bodyS * 0.18 + eyeOffsetX;
      const eyeY = by + bodyS * 0.44;

      ctx.fillStyle = '#111111';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.2;

      if (eyeState === 'creating') {
        // Focused squinting >< eyes (sheet_p1, p6, p7, p8!)
        const eSize = bodyS * 0.09;
        ctx.beginPath();
        ctx.moveTo(leftEyeX - eSize, eyeY - eSize);
        ctx.lineTo(leftEyeX + eSize, eyeY);
        ctx.lineTo(leftEyeX - eSize, eyeY + eSize);
        ctx.moveTo(rightEyeX + eSize, eyeY - eSize);
        ctx.lineTo(rightEyeX - eSize, eyeY);
        ctx.lineTo(rightEyeX + eSize, eyeY + eSize);
        ctx.stroke();
      } else if (eyeState === 'hurt') {
        // Surprised wide circle eyes O O
        const rad = bodyS * 0.09;
        ctx.beginPath();
        ctx.arc(leftEyeX, eyeY, rad, 0, Math.PI * 2);
        ctx.arc(rightEyeX, eyeY, rad, 0, Math.PI * 2);
        ctx.stroke();
      } else if (eyeState === 'clear') {
        // Happy upward arc eyes ^ ^
        const rad = bodyS * 0.09;
        ctx.beginPath();
        ctx.arc(leftEyeX, eyeY + 2, rad, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(rightEyeX, eyeY + 2, rad, Math.PI, 0);
        ctx.stroke();
      } else {
        // Normal crisp square dot eyes
        const dot = Math.max(3, bodyS * 0.1);
        ctx.fillRect(leftEyeX - dot * 0.5, eyeY - dot * 0.5, dot, dot);
        ctx.fillRect(rightEyeX - dot * 0.5, eyeY - dot * 0.5, dot, dot);
      }

      // Qucy (Box Girl): Signature Tilted Pink/Coral Ribbon Bow on Top Corner (sheet_p1 & sheet_p9!)
      if (heroType === 'qucy') {
        this._drawQucyBow(ctx, bx + bodyS * 0.12, by - bodyS * 0.04, bodyS * 0.42);
      }

      ctx.restore();
    }

    _drawQucyBow(ctx, x, y, size) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.32);
      ctx.fillStyle = '#ff8da1';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.0;

      // Left loop
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-size * 0.65, -size * 0.45, -size * 0.58, size * 0.12);
      ctx.quadraticCurveTo(-size * 0.52, size * 0.45, 0, 0);
      ctx.fill();
      ctx.stroke();

      // Right loop
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(size * 0.65, -size * 0.45, size * 0.58, size * 0.12);
      ctx.quadraticCurveTo(size * 0.52, size * 0.45, 0, 0);
      ctx.fill();
      ctx.stroke();

      // Center knot
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // =========================================================================
    // BOX CELLS, DIRECTIONAL PREVIEW ARROWS & FLOATING MODE A ACTION BUBBLES
    // =========================================================================

    _drawBoxCell(ctx, x, y, s, isHeld, segmentNum, isTip) {
      const pad = 1.5;
      const bw = s - pad * 2;
      ctx.fillStyle = isHeld ? '#ffffff' : '#7b7d80';
      ctx.strokeStyle = isTip ? '#e60012' : '#111111';
      ctx.lineWidth = 2.5;
      ctx.fillRect(x + pad, y + pad, bw, bw);
      ctx.strokeRect(x + pad, y + pad, bw, bw);

      if (!isHeld) {
        // Subtle inner bevel on placed grey boxes
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + pad + 3, y + pad + 3, bw - 6, bw - 6);
      } else if (segmentNum > 0) {
        // Graphical mini-pip dots inside held box (replaces digits 1..5 for 100% Zero-Text UI!)
        const count = Math.min(5, segmentNum);
        const dotR = Math.max(2, s * 0.065);
        ctx.fillStyle = '#111111';
        const positions = {
          1: [[0.5, 0.5]],
          2: [[0.35, 0.5], [0.65, 0.5]],
          3: [[0.32, 0.62], [0.5, 0.36], [0.68, 0.62]],
          4: [[0.34, 0.34], [0.66, 0.34], [0.34, 0.66], [0.66, 0.66]],
          5: [[0.32, 0.32], [0.68, 0.32], [0.5, 0.5], [0.32, 0.68], [0.68, 0.68]]
        }[count];
        positions.forEach((p) => {
          ctx.beginPath();
          ctx.arc(x + s * p[0], y + s * p[1], dotR, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    _drawDirectionalPreviewArrows(ctx, x, y, s, engine, tip) {
      const dirs = [
        { dir: 'up', dx: 0, dy: 1, ax: x + s * 0.5, ay: y - 7, rot: 0 },
        { dir: 'down', dx: 0, dy: -1, ax: x + s * 0.5, ay: y + s + 7, rot: Math.PI },
        { dir: 'left', dx: -1, dy: 0, ax: x - 7, ay: y + s * 0.5, rot: -Math.PI * 0.5 },
        { dir: 'right', dx: 1, dy: 0, ax: x + s + 7, ay: y + s * 0.5, rot: Math.PI * 0.5 }
      ];
      dirs.forEach((d) => {
        const nx = tip.x + d.dx;
        const ny = tip.y + d.dy;
        if (engine.isTerrainSolid(nx, ny)) return;
        ctx.save();
        ctx.translate(d.ax, d.ay);
        ctx.rotate(d.rot);
        ctx.fillStyle = '#e60012';
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(6, 4);
        ctx.lineTo(-6, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    }

    _drawFloatingChainActionBubbles(ctx, engine, tip, stageHeight) {
      const tr = this.gridCellToRect(tip.x, tip.y, stageHeight);
      const bubbleR = 20;
      const baseY = Math.max(85, tr.y - 36);
      const centerX = Math.max(90, Math.min(this.width - 90, tr.x + tr.w * 0.5));

      const bubbles = [
        { dx: -78, color: '#1cc800', icon: 'place', act: () => engine.injectAction({ type: 'place' }) },
        { dx: -26, color: '#29b6f6', icon: 'shoot', act: () => engine.injectAction({ type: 'shoot' }) },
        { dx: 26, color: '#ffab00', icon: 'hook', act: () => engine.injectAction({ type: 'hook' }) },
        { dx: 78, color: '#ef5350', icon: 'erase', act: () => engine.injectAction({ type: 'erase' }) }
      ].filter((b) => b.icon === 'place' || b.icon === 'erase' || engine.isMechanicUnlocked(b.icon));

      bubbles.forEach((b) => {
        const bx = centerX + b.dx;
        const by = baseY;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(bx, by, bubbleR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#111111';
        ctx.fillStyle = '#111111';
        ctx.lineWidth = 2.4;
        if (b.icon === 'place') {
          // Down arrow onto floor bar
          ctx.beginPath();
          ctx.moveTo(bx, by - 8);
          ctx.lineTo(bx, by + 4);
          ctx.moveTo(bx - 5, by - 1);
          ctx.lineTo(bx, by + 5);
          ctx.lineTo(bx + 5, by - 1);
          ctx.moveTo(bx - 7, by + 8);
          ctx.lineTo(bx + 7, by + 8);
          ctx.stroke();
        } else if (b.icon === 'shoot') {
          // Double forward chevrons ⇉
          ctx.beginPath();
          ctx.moveTo(bx - 6, by - 6);
          ctx.lineTo(bx, by);
          ctx.lineTo(bx - 6, by + 6);
          ctx.moveTo(bx + 1, by - 6);
          ctx.lineTo(bx + 7, by);
          ctx.lineTo(bx + 1, by + 6);
          ctx.stroke();
        } else if (b.icon === 'hook') {
          // Up-and-over hook arrow ↰
          ctx.beginPath();
          ctx.moveTo(bx - 5, by + 7);
          ctx.lineTo(bx - 5, by - 5);
          ctx.lineTo(bx + 6, by - 5);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(bx + 3, by - 9);
          ctx.lineTo(bx + 8, by - 5);
          ctx.lineTo(bx + 3, by - 1);
          ctx.closePath();
          ctx.fill();
        } else if (b.icon === 'erase') {
          // Crisp X
          ctx.beginPath();
          ctx.moveTo(bx - 6, by - 6);
          ctx.lineTo(bx + 6, by + 6);
          ctx.moveTo(bx + 6, by - 6);
          ctx.lineTo(bx - 6, by + 6);
          ctx.stroke();
        }

        this.hitRegions.push({
          x: bx - bubbleR,
          y: by - bubbleR,
          w: bubbleR * 2,
          h: bubbleR * 2,
          action: b.act
        });
      });
    }

    // =========================================================================
    // GUIDE COACH OVERLAYS (100% graphical: golden pads, arcs, ghost boxes, rings)
    // =========================================================================

    _coachHint(engine) {
      const coach = window.BoxBoyCoach;
      if (!coach || !coach.enabled || !engine) return null;
      return coach.hint || null;
    }

    _drawCoachRegionGlow(ctx, engine) {
      const hint = this._coachHint(engine);
      if (!hint || !hint.region) return;
      const r = this.regions[hint.region];
      if (!r) return;
      const grow = 5 + Math.sin(engine.time * 6) * 3;
      ctx.save();
      ctx.shadowColor = 'rgba(255, 196, 0, 0.95)';
      ctx.shadowBlur = 22;
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#ffd426';
      this._roundRect(ctx, r.x - grow, r.y - grow, r.w + grow * 2, r.h + grow * 2, 16);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#111111';
      this._roundRect(ctx, r.x - grow - 4, r.y - grow - 4, r.w + grow * 2 + 8, r.h + grow * 2 + 8, 19);
      ctx.stroke();
      ctx.restore();
    }

    _drawCoachOverlay(ctx, engine) {
      const hint = this._coachHint(engine);
      if (!hint || !hint.overlay || !engine.stage) return;
      const ov = hint.overlay;
      const H = engine.stage.height;
      const t = engine.time;
      const p = engine.player;

      ctx.save();
      switch (ov.type) {
        case 'walk': {
          if (p) this._coachDots(ctx, p.x + 0.5, p.y + 0.1, ov.x + 0.5, ov.y + 0.1, H, t);
          this._coachPad(ctx, ov.x + 0.5, ov.y, H, t);
          break;
        }
        case 'jump': {
          if (Math.abs(ov.to.x - ov.from.x) < 0.2) {
            this._coachUpArrow(ctx, ov.from.x + 0.5, ov.from.y + 1.25, H, t);
          } else {
            this._coachArc(ctx, ov.from.x + 0.5, ov.from.y + 1.0, ov.to.x + 0.5, ov.to.y + 0.12, H, t);
            this._coachPad(ctx, ov.to.x + 0.5, ov.to.y, H, t, false);
          }
          break;
        }
        case 'boxes': {
          const firstGhost = ov.next >= 0 ? ov.next : 0;
          this._coachGhostCells(ctx, ov.cells.slice(firstGhost), ov.next >= 0 ? 0 : -1, H, t);
          if (ov.next >= 0 && ov.cells[ov.next]) {
            const from = ov.next === 0 ? ov.origin : ov.cells[ov.next - 1];
            const to = ov.cells[ov.next];
            if (from) this._coachArrow(ctx, from.x + 0.5, from.y + 0.5, to.x + 0.5, to.y + 0.5, H, t);
          }
          break;
        }
        case 'drop': {
          this._coachGhostCells(ctx, ov.cells, -1, H, t);
          if (p && p.activeChain.length > 0) {
            const a = this._cellsCenter(p.activeChain);
            const b = this._cellsCenter(ov.cells);
            if (a && b && a.y - b.y > 0.5) this._coachArrow(ctx, a.x, a.y, b.x, b.y, H, t);
            else if (b) this._coachDownArrow(ctx, b.x, b.y + 0.95, H, t);
          }
          break;
        }
        case 'throw': {
          const b = this._cellsCenter(ov.cells);
          if (p && b) this._coachArc(ctx, p.x + 0.5, p.y + 1.5, b.x, b.y, H, t);
          this._coachGhostCells(ctx, ov.cells, -1, H, t);
          break;
        }
        case 'hook': {
          if (p && ov.path && ov.path.length) {
            const pts = [{ x: p.x + 0.5, y: p.y + 0.5 }].concat(ov.path.map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 })));
            // Trim the path at the planned landing cell (the hook anchor).
            let cut = pts.length;
            for (let i = 1; i < pts.length; i++) {
              if (Math.abs(pts[i].x - (ov.to.x + 0.5)) < 0.55 && Math.abs(pts[i].y - (ov.to.y + 0.5)) < 0.55) {
                cut = i + 1;
                break;
              }
            }
            const path = pts.slice(0, cut);
            this._coachPath(ctx, path, H, t);
            const anchor = path[path.length - 1];
            this._coachRing(ctx, anchor.x, anchor.y, H, t, 0.62);
          }
          break;
        }
        case 'shoot': {
          const a = this._cellsCenter(ov.from);
          const b = this._cellsCenter(ov.cells);
          if (a && b) this._coachArrow(ctx, a.x, a.y, b.x, b.y, H, t);
          this._coachGhostCells(ctx, ov.cells, -1, H, t);
          (ov.switches || []).forEach((sw) => this._coachRing(ctx, sw.x + 0.5, sw.y + 0.5, H, t, 0.6));
          break;
        }
        case 'hero': {
          const h = engine.heroes[ov.hero];
          if (h) {
            this._coachRing(ctx, h.x + 0.5, h.y + 0.5, H, t, 0.78);
            this._coachDownArrow(ctx, h.x + 0.5, h.y + 1.45, H, t);
          }
          break;
        }
        case 'door': {
          this._coachRing(ctx, ov.x + 0.5, ov.y + 0.5, H, t, 0.9);
          this._coachDownArrow(ctx, ov.x + 0.5, ov.y + 1.55, H, t);
          break;
        }
        default:
          break;
      }
      ctx.restore();
    }

    _cellsCenter(cells) {
      if (!cells || cells.length === 0) return null;
      let sx = 0;
      let sy = 0;
      cells.forEach((c) => {
        sx += Math.round(c.x) + 0.5;
        sy += Math.round(c.y) + 0.5;
      });
      return { x: sx / cells.length, y: sy / cells.length };
    }

    _coachStrokeGold(ctx, drawPath, width) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = width + 3.5;
      drawPath();
      ctx.stroke();
      ctx.strokeStyle = '#ffd426';
      ctx.lineWidth = width;
      drawPath();
      ctx.stroke();
    }

    _coachHead(ctx, x, y, angle, size) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = '#ffd426';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(size * 0.55, 0);
      ctx.lineTo(-size * 0.45, -size * 0.55);
      ctx.lineTo(-size * 0.45, size * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    _coachPad(ctx, wx, wy, H, t, withArrow = true) {
      const T = this.tileSize;
      const c = this.worldToScreen(wx, wy, H);
      const pulse = 0.88 + Math.sin(t * 6) * 0.12;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 212, 38, 0.6)';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y - 2, T * 0.5 * pulse, T * 0.17 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (withArrow) this._coachDownArrow(ctx, wx, wy + 1.4, H, t);
    }

    _coachDownArrow(ctx, wx, wyTip, H, t) {
      const T = this.tileSize;
      const c = this.worldToScreen(wx, wyTip, H);
      const tipY = c.y - Math.abs(Math.sin(t * 4.2)) * T * 0.3;
      const w = T * 0.4;
      const head = T * 0.36;
      const stemW = T * 0.16;
      const stemH = T * 0.34;
      ctx.save();
      ctx.fillStyle = '#ffd426';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x, tipY);
      ctx.lineTo(c.x + w, tipY - head);
      ctx.lineTo(c.x + stemW, tipY - head);
      ctx.lineTo(c.x + stemW, tipY - head - stemH);
      ctx.lineTo(c.x - stemW, tipY - head - stemH);
      ctx.lineTo(c.x - stemW, tipY - head);
      ctx.lineTo(c.x - w, tipY - head);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    _coachUpArrow(ctx, wx, wyBase, H, t) {
      const T = this.tileSize;
      const c = this.worldToScreen(wx, wyBase, H);
      const baseY = c.y - Math.abs(Math.sin(t * 4.2)) * T * 0.3;
      const w = T * 0.4;
      const head = T * 0.36;
      const stemW = T * 0.16;
      const stemH = T * 0.5;
      ctx.save();
      ctx.fillStyle = '#ffd426';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x - stemW, baseY);
      ctx.lineTo(c.x - stemW, baseY - stemH);
      ctx.lineTo(c.x - w, baseY - stemH);
      ctx.lineTo(c.x, baseY - stemH - head);
      ctx.lineTo(c.x + w, baseY - stemH);
      ctx.lineTo(c.x + stemW, baseY - stemH);
      ctx.lineTo(c.x + stemW, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    _coachDots(ctx, x0, y0, x1, y1, H, t) {
      const T = this.tileSize;
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.floor(dist / 0.5);
      if (n < 2) return;
      ctx.save();
      for (let i = 1; i < n; i++) {
        const f = i / n;
        const c = this.worldToScreen(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, H);
        const a = 0.35 + 0.65 * ((Math.sin(i * 0.9 - t * 7) + 1) * 0.5);
        ctx.fillStyle = `rgba(255, 196, 0, ${a.toFixed(3)})`;
        ctx.strokeStyle = 'rgba(17, 17, 17, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y - 4, T * 0.09, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    _coachArc(ctx, x0, y0, x1, y1, H, t) {
      const T = this.tileSize;
      const peak = Math.max(y0, y1) + 1.3;
      const cwx = (x0 + x1) * 0.5;
      const cwy = 2 * peak - (y0 + y1) * 0.5;
      const a = this.worldToScreen(x0, y0, H);
      const b = this.worldToScreen(x1, y1, H);
      const c = this.worldToScreen(cwx, cwy, H);
      ctx.save();
      ctx.setLineDash([T * 0.24, T * 0.16]);
      ctx.lineDashOffset = -t * T * 1.4;
      this._coachStrokeGold(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
      }, 4);
      ctx.setLineDash([]);
      this._coachHead(ctx, b.x, b.y, Math.atan2(b.y - c.y, b.x - c.x), T * 0.42);
      ctx.restore();
    }

    _coachArrow(ctx, x0, y0, x1, y1, H, t) {
      const T = this.tileSize;
      const a = this.worldToScreen(x0, y0, H);
      const b = this.worldToScreen(x1, y1, H);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 4) return;
      const nudge = (Math.sin(t * 7) + 1) * 0.5 * T * 0.12;
      const sx = a.x + Math.cos(ang) * (T * 0.28 + nudge);
      const sy = a.y + Math.sin(ang) * (T * 0.28 + nudge);
      const ex = b.x - Math.cos(ang) * (T * 0.18 - nudge);
      const ey = b.y - Math.sin(ang) * (T * 0.18 - nudge);
      ctx.save();
      this._coachStrokeGold(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
      }, 5);
      this._coachHead(ctx, ex, ey, ang, T * 0.46);
      ctx.restore();
    }

    _coachPath(ctx, pts, H, t) {
      if (!pts || pts.length < 2) return;
      const T = this.tileSize;
      const sp = pts.map((pt) => this.worldToScreen(pt.x, pt.y, H));
      ctx.save();
      ctx.setLineDash([T * 0.22, T * 0.14]);
      ctx.lineDashOffset = -t * T * 1.6;
      this._coachStrokeGold(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(sp[0].x, sp[0].y);
        for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i].x, sp[i].y);
      }, 4);
      ctx.setLineDash([]);
      const last = sp[sp.length - 1];
      const prev = sp[sp.length - 2];
      this._coachHead(ctx, last.x, last.y, Math.atan2(last.y - prev.y, last.x - prev.x), T * 0.42);
      ctx.restore();
    }

    _coachRing(ctx, wx, wy, H, t, scale) {
      const T = this.tileSize;
      const c = this.worldToScreen(wx, wy, H);
      const r = T * (scale || 0.7) * (1 + Math.sin(t * 6) * 0.08);
      ctx.save();
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#111111';
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffd426';
      ctx.stroke();
      ctx.restore();
    }

    _coachGhostCells(ctx, cells, emphasizeIdx, H, t) {
      if (!cells || cells.length === 0) return;
      ctx.save();
      cells.forEach((cell, i) => {
        const r = this.gridCellToRect(cell.x, cell.y, H);
        const isNext = i === emphasizeIdx;
        const pad = 3;
        let x = r.x + pad;
        let y = r.y + pad;
        let s = r.w - pad * 2;
        if (isNext) {
          const grow = Math.sin(t * 7) * 2.2;
          x -= grow;
          y -= grow;
          s += grow * 2;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        } else {
          ctx.fillStyle = 'rgba(255, 240, 160, 0.42)';
        }
        ctx.fillRect(x, y, s, s);
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -t * 14;
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = isNext ? 5.5 : 4.5;
        ctx.strokeRect(x, y, s, s);
        ctx.strokeStyle = '#ffd426';
        ctx.lineWidth = isNext ? 3.2 : 2.4;
        ctx.strokeRect(x, y, s, s);
        ctx.setLineDash([]);
      });
      ctx.restore();
    }

    // =========================================================================
    // FLOATING WHITE TUTORIAL THOUGHT-BUBBLES (100% Graphical Pictograms)
    // =========================================================================

    _drawTutorialBubble(ctx, tut, stageHeight, time) {
      const pos = this.worldToScreen(tut.x, tut.y, stageHeight);
      const T = this.tileSize;
      const bw = T * 3.1;
      const bh = T * 2.4;
      const bx = pos.x - bw * 0.5;
      const by = pos.y - bh * 0.5;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.5;
      this._roundRect(ctx, bx, by, bw, bh, 6);
      ctx.fill();
      ctx.stroke();

      // Floor line inside tutorial frame
      const floorY = by + bh * 0.72;
      ctx.beginPath();
      ctx.moveTo(bx + 10, floorY);
      ctx.lineTo(bx + bw - 10, floorY);
      ctx.stroke();

      const ms = T * 0.52;
      const phase = (time * 1.2) % 2.0;

      // Mini Qbby inside the tutorial frame
      this._drawHeroScreen(ctx, bx + bw * 0.2, floorY - ms, ms, 'qbby', 1, 'creating', 0, 1, 1);

      if (tut.kind === 'step1' || tut.kind === 'throw1') {
        const boxX = bx + bw * (tut.kind === 'throw1' && phase > 1 ? 0.58 : 0.42);
        const boxY = floorY - ms * (tut.kind === 'throw1' && phase < 1 ? 1.55 : 0.92);
        this._drawBoxCell(ctx, boxX, boxY, ms * 0.85, phase < 1, 1, false);
        if (tut.kind === 'throw1') {
          this._drawCrownIcon(ctx, bx + bw * 0.68, by + bh * 0.26, ms * 0.34, '#111111', '#ffffff');
        }
      } else if (tut.kind === 'bridge2' || tut.kind === 'laser3') {
        const count = tut.kind === 'laser3' ? 3 : 2;
        for (let i = 0; i < count; i++) {
          this._drawBoxCell(ctx, bx + bw * 0.4 + i * ms * 0.78, floorY - ms * 0.82, ms * 0.76, phase < 1, i + 1, false);
        }
      } else if (tut.kind === 'stair3' || tut.kind === 'spike4') {
        this._drawBoxCell(ctx, bx + bw * 0.40, floorY - ms * 0.8, ms * 0.75, false, 0, false);
        this._drawBoxCell(ctx, bx + bw * 0.40 + ms * 0.75, floorY - ms * 0.8, ms * 0.75, false, 0, false);
        this._drawBoxCell(ctx, bx + bw * 0.40 + ms * 0.75, floorY - ms * 1.55, ms * 0.75, false, 0, false);
      } else if (tut.kind === 'hook5') {
        ctx.fillStyle = '#a6a6a6';
        ctx.fillRect(bx + bw * 0.52, by + 10, bw * 0.34, bh * 0.42);
        ctx.strokeRect(bx + bw * 0.52, by + 10, bw * 0.34, bh * 0.42);
        this._drawBoxCell(ctx, bx + bw * 0.36, floorY - ms * 1.5, ms * 0.72, true, 1, false);
        this._drawBoxCell(ctx, bx + bw * 0.52, by + 10 - ms * 0.72, ms * 0.72, true, 2, true);
      } else if (tut.kind === 'shoot4') {
        const slideOffset = Math.min(1, phase) * bw * 0.25;
        ctx.fillStyle = 'rgba(123,125,128,0.3)';
        ctx.fillRect(bx + bw * 0.38 + slideOffset - 8, floorY - ms * 0.8, ms * 0.75, ms * 0.75);
        this._drawBoxCell(ctx, bx + bw * 0.38 + slideOffset, floorY - ms * 0.8, ms * 0.75, false, 0, false);
        ctx.fillStyle = '#29b6f6';
        ctx.fillRect(bx + bw - 16, floorY - ms * 0.75, 6, ms * 0.7);
      }

      ctx.restore();
    }

    // =========================================================================
    // TOP-RIGHT GRAPHICAL HUD BADGE ([Qbby ▶ □□□] + Budget Bar + Crowns)
    // =========================================================================

    _drawTopRightHUD(ctx, engine) {
      const st = engine.stage;
      if (!st) return;

      const p = engine.player;
      const usedInChain = p ? p.activeChain.length : 0;
      const pipSize = 18;
      const pipGap = 5;
      const badgeW = 68 + st.boxLimit * (pipSize + pipGap) + 14;
      const badgeH = 54;
      const bx = this.width - badgeW - 14;
      const by = 90; // Below top utility buttons so zero overlap

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.5;
      this._roundRect(ctx, bx, by, badgeW, badgeH, 10);
      ctx.fill();
      ctx.stroke();

      // Mini Qbby/Qucy head icon on left of badge
      const heroType = p ? p.hero : engine.selectedHero;
      this._drawHeroScreen(ctx, bx + 10, by + 8, 26, heroType, 1, engine.drawMode ? 'creating' : 'normal', 0, 1, 1);

      // Red Play/Extrude Triangle ▶
      ctx.fillStyle = '#e60012';
      ctx.beginPath();
      ctx.moveTo(bx + 44, by + 14);
      ctx.lineTo(bx + 54, by + 21);
      ctx.lineTo(bx + 44, by + 28);
      ctx.closePath();
      ctx.fill();

      // Row 1: Box Limit Pip Slots (filled white when available, slate grey when extruded)
      for (let i = 0; i < st.boxLimit; i++) {
        const px = bx + 62 + i * (pipSize + pipGap);
        const py = by + 11;
        const isExtruded = i < usedInChain;
        ctx.fillStyle = isExtruded ? '#7b7d80' : '#ffffff';
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 2.2;
        ctx.fillRect(px, py, pipSize, pipSize);
        ctx.strokeRect(px, py, pipSize, pipSize);
      }

      // Row 2: Crown Icon(s) + Target Box Budget Mini-Pips
      const crownCount = engine.crowns.length;
      for (let c = 0; c < crownCount; c++) {
        const collected = engine.crowns[c].collected;
        this._drawCrownIcon(
          ctx,
          bx + 20 + c * 22,
          by + 42,
          7.5,
          collected ? '#111111' : '#cccccc',
          collected ? '#ffd426' : '#ffffff'
        );
      }

      // Budget meter mini-blocks (green/gold when within budget, coral if over budget)
      const budgetStartX = bx + 62;
      const totalSlots = Math.min(14, st.targetBoxBudget);
      const slotW = Math.max(4, Math.min(9, Math.floor((badgeW - 72) / Math.max(1, totalSlots)) - 2));
      for (let b = 0; b < totalSlots; b++) {
        const filled = b < engine.boxesUsed;
        const over = engine.boxesUsed > st.targetBoxBudget;
        ctx.fillStyle = filled ? (over ? '#ef5350' : '#1cc800') : '#e0e0e0';
        ctx.fillRect(budgetStartX + b * (slotW + 2), by + 37, slotW, 9);
      }

      ctx.restore();
    }

    // =========================================================================
    // STAGE CLEAR SUMMARY MODAL (100% Graphical Targets Plaque + Medals)
    // =========================================================================

    _drawStageClearModal(ctx, engine) {
      const W = this.width;
      const H = this.height;
      const cardW = Math.min(W * 0.84, 460);
      const cardH = 270;
      const cx = W * 0.5;
      const bx = cx - cardW * 0.5;
      const by = Math.max(30, H * 0.14);

      ctx.save();
      // Framed White Plaque with Black Header Bar & Corner Rivets (exact sheet_p1 & sheet_p5 style!)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 3.5;
      this._roundRect(ctx, bx, by, cardW, cardH, 8);
      ctx.fill();
      ctx.stroke();

      // Black header bar with 3 Gold Stars emblem (replaces "Targets" text)
      ctx.fillStyle = '#111111';
      ctx.fillRect(bx + 8, by + 8, cardW - 16, 44);
      for (let i = 0; i < 3; i++) {
        const active = i < engine.medalEarned;
        this._drawMiniStar(ctx, cx + (i - 1) * 38, by + 30, 14, active ? '#ffd426' : '#555555', '#ffffff');
      }

      // Corner rivets
      [
        [bx + 12, by + cardH - 12],
        [bx + cardW - 12, by + cardH - 12]
      ].forEach((rv) => {
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(rv[0], rv[1], 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Row 1: Crowns Collected -> Circular Crown Medal
      const row1Y = by + 64;
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 14, row1Y, cardW - 28, 56);
      ctx.fillStyle = '#e6e6e6';
      ctx.fillRect(bx + cardW - 140, row1Y + 2, 124, 52);

      engine.crowns.forEach((cr, idx) => {
        this._drawCrownIcon(
          ctx,
          bx + 54 + idx * 36,
          row1Y + 30,
          13,
          cr.collected ? '#111111' : '#cccccc',
          cr.collected ? '#ffd426' : '#ffffff'
        );
      });

      const allCrowns = engine.crowns.every((c) => c.collected);
      this._drawCircularMedal(ctx, bx + cardW - 78, row1Y + 28, 18, allCrowns, 'crown');

      // Row 2: Boxes Used Pip Tally vs Target Box Budget -> 1, 2, 3 Chevron Medals
      const row2Y = by + 128;
      ctx.strokeStyle = '#111111';
      ctx.strokeRect(bx + 14, row2Y, cardW - 28, 56);
      ctx.fillStyle = '#e6e6e6';
      ctx.fillRect(bx + cardW - 140, row2Y + 2, 124, 52);

      // Graphical mini-boxes used vs budget bracket
      const maxPips = Math.min(12, Math.max(engine.boxesUsed, engine.stage.targetBoxBudget));
      const pSize = Math.min(14, Math.floor((cardW - 190) / Math.max(1, maxPips)) - 3);
      for (let i = 0; i < maxPips; i++) {
        const px = bx + 28 + i * (pSize + 3);
        const py = row2Y + 28 - pSize * 0.5;
        const used = i < engine.boxesUsed;
        const inBudget = i < engine.stage.targetBoxBudget;
        ctx.fillStyle = used ? (inBudget ? '#7b7d80' : '#ef5350') : '#ffffff';
        ctx.strokeStyle = inBudget ? '#111111' : '#ef5350';
        ctx.lineWidth = 1.8;
        ctx.fillRect(px, py, pSize, pSize);
        ctx.strokeRect(px, py, pSize, pSize);
      }

      // 3 Circular Chevron Target Medals (1-chevron Bronze, 2-chevron Silver, 3-chevron Gold)
      for (let m = 1; m <= 3; m++) {
        const earned = engine.medalEarned >= m;
        this._drawCircularMedal(ctx, bx + cardW - 116 + (m - 1) * 38, row2Y + 28, 15, earned, m);
      }

      // Bottom Graphical Action Buttons: [ ⊞ Map ] [ ↻ Replay ] [ ▶ Next Stage ]
      const btnY = by + 198;
      const btnW = 92;
      const btnH = 54;
      const btns = [
        {
          x: cx - btnW * 1.65,
          color: '#7b7d80',
          drawIcon: (ix, iy) => {
            ctx.fillStyle = '#ffffff';
            for (let r = 0; r < 2; r++) {
              for (let c = 0; c < 2; c++) {
                ctx.fillRect(ix - 11 + c * 13, iy - 11 + r * 13, 9, 9);
              }
            }
          },
          act: () => {
            engine.screen = 'map';
          }
        },
        {
          x: cx - btnW * 0.5,
          color: '#29b6f6',
          drawIcon: (ix, iy) => {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.arc(ix, iy, 11, 0.3, Math.PI * 1.75);
            ctx.stroke();
          },
          act: () => {
            engine.loadStage(engine.stageIndex);
          }
        },
        {
          x: cx + btnW * 0.65,
          color: '#1cc800',
          drawIcon: (ix, iy) => {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(ix - 8, iy - 11);
            ctx.lineTo(ix + 11, iy);
            ctx.lineTo(ix - 8, iy + 11);
            ctx.closePath();
            ctx.fill();
          },
          act: () => {
            const nextIdx = (engine.stageIndex + 1) % engine.stages.length;
            engine.loadStage(nextIdx);
          }
        }
      ];

      btns.forEach((b, i) => {
        ctx.fillStyle = b.color;
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 2.5;
        this._roundRect(ctx, b.x, btnY, btnW, btnH, 10);
        ctx.fill();
        ctx.stroke();
        b.drawIcon(b.x + btnW * 0.5, btnY + btnH * 0.5);

        this.regions[['clearMap', 'clearReplay', 'clearNext'][i]] = { x: b.x, y: btnY, w: btnW, h: btnH };
        this.hitRegions.push({
          x: b.x,
          y: btnY,
          w: btnW,
          h: btnH,
          action: b.act
        });
      });

      ctx.restore();
    }

    _drawCircularMedal(ctx, cx, cy, r, earned, type) {
      ctx.save();
      // Ribbon tab at top of medal
      ctx.fillStyle = earned ? '#111111' : '#b0b0b0';
      ctx.fillRect(cx - r * 0.35, cy - r * 1.35, r * 0.7, r * 0.45);

      ctx.fillStyle = earned ? '#111111' : '#bdbdbd';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (type === 'crown') {
        this._drawCrownIcon(ctx, cx, cy + 2, r * 0.56, '#ffffff', earned ? '#111111' : '#bdbdbd');
      } else {
        // 1, 2, or 3 downward chevrons inside circular medal (exact Targets card design!)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2;
        const count = Number(type) || 1;
        for (let i = 0; i < count; i++) {
          const vy = cy - (count - 1) * 3 + i * 6;
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.48, vy - 3);
          ctx.lineTo(cx, vy + 3);
          ctx.lineTo(cx + r * 0.48, vy - 3);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    _drawMiniStar(ctx, cx, cy, r, fill, stroke) {
      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI * 0.5 + (i * Math.PI) / 5;
        const dist = i % 2 === 0 ? r : r * 0.44;
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    _roundRect(ctx, x, y, w, h, r) {
      const rad = Math.min(r, w * 0.5, h * 0.5);
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.lineTo(x + w - rad, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
      ctx.lineTo(x + w, y + h - rad);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
      ctx.lineTo(x + rad, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
      ctx.lineTo(x, y + rad);
      ctx.quadraticCurveTo(x, y, x + rad, y);
      ctx.closePath();
    }
  }

  window.BoxBoyRenderer = new BoxBoyRenderer();
})();
