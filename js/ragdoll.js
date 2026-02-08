// San Claudio - Ragdoll Physics System
// Limb separation on death/explosion, velocity inheritance

export class RagdollManager {
    constructor(game) {
        this.game = game;
        this.ragdolls = [];
        this.maxRagdolls = 10;
    }

    update(dt) {
        for (let i = this.ragdolls.length - 1; i >= 0; i--) {
            const ragdoll = this.ragdolls[i];
            ragdoll.lifetime -= dt;

            if (ragdoll.lifetime <= 0) {
                this.removeRagdoll(i);
                continue;
            }

            // Update each limb
            for (const limb of ragdoll.limbs) {
                // Gravity
                limb.velocity.y -= 9.8 * dt;

                // Apply velocity
                limb.mesh.position.x += limb.velocity.x * dt;
                limb.mesh.position.y += limb.velocity.y * dt;
                limb.mesh.position.z += limb.velocity.z * dt;

                // Rotation from velocity
                limb.mesh.rotation.x += limb.angularVel.x * dt;
                limb.mesh.rotation.z += limb.angularVel.z * dt;

                // Ground collision
                if (limb.mesh.position.y < limb.groundY) {
                    limb.mesh.position.y = limb.groundY;
                    limb.velocity.y *= -0.3; // Bounce with damping
                    limb.velocity.x *= 0.8;
                    limb.velocity.z *= 0.8;
                    limb.angularVel.x *= 0.8;
                    limb.angularVel.z *= 0.8;
                }

                // Building collision
                const collision = this.game.systems.world.checkCollision(
                    limb.mesh.position.x, limb.mesh.position.z, 0.2
                );
                if (collision) {
                    // Bounce off wall
                    limb.velocity.x *= -0.5;
                    limb.velocity.z *= -0.5;
                    limb.mesh.position.x -= limb.velocity.x * dt * 2;
                    limb.mesh.position.z -= limb.velocity.z * dt * 2;
                }

                // Spring constraint to adjacent limbs
                for (const adjacent of limb.connections) {
                    const dx = adjacent.mesh.position.x - limb.mesh.position.x;
                    const dy = adjacent.mesh.position.y - limb.mesh.position.y;
                    const dz = adjacent.mesh.position.z - limb.mesh.position.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    if (dist > limb.maxDist) {
                        const force = (dist - limb.maxDist) * 5;
                        limb.velocity.x += (dx / dist) * force * dt;
                        limb.velocity.y += (dy / dist) * force * dt;
                        limb.velocity.z += (dz / dist) * force * dt;
                    }
                }
            }

            // Fade out near end
            if (ragdoll.lifetime < 0.5) {
                const opacity = ragdoll.lifetime / 0.5;
                for (const limb of ragdoll.limbs) {
                    if (limb.mesh.material) {
                        limb.mesh.material.transparent = true;
                        limb.mesh.material.opacity = opacity;
                    }
                }
            }
        }
    }

    triggerNPCRagdoll(npc, forceDir, isAtomizer) {
        if (!npc.mesh) return;

        // Cap ragdoll count
        if (this.ragdolls.length >= this.maxRagdolls) {
            this.removeRagdoll(0);
        }

        // Hide original NPC mesh
        npc.mesh.visible = false;
        npc.alive = false;

        const pos = npc.mesh.position.clone();
        const force = forceDir || new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            3,
            (Math.random() - 0.5) * 5
        );

        if (isAtomizer) {
            force.y += 10; // Launch into air
        }

        this.createRagdoll(pos, force, npc.mesh);
    }

    triggerPlayerRagdoll(player) {
        const pos = player.position.clone();
        const force = new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            5,
            (Math.random() - 0.5) * 3
        );

        player.model.visible = false;
        this.createRagdoll(pos, force, player.model);
    }

    createRagdoll(position, force, sourceModel) {
        const ragdoll = {
            lifetime: 3.0,
            limbs: []
        };

        // Create limb meshes based on humanoid parts
        const limbDefs = [
            { name: 'head', geo: 'sphere', size: 0.16, offset: { x: 0, y: 1.7, z: 0 }, groundY: 0.16, color: 0xd4a574 },
            { name: 'torso', geo: 'cylinder', size: [0.25, 0.28, 0.6], offset: { x: 0, y: 1.1, z: 0 }, groundY: 0.13, color: 0x4466aa },
            { name: 'leftArm', geo: 'cylinder', size: [0.05, 0.045, 0.55], offset: { x: -0.33, y: 1.15, z: 0 }, groundY: 0.05, color: 0xd4a574 },
            { name: 'rightArm', geo: 'cylinder', size: [0.05, 0.045, 0.55], offset: { x: 0.33, y: 1.15, z: 0 }, groundY: 0.05, color: 0xd4a574 },
            { name: 'leftLeg', geo: 'cylinder', size: [0.065, 0.055, 0.7], offset: { x: -0.1, y: 0.4, z: 0 }, groundY: 0.06, color: 0x333344 },
            { name: 'rightLeg', geo: 'cylinder', size: [0.065, 0.055, 0.7], offset: { x: 0.1, y: 0.4, z: 0 }, groundY: 0.06, color: 0x333344 },
        ];

        const limbs = {};

        for (const def of limbDefs) {
            let geo;
            if (def.geo === 'sphere') {
                geo = new THREE.SphereGeometry(def.size, 6, 6);
            } else {
                geo = new THREE.CylinderGeometry(def.size[0], def.size[1], def.size[2], 6);
            }

            // Try to match source color
            let color = def.color;
            if (sourceModel && sourceModel.userData && sourceModel.userData.parts) {
                // Use color from source
            }

            const mat = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.7
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                position.x + def.offset.x,
                position.y + def.offset.y,
                position.z + def.offset.z
            );
            mesh.castShadow = true;
            this.game.scene.add(mesh);

            const limb = {
                name: def.name,
                mesh: mesh,
                velocity: new THREE.Vector3(
                    force.x + (Math.random() - 0.5) * 3,
                    force.y + Math.random() * 2,
                    force.z + (Math.random() - 0.5) * 3
                ),
                angularVel: new THREE.Vector3(
                    (Math.random() - 0.5) * 8,
                    0,
                    (Math.random() - 0.5) * 8
                ),
                groundY: def.groundY,
                maxDist: 1.0,
                connections: []
            };

            limbs[def.name] = limb;
            ragdoll.limbs.push(limb);
        }

        // Set up spring connections
        const connections = [
            ['head', 'torso'],
            ['torso', 'leftArm'],
            ['torso', 'rightArm'],
            ['torso', 'leftLeg'],
            ['torso', 'rightLeg'],
        ];

        for (const [a, b] of connections) {
            if (limbs[a] && limbs[b]) {
                limbs[a].connections.push(limbs[b]);
                limbs[b].connections.push(limbs[a]);
            }
        }

        this.ragdolls.push(ragdoll);
    }

    removeRagdoll(index) {
        const ragdoll = this.ragdolls[index];
        for (const limb of ragdoll.limbs) {
            this.game.scene.remove(limb.mesh);
            limb.mesh.geometry.dispose();
            limb.mesh.material.dispose();
        }
        this.ragdolls.splice(index, 1);
    }
}
