// San Claudio - Cutscene System
// Camera rails, letterbox bars, dialogue with Animalese, transitions

export class CutsceneManager {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.dialogueQueue = [];
        this.currentDialogue = null;
        this.typewriterIndex = 0;
        this.typewriterTimer = 0;
        this.typewriterSpeed = 30; // ms per char
        this.autoAdvanceTimer = 0;
        this.onComplete = null;

        // Camera rail
        this.cameraKeyframes = [];
        this.cameraTime = 0;
        this.cameraDuration = 0;

        // Letterbox
        this.letterboxTop = document.getElementById('letterbox-top');
        this.letterboxBottom = document.getElementById('letterbox-bottom');

        // Dialogue elements
        this.dialogueBox = document.getElementById('hud-dialogue');
        this.dialogueName = document.getElementById('dialogue-name');
        this.dialogueText = document.getElementById('dialogue-text');

        // Character colors
        this.characterColors = {
            marco: '#ffffff',
            sal: '#ff8844',
            nina: '#ff66aa',
            vex: '#44ff88',
            reyes: '#ff4444',
            cop: '#6688ff'
        };

        this.setupInput();
    }

    setupInput() {
        document.addEventListener('keydown', (e) => {
            if (!this.active) return;
            if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
                this.advanceDialogue();
            }
        });

        document.addEventListener('click', () => {
            if (this.active) {
                this.advanceDialogue();
            }
        });
    }

    update(dt) {
        if (!this.active) return;

        // Update camera rail
        if (this.cameraKeyframes.length > 0) {
            this.updateCameraRail(dt);
        }

        // Update typewriter
        if (this.currentDialogue) {
            this.typewriterTimer += dt * 1000;
            while (this.typewriterTimer >= this.typewriterSpeed && this.typewriterIndex < this.currentDialogue.text.length) {
                this.typewriterTimer -= this.typewriterSpeed;
                this.typewriterIndex++;
                this.dialogueText.textContent = this.currentDialogue.text.substring(0, this.typewriterIndex);
            }

            // Auto-advance after full text shown
            if (this.typewriterIndex >= this.currentDialogue.text.length) {
                this.autoAdvanceTimer += dt;
                if (this.autoAdvanceTimer >= 3) {
                    this.advanceDialogue();
                }
            }
        }
    }

    // Play a sequence of dialogue lines
    playDialogueSequence(lines, onComplete) {
        this.dialogueQueue = [...lines];
        this.onComplete = onComplete;
        this.active = true;

        // Show letterbox
        this.letterboxTop.classList.add('active');
        this.letterboxBottom.classList.add('active');

        // Show dialogue box
        this.dialogueBox.style.display = 'block';

        // Disable player input
        this.game.setState('cutscene');

        // Start first line
        this.showNextDialogue();
    }

    showNextDialogue() {
        if (this.dialogueQueue.length === 0) {
            this.endCutscene();
            return;
        }

        this.currentDialogue = this.dialogueQueue.shift();
        this.typewriterIndex = 0;
        this.typewriterTimer = 0;
        this.autoAdvanceTimer = 0;

        // Set character name and color
        const name = this.currentDialogue.speaker || 'Unknown';
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        this.dialogueName.textContent = displayName + ': ';
        this.dialogueName.style.color = this.characterColors[name] || '#ffffff';
        this.dialogueText.textContent = '';

        // Play Animalese voice
        const audio = this.game.systems.audio;
        if (audio) {
            const voiceProfiles = {
                marco: { pitch: 180, modifier: 'normal' },
                sal: { pitch: 120, modifier: 'normal' },
                nina: { pitch: 280, modifier: 'normal' },
                vex: { pitch: 220, modifier: 'normal' },
                reyes: { pitch: 140, modifier: 'authoritative' },
            };
            const profile = voiceProfiles[name] || { pitch: 170, modifier: 'normal' };
            audio.playAnimalese(this.currentDialogue.text, profile.pitch, profile.modifier);
        }
    }

    advanceDialogue() {
        if (!this.currentDialogue) return;

        // If still typing, show full text
        if (this.typewriterIndex < this.currentDialogue.text.length) {
            this.typewriterIndex = this.currentDialogue.text.length;
            this.dialogueText.textContent = this.currentDialogue.text;
            this.autoAdvanceTimer = 0;
            return;
        }

        // Next line
        this.showNextDialogue();
    }

    endCutscene() {
        this.active = false;
        this.currentDialogue = null;

        // Hide letterbox
        this.letterboxTop.classList.remove('active');
        this.letterboxBottom.classList.remove('active');

        // Hide dialogue
        this.dialogueBox.style.display = 'none';

        // Restore game state
        this.game.setState('playing');

        // Clear camera override
        this.game.systems.camera.clearCutsceneCamera();

        // Callback
        if (this.onComplete) {
            this.onComplete();
            this.onComplete = null;
        }
    }

    // Camera rail system
    playCameraRail(keyframes, onComplete) {
        this.cameraKeyframes = keyframes;
        this.cameraTime = 0;
        this.cameraDuration = keyframes.reduce((sum, kf) => sum + kf.duration, 0);
        this.active = true;
        this.onComplete = onComplete;

        this.game.setState('cutscene');
        this.letterboxTop.classList.add('active');
        this.letterboxBottom.classList.add('active');
    }

    updateCameraRail(dt) {
        this.cameraTime += dt;

        // Find current keyframe
        let elapsed = 0;
        for (let i = 0; i < this.cameraKeyframes.length - 1; i++) {
            const kf = this.cameraKeyframes[i];
            const nextKf = this.cameraKeyframes[i + 1];

            if (this.cameraTime >= elapsed && this.cameraTime < elapsed + kf.duration) {
                const t = (this.cameraTime - elapsed) / kf.duration;

                // Lerp position
                const pos = new THREE.Vector3().lerpVectors(
                    new THREE.Vector3(kf.position.x, kf.position.y, kf.position.z),
                    new THREE.Vector3(nextKf.position.x, nextKf.position.y, nextKf.position.z),
                    t
                );

                // Lerp lookAt
                const lookAt = new THREE.Vector3().lerpVectors(
                    new THREE.Vector3(kf.lookAt.x, kf.lookAt.y, kf.lookAt.z),
                    new THREE.Vector3(nextKf.lookAt.x, nextKf.lookAt.y, nextKf.lookAt.z),
                    t
                );

                this.game.systems.camera.setCutsceneCamera(pos, lookAt);
                return;
            }

            elapsed += kf.duration;
        }

        // Rail complete
        if (this.cameraTime >= this.cameraDuration) {
            this.cameraKeyframes = [];
            this.endCutscene();
        }
    }

    // Fade transitions
    fadeToBlack(duration, callback) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000;opacity:0;transition:opacity ${duration}s;z-index:200;pointer-events:none;`;
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            setTimeout(() => {
                if (callback) callback();
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), duration * 1000);
            }, duration * 1000);
        });
    }

    // Smash cut (instant black flash)
    smashCut(callback) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000;z-index:200;pointer-events:none;';
        document.body.appendChild(overlay);

        setTimeout(() => {
            if (callback) callback();
            overlay.remove();
        }, 100);
    }
}
