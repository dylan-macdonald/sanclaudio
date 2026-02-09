// San Claudio - Physics Manager
// Rapier.js 3D physics: static colliders, character controller, raycasting

import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

// Collision group bitmasks
export const CollisionGroups = {
    STATIC:     0x0001,
    PLAYER:     0x0002,
    VEHICLE:    0x0004,
    NPC:        0x0008,
    PROJECTILE: 0x0010
};

// Helper: pack membership + filter into u32 for Rapier
function interactionGroups(membership, filter) {
    return (membership << 16) | filter;
}

export class PhysicsManager {
    constructor(game) {
        this.game = game;
        this.world = null;
        this.eventQueue = null;
        this.ready = false;
        this.characterController = null;
        this.bodyHandleMap = new Map();
        this.vehicleBodies = new Map();
    }

    async init() {
        await RAPIER.init();
        this.world = new RAPIER.World({ x: 0, y: -20, z: 0 });
        this.eventQueue = new RAPIER.EventQueue(true);

        // Heightfield ground — built from world.getTerrainHeight()
        // Deferred until world system is ready; use flat ground as fallback
        this._groundBody = null;
        this._groundCollider = null;
        this._createFlatGround(); // temporary until buildTerrainHeightfield() is called

        // Character controller for player
        this.characterController = this.world.createCharacterController(0.1);
        this.characterController.setMaxSlopeClimbAngle(45 * Math.PI / 180);
        this.characterController.setMinSlopeSlideAngle(30 * Math.PI / 180);
        this.characterController.enableAutostep(0.5, 0.2, true);
        this.characterController.enableSnapToGround(0.5);
        this.ready = true;
    }

    step(dt) {
        if (!this.ready) return;
        this.world.timestep = Math.min(dt, 0.05);
        this.world.step(this.eventQueue);
        this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
            this._handleCollisionEvent(handle1, handle2, started);
        });
        this.eventQueue.drainContactForceEvents(() => {});
    }

    _createFlatGround() {
        const groundDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
        this._groundBody = this.world.createRigidBody(groundDesc);
        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(400, 0.5, 400)
            .setCollisionGroups(interactionGroups(
                CollisionGroups.STATIC,
                CollisionGroups.PLAYER | CollisionGroups.VEHICLE | CollisionGroups.NPC | CollisionGroups.PROJECTILE
            ));
        this._groundCollider = this.world.createCollider(groundColliderDesc, this._groundBody);
        this.bodyHandleMap.set(this._groundBody.handle, { type: 'static', ref: null });
    }

    // Call after world system is ready. Replaces flat ground with a heightfield.
    buildTerrainHeightfield(getHeightFn, mapSize) {
        if (!this.ready) return;

        // Remove old flat ground
        if (this._groundCollider) {
            this.world.removeCollider(this._groundCollider, false);
        }
        if (this._groundBody) {
            this.bodyHandleMap.delete(this._groundBody.handle);
            this.world.removeRigidBody(this._groundBody);
        }

        // Build heightfield data: Rapier heightfield is nrows x ncols
        // Heights are row-major, indexed [row * ncols + col]
        const res = 80; // 80x80 grid over the map
        const nrows = res + 1;
        const ncols = res + 1;
        const heights = new Float32Array(nrows * ncols);
        const cellW = mapSize / res; // width per cell in X
        const cellH = mapSize / res; // height per cell in Z
        const halfMap = mapSize / 2;

        for (let row = 0; row < nrows; row++) {
            for (let col = 0; col < ncols; col++) {
                // Map row/col to world X/Z
                const x = -halfMap + col * cellW;
                const z = -halfMap + row * cellH;
                heights[row * ncols + col] = getHeightFn(x, z);
            }
        }

        // Create heightfield body at center of map
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
        this._groundBody = this.world.createRigidBody(bodyDesc);

        // Rapier heightfield: scale = (totalX, 1.0, totalZ), heights are absolute
        const heightfieldDesc = RAPIER.ColliderDesc.heightfield(
            nrows - 1, ncols - 1, heights, { x: mapSize, y: 1.0, z: mapSize }
        ).setCollisionGroups(interactionGroups(
            CollisionGroups.STATIC,
            CollisionGroups.PLAYER | CollisionGroups.VEHICLE | CollisionGroups.NPC | CollisionGroups.PROJECTILE
        ));
        this._groundCollider = this.world.createCollider(heightfieldDesc, this._groundBody);
        this.bodyHandleMap.set(this._groundBody.handle, { type: 'static', ref: null });
    }

    // Raycast straight down to find ground height at (x, z). Returns Y or 0.
    // Uses world raycast with predicate to hit only the ground heightfield.
    getGroundHeight(x, z) {
        if (!this.ready) return 0;
        const ray = new RAPIER.Ray({ x, y: 50, z }, { x: 0, y: -1, z: 0 });
        const groundHandle = this._groundCollider ? this._groundCollider.handle : -1;
        const hit = this.world.castRay(ray, 100, true, undefined, undefined, undefined, undefined,
            (collider) => collider.handle === groundHandle
        );
        if (hit) {
            const t = hit.timeOfImpact !== undefined ? hit.timeOfImpact : hit.toi;
            if (t >= 0) return 50 - t;
        }
        // Fallback to world terrain function
        if (this.game.systems.world) {
            return this.game.systems.world.getTerrainHeight(x, z);
        }
        return 0;
    }

    _handleCollisionEvent(handle1, handle2, started) {
        const collider1 = this.world.getCollider(handle1);
        const collider2 = this.world.getCollider(handle2);
        if (!collider1 || !collider2) return;
        const body1 = collider1.parent();
        const body2 = collider2.parent();
        if (!body1 || !body2) return;
        const info1 = this.bodyHandleMap.get(body1.handle);
        const info2 = this.bodyHandleMap.get(body2.handle);
        if (started && info1 && info2) {
            if (info1.type === 'vehicle' && info2.type === 'static') {
                this._onVehicleBuildingHit(info1.ref);
            } else if (info2.type === 'vehicle' && info1.type === 'static') {
                this._onVehicleBuildingHit(info2.ref);
            }
            if (info1.type === 'vehicle' && info2.type === 'vehicle') {
                this._onVehicleVehicleHit(info1.ref, info2.ref);
            }
        }
    }

    _onVehicleBuildingHit(vehicle) { vehicle.speed *= -0.3; }

    _onVehicleVehicleHit(v1, v2) {
        const tempSpeed = v1.speed;
        v1.speed = v2.speed * 0.5;
        v2.speed = tempSpeed * 0.5;
    }

    createStaticCuboid(minX, maxX, minZ, maxZ, height, yOffset = 0) {
        if (!this.ready) return null;
        const halfW = (maxX - minX) / 2;
        const halfH = height / 2;
        const halfD = (maxZ - minZ) / 2;
        const cx = (minX + maxX) / 2;
        const cy = halfH + yOffset;
        const cz = (minZ + maxZ) / 2;
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz);
        const body = this.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
            .setCollisionGroups(interactionGroups(
                CollisionGroups.STATIC,
                CollisionGroups.PLAYER | CollisionGroups.VEHICLE | CollisionGroups.NPC | CollisionGroups.PROJECTILE
            ))
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        this.world.createCollider(colliderDesc, body);
        this.bodyHandleMap.set(body.handle, { type: 'static', ref: null });
        return body;
    }

    createPlayerCapsule(position) {
        if (!this.ready) return null;
        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(position.x, position.y + 0.9, position.z);
        const body = this.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.4)
            .setCollisionGroups(interactionGroups(
                CollisionGroups.PLAYER,
                CollisionGroups.STATIC | CollisionGroups.VEHICLE
            ));
        const collider = this.world.createCollider(colliderDesc, body);
        this.bodyHandleMap.set(body.handle, { type: 'player', ref: null });
        return { body, collider };
    }

    createVehicleBody(vehicle, vType) {
        if (!this.ready) return null;
        const pos = vehicle.mesh.position;
        const bodyDesc = RAPIER.RigidBodyDesc.kinematicVelocityBased()
            .setTranslation(pos.x, pos.y + vType.height / 2, pos.z);
        const body = this.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(vType.width / 2, vType.height / 2, vType.length / 2)
            .setCollisionGroups(interactionGroups(
                CollisionGroups.VEHICLE,
                CollisionGroups.STATIC | CollisionGroups.PLAYER | CollisionGroups.VEHICLE | CollisionGroups.NPC
            ))
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        this.world.createCollider(colliderDesc, body);
        this.bodyHandleMap.set(body.handle, { type: 'vehicle', ref: vehicle });
        this.vehicleBodies.set(vehicle, body);
        return { body, collider: colliderDesc };
    }

    moveCharacter(collider, desiredTranslation) {
        if (!this.ready || !this.characterController) return desiredTranslation;
        this.characterController.computeColliderMovement(collider, desiredTranslation);
        const corrected = this.characterController.computedMovement();
        return { x: corrected.x, y: corrected.y, z: corrected.z };
    }

    isCharacterGrounded() {
        if (!this.characterController) return true;
        return this.characterController.computedGrounded();
    }

    castRay(origin, direction, maxToi, filterGroups) {
        if (!this.ready) return null;
        const ray = new RAPIER.Ray(origin, direction);
        const hit = this.world.castRay(ray, maxToi, true, filterGroups !== undefined ? filterGroups : undefined);
        if (hit) {
            const t = hit.timeOfImpact !== undefined ? hit.timeOfImpact : hit.toi;
            return {
                toi: t,
                point: {
                    x: origin.x + direction.x * t,
                    y: origin.y + direction.y * t,
                    z: origin.z + direction.z * t
                },
                collider: hit
            };
        }
        return null;
    }

    castRayStatic(origin, direction, maxToi) {
        return this.castRay(origin, direction, maxToi, interactionGroups(0xFFFF, CollisionGroups.STATIC));
    }

    setVehicleLinvel(vehicle, linvel) {
        const body = this.vehicleBodies.get(vehicle);
        if (body) body.setLinvel(linvel, true);
    }

    setVehicleAngvel(vehicle, angvel) {
        const body = this.vehicleBodies.get(vehicle);
        if (body) body.setAngvel(angvel, true);
    }

    getVehiclePosition(vehicle) {
        const body = this.vehicleBodies.get(vehicle);
        if (!body) return null;
        return body.translation();
    }

    getVehicleRotation(vehicle) {
        const body = this.vehicleBodies.get(vehicle);
        if (!body) return null;
        return body.rotation();
    }
}
