// San Claudio - Camera System
// Third-person spring-arm follow camera

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

        this.camera.position.copy(this.currentPos);
        this.camera.lookAt(new THREE.Vector3(0, 1.5, 0));
    }

    addShake(intensity) {
        this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 2.0);
    }

    update(dt) {
        if (!dt) return;

        const input = this.game.systems.input;
        const player = this.game.systems.player;

        // Cutscene camera override
        if (this.overridePosition && this.overrideLookAt) {
            this.camera.position.lerp(this.overridePosition, dt * 3);
            const lookTarget = new THREE.Vector3();
            lookTarget.lerpVectors(
                this.camera.getWorldDirection(new THREE.Vector3()).add(this.camera.position),
                this.overrideLookAt,
                dt * 3
            );
            this.camera.lookAt(this.overrideLookAt);
            return;
        }

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

        // Camera floor clamp - never below y=1.5
        this.targetPos.y = Math.max(1.5, this.targetPos.y);

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
                    this.targetPos.y = Math.max(1.5, this.targetPos.y);
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
                        this.targetPos.y = Math.max(1.5, this.targetPos.y);
                        break;
                    }
                }
            }
        }

        // Spring interpolation
        this.currentPos.lerp(this.targetPos, Math.min(1, this.smoothSpeed * dt));
        this.currentPos.y = Math.max(1.5, this.currentPos.y);
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
