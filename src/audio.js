/**
 * Procedural Tactile WebAudio Synthesizer for BoxBoy! + Box Girl! (Zero-Text Web Edition)
 * Strictly procedural WebAudio synthesis (AudioContext, oscillators, filtered noise, gain envelopes).
 * Zero external audio assets and zero window.speechSynthesis usage.
 */
(function () {
  'use strict';

  class BoxBoyAudio {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.compressor = null;
      this.muted = false;
      this.unlocked = false;
      this.noiseBuffer = null;
      this.lastStepTime = 0;
      this.lastLaserTime = 0;

      // Pentatonic scale frequencies (C5, D5, E5, G5, A5, C6) for box extrusion 1..5
      this.createScale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return this.ctx;
      }
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0.0 : 0.45, this.ctx.currentTime);
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);

        // Pre-build 0.5s white noise buffer for tactile thuds, puffs, and slides
        const sampleRate = this.ctx.sampleRate || 44100;
        const length = Math.floor(sampleRate * 0.5);
        this.noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        this.unlocked = true;
      } catch (e) {
        this.ctx = null;
      }
      return this.ctx;
    }

    unlock() {
      const ctx = this.init();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }

    setMuted(muted) {
      this.muted = Boolean(muted);
      if (this.ctx && this.masterGain) {
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(this.muted ? 0.0 : 0.45, now, 0.015);
      }
      return this.muted;
    }

    toggleMute() {
      return this.setMuted(!this.muted);
    }

    _canPlay() {
      if (this.muted) return false;
      if (!this.ctx) this.init();
      if (!this.ctx) return false;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return true;
    }

    // 1. Footstep: soft rhythmic wooden tap
    step() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      if (now - this.lastStepTime < 0.09) return;
      this.lastStepTime = now;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(155, now);
        osc.frequency.exponentialRampToValueAtTime(75, now + 0.035);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.045);
      } catch (e) {}
    }

    // 2. Jump: crisp upward sine/triangle pop
    jump() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(460, now + 0.095);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.115);
      } catch (e) {}
    }

    // 3. Box Create: warm rising marimba/kalimba harmonic click per segment 1..5
    boxCreate(segmentIndex = 1) {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      const idx = Math.max(0, Math.min(this.createScale.length - 1, (segmentIndex | 0) - 1));
      const freq = this.createScale[idx];
      try {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(freq, now);
        osc2.frequency.setValueAtTime(freq * 2.0, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.32, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.13);
        osc2.stop(now + 0.13);
      } catch (e) {}
    }

    // 4. Box Place: tactile cardboard/wooden thud
    boxPlace() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(58, now + 0.08);

        gain.gain.setValueAtTime(0.34, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.095);

        if (this.noiseBuffer) {
          const noise = this.ctx.createBufferSource();
          const filter = this.ctx.createBiquadFilter();
          const nGain = this.ctx.createGain();
          noise.buffer = this.noiseBuffer;
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(360, now);
          nGain.gain.setValueAtTime(0.18, now);
          nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          noise.connect(filter);
          filter.connect(nGain);
          nGain.connect(this.masterGain);
          noise.start(now);
          noise.stop(now + 0.055);
        }
      } catch (e) {}
    }

    // 5. Box Throw: brisk upward-forward whoosh
    boxThrow() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.07);
        osc.frequency.exponentialRampToValueAtTime(310, now + 0.15);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.165);
      } catch (e) {}
    }

    // 6. Box Hook / Retract: zippy mechanical ratchet blip
    boxHook(stepIndex = 1) {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      const baseFreq = 380 + Math.min(6, stepIndex) * 55;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, now + 0.055);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.07);
      } catch (e) {}
    }

    // 7. Box Shoot / Slide: smooth horizontal glide swoosh
    boxShoot() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(740, now + 0.06);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.18);

        gain.gain.setValueAtTime(0.26, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.2);

        if (this.noiseBuffer) {
          const noise = this.ctx.createBufferSource();
          const filter = this.ctx.createBiquadFilter();
          const nGain = this.ctx.createGain();
          noise.buffer = this.noiseBuffer;
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1100, now);
          filter.Q.setValueAtTime(2.0, now);
          nGain.gain.setValueAtTime(0.16, now);
          nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          noise.connect(filter);
          filter.connect(nGain);
          nGain.connect(this.masterGain);
          noise.start(now);
          noise.stop(now + 0.16);
        }
      } catch (e) {}
    }

    // 8. Box Erase: gentle airy puff
    boxErase() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      try {
        if (this.noiseBuffer) {
          const noise = this.ctx.createBufferSource();
          const filter = this.ctx.createBiquadFilter();
          const nGain = this.ctx.createGain();
          noise.buffer = this.noiseBuffer;
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(800, now);
          filter.frequency.exponentialRampToValueAtTime(280, now + 0.11);
          nGain.gain.setValueAtTime(0.22, now);
          nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          noise.connect(filter);
          filter.connect(nGain);
          nGain.connect(this.masterGain);
          noise.start(now);
          noise.stop(now + 0.125);
        }
      } catch (e) {}
    }

    // 9. Wall Switch Toggle: crisp mechanical clack + two-tone confirmation chime
    switchToggle(color = 'blue') {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      const f1 = color === 'red' ? 587.33 : 523.25;
      const f2 = color === 'red' ? 880.0 : 783.99;
      try {
        [f1, f2].forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const start = now + idx * 0.055;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.28, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(start);
          osc.stop(start + 0.12);
        });
      } catch (e) {}
    }

    // 10. Laser Hum / Laser Block Thrum
    laserHum(blocked = false) {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      if (now - this.lastLaserTime < 0.25) return;
      this.lastLaserTime = now;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = blocked ? 'sine' : 'sawtooth';
        osc.frequency.setValueAtTime(blocked ? 110 : 165, now);
        gain.gain.setValueAtTime(blocked ? 0.06 : 0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.13);
      } catch (e) {}
    }

    // 11. Crown Pickup: sparkling 4-note major arpeggio chime
    crownPickup() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      const notes = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6
      try {
        notes.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const t = now + i * 0.055;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.28, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(t);
          osc.stop(t + 0.19);
        });
      } catch (e) {}
    }

    // 12. Stage Clear: uplifting BoxBoy!-style victory fanfare
    stageClear() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      const melody = [
        { f: 523.25, t: 0.0, d: 0.11 },
        { f: 659.25, t: 0.11, d: 0.11 },
        { f: 783.99, t: 0.22, d: 0.11 },
        { f: 1046.5, t: 0.33, d: 0.26 },
        { f: 783.99, t: 0.60, d: 0.10 },
        { f: 1046.5, t: 0.72, d: 0.38 }
      ];
      try {
        melody.forEach((n) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const start = now + n.t;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(n.f, start);
          gain.gain.setValueAtTime(0.30, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + n.d);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(start);
          osc.stop(start + n.d + 0.02);
        });
      } catch (e) {}
    }

    // 13. Guide Coach reminder: soft two-note "look here" ping
    hintChime() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      try {
        [880.0, 1174.66].forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const t = now + i * 0.12;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.16, t + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(t);
          osc.stop(t + 0.3);
        });
      } catch (e) {}
    }

    // Hazard / Hurt sound
    hurt() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(85, now + 0.18);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.21);
      } catch (e) {}
    }
  }

  window.BoxBoyAudio = new BoxBoyAudio();
})();
