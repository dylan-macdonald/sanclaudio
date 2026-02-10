// San Claudio - Camera System
// Third-person spring-arm follow camera + dev free-fly camera

export class CameraController {
    constructor(game) {
        this.game = game;
        this.camera = new THREE.PerspectiveCamera(
            65,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        // Camera orbit angles
        this.yaw = 0;    // Horizontal rotation
        this.pitch = 0.3; // Vertical (looking down slightly)

        // Camera modes
        this.onFootDistance = 7.5;
        this.onFootHeight = 2.8;
        this.vehicleDistance = 13;
        this.vehicleHeight = 4.5;

        // Current interpolated values
        this.currentDistance = this.onFootDistance;
        this.currentHeight = this.onFootHeight;

        // Spring-arm
        this.targetPos = new THREE.Vector3();
        this.currentPos = new THREE.Vector3(0, 5, 10);
        this.smoothSpeed = 5;

        // Y-axis inversion (false = natural/non-inverted)
        this.invertY = false;

        // Cutscene override
        this.overridePosition = null;
        this.overrideLookAt = null;

        // Screen shake
        this.shakeIntensity = 0;
        this.shakeDecay = 8; // How fast shake fades

        // ─── Dev Camera ─────────────────────────────────────────
        this.devCamActive = false;
        this.devCamPos = new THREE.Vector3(0, 50, 0);
        this.devCamYaw = 0;
        this.devCamPitch = -0.5; // Looking down
        this.devCamSpeed = 50; // Units per second
        this.devCamSpeedMin = 5;
        this.devCamSpeedMax = 500;

        // Camera presets (up to 10 slots)
        this.presets = {};

        this.camera.position.copy(this.currentPos);
        this.camera.lookAt(new THREE.Vector3(0, 1.5, 0));
    }

    addShake(intensity) {
        this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 2.0);
    }

    // ─── Dev Camera Toggle ──────────────────────────────────────
    toggleDevCam() {
        this.devCamActive = !this.devCamActive;
        if (this.devCamActive) {
            // Initialize dev cam at current camera position
            this.devCamPos.copy(this.camera.position);
            this.devCamYaw = this.yaw;
            this.devCamPitch = this.pitch;
        }
        return this.devCamActive;
    }

    // ─── Dev Camera Update ──────────────────────────────────────
    updateDevCam(dt) {
        const input = this.game.systems.input;
        const keys = input.keys;

        // Mouse look (yaw/pitch)
        this.devCamYaw -= input.lookX * dt * 2;
        this.devCamPitch += input.lookY * dt * 2;
        this.devCamPitch = Math.max(-1.5, Math.min(1.5, this.devCamPitch));

        // Speed adjustment via scroll (handled by devtools scroll listener)

        // Movement direction vectors
        const forward = new THREE.Vector3(
            -Math.sin(this.devCamYaw) * Math.cos(this.devCamPitch),
            -Math.sin(this.devCamPitch),
            -Math.cos(this.devCamYaw) * Math.cos(this.devCamPitch)
        ).normalize();

        const right = new THREE.Vector3(
            -Math.cos(this.devCamYaw),
            0,
            Math.sin(this.devCamYaw)
        ).normalize();

        const up = new THREE.Vector3(0, 1, 0);

        // Speed multiplier: shift = fast, ctrl = slow
        let speed = this.devCamSpeed;
        if (keys['ShiftLeft'] || keys['ShiftRight']) speed *= 3;
        if (keys['ControlLeft'] || keys['ControlRight']) speed *= 0.2;

        const move = speed * dt;

        // WASD + QE movement
        if (keys['KeyW']) this.devCamPos.addScaledVector(forward, move);
        if (keys['KeyS']) this.devCamPos.addScaledVector(forward, -move);
        if (keys['KeyA']) this.devCamPos.addScaledVector(right, -move);
        if (keys['KeyD']) this.devCamPos.addScaledVector(right, move);
        if (keys['KeyQ'] || keys['Space']) this.devCamPos.addScaledVector(up, move);
        if (keys['KeyE'] || keys['KeyC']) this.devCamPos.addScaledVector(up, -move);

        // Apply position and look direction
        this.camera.position.copy(this.devCamPos);
        const lookTarget = this.devCamPos.clone().add(forward);
        this.camera.lookAt(lookTarget);
        this.camera.updateProjectionMatrix();
    }

    // ─── Camera Presets ─────────────────────────────────────────
    savePreset(slot) {
        this.presets[slot] = {
            pos: this.camera.position.clone(),
            yaw: this.devCamActive ? this.devCamYaw : this.yaw,
            pitch: this.devCamActive ? this.devCamPitch : this.pitch,
            devCam: this.devCamActive,
            speed: this.devCamSpeed
        };
        return this.presets[slot];
    }

    loadPreset(slot) {
        const p = this.presets[slot];
        if (!p) return null;

        if (p.devCam && !this.devCamActive) this.toggleDevCam();
        if (!p.devCam && this.devCamActive) this.toggleDevCam();

        if (this.devCamActive) {
            this.devCamPos.copy(p.pos);
            this.devCamYaw = p.yaw;
            this.devCamPitch = p.pitch;
            this.devCamSpeed = p.speed;
        } else {
            this.currentPos.copy(p.pos);
            this.yaw = p.yaw;
            this.pitch = p.pitch;
        }
        return p;
    }

    update(dt) {
        if (!dt) return;

        // Dev camera mode — bypass all game camera logic
        if (this.devCamActive) {
            this.updateDevCam(dt);
            return;
        }

        const input = this.game.systems.input;
        const player = this.game.systems.player;

        // Cutscene camera override
        if (this.overridePosition && this.overrideLookAt) {
            this.camera.position.lerp(this.overridePosition, dt * 3);
            // Smoothly interpolate look target for cinematic transitions
            if (!this._cutsceneLookTarget) this._cutsceneLookTarget = this.overrideLookAt.clone();
            this._cutsceneLookTarget.lerp(this.overrideLookAt, dt * 3);
            this.camera.lookAt(this._cutsceneLookTarget);
            return;
        }
        this._cutsceneLookTarget = null;

        // Camera rotation from input
        this.yaw -= input.lookX * dt * 2;
        this.pitch += input.lookY * dt * 2 * (this.invertY ? -1 : 1);
        this.pitch = Math.max(-0.5, Math.min(1.2, this.pitch)); // Clamp vertical

        // Determine target distance/height based on mode
        const inVehicle = player.inVehicle;
        const targetDist = inVehicle ? this.vehicleDistance : this.onFootDistance;
        const targetHeight = inVehicle ? this.vehicleHeight : this.onFootHeight;

        this.currentDistance += (targetDist - this.currentDistance) * dt * 3;
        this.currentHeight += (targetHeight - this.currentHeight) * dt * 3;

        // Calculate target camera position
        const playerPos = player.position;
        const offset = new THREE.Vector3(
            Math.sin(this.yaw) * Math.cos(this.pitch) * this.currentDistance,
            Math.sin(this.pitch) * this.currentDistance + this.currentHeight,
            Math.cos(this.yaw) * Math.cos(this.pitch) * this.currentDistance
        );

        this.targetPos.set(
            playerPos.x + offset.x,
            playerPos.y + offset.y,
            playerPos.z + offset.z
        );

        // Camera floor clamp - terrain-relative
        const terrainY = this.game.systems.world ? this.game.systems.world.getTerrainHeight(playerPos.x, playerPos.z) : 0;
        this.targetPos.y = Math.max(terrainY + 1.0, this.targetPos.y);

        // Building collision - raycast from player to camera, pull closer if blocked
        const lookTarget = new THREE.Vector3(
            playerPos.x,
            playerPos.y + 1.5,
            playerPos.z
        );
        const physics = this.game.systems.physics;
        if (physics && physics.ready) {
            // Rapier raycast from look target toward camera
            const camDir = new THREE.Vector3().subVectors(this.targetPos, lookTarget);
            const camDist = camDir.length();
            if (camDist > 0.1) {
                const dir = camDir.clone().normalize();
                const hit = physics.castRayStatic(
                    { x: lookTarget.x, y: lookTarget.y, z: lookTarget.z },
                    { x: dir.x, y: dir.y, z: dir.z },
                    camDist
                );
                if (hit && hit.toi < camDist) {
                    const safeT = Math.max(0.5, hit.toi - 0.5) / camDist;
                    this.targetPos.set(
                        lookTarget.x + camDir.x * safeT,
                        lookTarget.y + camDir.y * safeT,
                        lookTarget.z + camDir.z * safeT
                    );
                    this.targetPos.y = Math.max(terrainY + 1.0, this.targetPos.y);
                }
            }
        } else {
            // Fallback: 5-step march collision check
            const world = this.game.systems.world;
            if (world) {
                const camDir = new THREE.Vector3().subVectors(this.targetPos, lookTarget);
                const steps = 5;
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const testX = lookTarget.x + camDir.x * t;
                    const testZ = lookTarget.z + camDir.z * t;
                    const collision = world.checkCollision(testX, testZ, 0.5);
                    if (collision && collision.type === 'building') {
                        const safeT = Math.max(0.1, (i - 1) / steps);
                        this.targetPos.set(
                            lookTarget.x + camDir.x * safeT,
                            lookTarget.y + camDir.y * safeT,
                            lookTarget.z + camDir.z * safeT
                        );
                        this.targetPos.y = Math.max(terrainY + 1.0, this.targetPos.y);
                        break;
                    }
                }
            }
        }

        // Spring interpolation
        this.currentPos.lerp(this.targetPos, Math.min(1, this.smoothSpeed * dt));
        this.currentPos.y = Math.max(terrainY + 1.0, this.currentPos.y);
        this.camera.position.copy(this.currentPos);

        // Screen shake
        if (this.shakeIntensity > 0.001) {
            const sx = (Math.random() - 0.5) * 2 * this.shakeIntensity;
            const sy = (Math.random() - 0.5) * 2 * this.shakeIntensity;
            const sz = (Math.random() - 0.5) * 2 * this.shakeIntensity;
            this.camera.position.x += sx;
            this.camera.position.y += sy;
            this.camera.position.z += sz;
            this.shakeIntensity *= Math.exp(-this.shakeDecay * dt);
        }

        // FOV: widen during nitro boost
        const vehicles = this.game.systems.vehicles;
        const targetFov = (vehicles && vehicles.nitroActive) ? 85 : 65;
        this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 5);
        this.camera.updateProjectionMatrix();

        // Look at player
        this.camera.lookAt(lookTarget);
    }

    setCutsceneCamera(position, lookAt) {
        this.overridePosition = position;
        this.overrideLookAt = lookAt;
    }

    clearCutsceneCamera() {
        this.overridePosition = null;
        this.overrideLookAt = null;
    }

    getForwardDirection() {
        // Returns the camera's forward direction on the XZ plane (for player movement)
        const dir = new THREE.Vector3(
            -Math.sin(this.yaw),
            0,
            -Math.cos(this.yaw)
        );
        return dir.normalize();
    }

    getRightDirection() {
        const forward = this.getForwardDirection();
        return new THREE.Vector3(-forward.z, 0, forward.x);
    }
}
