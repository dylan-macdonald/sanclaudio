// San Claudio - Audio System
// All procedural Web Audio API: Animalese voices, SFX, radio

export class AudioManager {
    constructor(game) {
        this.game = game;
        this.ctx = null;
        this.initialized = false;
        this.masterGain = null;

        // Voice profiles
        this.voiceProfiles = {
            marco: { basePitch: 180, waveform: 'triangle', speed: 40 },
            sal: { basePitch: 120, waveform: 'sawtooth', speed: 55 },
            nina: { basePitch: 280, waveform: 'sine', speed: 30 },
            vex: { basePitch: 220, waveform: 'square', speed: 25 },
            reyes: { basePitch: 140, waveform: 'triangle', speed: 50 },
            cop: { basePitch: 160, waveform: 'square', speed: 40 },
        };

        // Radio
        this.currentStation = -1; // -1 = off
        this.radioStations = ['Lo-Fi Beats', 'Synth Wave', 'Drum & Bass'];
        this.radioOscillators = [];
    }

    init() {
        // AudioContext created on user interaction
    }

    resumeContext() {
        try {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 0.5;
                this.masterGain.connect(this.ctx.destination);
                this.initialized = true;
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        } catch (e) {
            // AudioContext not available
        }
    }

    update(dt) {
        // Update ambient sounds
        this.updateAmbience(dt);
    }

    // --- Ambient City Sounds ---
    initAmbience() {
        if (!this.initialized || !this.ctx) return;
        if (this._ambienceInit) return;
        this._ambienceInit = true;

        // Master ambient gain
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0.06;
        this.ambientGain.connect(this.masterGain);

        // --- Traffic hum: filtered brown noise, always on ---
        const trafficBufSize = this.ctx.sampleRate * 2;
        const trafficBuf = this.ctx.createBuffer(1, trafficBufSize, this.ctx.sampleRate);
        const td = trafficBuf.getChannelData(0);
        let lastVal = 0;
        for (let i = 0; i < trafficBufSize; i++) {
            const white = Math.random() * 2 - 1;
            lastVal = (lastVal + 0.02 * white) / 1.02; // brown noise
            td[i] = lastVal * 3.5;
        }
        this._trafficSrc = this.ctx.createBufferSource();
        this._trafficSrc.buffer = trafficBuf;
        this._trafficSrc.loop = true;
        this._trafficFilter = this.ctx.createBiquadFilter();
        this._trafficFilter.type = 'bandpass';
        this._trafficFilter.frequency.value = 200;
        this._trafficFilter.Q.value = 0.3;
        this._trafficGain = this.ctx.createGain();
        this._trafficGain.gain.value = 1.0;
        this._trafficSrc.connect(this._trafficFilter);
        this._trafficFilter.connect(this._trafficGain);
        this._trafficGain.connect(this.ambientGain);
        this._trafficSrc.start();

        // --- Bird chirps: scheduled chirp bursts, active during day ---
        this._birdGain = this.ctx.createGain();
        this._birdGain.gain.value = 0;
        this._birdGain.connect(this.ambientGain);
        this._birdTimer = 0;

        // --- Cricket chirps: high frequency clicks, active at night ---
        this._cricketGain = this.ctx.createGain();
        this._cricketGain.gain.value = 0;
        this._cricketGain.connect(this.ambientGain);
        this._cricketTimer = 0;

        // --- Wind: filtered noise, active during storms/fog ---
        const windBufSize = this.ctx.sampleRate * 3;
        const windBuf = this.ctx.createBuffer(1, windBufSize, this.ctx.sampleRate);
        const wd = windBuf.getChannelData(0);
        for (let i = 0; i < windBufSize; i++) {
            wd[i] = (Math.random() * 2 - 1) * 0.5;
        }
        this._windSrc = this.ctx.createBufferSource();
        this._windSrc.buffer = windBuf;
        this._windSrc.loop = true;
        this._windFilter = this.ctx.createBiquadFilter();
        this._windFilter.type = 'lowpass';
        this._windFilter.frequency.value = 600;
        this._windFilter.Q.value = 1;
        this._windGain = this.ctx.createGain();
        this._windGain.gain.value = 0;
        this._windSrc.connect(this._windFilter);
        this._windFilter.connect(this._windGain);
        this._windGain.connect(this.ambientGain);
        this._windSrc.start();

        // --- Distant honks: random car horn bursts in the distance ---
        this._honkTimer = 5 + Math.random() * 10;
    }

    updateAmbience(dt) {
        if (!this.initialized || !this.ctx) return;
        if (!this._ambienceInit) {
            this.initAmbience();
            return;
        }

        const game = this.game;
        const timeOfDay = game.timeOfDay || 0.3;
        const weather = game.currentWeather || 'clear';

        // Sun factor: 0 = night, 1 = full day
        const sunAngle = timeOfDay * Math.PI * 2;
        const sunHeight = Math.sin(sunAngle - Math.PI * 0.5);
        const dayFactor = Math.max(0, Math.min(1, sunHeight * 2 + 0.5));

        // --- Traffic: louder during day, quieter at night ---
        const trafficTarget = 0.5 + dayFactor * 0.5;
        this._trafficGain.gain.value += (trafficTarget - this._trafficGain.gain.value) * dt * 0.5;

        // --- Birds: active during daytime (dayFactor > 0.4) ---
        const birdTarget = dayFactor > 0.4 ? (dayFactor - 0.4) * 1.5 : 0;
        this._birdGain.gain.value += (birdTarget - this._birdGain.gain.value) * dt * 0.3;

        this._birdTimer -= dt;
        if (this._birdTimer <= 0 && dayFactor > 0.4) {
            this._birdTimer = 1.5 + Math.random() * 4;
            this._playBirdChirp();
        }

        // --- Crickets: active at night (dayFactor < 0.3) ---
        const cricketTarget = dayFactor < 0.3 ? (0.3 - dayFactor) * 3 : 0;
        this._cricketGain.gain.value += (cricketTarget - this._cricketGain.gain.value) * dt * 0.3;

        this._cricketTimer -= dt;
        if (this._cricketTimer <= 0 && dayFactor < 0.3) {
            this._cricketTimer = 0.15 + Math.random() * 0.4;
            this._playCricketChirp();
        }

        // --- Wind: active during storm, fog, rain ---
        const windTargets = { clear: 0, overcast: 0.15, rain: 0.4, fog: 0.2, storm: 0.8 };
        const windTarget = windTargets[weather] || 0;
        this._windGain.gain.value += (windTarget - this._windGain.gain.value) * dt * 0.3;

        // Modulate wind filter for gusts
        if (weather === 'storm' || weather === 'rain') {
            this._windFilter.frequency.value = 400 + Math.sin(game.elapsedTime * 0.7) * 200;
        }

        // --- Distant honks ---
        this._honkTimer -= dt;
        if (this._honkTimer <= 0) {
            this._honkTimer = 8 + Math.random() * 20;
            this._playDistantHonk();
        }
    }

    _playBirdChirp() {
        try {
            const ctx = this.ctx;
            const now = ctx.currentTime;
            // 2-4 rapid notes ascending
            const noteCount = 2 + Math.floor(Math.random() * 3);
            const baseFreq = 2000 + Math.random() * 2000;
            for (let i = 0; i < noteCount; i++) {
                const t = now + i * 0.08;
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(baseFreq + i * (100 + Math.random() * 200), t);
                osc.frequency.linearRampToValueAtTime(baseFreq + i * 150 + 300, t + 0.05);
                const g = ctx.createGain();
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.08, t + 0.01);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
                osc.connect(g);
                g.connect(this._birdGain);
                osc.start(t);
                osc.stop(t + 0.07);
            }
        } catch (e) {}
    }

    _playCricketChirp() {
        try {
            const ctx = this.ctx;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 4500 + Math.random() * 1000;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.03, now + 0.005);
            g.gain.linearRampToValueAtTime(0, now + 0.015);
            osc.connect(g);
            g.connect(this._cricketGain);
            osc.start(now);
            osc.stop(now + 0.02);
        } catch (e) {}
    }

    _playDistantHonk() {
        try {
            const ctx = this.ctx;
            const now = ctx.currentTime;
            const freq = 250 + Math.random() * 200;
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            filter.Q.value = 0.5;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.015, now + 0.1);
            g.gain.setValueAtTime(0.015, now + 0.2 + Math.random() * 0.3);
            g.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.connect(filter);
            filter.connect(g);
            g.connect(this.ambientGain);
            osc.start(now);
            osc.stop(now + 0.6);
        } catch (e) {}
    }

    // --- Animalese Voice System ---
    playAnimalese(text, basePitch, modifier) {
        if (!this.initialized || !this.ctx) return;

        try {
            const charDelay = 35; // ms per character
            let time = this.ctx.currentTime;

            for (let i = 0; i < text.length; i++) {
                const char = text[i].toLowerCase();

                if (char === ' ') {
                    time += 0.04;
                    continue;
                }
                if (char === ',' || char === ';') {
                    time += 0.1;
                    continue;
                }
                if (char === '.' || char === '!' || char === '?') {
                    time += 0.2;
                    continue;
                }

                // Map character to frequency
                const charCode = char.charCodeAt(0);
                const semitone = (charCode - 97) % 12;
                const freq = basePitch * Math.pow(2, semitone / 12);
                const finalFreq = freq + (Math.random() - 0.5) * 20;

                // Vowels slightly longer
                const isVowel = 'aeiou'.includes(char);
                const duration = isVowel ? 0.06 : 0.04;

                // Create oscillator for this character
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.value = finalFreq;

                // Modifier effects
                let volume = 0.08;
                if (modifier === 'scared') {
                    osc.frequency.value *= 1.5;
                    volume = 0.05;
                } else if (modifier === 'shouting') {
                    osc.frequency.value *= 1.3;
                    volume = 0.12;
                } else if (modifier === 'authoritative') {
                    volume = 0.1;
                }

                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(volume, time + 0.005);
                gain.gain.linearRampToValueAtTime(0, time + duration);

                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(time);
                osc.stop(time + duration + 0.01);

                time += charDelay / 1000;
            }
        } catch (e) {
            // Audio error, silently ignore
        }
    }

    playCharacterVoice(character, text, modifier) {
        const profile = this.voiceProfiles[character];
        if (profile) {
            this.playAnimalese(text, profile.basePitch, modifier || 'normal');
        }
    }

    // --- Sound Effects ---
    playGunshot(weaponId) {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;

            // Noise burst
            const bufferSize = this.ctx.sampleRate * 0.05;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
            }

            const source = this.ctx.createBufferSource();
            source.buffer = buffer;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            const filter = this.ctx.createBiquadFilter();

            // Different sounds per weapon
            switch (weaponId) {
                case 'pistol':
                    filter.type = 'highpass';
                    filter.frequency.value = 800;
                    break;
                case 'shotgun':
                    filter.type = 'lowpass';
                    filter.frequency.value = 600;
                    gain.gain.setValueAtTime(0.5, now);
                    break;
                case 'smg':
                    filter.type = 'highpass';
                    filter.frequency.value = 1200;
                    gain.gain.setValueAtTime(0.2, now);
                    break;
                case 'rifle':
                    filter.type = 'bandpass';
                    filter.frequency.value = 1000;
                    break;
                case 'sniper':
                    filter.type = 'bandpass';
                    filter.frequency.value = 500;
                    gain.gain.setValueAtTime(0.4, now);
                    break;
                default:
                    filter.type = 'highpass';
                    filter.frequency.value = 800;
            }

            source.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            source.start(now);

            // Trigger NPC flee
            this.game.systems.npcs.fleeFromPoint(this.game.systems.player.position);
        } catch (e) {}
    }

    playPunch() {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;

            // Low thud
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.2);

            // Noise component
            const bufSize = this.ctx.sampleRate * 0.04;
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.15, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            src.connect(g);
            g.connect(this.masterGain);
            src.start(now);
        } catch (e) {}
    }

    playExplosion() {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;

            // Deep bass boom
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(60, now);
            osc.frequency.exponentialRampToValueAtTime(20, now + 0.3);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.6, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.6);

            // Noise crackle
            const bufSize = this.ctx.sampleRate * 0.3;
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.5));
            }
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.4, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            src.connect(g);
            g.connect(this.masterGain);
            src.start(now);

            // Trigger NPC flee
            this.game.systems.npcs.fleeFromPoint(this.game.systems.player.position);
        } catch (e) {}
    }

    playAtomizer() {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;

            // Rising pitch whine
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(2000, now + 0.3);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.25, now + 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            // Distortion
            const distortion = this.ctx.createWaveShaper();
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                const x = (i * 2) / 256 - 1;
                curve[i] = Math.tanh(x * 3);
            }
            distortion.curve = curve;

            osc.connect(distortion);
            distortion.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.5);
        } catch (e) {}
    }

    playPickup() {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.15);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.25);
        } catch (e) {}
    }

    playDeathTone() {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            // Descending minor chord
            const freqs = [440, 330, 262];
            for (const freq of freqs) {
                const osc = this.ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                osc.frequency.linearRampToValueAtTime(freq * 0.5, now + 1);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 1.6);
            }
        } catch (e) {}
    }

    playSiren() {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';

            // Alternating two-tone
            for (let i = 0; i < 4; i++) {
                osc.frequency.setValueAtTime(600, now + i * 0.4);
                osc.frequency.setValueAtTime(800, now + i * 0.4 + 0.2);
            }

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 1.7);
        } catch (e) {}
    }

    playFootstep() {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const bufSize = this.ctx.sampleRate * 0.02;
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * 0.1;
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 2000;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.05, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            src.connect(filter);
            filter.connect(g);
            g.connect(this.masterGain);
            src.start(now);
        } catch (e) {}
    }

    playHorn(vehicleType) {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            // Different horn per vehicle type
            const hornFreqs = {
                sedan: [280, 350],
                sports: [400, 500],
                truck: [130, 160],
                motorcycle: [500, 600],
                boat: [200, 250],
                helicopter: [350, 440]
            };
            const freqs = hornFreqs[vehicleType] || hornFreqs.sedan;

            for (const freq of freqs) {
                const osc = this.ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = freq;
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = freq * 2;
                filter.Q.value = 1;
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
                gain.gain.setValueAtTime(0.1, now + 0.3);
                gain.gain.linearRampToValueAtTime(0, now + 0.4);
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.45);
            }
        } catch (e) {}
    }

    playEngineLoop(speed, vehicleType) {
        if (!this.initialized || !this.ctx) return;
        try {
            // Create persistent engine oscillator on first call
            if (!this._engineOsc) {
                this._engineOsc = this.ctx.createOscillator();
                this._engineOsc.type = 'sawtooth';
                this._engineOsc.frequency.value = 60;
                this._engineFilter = this.ctx.createBiquadFilter();
                this._engineFilter.type = 'lowpass';
                this._engineFilter.frequency.value = 300;
                this._engineFilter.Q.value = 2;
                this._engineGain = this.ctx.createGain();
                this._engineGain.gain.value = 0;
                this._engineOsc.connect(this._engineFilter);
                this._engineFilter.connect(this._engineGain);
                this._engineGain.connect(this.masterGain);
                this._engineOsc.start();
            }

            // Map vehicle types to engine pitch ranges
            const pitchRanges = {
                sedan: { idle: 55, max: 180 },
                sports: { idle: 70, max: 250 },
                truck: { idle: 35, max: 120 },
                motorcycle: { idle: 80, max: 350 },
                boat: { idle: 40, max: 130 },
                helicopter: { idle: 90, max: 200 }
            };
            const range = pitchRanges[vehicleType] || pitchRanges.sedan;

            const absSpeed = Math.abs(speed);
            const speedFactor = Math.min(1, absSpeed / 50);
            const targetFreq = range.idle + (range.max - range.idle) * speedFactor;
            const targetVol = 0.02 + speedFactor * 0.04;

            // Smooth transitions
            const now = this.ctx.currentTime;
            this._engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);
            this._engineGain.gain.setTargetAtTime(targetVol, now, 0.05);
            this._engineFilter.frequency.setTargetAtTime(200 + speedFactor * 400, now, 0.1);
        } catch (e) {}
    }

    stopEngine() {
        if (this._engineGain) {
            try {
                this._engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
            } catch (e) {}
        }
    }

    playTireScreech(intensity) {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const duration = 0.15 + intensity * 0.3;

            // White noise through bandpass = screech
            const bufSize = Math.floor(this.ctx.sampleRate * duration);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.7));
            }
            const src = this.ctx.createBufferSource();
            src.buffer = buf;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 2500 + intensity * 1500;
            filter.Q.value = 3;

            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.04 + intensity * 0.06, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + duration);

            src.connect(filter);
            filter.connect(g);
            g.connect(this.masterGain);
            src.start(now);
        } catch (e) {}
    }

    playCrash(intensity) {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            // Metal crunch: noise + low frequency thud
            const bufSize = Math.floor(this.ctx.sampleRate * 0.15);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.2));
            }
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.1 + intensity * 0.15, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            src.connect(filter);
            filter.connect(g);
            g.connect(this.masterGain);
            src.start(now);

            // Thud
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(80, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);
            const og = this.ctx.createGain();
            og.gain.setValueAtTime(0.15 * intensity, now);
            og.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(og);
            og.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.2);
        } catch (e) {}
    }

    playSplash() {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const bufSize = this.ctx.sampleRate * 0.15;
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.4));
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1200;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.2, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            src.connect(filter);
            filter.connect(g);
            g.connect(this.masterGain);
            src.start(now);
        } catch (e) {}
    }

    // Radio
    cycleRadio(direction) {
        this.stopRadio();
        this.currentStation += direction;
        if (this.currentStation >= this.radioStations.length) this.currentStation = -1;
        if (this.currentStation < -1) this.currentStation = this.radioStations.length - 1;

        if (this.currentStation >= 0) {
            this.startRadio(this.currentStation);
        }
    }

    startRadio(station) {
        if (!this.initialized || !this.ctx) return;
        this.stopRadio();

        // Create radio gain node
        this.radioGain = this.ctx.createGain();
        this.radioGain.gain.value = 0.12;
        this.radioGain.connect(this.masterGain);

        switch (station) {
            case 0: this._playLoFiBeats(); break;
            case 1: this._playSynthWave(); break;
            case 2: this._playDrumAndBass(); break;
        }
    }

    _playLoFiBeats() {
        // Lo-fi hip-hop: warm chords + lazy drum loop + vinyl crackle
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const bpm = 75;
        const beat = 60 / bpm;
        const barLen = beat * 4;
        const totalBars = 32;

        // Vinyl crackle noise
        const crackleSize = ctx.sampleRate * barLen * totalBars;
        const crackleBuf = ctx.createBuffer(1, crackleSize, ctx.sampleRate);
        const crackleData = crackleBuf.getChannelData(0);
        for (let i = 0; i < crackleSize; i++) {
            crackleData[i] = (Math.random() < 0.002 ? (Math.random() - 0.5) * 0.4 : 0) +
                             (Math.random() - 0.5) * 0.005;
        }
        const crackleSrc = ctx.createBufferSource();
        crackleSrc.buffer = crackleBuf;
        crackleSrc.loop = true;
        const crackleFilter = ctx.createBiquadFilter();
        crackleFilter.type = 'bandpass';
        crackleFilter.frequency.value = 3000;
        crackleFilter.Q.value = 0.5;
        const crackleGain = ctx.createGain();
        crackleGain.gain.value = 0.3;
        crackleSrc.connect(crackleFilter);
        crackleFilter.connect(crackleGain);
        crackleGain.connect(this.radioGain);
        crackleSrc.start(now);
        this.radioOscillators.push(crackleSrc);

        // Chord progression: Cmaj7 -> Am7 -> Fmaj7 -> G7
        const chords = [
            [261.6, 329.6, 392.0, 493.9],  // Cmaj7
            [220.0, 261.6, 329.6, 392.0],  // Am7
            [174.6, 220.0, 261.6, 329.6],  // Fmaj7
            [196.0, 246.9, 293.7, 349.2],  // G7
        ];

        // Lo-pass filter for warmth
        const chordFilter = ctx.createBiquadFilter();
        chordFilter.type = 'lowpass';
        chordFilter.frequency.value = 800;
        chordFilter.Q.value = 0.7;
        chordFilter.connect(this.radioGain);

        for (let bar = 0; bar < totalBars; bar++) {
            const chord = chords[bar % chords.length];
            const barStart = now + bar * barLen;

            for (const freq of chord) {
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.value = freq * 0.5; // One octave down for warmth
                const g = ctx.createGain();
                g.gain.setValueAtTime(0, barStart);
                g.gain.linearRampToValueAtTime(0.06, barStart + 0.1);
                g.gain.setValueAtTime(0.06, barStart + barLen - 0.15);
                g.gain.linearRampToValueAtTime(0, barStart + barLen);
                osc.connect(g);
                g.connect(chordFilter);
                osc.start(barStart);
                osc.stop(barStart + barLen + 0.01);
                this.radioOscillators.push(osc);
            }

            // Drums: kick on 1,3, snare on 2,4, hats on every 8th
            for (let step = 0; step < 8; step++) {
                const t = barStart + step * (beat / 2);

                // Hi-hat on every 8th note
                const hatBuf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
                const hatD = hatBuf.getChannelData(0);
                for (let i = 0; i < hatD.length; i++) hatD[i] = (Math.random() * 2 - 1) * Math.exp(-i / (hatD.length * 0.15));
                const hatSrc = ctx.createBufferSource();
                hatSrc.buffer = hatBuf;
                const hatG = ctx.createGain();
                hatG.gain.setValueAtTime(step % 2 === 0 ? 0.06 : 0.03, t);
                const hatF = ctx.createBiquadFilter();
                hatF.type = 'highpass';
                hatF.frequency.value = 6000;
                hatSrc.connect(hatF);
                hatF.connect(hatG);
                hatG.connect(this.radioGain);
                hatSrc.start(t);
                this.radioOscillators.push(hatSrc);

                // Kick on beats 1, 3 (steps 0, 4)
                if (step === 0 || step === 4) {
                    const kick = ctx.createOscillator();
                    kick.type = 'sine';
                    kick.frequency.setValueAtTime(150, t);
                    kick.frequency.exponentialRampToValueAtTime(40, t + 0.12);
                    const kG = ctx.createGain();
                    kG.gain.setValueAtTime(0.2, t);
                    kG.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                    kick.connect(kG);
                    kG.connect(this.radioGain);
                    kick.start(t);
                    kick.stop(t + 0.25);
                    this.radioOscillators.push(kick);
                }

                // Snare on beats 2, 4 (steps 2, 6)
                if (step === 2 || step === 6) {
                    const snBuf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
                    const snD = snBuf.getChannelData(0);
                    for (let i = 0; i < snD.length; i++) snD[i] = (Math.random() * 2 - 1) * Math.exp(-i / (snD.length * 0.3));
                    const snSrc = ctx.createBufferSource();
                    snSrc.buffer = snBuf;
                    const snG = ctx.createGain();
                    snG.gain.setValueAtTime(0.08, t);
                    const snF = ctx.createBiquadFilter();
                    snF.type = 'bandpass';
                    snF.frequency.value = 2000;
                    snSrc.connect(snF);
                    snF.connect(snG);
                    snG.connect(this.radioGain);
                    snSrc.start(t);
                    this.radioOscillators.push(snSrc);
                }
            }
        }

        // Loop by restarting
        this._radioLoopTimer = setTimeout(() => {
            if (this.currentStation === 0) {
                this.stopRadio();
                this._playLoFiBeats();
            }
        }, totalBars * barLen * 1000);
    }

    _playSynthWave() {
        // Synthwave: arpeggiated synths, bass, driving beat
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const bpm = 110;
        const beat = 60 / bpm;
        const barLen = beat * 4;
        const totalBars = 32;

        // Bass progression
        const bassNotes = [55, 49, 44, 49]; // A1, Db2, A1, Db2 (minor feel)

        // Arp patterns (semitone offsets from root)
        const arpPattern = [0, 7, 12, 15, 12, 7, 0, 3];

        for (let bar = 0; bar < totalBars; bar++) {
            const barStart = now + bar * barLen;
            const root = bassNotes[bar % bassNotes.length];

            // Sub bass
            const bass = ctx.createOscillator();
            bass.type = 'sawtooth';
            bass.frequency.value = root;
            const bassFilter = ctx.createBiquadFilter();
            bassFilter.type = 'lowpass';
            bassFilter.frequency.value = 200;
            const bassG = ctx.createGain();
            bassG.gain.setValueAtTime(0, barStart);
            bassG.gain.linearRampToValueAtTime(0.12, barStart + 0.05);
            bassG.gain.setValueAtTime(0.12, barStart + barLen - 0.05);
            bassG.gain.linearRampToValueAtTime(0, barStart + barLen);
            bass.connect(bassFilter);
            bassFilter.connect(bassG);
            bassG.connect(this.radioGain);
            bass.start(barStart);
            bass.stop(barStart + barLen + 0.01);
            this.radioOscillators.push(bass);

            // Arpeggio - 16th notes
            for (let step = 0; step < 16; step++) {
                const t = barStart + step * (beat / 4);
                const semitone = arpPattern[step % arpPattern.length];
                const freq = root * 4 * Math.pow(2, semitone / 12); // 2 octaves up

                const osc = ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = freq;

                const arpFilter = ctx.createBiquadFilter();
                arpFilter.type = 'lowpass';
                arpFilter.frequency.setValueAtTime(2000, t);
                arpFilter.frequency.linearRampToValueAtTime(800, t + beat / 4);
                arpFilter.Q.value = 5;

                const g = ctx.createGain();
                g.gain.setValueAtTime(0.04, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + beat / 4);

                osc.connect(arpFilter);
                arpFilter.connect(g);
                g.connect(this.radioGain);
                osc.start(t);
                osc.stop(t + beat / 4 + 0.01);
                this.radioOscillators.push(osc);
            }

            // Drums
            for (let step = 0; step < 16; step++) {
                const t = barStart + step * (beat / 4);

                // Kick on 1, 3 and some 16th syncopation
                if (step === 0 || step === 8 || step === 6 || step === 13) {
                    const kick = ctx.createOscillator();
                    kick.type = 'sine';
                    kick.frequency.setValueAtTime(180, t);
                    kick.frequency.exponentialRampToValueAtTime(35, t + 0.15);
                    const kG = ctx.createGain();
                    kG.gain.setValueAtTime(0.22, t);
                    kG.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                    kick.connect(kG);
                    kG.connect(this.radioGain);
                    kick.start(t);
                    kick.stop(t + 0.3);
                    this.radioOscillators.push(kick);
                }

                // Clap on beats 2, 4
                if (step === 4 || step === 12) {
                    const clapBuf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
                    const cD = clapBuf.getChannelData(0);
                    for (let i = 0; i < cD.length; i++) cD[i] = (Math.random() * 2 - 1) * Math.exp(-i / (cD.length * 0.2));
                    const cSrc = ctx.createBufferSource();
                    cSrc.buffer = clapBuf;
                    const cF = ctx.createBiquadFilter();
                    cF.type = 'bandpass';
                    cF.frequency.value = 1500;
                    cF.Q.value = 2;
                    const cG = ctx.createGain();
                    cG.gain.setValueAtTime(0.1, t);
                    cSrc.connect(cF);
                    cF.connect(cG);
                    cG.connect(this.radioGain);
                    cSrc.start(t);
                    this.radioOscillators.push(cSrc);
                }

                // Hi-hat on every 16th
                if (step % 2 === 0) {
                    const hBuf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
                    const hD = hBuf.getChannelData(0);
                    for (let i = 0; i < hD.length; i++) hD[i] = (Math.random() * 2 - 1) * Math.exp(-i / (hD.length * 0.1));
                    const hSrc = ctx.createBufferSource();
                    hSrc.buffer = hBuf;
                    const hF = ctx.createBiquadFilter();
                    hF.type = 'highpass';
                    hF.frequency.value = 8000;
                    const hG = ctx.createGain();
                    hG.gain.setValueAtTime(0.04, t);
                    hSrc.connect(hF);
                    hF.connect(hG);
                    hG.connect(this.radioGain);
                    hSrc.start(t);
                    this.radioOscillators.push(hSrc);
                }
            }
        }

        this._radioLoopTimer = setTimeout(() => {
            if (this.currentStation === 1) {
                this.stopRadio();
                this._playSynthWave();
            }
        }, totalBars * barLen * 1000);
    }

    _playDrumAndBass() {
        // D&B: fast breakbeat, reese bass, atmospheric pads
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const bpm = 174;
        const beat = 60 / bpm;
        const barLen = beat * 4;
        const totalBars = 32;

        // Bass notes (reese bass)
        const bassNotes = [55, 44, 49, 37]; // A1, F#1, C#2, D1

        for (let bar = 0; bar < totalBars; bar++) {
            const barStart = now + bar * barLen;
            const root = bassNotes[bar % bassNotes.length];

            // Reese bass - two detuned saws
            for (const detune of [-10, 10]) {
                const bass = ctx.createOscillator();
                bass.type = 'sawtooth';
                bass.frequency.value = root;
                bass.detune.value = detune;
                const bF = ctx.createBiquadFilter();
                bF.type = 'lowpass';
                bF.frequency.setValueAtTime(400, barStart);
                bF.frequency.linearRampToValueAtTime(150, barStart + barLen);
                bF.Q.value = 3;
                const bG = ctx.createGain();
                bG.gain.setValueAtTime(0, barStart);
                bG.gain.linearRampToValueAtTime(0.08, barStart + 0.05);
                bG.gain.setValueAtTime(0.08, barStart + barLen - 0.05);
                bG.gain.linearRampToValueAtTime(0, barStart + barLen);
                bass.connect(bF);
                bF.connect(bG);
                bG.connect(this.radioGain);
                bass.start(barStart);
                bass.stop(barStart + barLen + 0.01);
                this.radioOscillators.push(bass);
            }

            // Atmospheric pad (soft saw chord)
            if (bar % 4 === 0) {
                const padFreqs = [root * 4, root * 5, root * 6];
                for (const freq of padFreqs) {
                    const pad = ctx.createOscillator();
                    pad.type = 'sine';
                    pad.frequency.value = freq;
                    const pG = ctx.createGain();
                    pG.gain.setValueAtTime(0, barStart);
                    pG.gain.linearRampToValueAtTime(0.015, barStart + barLen);
                    pG.gain.setValueAtTime(0.015, barStart + barLen * 3);
                    pG.gain.linearRampToValueAtTime(0, barStart + barLen * 4);
                    pad.connect(pG);
                    pG.connect(this.radioGain);
                    pad.start(barStart);
                    pad.stop(barStart + barLen * 4 + 0.01);
                    this.radioOscillators.push(pad);
                }
            }

            // Classic breakbeat pattern (amen-style): 16 steps
            // Pattern: K..S..K.K..S..K. (K=kick, S=snare, .=hat)
            const kickSteps =  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0];
            const snareSteps = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1];
            const hatSteps =   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0];

            for (let step = 0; step < 16; step++) {
                const t = barStart + step * (beat / 4);

                if (kickSteps[step]) {
                    const kick = ctx.createOscillator();
                    kick.type = 'sine';
                    kick.frequency.setValueAtTime(200, t);
                    kick.frequency.exponentialRampToValueAtTime(30, t + 0.1);
                    const kG = ctx.createGain();
                    kG.gain.setValueAtTime(0.25, t);
                    kG.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                    kick.connect(kG);
                    kG.connect(this.radioGain);
                    kick.start(t);
                    kick.stop(t + 0.2);
                    this.radioOscillators.push(kick);
                }

                if (snareSteps[step]) {
                    const snBuf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
                    const snD = snBuf.getChannelData(0);
                    for (let i = 0; i < snD.length; i++) snD[i] = (Math.random() * 2 - 1) * Math.exp(-i / (snD.length * 0.25));
                    const snSrc = ctx.createBufferSource();
                    snSrc.buffer = snBuf;
                    const snF = ctx.createBiquadFilter();
                    snF.type = 'highpass';
                    snF.frequency.value = 1500;
                    const snG = ctx.createGain();
                    snG.gain.setValueAtTime(0.12, t);
                    snSrc.connect(snF);
                    snF.connect(snG);
                    snG.connect(this.radioGain);
                    snSrc.start(t);
                    this.radioOscillators.push(snSrc);
                }

                if (hatSteps[step]) {
                    const hBuf = ctx.createBuffer(1, ctx.sampleRate * 0.015, ctx.sampleRate);
                    const hD = hBuf.getChannelData(0);
                    for (let i = 0; i < hD.length; i++) hD[i] = (Math.random() * 2 - 1) * Math.exp(-i / (hD.length * 0.08));
                    const hSrc = ctx.createBufferSource();
                    hSrc.buffer = hBuf;
                    const hF = ctx.createBiquadFilter();
                    hF.type = 'highpass';
                    hF.frequency.value = 9000;
                    const hG = ctx.createGain();
                    hG.gain.setValueAtTime(0.03, t);
                    hSrc.connect(hF);
                    hF.connect(hG);
                    hG.connect(this.radioGain);
                    hSrc.start(t);
                    this.radioOscillators.push(hSrc);
                }
            }
        }

        this._radioLoopTimer = setTimeout(() => {
            if (this.currentStation === 2) {
                this.stopRadio();
                this._playDrumAndBass();
            }
        }, totalBars * barLen * 1000);
    }

    stopRadio() {
        if (this._radioLoopTimer) {
            clearTimeout(this._radioLoopTimer);
            this._radioLoopTimer = null;
        }
        for (const osc of this.radioOscillators) {
            try { osc.stop(); } catch (e) {}
        }
        this.radioOscillators = [];
        if (this.radioGain) {
            try { this.radioGain.disconnect(); } catch (e) {}
            this.radioGain = null;
        }
    }

    getRadioStationName() {
        if (this.currentStation < 0) return 'Radio Off';
        return this.radioStations[this.currentStation] || 'Radio Off';
    }
}
