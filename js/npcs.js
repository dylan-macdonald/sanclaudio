// San Claudio - NPC System
// Pedestrians, traffic AI, pooling

export class NPCManager {
    constructor(game) {
        this.game = game;
        this.pedestrians = [];
        this.maxPedestrians = 20;
        this._basePedestrians = 20;

        // District population multipliers (base density)
        this.districtPopulation = {
            'Downtown': 1.5,
            'The Strip': 1.3,
            'The Docks': 0.6,
            'Hillside': 0.4,
            'Industrial Park': 0.5,
            'North Shore': 0.7,
            'Portside': 0.7,
            'West End': 0.8,
            'Eastgate': 0.9
        };

        // Time-of-day population modifiers per district
        // dayFactor: 0=night, 1=full day
        this.districtTimeModifiers = {
            'Downtown': { day: 1.5, night: 0.4 },
            'The Strip': { day: 0.7, night: 1.8 },
            'The Docks': { day: 0.8, night: 0.3 },
            'Hillside': { day: 0.6, night: 0.2 },
            'Industrial Park': { day: 0.9, night: 0.2 },
            'default': { day: 1.0, night: 0.5 }
        };
        this.trafficVehicles = [];
        this.maxTraffic = 8;
        this.spawnRadius = 80;
        this.despawnRadius = 120;

        // Ambient dialogue - general + district-specific
        this.normalDialogue = [
            "Beautiful day in San Claudio.",
            "I'm running late again...",
            "Did you see the news?",
            "I need coffee.",
            "Watch where you're going!",
            "This neighborhood's changed.",
            "Hey, nice car.",
            "I love this city.",
            "Ugh, traffic.",
            "Is it gonna rain?"
        ];

        this.districtDialogue = {
            'Downtown': [
                "Meeting in ten. Can't be late.",
                "This latte cost me twelve bucks.",
                "The stock market is wild today.",
                "Have you tried that new restaurant?"
            ],
            'The Strip': [
                "The neon is gorgeous tonight.",
                "VIP section, baby!",
                "I heard the club's got a new DJ.",
                "This town never sleeps."
            ],
            'The Docks': [
                "Another shipment coming in.",
                "Watch your step around here.",
                "The union's meeting tomorrow.",
                "Smells like fish again."
            ],
            'Hillside': [
                "The view up here is amazing.",
                "Property values keep climbing.",
                "I should go for a hike.",
                "It's quieter up here."
            ],
            'Industrial Park': [
                "Overtime again tonight.",
                "This factory's been here forever.",
                "The machinery needs replacing.",
                "Nobody comes down here."
            ]
        };

        // NPC-to-NPC conversation pairs
        this.conversationPairs = [
            ["Did you hear about the robbery?", "Yeah, crazy stuff. This city man..."],
            ["Want to grab lunch?", "Sure, that taco place on Fifth?"],
            ["My kid starts school tomorrow.", "They grow up so fast."],
            ["Traffic was insane this morning.", "Tell me about it. Forty minutes!"],
            ["The weather's been weird lately.", "Global warming or whatever."],
            ["I think I saw someone famous.", "Who? Where?!"],
        ];

        this.fleeDialogue = [
            "OH GOD!", "RUN!", "Somebody call the cops!",
            "WHAT IS HAPPENING?!", "I'M TOO YOUNG TO DIE!",
            "THIS IS INSANE!", "GET DOWN!", "Help! HELP!",
            "SOMEBODY DO SOMETHING!", "I KNEW this neighborhood was bad!",
            "NOT AGAIN!", "WHY?! WHY?!"
        ];

        this.duckDialogue = [
            "SHOTS FIRED!", "GET DOWN!", "Oh my god!",
            "What was that?!", "DUCK!", "Whoa!"
        ];

        this.cheerDialogue = [
            "WOOOOO!", "YEAH!", "SICK JUMP!",
            "Did you see that?!", "INSANE!", "Oh SNAP!",
            "LEGENDARY!", "No way!"
        ];

        this.recordDialogue = [
            "I'm getting this on camera!", "WorldStar!",
            "This is going viral!", "Recording!",
            "Chat, you seeing this?!", "Content!"
        ];

        this.cowerDialogue = [
            "PLEASE NO!", "I have a family!",
            "Don't hurt me!", "Oh god oh god...",
            "I didn't see anything!"
        ];

        this.flinchDialogue = [
            "HEY! What the hell?!",
            "Back off, man!",
            "Are you CRAZY?!",
            "Don't touch me!",
            "What's your problem?!",
            "Somebody stop this lunatic!",
            "OW! That HURT!",
            "You're gonna regret that!",
        ];

        // District-specific NPC color palettes
        this.districtPalettes = {
            'Downtown': {
                shirts: [0x2c3e50, 0x34495e, 0x1a5276, 0x283747, 0x7f8c8d],
                pants: [0x1c1c2e, 0x2c2c3e, 0x1a1a2a]
            },
            'The Strip': {
                shirts: [0xff2299, 0xaa00ff, 0xff4400, 0x00ccff, 0xffcc00],
                pants: [0x111122, 0x221122, 0x112222]
            },
            'The Docks': {
                shirts: [0x666666, 0x997744, 0x445566, 0x778855, 0xcc8844],
                pants: [0x333333, 0x444433, 0x334444]
            },
            'Hillside': {
                shirts: [0x558855, 0x886644, 0x557788, 0xaa8866, 0x669966],
                pants: [0x333322, 0x443322, 0x334433]
            },
            'Industrial Park': {
                shirts: [0xff8800, 0xcccc00, 0x886644, 0x555555, 0x888844],
                pants: [0x333333, 0x444444, 0x222222]
            }
        };

        this.dialogueTimer = 0;
        this._conversationTimer = 0;

        // Random world events
        this._worldEventTimer = 30 + Math.random() * 30;
        this._activeEvent = null;
        this._eventMeshes = [];
    }

    // Get ground Y via physics raycast, fallback to world terrain height
    _getGroundY(x, z) {
        const ph = this.game.systems.physics;
        if (ph && ph.ready) return ph.getGroundHeight(x, z);
        const w = this.game.systems.world;
        return w ? w.getTerrainHeight(x, z) : 0;
    }

    init() {
        this.spawnInitialPedestrians();
        this.spawnInitialTraffic();
    }

    spawnInitialPedestrians() {
        for (let i = 0; i < this.maxPedestrians; i++) {
            this.spawnPedestrian();
        }
    }

    spawnInitialTraffic() {
        for (let i = 0; i < this.maxTraffic; i++) {
            this.spawnTrafficVehicle();
        }
    }

    spawnPedestrian(forceSpawn = false) {
        // Enforce spawn cap unless forced (e.g. mission/event spawns)
        if (!forceSpawn && this.pedestrians.length >= this.maxPedestrians + 5) {
            return null;
        }
        const player = this.game.systems.player;
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * this.spawnRadius;
        const x = player.position.x + Math.cos(angle) * dist;
        const z = player.position.z + Math.sin(angle) * dist;

        // Get district for color palette
        const world = this.game.systems.world;
        const district = world ? world.getDistrictName(x, z) : 'Downtown';

        // Idle behavior type
        const idleBehaviors = ['walking', 'walking', 'walking', 'walking',
                               'phone', 'standing', 'sitting'];
        const idleBehavior = idleBehaviors[Math.floor(Math.random() * idleBehaviors.length)];

        const npc = {
            mesh: null,
            alive: true,
            health: 50,
            speed: 2 + Math.random(),
            walkDir: Math.random() * Math.PI * 2,
            walkTimer: 3 + Math.random() * 5,
            isFleeing: false,
            fleeTarget: null,
            dialogueCooldown: 5 + Math.random() * 15,
            isMale: Math.random() > 0.5,
            district: district,
            idleBehavior: idleBehavior,
            idleTimer: 0,
            _phoneAngle: 0,
            _phoneBobTime: 0,
            _isJaywalker: Math.random() < 0.1,
            _waitingAtCrosswalk: false,
            _crosswalkWaitTime: 0,
            // Reaction system
            _reaction: null,       // 'duck', 'cheer', 'record', 'cower'
            _reactionTimer: 0,
            _reactionCooldown: 0,
            _recordingTarget: null
        };

        // Add takeDamage method directly on NPC object
        npc.takeDamage = (amount) => {
            this.npcTakeDamage(npc, amount);
        };

        npc.mesh = this.createNPCModel(npc.isMale, district);
        npc.mesh.position.set(x, this._getGroundY(x, z), z);
        this.game.scene.add(npc.mesh);

        // Animation state
        npc.animTime = Math.random() * 10;

        this.pedestrians.push(npc);
        return npc;
    }

    createNPCModel(isMale, district) {
        const models = this.game.systems.models;

        // Get district-specific palette, fallback to generic
        const palette = this.districtPalettes[district] || this.districtPalettes['Downtown'];

        // Determine gender for model selection
        const gender = isMale ? 'male' : 'female';
        const modelKey = isMale ? 'character' : 'character_female';

        // Try to use .glb character model (prefer gender-specific, fallback to male)
        const hasGenderModel = models && models.hasModel(modelKey);
        const hasFallbackModel = models && models.hasModel('character');
        if (hasGenderModel || hasFallbackModel) {
            const model = hasGenderModel
                ? models.cloneCharacter(gender)
                : models.cloneCharacter('male');

            // Randomize material colors
            const skinColors = [0xd4a574, 0xc49060, 0x8d5524, 0xf1c27d, 0xe0ac69, 0xb87a50,
                                0xdeb887, 0xa0522d, 0xcd853f, 0xf5deb3, 0x6b4226, 0xd2691e];
            const shirtColors = palette.shirts;
            const pantsColors = palette.pants;

            const skinColor = skinColors[Math.floor(Math.random() * skinColors.length)];
            const shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
            const pantsColor = pantsColors[Math.floor(Math.random() * pantsColors.length)];

            // Apply colors to cloned model's materials
            model.traverse((child) => {
                if (child.isMesh || child.isSkinnedMesh) {
                    // Clone material so each NPC has unique colors
                    child.material = child.material.clone();
                    // Use vertex colors from the model, tint based on body region
                    child.material.color.setHex(shirtColor);
                }
            });

            // Random height scale 0.9-1.1
            const heightScale = 0.9 + Math.random() * 0.2;
            model.scale.setScalar(heightScale);

            // Set up AnimationMixer — use gender-specific anims if available
            const clips = hasGenderModel
                ? models.getCharacterAnimations(gender)
                : models.getCharacterAnimations('male');
            if (clips.length > 0) {
                const mixer = new THREE.AnimationMixer(model);
                const actions = {};

                const onceAnims = new Set([
                    'punch', 'jump', 'carjack', 'enter_vehicle', 'exit_vehicle',
                    'melee_combo2', 'melee_combo3', 'melee_bat', 'melee_knife',
                    'fire_pistol', 'fire_rifle', 'fall', 'land_hard',
                    'death_front', 'death_back', 'pulled_from_car',
                    'aimed_at_cower', 'aimed_at_comply', 'aim_pistol', 'aim_rifle',
                    'hands_up', 'sit_bench', 'lean_wall'
                ]);
                for (const clip of clips) {
                    const action = mixer.clipAction(clip);
                    actions[clip.name] = action;
                    if (onceAnims.has(clip.name)) {
                        action.setLoop(THREE.LoopOnce);
                        action.clampWhenFinished = true;
                    } else {
                        action.setLoop(THREE.LoopRepeat);
                    }
                }

                // Start with idle
                if (actions.idle) {
                    actions.idle.play();
                }

                model.userData.mixer = mixer;
                model.userData.actions = actions;
                model.userData.currentAction = actions.idle || null;
                model.userData.useSkeleton = true;
            }

            // Apply NPC character texture if UVs are available
            let skinnedMesh;
            model.traverse(c => { if (c.isSkinnedMesh) skinnedMesh = c; });
            if (skinnedMesh && skinnedMesh.geometry.getAttribute('uv')) {
                const npcTexture = this._getNPCTexture(isMale);
                skinnedMesh.material.map = npcTexture;
                skinnedMesh.material.needsUpdate = true;
            }

            return model;
        }

        // Fallback: primitive model
        return this._createFallbackNPCModel(isMale, district);
    }

    _createFallbackNPCModel(isMale, district) {
        const group = new THREE.Group();

        const palette = this.districtPalettes[district] || this.districtPalettes['Downtown'];
        const skinColors = [0xd4a574, 0xc49060, 0x8d5524, 0xf1c27d, 0xe0ac69];
        const shirtColors = palette.shirts;
        const pantsColors = palette.pants;
        const hairColors = [0x221100, 0x111111, 0x553311, 0x884422, 0x222222];

        const skinColor = skinColors[Math.floor(Math.random() * skinColors.length)];
        const shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
        const pantsColor = pantsColors[Math.floor(Math.random() * pantsColors.length)];
        const hairColor = hairColors[Math.floor(Math.random() * hairColors.length)];

        const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
        const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
        const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
        const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });
        const shoeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

        // Random height scale
        const heightScale = 0.9 + Math.random() * 0.2;

        // Head
        const headGeo = new THREE.SphereGeometry(0.19, 8, 8);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.7 * heightScale, 0);
        head.castShadow = true;
        group.add(head);

        // Hair variety (3 styles)
        const hairStyle = Math.floor(Math.random() * 3);
        if (hairStyle === 0) {
            const hGeo = new THREE.BoxGeometry(0.32, 0.1, 0.3);
            const h = new THREE.Mesh(hGeo, hairMat);
            h.position.set(0, 1.82 * heightScale, -0.02);
            group.add(h);
        } else if (hairStyle === 1) {
            const hGeo = new THREE.SphereGeometry(0.2, 6, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
            const h = new THREE.Mesh(hGeo, hairMat);
            h.position.set(0, 1.75 * heightScale, 0);
            group.add(h);
        } else {
            const hGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 8);
            const h = new THREE.Mesh(hGeo, hairMat);
            h.position.set(0, 1.84 * heightScale, 0);
            group.add(h);
        }

        // Torso
        const torsoGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.6, 8);
        const torso = new THREE.Mesh(torsoGeo, shirtMat);
        torso.position.set(0, 1.1 * heightScale, 0);
        torso.castShadow = true;
        group.add(torso);

        // Arms with hands
        for (const side of [-1, 1]) {
            const upperArmGeo = new THREE.CylinderGeometry(0.07, 0.065, 0.3, 6);
            const upperArm = new THREE.Mesh(upperArmGeo, shirtMat);
            upperArm.position.set(side * 0.37, 1.2 * heightScale, 0);
            group.add(upperArm);

            const forearmGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.25, 6);
            const forearm = new THREE.Mesh(forearmGeo, skinMat);
            forearm.position.set(side * 0.37, 0.95 * heightScale, 0);
            group.add(forearm);

            const handGeo = new THREE.BoxGeometry(0.05, 0.06, 0.05);
            const hand = new THREE.Mesh(handGeo, skinMat);
            hand.position.set(side * 0.37, 0.8 * heightScale, 0);
            group.add(hand);
        }

        // Legs with feet
        for (const side of [-1, 1]) {
            const thighGeo = new THREE.CylinderGeometry(0.085, 0.075, 0.35, 6);
            const thigh = new THREE.Mesh(thighGeo, pantsMat);
            thigh.position.set(side * 0.12, 0.55 * heightScale, 0);
            group.add(thigh);

            const shinGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.3, 6);
            const shin = new THREE.Mesh(shinGeo, pantsMat);
            shin.position.set(side * 0.12, 0.25 * heightScale, 0);
            group.add(shin);

            const shoeGeo = new THREE.BoxGeometry(0.1, 0.06, 0.16);
            const shoe = new THREE.Mesh(shoeGeo, shoeMat);
            shoe.position.set(side * 0.12, 0.03 * heightScale, 0.02);
            group.add(shoe);
        }

        group.userData.parts = {
            head: group.children[0],
            torso: group.children[2],
            leftArm: group.children[3],
            leftForearm: group.children[4],
            rightArm: group.children[6],
            rightForearm: group.children[7],
            leftLeg: group.children[9],
            leftShin: group.children[10],
            rightLeg: group.children[12],
            rightShin: group.children[13]
        };

        group.scale.setScalar(heightScale > 1.05 ? 1.05 : (heightScale < 0.95 ? 0.95 : 1));

        return group;
    }

    spawnTrafficVehicle() {
        const player = this.game.systems.player;
        const angle = Math.random() * Math.PI * 2;
        const dist = 50 + Math.random() * 50;
        const x = player.position.x + Math.cos(angle) * dist;
        const z = player.position.z + Math.sin(angle) * dist;

        const types = ['sedan', 'sedan', 'sedan', 'truck'];
        const type = types[Math.floor(Math.random() * types.length)];
        const isTaxi = Math.random() < 0.1; // ~10% chance of taxi

        const vehicle = this.game.systems.vehicles.spawnVehicle(x, z, type);
        if (vehicle) {
            vehicle.isTraffic = true;
            vehicle.isNPCOwned = true;
            vehicle.mesh.rotation.y = angle;

            // Make taxi vehicles yellow
            if (isTaxi && type === 'sedan') {
                vehicle._isTaxi = true;
                vehicle.mesh.traverse(child => {
                    if (child.isMesh && child.material && child.material.color) {
                        child.material = child.material.clone();
                        child.material.color.setHex(0xffcc00);
                    }
                });
            }

            this.trafficVehicles.push(vehicle);

            // Add visible driver NPC
            this._addDriverModel(vehicle);
        }
    }

    _addDriverModel(vehicle) {
        const vType = this.game.systems.vehicles.vehicleTypes[vehicle.type];
        if (!vType || vehicle.type === 'boat' || vehicle.type === 'helicopter') return;

        const skinColors = [0xd4a574, 0xc49060, 0x8d5524, 0xf1c27d];
        const shirtColors = [0x2c3e50, 0x34495e, 0x444444, 0x555555, 0x663333];

        const skinColor = skinColors[Math.floor(Math.random() * skinColors.length)];
        const shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
        const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
        const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });

        const driver = new THREE.Group();

        // Head
        const headGeo = new THREE.SphereGeometry(0.14, 6, 6);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(-0.3, vType.height * 0.75, 0.2);
        driver.add(head);

        // Torso (seated)
        const torsoGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.35, 6);
        const torso = new THREE.Mesh(torsoGeo, shirtMat);
        torso.position.set(-0.3, vType.height * 0.5, 0.2);
        driver.add(torso);

        // Arms (reaching for steering wheel)
        for (const side of [-1, 1]) {
            const armGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.25, 4);
            const arm = new THREE.Mesh(armGeo, shirtMat);
            arm.rotation.x = -0.6;
            arm.position.set(-0.3 + side * 0.22, vType.height * 0.55, 0.35);
            driver.add(arm);
        }

        vehicle.mesh.add(driver);
        vehicle._driverModel = driver;
    }

    update(dt) {
        const player = this.game.systems.player;

        // Dynamically adjust population density based on district + time
        this._updatePopulationDensity();

        // Update pedestrians with distance-based LOD
        const playerPos = player.position;
        for (let i = 0; i < this.pedestrians.length; i++) {
            const npc = this.pedestrians[i];
            if (!npc.alive) continue;
            if (!npc.mesh) continue;

            const dx = npc.mesh.position.x - playerPos.x;
            const dz = npc.mesh.position.z - playerPos.z;
            const distSq = dx * dx + dz * dz;

            if (distSq > 80 * 80) {
                // >80m: skip animation updates entirely, only update position every 4th frame
                if (npc.mesh.userData.mixer) npc.mesh.userData.mixer.timeScale = 0;
                if ((this.game.frameCount + i) % 4 === 0) {
                    this.updatePedestrian(npc, dt * 4);
                }
            } else if (distSq > 50 * 50) {
                // >50m: half-rate updates, slow animation
                if (npc.mesh.userData.mixer) npc.mesh.userData.mixer.timeScale = 0.5;
                if ((this.game.frameCount + i) % 2 === 0) {
                    this.updatePedestrian(npc, dt * 2);
                }
            } else {
                // Close: full update
                if (npc.mesh.userData.mixer) npc.mesh.userData.mixer.timeScale = 1;
                this.updatePedestrian(npc, dt);
            }
        }

        // Respawn/recycle pedestrians
        this.managePedestrianPool();

        // Dialogue timer
        this.dialogueTimer -= dt;
        if (this.dialogueTimer <= 0) {
            this.triggerRandomDialogue();
            this.dialogueTimer = 3 + Math.random() * 8;
        }

        // World events
        this._updateWorldEvents(dt);
    }

    // --- NPC Character Texture Caching ---
    _getNPCTexture(isMale) {
        if (!this._npcTextureCache) this._npcTextureCache = {};
        const key = isMale ? 'male' : 'female';
        // Cache 3 variants per gender, pick randomly
        const variant = Math.floor(Math.random() * 3);
        const cacheKey = key + variant;
        if (this._npcTextureCache[cacheKey]) return this._npcTextureCache[cacheKey];

        const texture = this._generateNPCTexture(isMale, variant);
        this._npcTextureCache[cacheKey] = texture;
        return texture;
    }

    _generateNPCTexture(isMale, variant) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base fill: near-white
        ctx.fillStyle = '#f8f6f4';
        ctx.fillRect(0, 0, 512, 512);

        // ── Torso region (0-256 x, 0-170 y) ──
        // Shirt detail varies by variant
        ctx.strokeStyle = 'rgba(60,50,40,0.3)';
        ctx.lineWidth = 1;

        if (variant === 0) {
            // V-neck collar
            ctx.beginPath();
            ctx.moveTo(105, 10);
            ctx.lineTo(128, 50);
            ctx.lineTo(151, 10);
            ctx.stroke();
            // Hem line
            ctx.beginPath();
            ctx.moveTo(50, 155);
            ctx.lineTo(206, 155);
            ctx.stroke();
        } else if (variant === 1) {
            // Crew neck (round collar line)
            ctx.beginPath();
            ctx.arc(128, 15, 30, 0.2, Math.PI - 0.2);
            ctx.stroke();
            // Shoulder seams
            for (const sx of [55, 201]) {
                ctx.beginPath();
                ctx.moveTo(sx, 15);
                ctx.lineTo(sx + (sx < 128 ? 15 : -15), 30);
                ctx.stroke();
            }
        } else {
            // Button-up with pocket
            ctx.beginPath();
            ctx.moveTo(128, 15);
            ctx.lineTo(128, 155);
            ctx.stroke();
            // Buttons
            ctx.fillStyle = 'rgba(60,50,40,0.3)';
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.arc(128, 30 + i * 25, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.strokeStyle = 'rgba(50,40,30,0.2)';
            ctx.strokeRect(140, 50, 28, 20);
        }

        // ── Pants region (0-256 x, 170-340 y) ──
        // Subtle fabric pattern
        ctx.strokeStyle = 'rgba(50,45,55,0.1)';
        ctx.lineWidth = 0.5;
        for (let i = -170; i < 256; i += 8) {
            ctx.beginPath();
            ctx.moveTo(i, 170);
            ctx.lineTo(i + 170, 340);
            ctx.stroke();
        }
        // Side seams
        ctx.strokeStyle = 'rgba(50,45,55,0.2)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(60, 175);
        ctx.lineTo(60, 335);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(196, 175);
        ctx.lineTo(196, 335);
        ctx.stroke();

        // ── Face region (256-512 x, 0-170 y) ──
        const fx = 384, fy = 85;

        // Eyebrows — thinner for female
        ctx.strokeStyle = 'rgba(40,30,20,0.55)';
        ctx.lineWidth = isMale ? 2.5 : 1.5;
        for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(fx + side * 28, fy - 16, 16, Math.PI * 1.15, Math.PI * 1.85);
            ctx.stroke();
        }

        // Eyes
        for (const side of [-1, 1]) {
            const ex = fx + side * 28, ey = fy;
            ctx.fillStyle = 'rgba(30,25,20,0.65)';
            ctx.beginPath();
            ctx.ellipse(ex, ey, 9, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(240,240,240,0.85)';
            ctx.beginPath();
            ctx.arc(ex + side * 3, ey - 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // Eyelashes for female
            if (!isMale) {
                ctx.strokeStyle = 'rgba(30,20,10,0.4)';
                ctx.lineWidth = 0.8;
                for (let l = 0; l < 3; l++) {
                    const lAngle = Math.PI * 1.2 + l * 0.25;
                    ctx.beginPath();
                    ctx.moveTo(ex + Math.cos(lAngle) * 9, ey + Math.sin(lAngle) * 6);
                    ctx.lineTo(ex + Math.cos(lAngle) * 12, ey + Math.sin(lAngle) * 9);
                    ctx.stroke();
                }
            }
        }

        // Lips — more color for female
        ctx.fillStyle = isMale ? 'rgba(160,100,90,0.4)' : 'rgba(200,80,80,0.55)';
        ctx.beginPath();
        ctx.ellipse(fx, fy + 28, isMale ? 12 : 13, isMale ? 4 : 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Chin
        ctx.strokeStyle = 'rgba(60,50,40,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(fx, fy + 48, 22, Math.PI * 0.25, Math.PI * 0.75);
        ctx.stroke();

        // Male stubble
        if (isMale && variant !== 2) {
            ctx.fillStyle = 'rgba(40,35,30,0.06)';
            for (let i = 0; i < 60; i++) {
                const sx = fx - 22 + Math.random() * 44;
                const sy = fy + 20 + Math.random() * 28;
                ctx.beginPath();
                ctx.arc(sx, sy, 0.7, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ── Arms region (256-512 x, 170-340 y) ──
        ctx.strokeStyle = 'rgba(50,40,30,0.25)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(280, 215);
        ctx.lineTo(488, 215);
        ctx.stroke();

        // ── Shoes region (0-256 x, 340-512 y) ──
        ctx.strokeStyle = 'rgba(40,35,25,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(50, 440);
        ctx.lineTo(206, 440);
        ctx.stroke();

        // ── Hair region (256-512 x, 340-512 y) ──
        ctx.strokeStyle = 'rgba(20,15,10,0.18)';
        ctx.lineWidth = 0.7;
        for (let i = 0; i < 20; i++) {
            const sy = 350 + i * 7;
            ctx.beginPath();
            ctx.moveTo(270, sy);
            ctx.bezierCurveTo(330, sy + Math.sin(i) * 3, 430, sy - Math.sin(i) * 3, 500, sy);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    updatePedestrian(npc, dt) {
        if (!npc.mesh) return;

        const player = this.game.systems.player;
        const world = this.game.systems.world;
        const blockSize = world.blockSize;
        const roadHalf = world.roadWidth / 2;
        const sidewalkOffset = roadHalf + 1.5;

        // Initialize sidewalk-following state
        if (npc.roadFollowAxis === undefined) {
            npc.roadFollowAxis = Math.random() > 0.5 ? 0 : 1; // 0=X road, 1=Z road
            npc.roadFollowDir = Math.random() > 0.5 ? 1 : -1;
            npc.sidewalkSide = Math.random() > 0.5 ? 1 : -1;
            npc.cornerPause = 0;
            npc.turnCooldown = 0;
        }

        if (npc.isFleeing) {
            // Run away from danger
            const speed = npc.speed * 2.5;
            // Water avoidance
            const nextX = npc.mesh.position.x + Math.sin(npc.walkDir) * speed * dt;
            const nextZ = npc.mesh.position.z + Math.cos(npc.walkDir) * speed * dt;
            if (this.game.systems.world.isInWater(nextX, nextZ)) {
                npc.walkDir = npc.walkDir + Math.PI;
            }
            npc.mesh.position.x += Math.sin(npc.walkDir) * speed * dt;
            npc.mesh.position.z += Math.cos(npc.walkDir) * speed * dt;
            npc.mesh.position.y = this._getGroundY(npc.mesh.position.x, npc.mesh.position.z);
            npc.mesh.rotation.y = npc.walkDir;

            if (npc.fleeTarget) {
                const distToPlayer = npc.mesh.position.distanceTo(player.position);
                if (distToPlayer > 50) {
                    npc.isFleeing = false;
                }
            }
        } else if (npc._reaction) {
            // Active reaction — handle animations/behavior
            npc._reactionTimer -= dt;

            if (npc._reactionTimer <= 0) {
                // Reaction finished — reset pose
                npc._reaction = null;
                npc._reactionCooldown = 8 + Math.random() * 5;
                npc._recordingTarget = null;
                npc.mesh.position.y = this._getGroundY(npc.mesh.position.x, npc.mesh.position.z);
                const rParts = npc.mesh.userData.parts;
                if (rParts) {
                    if (rParts.torso) rParts.torso.rotation.set(0, 0, 0);
                    if (rParts.head) rParts.head.rotation.set(0, 0, 0);
                    if (rParts.leftArm) rParts.leftArm.rotation.set(0, 0, 0);
                    if (rParts.rightArm) rParts.rightArm.rotation.set(0, 0, 0);
                    if (rParts.leftForearm) rParts.leftForearm.rotation.set(0, 0, 0);
                    if (rParts.rightForearm) rParts.rightForearm.rotation.set(0, 0, 0);
                    if (rParts.leftLeg) rParts.leftLeg.rotation.set(0, 0, 0);
                    if (rParts.rightLeg) rParts.rightLeg.rotation.set(0, 0, 0);
                    if (rParts.leftShin) rParts.leftShin.rotation.set(0, 0, 0);
                    if (rParts.rightShin) rParts.rightShin.rotation.set(0, 0, 0);
                }
            } else {
                const parts = npc.mesh.userData.parts;
                switch (npc._reaction) {
                    case 'duck':
                        // Crouch down — bend torso and legs, hands over head
                        if (parts) {
                            if (parts.torso) parts.torso.rotation.x = 0.7;
                            if (parts.head) parts.head.rotation.x = 0.4;
                            // Hands over head
                            if (parts.leftArm) parts.leftArm.rotation.x = -1.5;
                            if (parts.rightArm) parts.rightArm.rotation.x = -1.5;
                            if (parts.leftForearm) parts.leftForearm.rotation.x = -1.2;
                            if (parts.rightForearm) parts.rightForearm.rotation.x = -1.2;
                            // Bend knees
                            if (parts.leftLeg) parts.leftLeg.rotation.x = -0.6;
                            if (parts.rightLeg) parts.rightLeg.rotation.x = -0.6;
                            if (parts.leftShin) parts.leftShin.rotation.x = 0.6;
                            if (parts.rightShin) parts.rightShin.rotation.x = 0.6;
                        }
                        break;

                    case 'cower':
                        // Crouch low and shake
                        if (parts) {
                            if (parts.torso) parts.torso.rotation.x = 0.8;
                            if (parts.head) {
                                parts.head.rotation.x = 0.5;
                                parts.head.rotation.z = Math.sin(npc._reactionTimer * 15) * 0.08;
                            }
                            if (parts.leftArm) parts.leftArm.rotation.x = -1.6;
                            if (parts.rightArm) parts.rightArm.rotation.x = -1.6;
                            if (parts.leftForearm) parts.leftForearm.rotation.x = -1.2;
                            if (parts.rightForearm) parts.rightForearm.rotation.x = -1.2;
                            // Bent knees
                            if (parts.leftLeg) parts.leftLeg.rotation.x = -0.7;
                            if (parts.rightLeg) parts.rightLeg.rotation.x = -0.7;
                            if (parts.leftShin) parts.leftShin.rotation.x = 0.7;
                            if (parts.rightShin) parts.rightShin.rotation.x = 0.7;
                        }
                        break;

                    case 'cheer':
                        // Pump fists in the air
                        npc.mesh.position.y = this._getGroundY(npc.mesh.position.x, npc.mesh.position.z);
                        if (parts) {
                            const cheerTime = npc._reactionTimer * 6;
                            if (parts.leftArm) parts.leftArm.rotation.x = -2.5 + Math.sin(cheerTime) * 0.4;
                            if (parts.rightArm) parts.rightArm.rotation.x = -2.5 + Math.sin(cheerTime + 1) * 0.4;
                            if (parts.leftForearm) parts.leftForearm.rotation.x = -0.3;
                            if (parts.rightForearm) parts.rightForearm.rotation.x = -0.3;
                            // Slight jump bob
                            npc.mesh.position.y = Math.abs(Math.sin(cheerTime * 1.5)) * 0.15;
                        }
                        // Face the action
                        if (npc._recordingTarget) {
                            const dx = npc._recordingTarget.x - npc.mesh.position.x;
                            const dz = npc._recordingTarget.z - npc.mesh.position.z;
                            npc.mesh.rotation.y = Math.atan2(dx, dz);
                        }
                        break;

                    case 'record':
                        // Hold phone up and face the action
                        npc.mesh.position.y = this._getGroundY(npc.mesh.position.x, npc.mesh.position.z);
                        if (parts) {
                            // Right arm holds phone up
                            if (parts.rightArm) parts.rightArm.rotation.x = -2.0;
                            if (parts.rightForearm) parts.rightForearm.rotation.x = -0.8;
                            // Left arm steady
                            if (parts.leftArm) parts.leftArm.rotation.x = 0;
                            // Slight head tilt looking at phone
                            if (parts.head) parts.head.rotation.x = -0.15;
                        }
                        // Face the action
                        if (npc._recordingTarget) {
                            const dx = npc._recordingTarget.x - npc.mesh.position.x;
                            const dz = npc._recordingTarget.z - npc.mesh.position.z;
                            npc.mesh.rotation.y = Math.atan2(dx, dz);
                        }
                        break;

                    case 'flinch':
                        // Stumble back, arms up defensively
                        npc.mesh.position.y = this._getGroundY(npc.mesh.position.x, npc.mesh.position.z);
                        if (parts) {
                            if (parts.torso) parts.torso.rotation.x = -0.3;
                            if (parts.leftArm) parts.leftArm.rotation.x = -1.2;
                            if (parts.rightArm) parts.rightArm.rotation.x = -1.2;
                            if (parts.leftForearm) parts.leftForearm.rotation.x = -0.8;
                            if (parts.rightForearm) parts.rightForearm.rotation.x = -0.8;
                            if (parts.head) parts.head.rotation.y = 0.4;
                        }
                        // Step back slightly away from threat
                        if (npc._recordingTarget) {
                            const fdx = npc.mesh.position.x - npc._recordingTarget.x;
                            const fdz = npc.mesh.position.z - npc._recordingTarget.z;
                            const fLen = Math.sqrt(fdx * fdx + fdz * fdz) || 1;
                            npc.mesh.position.x += (fdx / fLen) * 0.5 * dt;
                            npc.mesh.position.z += (fdz / fLen) * 0.5 * dt;
                        }
                        break;

                    case 'look':
                        // Turn and look toward the point
                        npc.mesh.position.y = this._getGroundY(npc.mesh.position.x, npc.mesh.position.z);
                        if (npc._recordingTarget) {
                            const ldx = npc._recordingTarget.x - npc.mesh.position.x;
                            const ldz = npc._recordingTarget.z - npc.mesh.position.z;
                            npc.mesh.rotation.y = Math.atan2(ldx, ldz);
                        }
                        if (parts) {
                            if (parts.head) parts.head.rotation.z = 0.1;
                        }
                        break;
                }
                // Skip normal walking while reacting
                npc.animTime += dt * 2;
                return;
            }
        } else {
            npc.turnCooldown = Math.max(0, (npc.turnCooldown || 0) - dt);

            // Reaction cooldown tick
            if (npc._reactionCooldown > 0) npc._reactionCooldown -= dt;

            // Sidewalk vehicle panic — flee from fast nearby vehicles (check every 10th frame)
            if (this.game.frameCount % 10 === 0) {
                const panicVehicles = this.game.systems.vehicles?.vehicles || [];
                for (const veh of panicVehicles) {
                    if (!veh.mesh || veh._destroyed) continue;
                    const vSpeed = Math.abs(veh.speed || 0);
                    if (vSpeed < 5) continue;
                    const vdx = npc.mesh.position.x - veh.mesh.position.x;
                    const vdz = npc.mesh.position.z - veh.mesh.position.z;
                    const vDistSq = vdx * vdx + vdz * vdz;
                    if (vDistSq < 8 * 8) {
                        npc.isFleeing = true;
                        npc.fleeTarget = veh.mesh.position.clone();
                        npc.walkDir = Math.atan2(vdx, vdz);
                        if (Math.random() < 0.4) {
                            const lines = this.fleeDialogue;
                            const line = lines[Math.floor(Math.random() * lines.length)];
                            this.showNPCSubtitle(npc, line);
                        }
                        break;
                    }
                }
            }

            // Idle behaviors: phone checking, standing around, sitting
            if (npc.idleBehavior === 'phone' || npc.idleBehavior === 'standing' || npc.idleBehavior === 'sitting') {
                npc.idleTimer = (npc.idleTimer || 0) + dt;
                // Stand idle for 8-15 seconds, then start walking
                if (npc.idleTimer > 8 + Math.random() * 7) {
                    npc.idleBehavior = 'walking';
                    npc.idleTimer = 0;
                    npc._currentAnim = null; // Reset so walk anim triggers
                }

                // GLTF idle behavior animations
                const npcMixer = npc.mesh.userData.mixer;
                const npcActions = npc.mesh.userData.actions;
                if (npcMixer && npcActions) {
                    const idleAnimMap = {
                        'phone': 'phone_talk',
                        'sitting': 'sit_bench',
                        'leaning': 'lean_wall'
                    };
                    const animName = idleAnimMap[npc.idleBehavior];
                    if (animName && npcActions[animName] && npc._currentAnim !== animName) {
                        if (npc.mesh.userData.currentAction) npc.mesh.userData.currentAction.fadeOut(0.3);
                        npcActions[animName].reset().fadeIn(0.3).play();
                        npc.mesh.userData.currentAction = npcActions[animName];
                        npc._currentAnim = animName;
                    }
                }

                // Phone check: subtle head bob (fallback for non-skeleton models)
                if (npc.idleBehavior === 'phone' && !npc.mesh.userData.useSkeleton) {
                    npc._phoneBobTime = (npc._phoneBobTime || 0) + dt;
                    const parts = npc.mesh.userData.parts;
                    if (parts && parts.head) {
                        parts.head.rotation.x = Math.sin(npc._phoneBobTime * 0.5) * 0.05 + 0.2;
                    }
                    if (parts && parts.rightArm) {
                        parts.rightArm.rotation.x = -0.8;
                    }
                    if (parts && parts.rightForearm) {
                        parts.rightForearm.rotation.x = -0.8;
                    }
                }
                npc.animTime += dt * 2;
                return;
            }

            // Corner pause
            if (npc.cornerPause > 0) {
                npc.cornerPause -= dt;
                // Still animate idle
                npc.animTime += dt * 2;
                return;
            }

            // Walk along sidewalk parallel to current road
            const speed = npc.speed;
            let targetX = npc.mesh.position.x;
            let targetZ = npc.mesh.position.z;

            if (npc.roadFollowAxis === 1) {
                // Walking along Z axis, stay on sidewalk of nearest X-road
                const nearestRoadX = Math.round(npc.mesh.position.x / blockSize) * blockSize;
                targetX = nearestRoadX + npc.sidewalkSide * sidewalkOffset;
                targetZ = npc.mesh.position.z + npc.roadFollowDir * speed * dt;
                npc.walkDir = npc.roadFollowDir > 0 ? 0 : Math.PI;
            } else {
                // Walking along X axis, stay on sidewalk of nearest Z-road
                const nearestRoadZ = Math.round(npc.mesh.position.z / blockSize) * blockSize;
                targetZ = nearestRoadZ + npc.sidewalkSide * sidewalkOffset;
                targetX = npc.mesh.position.x + npc.roadFollowDir * speed * dt;
                npc.walkDir = npc.roadFollowDir > 0 ? Math.PI / 2 : -Math.PI / 2;
            }

            // Gently correct toward sidewalk
            const corrX = npc.mesh.position.x + (targetX - npc.mesh.position.x) * Math.min(1, dt * 3);
            const corrZ = npc.mesh.position.z + (targetZ - npc.mesh.position.z) * Math.min(1, dt * 3);

            // Intersection detection: near a multiple of blockSize on BOTH axes
            const nearIntX = Math.abs(corrX - Math.round(corrX / blockSize) * blockSize) < roadHalf + 2;
            const nearIntZ = Math.abs(corrZ - Math.round(corrZ / blockSize) * blockSize) < roadHalf + 2;
            const atIntersection = nearIntX && nearIntZ && npc.turnCooldown <= 0;

            if (atIntersection) {
                // Check crosswalk signal before crossing
                const isJaywalker = npc._isJaywalker;
                const pedestrianRed = world.isPedestrianRed ? world.isPedestrianRed(npc.roadFollowAxis) : false;

                if (pedestrianRed && !isJaywalker) {
                    // Wait at the crosswalk — stand still, face the road
                    if (!npc._waitingAtCrosswalk) {
                        npc._waitingAtCrosswalk = true;
                        npc._crosswalkWaitTime = 0;
                    }
                    npc._crosswalkWaitTime += dt;
                    // After waiting too long (>20s), jaywalk
                    if (npc._crosswalkWaitTime < 20) {
                        npc.animTime += dt * 2; // idle animation
                        return;
                    }
                }

                // Signal is green or jaywalking — cross
                npc._waitingAtCrosswalk = false;
                npc._crosswalkWaitTime = 0;

                // Pause briefly at corner
                npc.cornerPause = 0.3 + Math.random() * 0.3;
                npc.turnCooldown = 4;

                // Randomly turn 90 degrees (40%) or continue straight (60%)
                if (Math.random() < 0.4) {
                    npc.roadFollowAxis = npc.roadFollowAxis === 0 ? 1 : 0;
                    npc.roadFollowDir = Math.random() > 0.5 ? 1 : -1;
                }
            } else {
                npc._waitingAtCrosswalk = false;
            }

            // Check for nearby vehicles - step back if one is approaching
            const vehicles = this.game.systems.vehicles;
            if (vehicles) {
                for (const v of vehicles.vehicles) {
                    if (!v.mesh || Math.abs(v.speed) < 2) continue;
                    const dx = npc.mesh.position.x - v.mesh.position.x;
                    const dz = npc.mesh.position.z - v.mesh.position.z;
                    const distToV = Math.sqrt(dx * dx + dz * dz);

                    if (distToV < 8) {
                        // Check if vehicle is heading toward NPC
                        const vFwd = new THREE.Vector3(
                            Math.sin(v.mesh.rotation.y),
                            0,
                            Math.cos(v.mesh.rotation.y)
                        );
                        const toNPC = new THREE.Vector3(dx, 0, dz).normalize();
                        const dot = vFwd.dot(toNPC);

                        if (dot > 0.3 && distToV < 5) {
                            // Vehicle approaching — jump out of the way
                            const perpX = -vFwd.z;
                            const perpZ = vFwd.x;
                            const side = (perpX * dx + perpZ * dz > 0) ? 1 : -1;
                            npc.mesh.position.x += perpX * side * speed * 3 * dt;
                            npc.mesh.position.z += perpZ * side * speed * 3 * dt;
                            break;
                        } else if (distToV < 3) {
                            // Very close, push away regardless
                            const len = distToV || 1;
                            npc.mesh.position.x += (dx / len) * speed * 2 * dt;
                            npc.mesh.position.z += (dz / len) * speed * 2 * dt;
                            break;
                        }
                    }
                }
            }

            // Water avoidance
            if (this.game.systems.world.isInWater(corrX, corrZ)) {
                npc.roadFollowDir *= -1;
                npc.turnCooldown = 2;
            }

            // Building collision
            const collision = world.checkCollision(corrX, corrZ, 0.4);
            if (collision) {
                npc.roadFollowDir *= -1;
                npc.turnCooldown = 2;
            } else if (!this.game.systems.world.isInWater(corrX, corrZ)) {
                npc.mesh.position.x = corrX;
                npc.mesh.position.z = corrZ;
            }

            npc.mesh.rotation.y = npc.walkDir;

            // Weather: walk faster in rain
            const weather = this.game.currentWeather;
            if (weather === 'rain' || weather === 'storm') {
                npc.speed = Math.max(npc.speed, 3.5);
            }

            // Thunderstorm: chance to despawn
            if (weather === 'storm' && Math.random() < 0.001) {
                npc.alive = false;
                if (npc.mesh) {
                    npc.mesh.visible = false;
                }
            }
        }

        // Animation
        if (npc.mesh.userData.useSkeleton && npc.mesh.userData.mixer) {
            // Skeleton animation via AnimationMixer
            const mixer = npc.mesh.userData.mixer;
            const actions = npc.mesh.userData.actions;
            mixer.update(dt);

            // Determine target clip based on movement
            const isMoving = npc.isFleeing || (npc.cornerPause || 0) <= 0;
            const targetClip = npc.isFleeing ? 'run' : (isMoving ? 'walk' : 'idle');

            if (npc._currentClip !== targetClip && actions[targetClip]) {
                // Crossfade to new animation
                const current = npc.mesh.userData.currentAction;
                if (current) current.fadeOut(0.2);
                actions[targetClip].reset().fadeIn(0.2).play();
                npc.mesh.userData.currentAction = actions[targetClip];
                npc._currentClip = targetClip;
            }

            // Adjust playback speed for flee
            if (npc.isFleeing && actions.run) {
                actions.run.timeScale = 1.3;
            }
        } else {
            // Fallback sine-wave animation for primitive model
            npc.animTime += dt * (npc.isFleeing ? 8 : 5);
            const swing = Math.sin(npc.animTime) * 0.3;

            const parts = npc.mesh.userData.parts;
            if (parts) {
                if (parts.leftArm) parts.leftArm.rotation.x = swing;
                if (parts.rightArm) parts.rightArm.rotation.x = -swing;
                if (parts.leftLeg) parts.leftLeg.rotation.x = -swing;
                if (parts.rightLeg) parts.rightLeg.rotation.x = swing;
                if (parts.leftForearm) parts.leftForearm.rotation.x = swing * 0.5;
                if (parts.rightForearm) parts.rightForearm.rotation.x = -swing * 0.5;
                if (parts.leftShin) parts.leftShin.rotation.x = -swing * 0.3;
                if (parts.rightShin) parts.rightShin.rotation.x = swing * 0.3;
            }
        }
    }

    _updatePopulationDensity() {
        const player = this.game.systems.player;
        const world = this.game.systems.world;
        if (!world || !player) return;

        const district = world.getDistrictName(player.position.x, player.position.z);
        const timeOfDay = this.game.timeOfDay || 0.3;
        const sunAngle = timeOfDay * Math.PI * 2;
        const sunHeight = Math.sin(sunAngle - Math.PI * 0.5);
        const dayFactor = Math.max(0, Math.min(1, sunHeight * 2 + 0.5));

        // Get district multiplier
        const distPop = this.districtPopulation[district] || 0.8;
        const timeMod = this.districtTimeModifiers[district] || this.districtTimeModifiers['default'];
        const timeMultiplier = timeMod.night + (timeMod.day - timeMod.night) * dayFactor;

        // Calculate target max pedestrians (12-30 range)
        const targetMax = Math.round(Math.max(12, Math.min(30, this._basePedestrians * distPop * timeMultiplier)));

        // Smooth transition
        if (this.maxPedestrians !== targetMax) {
            this.maxPedestrians = targetMax;
        }

        // If we have more NPCs than max, mark extras for despawn by making them invisible
        // (managePedestrianPool handles the actual recycling)
        let aliveCount = 0;
        for (const npc of this.pedestrians) {
            if (npc.alive && npc.mesh && npc.mesh.visible) aliveCount++;
        }
        // If we need more NPCs, spawn them
        if (aliveCount < this.maxPedestrians && this.pedestrians.length < this.maxPedestrians + 5) {
            this.spawnPedestrian();
        }
    }

    managePedestrianPool() {
        const player = this.game.systems.player;

        for (const npc of this.pedestrians) {
            if (!npc.mesh) continue;

            const dist = npc.mesh.position.distanceTo(player.position);

            // Despawn if too far or dead (but never recycle mission targets or rampage targets)
            if ((dist > this.despawnRadius || !npc.alive) && !npc.isTarget && !npc.isRampageTarget) {
                // Recycle: spawn at edge of spawn radius (behind player's camera)
                const camYaw = this.game.systems.camera ? this.game.systems.camera.yaw : 0;
                // Bias spawn to behind/sides of camera so player doesn't see pop-in
                const angle = camYaw + Math.PI + (Math.random() - 0.5) * Math.PI;
                const spawnDist = this.spawnRadius * 0.7 + Math.random() * this.spawnRadius * 0.3;
                const newX = player.position.x + Math.cos(angle) * spawnDist;
                const newZ = player.position.z + Math.sin(angle) * spawnDist;

                npc.mesh.position.set(newX, this._getGroundY(newX, newZ), newZ);
                npc.alive = true;
                npc.health = 50;
                npc.isFleeing = false;
                npc._reaction = null;
                npc._reactionTimer = 0;
                npc._reactionCooldown = 0;
                npc._recordingTarget = null;
                npc.mesh.visible = true;
                npc.walkDir = Math.random() * Math.PI * 2;
                npc._currentClip = null; // Reset animation state

                // Reset road-following state so NPC snaps to nearest sidewalk
                npc.roadFollowAxis = Math.random() > 0.5 ? 0 : 1;
                npc.roadFollowDir = Math.random() > 0.5 ? 1 : -1;
                npc.sidewalkSide = Math.random() > 0.5 ? 1 : -1;
                npc.cornerPause = 0;
                npc.turnCooldown = 0;
            }
        }
    }

    triggerRandomDialogue() {
        const player = this.game.systems.player;
        const world = this.game.systems.world;
        const playerDistrict = world ? world.getDistrictName(player.position.x, player.position.z) : '';

        // Try NPC-to-NPC conversation (20% chance)
        this._conversationTimer = (this._conversationTimer || 0) - 1;
        if (this._conversationTimer <= 0 && Math.random() < 0.2) {
            this._tryNPCConversation();
            this._conversationTimer = 8;
            return;
        }

        // Find a nearby NPC for player-facing dialogue
        for (const npc of this.pedestrians) {
            if (!npc.alive || !npc.mesh) continue;
            const dist = npc.mesh.position.distanceTo(player.position);
            if (dist < 15 && dist > 3) {
                npc.dialogueCooldown -= 1;
                if (npc.dialogueCooldown <= 0) {
                    let lines;
                    if (npc.isFleeing) {
                        lines = this.fleeDialogue;
                    } else {
                        // Mix general + district-specific dialogue
                        const districtLines = this.districtDialogue[playerDistrict] || [];
                        lines = [...this.normalDialogue, ...districtLines];
                    }
                    const line = lines[Math.floor(Math.random() * lines.length)];
                    this.showNPCSubtitle(npc, line);

                    // Play Animalese voice
                    const pitch = npc.isMale
                        ? 150 + Math.random() * 50
                        : 240 + Math.random() * 60;
                    this.game.systems.audio.playAnimalese(line, pitch, npc.isFleeing ? 'scared' : 'normal');

                    npc.dialogueCooldown = 8 + Math.random() * 15;
                    break;
                }
            }
        }
    }

    _tryNPCConversation() {
        // Find two nearby NPCs that are close to each other AND the player
        const player = this.game.systems.player;
        const nearbyNPCs = [];

        for (const npc of this.pedestrians) {
            if (!npc.alive || !npc.mesh || npc.isFleeing) continue;
            const distToPlayer = npc.mesh.position.distanceTo(player.position);
            if (distToPlayer < 20 && distToPlayer > 3) {
                nearbyNPCs.push(npc);
            }
        }

        // Find a pair within 4m of each other
        for (let i = 0; i < nearbyNPCs.length; i++) {
            for (let j = i + 1; j < nearbyNPCs.length; j++) {
                const dist = nearbyNPCs[i].mesh.position.distanceTo(nearbyNPCs[j].mesh.position);
                if (dist < 4) {
                    const pair = this.conversationPairs[
                        Math.floor(Math.random() * this.conversationPairs.length)
                    ];

                    // First NPC speaks
                    const npc1 = nearbyNPCs[i];
                    const npc2 = nearbyNPCs[j];
                    this.showNPCSubtitle(npc1, pair[0]);
                    const pitch1 = npc1.isMale ? 150 + Math.random() * 50 : 240 + Math.random() * 60;
                    this.game.systems.audio.playAnimalese(pair[0], pitch1, 'normal');

                    // Make them face each other
                    const dx = npc2.mesh.position.x - npc1.mesh.position.x;
                    const dz = npc2.mesh.position.z - npc1.mesh.position.z;
                    npc1.mesh.rotation.y = Math.atan2(dx, dz);
                    npc2.mesh.rotation.y = Math.atan2(-dx, -dz);

                    // Pause both NPCs
                    npc1.cornerPause = 4;
                    npc2.cornerPause = 4;

                    // Second NPC responds after delay
                    setTimeout(() => {
                        if (!npc2.alive || !npc2.mesh) return;
                        this.showNPCSubtitle(npc2, pair[1]);
                        const pitch2 = npc2.isMale ? 150 + Math.random() * 50 : 240 + Math.random() * 60;
                        this.game.systems.audio.playAnimalese(pair[1], pitch2, 'normal');
                    }, 1800);

                    return;
                }
            }
        }
    }

    showNPCSubtitle(npc, text) {
        // Create floating subtitle above NPC
        // We'll use a 2D overlay since 3D text is expensive
        const el = document.createElement('div');
        el.className = 'npc-subtitle';
        el.textContent = text;
        document.body.appendChild(el);

        const update = () => {
            if (!npc.mesh || !npc.alive) {
                el.remove();
                return;
            }

            // Project NPC position to screen
            const camera = this.game.systems.camera.camera;
            const pos = npc.mesh.position.clone();
            pos.y += 2.2;
            pos.project(camera);

            const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;

            el.style.left = x + 'px';
            el.style.top = y + 'px';
            el.style.transform = 'translate(-50%, -100%)';
        };

        // Show for 2-3 seconds
        requestAnimationFrame(() => {
            el.classList.add('visible');
            update();
        });

        const animFrame = () => {
            update();
            if (el.parentNode) requestAnimationFrame(animFrame);
        };
        requestAnimationFrame(animFrame);

        setTimeout(() => {
            el.classList.remove('visible');
            setTimeout(() => el.remove(), 300);
        }, 2000 + Math.random() * 1000);
    }

    fleeFromPoint(point) {
        for (const npc of this.pedestrians) {
            if (!npc.alive || !npc.mesh) continue;
            const dist = npc.mesh.position.distanceTo(point);
            if (dist < 30) {
                npc.isFleeing = true;
                npc.fleeTarget = point;
                // Run away from the point
                const dx = npc.mesh.position.x - point.x;
                const dz = npc.mesh.position.z - point.z;
                npc.walkDir = Math.atan2(dx, dz);
            }
        }
    }

    // --- NPC Reaction System ---

    // Gunfire reaction: nearby NPCs duck, mid-range NPCs record or flee
    reactToGunfire(point) {
        for (const npc of this.pedestrians) {
            if (!npc.alive || !npc.mesh || npc.isFleeing) continue;
            if (npc._reactionCooldown > 0) continue;
            const dist = npc.mesh.position.distanceTo(point);

            if (dist < 10) {
                // Very close — duck and cover
                npc._reaction = 'duck';
                npc._reactionTimer = 2.5 + Math.random();
                npc._recordingTarget = point.clone();
                // Play cower animation if available (GLTF skeleton)
                const gfMixer = npc.mesh.userData.mixer;
                const gfActions = npc.mesh.userData.actions;
                if (gfMixer && gfActions) {
                    const reactAnim = gfActions['aimed_at_cower'] ? 'aimed_at_cower' : null;
                    if (reactAnim && gfActions[reactAnim]) {
                        if (npc.mesh.userData.currentAction) npc.mesh.userData.currentAction.fadeOut(0.2);
                        gfActions[reactAnim].reset().fadeIn(0.2).play();
                        npc.mesh.userData.currentAction = gfActions[reactAnim];
                        npc._currentAnim = reactAnim;
                    }
                }
                if (Math.random() < 0.4) {
                    const line = this.duckDialogue[Math.floor(Math.random() * this.duckDialogue.length)];
                    this.showNPCSubtitle(npc, line);
                }
            } else if (dist < 25) {
                // Medium range — some flee, some pull out phones to record
                if (Math.random() < 0.6) {
                    // Flee
                    npc.isFleeing = true;
                    npc.fleeTarget = point.clone();
                    const dx = npc.mesh.position.x - point.x;
                    const dz = npc.mesh.position.z - point.z;
                    npc.walkDir = Math.atan2(dx, dz);
                    if (Math.random() < 0.3) {
                        const line = this.fleeDialogue[Math.floor(Math.random() * this.fleeDialogue.length)];
                        this.showNPCSubtitle(npc, line);
                    }
                } else {
                    // Pull out phone to record
                    npc._reaction = 'record';
                    npc._reactionTimer = 4 + Math.random() * 3;
                    npc._recordingTarget = point.clone();
                    if (Math.random() < 0.5) {
                        const line = this.recordDialogue[Math.floor(Math.random() * this.recordDialogue.length)];
                        this.showNPCSubtitle(npc, line);
                    }
                }
            }
        }
    }

    // Melee reaction: nearby NPCs flinch, flee, or look
    reactToMelee(point) {
        for (const npc of this.pedestrians) {
            if (!npc.alive || !npc.mesh || npc.isFleeing) continue;
            if (npc._reactionCooldown > 0) continue;
            const dist = npc.mesh.position.distanceTo(point);

            if (dist < 5) {
                // Very close — flinch defensively
                npc._reaction = 'flinch';
                npc._reactionTimer = 1.5 + Math.random() * 0.5;
                npc._recordingTarget = point.clone();
                if (Math.random() < 0.6) {
                    const line = this.flinchDialogue[Math.floor(Math.random() * this.flinchDialogue.length)];
                    this.showNPCSubtitle(npc, line);
                }
            } else if (dist < 15) {
                // Medium range — 50% chance to flee
                if (Math.random() < 0.5) {
                    npc.isFleeing = true;
                    npc.fleeTarget = point.clone();
                    const dx = npc.mesh.position.x - point.x;
                    const dz = npc.mesh.position.z - point.z;
                    npc.walkDir = Math.atan2(dx, dz);
                    if (Math.random() < 0.3) {
                        const line = this.fleeDialogue[Math.floor(Math.random() * this.fleeDialogue.length)];
                        this.showNPCSubtitle(npc, line);
                    }
                }
            } else if (dist < 25) {
                // Far range — 20% chance to turn and look
                if (Math.random() < 0.2) {
                    npc._reaction = 'look';
                    npc._reactionTimer = 2 + Math.random();
                    npc._recordingTarget = point.clone();
                }
            }
        }
    }

    // Explosion reaction: everyone nearby cowers or flees
    reactToExplosion(point) {
        for (const npc of this.pedestrians) {
            if (!npc.alive || !npc.mesh) continue;
            const dist = npc.mesh.position.distanceTo(point);

            if (dist < 15) {
                // Close — cower in place
                npc._reaction = 'cower';
                npc._reactionTimer = 3 + Math.random() * 2;
                npc._reactionCooldown = 0;
                npc._recordingTarget = point.clone();
                // Play cower animation if available (GLTF skeleton)
                const exMixer = npc.mesh.userData.mixer;
                const exActions = npc.mesh.userData.actions;
                if (exMixer && exActions) {
                    const reactAnim = exActions['aimed_at_cower'] ? 'aimed_at_cower' : null;
                    if (reactAnim && exActions[reactAnim]) {
                        if (npc.mesh.userData.currentAction) npc.mesh.userData.currentAction.fadeOut(0.2);
                        exActions[reactAnim].reset().fadeIn(0.2).play();
                        npc.mesh.userData.currentAction = exActions[reactAnim];
                        npc._currentAnim = reactAnim;
                    }
                }
                if (Math.random() < 0.5) {
                    const line = this.cowerDialogue[Math.floor(Math.random() * this.cowerDialogue.length)];
                    this.showNPCSubtitle(npc, line);
                }
            } else if (dist < 35) {
                // Farther — flee
                npc.isFleeing = true;
                npc.fleeTarget = point.clone();
                const dx = npc.mesh.position.x - point.x;
                const dz = npc.mesh.position.z - point.z;
                npc.walkDir = Math.atan2(dx, dz);
            }
        }
    }

    // Stunt reaction: nearby NPCs cheer and some record
    reactToStunt(point) {
        for (const npc of this.pedestrians) {
            if (!npc.alive || !npc.mesh || npc.isFleeing) continue;
            if (npc._reactionCooldown > 0 || npc._reaction) continue;
            const dist = npc.mesh.position.distanceTo(point);

            if (dist < 30) {
                if (Math.random() < 0.6) {
                    // Cheer
                    npc._reaction = 'cheer';
                    npc._reactionTimer = 3 + Math.random() * 2;
                    npc._recordingTarget = point.clone();
                    if (Math.random() < 0.5) {
                        const line = this.cheerDialogue[Math.floor(Math.random() * this.cheerDialogue.length)];
                        this.showNPCSubtitle(npc, line);
                    }
                } else {
                    // Record it
                    npc._reaction = 'record';
                    npc._reactionTimer = 4 + Math.random() * 3;
                    npc._recordingTarget = point.clone();
                    if (Math.random() < 0.4) {
                        const line = this.recordDialogue[Math.floor(Math.random() * this.recordDialogue.length)];
                        this.showNPCSubtitle(npc, line);
                    }
                }
            }
        }
    }

    // Called when an NPC takes damage
    npcTakeDamage(npc, amount) {
        npc.health -= amount;
        if (npc.health <= 0) {
            npc.alive = false;
            npc._reaction = null;
            npc._reactionTimer = 0;
            npc._recordingTarget = null;
            this.game.stats.totalKills++;

            // Trigger ragdoll
            this.game.systems.ragdoll.triggerNPCRagdoll(npc, null);

            // Add wanted heat
            this.game.systems.wanted.addHeat(0.5);
        }
    }

    // --- Random World Events ---
    _updateWorldEvents(dt) {
        this._worldEventTimer -= dt;

        // Clean up finished events
        if (this._activeEvent) {
            this._activeEvent.timer -= dt;
            if (this._activeEvent.timer <= 0) {
                this._cleanupEvent();
            }
        }

        // Spawn new event
        if (this._worldEventTimer <= 0 && !this._activeEvent) {
            this._worldEventTimer = 60 + Math.random() * 60;
            this._spawnWorldEvent();
        }
    }

    _spawnWorldEvent() {
        const player = this.game.systems.player;
        const eventTypes = ['car_chase', 'accident', 'robbery'];
        const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];

        // Spawn 30-50m from player
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 20;
        const x = player.position.x + Math.cos(angle) * dist;
        const z = player.position.z + Math.sin(angle) * dist;

        switch (type) {
            case 'car_chase': {
                // Two vehicles — one chasing the other
                const vehicles = this.game.systems.vehicles;
                const runner = vehicles.spawnVehicle(x, z, 'sports');
                const chaser = vehicles.spawnVehicle(x - 8, z - 8, 'sedan');
                if (runner && chaser) {
                    // Color chaser like police
                    chaser.mesh.traverse(child => {
                        if (child.isMesh && child.material && !child.name?.startsWith('wheel')) {
                            child.material = child.material.clone();
                            child.material.color.setHex(0xffffff);
                        }
                    });
                    runner.isTraffic = true;
                    chaser.isTraffic = true;
                    // Set both on same road going same direction
                    runner.roadAxis = Math.random() > 0.5 ? 0 : 1;
                    runner.roadDir = Math.random() > 0.5 ? 1 : -1;
                    runner.laneOffset = 2;
                    chaser.roadAxis = runner.roadAxis;
                    chaser.roadDir = runner.roadDir;
                    chaser.laneOffset = -2;

                    this._activeEvent = {
                        type: 'car_chase',
                        timer: 30,
                        meshes: [runner.mesh, chaser.mesh],
                        vehicles: [runner, chaser]
                    };
                    this.game.systems.ui.showMissionText('A police chase races by!', 2);
                }
                break;
            }

            case 'accident': {
                // Damaged car with NPCs standing around
                const vehicles = this.game.systems.vehicles;
                const car = vehicles.spawnVehicle(x, z, 'sedan');
                if (car) {
                    car.health = car.maxHealth * 0.3; // Damaged
                    car.mesh.rotation.y = Math.random() * Math.PI * 2;
                    // Spawn 2-3 bystanders nearby
                    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
                        const npc = this.spawnPedestrian(true);
                        if (npc && npc.mesh) {
                            const bx = x + (Math.random() - 0.5) * 6;
                            const bz = z + (Math.random() - 0.5) * 6;
                            npc.mesh.position.set(bx, this._getGroundY(bx, bz), bz);
                            npc.idleBehavior = 'standing';
                            npc.idleTimer = 20;
                        }
                    }
                    this._activeEvent = {
                        type: 'accident',
                        timer: 45,
                        meshes: [car.mesh],
                        vehicles: [car]
                    };
                    this.game.systems.ui.showMissionText('A car accident up ahead.', 2);
                }
                break;
            }

            case 'robbery': {
                // NPCs fleeing from a location, brief chaos
                const fleePoint = new THREE.Vector3(x, 0, z);
                this.fleeFromPoint(fleePoint);

                // Spawn a running NPC with cash effect
                const robber = this.spawnPedestrian(true);
                if (robber && robber.mesh) {
                    robber.mesh.position.set(x, this._getGroundY(x, z), z);
                    robber.isFleeing = true;
                    robber.fleeTarget = fleePoint;
                    robber.walkDir = Math.random() * Math.PI * 2;
                    robber.speed = 5; // Running fast

                    // Color robber in dark clothes
                    robber.mesh.traverse(child => {
                        if (child.isMesh && child.material) {
                            child.material = child.material.clone();
                            child.material.color.setHex(0x111111);
                        }
                    });
                }

                this._activeEvent = {
                    type: 'robbery',
                    timer: 20,
                    meshes: [],
                    vehicles: []
                };
                this.game.systems.ui.showMissionText('A robbery in progress nearby!', 2);

                // Police respond after a delay
                setTimeout(() => {
                    if (this._activeEvent && this._activeEvent.type === 'robbery') {
                        this.game.systems.audio.playAnimalese("Stop right there", 160, 'authoritative');
                    }
                }, 3000);
                break;
            }
        }
    }

    _cleanupEvent() {
        if (!this._activeEvent) return;

        // Remove event-specific vehicles
        const vehicles = this.game.systems.vehicles;
        for (const v of (this._activeEvent.vehicles || [])) {
            if (v && v.mesh && !v.occupied) {
                this.game.scene.remove(v.mesh);
                const idx = vehicles.vehicles.indexOf(v);
                if (idx >= 0) vehicles.vehicles.splice(idx, 1);
            }
        }

        this._activeEvent = null;
    }
}
