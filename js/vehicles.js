// San Claudio - Vehicle System
// Vehicle spawning, physics, enter/exit, 5 types

export class VehicleManager {
    constructor(game) {
        this.game = game;
        this.vehicles = [];
        this.stuntJumpActive = false;
        this.stuntJumpAirTime = 0;
        this.stuntJumpMaxHeight = 0;
        this.stuntJumpStartPos = null;

        // Garage / vehicle collection
        this.garagePos = { x: -215, z: 225 }; // Near garage door
        this.collectedTypes = new Set();
        this.storedVehicles = []; // { type, color }

        // Side job systems
        this.taxiActive = false;
        this.taxiFare = null;
        this.taxiEarned = 0;
        this.taxiFareCount = 0;

        this.vigilanteActive = false;
        this.vigilanteTarget = null;
        this.vigilanteLevel = 0;

        // Skid mark system
        this._skidMarks = [];
        this._maxSkidMarks = 100;
        this._skidMarkMat = null;

        // Nitro boost system
        this.nitroCharges = 0;
        this.nitroMaxCharges = 3;
        this.nitroActive = false;
        this.nitroTimer = 0;
        this.nitroDuration = 3.0;
        this._nitroPickups = [];
        this._nitroFlameParticles = [];

        // Drift system
        this.isDrifting = false;
        this.driftAngle = 0;
        this.driftTimer = 0;
        this.driftScore = 0;
        this.driftMultiplier = 1;
        this._tireSmokeParticles = [];
        this._driftDisplayTimer = 0;

        // Radio system
        this.radioStation = 0;
        this.radioStations = [
            { name: 'Radio Off', genre: 'off' },
            { name: 'San Claudio Rock', genre: 'rock', songs: ['Highway Fury', 'Chrome Thunder', 'Burning Asphalt', 'Neon Viper'] },
            { name: 'The Beat 107.5', genre: 'hiphop', songs: ['Cash Flow', 'Street Kings', 'Night Rider', 'Block Party'] },
            { name: 'Pulse FM', genre: 'electronic', songs: ['Digital Sunset', 'Neon Dreams', 'Bass Cathedral', 'Synth City'] },
            { name: 'Smooth Jazz 98.1', genre: 'jazz', songs: ['Blue Harbor', 'Velvet Evening', 'Midnight Stroll', 'Golden Coast'] },
            { name: 'WCSC Talk Radio', genre: 'talk', songs: ['The Morning Show', 'Conspiracy Hour', 'Sports Desk', 'Late Night Calls'] }
        ];
        this.radioDisplayTimer = 0;
        this.currentSongIndex = 0;
        this._radioSongTimer = 0;

        this.vehicleTypes = {
            sedan: {
                maxSpeed: 30, accel: 15, handling: 0.03, durability: 100,
                width: 2, height: 1.3, length: 4.5,
                colors: [0xcc3333, 0x3333cc, 0x33cc33, 0xcccc33, 0xeeeeee]
            },
            sports: {
                maxSpeed: 50, accel: 25, handling: 0.04, durability: 60,
                width: 1.9, height: 1.1, length: 4.2,
                colors: [0xff2200, 0xffcc00, 0xffffff]
            },
            truck: {
                maxSpeed: 20, accel: 8, handling: 0.022, durability: 200,
                width: 2.4, height: 2.2, length: 6,
                colors: [0x335533, 0x553322, 0xdddddd, 0x222288, 0x882222]
            },
            motorcycle: {
                maxSpeed: 55, accel: 30, handling: 0.05, durability: 30,
                width: 0.6, height: 1.2, length: 2,
                colors: [0x111111, 0xcc0000, 0x0044aa, 0x444444]
            },
            boat: {
                maxSpeed: 25, accel: 12, handling: 0.025, durability: 80,
                width: 2.5, height: 1.0, length: 5,
                colors: [0xffffff, 0x2244aa]
            },
            helicopter: {
                maxSpeed: 40, accel: 10, handling: 0.03, durability: 120,
                width: 2.5, height: 2.5, length: 6,
                colors: [0x333333, 0x882222, 0x224488]
            }
        };
    }

    init() {
        this.spawnInitialVehicles();
        this._createNitroPickups();
    }

    spawnInitialVehicles() {
        // Create helipad markers and docks
        this._createHelipads();
        this._createDocks();

        // Spawn vehicles across districts
        const spawnPoints = [
            // Downtown
            { x: 30, z: 30, type: 'sedan' },
            { x: -40, z: 20, type: 'sedan' },
            { x: 60, z: -30, type: 'sedan' },
            // The Strip
            { x: 200, z: -200, type: 'sports' },
            { x: 250, z: -250, type: 'sedan' },
            { x: 180, z: -180, type: 'sports' },
            // Docks
            { x: 200, z: 200, type: 'truck' },
            { x: 250, z: 250, type: 'sedan' },
            { x: 300, z: 300, type: 'boat', onWater: true },
            { x: 150, z: 200, type: 'boat', onWater: true },
            { x: 250, z: 150, type: 'boat', onWater: true },
            // Hillside
            { x: -200, z: -200, type: 'sedan' },
            { x: -250, z: -250, type: 'motorcycle' },
            // Industrial
            { x: -200, z: 200, type: 'truck' },
            { x: -250, z: 250, type: 'sedan' },
            { x: -180, z: 180, type: 'motorcycle' },
            // Helipads
            { x: 80, z: -80, type: 'helicopter', onHelipad: true },
            { x: -250, z: 250, type: 'helicopter', onHelipad: true },
            // Taxis
            { x: 10, z: -20, type: 'sedan', isTaxi: true },
            { x: 220, z: -220, type: 'sedan', isTaxi: true },
        ];

        for (const sp of spawnPoints) {
            const v = this.spawnVehicle(sp.x, sp.z, sp.type, sp.onWater);
            if (v && sp.onHelipad) {
                v.mesh.position.y = 0; // Ground level helipad
            }
            if (v && sp.isTaxi) {
                v._isTaxi = true;
                v.mesh.traverse(child => {
                    if (child.isMesh && child.material && child.material.color) {
                        child.material = child.material.clone();
                        child.material.color.setHex(0xffcc00);
                    }
                });
            }
        }
    }

    spawnVehicle(x, z, type, onWater = false) {
        const vType = this.vehicleTypes[type];
        if (!vType) return null;

        const color = vType.colors[Math.floor(Math.random() * vType.colors.length)];
        const vehicle = {
            type: type,
            mesh: null,
            speed: 0,
            steer: 0,
            health: vType.durability,
            maxHealth: vType.durability,
            occupied: false,
            driver: null,
            isNPCOwned: false,
            isTraffic: false,
            maxSpeed: vType.maxSpeed,
            accel: vType.accel,
            handling: vType.handling,
            onWater: onWater
        };

        // Create mesh
        vehicle.mesh = this.createVehicleMesh(type, vType, color);
        const groundY = onWater ? 0.3 : (this.game.systems.physics.getGroundHeight(x, z) || 0);
        vehicle.mesh.position.set(x, groundY, z);
        this.game.scene.add(vehicle.mesh);

        // Add collider
        vehicle.collider = {
            type: 'vehicle',
            vehicle: vehicle,
            width: vType.width,
            length: vType.length,
            get minX() { return vehicle.mesh.position.x - vType.width / 2; },
            get maxX() { return vehicle.mesh.position.x + vType.width / 2; },
            get minZ() { return vehicle.mesh.position.z - vType.length / 2; },
            get maxZ() { return vehicle.mesh.position.z + vType.length / 2; },
            height: vType.height
        };

        this.vehicles.push(vehicle);
        this.initVehiclePhysics(vehicle, vType);
        return vehicle;
    }

    initVehiclePhysics(vehicle, vType) {
        const physics = this.game.systems.physics;
        if (!physics || !physics.ready) return;
        const result = physics.createVehicleBody(vehicle, vType);
        if (result) {
            vehicle.physicsBody = result.body;
        }
    }

    createVehicleMesh(type, vType, color) {
        const models = this.game.systems.models;

        // Map vehicle types to .glb model names
        const modelMap = {
            sedan: 'sedan',
            sports: 'sports',
            truck: 'truck',
            motorcycle: 'motorcycle',
            boat: 'boat',
            helicopter: 'helicopter'
        };

        // Try to use .glb model
        const modelName = modelMap[type];
        if (models && modelName && models.hasModel(modelName)) {
            const model = models.cloneVehicle(modelName);

            // Apply color to body material
            model.traverse((child) => {
                if (child.isMesh) {
                    if (child.name && child.name.startsWith('wheel')) {
                        // Don't recolor wheels
                    } else {
                        child.material = child.material.clone();
                        child.material.color.setHex(color);
                    }
                    child.castShadow = true;
                }
            });

            // Apply vehicle texture
            const vehicleTexture = this._generateVehicleTexture(type, color);
            model.traverse((child) => {
                if (child.isMesh) {
                    // Skip wheels, glass, and chrome
                    if (child.name && child.name.startsWith('wheel')) return;
                    if (child.material.transparent) return;
                    if (child.material.metalness > 0.8) return;
                    child.material.map = vehicleTexture;
                    child.material.roughness = Math.max(0.3, Math.min(0.5, child.material.roughness));
                    child.material.metalness = Math.max(0.5, Math.min(0.6, child.material.metalness));
                    child.material.needsUpdate = true;
                }
            });

            // Collect wheel references for animation
            const wheels = [];
            model.traverse((child) => {
                if (child.name && child.name.startsWith('wheel')) {
                    wheels.push(child);
                }
            });
            model.userData.wheels = wheels;
            model.userData.useGLB = true;

            return model;
        }

        // Fallback: primitive model
        return this._createFallbackVehicleMesh(type, vType, color);
    }

    _generateVehicleTexture(type, color) {
        if (type === 'sedan' || type === 'sports') {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            // Base near-white fill
            ctx.fillStyle = '#f8f8f8';
            ctx.fillRect(0, 0, 512, 256);

            // Metallic shimmer noise patches (3-5% HSL variation)
            for (let i = 0; i < 40; i++) {
                const px = Math.random() * 512;
                const py = Math.random() * 256;
                const size = 20 + Math.random() * 40;
                const lightness = 95 + Math.random() * 5; // 95-100%
                ctx.fillStyle = `hsl(0, 0%, ${lightness}%)`;
                ctx.fillRect(px, py, size, size * 0.6);
            }

            // Horizontal reflection band at ~60% height (slightly lighter strip)
            const reflGrad = ctx.createLinearGradient(0, 140, 0, 170);
            reflGrad.addColorStop(0, 'rgba(255,255,255,0)');
            reflGrad.addColorStop(0.4, 'rgba(255,255,255,0.15)');
            reflGrad.addColorStop(0.6, 'rgba(255,255,255,0.15)');
            reflGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = reflGrad;
            ctx.fillRect(0, 140, 512, 30);

            // Panel lines: door seams at ~30% and ~50% width
            ctx.strokeStyle = '#555555';
            ctx.lineWidth = 1.5;
            // Door seam 1
            ctx.beginPath();
            ctx.moveTo(512 * 0.30, 30);
            ctx.lineTo(512 * 0.30, 210);
            ctx.stroke();
            // Door seam 2
            ctx.beginPath();
            ctx.moveTo(512 * 0.50, 30);
            ctx.lineTo(512 * 0.50, 210);
            ctx.stroke();
            // Hood seam (horizontal near top-front)
            ctx.beginPath();
            ctx.moveTo(20, 50);
            ctx.lineTo(492, 50);
            ctx.stroke();
            // Trunk seam (horizontal near bottom-rear)
            ctx.beginPath();
            ctx.moveTo(20, 206);
            ctx.lineTo(492, 206);
            ctx.stroke();

            // Bottom rocker panel grime — gradient darkening bottom 15%
            const grimeGrad = ctx.createLinearGradient(0, 218, 0, 256);
            grimeGrad.addColorStop(0, 'rgba(80,70,60,0)');
            grimeGrad.addColorStop(0.3, 'rgba(80,70,60,0.15)');
            grimeGrad.addColorStop(1, 'rgba(60,50,40,0.35)');
            ctx.fillStyle = grimeGrad;
            ctx.fillRect(0, 218, 512, 38);

            // Wheel well shadows — dark crescents at wheel arch positions
            ctx.fillStyle = 'rgba(40,35,30,0.3)';
            // Front wheel well (~20% from left)
            ctx.beginPath();
            ctx.arc(512 * 0.20, 240, 30, Math.PI, 0);
            ctx.fill();
            // Rear wheel well (~80% from left)
            ctx.beginPath();
            ctx.arc(512 * 0.80, 240, 30, Math.PI, 0);
            ctx.fill();

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            return texture;

        } else if (type === 'truck') {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            // Base near-white
            ctx.fillStyle = '#f8f8f8';
            ctx.fillRect(0, 0, 512, 256);

            // Panel divisions — larger for truck
            ctx.strokeStyle = '#555555';
            ctx.lineWidth = 2;
            // Cab/bed division at ~40% width
            ctx.beginPath();
            ctx.moveTo(512 * 0.40, 10);
            ctx.lineTo(512 * 0.40, 246);
            ctx.stroke();
            // Horizontal panel line
            ctx.beginPath();
            ctx.moveTo(10, 128);
            ctx.lineTo(502, 128);
            ctx.stroke();

            // Rivet dots along panel edges
            ctx.fillStyle = '#666666';
            for (let x = 30; x < 500; x += 25) {
                ctx.beginPath();
                ctx.arc(x, 15, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x, 241, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            for (let y = 20; y < 250; y += 25) {
                ctx.beginPath();
                ctx.arc(512 * 0.40, y, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Cargo bed section (right half): wood-grain texture
            ctx.strokeStyle = '#b08050';
            ctx.lineWidth = 0.8;
            for (let y = 10; y < 250; y += 8) {
                ctx.beginPath();
                ctx.moveTo(512 * 0.42, y);
                for (let x = 512 * 0.42; x < 505; x += 5) {
                    ctx.lineTo(x + 5, y + (Math.sin(x * 0.03 + y * 0.1) * 2));
                }
                ctx.stroke();
            }
            // Wood knot circles
            ctx.strokeStyle = '#a07040';
            ctx.lineWidth = 0.6;
            const knots = [[340, 60], [420, 150], [470, 90], [360, 200], [450, 220]];
            for (const [kx, ky] of knots) {
                ctx.beginPath();
                ctx.arc(kx, ky, 5 + Math.random() * 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(kx, ky, 2, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Bottom grime — heavier at 25%
            const grimeGrad = ctx.createLinearGradient(0, 192, 0, 256);
            grimeGrad.addColorStop(0, 'rgba(70,60,50,0)');
            grimeGrad.addColorStop(0.3, 'rgba(70,60,50,0.2)');
            grimeGrad.addColorStop(1, 'rgba(50,40,30,0.4)');
            ctx.fillStyle = grimeGrad;
            ctx.fillRect(0, 192, 512, 64);

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            return texture;

        } else if (type === 'police') {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            // Upper 60% near-white
            ctx.fillStyle = '#f4f4f4';
            ctx.fillRect(0, 0, 512, 154);
            // Lower 40% slightly darker
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(0, 154, 512, 102);

            // Dividing stripe between upper/lower
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 154);
            ctx.lineTo(512, 154);
            ctx.stroke();

            // "SCPD" text centered
            ctx.fillStyle = '#222222';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('SCPD', 256, 80);

            // Badge circle with star
            ctx.strokeStyle = '#444444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(130, 80, 18, 0, Math.PI * 2);
            ctx.stroke();
            // Star inside badge
            ctx.fillStyle = '#555555';
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI / 5);
                const outerX = 130 + Math.cos(angle) * 12;
                const outerY = 80 + Math.sin(angle) * 12;
                if (i === 0) ctx.moveTo(outerX, outerY);
                else ctx.lineTo(outerX, outerY);
                const innerAngle = angle + Math.PI / 5;
                const innerX = 130 + Math.cos(innerAngle) * 5;
                const innerY = 80 + Math.sin(innerAngle) * 5;
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
            ctx.fill();

            // Unit number
            const unitNum = 'SC-' + String(Math.floor(Math.random() * 900) + 100);
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(unitNum, 380, 80);

            // Push bumper chrome band at bottom
            const chromeBand = ctx.createLinearGradient(0, 236, 0, 256);
            chromeBand.addColorStop(0, 'rgba(200,200,210,0.3)');
            chromeBand.addColorStop(0.5, 'rgba(240,240,245,0.5)');
            chromeBand.addColorStop(1, 'rgba(180,180,190,0.3)');
            ctx.fillStyle = chromeBand;
            ctx.fillRect(0, 236, 512, 20);

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            return texture;

        } else if (type === 'motorcycle') {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');

            // Base near-white
            ctx.fillStyle = '#f8f8f8';
            ctx.fillRect(0, 0, 256, 128);

            // Subtle grain texture — fine dots
            ctx.fillStyle = 'rgba(120,120,120,0.08)';
            for (let i = 0; i < 300; i++) {
                const dx = Math.random() * 256;
                const dy = Math.random() * 128;
                ctx.beginPath();
                ctx.arc(dx, dy, 0.5 + Math.random(), 0, Math.PI * 2);
                ctx.fill();
            }

            // Gas tank center pinstripe accent line
            ctx.strokeStyle = '#666666';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(30, 64);
            ctx.lineTo(226, 64);
            ctx.stroke();

            // Thinner parallel accent lines
            ctx.strokeStyle = 'rgba(100,100,100,0.4)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(40, 58);
            ctx.lineTo(216, 58);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(40, 70);
            ctx.lineTo(216, 70);
            ctx.stroke();

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            return texture;

        } else if (type === 'boat') {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');

            // Waterline division: upper 55% lighter, lower 45% darker
            ctx.fillStyle = '#f6f6f6';
            ctx.fillRect(0, 0, 256, 70);
            const waterGrad = ctx.createLinearGradient(0, 70, 0, 128);
            waterGrad.addColorStop(0, '#eeeeee');
            waterGrad.addColorStop(1, '#d8d8d8');
            ctx.fillStyle = waterGrad;
            ctx.fillRect(0, 70, 256, 58);

            // Waterline stripe
            ctx.strokeStyle = '#777777';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 70);
            ctx.lineTo(256, 70);
            ctx.stroke();

            // Boat name text
            const names = ['SEA BREEZE', 'WAVE RUNNER', 'ISLAND QUEEN', 'SANTA LUCIA', 'BLUE HORIZON', 'OCEAN STAR'];
            const boatName = names[Math.floor(Math.random() * names.length)];
            ctx.fillStyle = '#444444';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(boatName, 128, 98);

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            return texture;

        } else if (type === 'helicopter') {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');

            // Base near-white
            ctx.fillStyle = '#f4f4f4';
            ctx.fillRect(0, 0, 256, 128);

            // Panel seam lines
            ctx.strokeStyle = '#666666';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(85, 5);
            ctx.lineTo(85, 123);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(170, 5);
            ctx.lineTo(170, 123);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(5, 64);
            ctx.lineTo(251, 64);
            ctx.stroke();

            // Military-style ID marking
            const heliId = 'SC-' + String(Math.floor(Math.random() * 900) + 100);
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(heliId, 128, 32);

            // Caution stripes near edges — diagonal yellow/black hatching
            ctx.save();
            const stripeW = 8;
            // Top edge caution stripe
            ctx.beginPath();
            ctx.rect(0, 0, 256, 12);
            ctx.clip();
            for (let sx = -12; sx < 270; sx += stripeW * 2) {
                ctx.fillStyle = 'rgba(200,180,0,0.5)';
                ctx.beginPath();
                ctx.moveTo(sx, 0);
                ctx.lineTo(sx + stripeW, 0);
                ctx.lineTo(sx + stripeW + 12, 12);
                ctx.lineTo(sx + 12, 12);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = 'rgba(40,40,40,0.4)';
                ctx.beginPath();
                ctx.moveTo(sx + stripeW, 0);
                ctx.lineTo(sx + stripeW * 2, 0);
                ctx.lineTo(sx + stripeW * 2 + 12, 12);
                ctx.lineTo(sx + stripeW + 12, 12);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();

            // Bottom edge caution stripe
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 116, 256, 12);
            ctx.clip();
            for (let sx = -12; sx < 270; sx += stripeW * 2) {
                ctx.fillStyle = 'rgba(200,180,0,0.5)';
                ctx.beginPath();
                ctx.moveTo(sx, 116);
                ctx.lineTo(sx + stripeW, 116);
                ctx.lineTo(sx + stripeW + 12, 128);
                ctx.lineTo(sx + 12, 128);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = 'rgba(40,40,40,0.4)';
                ctx.beginPath();
                ctx.moveTo(sx + stripeW, 116);
                ctx.lineTo(sx + stripeW * 2, 116);
                ctx.lineTo(sx + stripeW * 2 + 12, 128);
                ctx.lineTo(sx + stripeW + 12, 128);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            return texture;

        } else {
            // Unknown type — plain near-white texture
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f8f8f8';
            ctx.fillRect(0, 0, 64, 64);
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            return texture;
        }
    }

    _createFallbackVehicleMesh(type, vType, color) {
        const group = new THREE.Group();
        const vehicleTexture = this._generateVehicleTexture(type, color);
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.4,
            metalness: 0.6,
            map: vehicleTexture
        });
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x88aacc, roughness: 0.05, metalness: 0.5,
            transparent: true, opacity: 0.5
        });
        const chromeMat = new THREE.MeshStandardMaterial({
            color: 0xcccccc, roughness: 0.1, metalness: 0.9
        });

        if (type === 'sedan' || type === 'sports') {
            const isSports = type === 'sports';
            const bodyH = vType.height * (isSports ? 0.4 : 0.5);

            const bodyGeo = new THREE.BoxGeometry(vType.width, bodyH, vType.length);
            const body = new THREE.Mesh(bodyGeo, mat);
            body.position.y = vType.height * 0.3;
            body.castShadow = true;
            group.add(body);

            const hoodGeo = new THREE.BoxGeometry(vType.width * 0.95, bodyH * 0.6, vType.length * 0.25);
            const hood = new THREE.Mesh(hoodGeo, mat);
            hood.position.set(0, vType.height * 0.45, vType.length * 0.35);
            hood.rotation.x = -0.15;
            hood.castShadow = true;
            group.add(hood);

            const trunkGeo = new THREE.BoxGeometry(vType.width * 0.9, bodyH * 0.5, vType.length * 0.2);
            const trunk = new THREE.Mesh(trunkGeo, mat);
            trunk.position.set(0, vType.height * 0.4, -vType.length * 0.38);
            group.add(trunk);

            const cabinW = vType.width * 0.82;
            const cabinH = vType.height * (isSports ? 0.3 : 0.4);
            const cabinL = vType.length * 0.4;
            const cabinGeo = new THREE.BoxGeometry(cabinW, cabinH, cabinL);
            const cabin = new THREE.Mesh(cabinGeo, glassMat);
            cabin.position.set(0, vType.height * (isSports ? 0.55 : 0.65), -vType.length * 0.05);
            group.add(cabin);

            const wsGeo = new THREE.PlaneGeometry(cabinW * 0.95, cabinH * 1.1);
            const ws = new THREE.Mesh(wsGeo, glassMat);
            ws.position.set(0, vType.height * (isSports ? 0.55 : 0.65), cabinL * 0.5 - vType.length * 0.05);
            ws.rotation.x = -0.3;
            group.add(ws);

            for (const side of [-1, 1]) {
                const fenderGeo = new THREE.BoxGeometry(0.15, bodyH * 0.5, vType.length * 0.25);
                const fender = new THREE.Mesh(fenderGeo, mat);
                fender.position.set(side * (vType.width / 2 + 0.05), vType.height * 0.2, vType.length * 0.3);
                group.add(fender);
            }

            const frontBumperGeo = new THREE.BoxGeometry(vType.width + 0.2, 0.2, 0.15);
            const frontBumper = new THREE.Mesh(frontBumperGeo, chromeMat);
            frontBumper.position.set(0, vType.height * 0.15, vType.length / 2 + 0.05);
            group.add(frontBumper);

            const rearBumperGeo = new THREE.BoxGeometry(vType.width + 0.2, 0.2, 0.15);
            const rearBumper = new THREE.Mesh(rearBumperGeo, chromeMat);
            rearBumper.position.set(0, vType.height * 0.15, -vType.length / 2 - 0.05);
            group.add(rearBumper);

            for (const side of [-1, 1]) {
                const mirrorArmGeo = new THREE.BoxGeometry(0.3, 0.05, 0.05);
                const mirrorArm = new THREE.Mesh(mirrorArmGeo, chromeMat);
                mirrorArm.position.set(side * (vType.width / 2 + 0.15), vType.height * 0.55, vType.length * 0.15);
                group.add(mirrorArm);
                const mirrorGeo = new THREE.BoxGeometry(0.08, 0.1, 0.12);
                const mirror = new THREE.Mesh(mirrorGeo, chromeMat);
                mirror.position.set(side * (vType.width / 2 + 0.28), vType.height * 0.55, vType.length * 0.15);
                group.add(mirror);
            }

            if (isSports) {
                const spoilerGeo = new THREE.BoxGeometry(vType.width * 0.8, 0.05, 0.3);
                const spoiler = new THREE.Mesh(spoilerGeo, mat);
                spoiler.position.set(0, vType.height * 0.65, -vType.length * 0.42);
                group.add(spoiler);
                for (const side of [-0.3, 0.3]) {
                    const armGeo = new THREE.BoxGeometry(0.05, 0.15, 0.05);
                    const arm = new THREE.Mesh(armGeo, mat);
                    arm.position.set(side, vType.height * 0.58, -vType.length * 0.42);
                    group.add(arm);
                }
            }

            this._addFallbackWheels(group, vType, isSports ? 0.18 : 0.22);

            for (const side of [-0.5, 0.5]) {
                const hlGeo = new THREE.SphereGeometry(0.12, 6, 6);
                const hlMat = new THREE.MeshStandardMaterial({
                    color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.3
                });
                const hl = new THREE.Mesh(hlGeo, hlMat);
                hl.position.set(side * vType.width * 0.4, vType.height * 0.3, vType.length / 2 + 0.05);
                group.add(hl);
            }

            for (const side of [-0.5, 0.5]) {
                const tlGeo = new THREE.BoxGeometry(0.2, 0.1, 0.05);
                const tlMat = new THREE.MeshStandardMaterial({
                    color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.2
                });
                const tl = new THREE.Mesh(tlGeo, tlMat);
                tl.position.set(side * vType.width * 0.4, vType.height * 0.3, -vType.length / 2 - 0.05);
                group.add(tl);
            }

        } else if (type === 'truck') {
            const cabGeo = new THREE.BoxGeometry(vType.width, vType.height * 0.7, vType.length * 0.35);
            const cab = new THREE.Mesh(cabGeo, mat);
            cab.position.set(0, vType.height * 0.4, vType.length * 0.25);
            cab.castShadow = true;
            group.add(cab);

            const wsGeo = new THREE.PlaneGeometry(vType.width * 0.8, vType.height * 0.35);
            const ws = new THREE.Mesh(wsGeo, glassMat);
            ws.position.set(0, vType.height * 0.65, vType.length * 0.42);
            ws.rotation.x = -0.2;
            group.add(ws);

            const bedGeo = new THREE.BoxGeometry(vType.width, vType.height * 0.3, vType.length * 0.6);
            const bed = new THREE.Mesh(bedGeo, mat);
            bed.position.set(0, vType.height * 0.2, -vType.length * 0.15);
            bed.castShadow = true;
            group.add(bed);

            for (const side of [-1, 1]) {
                const wallGeo = new THREE.BoxGeometry(0.1, vType.height * 0.25, vType.length * 0.6);
                const wall = new THREE.Mesh(wallGeo, mat);
                wall.position.set(side * vType.width / 2, vType.height * 0.45, -vType.length * 0.15);
                group.add(wall);
            }
            const tgGeo = new THREE.BoxGeometry(vType.width, vType.height * 0.25, 0.1);
            const tg = new THREE.Mesh(tgGeo, mat);
            tg.position.set(0, vType.height * 0.45, -vType.length * 0.45);
            group.add(tg);

            for (const side of [-1, 1]) {
                const railGeo = new THREE.BoxGeometry(0.1, 0.05, vType.length * 0.2);
                const rail = new THREE.Mesh(railGeo, chromeMat);
                rail.position.set(side * (vType.width / 2 + 0.05), vType.height * 0.1, vType.length * 0.1);
                group.add(rail);
            }

            this._addFallbackWheels(group, vType, 0.3);

        } else if (type === 'motorcycle') {
            const frameGeo = new THREE.CylinderGeometry(0.06, 0.06, vType.length * 0.8, 6);
            frameGeo.rotateX(Math.PI / 2);
            const frame = new THREE.Mesh(frameGeo, mat);
            frame.position.y = 0.5;
            frame.castShadow = true;
            group.add(frame);

            const engineGeo = new THREE.BoxGeometry(0.25, 0.2, 0.3);
            const engineMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 });
            const engine = new THREE.Mesh(engineGeo, engineMat);
            engine.position.set(0, 0.35, 0.1);
            group.add(engine);

            const tankGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.3, 8);
            tankGeo.rotateX(Math.PI / 2);
            const tank = new THREE.Mesh(tankGeo, mat);
            tank.position.set(0, 0.65, 0.15);
            group.add(tank);

            const seatGeo = new THREE.BoxGeometry(0.25, 0.08, 0.5);
            const seatMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            seat.position.set(0, 0.7, -0.15);
            group.add(seat);

            for (const side of [-0.08, 0.08]) {
                const forkGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4);
                const forkMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8 });
                const fork = new THREE.Mesh(forkGeo, forkMat);
                fork.position.set(side, 0.5, 0.6);
                fork.rotation.x = -0.2;
                group.add(fork);
            }

            for (const zOff of [-0.7, 0.7]) {
                const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12);
                wheelGeo.rotateZ(Math.PI / 2);
                const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
                const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                wheel.position.set(0, 0.3, zOff);
                group.add(wheel);
            }

            const hbGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4);
            const hb = new THREE.Mesh(hbGeo, new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 }));
            hb.position.set(0, 0.85, 0.55);
            group.add(hb);

            for (const side of [-0.25, 0.25]) {
                const gripGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6);
                const grip = new THREE.Mesh(gripGeo, seatMat);
                grip.position.set(side, 0.85, 0.55);
                group.add(grip);
            }

            const exhaustGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.8, 6);
            exhaustGeo.rotateX(Math.PI / 2);
            const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.7 });
            const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
            exhaust.position.set(0.15, 0.25, -0.2);
            group.add(exhaust);

        } else if (type === 'boat') {
            const hullShape = new THREE.Shape();
            hullShape.moveTo(0, vType.length / 2);
            hullShape.lineTo(-vType.width / 2, -vType.length * 0.2);
            hullShape.lineTo(-vType.width / 2, -vType.length / 2);
            hullShape.lineTo(vType.width / 2, -vType.length / 2);
            hullShape.lineTo(vType.width / 2, -vType.length * 0.2);
            hullShape.lineTo(0, vType.length / 2);
            const hullExtrudeSettings = { steps: 1, depth: vType.height * 0.5, bevelEnabled: false };
            const hullGeo = new THREE.ExtrudeGeometry(hullShape, hullExtrudeSettings);
            const hull = new THREE.Mesh(hullGeo, mat);
            hull.rotation.x = -Math.PI / 2;
            hull.position.y = -vType.height * 0.1;
            hull.castShadow = true;
            group.add(hull);

            for (const side of [-1, 1]) {
                const railGeo = new THREE.BoxGeometry(0.1, 0.15, vType.length * 0.7);
                const rail = new THREE.Mesh(railGeo, mat);
                rail.position.set(side * vType.width * 0.48, vType.height * 0.3, -vType.length * 0.05);
                group.add(rail);
            }

            const cabGeo = new THREE.BoxGeometry(vType.width * 0.6, vType.height * 0.5, vType.length * 0.25);
            const cab = new THREE.Mesh(cabGeo, mat);
            cab.position.set(0, vType.height * 0.45, -vType.length * 0.1);
            group.add(cab);

            const bwsGeo = new THREE.PlaneGeometry(vType.width * 0.55, vType.height * 0.4);
            const bws = new THREE.Mesh(bwsGeo, glassMat);
            bws.position.set(0, vType.height * 0.55, -vType.length * 0.1 + vType.length * 0.125 + 0.01);
            bws.rotation.x = -0.2;
            group.add(bws);

            const motorGeo = new THREE.BoxGeometry(0.4, 0.5, 0.3);
            const motorMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
            const motor = new THREE.Mesh(motorGeo, motorMat);
            motor.position.set(0, 0, -vType.length / 2 - 0.1);
            group.add(motor);

            const shaftGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 4);
            const shaft = new THREE.Mesh(shaftGeo, motorMat);
            shaft.position.set(0, -0.3, -vType.length / 2 - 0.1);
            group.add(shaft);

        } else if (type === 'helicopter') {
            // Fuselage
            const bodyGeo = new THREE.CylinderGeometry(1.0, 0.8, vType.length * 0.6, 8);
            bodyGeo.rotateX(Math.PI / 2);
            const body = new THREE.Mesh(bodyGeo, mat);
            body.position.set(0, 1.2, 0);
            body.castShadow = true;
            group.add(body);

            // Cockpit bubble
            const cockpitGeo = new THREE.SphereGeometry(0.9, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
            const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
            cockpit.position.set(0, 1.5, vType.length * 0.2);
            group.add(cockpit);

            // Tail boom
            const tailGeo = new THREE.CylinderGeometry(0.3, 0.15, vType.length * 0.5, 6);
            tailGeo.rotateX(Math.PI / 2);
            const tail = new THREE.Mesh(tailGeo, mat);
            tail.position.set(0, 1.3, -vType.length * 0.4);
            group.add(tail);

            // Tail fin
            const finGeo = new THREE.BoxGeometry(0.05, 0.8, 0.5);
            const fin = new THREE.Mesh(finGeo, mat);
            fin.position.set(0, 1.7, -vType.length * 0.6);
            group.add(fin);

            // Tail rotor
            const tailRotorGeo = new THREE.BoxGeometry(0.05, 0.6, 0.08);
            const tailRotorMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 });
            const tailRotor = new THREE.Mesh(tailRotorGeo, tailRotorMat);
            tailRotor.position.set(0.1, 1.7, -vType.length * 0.62);
            tailRotor.name = 'tailRotor';
            group.add(tailRotor);

            // Main rotor mast
            const mastGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 6);
            const mast = new THREE.Mesh(mastGeo, new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.7 }));
            mast.position.set(0, 2.1, 0);
            group.add(mast);

            // Main rotor blades (will be animated)
            const rotorGroup = new THREE.Group();
            rotorGroup.name = 'mainRotor';
            for (let i = 0; i < 4; i++) {
                const bladeGeo = new THREE.BoxGeometry(4.0, 0.03, 0.2);
                const blade = new THREE.Mesh(bladeGeo, tailRotorMat);
                blade.rotation.y = (Math.PI / 2) * i;
                rotorGroup.add(blade);
            }
            rotorGroup.position.set(0, 2.35, 0);
            group.add(rotorGroup);

            // Landing skids
            const skidMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6 });
            for (const side of [-1, 1]) {
                // Skid bar
                const skidGeo = new THREE.CylinderGeometry(0.04, 0.04, vType.length * 0.5, 4);
                skidGeo.rotateX(Math.PI / 2);
                const skid = new THREE.Mesh(skidGeo, skidMat);
                skid.position.set(side * 0.8, 0.05, 0);
                group.add(skid);
                // Struts
                for (const zOff of [-0.8, 0.8]) {
                    const strutGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4);
                    const strut = new THREE.Mesh(strutGeo, skidMat);
                    strut.position.set(side * 0.8, 0.5, zOff);
                    strut.rotation.z = side * 0.15;
                    group.add(strut);
                }
            }
        }

        return group;
    }

    _addFallbackWheels(group, vType, wheelRadius) {
        const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.15, 12);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

        const positions = [
            { x: -vType.width / 2, z: vType.length * 0.3 },
            { x: vType.width / 2, z: vType.length * 0.3 },
            { x: -vType.width / 2, z: -vType.length * 0.3 },
            { x: vType.width / 2, z: -vType.length * 0.3 },
        ];

        const wheels = [];
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.position.set(pos.x, wheelRadius, pos.z);
            wheel.name = i < 2 ? 'wheel_front' : 'wheel_rear';
            group.add(wheel);
            wheels.push(wheel);
        }
        group.userData.wheels = wheels;
    }

    update(dt) {
        this._updateRadio(dt);
        this._updateSideJobs(dt);
        this._updateNitroPickups();
        this._updateNitroFlame(dt);
        this._updateSkidMarks(dt);

        for (const vehicle of this.vehicles) {
            if (vehicle.occupied && vehicle.driver === this.game.systems.player) {
                this.updateDriving(vehicle, dt);
            } else if (vehicle.isTraffic) {
                this.updateTraffic(vehicle, dt);
            }

            // Animate wheels based on speed
            this._animateWheels(vehicle, dt);

            // NPC-vehicle collision
            if (Math.abs(vehicle.speed) > 2) {
                this._checkNPCCollision(vehicle, dt);
            }

            // Destructible prop collision
            if (Math.abs(vehicle.speed) > 3 && vehicle.mesh) {
                const world = this.game.systems.world;
                if (world && world.checkPropCollision) {
                    const vx = vehicle.mesh.position.x;
                    const vz = vehicle.mesh.position.z;
                    const vr = vehicle.type === 'motorcycle' ? 0.8 : (vehicle.type === 'truck' ? 2.5 : 1.8);
                    if (world.checkPropCollision(vx, vz, vehicle.speed, vr)) {
                        // Slow vehicle slightly on impact
                        vehicle.speed *= 0.9;
                        vehicle.damage = Math.min(100, (vehicle.damage || 0) + 2);
                    }
                }
            }

            // Vehicle damage effects
            this._updateDamageEffects(vehicle, dt);

            // Headlights at night
            this._updateHeadlights(vehicle);
        }

        // Garage interaction
        this._updateGarage();
    }

    _updateRadio(dt) {
        const input = this.game.systems.input;
        const player = this.game.systems.player;
        if (!player.inVehicle) return;

        // Don't consume R key when side job prompt is available
        if (player.currentVehicle && !this.taxiActive && !this.vigilanteActive) {
            const missions = this.game.systems.missions;
            const noMission = missions && !missions.missionActive && !missions.activeSideMission;
            if (noMission && (this._isYellowVehicle(player.currentVehicle) || this._isPoliceVehicle(player.currentVehicle))) {
                // R key reserved for side job activation — skip radio
                if (this.radioDisplayTimer > 0) this.radioDisplayTimer -= dt;
                return;
            }
        }

        // Station switching with R key
        if (input.justPressed('radio')) {
            this.radioStation = (this.radioStation + 1) % this.radioStations.length;
            this.radioDisplayTimer = 3.0;
            this.currentSongIndex = Math.floor(Math.random() * 4);
            if (this.radioStations[this.radioStation].genre === 'off') {
                this.game.systems.audio.stopRadio();
            } else {
                // Use the existing audio radio system
                this.game.systems.audio.cycleRadio(1);
            }
        }

        // Song rotation timer
        if (this.radioStation > 0) {
            this._radioSongTimer -= dt;
            if (this._radioSongTimer <= 0) {
                this._radioSongTimer = 20 + Math.random() * 15;
                const station = this.radioStations[this.radioStation];
                if (station.songs) {
                    this.currentSongIndex = (this.currentSongIndex + 1) % station.songs.length;
                    this.radioDisplayTimer = 3.0;
                }
            }
        }

        // Display timer
        if (this.radioDisplayTimer > 0) {
            this.radioDisplayTimer -= dt;
        }
    }

    _updateGarage() {
        const player = this.game.systems.player;
        const input = this.game.systems.input;
        const dx = player.position.x - this.garagePos.x;
        const dz = player.position.z - this.garagePos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 6) return;

        const promptEl = document.getElementById('hud-interact-prompt');

        if (player.inVehicle) {
            // Store vehicle in garage
            promptEl.textContent = 'Press E to store vehicle in garage';
            promptEl.classList.add('visible');

            if (input.justPressed('interact')) {
                const vehicle = player.currentVehicle;
                if (vehicle && !vehicle._destroyed) {
                    // Track collection
                    if (!this.collectedTypes.has(vehicle.type)) {
                        this.collectedTypes.add(vehicle.type);
                        this.game.stats.vehiclesCollected = this.collectedTypes.size;
                        this.game.systems.ui.showMissionText(
                            `Vehicle Collected: ${vehicle.type.toUpperCase()}\n${this.collectedTypes.size}/5 types`,
                            3
                        );
                    }

                    // Store vehicle data
                    let vehicleColor = 0xcccccc;
                    let foundColor = false;
                    vehicle.mesh.traverse(child => {
                        if (!foundColor && child.isMesh && child.material && child.material.color) {
                            vehicleColor = child.material.color.getHex();
                            foundColor = true;
                        }
                    });
                    // Only store if not already at max (5)
                    if (this.storedVehicles.length < 5) {
                        this.storedVehicles.push({
                            type: vehicle.type,
                            color: vehicleColor,
                            health: vehicle.health
                        });
                    }

                    // Exit and remove vehicle
                    player.exitVehicle();
                    this.game.scene.remove(vehicle.mesh);
                    const idx = this.vehicles.indexOf(vehicle);
                    if (idx >= 0) this.vehicles.splice(idx, 1);

                    this.game.systems.audio.playPickup();
                    this.game.systems.ui.showMissionText('Vehicle stored!', 2);
                }
            }
        } else if (this.storedVehicles.length > 0) {
            // Retrieve vehicle from garage
            const latest = this.storedVehicles[this.storedVehicles.length - 1];
            promptEl.textContent = `Press E to retrieve ${latest.type} (${this.storedVehicles.length} stored)`;
            promptEl.classList.add('visible');

            if (input.justPressed('interact')) {
                const stored = this.storedVehicles.pop();
                const spawnX = this.garagePos.x + 5;
                const spawnZ = this.garagePos.z;
                const vehicle = this.spawnVehicle(spawnX, spawnZ, stored.type);
                if (vehicle) {
                    vehicle.health = stored.health || vehicle.maxHealth;
                    this.game.systems.audio.playPickup();
                    this.game.systems.ui.showMissionText(`${stored.type.toUpperCase()} retrieved!`, 2);
                }
            }
        }
    }

    _updateDamageEffects(vehicle, dt) {
        if (!vehicle.mesh) return;
        const healthPct = vehicle.health / vehicle.maxHealth;

        // Visual dent deformation (progressive)
        if (!vehicle._dentApplied) vehicle._dentApplied = 1.0;
        if (healthPct < vehicle._dentApplied - 0.2) {
            vehicle._dentApplied = healthPct;
            // Apply random offsets to mesh children to simulate dents
            const damageSev = 1 - healthPct; // 0=pristine, 1=wrecked
            vehicle.mesh.children.forEach((child, i) => {
                if (!child.isMesh) return;
                if (!child.userData._origPos) {
                    child.userData._origPos = child.position.clone();
                    child.userData._origRot = child.rotation.clone();
                }
                const jitter = damageSev * 0.08;
                child.position.x = child.userData._origPos.x + (Math.random() - 0.5) * jitter;
                child.position.y = child.userData._origPos.y + (Math.random() - 0.5) * jitter * 0.5;
                child.position.z = child.userData._origPos.z + (Math.random() - 0.5) * jitter;
                child.rotation.x = child.userData._origRot.x + (Math.random() - 0.5) * damageSev * 0.06;
                child.rotation.z = child.userData._origRot.z + (Math.random() - 0.5) * damageSev * 0.06;
            });

            // Darken color progressively
            vehicle.mesh.traverse((child) => {
                if (child.isMesh && child.material && child.material.color) {
                    if (!child.userData._origColor) {
                        child.userData._origColor = child.material.color.getHex();
                    }
                    const origColor = new THREE.Color(child.userData._origColor);
                    const darkFactor = 0.4 + healthPct * 0.6; // 40-100% brightness
                    child.material.color.setRGB(
                        origColor.r * darkFactor,
                        origColor.g * darkFactor,
                        origColor.b * darkFactor
                    );
                }
            });
        }

        // Smoke when below 50% health
        if (healthPct < 0.5 && healthPct > 0) {
            vehicle._smokeTimer = (vehicle._smokeTimer || 0) + dt;
            const smokeInterval = healthPct < 0.25 ? 0.05 : 0.15;
            if (vehicle._smokeTimer >= smokeInterval) {
                vehicle._smokeTimer = 0;
                this._spawnSmoke(vehicle, healthPct < 0.25);
            }
        }

        // Fire when below 15% health
        if (healthPct < 0.15 && healthPct > 0) {
            vehicle._fireTimer = (vehicle._fireTimer || 0) + dt;
            if (vehicle._fireTimer >= 0.03) {
                vehicle._fireTimer = 0;
                this._spawnFire(vehicle);
            }

            // Auto-explode countdown
            vehicle._explodeTimer = (vehicle._explodeTimer || 5);
            vehicle._explodeTimer -= dt;
            if (vehicle._explodeTimer <= 0) {
                this._explodeVehicle(vehicle);
            }
        }

        // Vehicle destroyed
        if (vehicle.health <= 0 && !vehicle._destroyed) {
            this._explodeVehicle(vehicle);
        }
    }

    _spawnSmoke(vehicle, heavy) {
        const vType = this.vehicleTypes[vehicle.type];
        const geo = new THREE.SphereGeometry(heavy ? 0.4 : 0.25, 4, 4);
        const mat = new THREE.MeshBasicMaterial({
            color: heavy ? 0x222222 : 0x888888,
            transparent: true,
            opacity: heavy ? 0.6 : 0.3
        });
        const smoke = new THREE.Mesh(geo, mat);
        // Emit from hood area
        smoke.position.set(
            vehicle.mesh.position.x + (Math.random() - 0.5) * 0.5,
            vehicle.mesh.position.y + (vType ? vType.height : 1.0),
            vehicle.mesh.position.z + Math.sin(vehicle.mesh.rotation.y) * (vType ? vType.length * 0.3 : 1)
        );
        this.game.scene.add(smoke);

        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            smoke.position.y += 0.03;
            smoke.position.x += (Math.random() - 0.5) * 0.02;
            smoke.position.z += (Math.random() - 0.5) * 0.02;
            const scale = 1 + elapsed * 2;
            smoke.scale.set(scale, scale, scale);
            mat.opacity = Math.max(0, (heavy ? 0.6 : 0.3) - elapsed * 0.6);
            if (elapsed < 1.5) {
                requestAnimationFrame(animate);
            } else {
                this.game.scene.remove(smoke);
                geo.dispose();
                mat.dispose();
            }
        };
        animate();
    }

    _spawnFire(vehicle) {
        const vType = this.vehicleTypes[vehicle.type];
        const colors = [0xff4400, 0xff8800, 0xffcc00];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const geo = new THREE.SphereGeometry(0.15 + Math.random() * 0.15, 4, 4);
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8
        });
        const fire = new THREE.Mesh(geo, mat);
        fire.position.set(
            vehicle.mesh.position.x + (Math.random() - 0.5) * 0.8,
            vehicle.mesh.position.y + (vType ? vType.height * 0.5 : 0.5) + Math.random() * 0.3,
            vehicle.mesh.position.z + Math.sin(vehicle.mesh.rotation.y) * (vType ? vType.length * 0.25 : 0.5)
        );
        this.game.scene.add(fire);

        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            fire.position.y += 0.05;
            const scale = 1 + elapsed * 3;
            fire.scale.set(scale, scale * 1.5, scale);
            mat.opacity = Math.max(0, 0.8 - elapsed * 4);
            if (elapsed < 0.25) {
                requestAnimationFrame(animate);
            } else {
                this.game.scene.remove(fire);
                geo.dispose();
                mat.dispose();
            }
        };
        animate();
    }

    _updateHeadlights(vehicle) {
        if (!vehicle.mesh) return;
        const world = this.game.systems.world;
        const isNight = world && world.isNight;

        // Create headlights on first call
        if (!vehicle._headlightsCreated) {
            vehicle._headlightsCreated = true;
            const vType = this.vehicleTypes[vehicle.type];
            if (!vType || vehicle.type === 'boat') return;

            // Two spotlights (left and right headlight)
            vehicle._headlights = [];
            for (const side of [-0.4, 0.4]) {
                const light = new THREE.SpotLight(0xffffee, 0, 30, Math.PI / 5, 0.5, 1.5);
                light.position.set(side * vType.width, vType.height * 0.35, vType.length / 2);
                light.target.position.set(side * vType.width * 0.3, -0.5, vType.length / 2 + 15);
                vehicle.mesh.add(light);
                vehicle.mesh.add(light.target);
                vehicle._headlights.push(light);
            }
        }

        // Create taillights on first call
        if (!vehicle._taillightsCreated) {
            vehicle._taillightsCreated = true;
            const vType = this.vehicleTypes[vehicle.type];
            if (!vType || vehicle.type === 'boat' || vehicle.type === 'helicopter') {
                vehicle._taillights = null;
            } else {
                vehicle._taillights = [];
                for (const side of [-0.4, 0.4]) {
                    const tlGeo = new THREE.SphereGeometry(0.12, 6, 6);
                    const tlMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0 });
                    const tl = new THREE.Mesh(tlGeo, tlMat);
                    tl.position.set(side * vType.width, vType.height * 0.3, -vType.length / 2);
                    vehicle.mesh.add(tl);
                    vehicle._taillights.push(tl);
                }
            }
        }

        // Toggle headlights based on night mode
        if (vehicle._headlights) {
            for (const light of vehicle._headlights) {
                light.intensity = isNight ? 2.0 : 0;
            }
        }

        // Toggle taillights based on night mode
        if (vehicle._taillights) {
            for (const tl of vehicle._taillights) {
                tl.material.opacity = isNight ? 0.9 : 0;
            }
        }
    }

    _explodeVehicle(vehicle) {
        if (vehicle._destroyed) return;
        vehicle._destroyed = true;
        vehicle.health = 0;
        vehicle.speed = 0;

        // Eject driver if player is in it
        if (vehicle.occupied && vehicle.driver === this.game.systems.player) {
            const player = this.game.systems.player;
            player.exitVehicle();
            player.takeDamage(30);
            // Knockback
            const angle = Math.random() * Math.PI * 2;
            player.velocity.x = Math.sin(angle) * 10;
            player.velocity.z = Math.cos(angle) * 10;
            player.velocity.y = 5;
        }

        // Use weapons system explosion
        this.game.systems.weapons.explode(vehicle.mesh.position.clone(), 10, 60);

        // Char the vehicle mesh
        vehicle.mesh.traverse(child => {
            if (child.isMesh && child.material) {
                child.material = child.material.clone();
                child.material.color.setHex(0x111111);
                child.material.emissive = new THREE.Color(0x000000);
                child.material.roughness = 1;
                child.material.metalness = 0;
            }
        });
    }

    _checkNPCCollision(vehicle, dt) {
        const npcs = this.game.systems.npcs;
        if (!npcs || !vehicle.mesh) return;

        const vType = this.vehicleTypes[vehicle.type];
        if (!vType) return;
        const halfW = vType.width / 2;
        const halfL = vType.length / 2;
        const vPos = vehicle.mesh.position;

        for (const npc of npcs.pedestrians) {
            if (!npc.alive || !npc.mesh) continue;
            const nPos = npc.mesh.position;
            const dx = nPos.x - vPos.x;
            const dz = nPos.z - vPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < halfL + 0.5) {
                // Hit NPC - damage based on speed
                const damage = Math.abs(vehicle.speed) * 2;
                npc.takeDamage(damage);

                // Push NPC in vehicle's forward direction
                const fwd = new THREE.Vector3(
                    Math.sin(vehicle.mesh.rotation.y),
                    0,
                    Math.cos(vehicle.mesh.rotation.y)
                );
                npc.mesh.position.x += fwd.x * Math.abs(vehicle.speed) * 0.3;
                npc.mesh.position.z += fwd.z * Math.abs(vehicle.speed) * 0.3;

                // Vehicle slows slightly on impact
                vehicle.speed *= 0.9;

                // Flee nearby NPCs
                npcs.fleeFromPoint(vPos);
            }
        }
    }

    _animateWheels(vehicle, dt) {
        if (!vehicle.mesh) return;
        const wheels = vehicle.mesh.userData.wheels;
        if (!wheels || wheels.length === 0) return;

        const spinRate = vehicle.speed * dt * 2;
        const steerAngle = (vehicle.steerAngle || 0) * 0.6; // visual steering
        for (const wheel of wheels) {
            wheel.rotation.x += spinRate;
            // Front wheel steering
            if (wheel.name && wheel.name.includes('front')) {
                wheel.rotation.y = steerAngle;
            }
        }
    }

    updateDriving(vehicle, dt) {
        // Helicopter flight path
        if (vehicle.type === 'helicopter') {
            this._updateHelicopterFlight(vehicle, dt);
            return;
        }

        const input = this.game.systems.input;
        const vType = this.vehicleTypes[vehicle.type];

        // Get acceleration from dedicated key checks (not moveY which conflicts with on-foot)
        let accelInput = 0;
        let brakeInput = 0;
        let steerInput = 0;

        // Keyboard: direct key checks for vehicle controls
        accelInput = (input.keys['KeyW'] || input.keys['ArrowUp']) ? 1 : 0;
        brakeInput = (input.keys['KeyS'] || input.keys['ArrowDown']) ? 1 : 0;
        steerInput = (input.keys['KeyA'] || input.keys['ArrowLeft'] ? -1 : 0)
                   + (input.keys['KeyD'] || input.keys['ArrowRight'] ? 1 : 0);

        // Gamepad: merge as secondary input
        if (input.gamepadIndex >= 0) {
            const gp = navigator.getGamepads()[input.gamepadIndex];
            if (gp) {
                const gpAccel = gp.buttons[7]?.value || 0;
                const gpBrake = gp.buttons[6]?.value || 0;
                const gpSteer = input.applyDeadzone(gp.axes[0]);
                accelInput = Math.max(accelInput, gpAccel);
                brakeInput = Math.max(brakeInput, gpBrake);
                if (Math.abs(gpSteer) > Math.abs(steerInput)) steerInput = gpSteer;
            }
        }

        // Touch joystick: forward = accel, back = brake, left/right = steer
        if (input.touchJoystick.active) {
            const ty = -input.touchJoystick.rawY; // rawY is screen-space, negate for forward
            if (ty > 0.1) accelInput = Math.max(accelInput, ty);
            if (ty < -0.1) brakeInput = Math.max(brakeInput, Math.abs(ty));
            if (Math.abs(input.touchJoystick.rawX) > Math.abs(steerInput)) {
                steerInput = input.touchJoystick.rawX;
            }
        }

        // Acceleration
        if (accelInput > 0) {
            vehicle.speed += vType.accel * accelInput * dt;
        }
        if (brakeInput > 0) {
            vehicle.speed -= vType.accel * brakeInput * 0.8 * dt;
        }

        // Drag
        vehicle.speed *= (1 - 0.5 * dt);

        // Nitro boost: Shift while driving
        if ((input.keys['ShiftLeft'] || input.keys['ShiftRight']) && !this.nitroActive && this.nitroCharges > 0 && vehicle.speed > 5) {
            this.nitroActive = true;
            this.nitroTimer = this.nitroDuration;
            this.nitroCharges--;
            this.game.systems.ui.showMissionText(`NITRO! (${this.nitroCharges} left)`, 1.5);
            this.game.systems.audio.playPickup();
        }

        if (this.nitroActive) {
            this.nitroTimer -= dt;
            // Boost acceleration
            vehicle.speed += vType.accel * 3.0 * dt;
            // Spawn flame particles
            this._spawnNitroFlame(vehicle);

            if (this.nitroTimer <= 0) {
                this.nitroActive = false;
            }
        }

        // Clamp speed (doubled max during nitro)
        const speedLimit = this.nitroActive ? vType.maxSpeed * 2.0 : vType.maxSpeed;
        vehicle.speed = Math.max(-vType.maxSpeed * 0.3, Math.min(speedLimit, vehicle.speed));

        // Popped tires reduce max speed
        if (vehicle._tiresPopped) {
            vehicle.speed = Math.max(-vType.maxSpeed * 0.1, Math.min(vType.maxSpeed * 0.3, vehicle.speed));
        }

        // Weather: reduce traction in rain/storm
        const weather = this.game.currentWeather;
        let tractionMod = 1;
        if (weather === 'rain' || weather === 'storm') {
            tractionMod = 0.85;
        }

        // Handbrake / drift (Space while driving)
        const handbrake = input.keys['Space'] || false;
        const absSpeed = Math.abs(vehicle.speed);
        const absSteerInput = Math.abs(steerInput);

        let steerAmount = 0;

        if (handbrake && absSpeed > 8 && absSteerInput > 0.3 && vehicle.type !== 'boat') {
            // Initiate or continue drifting
            if (!this.isDrifting) {
                this.isDrifting = true;
                this.driftScore = 0;
                this.driftMultiplier = 1;
                this.driftTimer = 0;
            }
            tractionMod *= 0.4; // Massively reduce traction
            // Extra oversteer during drift
            const driftBoost = 1.8;
            steerAmount = -vType.handling * steerInput * driftBoost * (1 + 10 / (absSpeed + 5)) * tractionMod;
            vehicle.mesh.rotation.y += steerAmount * vehicle.speed * dt;
            vehicle.steerAngle = steerInput;

            // Track drift angle (how sideways we are)
            this.driftAngle = absSteerInput * absSpeed * 0.1;
            this.driftTimer += dt;

            // Score accumulates faster at higher speed and steeper angle
            const scoreRate = absSpeed * this.driftAngle * 2;
            this.driftScore += scoreRate * dt;

            // Multiplier increases over time
            if (this.driftTimer > 2) this.driftMultiplier = 2;
            if (this.driftTimer > 4) this.driftMultiplier = 3;
            if (this.driftTimer > 6) this.driftMultiplier = 4;

            this._driftDisplayTimer = 1.5;

            // Reduce speed slightly during handbrake
            vehicle.speed *= (1 - 0.8 * dt);

            // Spawn tire smoke
            this._spawnTireSmoke(vehicle);
        } else {
            // Normal steering
            steerAmount = -vType.handling * steerInput * (1 + 10 / (absSpeed + 5)) * tractionMod;
            vehicle.mesh.rotation.y += steerAmount * vehicle.speed * dt;
            vehicle.steerAngle = steerInput;

            // End drift — award points
            if (this.isDrifting) {
                this.isDrifting = false;
                const finalScore = Math.floor(this.driftScore * this.driftMultiplier);
                if (finalScore > 50) {
                    const cash = Math.floor(finalScore / 10);
                    this.game.systems.player.addCash(cash);
                    const multiplierText = this.driftMultiplier > 1 ? ` x${this.driftMultiplier}` : '';
                    this.game.systems.ui.showMissionText(
                        `DRIFT! ${finalScore} pts${multiplierText}\n+$${cash}`, 2
                    );
                    this.game.systems.audio.playPickup();
                }
                this.driftAngle = 0;
                this.driftTimer = 0;
            }
        }

        // Update tire smoke particles
        this._updateTireSmoke(dt);

        // Move forward
        const forward = new THREE.Vector3(
            Math.sin(vehicle.mesh.rotation.y),
            0,
            Math.cos(vehicle.mesh.rotation.y)
        );

        const physics = this.game.systems.physics;
        if (physics && physics.ready && vehicle.physicsBody) {
            // Rapier kinematic velocity path — terrain-following via physics raycast
            let yVel = 0;
            if (vehicle.type !== 'boat' && vehicle.type !== 'helicopter') {
                const groundY = physics.getGroundHeight(vehicle.mesh.position.x, vehicle.mesh.position.z);
                yVel = (groundY - vehicle.mesh.position.y) * 8;
            }
            const linvel = {
                x: forward.x * vehicle.speed,
                y: yVel,
                z: forward.z * vehicle.speed
            };
            const angvel = {
                x: 0,
                y: steerAmount * vehicle.speed,
                z: 0
            };
            physics.setVehicleLinvel(vehicle, linvel);
            physics.setVehicleAngvel(vehicle, angvel);

            // Boat physics (bobbing, wake, boundaries)
            if (vehicle.type === 'boat') {
                this._updateBoatPhysics(vehicle, dt);
            }
        } else {
            // Fallback: old collision system
            const newX = vehicle.mesh.position.x + forward.x * vehicle.speed * dt;
            const newZ = vehicle.mesh.position.z + forward.z * vehicle.speed * dt;

            const world = this.game.systems.world;
            const halfW = vType.width / 2;
            const halfL = vType.length / 2;

            const collision = world.checkCollision(newX, newZ, Math.max(halfW, halfL));
            if (collision && collision.type === 'building') {
                const crashIntensity = Math.min(1, Math.abs(vehicle.speed) / 30);
                this.game.systems.audio.playCrash(crashIntensity);
                this.game.systems.camera.addShake(crashIntensity * 0.5);
                vehicle.health -= Math.abs(vehicle.speed) * 0.5;
                vehicle.speed *= -0.3;
            } else {
                vehicle.mesh.position.x = newX;
                vehicle.mesh.position.z = newZ;
            }

            // Ground vehicles follow terrain elevation via physics raycast
            if (vehicle.type !== 'boat' && vehicle.type !== 'helicopter' && !vehicle._stuntActive) {
                const ph = this.game.systems.physics;
                const terrainY = (ph && ph.ready) ? ph.getGroundHeight(vehicle.mesh.position.x, vehicle.mesh.position.z) : 0;
                vehicle.mesh.position.y = terrainY;
            }

            if (vehicle.type === 'boat') {
                this._updateBoatPhysics(vehicle, dt);
            }

            // Update player position to vehicle position (fallback only)
            this.game.systems.player.position.copy(vehicle.mesh.position);
        }

        // Building collision check (AABB against world colliders)
        const vm = vehicle.mesh.position;
        const vHalfW = (vType.width || 2) / 2;
        const vHalfD = (vType.length || 4) / 2;
        const vMinX = vm.x - vHalfW, vMaxX = vm.x + vHalfW;
        const vMinZ = vm.z - vHalfD, vMaxZ = vm.z + vHalfD;
        const colliders = this.game.systems.world?.colliders || [];
        for (const c of colliders) {
            if (vMaxX > c.minX && vMinX < c.maxX && vMaxZ > c.minZ && vMinZ < c.maxZ) {
                // Push out along shortest penetration axis
                const overlapX1 = vMaxX - c.minX;
                const overlapX2 = c.maxX - vMinX;
                const overlapZ1 = vMaxZ - c.minZ;
                const overlapZ2 = c.maxZ - vMinZ;
                const minOverlap = Math.min(overlapX1, overlapX2, overlapZ1, overlapZ2);
                if (minOverlap === overlapX1) vm.x -= overlapX1;
                else if (minOverlap === overlapX2) vm.x += overlapX2;
                else if (minOverlap === overlapZ1) vm.z -= overlapZ1;
                else vm.z += overlapZ2;
                vehicle.speed *= -0.3;
                break;
            }
        }

        // Water boundary - slow vehicles in water
        if (vehicle.mesh.position.y < -0.3) {
            vehicle.speed *= 0.95; // drag
            if (vehicle.type !== 'boat') {
                vehicle.speed *= 0.9;
            }
        }

        // Engine sound
        this.game.systems.audio.playEngineLoop(vehicle.speed, vehicle.type);

        // Tire screech on sharp turns at speed or drifting
        if (absSpeed > 10 && (absSteerInput > 0.5 || this.isDrifting)) {
            if (!vehicle._screechCooldown || vehicle._screechCooldown <= 0) {
                this.game.systems.audio.playTireScreech(absSteerInput * absSpeed / 50);
                vehicle._screechCooldown = this.isDrifting ? 0.15 : 0.3;
            }
        }
        vehicle._screechCooldown = (vehicle._screechCooldown || 0) - dt;

        // Skid marks on sharp turns / drifting
        if (absSpeed > 8 && (absSteerInput > 0.6 || this.isDrifting) && vehicle.type !== 'boat') {
            this._laySkidMark(vehicle);
        }

        // Track driving distance
        this.game.stats.distanceDriven += Math.abs(vehicle.speed) * dt;

        // Horn
        if (input.justPressed('horn') && (this._hornCooldown || 0) <= 0) {
            this._hornCooldown = 0.5;
            this.game.systems.audio.playHorn(vehicle.type);
            // Nearby pedestrians jump sideways out of the vehicle's path
            const vFwd = new THREE.Vector3(
                Math.sin(vehicle.mesh.rotation.y),
                0,
                Math.cos(vehicle.mesh.rotation.y)
            );
            const npcs = this.game.systems.npcs;
            for (const npc of npcs.pedestrians) {
                if (!npc.alive || !npc.mesh) continue;
                const dx = npc.mesh.position.x - vehicle.mesh.position.x;
                const dz = npc.mesh.position.z - vehicle.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < 15) {
                    const toNPC = new THREE.Vector3(dx, 0, dz).normalize();
                    const dot = vFwd.dot(toNPC);
                    if (dot > 0.2) {
                        // NPC is ahead — jump to the side
                        const perpX = -vFwd.z;
                        const perpZ = vFwd.x;
                        const side = (perpX * dx + perpZ * dz > 0) ? 1 : -1;
                        npc.walkDir = Math.atan2(perpX * side, perpZ * side);
                        npc.isFleeing = true;
                        npc.fleeTarget = vehicle.mesh.position.clone();
                    } else if (dist < 8) {
                        // NPC is to the side/behind — just flee away
                        npc.walkDir = Math.atan2(dx, dz);
                        npc.isFleeing = true;
                        npc.fleeTarget = vehicle.mesh.position.clone();
                    }
                }
            }
        }
        if (this._hornCooldown > 0) this._hornCooldown -= dt;

        // Radio cycling: Q key while in vehicle
        if (input.justPressed('weaponCycle')) {
            this.game.systems.audio.cycleRadio(1);
            const stationName = this.game.systems.audio.getRadioStationName();
            this.game.systems.ui.showMissionText(stationName, 2);
        }

        // Stunt jump detection
        this._checkStuntJumps(vehicle, dt);

        // Update speed HUD
        const speedEl = document.getElementById('hud-speed');
        if (speedEl) {
            speedEl.style.display = 'block';
            const radioName = this.game.systems.audio.currentStation >= 0
                ? this.game.systems.audio.radioStations[this.game.systems.audio.currentStation]
                : '';
            speedEl.textContent = Math.abs(Math.round(vehicle.speed * 3.6)) + ' km/h' +
                (radioName ? '  |  ' + radioName : '');
        }
    }

    _updateSideJobs(dt) {
        const player = this.game.systems.player;
        const input = this.game.systems.input;
        if (!player.inVehicle || !player.currentVehicle) return;

        const vehicle = player.currentVehicle;

        // Taxi mode — available in yellow vehicles
        if (this._isYellowVehicle(vehicle) && !this.vigilanteActive) {
            if (!this.taxiActive) {
                const promptEl = document.getElementById('hud-interact-prompt');
                if (!this.game.systems.missions.missionActive && !this.game.systems.missions.activeSideMission) {
                    promptEl.textContent = 'Press R to start Taxi missions';
                    promptEl.classList.add('visible');
                    if (input.justPressed('radio')) {
                        this._startTaxiMode();
                    }
                }
            } else {
                this._updateTaxi(dt);
            }
        }

        // Vigilante mode — available in white/police vehicles
        if (this._isPoliceVehicle(vehicle) && !this.taxiActive) {
            if (!this.vigilanteActive) {
                const promptEl = document.getElementById('hud-interact-prompt');
                if (!this.game.systems.missions.missionActive && !this.game.systems.missions.activeSideMission) {
                    promptEl.textContent = 'Press R to start Vigilante missions';
                    promptEl.classList.add('visible');
                    if (input.justPressed('radio')) {
                        this._startVigilanteMode();
                    }
                }
            } else {
                this._updateVigilante(dt);
            }
        }

        // Cancel if player exits vehicle
        if (!player.inVehicle) {
            if (this.taxiActive) this._endTaxi();
            if (this.vigilanteActive) this._endVigilante();
        }
    }

    _isYellowVehicle(vehicle) {
        if (!vehicle || !vehicle.mesh) return false;
        let isYellow = false;
        vehicle.mesh.traverse(child => {
            if (child.isMesh && child.material && child.material.color) {
                const h = {};
                child.material.color.getHSL(h);
                if (h.h > 0.1 && h.h < 0.18 && h.s > 0.5) isYellow = true;
            }
        });
        return isYellow || vehicle._isTaxi;
    }

    _isPoliceVehicle(vehicle) {
        return vehicle._isPolice || (vehicle.mesh && vehicle.mesh.userData && vehicle.mesh.userData.useGLB && vehicle.type === 'sedan');
    }

    // === TAXI SYSTEM ===

    _startTaxiMode() {
        this.taxiActive = true;
        this.taxiFareCount = 0;
        this.taxiEarned = 0;
        this.game.systems.ui.showMissionText('TAXI MODE ACTIVE', 2);
        this._spawnTaxiFare();
    }

    _spawnTaxiFare() {
        const player = this.game.systems.player;
        // Pickup location near player
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 40;
        const pickupX = player.position.x + Math.cos(angle) * dist;
        const pickupZ = player.position.z + Math.sin(angle) * dist;

        // Random destination
        const destinations = [
            { x: 0, z: 0, name: 'Downtown' },
            { x: 250, z: -250, name: 'The Strip' },
            { x: -250, z: 250, name: 'The Docks' },
            { x: -250, z: -250, name: 'Hillside' },
            { x: 250, z: 250, name: 'Industrial' },
        ];
        const dest = destinations[Math.floor(Math.random() * destinations.length)];

        // Pickup marker
        const geo = new THREE.ConeGeometry(0.5, 1.5, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        const marker = new THREE.Mesh(geo, mat);
        marker.position.set(pickupX, 2, pickupZ);
        marker.rotation.x = Math.PI;
        this.game.scene.add(marker);

        this.taxiFare = {
            phase: 'pickup',
            pickupX, pickupZ,
            destX: dest.x + (Math.random() - 0.5) * 40,
            destZ: dest.z + (Math.random() - 0.5) * 40,
            destName: dest.name,
            marker,
            timer: 45 + this.taxiFareCount * 5,
            pay: 200 + this.taxiFareCount * 100
        };

        this.game.systems.ui.waypoint = { x: pickupX, z: pickupZ };
        this.game.systems.ui.showMissionText('Pick up the fare', 3);
    }

    _updateTaxi(dt) {
        if (!this.taxiFare) return;
        const player = this.game.systems.player;
        const fare = this.taxiFare;

        // Animate marker
        if (fare.marker) {
            fare.marker.rotation.y += dt * 3;
            fare.marker.position.y = 2 + Math.sin(Date.now() * 0.003) * 0.3;
        }

        if (fare.phase === 'pickup') {
            const dx = player.position.x - fare.pickupX;
            const dz = player.position.z - fare.pickupZ;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 6) {
                fare.phase = 'deliver';
                this.game.scene.remove(fare.marker);
                fare.marker.geometry.dispose();
                fare.marker.material.dispose();

                // Destination marker
                const geo = new THREE.ConeGeometry(0.5, 1.5, 4);
                const mat = new THREE.MeshBasicMaterial({ color: 0x44ff44 });
                const marker = new THREE.Mesh(geo, mat);
                marker.position.set(fare.destX, 2, fare.destZ);
                marker.rotation.x = Math.PI;
                this.game.scene.add(marker);
                fare.marker = marker;

                this.game.systems.ui.waypoint = { x: fare.destX, z: fare.destZ };
                this.game.systems.ui.showMissionText(`Deliver to ${fare.destName}`, 3);
                this.game.systems.audio.playPickup();
            }
        } else if (fare.phase === 'deliver') {
            fare.timer -= dt;

            // Show timer
            const timerEl = document.getElementById('hud-escape-timer');
            if (timerEl) {
                timerEl.style.display = 'block';
                timerEl.textContent = `FARE: $${fare.pay} — ${Math.ceil(fare.timer)}s`;
                timerEl.style.color = fare.timer < 10 ? '#dd4444' : '#ffcc44';
            }

            if (fare.timer <= 0) {
                this.game.systems.ui.showMissionText('Fare lost — too slow!', 2);
                this._cleanupTaxiFare();
                setTimeout(() => this._spawnTaxiFare(), 2000);
                return;
            }

            const dx = player.position.x - fare.destX;
            const dz = player.position.z - fare.destZ;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 8) {
                // Fare delivered!
                this.taxiFareCount++;
                this.taxiEarned += fare.pay;
                player.addCash(fare.pay);
                this.game.systems.ui.showMissionComplete(`Fare ${this.taxiFareCount} Complete!`, fare.pay);
                this._cleanupTaxiFare();
                // Next fare after delay
                setTimeout(() => {
                    if (this.taxiActive) this._spawnTaxiFare();
                }, 3000);
            }
        }
    }

    _cleanupTaxiFare() {
        if (this.taxiFare && this.taxiFare.marker) {
            this.game.scene.remove(this.taxiFare.marker);
            this.taxiFare.marker.geometry.dispose();
            this.taxiFare.marker.material.dispose();
        }
        this.taxiFare = null;
        const timerEl = document.getElementById('hud-escape-timer');
        if (timerEl) timerEl.style.display = 'none';
        this.game.systems.ui.waypoint = null;
    }

    _endTaxi() {
        this.taxiActive = false;
        this._cleanupTaxiFare();
        if (this.taxiEarned > 0) {
            this.game.systems.ui.showMissionText(`Taxi shift over — Earned $${this.taxiEarned}`, 3);
        }
    }

    // === VIGILANTE SYSTEM ===

    _startVigilanteMode() {
        this.vigilanteActive = true;
        this.vigilanteLevel = 0;
        this.game.systems.ui.showMissionText('VIGILANTE MODE ACTIVE', 2);
        this._spawnVigilanteTarget();
    }

    _spawnVigilanteTarget() {
        this.vigilanteLevel++;
        const player = this.game.systems.player;

        // Spawn criminal vehicle ahead
        const angle = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 30;
        const x = player.position.x + Math.cos(angle) * dist;
        const z = player.position.z + Math.sin(angle) * dist;

        const criminalCar = this.spawnVehicle(x, z, 'sedan');
        if (criminalCar) {
            // Make it red
            criminalCar.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material = child.material.clone();
                    child.material.color.setHex(0xcc2222);
                }
            });
            criminalCar._isCriminal = true;
            criminalCar._criminalSpeed = 15 + this.vigilanteLevel * 3;
            criminalCar._criminalTimer = 30 + this.vigilanteLevel * 5;
        }

        this.vigilanteTarget = criminalCar;
        this.game.systems.ui.showMissionText(`Level ${this.vigilanteLevel}: Stop the criminal!`, 3);
    }

    _updateVigilante(dt) {
        if (!this.vigilanteTarget) return;
        const player = this.game.systems.player;
        const target = this.vigilanteTarget;

        if (!target.mesh) {
            this._spawnVigilanteTarget();
            return;
        }

        // Criminal AI — drive away from player
        const toPlayer = new THREE.Vector3().subVectors(player.position, target.mesh.position);
        const dist = toPlayer.length();

        // Set waypoint to criminal
        this.game.systems.ui.waypoint = { x: target.mesh.position.x, z: target.mesh.position.z };

        // Move criminal away from player
        const awayDir = toPlayer.normalize().multiplyScalar(-1);
        const speed = target._criminalSpeed;
        const newX = target.mesh.position.x + awayDir.x * speed * dt;
        const newZ = target.mesh.position.z + awayDir.z * speed * dt;

        const collision = this.game.systems.world.checkCollision(newX, newZ, 1.5);
        if (!collision) {
            target.mesh.position.x = newX;
            target.mesh.position.z = newZ;
            target.mesh.rotation.y = Math.atan2(awayDir.x, awayDir.z);
        } else {
            // Turn randomly when hitting a wall
            const randAngle = Math.random() * Math.PI;
            target.mesh.position.x += Math.cos(randAngle) * speed * dt;
            target.mesh.position.z += Math.sin(randAngle) * speed * dt;
        }

        // Timer
        target._criminalTimer -= dt;
        const timerEl = document.getElementById('hud-escape-timer');
        if (timerEl) {
            timerEl.style.display = 'block';
            timerEl.textContent = `CRIMINAL — ${Math.ceil(target._criminalTimer)}s`;
            timerEl.style.color = target._criminalTimer < 10 ? '#dd4444' : '#44aaff';
        }

        // Criminal caught — player rams into them
        if (dist < 5 && player.currentVehicle) {
            const playerSpeed = Math.abs(player.currentVehicle.speed || 0);
            if (playerSpeed > 5) {
                // Caught!
                const reward = 300 + this.vigilanteLevel * 200;
                player.addCash(reward);
                this.game.systems.ui.showMissionComplete(`Criminal ${this.vigilanteLevel} Stopped!`, reward);

                // Remove criminal car
                this.game.scene.remove(target.mesh);
                this.vigilanteTarget = null;

                const timerEl2 = document.getElementById('hud-escape-timer');
                if (timerEl2) timerEl2.style.display = 'none';
                this.game.systems.ui.waypoint = null;

                // Next criminal after delay
                setTimeout(() => {
                    if (this.vigilanteActive) this._spawnVigilanteTarget();
                }, 3000);
                return;
            }
        }

        // Timer expired — criminal escaped
        if (target._criminalTimer <= 0) {
            this.game.systems.ui.showMissionText('Criminal escaped!', 2);
            this.game.scene.remove(target.mesh);
            this.vigilanteTarget = null;
            this._endVigilante();
        }
    }

    _endVigilante() {
        this.vigilanteActive = false;
        if (this.vigilanteTarget && this.vigilanteTarget.mesh) {
            this.game.scene.remove(this.vigilanteTarget.mesh);
        }
        this.vigilanteTarget = null;
        const timerEl = document.getElementById('hud-escape-timer');
        if (timerEl) timerEl.style.display = 'none';
        this.game.systems.ui.waypoint = null;
    }

    _checkStuntJumps(vehicle, dt) {
        const world = this.game.systems.world;
        if (!world.stuntRamps) return;

        const vPos = vehicle.mesh.position;

        // Check if near a ramp and going fast
        if (!this.stuntJumpActive) {
            for (const ramp of world.stuntRamps) {
                const dist = vPos.distanceTo(ramp.position);
                if (dist < 5 && Math.abs(vehicle.speed) > 15) {
                    // Launch! Apply upward velocity
                    this.stuntJumpActive = true;
                    this.stuntJumpAirTime = 0;
                    this.stuntJumpMaxHeight = vPos.y;
                    this.stuntJumpStartPos = vPos.clone();
                    this.stuntJumpRamp = ramp;
                    this.stuntJumpLaunchSpeed = Math.abs(vehicle.speed);
                    this.stuntJumpStartRotY = vehicle.mesh.rotation.y;
                    this.stuntJumpTotalSpin = 0;
                    this.stuntJumpFlips = 0;

                    // Give the vehicle upward velocity by raising it
                    vehicle.mesh.position.y += 0.5;
                    vehicle._stuntVelY = Math.abs(vehicle.speed) * 0.4;

                    // Engage slow-mo
                    this.game.timeScale = 0.35;

                    this.game.systems.ui.showMissionText('STUNT JUMP!', 1.5);
                    break;
                }
            }
        }

        // Track air time (use real dt, not slowed dt, for physics to feel right)
        if (this.stuntJumpActive) {
            // Use unscaled dt for physics so jump arc stays correct
            const realDt = this.game.timeScale > 0 ? dt / this.game.timeScale : dt;
            const physDt = dt; // Already scaled, keep for smooth slow-mo feel

            if (!vehicle._stuntVelY) vehicle._stuntVelY = 0;
            vehicle._stuntVelY -= 15 * realDt;
            vehicle.mesh.position.y += vehicle._stuntVelY * realDt;

            this.stuntJumpAirTime += realDt;
            this.stuntJumpMaxHeight = Math.max(this.stuntJumpMaxHeight, vPos.y);

            // Vehicle rotation during air (slight pitch/roll for visual flair)
            vehicle.mesh.rotation.x = Math.sin(this.stuntJumpAirTime * 1.5) * 0.15;
            this.stuntJumpTotalSpin += Math.abs(vehicle.mesh.rotation.y - (this._lastStuntRotY || vehicle.mesh.rotation.y));
            this._lastStuntRotY = vehicle.mesh.rotation.y;

            // Gradually restore time scale as descent begins
            if (vehicle._stuntVelY < 0) {
                this.game.timeScale = Math.min(1.0, this.game.timeScale + realDt * 0.4);
            }

            // Landed?
            if (vPos.y <= 0 && vehicle._stuntVelY < 0) {
                vehicle.mesh.position.y = 0;
                vehicle._stuntVelY = 0;
                vehicle.mesh.rotation.x = 0;

                // Restore time scale
                this.game.timeScale = 1.0;

                const distance = vPos.distanceTo(this.stuntJumpStartPos);
                const airTime = this.stuntJumpAirTime;
                const maxHeight = this.stuntJumpMaxHeight;
                const spins = this.stuntJumpTotalSpin / (Math.PI * 2);

                if (airTime > 1.0 && distance > 15) {
                    // Score breakdown
                    const distScore = Math.round(distance * 30);
                    const heightScore = Math.round(maxHeight * 50);
                    const airScore = Math.round(airTime * 100);
                    const spinScore = Math.round(spins * 200);
                    const speedBonus = Math.round(this.stuntJumpLaunchSpeed * 10);
                    const totalScore = distScore + heightScore + airScore + spinScore + speedBonus;
                    const cashReward = Math.round(totalScore / 5);

                    if (this.stuntJumpRamp && !this.stuntJumpRamp.completed) {
                        this.stuntJumpRamp.completed = true;
                        this.game.stats.stuntJumpsCompleted++;
                    }

                    this.game.systems.player.addCash(cashReward);

                    // Detailed results
                    const lines = [
                        'STUNT JUMP COMPLETE!',
                        this.stuntJumpRamp ? this.stuntJumpRamp.name : '',
                        `Dist: ${Math.round(distance)}m | Height: ${maxHeight.toFixed(1)}m | Air: ${airTime.toFixed(1)}s`,
                        `Score: ${totalScore} pts | +$${cashReward}`
                    ];
                    if (spins >= 0.5) lines.splice(3, 0, `Spins: ${spins.toFixed(1)} (${spinScore} pts)`);

                    this.game.systems.ui.showMissionText(lines.join('\n'), 5);
                    this.game.systems.audio.playPickup();

                    // NPCs react to stunt
                    const npcs = this.game.systems.npcs;
                    if (npcs) npcs.reactToStunt(vehicle.mesh.position);
                } else {
                    this.game.systems.ui.showMissionText('Stunt Jump Failed', 2);
                }

                this.stuntJumpActive = false;
                this.stuntJumpRamp = null;

                // Big screen shake on landing
                this.game.systems.camera.addShake(0.7);
            }
        }
    }

    _createHelipads() {
        const helipadPositions = [
            { x: 80, z: -80 },
            { x: -250, z: 250 }
        ];
        for (const pos of helipadPositions) {
            // Helipad platform
            const padGeo = new THREE.CylinderGeometry(5, 5, 0.2, 16);
            const padMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 });
            const pad = new THREE.Mesh(padGeo, padMat);
            pad.position.set(pos.x, 0.1, pos.z);
            pad.receiveShadow = true;
            this.game.scene.add(pad);

            // H marking
            const hCanvas = document.createElement('canvas');
            hCanvas.width = 128;
            hCanvas.height = 128;
            const hCtx = hCanvas.getContext('2d');
            hCtx.clearRect(0, 0, 128, 128);
            hCtx.strokeStyle = '#ffffff';
            hCtx.lineWidth = 8;
            hCtx.beginPath();
            hCtx.arc(64, 64, 50, 0, Math.PI * 2);
            hCtx.stroke();
            hCtx.font = 'bold 60px Arial';
            hCtx.fillStyle = '#ffffff';
            hCtx.textAlign = 'center';
            hCtx.textBaseline = 'middle';
            hCtx.fillText('H', 64, 64);

            const hTex = new THREE.CanvasTexture(hCanvas);
            const hGeo = new THREE.PlaneGeometry(6, 6);
            const hMesh = new THREE.Mesh(hGeo, new THREE.MeshBasicMaterial({
                map: hTex, transparent: true, depthWrite: false
            }));
            hMesh.rotation.x = -Math.PI / 2;
            hMesh.position.set(pos.x, 0.22, pos.z);
            this.game.scene.add(hMesh);
        }
    }

    _createDocks() {
        const dockPositions = [
            { x: 120, z: 160, rot: 0, length: 20 },
            { x: 200, z: 120, rot: Math.PI / 2, length: 15 },
            { x: 280, z: 160, rot: 0, length: 18 },
        ];

        const dockMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.9 });
        const postMat = new THREE.MeshStandardMaterial({ color: 0x5a4010, roughness: 0.85 });

        for (const dock of dockPositions) {
            // Main dock platform (wooden planks)
            const plankGeo = new THREE.BoxGeometry(3, 0.3, dock.length);
            const plank = new THREE.Mesh(plankGeo, dockMat);
            plank.position.set(dock.x, 0.15, dock.z);
            plank.rotation.y = dock.rot;
            plank.receiveShadow = true;
            plank.castShadow = true;
            this.game.scene.add(plank);

            // Support posts
            for (let i = 0; i < 4; i++) {
                const postGeo = new THREE.CylinderGeometry(0.12, 0.15, 1.5, 6);
                const post = new THREE.Mesh(postGeo, postMat);
                const along = (i / 3 - 0.5) * dock.length * 0.8;
                const side = (i % 2 === 0 ? 1 : -1) * 1.3;
                const px = dock.x + Math.sin(dock.rot) * along + Math.cos(dock.rot) * side;
                const pz = dock.z + Math.cos(dock.rot) * along - Math.sin(dock.rot) * side;
                post.position.set(px, 0.4, pz);
                this.game.scene.add(post);
            }

            // Rope cleats (small cylinders on top)
            for (const endT of [-0.4, 0.4]) {
                const cleatGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 6);
                const cleat = new THREE.Mesh(cleatGeo, postMat);
                const cx = dock.x + Math.sin(dock.rot) * endT * dock.length;
                const cz = dock.z + Math.cos(dock.rot) * endT * dock.length;
                cleat.position.set(cx, 0.38, cz);
                this.game.scene.add(cleat);
            }

            // Add dock as collider so player can walk on it
            const halfL = dock.length / 2;
            const cosR = Math.cos(dock.rot);
            const sinR = Math.sin(dock.rot);
            // Approximate AABB for the dock
            const w = 1.5;
            this.game.systems.world.colliders.push({
                minX: dock.x - Math.abs(sinR * halfL) - Math.abs(cosR * w),
                maxX: dock.x + Math.abs(sinR * halfL) + Math.abs(cosR * w),
                minZ: dock.z - Math.abs(cosR * halfL) - Math.abs(sinR * w),
                maxZ: dock.z + Math.abs(cosR * halfL) + Math.abs(sinR * w),
                height: 0.5,
                type: 'prop'
            });
        }
    }

    _updateBoatPhysics(vehicle, dt) {
        // Wave bobbing
        if (!vehicle._boatBobPhase) vehicle._boatBobPhase = Math.random() * Math.PI * 2;
        vehicle._boatBobPhase += dt * 1.5;
        const bob = Math.sin(vehicle._boatBobPhase) * 0.15;
        const roll = Math.sin(vehicle._boatBobPhase * 0.7) * 0.04;
        const pitch = Math.cos(vehicle._boatBobPhase * 0.5) * 0.03;

        vehicle.mesh.position.y = 0.3 + bob;
        vehicle.mesh.rotation.x = pitch;
        vehicle.mesh.rotation.z = roll;

        // Water boundary enforcement — keep boat within ocean area
        const world = this.game.systems.world;
        if (world) {
            const bx = vehicle.mesh.position.x;
            const bz = vehicle.mesh.position.z;
            const oceanLimit = world.halfMap + 200; // 600 — don't go too far out
            if (bx < -oceanLimit) { vehicle.mesh.position.x = -oceanLimit; vehicle.speed *= 0.5; }
            if (bx > oceanLimit) { vehicle.mesh.position.x = oceanLimit; vehicle.speed *= 0.5; }
            if (bz < -oceanLimit) { vehicle.mesh.position.z = -oceanLimit; vehicle.speed *= 0.5; }
            if (bz > oceanLimit) { vehicle.mesh.position.z = oceanLimit; vehicle.speed *= 0.5; }
        }

        // Wake spray particles when moving
        const absSpeed = Math.abs(vehicle.speed);
        if (absSpeed > 3 && !vehicle._wakeCooldown) {
            vehicle._wakeCooldown = 0.1;
            const rot = vehicle.mesh.rotation.y;
            const behindX = vehicle.mesh.position.x - Math.sin(rot) * 3;
            const behindZ = vehicle.mesh.position.z - Math.cos(rot) * 3;

            // Create 2 small spray particles
            for (let i = 0; i < 2; i++) {
                const sprayGeo = new THREE.SphereGeometry(0.15, 4, 4);
                const sprayMat = new THREE.MeshBasicMaterial({ color: 0xccddff, transparent: true, opacity: 0.6 });
                const spray = new THREE.Mesh(sprayGeo, sprayMat);
                spray.position.set(
                    behindX + (Math.random() - 0.5) * 2,
                    0.5 + Math.random() * 0.5,
                    behindZ + (Math.random() - 0.5) * 2
                );
                this.game.scene.add(spray);

                const vy = 1 + Math.random() * 2;
                const life = 0.4 + Math.random() * 0.3;
                let elapsed = 0;
                const animateSpray = () => {
                    elapsed += 0.016;
                    spray.position.y += (vy - elapsed * 8) * 0.016;
                    sprayMat.opacity = Math.max(0, 0.6 * (1 - elapsed / life));
                    if (elapsed < life) {
                        requestAnimationFrame(animateSpray);
                    } else {
                        this.game.scene.remove(spray);
                        sprayGeo.dispose();
                        sprayMat.dispose();
                    }
                };
                animateSpray();
            }
        }
        if (vehicle._wakeCooldown) {
            vehicle._wakeCooldown = Math.max(0, vehicle._wakeCooldown - dt);
            if (vehicle._wakeCooldown <= 0) vehicle._wakeCooldown = null;
        }
    }

    _updateHelicopterFlight(vehicle, dt) {
        const input = this.game.systems.input;
        const vType = this.vehicleTypes[vehicle.type];

        // Initialize flight state
        if (vehicle._altitude === undefined) {
            vehicle._altitude = vehicle.mesh.position.y;
            vehicle._vertVel = 0;
            vehicle._tiltX = 0;
            vehicle._tiltZ = 0;
            vehicle._rotorSpeed = 0;
        }

        // Controls: Space = up, Shift = down, W/S = pitch (forward/back), A/D = yaw
        let liftInput = 0;
        let yawInput = 0;
        let pitchInput = 0;
        let rollInput = 0;

        liftInput = (input.keys['Space'] ? 1 : 0) + (input.keys['ShiftLeft'] || input.keys['ShiftRight'] ? -1 : 0);
        yawInput = (input.keys['KeyA'] || input.keys['ArrowLeft'] ? -1 : 0)
                 + (input.keys['KeyD'] || input.keys['ArrowRight'] ? 1 : 0);
        pitchInput = (input.keys['KeyW'] || input.keys['ArrowUp'] ? 1 : 0)
                   + (input.keys['KeyS'] || input.keys['ArrowDown'] ? -1 : 0);

        // Rotor spin up
        const targetRotorSpeed = liftInput !== 0 || vehicle._altitude > 1 ? 30 : 5;
        vehicle._rotorSpeed += (targetRotorSpeed - vehicle._rotorSpeed) * dt * 3;

        // Altitude
        vehicle._vertVel += liftInput * 12 * dt;
        vehicle._vertVel *= (1 - 2 * dt); // Drag
        if (vehicle._altitude <= 0.3 && vehicle._vertVel < 0) vehicle._vertVel = 0;
        vehicle._altitude += vehicle._vertVel * dt;
        vehicle._altitude = Math.max(0.3, Math.min(80, vehicle._altitude));

        // Yaw (rotation)
        vehicle.mesh.rotation.y += yawInput * 2 * dt;

        // Tilt based on pitch/movement
        const targetTiltZ = pitchInput * 0.2;
        vehicle._tiltZ += (targetTiltZ - vehicle._tiltZ) * dt * 5;
        vehicle.mesh.rotation.x = vehicle._tiltZ;

        // Forward movement based on pitch tilt
        const forward = new THREE.Vector3(
            Math.sin(vehicle.mesh.rotation.y),
            0,
            Math.cos(vehicle.mesh.rotation.y)
        );
        const speed = pitchInput * vType.maxSpeed * 0.8;
        vehicle.speed += (speed - vehicle.speed) * dt * 2;
        vehicle.speed *= (1 - 0.5 * dt);

        vehicle.mesh.position.x += forward.x * vehicle.speed * dt;
        vehicle.mesh.position.z += forward.z * vehicle.speed * dt;
        vehicle.mesh.position.y = vehicle._altitude;

        // Animate main rotor
        const mainRotor = vehicle.mesh.getObjectByName('mainRotor');
        if (mainRotor) {
            mainRotor.rotation.y += vehicle._rotorSpeed * dt;
        }

        // Animate tail rotor
        const tailRotor = vehicle.mesh.getObjectByName('tailRotor');
        if (tailRotor) {
            tailRotor.rotation.x += vehicle._rotorSpeed * 1.5 * dt;
        }

        // Engine sound
        this.game.systems.audio.playEngineLoop(vehicle.speed + vehicle._rotorSpeed, 'helicopter');

        // Update player position
        this.game.systems.player.position.copy(vehicle.mesh.position);

        // Speed HUD
        const speedEl = document.getElementById('hud-speed');
        if (speedEl) {
            speedEl.style.display = 'block';
            const alt = Math.round(vehicle._altitude);
            speedEl.textContent = `${Math.abs(Math.round(vehicle.speed * 3.6))} km/h | ALT: ${alt}m`;
        }

        // Track distance
        this.game.stats.distanceDriven += Math.abs(vehicle.speed) * dt;

        // Exit vehicle — only when low enough
        if (input.justPressed('interact') && vehicle._altitude < 3) {
            this.game.systems.player.exitVehicle();
            // Set player to ground level so they don't drop from altitude
            const groundY = this.game.systems.physics.getGroundHeight(
                vehicle.mesh.position.x, vehicle.mesh.position.z
            );
            this.game.systems.player.position.y = groundY;
        }
    }

    syncFromPhysics() {
        const physics = this.game.systems.physics;
        if (!physics || !physics.ready) return;

        for (const vehicle of this.vehicles) {
            if (!vehicle.physicsBody || !vehicle.mesh) continue;
            // Only sync vehicles that are being driven by physics
            if (!vehicle.occupied) continue;

            const pos = physics.getVehiclePosition(vehicle);
            const rot = physics.getVehicleRotation(vehicle);
            if (pos) {
                const vType = this.vehicleTypes[vehicle.type];
                vehicle.mesh.position.set(pos.x, pos.y - (vType ? vType.height / 2 : 0), pos.z);
            }
            if (rot) {
                // Convert quaternion to euler for the mesh
                const euler = new THREE.Euler().setFromQuaternion(
                    new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)
                );
                vehicle.mesh.rotation.y = euler.y;
            }

            // Update player position to synced vehicle position
            if (vehicle.driver === this.game.systems.player) {
                this.game.systems.player.position.copy(vehicle.mesh.position);
            }
        }
    }

    updateTraffic(vehicle, dt) {
        const world = this.game.systems.world;
        const blockSize = world.blockSize;
        const roadHalf = world.roadWidth / 2;

        // Initialize road-following state if needed
        if (vehicle.roadAxis === undefined) {
            // Pick a road axis (0 = X-axis road, 1 = Z-axis road) and direction
            vehicle.roadAxis = Math.random() > 0.5 ? 0 : 1;
            vehicle.roadDir = Math.random() > 0.5 ? 1 : -1;
            vehicle.laneOffset = (Math.random() > 0.5 ? 1 : -1) * (roadHalf * 0.4);
            vehicle.turnCooldown = 0;
            // Snap to nearest road
            this.snapTrafficToRoad(vehicle, blockSize);
        }

        vehicle.turnCooldown = Math.max(0, (vehicle.turnCooldown || 0) - dt);

        // Check for red lights at nearby intersections
        const nearestIntX = Math.round(vehicle.mesh.position.x / blockSize) * blockSize;
        const nearestIntZ = Math.round(vehicle.mesh.position.z / blockSize) * blockSize;
        const distToInt = Math.sqrt(
            (vehicle.mesh.position.x - nearestIntX) ** 2 +
            (vehicle.mesh.position.z - nearestIntZ) ** 2
        );

        let shouldStop = false;
        if (distToInt < roadHalf + 3 && distToInt > 2) {
            // Near intersection - check light
            if (world.isRedLight && world.isRedLight(nearestIntX, nearestIntZ, vehicle.roadAxis)) {
                shouldStop = true;
            }
        }

        // Accelerate to cruising speed (or brake for red light)
        const cruiseSpeed = 12;
        if (shouldStop) {
            vehicle.speed = Math.max(0, vehicle.speed - 20 * dt);
        } else {
            vehicle.speed += (cruiseSpeed - vehicle.speed) * dt * 2;
            vehicle.speed = Math.min(vehicle.speed, cruiseSpeed);
        }

        // Calculate target heading based on road axis and direction
        let targetYaw;
        if (vehicle.roadAxis === 1) {
            // Driving along Z axis
            targetYaw = vehicle.roadDir > 0 ? 0 : Math.PI;
        } else {
            // Driving along X axis
            targetYaw = vehicle.roadDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }

        // Smoothly rotate toward target heading
        let yawDiff = targetYaw - vehicle.mesh.rotation.y;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        vehicle.mesh.rotation.y += yawDiff * Math.min(1, dt * 5);

        // Move forward
        const forward = new THREE.Vector3(
            Math.sin(vehicle.mesh.rotation.y),
            0,
            Math.cos(vehicle.mesh.rotation.y)
        );

        const newX = vehicle.mesh.position.x + forward.x * vehicle.speed * dt;
        const newZ = vehicle.mesh.position.z + forward.z * vehicle.speed * dt;

        // Snap to road center with lane offset
        let correctedX = newX;
        let correctedZ = newZ;
        if (vehicle.roadAxis === 1) {
            // Driving along Z, snap X to nearest road
            const nearestRoadX = Math.round(newX / blockSize) * blockSize;
            correctedX = nearestRoadX + vehicle.laneOffset;
        } else {
            // Driving along X, snap Z to nearest road
            const nearestRoadZ = Math.round(newZ / blockSize) * blockSize;
            correctedZ = nearestRoadZ + vehicle.laneOffset;
        }
        // Gently correct toward road center
        const corrX = correctedX + (newX - correctedX) * 0.3;
        const corrZ = correctedZ + (newZ - correctedZ) * 0.3;

        // Intersection check: near a multiple of blockSize on BOTH axes
        const nearIntX = Math.abs(corrX - Math.round(corrX / blockSize) * blockSize) < roadHalf;
        const nearIntZ = Math.abs(corrZ - Math.round(corrZ / blockSize) * blockSize) < roadHalf;
        const atIntersection = nearIntX && nearIntZ && vehicle.turnCooldown <= 0;

        if (atIntersection) {
            // Randomly decide: straight (60%), turn (40%)
            if (Math.random() < 0.4) {
                vehicle.roadAxis = vehicle.roadAxis === 0 ? 1 : 0;
                vehicle.roadDir = Math.random() > 0.5 ? 1 : -1;
                vehicle.laneOffset = (Math.random() > 0.5 ? 1 : -1) * (roadHalf * 0.4);
            }
            vehicle.turnCooldown = 3; // Don't turn again for 3 seconds
        }

        // Check collision with buildings
        const collision = world.checkCollision(corrX, corrZ, 2);
        if (collision && collision.type === 'building') {
            // Reverse and pick a new road
            vehicle.speed = -3;
            vehicle.roadDir *= -1;
            vehicle.turnCooldown = 1;
        } else {
            vehicle.mesh.position.x = corrX;
            vehicle.mesh.position.z = corrZ;
        }

        // Follow terrain height
        const groundY = this.game.systems.physics.getGroundHeight(vehicle.mesh.position.x, vehicle.mesh.position.z);
        vehicle.mesh.position.y = groundY;

        // Despawn if too far from player
        const playerDist = vehicle.mesh.position.distanceTo(this.game.systems.player.position);
        if (playerDist > 200) {
            this.respawnTraffic(vehicle);
        }
    }

    snapTrafficToRoad(vehicle, blockSize) {
        const pos = vehicle.mesh.position;
        if (vehicle.roadAxis === 1) {
            pos.x = Math.round(pos.x / blockSize) * blockSize + vehicle.laneOffset;
        } else {
            pos.z = Math.round(pos.z / blockSize) * blockSize + vehicle.laneOffset;
        }
    }

    respawnTraffic(vehicle) {
        const player = this.game.systems.player.position;
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 40;
        vehicle.mesh.position.set(
            player.x + Math.cos(angle) * dist,
            0,
            player.z + Math.sin(angle) * dist
        );
        vehicle.mesh.rotation.y = Math.random() * Math.PI * 2;
        vehicle.speed = 0;
    }

    spawnAtPosition(x, z, type) {
        return this.spawnVehicle(x, z, type || 'sedan');
    }

    getNearestVehicle(position, maxDist) {
        let nearest = null;
        let nearDist = maxDist || 5;
        for (const v of this.vehicles) {
            if (!v.mesh) continue;
            const d = position.distanceTo(v.mesh.position);
            if (d < nearDist) {
                nearDist = d;
                nearest = v;
            }
        }
        return nearest;
    }

    // === DRIFT TIRE SMOKE ===

    _spawnTireSmoke(vehicle) {
        if (this._tireSmokeParticles.length > 60) return;

        const vType = this.vehicleTypes[vehicle.type];
        const rearOffset = -vType.length * 0.35;
        const halfW = vType.width * 0.4;

        // Spawn from both rear wheels
        for (const side of [-1, 1]) {
            const localX = side * halfW;
            const localZ = rearOffset;

            // Transform to world coords
            const cos = Math.cos(vehicle.mesh.rotation.y);
            const sin = Math.sin(vehicle.mesh.rotation.y);
            const worldX = vehicle.mesh.position.x + localX * cos - localZ * sin;
            const worldZ = vehicle.mesh.position.z + localX * sin + localZ * cos;

            const geo = new THREE.SphereGeometry(0.3 + Math.random() * 0.2, 4, 4);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xaaaaaa,
                transparent: true,
                opacity: 0.5,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(worldX, 0.2, worldZ);
            this.game.scene.add(mesh);

            this._tireSmokeParticles.push({
                mesh,
                life: 1.0 + Math.random() * 0.5,
                velY: 0.5 + Math.random() * 0.5,
                scale: 1
            });
        }
    }

    _updateTireSmoke(dt) {
        for (let i = this._tireSmokeParticles.length - 1; i >= 0; i--) {
            const p = this._tireSmokeParticles[i];
            p.life -= dt;
            p.mesh.position.y += p.velY * dt;
            p.scale += dt * 1.5;
            p.mesh.scale.setScalar(p.scale);
            p.mesh.material.opacity = Math.max(0, p.life * 0.4);

            if (p.life <= 0) {
                this.game.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this._tireSmokeParticles.splice(i, 1);
            }
        }
    }

    // === NITRO BOOST SYSTEM ===

    _createNitroPickups() {
        const positions = [
            { x: 0, z: -50 },     // Downtown
            { x: 100, z: -100 },  // Near Strip
            { x: -100, z: 100 },  // Near Docks
            { x: -200, z: -200 }, // Hillside
            { x: 200, z: 200 },   // Industrial
            { x: 50, z: 150 },    // Mid-south
            { x: -150, z: -50 },  // West area
            { x: 150, z: -200 },  // East Strip
        ];

        for (const pos of positions) {
            const geo = new THREE.OctahedronGeometry(0.5);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x0088ff,
                transparent: true,
                opacity: 0.8
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(pos.x, 1.2, pos.z);
            this.game.scene.add(mesh);

            // Glow ring
            const ringGeo = new THREE.RingGeometry(0.8, 1.0, 16);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0x0088ff,
                transparent: true,
                opacity: 0.4,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(pos.x, 0.1, pos.z);
            this.game.scene.add(ring);

            this._nitroPickups.push({
                mesh, ring,
                x: pos.x, z: pos.z,
                active: true,
                respawnTimer: 0
            });
        }
    }

    _updateNitroPickups() {
        const player = this.game.systems.player;
        const dt = this.game.deltaTime;

        for (const pickup of this._nitroPickups) {
            if (pickup.active) {
                // Animate: bob and rotate
                pickup.mesh.rotation.y += dt * 2;
                pickup.mesh.position.y = 1.2 + Math.sin(Date.now() * 0.003) * 0.3;

                // Check player proximity (on foot or in vehicle)
                const dx = player.position.x - pickup.x;
                const dz = player.position.z - pickup.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist < 3 && this.nitroCharges < this.nitroMaxCharges) {
                    this.nitroCharges++;
                    pickup.active = false;
                    pickup.mesh.visible = false;
                    pickup.ring.visible = false;
                    pickup.respawnTimer = 60; // Respawn after 60 seconds
                    this.game.systems.ui.showMissionText(`NITRO +1 (${this.nitroCharges}/${this.nitroMaxCharges})`, 2);
                    this.game.systems.audio.playPickup();
                }
            } else {
                // Respawn timer
                pickup.respawnTimer -= dt;
                if (pickup.respawnTimer <= 0) {
                    pickup.active = true;
                    pickup.mesh.visible = true;
                    pickup.ring.visible = true;
                }
            }
        }
    }

    _spawnNitroFlame(vehicle) {
        if (this._nitroFlameParticles.length > 30) return;

        const vType = this.vehicleTypes[vehicle.type];
        const rearZ = -vType.length * 0.45;

        for (const side of [-0.3, 0.3]) {
            const cos = Math.cos(vehicle.mesh.rotation.y);
            const sin = Math.sin(vehicle.mesh.rotation.y);
            const worldX = vehicle.mesh.position.x + side * cos - rearZ * sin;
            const worldZ = vehicle.mesh.position.z + side * sin + rearZ * cos;

            const geo = new THREE.SphereGeometry(0.2 + Math.random() * 0.15, 4, 4);
            const mat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0x4488ff : 0x22aaff,
                transparent: true,
                opacity: 0.7,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(worldX, 0.4, worldZ);
            this.game.scene.add(mesh);

            this._nitroFlameParticles.push({
                mesh,
                life: 0.3 + Math.random() * 0.2,
                velY: 0.5 + Math.random() * 0.5
            });
        }
    }

    _updateNitroFlame(dt) {
        for (let i = this._nitroFlameParticles.length - 1; i >= 0; i--) {
            const p = this._nitroFlameParticles[i];
            p.life -= dt;
            p.mesh.position.y += p.velY * dt;
            p.mesh.material.opacity = Math.max(0, p.life * 2);
            p.mesh.scale.setScalar(1 + (0.5 - p.life) * 3);

            if (p.life <= 0) {
                this.game.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this._nitroFlameParticles.splice(i, 1);
            }
        }
    }

    // === SKID MARK SYSTEM ===

    _laySkidMark(vehicle) {
        if (this._skidMarks.length >= this._maxSkidMarks) return;

        if (!this._skidMarkMat) {
            this._skidMarkMat = new THREE.MeshBasicMaterial({
                color: 0x111111,
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
                side: THREE.DoubleSide
            });
        }

        const vType = this.vehicleTypes[vehicle.type];
        const rearOffset = -vType.length * 0.35;
        const halfW = vType.width * 0.4;

        for (const side of [-1, 1]) {
            if (this._skidMarks.length >= this._maxSkidMarks) break;

            const localX = side * halfW;
            const localZ = rearOffset;
            const cos = Math.cos(vehicle.mesh.rotation.y);
            const sin = Math.sin(vehicle.mesh.rotation.y);
            const worldX = vehicle.mesh.position.x + localX * cos - localZ * sin;
            const worldZ = vehicle.mesh.position.z + localX * sin + localZ * cos;

            const geo = new THREE.PlaneGeometry(0.3, 1.2);
            const mark = new THREE.Mesh(geo, this._skidMarkMat.clone());
            mark.rotation.x = -Math.PI / 2;
            mark.rotation.z = -vehicle.mesh.rotation.y;
            mark.position.set(worldX, 0.02, worldZ);
            this.game.scene.add(mark);

            this._skidMarks.push({
                mesh: mark,
                life: 18 + Math.random() * 4
            });
        }
    }

    _updateSkidMarks(dt) {
        for (let i = this._skidMarks.length - 1; i >= 0; i--) {
            const mark = this._skidMarks[i];
            mark.life -= dt;

            // Fade out in last 3 seconds
            if (mark.life < 3) {
                mark.mesh.material.opacity = Math.max(0, mark.life / 3 * 0.6);
            }

            if (mark.life <= 0) {
                this.game.scene.remove(mark.mesh);
                mark.mesh.geometry.dispose();
                mark.mesh.material.dispose();
                this._skidMarks.splice(i, 1);
            }
        }
    }
}
