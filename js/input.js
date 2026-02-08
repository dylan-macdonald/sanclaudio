// San Claudio - Unified Input Manager
// Handles keyboard/mouse, gamepad, and touch simultaneously

export class InputManager {
    constructor(game) {
        this.game = game;

        // Merged action states
        this.actions = {};
        this.prevActions = {};

        // Axes: moveX, moveY, lookX, lookY (all -1 to 1)
        this.moveX = 0;
        this.moveY = 0;
        this.lookX = 0;
        this.lookY = 0;

        // Raw input sources
        this.keys = {};
        this.mouseButtons = {};
        this.mouseDX = 0;
        this.mouseDY = 0;
        this.pointerLocked = false;

        // Gamepad
        this.gamepadIndex = -1;
        this.gamepadDeadzone = 0.15;

        // Touch
        this.touchJoystick = { active: false, rawX: 0, rawY: 0 };
        this.touchLook = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
        this.touchButtons = {};

        this.setupKeyboard();
        this.setupMouse();
        this.setupGamepad();
        this.setupTouch();
    }

    // --- Keyboard ---
    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Don't capture when dev console is focused
            const consoleInput = document.getElementById('console-input');
            if (document.activeElement === consoleInput) return;
            this.keys[e.code] = true;
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    // --- Mouse ---
    setupMouse() {
        const canvas = document.getElementById('game-canvas');

        canvas.addEventListener('click', () => {
            if (!this.pointerLocked && this.game.state === 'playing') {
                canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.pointerLocked = document.pointerLockElement === canvas;
        });

        document.addEventListener('mousemove', (e) => {
            if (this.pointerLocked) {
                this.mouseDX += e.movementX;
                this.mouseDY += e.movementY;
            }
        });

        document.addEventListener('mousedown', (e) => {
            this.mouseButtons[e.button] = true;
        });

        document.addEventListener('mouseup', (e) => {
            this.mouseButtons[e.button] = false;
        });

        // Scroll wheel for weapon cycling
        document.addEventListener('wheel', (e) => {
            if (e.deltaY > 0) this.actions.weaponNext = true;
            else if (e.deltaY < 0) this.actions.weaponPrev = true;
        });
    }

    // --- Gamepad ---
    setupGamepad() {
        window.addEventListener('gamepadconnected', (e) => {
            this.gamepadIndex = e.gamepad.index;
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            if (e.gamepad.index === this.gamepadIndex) {
                this.gamepadIndex = -1;
            }
        });
    }

    applyDeadzone(value) {
        if (Math.abs(value) < this.gamepadDeadzone) return 0;
        const sign = Math.sign(value);
        return sign * (Math.abs(value) - this.gamepadDeadzone) / (1 - this.gamepadDeadzone);
    }

    // --- Touch ---
    setupTouch() {
        const joystickZone = document.getElementById('touch-joystick-zone');
        const joystickBase = document.getElementById('touch-joystick-base');
        const joystickThumb = document.getElementById('touch-joystick-thumb');

        if (!joystickZone) return;

        let joystickTouch = null;
        const baseRect = { cx: 60, cy: 60, radius: 50 };

        joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            joystickTouch = touch.identifier;
            this.touchJoystick.active = true;
        });

        joystickZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                if (touch.identifier === joystickTouch) {
                    const rect = joystickBase.getBoundingClientRect();
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    const dx = touch.clientX - cx;
                    const dy = touch.clientY - cy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const maxDist = rect.width / 2;
                    const clampedDist = Math.min(dist, maxDist);
                    const angle = Math.atan2(dy, dx);

                    this.touchJoystick.rawX = (clampedDist / maxDist) * Math.cos(angle);
                    this.touchJoystick.rawY = (clampedDist / maxDist) * Math.sin(angle);

                    // Visual feedback
                    const thumbX = (clampedDist * Math.cos(angle));
                    const thumbY = (clampedDist * Math.sin(angle));
                    joystickThumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;
                }
            }
        });

        const endJoystick = (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === joystickTouch) {
                    joystickTouch = null;
                    this.touchJoystick.active = false;
                    this.touchJoystick.rawX = 0;
                    this.touchJoystick.rawY = 0;
                    joystickThumb.style.transform = 'translate(-50%, -50%)';
                }
            }
        };

        joystickZone.addEventListener('touchend', endJoystick);
        joystickZone.addEventListener('touchcancel', endJoystick);

        // Touch look (right half of screen)
        let lookTouch = null;
        const canvas = document.getElementById('game-canvas');

        canvas.addEventListener('touchstart', (e) => {
            for (const touch of e.changedTouches) {
                if (touch.clientX > window.innerWidth / 2) {
                    lookTouch = touch.identifier;
                    this.touchLook.active = true;
                    this.touchLook.startX = touch.clientX;
                    this.touchLook.startY = touch.clientY;
                }
            }
        });

        canvas.addEventListener('touchmove', (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === lookTouch) {
                    this.touchLook.dx = (touch.clientX - this.touchLook.startX) * 0.3;
                    this.touchLook.dy = (touch.clientY - this.touchLook.startY) * 0.3;
                    this.touchLook.startX = touch.clientX;
                    this.touchLook.startY = touch.clientY;
                }
            }
        });

        const endLook = (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === lookTouch) {
                    lookTouch = null;
                    this.touchLook.active = false;
                    this.touchLook.dx = 0;
                    this.touchLook.dy = 0;
                }
            }
        };

        canvas.addEventListener('touchend', endLook);
        canvas.addEventListener('touchcancel', endLook);

        // Touch buttons
        const buttonMap = {
            'touch-jump': 'jump',
            'touch-attack': 'attack',
            'touch-interact': 'interact',
            'touch-vehicle': 'interact', // Same action, context-dependent
            'touch-grenade': 'grenade',
            'touch-weapon': 'weaponNext',
            'touch-map': 'map'
        };

        for (const [id, action] of Object.entries(buttonMap)) {
            const btn = document.getElementById(id);
            if (!btn) continue;
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.touchButtons[action] = true;
            });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.touchButtons[action] = false;
            });
        }
    }

    // --- Update (called every frame) ---
    update() {
        // Store previous frame actions
        this.prevActions = { ...this.actions };

        // Reset per-frame scroll/weapon actions so justPressed works each frame
        this.actions.weaponNext = false;
        this.actions.weaponPrev = false;
        this.actions.weaponSelect = 0;

        // Reset per-frame axes
        let kbMoveX = 0, kbMoveY = 0;
        let gpMoveX = 0, gpMoveY = 0;
        let gpLookX = 0, gpLookY = 0;

        // Keyboard movement
        if (this.keys['KeyW'] || this.keys['ArrowUp']) kbMoveY = 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) kbMoveY = -1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) kbMoveX = -1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) kbMoveX = 1;

        // Gamepad
        if (this.gamepadIndex >= 0) {
            const gamepads = navigator.getGamepads();
            const gp = gamepads[this.gamepadIndex];
            if (gp) {
                gpMoveX = this.applyDeadzone(gp.axes[0]);
                gpMoveY = -this.applyDeadzone(gp.axes[1]); // Negate Y ONCE here
                gpLookX = this.applyDeadzone(gp.axes[2] || 0);
                gpLookY = this.applyDeadzone(gp.axes[3] || 0);

                // Gamepad buttons
                this.actions.jump = this.actions.jump || gp.buttons[0]?.pressed;
                this.actions.sprint = this.actions.sprint || gp.buttons[1]?.pressed;
                this.actions.attack = this.actions.attack || gp.buttons[2]?.pressed;
                this.actions.interact = this.actions.interact || gp.buttons[3]?.pressed;
                this.actions.weaponPrev = this.actions.weaponPrev || gp.buttons[4]?.pressed;
                this.actions.weaponNext = this.actions.weaponNext || gp.buttons[5]?.pressed;
                this.actions.aim = this.actions.aim || gp.buttons[6]?.pressed;
                this.actions.accel = gp.buttons[7]?.value || 0; // ZR for vehicle accel
                this.actions.pause = gp.buttons[9]?.pressed;
                this.actions.map = gp.buttons[8]?.pressed;
                this.actions.crouch = gp.buttons[13]?.pressed;
            }
        }

        // Touch joystick movement (negate Y once here)
        const touchMoveX = this.touchJoystick.rawX;
        const touchMoveY = -this.touchJoystick.rawY; // Negate ONCE

        // Merge movement axes (take the largest magnitude from any source)
        this.moveX = Math.abs(kbMoveX) > Math.abs(gpMoveX)
            ? (Math.abs(kbMoveX) > Math.abs(touchMoveX) ? kbMoveX : touchMoveX)
            : (Math.abs(gpMoveX) > Math.abs(touchMoveX) ? gpMoveX : touchMoveX);

        this.moveY = Math.abs(kbMoveY) > Math.abs(gpMoveY)
            ? (Math.abs(kbMoveY) > Math.abs(touchMoveY) ? kbMoveY : touchMoveY)
            : (Math.abs(gpMoveY) > Math.abs(touchMoveY) ? gpMoveY : touchMoveY);

        // Look axes: mouse + gamepad + touch
        this.lookX = this.mouseDX * 0.15 + gpLookX * 3.0 + this.touchLook.dx;
        this.lookY = this.mouseDY * 0.15 + gpLookY * 3.0 + this.touchLook.dy;

        // Reset mouse deltas
        this.mouseDX = 0;
        this.mouseDY = 0;
        this.touchLook.dx = 0;
        this.touchLook.dy = 0;

        // Keyboard/mouse actions
        this.actions.jump = this.keys['Space'] || this.touchButtons.jump || false;
        this.actions.sprint = this.keys['ShiftLeft'] || this.keys['ShiftRight'] || false;
        this.actions.interact = this.keys['KeyE'] || this.touchButtons.interact || false;
        this.actions.attack = this.mouseButtons[0] || this.keys['KeyF'] || this.touchButtons.attack || false;
        this.actions.aim = this.mouseButtons[2] || false;
        this.actions.grenade = this.keys['KeyG'] || this.touchButtons.grenade || false;
        this.actions.weaponCycle = this.keys['KeyQ'] || false;
        this.actions.crouch = this.keys['KeyC'] || false;
        this.actions.horn = this.keys['KeyH'] || false;
        this.actions.radio = this.keys['KeyR'] || false;
        this.actions.pause = this.keys['Escape'] || false;
        this.actions.cancel = this.keys['Escape'] || this.keys['Backspace'] || false;
        this.actions.map = this.keys['KeyM'] || this.touchButtons.map || false;
        this.actions.console = this.keys['Backquote'] || false;
        this.actions.minimapZoom = this.keys['Tab'] || false;
        this.actions.phone = this.keys['KeyT'] || false;

        // Number keys for direct weapon select (1-9)
        for (let n = 1; n <= 9; n++) {
            if (this.keys['Digit' + n]) {
                this.actions.weaponSelect = n;
            }
        }

        // Merge gamepad buttons with touch
        if (this.gamepadIndex >= 0) {
            const gp = navigator.getGamepads()[this.gamepadIndex];
            if (gp) {
                if (gp.buttons[0]?.pressed) this.actions.jump = true;
                if (gp.buttons[1]?.pressed) this.actions.sprint = true;
                if (gp.buttons[2]?.pressed) this.actions.attack = true;
                if (gp.buttons[3]?.pressed) this.actions.interact = true;
            }
        }

        // Debug keys (always active)
        this.actions.f1 = this.keys['F1'] || false;
        this.actions.f2 = this.keys['F2'] || false;
        this.actions.f3 = this.keys['F3'] || false;
        this.actions.f4 = this.keys['F4'] || false;
        this.actions.f5 = this.keys['F5'] || false;
        this.actions.f9 = this.keys['F9'] || false;
    }

    justPressed(action) {
        return this.actions[action] && !this.prevActions[action];
    }

    isDown(action) {
        return !!this.actions[action];
    }
}
