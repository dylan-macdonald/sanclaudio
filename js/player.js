// San Claudio - Player System
// Player model (.glb with skeleton+animations), movement, animation, inventory

export class Player {
    constructor(game) {
        this.game = game;

        // Position and physics
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0; // Y-axis rotation (facing direction)
        this.radius = 0.4;

        // State
        this.health = 100;
        this.maxHealth = 100;
        this.armor = 0;
        this.maxArmor = 100;
        this.cash = 1000;
        this.inVehicle = false;
        this.currentVehicle = null;
        this.isSprinting = false;
        this.isCrouching = false;
        this.isOnGround = true;
        this.isDead = false;
        this.isInInterior = false;

        // Noclip mode
        this.noclip = false;
        this.noclipSpeed = 30;

        // Movement
        this.walkSpeed = 5;
        this.sprintSpeed = 9;
        this.jumpForce = 8;
        this.gravity = 20;

        // Animation
        this.animTime = 0;
        this.animState = 'idle'; // idle, walk, run, sprint, punch, drive

        // Model
        this.model = null;
        this.parts = {}; // Kept for backward compat (ragdoll checks, etc.)

        // Skeleton animation
        this.mixer = null;
        this.actions = {};
        this.currentAction = null;

        // Weapons
        this.weapons = [{ id: 'fists', ammo: Infinity, clipSize: Infinity }];
        this.currentWeaponIndex = 0;

        // Speed multiplier (cheat)
        this.speedMultiplier = 1;

        // Footstep cadence
        this.footstepTimer = 0;
        this.footstepInterval = 0.4; // seconds between footsteps at walk speed

        // Swimming
        this.isSwimming = false;
        this.swimSpeed = 3;
        this.swimSprintSpeed = 5;

        // Custom appearance (clothing shop)
        this.appearance = {
            shirtColor: 0x4466aa,
            pantsColor: 0x333344,
            hasHat: false,
            hasSunglasses: false
        };
        this._hatMesh = null;
        this._sunglassesMesh = null;

        // Outfits
        this.outfits = [
            { name: 'Default', shirt: 0x4466aa, pants: 0x333344, shoes: 0x222222 },
            { name: 'Street', shirt: 0xcc2222, pants: 0x222222, shoes: 0x111111 },
            { name: 'Business', shirt: 0xeeeeee, pants: 0x222233, shoes: 0x332211 },
            { name: 'Casual', shirt: 0x44aa44, pants: 0x556644, shoes: 0x553322 },
            { name: 'Night Out', shirt: 0x111111, pants: 0x111111, shoes: 0x111111 },
            { name: 'Beach', shirt: 0xff8844, pants: 0x4488cc, shoes: 0xddccaa },
            { name: 'Gangster', shirt: 0xffffff, pants: 0x999999, shoes: 0x000000 },
            { name: 'Military', shirt: 0x445533, pants: 0x445533, shoes: 0x222211 }
        ];
        this.currentOutfit = 0;
        this.wardrobeOpen = false;
        this._wardrobeEl = null;
        this._wardrobeNavCooldown = 0;

        // Phone
        this.phoneOpen = false;
        this.phoneSelectedIndex = 0;
        this.phoneContacts = [
            { name: 'Sal (Missions)', action: 'call_sal', icon: 'M' },
            { name: 'Nina (Missions)', action: 'call_nina', icon: 'M' },
            { name: 'Vex (Missions)', action: 'call_vex', icon: 'M' },
            { name: 'Taxi Service', action: 'taxi', icon: 'T' },
            { name: '911 Emergency', action: '911', icon: '!' },
            { name: 'Mechanic', action: 'mechanic', icon: 'W' }
        ];
        this._phoneNavCooldown = 0;
        this._phoneEl = null;
    }

    init() {
        this.createModel();
        this.game.scene.add(this.model);
        this.initPhysics();
    }

    initPhysics() {
        const physics = this.game.systems.physics;
        if (!physics || !physics.ready) return;
        const result = physics.createPlayerCapsule(this.position);
        if (result) {
            this.physicsBody = result.body;
            this.physicsCollider = result.collider;
        }
    }

    createModel() {
        const models = this.game.systems.models;

        // Try to use .glb model
        if (models && models.hasModel('character')) {
            this.model = models.cloneCharacter();

            // Set up AnimationMixer
            const clips = models.getCharacterAnimations();
            if (clips.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.model);

                for (const clip of clips) {
                    const action = this.mixer.clipAction(clip);
                    this.actions[clip.name] = action;

                    // Set loop mode
                    if (clip.name === 'punch' || clip.name === 'jump') {
                        action.setLoop(THREE.LoopOnce);
                        action.clampWhenFinished = true;
                    } else {
                        action.setLoop(THREE.LoopRepeat);
                    }
                }

                // Start with idle
                if (this.actions.idle) {
                    this.actions.idle.play();
                    this.currentAction = this.actions.idle;
                }
            }
        } else {
            // Fallback: primitive model
            this._createFallbackModel();
        }
    }

    _createFallbackModel() {
        this.model = new THREE.Group();

        const skinColor = 0xd4a574;
        const shirtColor = 0x4466aa;
        const pantsColor = 0x333344;
        const shoeColor = 0x222222;
        const hairColor = 0x221100;

        const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
        const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
        const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
        const shoeMat = new THREE.MeshStandardMaterial({ color: shoeColor, roughness: 0.9 });
        const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });

        // Torso
        const chestGeo = new THREE.CylinderGeometry(0.32, 0.35, 0.4, 8);
        const chest = new THREE.Mesh(chestGeo, shirtMat);
        chest.position.set(0, 1.25, 0);
        chest.castShadow = true;
        this.model.add(chest);
        this.parts.torso = chest;

        const waistGeo = new THREE.CylinderGeometry(0.26, 0.30, 0.3, 8);
        const waist = new THREE.Mesh(waistGeo, shirtMat);
        waist.position.set(0, 0.95, 0);
        this.model.add(waist);
        this.parts.waist = waist;

        // Head
        const headGeo = new THREE.SphereGeometry(0.22, 10, 10);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.76, 0);
        head.castShadow = true;
        this.model.add(head);
        this.parts.head = head;

        // Hair
        const hairGeo = new THREE.BoxGeometry(0.38, 0.12, 0.35);
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.set(0, 1.92, -0.02);
        this.model.add(hair);

        // Arms
        for (const side of [-1, 1]) {
            const upperArmGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.35, 6);
            const upperArm = new THREE.Mesh(upperArmGeo, shirtMat);
            upperArm.position.set(side * 0.42, 1.25, 0);
            this.model.add(upperArm);
            this.parts[side > 0 ? 'rightUpperArm' : 'leftUpperArm'] = upperArm;

            const forearmGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.3, 6);
            const forearm = new THREE.Mesh(forearmGeo, skinMat);
            forearm.position.set(side * 0.42, 0.95, 0);
            this.model.add(forearm);
            this.parts[side > 0 ? 'rightForearm' : 'leftForearm'] = forearm;

            const handGeo = new THREE.BoxGeometry(0.06, 0.08, 0.06);
            const hand = new THREE.Mesh(handGeo, skinMat);
            hand.position.set(side * 0.42, 0.77, 0);
            this.model.add(hand);
            this.parts[side > 0 ? 'rightHand' : 'leftHand'] = hand;
        }

        // Legs
        for (const side of [-1, 1]) {
            const thighGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.4, 6);
            const thigh = new THREE.Mesh(thighGeo, pantsMat);
            thigh.position.set(side * 0.14, 0.6, 0);
            this.model.add(thigh);
            this.parts[side > 0 ? 'rightThigh' : 'leftThigh'] = thigh;

            const shinGeo = new THREE.CylinderGeometry(0.085, 0.07, 0.35, 6);
            const shin = new THREE.Mesh(shinGeo, pantsMat);
            shin.position.set(side * 0.14, 0.25, 0);
            this.model.add(shin);
            this.parts[side > 0 ? 'rightShin' : 'leftShin'] = shin;

            const shoeGeo = new THREE.BoxGeometry(0.12, 0.08, 0.2);
            const shoe = new THREE.Mesh(shoeGeo, shoeMat);
            shoe.position.set(side * 0.14, 0.04, 0.03);
            this.model.add(shoe);
            this.parts[side > 0 ? 'rightShoe' : 'leftShoe'] = shoe;
        }
    }

    update(dt) {
        if (this.isDead) return;
        if (this._carjacking) return; // Frozen during carjack animation

        const input = this.game.systems.input;

        // Phone toggle (T key) — works on foot and in vehicle
        if (input.justPressed('phone')) {
            this.togglePhone();
        }
        if (this.phoneOpen) {
            this.updatePhone(dt);
            return; // Block all other input while phone is open
        }

        // Wardrobe
        if (this.wardrobeOpen) {
            this.updateWardrobe(dt);
            return;
        }

        if (this.inVehicle) {
            this.updateInVehicle(dt);
            return;
        }

        if (this.noclip) {
            this.updateNoclip(dt);
            return;
        }

        // Water/swimming check
        const world = this.game.systems.world;
        const wasSwimming = this.isSwimming;
        this.isSwimming = world.isInWater(this.position.x, this.position.z) && !this.isInInterior;

        if (this.isSwimming && !wasSwimming) {
            // Just entered water
            this.game.systems.audio.playSplash();
            this.velocity.y = Math.max(this.velocity.y, -2); // Soften fall into water
        }

        if (this.isSwimming) {
            this.updateSwimming(dt);
            return;
        }

        // Reset swim tilt if we just left water
        if (wasSwimming) {
            this.model.rotation.x = 0;
            this.model.scale.y = 1;
        }

        // Movement
        const camera = this.game.systems.camera;
        const forward = camera.getForwardDirection();
        const right = camera.getRightDirection();

        const moveX = input.moveX;
        const moveY = input.moveY;

        const moveDir = new THREE.Vector3(
            forward.x * moveY + right.x * moveX,
            0,
            forward.z * moveY + right.z * moveX
        );

        // Sprint
        this.isSprinting = input.isDown('sprint') && moveDir.length() > 0.1;
        this.isCrouching = input.isDown('crouch') && !this.isSprinting;

        const speed = (this.isSprinting ? this.sprintSpeed : (this.isCrouching ? this.walkSpeed * 0.5 : this.walkSpeed)) * this.speedMultiplier;

        if (moveDir.length() > 0.1) {
            moveDir.normalize();
            this.velocity.x = moveDir.x * speed;
            this.velocity.z = moveDir.z * speed;

            // Rotate player to face movement direction
            this.rotation = Math.atan2(moveDir.x, moveDir.z);
        } else {
            // Friction
            this.velocity.x *= 0.85;
            this.velocity.z *= 0.85;
        }

        // Gravity
        if (!this.isOnGround) {
            this.velocity.y -= this.gravity * dt;
        }

        // Jump
        if (input.justPressed('jump') && this.isOnGround) {
            this.velocity.y = this.jumpForce;
            this.isOnGround = false;

            // Play jump animation
            if (this.mixer && this.actions.jump) {
                this.actions.jump.reset().play();
                const onJumpFinished = () => {
                    this.mixer.removeEventListener('finished', onJumpFinished);
                    this._crossfadeTo(this.animState === 'idle' ? 'idle' : this.animState, 0.15);
                };
                this.mixer.addEventListener('finished', onJumpFinished);
            }
        }

        // Apply velocity with physics
        const physics = this.game.systems.physics;
        if (physics && physics.ready && this.physicsBody && this.physicsCollider) {
            // Rapier KinematicCharacterController path
            const desired = { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt };
            const corrected = physics.moveCharacter(this.physicsCollider, desired);

            this.position.x += corrected.x;
            this.position.y += corrected.y;
            this.position.z += corrected.z;

            // Update kinematic body position
            this.physicsBody.setNextKinematicTranslation({
                x: this.position.x,
                y: this.position.y + 0.9,
                z: this.position.z
            });

            // Ground detection from character controller
            this.isOnGround = physics.isCharacterGrounded();
            if (this.isOnGround && this.velocity.y < 0) {
                this.velocity.y = 0;
            }
        } else {
            // Fallback: old AABB collision system
            const newX = this.position.x + this.velocity.x * dt;
            const newZ = this.position.z + this.velocity.z * dt;
            const newY = this.position.y + this.velocity.y * dt;

            const world = this.game.systems.world;
            const collisionX = world.checkCollision(newX, this.position.z, this.radius);
            const collisionZ = world.checkCollision(this.position.x, newZ, this.radius);

            if (!collisionX) {
                this.position.x = newX;
            } else {
                this.velocity.x = 0;
            }

            if (!collisionZ) {
                this.position.z = newZ;
            } else {
                this.velocity.z = 0;
            }

            if (newY <= 0) {
                this.position.y = 0;
                this.velocity.y = 0;
                this.isOnGround = true;
            } else {
                this.position.y = newY;
                this.isOnGround = false;
            }
        }

        // Track walking distance
        const dist = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z) * dt;
        this.game.stats.distanceWalked += dist;

        // Update model
        this.model.position.copy(this.position);
        this.model.rotation.y = this.rotation;

        // Animation
        this.updateAnimation(dt);

        // Footstep cadence
        const moveSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        if (moveSpeed > 1.0 && this.isOnGround) {
            // Faster footsteps when sprinting
            const cadence = this.isSprinting ? 0.25 : (moveSpeed > 4 ? 0.32 : 0.45);
            this.footstepTimer -= dt;
            if (this.footstepTimer <= 0) {
                this.footstepTimer = cadence;
                this.game.systems.audio.playFootstep();
            }
        } else {
            this.footstepTimer = 0;
        }

        // Crouch visual
        if (this.isCrouching) {
            this.model.scale.y = 0.7;
            this.model.position.y -= 0.3;
        } else {
            this.model.scale.y = 1;
        }

        // Interact check
        this.checkInteractions();
    }

    updateNoclip(dt) {
        const input = this.game.systems.input;
        const camera = this.game.systems.camera;
        const forward = camera.getForwardDirection();
        const right = camera.getRightDirection();

        const moveX = input.moveX;
        const moveY = input.moveY;
        const speed = this.noclipSpeed * this.speedMultiplier;

        this.position.x += (forward.x * moveY + right.x * moveX) * speed * dt;
        this.position.z += (forward.z * moveY + right.z * moveX) * speed * dt;

        if (input.isDown('jump')) this.position.y += speed * dt;
        if (input.isDown('sprint')) this.position.y -= speed * dt;

        this.model.position.copy(this.position);
    }

    updateSwimming(dt) {
        const input = this.game.systems.input;
        const camera = this.game.systems.camera;
        const forward = camera.getForwardDirection();
        const right = camera.getRightDirection();
        const world = this.game.systems.world;
        const waterLevel = world.getWaterLevel();

        const moveX = input.moveX;
        const moveY = input.moveY;

        const moveDir = new THREE.Vector3(
            forward.x * moveY + right.x * moveX,
            0,
            forward.z * moveY + right.z * moveX
        );

        const isSprinting = input.isDown('sprint');
        const speed = (isSprinting ? this.swimSprintSpeed : this.swimSpeed) * this.speedMultiplier;

        if (moveDir.length() > 0.1) {
            moveDir.normalize();
            this.velocity.x = moveDir.x * speed;
            this.velocity.z = moveDir.z * speed;
            this.rotation = Math.atan2(moveDir.x, moveDir.z);
        } else {
            this.velocity.x *= 0.9;
            this.velocity.z *= 0.9;
        }

        // Vertical movement in water
        if (input.isDown('jump')) {
            this.velocity.y = 2; // Swim up
        } else {
            // Float at water level
            const targetY = waterLevel + 0.3;
            this.velocity.y = (targetY - this.position.y) * 3;
        }

        // Apply movement
        this.position.x += this.velocity.x * dt;
        this.position.z += this.velocity.z * dt;
        this.position.y += this.velocity.y * dt;

        // Don't go below water floor
        this.position.y = Math.max(waterLevel - 2, this.position.y);

        // Drowning: if below water level for too long, take damage
        if (this.position.y < waterLevel - 0.5) {
            this._drownTimer = (this._drownTimer || 0) + dt;
            if (this._drownTimer > 5) {
                this.takeDamage(dt * 10); // 10 damage per second after 5 seconds underwater
            }
        } else {
            this._drownTimer = 0;
        }

        // Update model
        this.model.position.copy(this.position);
        this.model.rotation.y = this.rotation;

        // Swimming bob animation
        this.animTime += dt * 3;
        const bob = Math.sin(this.animTime) * 0.1;
        this.model.position.y += bob;

        // Swim animation tilt
        const moveSpd = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        if (moveSpd > 0.5) {
            // Tilt forward slightly when swimming
            this.model.rotation.x = 0.2;
        } else {
            this.model.rotation.x = 0;
        }

        // Track distance
        const dist = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z) * dt;
        this.game.stats.distanceWalked += dist;

        // Interactions still work in water
        this.checkInteractions();
    }

    updateInVehicle(dt) {
        if (this.currentVehicle) {
            this.position.copy(this.currentVehicle.mesh.position);
            this.model.visible = this.currentVehicle.type === 'motorcycle';

            // E key to exit vehicle
            const input = this.game.systems.input;
            if (input.justPressed('interact')) {
                this.exitVehicle();
            }
        }
    }

    updateAnimation(dt) {
        const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);

        // Determine target animation state
        let targetState = 'idle';
        if (speed > 7) targetState = 'sprint';
        else if (speed > 4) targetState = 'run';
        else if (speed > 0.5) targetState = 'walk';

        // If we have a mixer (skeleton animations)
        if (this.mixer) {
            this.mixer.update(dt);

            if (targetState !== this.animState) {
                this.animState = targetState;
                this._crossfadeTo(targetState);
            }

            // Adjust walk/run playback speed based on velocity
            if (this.actions[targetState] && (targetState === 'walk' || targetState === 'run' || targetState === 'sprint')) {
                this.actions[targetState].timeScale = Math.max(0.5, speed / (targetState === 'sprint' ? 9 : targetState === 'run' ? 6 : 3));
            }
        } else {
            // Fallback sine-wave animation for primitive model
            this.animState = targetState;
            this._updateFallbackAnimation(dt, speed);
        }
    }

    _crossfadeTo(clipName, duration = 0.2) {
        const nextAction = this.actions[clipName];
        if (!nextAction || nextAction === this.currentAction) return;

        if (this.currentAction) {
            this.currentAction.fadeOut(duration);
        }

        nextAction.reset().fadeIn(duration).play();
        this.currentAction = nextAction;
    }

    _updateFallbackAnimation(dt, speed) {
        const animSpeed = this.animState === 'run' || this.animState === 'sprint' ? 10 : this.animState === 'walk' ? 6 : 1;
        this.animTime += dt * animSpeed;

        const swing = Math.sin(this.animTime);
        const bobFreq = Math.sin(this.animTime * 2);
        const bob = Math.abs(bobFreq) * 0.04;

        if (this.animState === 'idle') {
            const breathe = Math.sin(this.animTime * 0.5) * 0.01;
            this.resetLimbs();
            if (this.parts.torso) {
                this.parts.torso.position.y = 1.25 + breathe;
            }
        } else {
            const amp = this.animState === 'run' || this.animState === 'sprint' ? 0.5 : 0.3;
            const isRunning = this.animState === 'run' || this.animState === 'sprint';

            if (this.parts.rightUpperArm) {
                this.parts.rightUpperArm.rotation.x = -swing * amp;
                this.parts.rightUpperArm.position.y = 1.25;
                this.parts.rightUpperArm.position.z = -Math.sin(this.animTime) * amp * 0.3;
            }
            if (this.parts.leftUpperArm) {
                this.parts.leftUpperArm.rotation.x = swing * amp;
                this.parts.leftUpperArm.position.y = 1.25;
                this.parts.leftUpperArm.position.z = Math.sin(this.animTime) * amp * 0.3;
            }
            if (this.parts.rightForearm) {
                this.parts.rightForearm.rotation.x = -swing * amp * 0.6 - (isRunning ? 0.3 : 0);
                this.parts.rightForearm.position.z = -Math.sin(this.animTime) * amp * 0.2;
            }
            if (this.parts.leftForearm) {
                this.parts.leftForearm.rotation.x = swing * amp * 0.6 - (isRunning ? 0.3 : 0);
                this.parts.leftForearm.position.z = Math.sin(this.animTime) * amp * 0.2;
            }
            if (this.parts.rightHand) {
                this.parts.rightHand.position.z = -Math.sin(this.animTime) * amp * 0.2;
            }
            if (this.parts.leftHand) {
                this.parts.leftHand.position.z = Math.sin(this.animTime) * amp * 0.2;
            }
            if (this.parts.rightThigh) {
                this.parts.rightThigh.rotation.x = swing * amp;
                this.parts.rightThigh.position.z = Math.sin(this.animTime) * amp * 0.2;
            }
            if (this.parts.leftThigh) {
                this.parts.leftThigh.rotation.x = -swing * amp;
                this.parts.leftThigh.position.z = -Math.sin(this.animTime) * amp * 0.2;
            }
            if (this.parts.rightShin) {
                this.parts.rightShin.rotation.x = swing * amp * 0.4;
                this.parts.rightShin.position.z = Math.sin(this.animTime) * amp * 0.15;
                this.parts.rightShin.position.y = 0.25 + Math.max(0, Math.sin(this.animTime)) * 0.08;
            }
            if (this.parts.leftShin) {
                this.parts.leftShin.rotation.x = -swing * amp * 0.4;
                this.parts.leftShin.position.z = -Math.sin(this.animTime) * amp * 0.15;
                this.parts.leftShin.position.y = 0.25 + Math.max(0, -Math.sin(this.animTime)) * 0.08;
            }
            if (this.parts.rightShoe) {
                this.parts.rightShoe.position.y = 0.04 + Math.max(0, Math.sin(this.animTime)) * 0.06;
            }
            if (this.parts.leftShoe) {
                this.parts.leftShoe.position.y = 0.04 + Math.max(0, -Math.sin(this.animTime)) * 0.06;
            }
            if (this.parts.torso) {
                this.parts.torso.position.y = 1.25 + bob;
                this.parts.torso.rotation.y = swing * 0.05;
                this.parts.torso.rotation.x = isRunning ? 0.1 : 0;
            }
            if (this.parts.head) {
                this.parts.head.position.y = 1.76 + bob;
            }
            if (this.parts.waist) {
                this.parts.waist.position.y = 0.95 + bob * 0.5;
            }
        }
    }

    resetLimbs() {
        const defaults = {
            rightUpperArm: { x: 0.42, y: 1.25, z: 0 },
            leftUpperArm: { x: -0.42, y: 1.25, z: 0 },
            rightForearm: { x: 0.42, y: 0.95, z: 0 },
            leftForearm: { x: -0.42, y: 0.95, z: 0 },
            rightHand: { x: 0.42, y: 0.77, z: 0 },
            leftHand: { x: -0.42, y: 0.77, z: 0 },
            rightThigh: { x: 0.14, y: 0.6, z: 0 },
            leftThigh: { x: -0.14, y: 0.6, z: 0 },
            rightShin: { x: 0.14, y: 0.25, z: 0 },
            leftShin: { x: -0.14, y: 0.25, z: 0 },
            rightShoe: { x: 0.14, y: 0.04, z: 0.03 },
            leftShoe: { x: -0.14, y: 0.04, z: 0.03 }
        };

        for (const [name, pos] of Object.entries(defaults)) {
            if (this.parts[name]) {
                this.parts[name].rotation.x = 0;
                this.parts[name].rotation.y = 0;
                this.parts[name].position.z = pos.z;
                this.parts[name].position.y = pos.y;
            }
        }
        if (this.parts.torso) {
            this.parts.torso.rotation.x = 0;
            this.parts.torso.rotation.y = 0;
        }
    }

    playPunchAnimation() {
        if (this.mixer && this.actions.punch) {
            // Use skeleton animation
            const punchAction = this.actions.punch;
            punchAction.reset().play();

            // After punch completes, crossfade back
            const onFinished = () => {
                this.mixer.removeEventListener('finished', onFinished);
                this._crossfadeTo(this.animState === 'idle' ? 'idle' : this.animState, 0.15);
            };
            this.mixer.addEventListener('finished', onFinished);
        } else {
            // Fallback punch
            this._playFallbackPunch();
        }
    }

    _playFallbackPunch() {
        this._punchPhase = 'windup';
        this._punchTimer = 0;
        this._punchLastTime = performance.now();

        const animate = () => {
            const now = performance.now();
            const dt = now - this._punchLastTime;
            this._punchLastTime = now;
            this._punchTimer += dt;

            if (this._punchPhase === 'windup' && this._punchTimer < 100) {
                if (this.parts.rightUpperArm) {
                    this.parts.rightUpperArm.rotation.x = 0.6;
                    this.parts.rightUpperArm.position.z = -0.15;
                }
                if (this.parts.rightForearm) {
                    this.parts.rightForearm.rotation.x = 0.8;
                }
                if (this.parts.torso) {
                    this.parts.torso.rotation.y = -0.2;
                }
                requestAnimationFrame(animate);
            } else if (this._punchTimer < 250) {
                this._punchPhase = 'strike';
                if (this.parts.rightUpperArm) {
                    this.parts.rightUpperArm.rotation.x = -1.4;
                    this.parts.rightUpperArm.position.z = 0.2;
                }
                if (this.parts.rightForearm) {
                    this.parts.rightForearm.rotation.x = -0.8;
                    this.parts.rightForearm.position.z = 0.35;
                }
                if (this.parts.rightHand) {
                    this.parts.rightHand.position.z = 0.45;
                }
                if (this.parts.torso) {
                    this.parts.torso.rotation.y = 0.5;
                }
                requestAnimationFrame(animate);
            } else if (this._punchTimer < 400) {
                this._punchPhase = 'recovery';
                const t = (this._punchTimer - 250) / 150;
                if (this.parts.rightUpperArm) {
                    this.parts.rightUpperArm.rotation.x = -1.4 * (1 - t);
                    this.parts.rightUpperArm.position.z = 0.2 * (1 - t);
                }
                if (this.parts.rightForearm) {
                    this.parts.rightForearm.rotation.x = -0.8 * (1 - t);
                    this.parts.rightForearm.position.z = 0.35 * (1 - t);
                }
                if (this.parts.rightHand) {
                    this.parts.rightHand.position.z = 0.45 * (1 - t);
                }
                if (this.parts.torso) {
                    this.parts.torso.rotation.y = 0.5 * (1 - t);
                }
                requestAnimationFrame(animate);
            } else {
                this.resetLimbs();
            }
        };
        requestAnimationFrame(animate);
    }

    checkInteractions() {
        const input = this.game.systems.input;
        const vehicles = this.game.systems.vehicles;
        const promptEl = document.getElementById('hud-interact-prompt');

        let nearestVehicle = null;
        let nearestDist = 4;

        if (vehicles && vehicles.vehicles) {
            for (const v of vehicles.vehicles) {
                if (!v.mesh) continue;
                const dist = this.position.distanceTo(v.mesh.position);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestVehicle = v;
                }
            }
        }

        if (nearestVehicle && !this.inVehicle) {
            promptEl.textContent = 'Press E to enter vehicle';
            promptEl.classList.add('visible');

            if (input.justPressed('interact')) {
                this.enterVehicle(nearestVehicle);
            }
        } else if (this.inVehicle) {
            promptEl.textContent = 'Press E to exit vehicle';
            promptEl.classList.add('visible');

            if (input.justPressed('interact')) {
                this.exitVehicle();
            }
        } else {
            promptEl.classList.remove('visible');
        }

        if (this.game.systems.weapons) {
            this.game.systems.weapons.checkPickups(this.position);
        }

        if (this.game.systems.missions) {
            this.game.systems.missions.checkProximity(this.position);
        }

        if (this.game.systems.interiors) {
            this.game.systems.interiors.checkDoors(this.position);
        }
    }

    enterVehicle(vehicle) {
        if (vehicle.isNPCOwned && !vehicle._carjackInProgress) {
            // Carjack sequence — brief delay with animation
            vehicle._carjackInProgress = true;
            this._carjacking = true;

            // Show carjack text
            this.game.systems.ui.showMissionText('Carjacking...', 1);

            // Spawn ejected NPC near the car
            const npcs = this.game.systems.npcs;
            const vPos = vehicle.mesh.position;
            const side = new THREE.Vector3(
                Math.cos(vehicle.mesh.rotation.y) * 2.5,
                0,
                -Math.sin(vehicle.mesh.rotation.y) * 2.5
            );

            // Create fleeing NPC at the driver door position
            const ejectedNPC = npcs.spawnPedestrian();
            if (ejectedNPC && ejectedNPC.mesh) {
                // Reposition to car door
                ejectedNPC.mesh.position.set(vPos.x + side.x, 0, vPos.z + side.z);
                ejectedNPC.isFleeing = true;
                ejectedNPC.fleeTarget = vPos.clone();
                // Run away from the vehicle
                ejectedNPC.walkDir = Math.atan2(side.x, side.z);

                // Carjack dialogue
                const carjackLines = [
                    "Hey! That's my car!", "Are you crazy?!", "Someone call the cops!",
                    "My car! No!", "What the— GET OUT!", "Help! I'm being robbed!",
                    "You'll pay for this!", "Thief! THIEF!"
                ];
                const line = carjackLines[Math.floor(Math.random() * carjackLines.length)];
                npcs.showNPCSubtitle(ejectedNPC, line);
                this.game.systems.audio.playAnimalese(line, 140, 'scared');

                // Nearby NPCs flee
                npcs.fleeFromPoint(vPos);
            }

            // Brief delay before entering
            setTimeout(() => {
                if (!vehicle._carjackInProgress) return;
                vehicle._carjackInProgress = false;
                this._carjacking = false;

                // Don't enter vehicle if player died/respawned during carjack
                if (this.isDead) return;

                this.inVehicle = true;
                this.currentVehicle = vehicle;
                vehicle.occupied = true;
                vehicle.driver = this;
                vehicle.isTraffic = false;
                vehicle.isNPCOwned = false;
                this.model.visible = vehicle.type === 'motorcycle';

                // Remove driver model
                if (vehicle._driverModel) {
                    vehicle.mesh.remove(vehicle._driverModel);
                    vehicle._driverModel = null;
                }

                this.game.systems.wanted.addHeat(1);
                this.game.stats.vehiclesStolen++;
            }, 600);
        } else if (!vehicle.isNPCOwned) {
            // Normal vehicle entry (parked car)
            this.inVehicle = true;
            this.currentVehicle = vehicle;
            vehicle.occupied = true;
            vehicle.driver = this;
            this.model.visible = vehicle.type === 'motorcycle';
        }
    }

    exitVehicle() {
        if (!this.currentVehicle) return;

        const vPos = this.currentVehicle.mesh.position;
        const angle = this.currentVehicle.mesh.rotation.y;
        this.position.set(
            vPos.x + Math.cos(angle) * 2.5,
            Math.max(0, vPos.y),
            vPos.z - Math.sin(angle) * 2.5
        );

        this.currentVehicle.occupied = false;
        this.currentVehicle.driver = null;
        this.currentVehicle = null;
        this.inVehicle = false;
        this.model.visible = true;
        this.model.position.copy(this.position);

        // Stop radio and engine when exiting vehicle
        this.game.systems.audio.stopRadio();
        this.game.systems.audio.currentStation = -1;
        this.game.systems.audio.stopEngine();
    }

    // --- Phone System ---
    togglePhone() {
        if (this.phoneOpen) {
            this.closePhone();
        } else {
            this.openPhone();
        }
    }

    openPhone() {
        this.phoneOpen = true;
        this.phoneSelectedIndex = 0;
        this._drawPhoneUI();
    }

    closePhone() {
        this.phoneOpen = false;
        if (this._phoneEl) {
            this._phoneEl.style.display = 'none';
        }
    }

    updatePhone(dt) {
        if (!this.phoneOpen) return;

        const input = this.game.systems.input;
        this._phoneNavCooldown = Math.max(0, this._phoneNavCooldown - dt);

        // Navigate with W/S
        if (this._phoneNavCooldown <= 0) {
            if (input.keys['KeyW'] || input.keys['ArrowUp']) {
                this.phoneSelectedIndex = Math.max(0, this.phoneSelectedIndex - 1);
                this._phoneNavCooldown = 0.15;
                this._drawPhoneUI();
            }
            if (input.keys['KeyS'] || input.keys['ArrowDown']) {
                this.phoneSelectedIndex = Math.min(this.phoneContacts.length - 1, this.phoneSelectedIndex + 1);
                this._phoneNavCooldown = 0.15;
                this._drawPhoneUI();
            }
        }

        // Call with E
        if (input.justPressed('interact')) {
            this._callContact(this.phoneContacts[this.phoneSelectedIndex]);
        }

        // Close with T or Escape
        if (input.justPressed('pause')) {
            this.closePhone();
        }
    }

    _callContact(contact) {
        this.closePhone();
        const audio = this.game.systems.audio;
        const ui = this.game.systems.ui;

        // Phone ring sound
        audio.playPickup();

        switch (contact.action) {
            case 'call_sal':
            case 'call_nina':
            case 'call_vex': {
                const giver = contact.action.replace('call_', '');
                const missions = this.game.systems.missions;
                const nextMission = missions && missions.missions ?
                    missions.missions.find(m => !m.completed && m.giver === giver) : null;

                if (nextMission) {
                    ui.showMissionText(`${contact.name.split(' ')[0]}: "Come see me, I got work for you."\n${nextMission.title}`, 4);
                    audio.playAnimalese("Come see me I got work for you", 150, 'neutral');
                } else {
                    ui.showMissionText(`${contact.name.split(' ')[0]}: "Nothing right now. Call back later."`, 3);
                    audio.playAnimalese("Nothing right now call back later", 150, 'neutral');
                }
                break;
            }
            case 'taxi': {
                // Spawn a taxi nearby
                const vehicles = this.game.systems.vehicles;
                const angle = this.rotation + Math.PI;
                const spawnX = this.position.x + Math.sin(angle) * 15;
                const spawnZ = this.position.z + Math.cos(angle) * 15;
                const taxi = vehicles.spawnVehicle(spawnX, spawnZ, 'sedan');
                if (taxi) {
                    // Color it yellow
                    taxi.mesh.traverse(child => {
                        if (child.isMesh && child.material && !child.name?.startsWith('wheel')) {
                            child.material = child.material.clone();
                            child.material.color.setHex(0xffcc00);
                        }
                    });
                    ui.showMissionText('Taxi is on its way!', 3);
                    audio.playAnimalese("Taxi on its way", 140, 'neutral');
                }
                break;
            }
            case '911': {
                ui.showMissionText('"911, what\'s your emergency?"\n...', 3);
                audio.playAnimalese("Nine one one whats your emergency", 160, 'authoritative');
                // Prank call increases wanted
                setTimeout(() => {
                    this.game.systems.wanted.addHeat(1);
                    ui.showMissionText('The police have been alerted to your location.', 2);
                }, 2000);
                break;
            }
            case 'mechanic': {
                if (this.inVehicle && this.currentVehicle) {
                    const cost = 300;
                    if (this.cash >= cost) {
                        this.cash -= cost;
                        this.currentVehicle.health = this.currentVehicle.maxHealth;
                        ui.showMissionText(`Mechanic: "All fixed up!" (-$${cost})`, 3);
                        audio.playAnimalese("All fixed up good as new", 130, 'neutral');
                    } else {
                        ui.showMissionText(`Mechanic: "That'll be $${cost}. You don't have enough."`, 3);
                        audio.playAnimalese("That'll be three hundred you dont have enough", 130, 'neutral');
                    }
                } else {
                    ui.showMissionText('Mechanic: "Call me when you\'re in a vehicle."', 3);
                    audio.playAnimalese("Call me when youre in a vehicle", 130, 'neutral');
                }
                break;
            }
        }
    }

    _drawPhoneUI() {
        if (!this._phoneEl) {
            this._phoneEl = document.createElement('div');
            this._phoneEl.id = 'phone-ui';
            this._phoneEl.style.cssText = `
                position: fixed; right: 30px; top: 50%; transform: translateY(-50%);
                width: 220px; background: rgba(10,10,20,0.95);
                border: 2px solid rgba(100,200,255,0.5); border-radius: 20px;
                padding: 20px 15px; z-index: 200; font-family: Rajdhani, sans-serif;
                box-shadow: 0 0 30px rgba(0,100,200,0.3);
            `;
            document.body.appendChild(this._phoneEl);
        }
        this._phoneEl.style.display = 'block';

        let html = `<div style="color:#88ccff;font-size:14px;text-align:center;margin-bottom:12px;border-bottom:1px solid rgba(100,200,255,0.3);padding-bottom:8px;">
            PHONE &nbsp; <span style="font-size:11px;color:#667">W/S Navigate | E Call | T Close</span>
        </div>`;

        for (let i = 0; i < this.phoneContacts.length; i++) {
            const c = this.phoneContacts[i];
            const selected = i === this.phoneSelectedIndex;
            const bg = selected ? 'rgba(0,150,255,0.3)' : 'transparent';
            const border = selected ? '1px solid rgba(0,150,255,0.5)' : '1px solid transparent';
            const iconColors = { 'M': '#ffcc00', 'T': '#ffcc00', '!': '#ff4444', 'W': '#44aaff' };
            html += `<div style="padding:8px 10px;margin:3px 0;background:${bg};border:${border};border-radius:8px;color:#dde;font-size:13px;display:flex;align-items:center;gap:8px;">
                <span style="width:22px;height:22px;border-radius:50%;background:${iconColors[c.icon] || '#888'};color:#000;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;">${c.icon}</span>
                ${c.name}
            </div>`;
        }

        this._phoneEl.innerHTML = html;
    }

    // --- Wardrobe System ---
    openWardrobe() {
        this.wardrobeOpen = true;
        this._wardrobeNavCooldown = 0;
        this._drawWardrobeUI();
    }

    closeWardrobe() {
        this.wardrobeOpen = false;
        if (this._wardrobeEl) {
            this._wardrobeEl.style.display = 'none';
        }
    }

    updateWardrobe(dt) {
        if (!this.wardrobeOpen) return;
        const input = this.game.systems.input;
        this._wardrobeNavCooldown = Math.max(0, this._wardrobeNavCooldown - dt);

        if (this._wardrobeNavCooldown <= 0) {
            if (input.keys['KeyW'] || input.keys['ArrowUp']) {
                this.currentOutfit = (this.currentOutfit - 1 + this.outfits.length) % this.outfits.length;
                this._wardrobeNavCooldown = 0.15;
                this.applyOutfit(this.currentOutfit);
                this._drawWardrobeUI();
            }
            if (input.keys['KeyS'] || input.keys['ArrowDown']) {
                this.currentOutfit = (this.currentOutfit + 1) % this.outfits.length;
                this._wardrobeNavCooldown = 0.15;
                this.applyOutfit(this.currentOutfit);
                this._drawWardrobeUI();
            }
        }

        // Confirm with E
        if (input.justPressed('interact')) {
            this.game.systems.ui.showMissionText(`Outfit: ${this.outfits[this.currentOutfit].name}`, 2);
            this.game.systems.audio.playPickup();
            this.closeWardrobe();
        }

        // Cancel with Escape
        if (input.justPressed('pause')) {
            this.closeWardrobe();
        }
    }

    applyOutfit(index) {
        const outfit = this.outfits[index];
        if (!outfit) return;

        // Update fallback model parts (if using fallback model)
        if (this.parts.torso) {
            this.parts.torso.material.color.setHex(outfit.shirt);
        }
        if (this.parts.waist) {
            this.parts.waist.material.color.setHex(outfit.shirt);
        }
        // Arms
        if (this.parts.leftUpperArm) this.parts.leftUpperArm.material.color.setHex(outfit.shirt);
        if (this.parts.rightUpperArm) this.parts.rightUpperArm.material.color.setHex(outfit.shirt);
        // Pants
        if (this.parts.leftThigh) this.parts.leftThigh.material.color.setHex(outfit.pants);
        if (this.parts.rightThigh) this.parts.rightThigh.material.color.setHex(outfit.pants);
        if (this.parts.leftShin) this.parts.leftShin.material.color.setHex(outfit.pants);
        if (this.parts.rightShin) this.parts.rightShin.material.color.setHex(outfit.pants);
        // Shoes
        if (this.parts.leftShoe) this.parts.leftShoe.material.color.setHex(outfit.shoes);
        if (this.parts.rightShoe) this.parts.rightShoe.material.color.setHex(outfit.shoes);
    }

    // --- Clothing Shop Appearance ---
    applyAppearance() {
        const a = this.appearance;

        // Shirt color: torso, waist, upper arms
        const shirtParts = ['torso', 'waist', 'leftUpperArm', 'rightUpperArm'];
        for (const name of shirtParts) {
            if (this.parts[name] && this.parts[name].material) {
                this.parts[name].material.color.setHex(a.shirtColor);
            }
        }

        // Pants color: thighs, shins
        const pantsParts = ['leftThigh', 'rightThigh', 'leftShin', 'rightShin'];
        for (const name of pantsParts) {
            if (this.parts[name] && this.parts[name].material) {
                this.parts[name].material.color.setHex(a.pantsColor);
            }
        }

        // Hat: small cylinder on top of head
        if (a.hasHat) {
            if (!this._hatMesh) {
                const hatGeo = new THREE.CylinderGeometry(0.25, 0.28, 0.12, 10);
                const hatMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
                this._hatMesh = new THREE.Mesh(hatGeo, hatMat);
                this._hatMesh.position.set(0, 1.95, 0);
                this.model.add(this._hatMesh);
            }
            this._hatMesh.visible = true;
        } else {
            if (this._hatMesh) this._hatMesh.visible = false;
        }

        // Sunglasses: dark bar across eyes
        if (a.hasSunglasses) {
            if (!this._sunglassesMesh) {
                const glassGeo = new THREE.BoxGeometry(0.3, 0.06, 0.08);
                const glassMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.6 });
                this._sunglassesMesh = new THREE.Mesh(glassGeo, glassMat);
                this._sunglassesMesh.position.set(0, 1.78, 0.18);
                this.model.add(this._sunglassesMesh);
            }
            this._sunglassesMesh.visible = true;
        } else {
            if (this._sunglassesMesh) this._sunglassesMesh.visible = false;
        }
    }

    _drawWardrobeUI() {
        if (!this._wardrobeEl) {
            this._wardrobeEl = document.createElement('div');
            this._wardrobeEl.id = 'wardrobe-ui';
            this._wardrobeEl.style.cssText = `
                position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
                width: 280px; background: rgba(10,10,20,0.95);
                border: 2px solid rgba(200,150,50,0.6); border-radius: 12px;
                padding: 20px; z-index: 200; font-family: Rajdhani, sans-serif;
                box-shadow: 0 0 30px rgba(200,150,50,0.2);
            `;
            document.body.appendChild(this._wardrobeEl);
        }
        this._wardrobeEl.style.display = 'block';

        let html = `<div style="color:#ddaa44;font-size:16px;text-align:center;margin-bottom:12px;border-bottom:1px solid rgba(200,150,50,0.3);padding-bottom:8px;">
            WARDROBE <span style="font-size:11px;color:#888">W/S Browse | E Confirm</span>
        </div>`;

        for (let i = 0; i < this.outfits.length; i++) {
            const o = this.outfits[i];
            const selected = i === this.currentOutfit;
            const bg = selected ? 'rgba(200,150,50,0.2)' : 'transparent';
            const border = selected ? '1px solid rgba(200,150,50,0.4)' : '1px solid transparent';
            const shirtHex = '#' + o.shirt.toString(16).padStart(6, '0');
            const pantsHex = '#' + o.pants.toString(16).padStart(6, '0');
            html += `<div style="padding:8px 10px;margin:2px 0;background:${bg};border:${border};border-radius:6px;color:#dde;font-size:13px;display:flex;align-items:center;gap:10px;">
                <div style="display:flex;gap:3px;">
                    <div style="width:14px;height:14px;background:${shirtHex};border-radius:2px;border:1px solid #555;"></div>
                    <div style="width:14px;height:14px;background:${pantsHex};border-radius:2px;border:1px solid #555;"></div>
                </div>
                ${o.name}${selected ? ' ←' : ''}
            </div>`;
        }

        this._wardrobeEl.innerHTML = html;
    }

    takeDamage(amount) {
        if (this.isDead) return;

        if (this.armor > 0) {
            const absorbed = Math.min(this.armor, amount);
            this.armor -= absorbed;
            amount -= absorbed;
        }

        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    die() {
        if (this.isDead) return; // Prevent double-death
        this.isDead = true;

        this.game.systems.ragdoll.triggerPlayerRagdoll(this);

        setTimeout(() => {
            if (!this.isDead) return; // Already respawned
            this.game.setState('dead');
            const deathScreen = document.getElementById('death-screen');
            if (deathScreen) deathScreen.style.display = 'flex';

            setTimeout(() => {
                this.respawn();
            }, 3000);
        }, 500);
    }

    respawn() {
        this.isDead = false;
        this.health = this.maxHealth;
        this.cash = Math.max(0, this.cash - 100);

        // Reset vehicle state (prevents soft-lock if died in vehicle)
        if (this.inVehicle && this.currentVehicle) {
            this.currentVehicle.occupied = false;
            this.currentVehicle.driver = null;
        }
        this.inVehicle = false;
        this.currentVehicle = null;
        this._carjacking = false;

        // Reset swimming/drowning state
        this.isSwimming = false;
        this._drownTimer = 0;

        // Reset phone/wardrobe
        this.phoneOpen = false;
        this.wardrobeOpen = false;

        this.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        this.model.visible = true;
        this.model.position.copy(this.position);
        this.model.scale.y = 1;
        this.model.rotation.x = 0;

        this.game.setState('playing');
        const deathScreen = document.getElementById('death-screen');
        if (deathScreen) deathScreen.style.display = 'none';

        this.game.systems.wanted.setLevel(0);
    }

    addCash(amount) {
        this.cash += amount;
    }

    hasWeapon(id) {
        return this.weapons.some(w => w.id === id);
    }

    addWeapon(weaponData) {
        const existing = this.weapons.find(w => w.id === weaponData.id);
        if (existing) {
            existing.ammo += weaponData.ammo || 0;
        } else {
            this.weapons.push({ ...weaponData });
        }
    }

    getCurrentWeapon() {
        return this.weapons[this.currentWeaponIndex] || this.weapons[0];
    }

    cycleWeapon(direction) {
        this.currentWeaponIndex += direction;
        if (this.currentWeaponIndex >= this.weapons.length) this.currentWeaponIndex = 0;
        if (this.currentWeaponIndex < 0) this.currentWeaponIndex = this.weapons.length - 1;
    }

    selectWeapon(index) {
        if (index >= 0 && index < this.weapons.length) {
            this.currentWeaponIndex = index;
        }
    }
}
