// San Claudio - Interior System
// Enterable buildings with separate interior scenes

export class InteriorManager {
    constructor(game) {
        this.game = game;
        this.interiors = {};
        this.currentInterior = null;
        this.doors = [];
        this.transitioning = false;

        // Interiors are placed underground at y = -100
        this.interiorY = -100;

        // Purchasable properties
        this.properties = [
            { id: 'downtown_apt', name: 'Downtown Apartment', price: 5000,
              worldPos: { x: 25, z: -25 }, owned: false,
              desc: 'A modest studio in Downtown.' },
            { id: 'strip_penthouse', name: 'Strip Penthouse', price: 15000,
              worldPos: { x: 250, z: -250 }, owned: false,
              desc: 'Luxury suite overlooking The Strip.' },
            { id: 'docks_warehouse', name: 'Dockside Loft', price: 8000,
              worldPos: { x: -220, z: 260 }, owned: false,
              desc: 'Converted warehouse at the docks.' },
            { id: 'hillside_house', name: 'Hillside Retreat', price: 12000,
              worldPos: { x: -250, z: -250 }, owned: false,
              desc: 'Secluded hilltop hideout.' },
            { id: 'industrial_bunker', name: 'Industrial Bunker', price: 20000,
              worldPos: { x: -300, z: 300 }, owned: false,
              desc: 'Fortified underground bunker.' }
        ];
        this.propertyMarkers = [];

        // Clothing stores
        this.clothingStores = [
            { name: 'Binco Downtown', worldPos: { x: 35, z: -35 } },
            { name: 'SubUrban Strip', worldPos: { x: 215, z: -215 } },
            { name: 'Victim Docks', worldPos: { x: -215, z: 215 } }
        ];
        this.clothingStoreMarkers = [];
    }

    init() {
        this.createSafehouse();
        this.createBank();
        this.createWarehouse();
        this.createClub();
        this.createGarage();
        this.createPropertyMarkers();
        this.createClothingStoreMarkers();
    }

    createSafehouse() {
        const interior = this.createInteriorBase('safehouse', 20, 15);
        const group = interior.group;

        // Bed (save point)
        const bedGeo = new THREE.BoxGeometry(2, 0.5, 3);
        const bedMat = new THREE.MeshStandardMaterial({ color: 0x663333, roughness: 0.8 });
        const bed = new THREE.Mesh(bedGeo, bedMat);
        bed.position.set(-6, this.interiorY + 0.25, -3);
        group.add(bed);

        // Table
        const tableGeo = new THREE.BoxGeometry(3, 0.8, 2);
        const tableMat = new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.8 });
        const table = new THREE.Mesh(tableGeo, tableMat);
        table.position.set(3, this.interiorY + 0.4, 0);
        group.add(table);

        // Chair
        const chairGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const chair = new THREE.Mesh(chairGeo, tableMat);
        chair.position.set(3, this.interiorY + 0.4, 2);
        group.add(chair);

        // Weapon rack
        const rackGeo = new THREE.BoxGeometry(3, 2, 0.3);
        const rackMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7 });
        const rack = new THREE.Mesh(rackGeo, rackMat);
        rack.position.set(-6, this.interiorY + 2, -7);
        group.add(rack);

        // Interior lighting
        const light1 = new THREE.PointLight(0xffdd88, 0.8, 15);
        light1.position.set(0, this.interiorY + 4, 0);
        group.add(light1);

        // Door marker (links to world position)
        this.doors.push({
            interior: 'safehouse',
            worldPos: { x: 0, z: 0 }, // Downtown safehouse position
            interiorPos: { x: 0, y: this.interiorY, z: 7 },
            prompt: 'Press E to enter Safehouse'
        });

        // Save marker
        interior.savePoint = { x: -6, y: this.interiorY, z: -3 };

        this.interiors.safehouse = interior;
    }

    createBank() {
        const interior = this.createInteriorBase('bank', 40, 30);
        const group = interior.group;

        // Main hall pillars
        for (let i = -3; i <= 3; i++) {
            if (i === 0) continue;
            const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, 6, 8);
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0x887766, roughness: 0.5 });
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(i * 5, this.interiorY + 3, 0);
            group.add(pillar);
        }

        // Teller windows
        const counterGeo = new THREE.BoxGeometry(25, 1.2, 1);
        const counterMat = new THREE.MeshStandardMaterial({ color: 0x776655, roughness: 0.7 });
        const counter = new THREE.Mesh(counterGeo, counterMat);
        counter.position.set(0, this.interiorY + 0.6, -8);
        group.add(counter);

        // Manager office (back right)
        this.createWall(group, 12, this.interiorY, -12, 0.3, 3, 6); // Wall
        const officeDoor = new THREE.BoxGeometry(1.5, 2.5, 0.2);
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x553322 });
        const door = new THREE.Mesh(officeDoor, doorMat);
        door.position.set(12, this.interiorY + 1.25, -10);
        group.add(door);

        // Vault door (back center)
        const vaultGeo = new THREE.CylinderGeometry(2, 2, 0.5, 16);
        const vaultMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8, roughness: 0.2 });
        const vault = new THREE.Mesh(vaultGeo, vaultMat);
        vault.rotation.x = Math.PI / 2;
        vault.position.set(0, this.interiorY + 2, -14);
        group.add(vault);

        // Lighting
        const light = new THREE.PointLight(0xffffcc, 0.6, 25);
        light.position.set(0, this.interiorY + 5, 0);
        group.add(light);

        this.doors.push({
            interior: 'bank',
            worldPos: { x: 250, z: -220 },
            interiorPos: { x: 0, y: this.interiorY, z: 14 },
            prompt: 'Press E to enter Bank'
        });

        this.interiors.bank = interior;
    }

    createWarehouse() {
        const interior = this.createInteriorBase('warehouse', 35, 25);
        const group = interior.group;

        // Crates
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x886633, roughness: 0.9 });
        for (let i = 0; i < 8; i++) {
            const size = 1 + Math.random() * 1.5;
            const crateGeo = new THREE.BoxGeometry(size, size, size);
            const crate = new THREE.Mesh(crateGeo, crateMat);
            crate.position.set(
                -10 + Math.random() * 20,
                this.interiorY + size / 2,
                -8 + Math.random() * 10
            );
            group.add(crate);
        }

        // Catwalk (elevated platform)
        const walkGeo = new THREE.BoxGeometry(15, 0.1, 3);
        const walkMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5 });
        const walk = new THREE.Mesh(walkGeo, walkMat);
        walk.position.set(0, this.interiorY + 3, -10);
        group.add(walk);

        // Railing
        const railGeo = new THREE.BoxGeometry(15, 0.8, 0.05);
        const rail = new THREE.Mesh(railGeo, walkMat);
        rail.position.set(0, this.interiorY + 3.4, -8.5);
        group.add(rail);

        // Office upstairs
        this.createWall(group, -5, this.interiorY + 3, -11, 4, 2.5, 0.2);
        this.createWall(group, -7, this.interiorY + 3, -10, 0.2, 2.5, 3);

        const light = new THREE.PointLight(0xffdd88, 0.5, 20);
        light.position.set(0, this.interiorY + 5, 0);
        group.add(light);

        this.doors.push({
            interior: 'warehouse',
            worldPos: { x: 220, z: 220 },
            interiorPos: { x: 0, y: this.interiorY, z: 12 },
            prompt: 'Press E to enter Warehouse'
        });

        this.interiors.warehouse = interior;
    }

    createClub() {
        const interior = this.createInteriorBase('club', 30, 25);
        const group = interior.group;

        // Bar counter
        const barGeo = new THREE.BoxGeometry(10, 1.1, 1.5);
        const barMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.6, metalness: 0.2 });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(-8, this.interiorY + 0.55, -5);
        group.add(bar);

        // Dance floor (reflective)
        const floorGeo = new THREE.PlaneGeometry(12, 12);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.7,
            roughness: 0.1
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(5, this.interiorY + 0.01, 0);
        group.add(floor);

        // Colored pulsing lights
        const lightColors = [0xff0066, 0x0066ff, 0x00ff66, 0xff6600];
        for (let i = 0; i < lightColors.length; i++) {
            const light = new THREE.PointLight(lightColors[i], 0.5, 10);
            const angle = (i / lightColors.length) * Math.PI * 2;
            light.position.set(
                5 + Math.cos(angle) * 4,
                this.interiorY + 3,
                Math.sin(angle) * 4
            );
            group.add(light);
        }

        // Back room
        this.createWall(group, -3, this.interiorY, -10, 0.2, 3, 10);

        this.doors.push({
            interior: 'club',
            worldPos: { x: 280, z: -280 },
            interiorPos: { x: 0, y: this.interiorY, z: 12 },
            prompt: 'Press E to enter Club Neon'
        });

        this.interiors.club = interior;
    }

    createGarage() {
        const interior = this.createInteriorBase('garage', 25, 20);
        const group = interior.group;

        // Vehicle bay area (open floor)
        const bayGeo = new THREE.PlaneGeometry(15, 12);
        const bayMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.95 });
        const bay = new THREE.Mesh(bayGeo, bayMat);
        bay.rotation.x = -Math.PI / 2;
        bay.position.set(0, this.interiorY + 0.01, 0);
        group.add(bay);

        // Tool racks
        const rackGeo = new THREE.BoxGeometry(0.3, 2.5, 4);
        const rackMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5 });
        const rack = new THREE.Mesh(rackGeo, rackMat);
        rack.position.set(-12, this.interiorY + 1.25, 0);
        group.add(rack);

        // Planning table
        const tableGeo = new THREE.BoxGeometry(4, 0.8, 3);
        const tableMat = new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.8 });
        const table = new THREE.Mesh(tableGeo, tableMat);
        table.position.set(8, this.interiorY + 0.4, -5);
        group.add(table);

        const light = new THREE.PointLight(0xffdd88, 0.6, 18);
        light.position.set(0, this.interiorY + 4, 0);
        group.add(light);

        this.doors.push({
            interior: 'garage',
            worldPos: { x: -220, z: 220 },
            interiorPos: { x: 0, y: this.interiorY, z: 10 },
            prompt: 'Press E to enter Garage'
        });

        this.interiors.garage = interior;
    }

    _generateInteriorTexture(type, surface) {
        const key = `${type}_${surface}`;
        if (!this._interiorTextureCache) this._interiorTextureCache = {};
        if (this._interiorTextureCache[key]) return this._interiorTextureCache[key];

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Base colors per interior type
        const floorColors = {
            safehouse: '#8a7050', bank: '#c8bca8', warehouse: '#606058',
            club: '#1a1a20', garage: '#585858', clothing: '#c8c0b8'
        };
        const wallColors = {
            safehouse: '#c8bca0', bank: '#7a5a3a', warehouse: '#707068',
            club: '#181820', garage: '#606058', clothing: '#f0ece8'
        };

        const baseColor = surface === 'floor' ? (floorColors[type] || '#666660') :
            surface === 'wall' ? (wallColors[type] || '#888880') : '#888880';
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, 256, 256);

        if (surface === 'floor') {
            if (type === 'safehouse') {
                // Hardwood floor — parallel plank lines
                ctx.strokeStyle = 'rgba(60,40,20,0.2)';
                ctx.lineWidth = 1;
                for (let y = 0; y < 256; y += 20) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(256, y);
                    ctx.stroke();
                    // Grain within plank
                    ctx.strokeStyle = 'rgba(80,55,30,0.1)';
                    ctx.lineWidth = 0.5;
                    for (let g = 0; g < 3; g++) {
                        const gy = y + 3 + Math.random() * 14;
                        ctx.beginPath();
                        ctx.moveTo(0, gy);
                        ctx.bezierCurveTo(64, gy + Math.random() * 2 - 1, 192, gy - Math.random() * 2 + 1, 256, gy);
                        ctx.stroke();
                    }
                    ctx.strokeStyle = 'rgba(60,40,20,0.2)';
                    ctx.lineWidth = 1;
                }
                // Stagger plank ends
                for (let y = 0; y < 256; y += 20) {
                    const offset = (Math.floor(y / 20) % 3) * 85;
                    ctx.beginPath();
                    ctx.moveTo(offset, y);
                    ctx.lineTo(offset, y + 20);
                    ctx.stroke();
                }
            } else if (type === 'bank') {
                // Marble tile with veins
                const tileSize = 42;
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 1.5;
                for (let x = 0; x <= 256; x += tileSize) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
                }
                for (let y = 0; y <= 256; y += tileSize) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
                }
                // Marble veins
                ctx.strokeStyle = 'rgba(160,150,130,0.15)';
                ctx.lineWidth = 0.8;
                for (let i = 0; i < 12; i++) {
                    ctx.beginPath();
                    ctx.moveTo(Math.random() * 256, Math.random() * 256);
                    ctx.bezierCurveTo(Math.random() * 256, Math.random() * 256, Math.random() * 256, Math.random() * 256, Math.random() * 256, Math.random() * 256);
                    ctx.stroke();
                }
            } else if (type === 'warehouse') {
                // Concrete with cracks and oil stains
                ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                ctx.lineWidth = 0.8;
                for (let i = 0; i < 5; i++) {
                    ctx.beginPath();
                    let cx = Math.random() * 256, cy = Math.random() * 256;
                    ctx.moveTo(cx, cy);
                    for (let s = 0; s < 4; s++) {
                        cx += (Math.random() - 0.5) * 60;
                        cy += (Math.random() - 0.5) * 60;
                        ctx.lineTo(cx, cy);
                    }
                    ctx.stroke();
                }
                // Oil stains
                for (let i = 0; i < 4; i++) {
                    const ox = Math.random() * 256, oy = Math.random() * 256, or = 15 + Math.random() * 25;
                    const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, or);
                    grad.addColorStop(0, 'rgba(30,25,15,0.2)');
                    grad.addColorStop(1, 'rgba(30,25,15,0)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(ox - or, oy - or, or * 2, or * 2);
                }
            } else if (type === 'club') {
                // Dark polished with colored light spots
                const spotColors = ['rgba(200,40,40,0.06)', 'rgba(40,40,200,0.06)', 'rgba(200,40,200,0.06)'];
                for (let i = 0; i < 6; i++) {
                    const sx = Math.random() * 256, sy = Math.random() * 256, sr = 20 + Math.random() * 30;
                    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
                    grad.addColorStop(0, spotColors[i % spotColors.length]);
                    grad.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
                }
                // Tile grid
                ctx.strokeStyle = 'rgba(255,255,255,0.04)';
                ctx.lineWidth = 0.5;
                for (let x = 0; x < 256; x += 32) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
                }
                for (let y = 0; y < 256; y += 32) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
                }
            } else if (type === 'garage') {
                // Concrete with grease stains and bay lines
                for (let i = 0; i < 5; i++) {
                    const gx = Math.random() * 256, gy = Math.random() * 256, gr = 10 + Math.random() * 20;
                    ctx.fillStyle = `rgba(30,25,15,${0.1 + Math.random() * 0.1})`;
                    ctx.beginPath();
                    ctx.ellipse(gx, gy, gr, gr * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Bay divider lines
                ctx.strokeStyle = 'rgba(220,200,40,0.2)';
                ctx.lineWidth = 3;
                for (let x = 64; x < 256; x += 64) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
                }
            } else {
                // Generic tile
                ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                ctx.lineWidth = 1;
                for (let x = 0; x < 256; x += 32) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
                }
                for (let y = 0; y < 256; y += 32) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
                }
            }
        } else if (surface === 'wall') {
            if (type === 'safehouse') {
                // Painted drywall with texture grain
                for (let i = 0; i < 1000; i++) {
                    ctx.fillStyle = `rgba(${180 + Math.floor(Math.random() * 20)},${170 + Math.floor(Math.random() * 20)},${150 + Math.floor(Math.random() * 20)},0.05)`;
                    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
                }
                // Outlet rectangles
                ctx.fillStyle = 'rgba(210,205,195,0.3)';
                ctx.fillRect(200, 180, 10, 14);
                ctx.fillRect(40, 185, 10, 14);
                // Light switch
                ctx.fillRect(120, 150, 8, 12);
            } else if (type === 'bank') {
                // Wood paneling (vertical boards)
                ctx.strokeStyle = 'rgba(40,25,10,0.15)';
                ctx.lineWidth = 1;
                for (let x = 0; x < 256; x += 20) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
                    // Grain
                    ctx.strokeStyle = 'rgba(50,30,15,0.08)';
                    ctx.lineWidth = 0.5;
                    for (let g = 0; g < 5; g++) {
                        const gx = x + 2 + Math.random() * 16;
                        ctx.beginPath();
                        ctx.moveTo(gx, 0);
                        ctx.bezierCurveTo(gx + 1, 64, gx - 1, 192, gx, 256);
                        ctx.stroke();
                    }
                    ctx.strokeStyle = 'rgba(40,25,10,0.15)';
                    ctx.lineWidth = 1;
                }
                // Crown molding line at top
                ctx.strokeStyle = 'rgba(100,80,50,0.2)';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(256, 10); ctx.stroke();
            } else if (type === 'warehouse') {
                // Corrugated metal
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 1;
                for (let y = 0; y < 256; y += 6) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
                }
                // Exposed pipe shadows
                ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                ctx.lineWidth = 6;
                ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(256, 40); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, 180); ctx.lineTo(256, 180); ctx.stroke();
            } else if (type === 'club') {
                // Dark paint with neon glow patches
                const glowColors = ['rgba(200,40,80,0.08)', 'rgba(40,80,200,0.08)', 'rgba(180,40,200,0.08)'];
                for (let i = 0; i < 4; i++) {
                    const gx = Math.random() * 256, gy = Math.random() * 256, gr = 30 + Math.random() * 40;
                    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
                    grad.addColorStop(0, glowColors[i % glowColors.length]);
                    grad.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
                }
                // Speaker grille rectangles
                for (let i = 0; i < 3; i++) {
                    const sx = 20 + Math.random() * 200, sy = 50 + Math.random() * 150;
                    ctx.strokeStyle = 'rgba(60,60,70,0.2)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(sx, sy, 20, 30);
                    // Grille lines
                    for (let gl = sy + 3; gl < sy + 30; gl += 3) {
                        ctx.beginPath(); ctx.moveTo(sx + 2, gl); ctx.lineTo(sx + 18, gl); ctx.stroke();
                    }
                }
            } else {
                // Generic - subtle texture
                for (let i = 0; i < 500; i++) {
                    ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.03})`;
                    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
                }
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        if (surface === 'floor') texture.repeat.set(2, 2);
        texture.needsUpdate = true;
        this._interiorTextureCache[key] = texture;
        return texture;
    }

    createInteriorBase(name, width, depth) {
        const group = new THREE.Group();

        // Floor
        const floorGeo = new THREE.PlaneGeometry(width, depth);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x555544, roughness: 0.9, map: this._generateInteriorTexture(name, 'floor') });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, this.interiorY, 0);
        floor.receiveShadow = true;
        group.add(floor);

        // Ceiling
        const ceilGeo = new THREE.PlaneGeometry(width, depth);
        const ceilMat = new THREE.MeshStandardMaterial({ color: 0x777766, roughness: 0.9, side: THREE.BackSide });
        const ceil = new THREE.Mesh(ceilGeo, ceilMat);
        ceil.rotation.x = -Math.PI / 2;
        ceil.position.set(0, this.interiorY + 4, 0);
        group.add(ceil);

        // Walls
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x888877, roughness: 0.85, map: this._generateInteriorTexture(name, 'wall') });

        // North wall
        this.createWall(group, 0, this.interiorY, -depth / 2, width, 4, 0.2);
        // South wall
        this.createWall(group, 0, this.interiorY, depth / 2, width, 4, 0.2);
        // East wall
        this.createWall(group, width / 2, this.interiorY, 0, 0.2, 4, depth);
        // West wall
        this.createWall(group, -width / 2, this.interiorY, 0, 0.2, 4, depth);

        // Ambient light
        const ambient = new THREE.AmbientLight(0x444444, 0.3);
        group.add(ambient);

        group.visible = false;
        this.game.scene.add(group);

        return {
            name: name,
            group: group,
            width: width,
            depth: depth,
            colliders: []
        };
    }

    createWall(group, x, baseY, z, w, h, d) {
        const wallGeo = new THREE.BoxGeometry(w, h, d);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x888877, roughness: 0.85 });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(x, baseY + h / 2, z);
        wall.receiveShadow = true;
        group.add(wall);
    }

    createPropertyMarkers() {
        for (const prop of this.properties) {
            const group = new THREE.Group();

            // "For Sale" sign
            const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2, 4);
            const poleMat = new THREE.MeshStandardMaterial({ color: 0x886644 });
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.y = 1;
            group.add(pole);

            // Sign board
            const signCanvas = document.createElement('canvas');
            signCanvas.width = 256;
            signCanvas.height = 128;
            const sCtx = signCanvas.getContext('2d');
            sCtx.fillStyle = '#ffffff';
            sCtx.fillRect(0, 0, 256, 128);
            sCtx.fillStyle = '#cc0000';
            sCtx.font = 'bold 24px Arial';
            sCtx.textAlign = 'center';
            sCtx.fillText('FOR SALE', 128, 35);
            sCtx.fillStyle = '#333333';
            sCtx.font = '16px Arial';
            sCtx.fillText(prop.name, 128, 65);
            sCtx.fillStyle = '#009900';
            sCtx.font = 'bold 20px Arial';
            sCtx.fillText('$' + prop.price.toLocaleString(), 128, 100);

            const signTex = new THREE.CanvasTexture(signCanvas);
            const signGeo = new THREE.PlaneGeometry(2, 1);
            const signMesh = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({
                map: signTex, side: THREE.DoubleSide
            }));
            signMesh.position.set(0, 2.3, 0);
            group.add(signMesh);

            group.position.set(prop.worldPos.x, 0, prop.worldPos.z);
            this.game.scene.add(group);

            this.propertyMarkers.push({ group, sign: signMesh, prop });
        }
    }

    updateProperties() {
        const player = this.game.systems.player;
        const input = this.game.systems.input;
        if (player.isInInterior) return;

        for (const pm of this.propertyMarkers) {
            const prop = pm.prop;
            const dx = player.position.x - prop.worldPos.x;
            const dz = player.position.z - prop.worldPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 4) {
                const promptEl = document.getElementById('hud-interact-prompt');

                if (prop.owned) {
                    // Owned — E to rest, C to change outfit
                    promptEl.textContent = `Press E: Rest & Save | C: Wardrobe — ${prop.name}`;
                    promptEl.classList.add('visible');

                    if (input.justPressed('interact')) {
                        // Restore health and armor
                        player.health = player.maxHealth;
                        player.armor = Math.min(player.armor + 25, player.maxArmor);
                        this.game.systems.ui.showMissionText(
                            `${prop.name}\nHealth restored. Armor +25.`, 3
                        );
                        this.game.systems.audio.playPickup();

                        // Auto-save
                        if (this.game.systems.save) {
                            this.game.systems.save.save();
                        }
                    }

                    // Open wardrobe
                    if (input.justPressed('crouch')) {
                        player.openWardrobe();
                    }
                } else {
                    // Not owned — offer purchase
                    if (player.cash >= prop.price) {
                        promptEl.textContent = `Press E to buy ${prop.name} ($${prop.price.toLocaleString()})`;
                        promptEl.classList.add('visible');

                        if (input.justPressed('interact')) {
                            player.cash -= prop.price;
                            prop.owned = true;

                            // Update sign to "SOLD"
                            const signCanvas = document.createElement('canvas');
                            signCanvas.width = 256;
                            signCanvas.height = 128;
                            const sCtx = signCanvas.getContext('2d');
                            sCtx.fillStyle = '#ffffff';
                            sCtx.fillRect(0, 0, 256, 128);
                            sCtx.fillStyle = '#009900';
                            sCtx.font = 'bold 28px Arial';
                            sCtx.textAlign = 'center';
                            sCtx.fillText('OWNED', 128, 40);
                            sCtx.fillStyle = '#333333';
                            sCtx.font = '16px Arial';
                            sCtx.fillText(prop.name, 128, 70);
                            sCtx.fillStyle = '#666666';
                            sCtx.font = '14px Arial';
                            sCtx.fillText('Enter to rest & save', 128, 100);

                            const newTex = new THREE.CanvasTexture(signCanvas);
                            pm.sign.material.map = newTex;
                            pm.sign.material.needsUpdate = true;

                            this.game.systems.ui.showMissionText(
                                `Property Purchased!\n${prop.name}\n${prop.desc}`, 4
                            );
                            this.game.systems.audio.playPickup();

                            // Count properties
                            const ownedCount = this.properties.filter(p => p.owned).length;
                            this.game.stats.propertiesOwned = ownedCount;
                        }
                    } else {
                        promptEl.textContent = `${prop.name} — $${prop.price.toLocaleString()} (need $${(prop.price - Math.floor(player.cash)).toLocaleString()} more)`;
                        promptEl.classList.add('visible');
                    }
                }
                return; // Only interact with closest property
            }
        }
    }

    createClothingStoreMarkers() {
        for (const store of this.clothingStores) {
            const group = new THREE.Group();

            // Cone marker (like other interactables)
            const coneGeo = new THREE.ConeGeometry(0.6, 1.5, 8);
            const coneMat = new THREE.MeshStandardMaterial({ color: 0xff44cc, emissive: 0x881166, emissiveIntensity: 0.5 });
            const cone = new THREE.Mesh(coneGeo, coneMat);
            cone.position.y = 2.5;
            group.add(cone);

            // Floating sign
            const signCanvas = document.createElement('canvas');
            signCanvas.width = 256;
            signCanvas.height = 128;
            const sCtx = signCanvas.getContext('2d');
            sCtx.fillStyle = '#222222';
            sCtx.fillRect(0, 0, 256, 128);
            sCtx.fillStyle = '#ff44cc';
            sCtx.font = 'bold 22px Arial';
            sCtx.textAlign = 'center';
            sCtx.fillText('CLOTHING', 128, 45);
            sCtx.fillStyle = '#ffffff';
            sCtx.font = '16px Arial';
            sCtx.fillText(store.name, 128, 80);
            sCtx.fillStyle = '#aaaaaa';
            sCtx.font = '14px Arial';
            sCtx.fillText('Press E to shop', 128, 110);

            const signTex = new THREE.CanvasTexture(signCanvas);
            const signGeo = new THREE.PlaneGeometry(2.5, 1.2);
            const signMesh = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({
                map: signTex, side: THREE.DoubleSide
            }));
            signMesh.position.set(0, 4, 0);
            group.add(signMesh);

            group.position.set(store.worldPos.x, 0, store.worldPos.z);
            this.game.scene.add(group);

            this.clothingStoreMarkers.push({ group, cone, store });
        }
    }

    updateClothingStores(dt) {
        const player = this.game.systems.player;
        const input = this.game.systems.input;
        if (player.isInInterior) return;

        // Animate cone markers (spin)
        for (const cm of this.clothingStoreMarkers) {
            cm.cone.rotation.y += dt * 2;
        }

        for (const cm of this.clothingStoreMarkers) {
            const store = cm.store;
            const dx = player.position.x - store.worldPos.x;
            const dz = player.position.z - store.worldPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 4) {
                const promptEl = document.getElementById('hud-interact-prompt');
                promptEl.textContent = `Press E to enter ${store.name}`;
                promptEl.classList.add('visible');

                if (input.justPressed('interact')) {
                    this.game.systems.ui.openClothingShop(store.name);
                }
                return;
            }
        }
    }

    checkDoors(playerPos) {
        if (this.transitioning) return;

        const input = this.game.systems.input;
        const promptEl = document.getElementById('hud-interact-prompt');

        for (const door of this.doors) {
            let doorPos;
            let isInside = !!this.currentInterior;

            if (isInside && this.currentInterior === door.interior) {
                // Check exit door (interior side)
                doorPos = door.interiorPos;
            } else if (!isInside) {
                // Check entrance door (world side)
                doorPos = door.worldPos;
            } else {
                continue;
            }

            const dx = playerPos.x - doorPos.x;
            const dz = playerPos.z - (doorPos.z || 0);
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 3) {
                if (isInside) {
                    promptEl.textContent = 'Press E to exit';
                } else {
                    promptEl.textContent = door.prompt;
                }
                promptEl.classList.add('visible');

                if (input.justPressed('interact')) {
                    if (isInside) {
                        this.exitInterior(door);
                    } else {
                        this.enterInterior(door);
                    }
                }
                return;
            }
        }
    }

    enterInterior(door) {
        const interior = this.interiors[door.interior];
        if (!interior) return;
        this.transitioning = true;

        // Fade to black
        this.fadeTransition(() => {
            // Show interior
            interior.group.visible = true;

            // Teleport player
            const player = this.game.systems.player;
            player.position.set(door.interiorPos.x, door.interiorPos.y, door.interiorPos.z);
            player.model.position.copy(player.position);
            player.isInInterior = true;

            this.currentInterior = door.interior;
            this.transitioning = false;
        });
    }

    exitInterior(door) {
        this.transitioning = true;
        const interior = this.interiors[door.interior];

        this.fadeTransition(() => {
            // Hide interior
            if (interior) interior.group.visible = false;

            // Teleport player to world
            const player = this.game.systems.player;
            player.position.set(door.worldPos.x, 0, door.worldPos.z || 0);
            player.model.position.copy(player.position);
            player.isInInterior = false;

            this.currentInterior = null;
            this.transitioning = false;
        });
    }

    fadeTransition(callback) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000;opacity:0;transition:opacity 0.3s;z-index:200;pointer-events:none;';
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            setTimeout(() => {
                callback();
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 300);
            }, 300);
        });
    }

    update(dt) {
        this.updateProperties();
        this.updateClothingStores(dt);
    }

    teleportToInterior(name) {
        const door = this.doors.find(d => d.interior === name);
        if (door) {
            this.enterInterior(door);
        }
    }
}
