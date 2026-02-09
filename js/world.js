// San Claudio - World System
// Terrain, buildings, roads, props, districts, weather particles
// Performance: merged static geometry + instanced props

// Helper: ensure all geometries are non-indexed before merging
// (mergeBufferGeometries requires all to be indexed or all non-indexed)
function safeMerge(geoms) {
    if (!geoms || geoms.length === 0) return null;
    const cleaned = geoms.map(g => g.index ? g.toNonIndexed() : g);
    if (cleaned.length === 1) return cleaned[0];
    return THREE.BufferGeometryUtils.mergeBufferGeometries(cleaned, false);
}

export class World {
    constructor(game) {
        this.game = game;
        this.buildings = [];
        this.colliders = []; // AABB colliders for all solid objects
        this.streetLamps = [];
        this.lampPositions = []; // World positions of all lamp fixtures
        this.lightPool = [];     // Small pool of reusable PointLights
        this.maxActiveLights = 12;
        this.isNight = false;
        this.rainParticles = null;
        this.waterPlane = null;

        // Shared materials for merged geometry
        this.windowMat = null;
        this.lampFixtureMat = null;

        // Map bounds
        this.mapSize = 800;
        this.halfMap = 400;

        // Road grid: roads at every multiple of blockSize
        this.roadWidth = 12;
        this.blockSize = 50;

        // Districts
        this.districts = {
            downtown: {
                name: 'Downtown',
                center: { x: 0, z: 0 },
                bounds: { minX: -150, maxX: 150, minZ: -150, maxZ: 150 },
                colors: [0x4a5a78, 0x3d4d6a, 0x5a6a88, 0x6a7a98, 0x3a4a68],
                buildingHeight: { min: 20, max: 60 },
                density: 0.95
            },
            docks: {
                name: 'The Docks',
                center: { x: -275, z: 275 },
                bounds: { minX: -400, maxX: -150, minZ: 150, maxZ: 400 },
                colors: [0x6a5040, 0x7a6050, 0x5a4535, 0x8a7060, 0x4a3525],
                buildingHeight: { min: 4, max: 10 },
                density: 0.75
            },
            hillside: {
                name: 'Hillside',
                center: { x: -275, z: -275 },
                bounds: { minX: -400, maxX: -150, minZ: -400, maxZ: -150 },
                colors: [0x90a870, 0xa0b880, 0x80a060, 0xb0c890, 0x70a050],
                buildingHeight: { min: 3, max: 8 },
                density: 0.6
            },
            strip: {
                name: 'The Strip',
                center: { x: 275, z: -275 },
                bounds: { minX: 150, maxX: 400, minZ: -400, maxZ: -150 },
                colors: [0xaa4488, 0xbb5599, 0x8844aa, 0xcc66aa, 0x9955bb],
                buildingHeight: { min: 5, max: 15 },
                density: 0.8
            },
            industrial: {
                name: 'Industrial Park',
                center: { x: 275, z: 275 },
                bounds: { minX: 150, maxX: 400, minZ: 150, maxZ: 400 },
                colors: [0x505050, 0x606060, 0x555555, 0x707070, 0x484848],
                buildingHeight: { min: 6, max: 14 },
                density: 0.7
            },
            northshore: {
                name: 'North Shore',
                center: { x: 0, z: -275 },
                bounds: { minX: -150, maxX: 150, minZ: -400, maxZ: -150 },
                colors: [0x7a8a68, 0x8a9a78, 0x6a7a58],
                buildingHeight: { min: 4, max: 12 },
                density: 0.65
            },
            portside: {
                name: 'Portside',
                center: { x: 0, z: 275 },
                bounds: { minX: -150, maxX: 150, minZ: 150, maxZ: 400 },
                colors: [0x5a6a7a, 0x6a7a8a, 0x4a5a6a],
                buildingHeight: { min: 5, max: 12 },
                density: 0.7
            },
            westend: {
                name: 'West End',
                center: { x: -275, z: 0 },
                bounds: { minX: -400, maxX: -150, minZ: -150, maxZ: 150 },
                colors: [0x8a7060, 0x9a8070, 0x7a6050],
                buildingHeight: { min: 5, max: 15 },
                density: 0.7
            },
            eastgate: {
                name: 'Eastgate',
                center: { x: 275, z: 0 },
                bounds: { minX: 150, maxX: 400, minZ: -150, maxZ: 150 },
                colors: [0x6a6a8a, 0x7a7a9a, 0x5a5a7a],
                buildingHeight: { min: 8, max: 20 },
                density: 0.75
            }
        };
    }

    init() {
        this.createGround();
        this.createWater();
        this.createCoastline();
        this.createRoads();
        this.createDiagonalRoads();
        this.createBuildings();
        this.createLandmarks();
        this.createProps();
        this.createStuntRamps();
        this.createNeonSigns();
        this.createTrafficLights();
        this.createPhysicsColliders();
        this.initLightPool();
        this.createEasterEggs();
        this.createRainSystem();
        this.createHiddenPackages();
        this._createAmbientWildlife();
    }

    createGround() {
        const geo = new THREE.PlaneGeometry(this.mapSize, this.mapSize);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.85,
            metalness: 0.0
        });
        const ground = new THREE.Mesh(geo, mat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.game.scene.add(ground);

        const pavGeo = new THREE.PlaneGeometry(this.mapSize, this.mapSize);
        const pavMat = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.9,
            metalness: 0.0
        });
        const pavement = new THREE.Mesh(pavGeo, pavMat);
        pavement.rotation.x = -Math.PI / 2;
        pavement.position.y = 0.005;
        pavement.receiveShadow = true;
        this.game.scene.add(pavement);
    }

    createWater() {
        // Large ocean plane surrounding the entire map
        const waterGeo = new THREE.PlaneGeometry(2000, 2000, 32, 32);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x1a5588,
            transparent: true,
            opacity: 0.85,
            roughness: 0.15,
            metalness: 0.5
        });
        this.waterPlane = new THREE.Mesh(waterGeo, waterMat);
        this.waterPlane.rotation.x = -Math.PI / 2;
        this.waterPlane.position.set(0, -0.5, 0);
        this.game.scene.add(this.waterPlane);

        // Store wave data for animation
        this._wavePositions = waterGeo.attributes.position.clone();
        this._waveTime = 0;
    }

    createCoastline() {
        // Sand/beach strip ring around map edges
        const sandMat = new THREE.MeshStandardMaterial({
            color: 0xccbb88, roughness: 0.9, metalness: 0.0
        });
        const beachWidth = 15;
        const h = this.halfMap;
        const sandGeoms = [];
        const rotMatrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

        // North beach
        const northGeo = new THREE.PlaneGeometry(this.mapSize + beachWidth * 2, beachWidth);
        northGeo.applyMatrix4(rotMatrix);
        northGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.01, -h - beachWidth / 2));
        sandGeoms.push(northGeo);

        // South beach
        const southGeo = new THREE.PlaneGeometry(this.mapSize + beachWidth * 2, beachWidth);
        southGeo.applyMatrix4(rotMatrix);
        southGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.01, h + beachWidth / 2));
        sandGeoms.push(southGeo);

        // West beach
        const westGeo = new THREE.PlaneGeometry(beachWidth, this.mapSize);
        westGeo.applyMatrix4(rotMatrix);
        westGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(-h - beachWidth / 2, 0.01, 0));
        sandGeoms.push(westGeo);

        // East beach
        const eastGeo = new THREE.PlaneGeometry(beachWidth, this.mapSize);
        eastGeo.applyMatrix4(rotMatrix);
        eastGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(h + beachWidth / 2, 0.01, 0));
        sandGeoms.push(eastGeo);

        const mergedSand = safeMerge(sandGeoms);
        if (mergedSand) {
            const sandMesh = new THREE.Mesh(mergedSand, sandMat);
            sandMesh.receiveShadow = true;
            this.game.scene.add(sandMesh);
            for (const g of sandGeoms) g.dispose();
        }

        // Wooden piers at The Docks and Portside
        const pierMat = new THREE.MeshStandardMaterial({
            color: 0x8B7355, roughness: 0.8, metalness: 0.1
        });
        const pierPositions = [
            { x: -250, z: 395, length: 30, width: 4, rot: 0 },
            { x: -300, z: 395, length: 25, width: 3, rot: 0 },
            { x: -200, z: 395, length: 20, width: 3.5, rot: 0 },
            { x: 0, z: 395, length: 25, width: 4, rot: 0 },
            { x: 50, z: 395, length: 20, width: 3, rot: 0 },
        ];

        for (const pier of pierPositions) {
            const group = new THREE.Group();
            // Deck
            const deckGeo = new THREE.BoxGeometry(pier.width, 0.2, pier.length);
            const deck = new THREE.Mesh(deckGeo, pierMat);
            deck.position.set(0, 0.8, pier.length / 2);
            deck.castShadow = true;
            deck.receiveShadow = true;
            group.add(deck);

            // Pilings
            const pilingMat = new THREE.MeshStandardMaterial({ color: 0x6B5B3D, roughness: 0.9 });
            for (let p = 0; p < pier.length; p += 5) {
                for (const side of [-pier.width / 2 + 0.2, pier.width / 2 - 0.2]) {
                    const pilingGeo = new THREE.CylinderGeometry(0.12, 0.15, 2, 6);
                    const piling = new THREE.Mesh(pilingGeo, pilingMat);
                    piling.position.set(side, -0.1, p);
                    group.add(piling);
                }
            }

            // Railing posts
            const railMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.6, metalness: 0.3 });
            for (let r = 0; r <= pier.length; r += 3) {
                for (const side of [-pier.width / 2, pier.width / 2]) {
                    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 4);
                    const post = new THREE.Mesh(postGeo, railMat);
                    post.position.set(side, 1.4, r);
                    group.add(post);
                }
            }

            group.position.set(pier.x, 0, pier.z);
            group.rotation.y = pier.rot;
            this.game.scene.add(group);
        }
    }

    // --- MERGED ROADS (Step 9) ---
    createRoads() {
        const roadGeoms = [];
        const dashGeoms = [];
        const crosswalkGeoms = [];

        const rotMatrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

        // Vertical roads (along Z axis)
        for (let rx = -this.halfMap; rx <= this.halfMap; rx += this.blockSize) {
            this._collectRoadGeoms(rx, 'z', roadGeoms, dashGeoms, crosswalkGeoms, rotMatrix);
        }
        // Horizontal roads (along X axis)
        for (let rz = -this.halfMap; rz <= this.halfMap; rz += this.blockSize) {
            this._collectRoadGeoms(rz, 'x', roadGeoms, dashGeoms, crosswalkGeoms, rotMatrix);
        }

        // Merge and create single meshes
        if (roadGeoms.length > 0) {
            const mergedRoad = safeMerge(roadGeoms);
            const roadMesh = new THREE.Mesh(mergedRoad, new THREE.MeshStandardMaterial({
                color: 0x2a2a2a, roughness: 0.82, metalness: 0.05
            }));
            roadMesh.receiveShadow = true;
            this.game.scene.add(roadMesh);
        }

        if (dashGeoms.length > 0) {
            const mergedDash = safeMerge(dashGeoms);
            const dashMesh = new THREE.Mesh(mergedDash, new THREE.MeshStandardMaterial({
                color: 0xcccc00, roughness: 0.5
            }));
            this.game.scene.add(dashMesh);
        }

        if (crosswalkGeoms.length > 0) {
            const mergedCW = safeMerge(crosswalkGeoms);
            const cwMesh = new THREE.Mesh(mergedCW, new THREE.MeshStandardMaterial({
                color: 0xeeeeee, roughness: 0.5
            }));
            this.game.scene.add(cwMesh);
        }

        // Dispose temp geometries
        for (const g of [...roadGeoms, ...dashGeoms, ...crosswalkGeoms]) g.dispose();
    }

    _collectRoadGeoms(pos, axis, roadGeoms, dashGeoms, crosswalkGeoms, rotMatrix) {
        const length = this.mapSize;
        const width = this.roadWidth;

        // Road surface
        const roadGeo = axis === 'z'
            ? new THREE.PlaneGeometry(width, length)
            : new THREE.PlaneGeometry(length, width);
        roadGeo.applyMatrix4(rotMatrix);
        const translateRoad = new THREE.Matrix4();
        if (axis === 'z') {
            translateRoad.makeTranslation(pos, 0.01, 0);
        } else {
            translateRoad.makeTranslation(0, 0.01, pos);
        }
        roadGeo.applyMatrix4(translateRoad);
        roadGeoms.push(roadGeo);

        // Center dashes
        const dashLength = 3;
        const dashSpacing = 12;
        for (let d = -this.halfMap; d < this.halfMap; d += dashSpacing) {
            const dashGeo = axis === 'z'
                ? new THREE.PlaneGeometry(0.15, dashLength)
                : new THREE.PlaneGeometry(dashLength, 0.15);
            dashGeo.applyMatrix4(rotMatrix);
            const t = new THREE.Matrix4();
            if (axis === 'z') {
                t.makeTranslation(pos, 0.02, d);
            } else {
                t.makeTranslation(d, 0.02, pos);
            }
            dashGeo.applyMatrix4(t);
            dashGeoms.push(dashGeo);
        }

        // Crosswalks at intersections
        for (let cross = -this.halfMap; cross <= this.halfMap; cross += this.blockSize) {
            for (let stripe = -2; stripe <= 2; stripe++) {
                const cwGeo = axis === 'z'
                    ? new THREE.PlaneGeometry(width * 0.8, 0.6)
                    : new THREE.PlaneGeometry(0.6, width * 0.8);
                cwGeo.applyMatrix4(rotMatrix);
                const t = new THREE.Matrix4();
                if (axis === 'z') {
                    t.makeTranslation(pos, 0.02, cross + stripe * 1.2);
                } else {
                    t.makeTranslation(cross + stripe * 1.2, 0.02, pos);
                }
                cwGeo.applyMatrix4(t);
                crosswalkGeoms.push(cwGeo);
            }
        }
    }

    createDiagonalRoads() {
        const roadGeoms = [];
        const dashGeoms = [];
        const rotMatrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

        // Define diagonal boulevards
        const diagonals = [
            // Downtown to Strip (NE diagonal)
            { x1: 0, z1: 0, x2: 200, z2: -200 },
            // Downtown to Docks (SW diagonal)
            { x1: 0, z1: 0, x2: -200, z2: 200 },
            // Hillside to West End
            { x1: -200, z1: -200, x2: -200, z2: 0 },
        ];

        for (const diag of diagonals) {
            const dx = diag.x2 - diag.x1;
            const dz = diag.z2 - diag.z1;
            const length = Math.sqrt(dx * dx + dz * dz);
            const angle = Math.atan2(dx, dz);
            const midX = (diag.x1 + diag.x2) / 2;
            const midZ = (diag.z1 + diag.z2) / 2;

            // Road surface
            const roadGeo = new THREE.PlaneGeometry(this.roadWidth, length);
            roadGeo.applyMatrix4(rotMatrix);
            const t = new THREE.Matrix4().makeRotationY(angle);
            roadGeo.applyMatrix4(t);
            const pos = new THREE.Matrix4().makeTranslation(midX, 0.015, midZ);
            roadGeo.applyMatrix4(pos);
            roadGeoms.push(roadGeo);

            // Center dashes
            const dashCount = Math.floor(length / 12);
            for (let d = 0; d < dashCount; d++) {
                const frac = (d + 0.5) / dashCount;
                const cx = diag.x1 + dx * frac;
                const cz = diag.z1 + dz * frac;
                const dashGeo = new THREE.PlaneGeometry(0.15, 3);
                dashGeo.applyMatrix4(rotMatrix);
                dashGeo.applyMatrix4(new THREE.Matrix4().makeRotationY(angle));
                dashGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(cx, 0.025, cz));
                dashGeoms.push(dashGeo);
            }
        }

        // Curved ring road (approximated with straight segments)
        const ringRadius = 180;
        const ringSegments = 24;
        for (let i = 0; i < ringSegments; i++) {
            const a1 = (i / ringSegments) * Math.PI * 2;
            const a2 = ((i + 1) / ringSegments) * Math.PI * 2;
            const x1 = Math.cos(a1) * ringRadius;
            const z1 = Math.sin(a1) * ringRadius;
            const x2 = Math.cos(a2) * ringRadius;
            const z2 = Math.sin(a2) * ringRadius;
            const segDx = x2 - x1;
            const segDz = z2 - z1;
            const segLen = Math.sqrt(segDx * segDx + segDz * segDz);
            const segAngle = Math.atan2(segDx, segDz);
            const segMx = (x1 + x2) / 2;
            const segMz = (z1 + z2) / 2;

            const segGeo = new THREE.PlaneGeometry(this.roadWidth * 1.2, segLen + 2);
            segGeo.applyMatrix4(rotMatrix);
            segGeo.applyMatrix4(new THREE.Matrix4().makeRotationY(segAngle));
            segGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(segMx, 0.018, segMz));
            roadGeoms.push(segGeo);
        }

        // Merge and render
        if (roadGeoms.length > 0) {
            const merged = safeMerge(roadGeoms);
            const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({
                color: 0x2a2a2a, roughness: 0.82, metalness: 0.05
            }));
            mesh.receiveShadow = true;
            this.game.scene.add(mesh);
            for (const g of roadGeoms) g.dispose();
        }
        if (dashGeoms.length > 0) {
            const merged = safeMerge(dashGeoms);
            const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({
                color: 0xcccc00, roughness: 0.5
            }));
            this.game.scene.add(mesh);
            for (const g of dashGeoms) g.dispose();
        }
    }

    // --- MERGED BUILDINGS (Step 8) ---
    createBuildings() {
        // Collect geometry per district per material category
        // Categories: body, windows, roofs, doors, awnings, ac_units
        const districtGeoms = {};

        for (const [key, district] of Object.entries(this.districts)) {
            districtGeoms[key] = {
                body: [],
                windows: [],
                roofs: [],
                doors: [],
                awnings: [],
                ac_units: []
            };
            this._generateDistrictBuildingGeoms(key, district, districtGeoms[key]);
        }

        // Create shared materials
        this.windowMat = new THREE.MeshStandardMaterial({
            color: 0x88aacc,
            emissive: 0x112244,
            roughness: 0.1,
            metalness: 0.7
        });

        const doorMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.6 });
        const awningMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 });
        const acMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.4 });

        // Merge and add to scene per district
        for (const [key, geoms] of Object.entries(districtGeoms)) {
            const district = this.districts[key];
            // Average district body color
            const avgColor = this._averageColor(district.colors);
            const trimColor = new THREE.Color(avgColor).multiplyScalar(0.7);

            if (geoms.body.length > 0) {
                const merged = safeMerge(geoms.body);
                const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({
                    color: avgColor, roughness: 0.55, metalness: 0.15
                }));
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.game.scene.add(mesh);
                for (const g of geoms.body) g.dispose();
            }

            if (geoms.roofs.length > 0) {
                const merged = safeMerge(geoms.roofs);
                const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({
                    color: trimColor, roughness: 0.7
                }));
                mesh.castShadow = true;
                this.game.scene.add(mesh);
                for (const g of geoms.roofs) g.dispose();
            }

            if (geoms.windows.length > 0) {
                const merged = safeMerge(geoms.windows);
                const mesh = new THREE.Mesh(merged, this.windowMat);
                mesh.userData.isWindowMesh = true;
                this.game.scene.add(mesh);
                this.buildings.push({ mesh: mesh, isWindow: true });
                for (const g of geoms.windows) g.dispose();
            }

            if (geoms.doors.length > 0) {
                const merged = safeMerge(geoms.doors);
                const mesh = new THREE.Mesh(merged, doorMat);
                this.game.scene.add(mesh);
                for (const g of geoms.doors) g.dispose();
            }

            if (geoms.awnings.length > 0) {
                const merged = safeMerge(geoms.awnings);
                const mesh = new THREE.Mesh(merged, awningMat);
                this.game.scene.add(mesh);
                for (const g of geoms.awnings) g.dispose();
            }

            if (geoms.ac_units.length > 0) {
                const merged = safeMerge(geoms.ac_units);
                const mesh = new THREE.Mesh(merged, acMat);
                this.game.scene.add(mesh);
                for (const g of geoms.ac_units) g.dispose();
            }
        }
    }

    _averageColor(colors) {
        const c = new THREE.Color(0);
        for (const hex of colors) {
            c.add(new THREE.Color(hex));
        }
        c.multiplyScalar(1 / colors.length);
        return c;
    }

    _generateDistrictBuildingGeoms(key, district, geoms) {
        const { bounds, colors, buildingHeight, density } = district;

        for (let bx = bounds.minX + this.blockSize / 2; bx < bounds.maxX; bx += this.blockSize) {
            for (let bz = bounds.minZ + this.blockSize / 2; bz < bounds.maxZ; bz += this.blockSize) {
                if (Math.random() > density) continue;

                // 3% chance to be an open area (plaza, parking lot, park)
                if (Math.random() < 0.03) continue;

                // Vary building setback from road (2-6 units)
                const setback = 2 + Math.random() * 4;
                const maxBuildWidth = this.blockSize - this.roadWidth - setback * 2;
                if (maxBuildWidth < 4) continue;

                const numBuildings = key === 'downtown' ? (Math.random() > 0.3 ? 1 : 2) : (1 + Math.floor(Math.random() * 3));

                for (let b = 0; b < numBuildings; b++) {
                    const sizeScale = numBuildings > 1 ? 0.6 : 1.0;
                    const bWidth = Math.min((5 + Math.random() * 12) * sizeScale, maxBuildWidth * sizeScale);
                    const bDepth = Math.min((5 + Math.random() * 12) * sizeScale, maxBuildWidth * sizeScale);

                    let bHeight = buildingHeight.min + Math.random() * (buildingHeight.max - buildingHeight.min);
                    if (key === 'downtown' && Math.random() < 0.15) {
                        bHeight = 40 + Math.random() * 20;
                    }
                    if ((key === 'docks' || key === 'industrial') && Math.random() < 0.3) {
                        bHeight = 3 + Math.random() * 3;
                    }

                    const maxOffset = (maxBuildWidth - Math.max(bWidth, bDepth)) / 2;
                    const ox = (Math.random() - 0.5) * Math.max(0, maxOffset);
                    const oz = (Math.random() - 0.5) * Math.max(0, maxOffset);

                    // Apply terrain elevation to building placement
                    let yOffset = this.getTerrainHeight(bx + ox, bz + oz);

                    const roofType = Math.random() < 0.3 ? 'peaked' : (Math.random() < 0.3 ? 'stepped' : 'flat');
                    const hasWindows = !(key === 'industrial' || key === 'docks') || Math.random() > 0.4;
                    const windowCols = 2 + Math.floor(Math.random() * 3);

                    this._collectBuildingGeoms(bx + ox, bz + oz, bWidth, bDepth, bHeight, key, geoms, {
                        roofType, hasWindows, windowCols, yOffset
                    });
                }
            }
        }
    }

    _collectBuildingGeoms(x, z, width, depth, height, district, geoms, options = {}) {
        const { roofType = 'flat', hasWindows = true, windowCols = 3, yOffset = 0 } = options;
        const translate = new THREE.Matrix4();

        // Main body
        const bodyGeo = new THREE.BoxGeometry(width, height, depth);
        translate.makeTranslation(x, height / 2 + yOffset, z);
        bodyGeo.applyMatrix4(translate);
        geoms.body.push(bodyGeo);

        // Roof
        if (roofType === 'peaked' && width < 20) {
            const roofH = Math.min(height * 0.2, 4);
            const shape = new THREE.Shape();
            shape.moveTo(-width / 2, 0);
            shape.lineTo(0, roofH);
            shape.lineTo(width / 2, 0);
            shape.lineTo(-width / 2, 0);
            const roofGeo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: depth, bevelEnabled: false });
            translate.makeTranslation(x, height + yOffset, z - depth / 2);
            roofGeo.applyMatrix4(translate);
            geoms.roofs.push(roofGeo);
        } else if (roofType === 'stepped' && height > 6) {
            const stepW = width * 0.7;
            const stepD = depth * 0.7;
            const stepH = Math.min(height * 0.15, 3);
            const stepGeo = new THREE.BoxGeometry(stepW, stepH, stepD);
            translate.makeTranslation(x, height + stepH / 2 + yOffset, z);
            stepGeo.applyMatrix4(translate);
            geoms.roofs.push(stepGeo);
        } else {
            const trimHeight = 0.5;
            const trimGeo = new THREE.BoxGeometry(width + 0.4, trimHeight, depth + 0.4);
            translate.makeTranslation(x, height + trimHeight / 2 + yOffset, z);
            trimGeo.applyMatrix4(translate);
            geoms.roofs.push(trimGeo);
        }

        // AC units on roof
        const numAC = Math.floor(Math.random() * 4);
        for (let i = 0; i < numAC; i++) {
            const acGeo = new THREE.BoxGeometry(0.8, 0.5, 0.6);
            translate.makeTranslation(
                x + (Math.random() - 0.5) * width * 0.6,
                height + 0.25 + yOffset,
                z + (Math.random() - 0.5) * depth * 0.6
            );
            acGeo.applyMatrix4(translate);
            geoms.ac_units.push(acGeo);
        }

        // Windows
        if (hasWindows) {
            const floorHeight = 3.5;
            const floors = Math.floor(height / floorHeight);

            for (let f = 0; f < floors; f++) {
                const wy = f * floorHeight + floorHeight * 0.6;
                const winW = width / (windowCols + 1);
                const winH = floorHeight * 0.3;

                // Front and back windows
                for (const side of [-1, 1]) {
                    for (let c = 0; c < windowCols; c++) {
                        const wx = (c - (windowCols - 1) / 2) * winW;
                        const stripGeo = new THREE.PlaneGeometry(winW * 0.7, winH);
                        if (side === -1) {
                            const rot = new THREE.Matrix4().makeRotationY(Math.PI);
                            stripGeo.applyMatrix4(rot);
                        }
                        translate.makeTranslation(x + wx, wy + yOffset, z + side * (depth / 2 + 0.01));
                        stripGeo.applyMatrix4(translate);
                        geoms.windows.push(stripGeo);
                    }
                }

                // Side windows
                const sideCols = Math.max(1, Math.floor(depth / (width / windowCols)));
                const sideWinW = depth / (sideCols + 1);
                for (const side of [-1, 1]) {
                    for (let c = 0; c < sideCols; c++) {
                        const wz = (c - (sideCols - 1) / 2) * sideWinW;
                        const stripGeo = new THREE.PlaneGeometry(sideWinW * 0.7, winH);
                        const rot = new THREE.Matrix4().makeRotationY(side * Math.PI / 2);
                        stripGeo.applyMatrix4(rot);
                        translate.makeTranslation(x + side * (width / 2 + 0.01), wy + yOffset, z + wz);
                        stripGeo.applyMatrix4(translate);
                        geoms.windows.push(stripGeo);
                    }
                }
            }
        }

        // Door
        const doorGeo = new THREE.PlaneGeometry(2, 3);
        translate.makeTranslation(x, 1.5 + yOffset, z + depth / 2 + 0.05);
        doorGeo.applyMatrix4(translate);
        geoms.doors.push(doorGeo);

        // Awning (50% chance)
        if (Math.random() > 0.5) {
            const awningGeo = new THREE.BoxGeometry(3, 0.1, 1.5);
            translate.makeTranslation(x, 3.2 + yOffset, z + depth / 2 + 0.75);
            awningGeo.applyMatrix4(translate);
            geoms.awnings.push(awningGeo);
        }

        // Add collider (data only, no mesh)
        this.colliders.push({
            type: 'building',
            minX: x - width / 2,
            maxX: x + width / 2,
            minZ: z - depth / 2,
            maxZ: z + depth / 2,
            height: height + yOffset,
            yOffset: yOffset,
            district: district
        });

        // Building data for other systems
        this.buildings.push({
            x: x, z: z,
            width: width, depth: depth, height: height,
            yOffset: yOffset,
            district: district
        });
    }

    createLandmarks() {
        // City Hall at Downtown center
        {
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: 0xddddcc, roughness: 0.5, metalness: 0.1 });
            // Main building
            const bodyGeo = new THREE.BoxGeometry(20, 12, 15);
            const body = new THREE.Mesh(bodyGeo, mat);
            body.position.y = 6;
            body.castShadow = true;
            group.add(body);
            // Columns (6 across front)
            const colMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4, metalness: 0.1 });
            for (let i = 0; i < 6; i++) {
                const colGeo = new THREE.CylinderGeometry(0.4, 0.5, 10, 8);
                const col = new THREE.Mesh(colGeo, colMat);
                col.position.set(-7.5 + i * 3, 5, 8);
                col.castShadow = true;
                group.add(col);
            }
            // Pediment (triangular roof)
            const pedShape = new THREE.Shape();
            pedShape.moveTo(-10.5, 0);
            pedShape.lineTo(0, 4);
            pedShape.lineTo(10.5, 0);
            pedShape.lineTo(-10.5, 0);
            const pedGeo = new THREE.ExtrudeGeometry(pedShape, { steps: 1, depth: 1, bevelEnabled: false });
            const ped = new THREE.Mesh(pedGeo, mat);
            ped.position.set(0, 12, 7.5);
            group.add(ped);
            // Steps
            for (let s = 0; s < 4; s++) {
                const stepGeo = new THREE.BoxGeometry(22 - s * 0.5, 0.3, 1);
                const step = new THREE.Mesh(stepGeo, colMat);
                step.position.set(0, s * 0.3, 8.5 + s * 0.5);
                group.add(step);
            }
            group.position.set(0, 0, -30);
            this.game.scene.add(group);
            this.colliders.push({ type: 'building', minX: -10, maxX: 10, minZ: -45, maxZ: -22.5, height: 16 });
        }

        // Clock Tower at Downtown center
        {
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.6, metalness: 0.15 });
            // Base
            const baseGeo = new THREE.BoxGeometry(5, 20, 5);
            const base = new THREE.Mesh(baseGeo, mat);
            base.position.y = 10;
            base.castShadow = true;
            group.add(base);
            // Clock face (4 sides)
            const clockMat = new THREE.MeshStandardMaterial({ color: 0xfffff0, roughness: 0.3 });
            for (let i = 0; i < 4; i++) {
                const clockGeo = new THREE.CircleGeometry(1.5, 16);
                const clock = new THREE.Mesh(clockGeo, clockMat);
                clock.position.y = 18;
                const angle = (i / 4) * Math.PI * 2;
                clock.position.x = Math.sin(angle) * 2.55;
                clock.position.z = Math.cos(angle) * 2.55;
                clock.rotation.y = angle;
                group.add(clock);
            }
            // Pointed top
            const topGeo = new THREE.ConeGeometry(3, 6, 4);
            const top = new THREE.Mesh(topGeo, mat);
            top.position.y = 24;
            top.rotation.y = Math.PI / 4;
            top.castShadow = true;
            group.add(top);

            group.position.set(20, 0, 20);
            this.game.scene.add(group);
            this.colliders.push({ type: 'building', minX: 17.5, maxX: 22.5, minZ: 17.5, maxZ: 22.5, height: 27 });
        }

        // Stadium at Eastgate
        {
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.5, metalness: 0.2 });
            // Octagonal outer wall using 8 segments
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const nextAngle = ((i + 1) / 8) * Math.PI * 2;
                const r = 25;
                const x1 = Math.cos(angle) * r;
                const z1 = Math.sin(angle) * r;
                const x2 = Math.cos(nextAngle) * r;
                const z2 = Math.sin(nextAngle) * r;
                const mx = (x1 + x2) / 2;
                const mz = (z1 + z2) / 2;
                const segLen = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
                const segAngle = Math.atan2(x2 - x1, z2 - z1);

                const wallGeo = new THREE.BoxGeometry(1.5, 15, segLen);
                const wall = new THREE.Mesh(wallGeo, mat);
                wall.position.set(mx, 7.5, mz);
                wall.rotation.y = segAngle;
                wall.castShadow = true;
                group.add(wall);
            }
            // Field (green center)
            const fieldGeo = new THREE.CircleGeometry(20, 8);
            fieldGeo.rotateX(-Math.PI / 2);
            const fieldMat = new THREE.MeshStandardMaterial({ color: 0x338833, roughness: 0.9 });
            const field = new THREE.Mesh(fieldGeo, fieldMat);
            field.position.y = 0.1;
            group.add(field);

            group.position.set(280, 0, 0);
            this.game.scene.add(group);
            this.colliders.push({ type: 'building', minX: 255, maxX: 305, minZ: -25, maxZ: 25, height: 15 });
        }

        // Bridge from Portside to Docks
        {
            const group = new THREE.Group();
            const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.6, metalness: 0.3 });
            // Road deck
            const deckGeo = new THREE.BoxGeometry(10, 0.5, 80);
            const deck = new THREE.Mesh(deckGeo, bridgeMat);
            deck.position.y = 4;
            deck.castShadow = true;
            deck.receiveShadow = true;
            group.add(deck);
            // Support pillars
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.7, metalness: 0.2 });
            for (let p = -30; p <= 30; p += 20) {
                for (const side of [-4, 4]) {
                    const pillarGeo = new THREE.BoxGeometry(1, 5, 1);
                    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                    pillar.position.set(side, 2, p);
                    pillar.castShadow = true;
                    group.add(pillar);
                }
            }
            // Cable stays (simplified as thin cylinders)
            const cableMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.4, metalness: 0.5 });
            for (let c = -30; c <= 30; c += 15) {
                for (const side of [-5.5, 5.5]) {
                    const cableGeo = new THREE.CylinderGeometry(0.05, 0.05, 10, 4);
                    const cable = new THREE.Mesh(cableGeo, cableMat);
                    cable.position.set(side, 7, c);
                    cable.rotation.z = side > 0 ? 0.4 : -0.4;
                    group.add(cable);
                }
            }
            // Railing
            for (let r = -40; r <= 40; r += 3) {
                for (const side of [-5, 5]) {
                    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 4);
                    const post = new THREE.Mesh(postGeo, bridgeMat);
                    post.position.set(side, 5, r);
                    group.add(post);
                }
            }
            group.position.set(-120, 0, 260);
            group.rotation.y = Math.PI * 0.3;
            this.game.scene.add(group);
        }
    }

    // --- INSTANCED PROPS (Step 10) ---
    createProps() {
        // Collect all prop positions first, then create InstancedMeshes
        const lampPositions = [];
        const evergreenPositions = [];
        const deciduousPositions = [];
        const palmPositions = [];
        const benchPositions = [];
        const dumpsterPositions = [];
        const hydrantPositions = [];
        const trashCanPositions = [];
        const cargoContainerPositions = [];
        const phoneBoothPositions = [];
        const mailboxPositions = [];
        const fencePositions = [];
        const bollardPositions = [];

        // Street lamps at intersections
        for (let x = -this.halfMap; x <= this.halfMap; x += this.blockSize) {
            for (let z = -this.halfMap; z <= this.halfMap; z += this.blockSize) {
                const offset = this.roadWidth / 2 + 1;
                lampPositions.push({ x: x + offset, z: z + offset });
                lampPositions.push({ x: x - offset, z: z + offset });
            }
        }

        // Trees in hillside
        const hillside = this.districts.hillside;
        for (let i = 0; i < 450; i++) {
            const tx = hillside.bounds.minX + Math.random() * (hillside.bounds.maxX - hillside.bounds.minX);
            const tz = hillside.bounds.minZ + Math.random() * (hillside.bounds.maxZ - hillside.bounds.minZ);
            if (!this.isOnRoad(tx) && !this.isOnRoad(tz)) {
                const type = Math.floor(Math.random() * 3);
                if (type === 0) evergreenPositions.push({ x: tx, z: tz });
                else if (type === 1) deciduousPositions.push({ x: tx, z: tz });
                else palmPositions.push({ x: tx, z: tz });
                this.colliders.push({ type: 'tree', minX: tx - 0.4, maxX: tx + 0.4, minZ: tz - 0.4, maxZ: tz + 0.4, height: 6 });
            }
        }

        // Trees in other districts (district-specific distribution)
        for (const [key, dist] of Object.entries(this.districts)) {
            if (key === 'hillside') continue;
            const treeCount = key === 'strip' ? 150 : key === 'northshore' ? 120 : 75;
            for (let i = 0; i < treeCount; i++) {
                const tx = dist.bounds.minX + Math.random() * (dist.bounds.maxX - dist.bounds.minX);
                const tz = dist.bounds.minZ + Math.random() * (dist.bounds.maxZ - dist.bounds.minZ);
                if (!this.isOnRoad(tx) && !this.isOnRoad(tz)) {
                    // District-specific tree types
                    if (key === 'strip') {
                        palmPositions.push({ x: tx, z: tz }); // Strip gets palms
                    } else if (key === 'northshore') {
                        const r = Math.random();
                        if (r < 0.5) evergreenPositions.push({ x: tx, z: tz });
                        else deciduousPositions.push({ x: tx, z: tz });
                    } else {
                        const type = Math.floor(Math.random() * 3);
                        if (type === 0) evergreenPositions.push({ x: tx, z: tz });
                        else if (type === 1) deciduousPositions.push({ x: tx, z: tz });
                        else palmPositions.push({ x: tx, z: tz });
                    }
                    this.colliders.push({ type: 'tree', minX: tx - 0.4, maxX: tx + 0.4, minZ: tz - 0.4, maxZ: tz + 0.4, height: 6 });
                }
            }
        }

        // Park areas
        for (let p = 0; p < 6; p++) {
            const parkX = hillside.bounds.minX + 50 + Math.random() * 200;
            const parkZ = hillside.bounds.minZ + 50 + Math.random() * 200;
            for (let t = 0; t < 24; t++) {
                const tx = parkX + (Math.random() - 0.5) * 20;
                const tz = parkZ + (Math.random() - 0.5) * 20;
                if (!this.isOnRoad(tx) && !this.isOnRoad(tz)) {
                    const type = Math.floor(Math.random() * 3);
                    if (type === 0) evergreenPositions.push({ x: tx, z: tz });
                    else if (type === 1) deciduousPositions.push({ x: tx, z: tz });
                    else palmPositions.push({ x: tx, z: tz });
                    this.colliders.push({ type: 'tree', minX: tx - 0.4, maxX: tx + 0.4, minZ: tz - 0.4, maxZ: tz + 0.4, height: 6 });
                }
            }
            for (let b = 0; b < 3; b++) {
                benchPositions.push({ x: parkX + (Math.random() - 0.5) * 15, z: parkZ + (Math.random() - 0.5) * 15 });
            }
        }

        // Benches
        for (let i = 0; i < 30; i++) {
            const bx = -350 + Math.random() * 700;
            const bz = -350 + Math.random() * 700;
            if (!this.isOnRoad(bx) && !this.isOnRoad(bz)) {
                benchPositions.push({ x: bx, z: bz });
            }
        }

        // Dumpsters
        for (let i = 0; i < 20; i++) {
            const dist = [this.districts.industrial, this.districts.docks, this.districts.downtown][Math.floor(Math.random() * 3)];
            const dx = dist.bounds.minX + Math.random() * (dist.bounds.maxX - dist.bounds.minX);
            const dz = dist.bounds.minZ + Math.random() * (dist.bounds.maxZ - dist.bounds.minZ);
            if (!this.isOnRoad(dx) && !this.isOnRoad(dz)) {
                dumpsterPositions.push({ x: dx, z: dz });
                this.colliders.push({ type: 'prop', minX: dx - 1, maxX: dx + 1, minZ: dz - 0.6, maxZ: dz + 0.6, height: 1.5 });
            }
        }

        // Fire hydrants
        for (let i = 0; i < 40; i++) {
            const hx = -350 + Math.random() * 700;
            const hz = -350 + Math.random() * 700;
            if (this.isOnRoad(hx) || this.isOnRoad(hz)) {
                const nearest = Math.round(hx / this.blockSize) * this.blockSize;
                hydrantPositions.push({ x: nearest + this.roadWidth / 2 + 3.0, z: hz });
            }
        }

        // Trash cans
        for (let i = 0; i < 30; i++) {
            const tx = -350 + Math.random() * 700;
            const tz = -350 + Math.random() * 700;
            if (!this.isOnRoad(tx) && !this.isOnRoad(tz)) {
                trashCanPositions.push({ x: tx, z: tz });
            }
        }

        // Cargo containers at the Docks
        const docks = this.districts.docks;
        for (let i = 0; i < 25; i++) {
            const cx = docks.bounds.minX + 20 + Math.random() * (docks.bounds.maxX - docks.bounds.minX - 40);
            const cz = docks.bounds.minZ + 20 + Math.random() * (docks.bounds.maxZ - docks.bounds.minZ - 40);
            if (!this.isOnRoad(cx) && !this.isOnRoad(cz)) {
                cargoContainerPositions.push({ x: cx, z: cz, rot: Math.random() * Math.PI });
                this.colliders.push({ type: 'prop', minX: cx - 3, maxX: cx + 3, minZ: cz - 1.5, maxZ: cz + 1.5, height: 3 });
            }
        }

        // Chain-link fences in Industrial (along block edges)
        const industrial = this.districts.industrial;
        for (let i = 0; i < 30; i++) {
            const fx = industrial.bounds.minX + Math.random() * (industrial.bounds.maxX - industrial.bounds.minX);
            const fz = industrial.bounds.minZ + Math.random() * (industrial.bounds.maxZ - industrial.bounds.minZ);
            if (!this.isOnRoad(fx) && !this.isOnRoad(fz)) {
                fencePositions.push({ x: fx, z: fz, rot: Math.random() < 0.5 ? 0 : Math.PI / 2 });
            }
        }

        // Phone booths in Downtown and Portside
        for (const distKey of ['downtown', 'portside']) {
            const dist = this.districts[distKey];
            for (let i = 0; i < 8; i++) {
                const px = dist.bounds.minX + Math.random() * (dist.bounds.maxX - dist.bounds.minX);
                const pz = dist.bounds.minZ + Math.random() * (dist.bounds.maxZ - dist.bounds.minZ);
                if (this.isOnRoad(px) || this.isOnRoad(pz)) {
                    const nearest = Math.round(px / this.blockSize) * this.blockSize;
                    phoneBoothPositions.push({ x: nearest + this.roadWidth / 2 + 3.0, z: pz });
                    this.colliders.push({ type: 'prop', minX: nearest + this.roadWidth / 2 + 2.5, maxX: nearest + this.roadWidth / 2 + 3.5, minZ: pz - 0.5, maxZ: pz + 0.5, height: 2.5 });
                }
            }
        }

        // Mailboxes downtown
        for (let i = 0; i < 12; i++) {
            const dist = this.districts.downtown;
            const mx = dist.bounds.minX + Math.random() * (dist.bounds.maxX - dist.bounds.minX);
            const mz = dist.bounds.minZ + Math.random() * (dist.bounds.maxZ - dist.bounds.minZ);
            if (this.isOnRoad(mx) || this.isOnRoad(mz)) {
                const nearest = Math.round(mx / this.blockSize) * this.blockSize;
                mailboxPositions.push({ x: nearest + this.roadWidth / 2 + 3.0, z: mz });
            }
        }

        // Bollards on The Strip (decorative posts along sidewalks)
        const strip = this.districts.strip;
        for (let i = 0; i < 40; i++) {
            const bx = strip.bounds.minX + Math.random() * (strip.bounds.maxX - strip.bounds.minX);
            const bz = strip.bounds.minZ + Math.random() * (strip.bounds.maxZ - strip.bounds.minZ);
            if (this.isOnRoad(bx) || this.isOnRoad(bz)) {
                const nearest = Math.round(bx / this.blockSize) * this.blockSize;
                bollardPositions.push({ x: nearest + this.roadWidth / 2 + 3.0, z: bz });
            }
        }

        // Now create InstancedMeshes for each prop type
        this._createLampInstances(lampPositions);
        this._createTreeInstances('evergreen', evergreenPositions);
        this._createTreeInstances('deciduous', deciduousPositions);
        this._createTreeInstances('palm', palmPositions);
        this._createBenchInstances(benchPositions);
        this._createDumpsterInstances(dumpsterPositions);
        this._createHydrantInstances(hydrantPositions);
        this._createTrashCanInstances(trashCanPositions);
        this._createCargoContainerInstances(cargoContainerPositions);
        this._createFenceInstances(fencePositions);
        this._createPhoneBoothInstances(phoneBoothPositions);
        this._createMailboxInstances(mailboxPositions);
        this._createBollardInstances(bollardPositions);
    }

    _mergeGeomsForInstance(geoArray) {
        if (geoArray.length === 0) return null;
        if (geoArray.length === 1) return geoArray[0];
        return safeMerge(geoArray);
    }

    _createLampInstances(positions) {
        if (positions.length === 0) return;

        // Merge pole + arm + fixture into one geometry
        const poleGeo = new THREE.CylinderGeometry(0.1, 0.12, 5, 6);
        poleGeo.translate(0, 2.5, 0);
        const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 2, 4);
        armGeo.rotateZ(Math.PI / 2);
        armGeo.translate(0.8, 4.8, 0);
        const fixtureGeo = new THREE.CylinderGeometry(0.3, 0.15, 0.3, 8);
        fixtureGeo.translate(1.6, 4.7, 0);

        const mergedGeo = safeMerge([poleGeo, armGeo, fixtureGeo]);

        this.lampFixtureMat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            emissive: 0x000000,
            metalness: 0.5,
            roughness: 0.4
        });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, this.lampFixtureMat, positions.length);
        instancedMesh.castShadow = true;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, 0, positions[i].z);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);

            // Store world position of fixture for light pool
            this.lampPositions.push(new THREE.Vector3(positions[i].x + 1.6, 4.5, positions[i].z));
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        this.game.scene.add(instancedMesh);

        poleGeo.dispose();
        armGeo.dispose();
        fixtureGeo.dispose();
    }

    _createTreeInstances(type, positions) {
        if (positions.length === 0) return;

        let mergedGeo;
        let mat;

        if (type === 'evergreen') {
            const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2, 6);
            trunkGeo.translate(0, 1, 0);
            const canopyGeo = new THREE.ConeGeometry(1.8, 4, 6);
            canopyGeo.translate(0, 4, 0);
            // Merge trunk and canopy -- use single color (trunk is small, canopy dominates)
            mergedGeo = safeMerge([trunkGeo, canopyGeo]);
            mat = new THREE.MeshStandardMaterial({ color: 0x1a5522, roughness: 0.6 });
            trunkGeo.dispose();
            canopyGeo.dispose();
        } else if (type === 'deciduous') {
            const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2, 6);
            trunkGeo.translate(0, 1, 0);
            const canopyGeo = new THREE.SphereGeometry(2.2, 8, 6);
            canopyGeo.translate(0, 4.2, 0);
            mergedGeo = safeMerge([trunkGeo, canopyGeo]);
            mat = new THREE.MeshStandardMaterial({ color: 0x338833, roughness: 0.6 });
            trunkGeo.dispose();
            canopyGeo.dispose();
        } else {
            // Palm - trunk + simple flat canopy (sphere flattened)
            const trunkGeo = new THREE.CylinderGeometry(0.1, 0.2, 4, 6);
            trunkGeo.translate(0, 2, 0);
            const canopyGeo = new THREE.SphereGeometry(1.5, 6, 4);
            canopyGeo.scale(1, 0.3, 1);
            canopyGeo.translate(0, 4.3, 0);
            mergedGeo = safeMerge([trunkGeo, canopyGeo]);
            mat = new THREE.MeshStandardMaterial({ color: 0x2a7a2a, roughness: 0.6 });
            trunkGeo.dispose();
            canopyGeo.dispose();
        }

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        instancedMesh.castShadow = true;

        // Per-instance color variety via HSL shifts
        const baseColor = new THREE.Color(mat.color.getHex());
        const hsl = {};
        baseColor.getHSL(hsl);

        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            const scale = 0.8 + Math.random() * 0.5; // 0.8 - 1.3x
            dummy.position.set(positions[i].x, 0, positions[i].z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);

            // HSL shift per instance
            const h = hsl.h + (Math.random() - 0.5) * 0.08;
            const s = Math.max(0, Math.min(1, hsl.s + (Math.random() - 0.5) * 0.15));
            const l = Math.max(0, Math.min(1, hsl.l + (Math.random() - 0.5) * 0.12));
            let instanceColor = new THREE.Color().setHSL(h, s, l);

            // 30% chance of autumn colors for deciduous trees
            if (type === 'deciduous' && Math.random() < 0.3) {
                const autumnColors = [0xcc6622, 0xaa3322, 0xddaa33, 0xbb5511, 0xcc8833];
                instanceColor = new THREE.Color(autumnColors[Math.floor(Math.random() * autumnColors.length)]);
                // Apply slight HSL variation to autumn too
                const aHSL = {};
                instanceColor.getHSL(aHSL);
                instanceColor.setHSL(
                    aHSL.h + (Math.random() - 0.5) * 0.05,
                    Math.max(0.3, aHSL.s + (Math.random() - 0.5) * 0.1),
                    Math.max(0.2, Math.min(0.6, aHSL.l + (Math.random() - 0.5) * 0.1))
                );
            }

            instancedMesh.setColorAt(i, instanceColor);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
        this.game.scene.add(instancedMesh);
    }

    _createBenchInstances(positions) {
        if (positions.length === 0) return;

        const seatGeo = new THREE.BoxGeometry(2, 0.1, 0.6);
        seatGeo.translate(0, 0.5, 0);
        const leg1Geo = new THREE.BoxGeometry(0.1, 0.5, 0.5);
        leg1Geo.translate(-0.8, 0.25, 0);
        const leg2Geo = new THREE.BoxGeometry(0.1, 0.5, 0.5);
        leg2Geo.translate(0.8, 0.25, 0);
        const backGeo = new THREE.BoxGeometry(2, 0.6, 0.08);
        backGeo.translate(0, 0.9, -0.26);

        const mergedGeo = safeMerge([seatGeo, leg1Geo, leg2Geo, backGeo]);
        const mat = new THREE.MeshStandardMaterial({ color: 0x886644, roughness: 0.8 });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, 0, positions[i].z);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        this.game.scene.add(instancedMesh);

        seatGeo.dispose(); leg1Geo.dispose(); leg2Geo.dispose(); backGeo.dispose();
    }

    _createDumpsterInstances(positions) {
        if (positions.length === 0) return;

        const geo = new THREE.BoxGeometry(2, 1.5, 1.2);
        geo.translate(0, 0.75, 0);
        const mat = new THREE.MeshStandardMaterial({ color: 0x336633, roughness: 0.8 });

        const instancedMesh = new THREE.InstancedMesh(geo, mat, positions.length);
        instancedMesh.castShadow = true;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, 0, positions[i].z);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        this.game.scene.add(instancedMesh);
    }

    _createHydrantInstances(positions) {
        if (positions.length === 0) return;

        const bodyGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.6, 8);
        bodyGeo.translate(0, 0.3, 0);
        const capGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.15, 8);
        capGeo.translate(0, 0.65, 0);
        const mergedGeo = safeMerge([bodyGeo, capGeo]);
        const mat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, 0, positions[i].z);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        this.game.scene.add(instancedMesh);

        bodyGeo.dispose(); capGeo.dispose();
    }

    _createTrashCanInstances(positions) {
        if (positions.length === 0) return;

        const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.8, 8);
        bodyGeo.translate(0, 0.4, 0);
        // Add rim
        const rimGeo = new THREE.CylinderGeometry(0.28, 0.25, 0.05, 8);
        rimGeo.translate(0, 0.82, 0);
        const mergedGeo = safeMerge([bodyGeo, rimGeo]);
        const mat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        instancedMesh.castShadow = true;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, 0, positions[i].z);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        this.game.scene.add(instancedMesh);

        bodyGeo.dispose(); rimGeo.dispose();
    }

    _createCargoContainerInstances(positions) {
        if (positions.length === 0) return;

        // Shipping container: 6m x 2.5m x 3m tall
        const bodyGeo = new THREE.BoxGeometry(6, 3, 2.5);
        bodyGeo.translate(0, 1.5, 0);
        // Corrugation ridges (2 thin strips on front face)
        const ridge1 = new THREE.BoxGeometry(0.05, 2.6, 2.3);
        ridge1.translate(2.8, 1.5, 0);
        const ridge2 = new THREE.BoxGeometry(0.05, 2.6, 2.3);
        ridge2.translate(-2.8, 1.5, 0);

        const mergedGeo = safeMerge([bodyGeo, ridge1, ridge2]);
        const mat = new THREE.MeshStandardMaterial({ color: 0xcc4422, roughness: 0.7, metalness: 0.3 });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        instancedMesh.castShadow = true;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, 0, positions[i].z);
            dummy.rotation.y = positions[i].rot || 0;
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
            // Vary color per instance
            const colors = [0xcc4422, 0x2244aa, 0x228833, 0xaaaa22, 0x884422];
            instancedMesh.setColorAt(i, new THREE.Color(colors[i % colors.length]));
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
        this.game.scene.add(instancedMesh);

        bodyGeo.dispose(); ridge1.dispose(); ridge2.dispose();
    }

    _createFenceInstances(positions) {
        if (positions.length === 0) return;

        // Chain-link fence segment: 4m wide x 2.5m tall
        const post1 = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 4);
        post1.translate(-2, 1.25, 0);
        const post2 = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 4);
        post2.translate(2, 1.25, 0);
        const rail = new THREE.BoxGeometry(4, 0.05, 0.05);
        rail.translate(0, 2.5, 0);
        // Mesh panel (thin box to represent chain-link)
        const panel = new THREE.BoxGeometry(3.9, 2.4, 0.02);
        panel.translate(0, 1.25, 0);

        const mergedGeo = safeMerge([post1, post2, rail, panel]);
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.7 });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, 0, positions[i].z);
            dummy.rotation.y = positions[i].rot || 0;
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        this.game.scene.add(instancedMesh);

        post1.dispose(); post2.dispose(); rail.dispose(); panel.dispose();
    }

    _createPhoneBoothInstances(positions) {
        if (positions.length === 0) return;

        // Classic phone booth
        const baseGeo = new THREE.BoxGeometry(1, 2.4, 1);
        baseGeo.translate(0, 1.2, 0);
        const roofGeo = new THREE.BoxGeometry(1.1, 0.1, 1.1);
        roofGeo.translate(0, 2.45, 0);
        // Phone inside (small box)
        const phoneGeo = new THREE.BoxGeometry(0.2, 0.3, 0.05);
        phoneGeo.translate(0, 1.4, 0.46);

        const mergedGeo = safeMerge([baseGeo, roofGeo, phoneGeo]);
        const mat = new THREE.MeshStandardMaterial({ color: 0x224488, roughness: 0.5, transparent: true, opacity: 0.85 });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        instancedMesh.castShadow = true;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, 0, positions[i].z);
            dummy.rotation.y = 0;
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        this.game.scene.add(instancedMesh);

        baseGeo.dispose(); roofGeo.dispose(); phoneGeo.dispose();
    }

    _createMailboxInstances(positions) {
        if (positions.length === 0) return;

        // USPS-style blue mailbox
        const bodyGeo = new THREE.BoxGeometry(0.5, 1.0, 0.4);
        bodyGeo.translate(0, 1.0, 0);
        const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 4);
        legGeo.translate(0, 0.25, 0);
        // Rounded top (half-cylinder approximation with box)
        const topGeo = new THREE.BoxGeometry(0.5, 0.15, 0.4);
        topGeo.translate(0, 1.55, 0);

        const mergedGeo = safeMerge([bodyGeo, legGeo, topGeo]);
        const mat = new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.6 });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, 0, positions[i].z);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        this.game.scene.add(instancedMesh);

        bodyGeo.dispose(); legGeo.dispose(); topGeo.dispose();
    }

    _createBollardInstances(positions) {
        if (positions.length === 0) return;

        // Decorative metal bollard with light cap
        const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.0, 6);
        postGeo.translate(0, 0.5, 0);
        const capGeo = new THREE.SphereGeometry(0.12, 6, 4);
        capGeo.translate(0, 1.05, 0);

        const mergedGeo = safeMerge([postGeo, capGeo]);
        const mat = new THREE.MeshStandardMaterial({ color: 0xccaa44, roughness: 0.3, metalness: 0.6 });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, 0, positions[i].z);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        this.game.scene.add(instancedMesh);

        postGeo.dispose(); capGeo.dispose();
    }

    createStuntRamps() {
        this.stuntRamps = [];

        const rampLocations = [
            // Downtown - highway overpass ramp
            { x: 50, z: -50, rotY: 0, name: 'Downtown Drop' },
            { x: -80, z: 100, rotY: Math.PI / 2, name: 'City Launcher' },
            // The Strip - casino district
            { x: 200, z: -250, rotY: Math.PI / 4, name: 'Strip Streak' },
            { x: 300, z: -300, rotY: -Math.PI / 4, name: 'Neon Flyer' },
            // Hillside - mountain roads
            { x: -250, z: -300, rotY: Math.PI, name: 'Hill Climber' },
            { x: -300, z: -200, rotY: -Math.PI / 2, name: 'Canyon Jump' },
            // Industrial - warehouse district
            { x: 300, z: 200, rotY: 0, name: 'Industrial Launch' },
            { x: 250, z: 300, rotY: Math.PI / 2, name: 'Dock Drop' },
            // Docks
            { x: -300, z: 300, rotY: Math.PI, name: 'Harbor Leap' },
            // Epic ramp on the highway
            { x: 0, z: -100, rotY: 0, name: 'Main Street Mega' },
        ];

        const rampMat = new THREE.MeshStandardMaterial({
            color: 0xcc8833,
            roughness: 0.6,
            metalness: 0.3
        });
        const stripeMat = new THREE.MeshStandardMaterial({
            color: 0xffcc00,
            emissive: 0xffcc00,
            emissiveIntensity: 0.2,
            roughness: 0.5
        });

        for (const loc of rampLocations) {
            const group = new THREE.Group();

            // Ramp surface - wedge shape using ExtrudeGeometry
            const rampShape = new THREE.Shape();
            rampShape.moveTo(0, 0);
            rampShape.lineTo(6, 0);
            rampShape.lineTo(6, 3);
            rampShape.lineTo(0, 3);
            rampShape.lineTo(0, 0);

            const rampGeo = new THREE.ExtrudeGeometry(rampShape, {
                steps: 1,
                depth: 5,
                bevelEnabled: false
            });
            const ramp = new THREE.Mesh(rampGeo, rampMat);
            ramp.rotation.y = Math.PI / 2;
            ramp.position.set(-2.5, 0, -3);
            ramp.castShadow = true;
            ramp.receiveShadow = true;
            group.add(ramp);

            // Yellow warning stripes on top
            const stripeGeo = new THREE.PlaneGeometry(4.5, 5.5);
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.position.set(0, 1.55, 0);
            stripe.rotation.x = -Math.atan2(3, 6);
            stripe.rotation.z = 0;
            group.add(stripe);

            group.position.set(loc.x, 0, loc.z);
            group.rotation.y = loc.rotY;
            this.game.scene.add(group);

            // Add a collider for the ramp (so vehicles drive up it)
            const hw = 2.5;
            const hl = 3;
            this.colliders.push({
                type: 'ramp',
                minX: loc.x - hw, maxX: loc.x + hw,
                minZ: loc.z - hl, maxZ: loc.z + hl,
                height: 3,
                isRamp: true
            });

            this.stuntRamps.push({
                position: new THREE.Vector3(loc.x, 0, loc.z),
                name: loc.name,
                rotation: loc.rotY,
                completed: false
            });
        }
    }

    createPhysicsColliders() {
        const physics = this.game.systems.physics;
        if (!physics || !physics.ready) return;
        for (const c of this.colliders) {
            physics.createStaticCuboid(c.minX, c.maxX, c.minZ, c.maxZ, c.height || 5, c.yOffset || 0);
        }

        // Invisible boundary walls at map edges
        const h = this.halfMap;
        const wallHeight = 20;
        const wallThick = 2;
        // North wall
        physics.createStaticCuboid(-h - wallThick, h + wallThick, -h - wallThick, -h, wallHeight, 0);
        // South wall
        physics.createStaticCuboid(-h - wallThick, h + wallThick, h, h + wallThick, wallHeight, 0);
        // West wall
        physics.createStaticCuboid(-h - wallThick, -h, -h, h, wallHeight, 0);
        // East wall
        physics.createStaticCuboid(h, h + wallThick, -h, h, wallHeight, 0);
    }

    getTerrainHeight(x, z) {
        let height = 0;
        // Hillside: gradual hill rising toward NW corner (max 12 units)
        const hillDist = Math.sqrt((x + 275) * (x + 275) + (z + 275) * (z + 275));
        if (hillDist < 300) {
            height += Math.max(0, 12 * (1 - hillDist / 300));
        }
        // Downtown center: slight 3-unit rise
        const dtDist = Math.sqrt(x * x + z * z);
        if (dtDist < 150) {
            height += 3 * (1 - dtDist / 150) * 0.5;
        }
        // North Shore: gentle coastal slope
        if (z < -200) {
            const factor = Math.min(1, (-200 - z) / 200);
            height += factor * 4;
        }
        return height;
    }

    isOnRoad(pos) {
        const nearest = Math.round(pos / this.blockSize) * this.blockSize;
        return Math.abs(pos - nearest) < this.roadWidth / 2 + 1;
    }


    createEasterEggs() {
        this.createGraffiti(150, 5, 150, 'GROVE ST 4 LIFE', 0x33cc33);
        this.createSign(250, 8, -250, "CLUCKIN' BELL\n(Closed)", 0xffaa00);
        this.createSign(50, 7, 50, "ROMAN'S BOWL-O-RAMA\nClosed for Renovation", 0xff6644);
        this.createNeonSign(300, 10, -300, 'Kifflom!', 0xff00ff);
        this.createSign(-50, 6, 30, "ANTHROPIC BOOKS\nNow Stocking:\n'The Myth of Claude'", 0x8888ff);
        this.createSign(350, 12, -180, "OPUS 4.6\nENERGY DRINK\nThink Harder", 0x00ccff);
        this.createGraffiti(-250, 3, 250, 'cogito ergo sum', 0xffffff);
        this.createYogaMat(-250, 8, -250);
        this.createJetpackProp(-300, 14, 300);
        // Hidden heart moved to a less visible location
        this.createHiddenHeart(0, 55, 0);
        this.createSign(-70, 5, -40, "COUSIN'S BOWLING\n'Let's go bowling!'\n- Roman", 0xddaa00);
        this.createGraffiti(30, 2.5, -60, 'WASTED', 0xcc0000);
        this.createSign(-150, 5, 180, "CJ's BARBER SHOP\nAll You Had To Do...", 0x88ff88);
        this.createSign(80, 3, -30, "LIBERTY CITY\nTRANSIT", 0x4488cc);
        this.createSign(-180, 4, -280, "SONNET SODA\nArtificially Refreshing", 0xff8844);
        this.createSign(180, 2, 130, "CHOP\n(Good Boy)", 0x996633);
        this.createSign(-300, 1.5, -300, "WELCOME MAT\n'Wrong House, Fool!'", 0xcc6633);
        this.createSign(100, 6, -350, "NOW SHOWING:\nNo Country for Old NPCs", 0xdddddd);
        this.createSign(270, 5, -150, "VICE CITY\nREAL ESTATE\n'Property of Tommy V.'", 0xff66aa);
        this.createSign(-350, 5, 350, "T.P. INDUSTRIES\n'Not as bad as you think'", 0xaa6644);
        this.createGraffiti(-250, 5, 200, 'just token prediction is a myth', 0x00ff00);
    }

    createGraffiti(x, y, z, text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, 256, 80);
        const texture = new THREE.CanvasTexture(canvas);
        const geo = new THREE.PlaneGeometry(6, 1.5);
        const mat = new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.9 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        this.game.scene.add(mesh);
    }

    createSign(x, y, z, text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, 512, 256);
        ctx.strokeStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.lineWidth = 3;
        ctx.strokeRect(5, 5, 502, 246);
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        const lines = text.split('\n');
        lines.forEach((line, i) => ctx.fillText(line, 256, 60 + i * 45));
        const texture = new THREE.CanvasTexture(canvas);
        const geo = new THREE.PlaneGeometry(5, 2.5);
        const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        this.game.scene.add(mesh);
    }

    createNeonSign(x, y, z, text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, 128, 48);
        const texture = new THREE.CanvasTexture(canvas);
        const geo = new THREE.PlaneGeometry(4, 1);
        const mat = new THREE.MeshStandardMaterial({
            map: texture, emissive: color, emissiveIntensity: 0.5, transparent: true
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        this.game.scene.add(mesh);
    }

    createYogaMat(x, y, z) {
        const geo = new THREE.BoxGeometry(0.8, 0.02, 2);
        const mat = new THREE.MeshStandardMaterial({ color: 0x9944aa, roughness: 0.8 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        this.game.scene.add(mesh);
    }

    createJetpackProp(x, y, z) {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.7, roughness: 0.3 });
        const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8);
        group.add(new THREE.Mesh(bodyGeo, mat));
        for (const side of [-0.25, 0.25]) {
            const nozzleGeo = new THREE.CylinderGeometry(0.15, 0.1, 0.3, 6);
            const nozzle = new THREE.Mesh(nozzleGeo, mat);
            nozzle.position.set(side, -0.5, 0);
            group.add(nozzle);
        }
        group.position.set(x, y, z);
        group.userData.interactable = true;
        group.userData.interactText = 'Not this time.';
        this.game.scene.add(group);
    }

    createHiddenHeart(x, y, z) {
        const geo = new THREE.SphereGeometry(0.5, 8, 8);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.8, roughness: 0.2
        });
        const heart = new THREE.Mesh(geo, mat);
        heart.position.set(x, y, z);
        this.game.scene.add(heart);
    }

    createRainSystem() {
        // Rain streaks - 800 elongated cylinders
        const count = 800;
        const geo = new THREE.CylinderGeometry(0.008, 0.008, 0.8, 3);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xaabbdd, transparent: true, opacity: 0.35
        });
        this.rainParticles = new THREE.InstancedMesh(geo, mat, count);
        this.rainParticles.visible = false;
        this.rainParticles.frustumCulled = false;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
            dummy.position.set((Math.random() - 0.5) * 120, Math.random() * 50, (Math.random() - 0.5) * 120);
            dummy.updateMatrix();
            this.rainParticles.setMatrixAt(i, dummy.matrix);
        }
        this.game.scene.add(this.rainParticles);
        this.rainOffsets = [];
        for (let i = 0; i < count; i++) {
            this.rainOffsets.push({
                x: (Math.random() - 0.5) * 120,
                y: Math.random() * 50,
                z: (Math.random() - 0.5) * 120,
                speed: 35 + Math.random() * 25
            });
        }

        // Splash particles on ground - 100 small rings
        const splashCount = 100;
        const splashGeo = new THREE.RingGeometry(0.05, 0.15, 8);
        splashGeo.rotateX(-Math.PI / 2);
        const splashMat = new THREE.MeshBasicMaterial({
            color: 0xbbccee, transparent: true, opacity: 0.3, side: THREE.DoubleSide
        });
        this.rainSplashes = new THREE.InstancedMesh(splashGeo, splashMat, splashCount);
        this.rainSplashes.visible = false;
        this.rainSplashes.frustumCulled = false;
        for (let i = 0; i < splashCount; i++) {
            dummy.position.set(0, -100, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            this.rainSplashes.setMatrixAt(i, dummy.matrix);
        }
        this.game.scene.add(this.rainSplashes);
        this.splashData = [];
        for (let i = 0; i < splashCount; i++) {
            this.splashData.push({ active: false, life: 0, x: 0, z: 0, scale: 1 });
        }
        this._nextSplash = 0;
    }

    updateWeather(weather, dt) {
        const isRaining = weather === 'rain' || weather === 'storm';
        const isStorm = weather === 'storm';
        this.rainParticles.visible = isRaining;
        this.rainSplashes.visible = isRaining;

        if (isRaining) {
            const playerPos = this.game.systems.player.position;
            const dummy = new THREE.Object3D();

            // Wind angle for storm: rain falls at an angle
            const windX = isStorm ? 8 : 2;
            const windZ = isStorm ? 4 : 1;

            // Tilt rain to match wind
            dummy.rotation.set(0, 0, 0);
            dummy.rotation.x = windZ * 0.01;
            dummy.rotation.z = -windX * 0.01;

            for (let i = 0; i < this.rainOffsets.length; i++) {
                const r = this.rainOffsets[i];
                r.y -= r.speed * dt;
                r.x += windX * dt;
                r.z += windZ * dt;

                if (r.y < 0) {
                    // Spawn splash where raindrop landed
                    this._spawnSplash(playerPos.x + r.x, playerPos.z + r.z);
                    r.y = 45 + Math.random() * 10;
                    r.x = (Math.random() - 0.5) * 120;
                    r.z = (Math.random() - 0.5) * 120;
                }

                dummy.position.set(playerPos.x + r.x, r.y, playerPos.z + r.z);
                dummy.updateMatrix();
                this.rainParticles.setMatrixAt(i, dummy.matrix);
            }
            this.rainParticles.instanceMatrix.needsUpdate = true;

            // Update splashes
            const splashDummy = new THREE.Object3D();
            for (let i = 0; i < this.splashData.length; i++) {
                const s = this.splashData[i];
                if (s.active) {
                    s.life -= dt;
                    s.scale = 1 + (0.15 - s.life) * 8;
                    if (s.life <= 0) {
                        s.active = false;
                        splashDummy.position.set(0, -100, 0);
                    } else {
                        splashDummy.position.set(s.x, 0.05, s.z);
                        splashDummy.scale.set(s.scale, 1, s.scale);
                    }
                } else {
                    splashDummy.position.set(0, -100, 0);
                    splashDummy.scale.set(1, 1, 1);
                }
                splashDummy.rotation.set(-Math.PI / 2, 0, 0);
                splashDummy.updateMatrix();
                this.rainSplashes.setMatrixAt(i, splashDummy.matrix);
            }
            this.rainSplashes.instanceMatrix.needsUpdate = true;

            // Storm: heavier rain opacity
            this.rainParticles.material.opacity = isStorm ? 0.5 : 0.35;
        }

        if (this.waterPlane) {
            this.waterPlane.material.metalness = isRaining ? 0.8 : 0.6;
            this.waterPlane.material.roughness = isRaining ? 0.1 : 0.2;
        }
    }

    _spawnSplash(x, z) {
        const s = this.splashData[this._nextSplash];
        s.active = true;
        s.life = 0.15;
        s.x = x;
        s.z = z;
        s.scale = 1;
        this._nextSplash = (this._nextSplash + 1) % this.splashData.length;
    }

    initLightPool() {
        for (let i = 0; i < this.maxActiveLights; i++) {
            const light = new THREE.PointLight(0xffdd88, 0, 25, 2);
            light.position.set(0, -100, 0);
            this.game.scene.add(light);
            this.lightPool.push(light);
        }
    }

    update(dt) {
        if (this.isNight) {
            this.updateLightPool();
            this.updateNeonSigns(dt);
        }
        this.updateTrafficLights(dt);
        this.updateHiddenPackages(dt);
        this.updateAmbientWildlife(dt);
        this._updateWaves(dt);
    }

    _updateWaves(dt) {
        if (!this.waterPlane || !this._wavePositions) return;
        this._waveTime += dt;
        const pos = this.waterPlane.geometry.attributes.position;
        const orig = this._wavePositions;
        for (let i = 0; i < pos.count; i++) {
            const x = orig.getX(i);
            const z = orig.getZ(i);
            const y = orig.getY(i) + Math.sin(x * 0.05 + this._waveTime * 1.5) * 0.3
                + Math.sin(z * 0.07 + this._waveTime * 1.2) * 0.2
                + Math.sin((x + z) * 0.03 + this._waveTime * 0.8) * 0.15;
            pos.setY(i, y);
        }
        pos.needsUpdate = true;
        this.waterPlane.geometry.computeVertexNormals();
    }

    updateLightPool() {
        const playerPos = this.game.systems.player.position;
        const sorted = this.lampPositions
            .map((pos, i) => ({
                pos,
                dist: (pos.x - playerPos.x) ** 2 + (pos.z - playerPos.z) ** 2
            }))
            .sort((a, b) => a.dist - b.dist);

        for (let i = 0; i < this.lightPool.length; i++) {
            if (i < sorted.length) {
                this.lightPool[i].position.copy(sorted[i].pos);
            }
        }
    }

    setNightMode(night) {
        if (night === this.isNight) return;
        this.isNight = night;

        // Toggle pool light intensities
        for (const light of this.lightPool) {
            light.intensity = night ? 1.5 : 0;
            if (!night) light.position.set(0, -100, 0);
        }

        // Toggle lamp fixture emissive on the shared InstancedMesh material
        if (this.lampFixtureMat) {
            this.lampFixtureMat.emissive = night ? new THREE.Color(0xffffcc) : new THREE.Color(0x000000);
            this.lampFixtureMat.emissiveIntensity = night ? 1.0 : 0;
        }

        // Toggle window emissives on the shared window material
        if (this.windowMat) {
            this.windowMat.emissive = night ? new THREE.Color(0xffffcc) : new THREE.Color(0x000000);
            this.windowMat.emissiveIntensity = night ? 0.3 : 0;
        }

        // Toggle neon signs
        if (this.neonSigns) {
            for (const neon of this.neonSigns) {
                neon.mesh.visible = night;
                if (neon.light) neon.light.intensity = night ? neon.baseIntensity : 0;
            }
        }

        if (night) this.updateLightPool();
    }

    setWindowEmissiveIntensity(intensity) {
        if (this.windowMat) {
            this.windowMat.emissiveIntensity = intensity;
        }
    }

    createNeonSigns() {
        this.neonSigns = [];

        // Neon sign configs for The Strip and Downtown
        const neonConfigs = [
            // The Strip - casino/entertainment neon
            { x: 180, z: -180, text: 'CASINO', color: 0xff00ff, rotY: 0 },
            { x: 220, z: -220, text: 'CLUB', color: 0x00ffff, rotY: Math.PI / 2 },
            { x: 260, z: -260, text: 'BAR', color: 0xff4400, rotY: 0 },
            { x: 300, z: -180, text: 'HOTEL', color: 0xffff00, rotY: -Math.PI / 2 },
            { x: 200, z: -320, text: 'LIVE', color: 0xff0066, rotY: Math.PI },
            { x: 340, z: -250, text: 'SLOTS', color: 0x44ff00, rotY: Math.PI / 2 },
            { x: 250, z: -350, text: 'NEON', color: 0xff00aa, rotY: 0 },
            { x: 350, z: -350, text: '24HR', color: 0x00ff88, rotY: -Math.PI / 4 },
            // Downtown
            { x: 50, z: -50, text: 'OPEN', color: 0x00ff00, rotY: 0 },
            { x: -80, z: 30, text: 'EAT', color: 0xff8800, rotY: Math.PI / 2 },
            { x: 100, z: 80, text: 'DELI', color: 0xffff00, rotY: 0 },
            { x: -40, z: -100, text: 'NEWS', color: 0x4488ff, rotY: -Math.PI / 2 },
        ];

        for (const cfg of neonConfigs) {
            const group = new THREE.Group();

            // Create neon text as a simple glowing plane
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');

            // Transparent background
            ctx.clearRect(0, 0, 256, 64);

            // Neon glow effect
            const color = '#' + cfg.color.toString(16).padStart(6, '0');
            ctx.shadowColor = color;
            ctx.shadowBlur = 15;
            ctx.font = 'bold 36px Rajdhani, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = color;
            // Draw twice for stronger glow
            ctx.fillText(cfg.text, 128, 32);
            ctx.fillText(cfg.text, 128, 32);

            const texture = new THREE.CanvasTexture(canvas);
            const planeMat = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const planeGeo = new THREE.PlaneGeometry(4, 1);
            const plane = new THREE.Mesh(planeGeo, planeMat);

            group.add(plane);
            group.position.set(cfg.x, 6 + Math.random() * 4, cfg.z);
            group.rotation.y = cfg.rotY;
            group.visible = this.isNight;
            this.game.scene.add(group);

            // Small point light for glow
            const light = new THREE.PointLight(cfg.color, 0, 12);
            light.position.copy(group.position);
            this.game.scene.add(light);

            this.neonSigns.push({
                mesh: group,
                light: light,
                baseIntensity: 0.8 + Math.random() * 0.5,
                color: cfg.color,
                flickerSpeed: 0.5 + Math.random() * 2
            });
        }
    }

    updateNeonSigns(dt) {
        if (!this.neonSigns || !this.isNight) return;

        for (const neon of this.neonSigns) {
            // Subtle flicker
            const flicker = 0.85 + Math.sin(Date.now() * 0.01 * neon.flickerSpeed) * 0.15;
            if (neon.light) {
                neon.light.intensity = neon.baseIntensity * flicker;
            }
            if (neon.mesh.children[0] && neon.mesh.children[0].material) {
                neon.mesh.children[0].material.opacity = 0.7 + flicker * 0.3;
            }
        }
    }

    createTrafficLights() {
        this.trafficLights = [];
        this._trafficLightTimer = 0;
        this._trafficLightPhase = 0; // 0=NS green, 1=NS yellow, 2=EW green, 3=EW yellow
        this._trafficPhaseDurations = [8, 2, 8, 2]; // seconds per phase

        // Place traffic lights at intersections near the center (within 200m)
        const positions = [];
        for (let x = -200; x <= 200; x += this.blockSize) {
            for (let z = -200; z <= 200; z += this.blockSize) {
                positions.push({ x, z });
            }
        }

        // Only place every other intersection to reduce object count
        const selectedPositions = positions.filter((_, i) => i % 2 === 0);

        for (const pos of selectedPositions) {
            const offset = this.roadWidth / 2 + 0.5;

            // 4 traffic light poles per intersection (one per corner)
            const corners = [
                { x: pos.x + offset, z: pos.z + offset, nsAngle: Math.PI, ewAngle: -Math.PI / 2 },
                { x: pos.x - offset, z: pos.z - offset, nsAngle: 0, ewAngle: Math.PI / 2 },
            ];

            for (const corner of corners) {
                // Pole
                const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.5, 4);
                const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
                const pole = new THREE.Mesh(poleGeo, poleMat);
                pole.position.set(corner.x, 1.75, corner.z);
                this.game.scene.add(pole);

                // Light housing
                const housingGeo = new THREE.BoxGeometry(0.2, 0.6, 0.15);
                const housingMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
                const housing = new THREE.Mesh(housingGeo, housingMat);
                housing.position.set(corner.x, 3.5, corner.z);
                this.game.scene.add(housing);

                // Three light spheres: red (top), yellow (mid), green (bottom)
                const lightColors = [0xff0000, 0xffaa00, 0x00ff00];
                const lightMeshes = [];
                for (let i = 0; i < 3; i++) {
                    const lGeo = new THREE.SphereGeometry(0.06, 6, 6);
                    const lMat = new THREE.MeshBasicMaterial({
                        color: lightColors[i],
                        transparent: true,
                        opacity: 0.2
                    });
                    const light = new THREE.Mesh(lGeo, lMat);
                    light.position.set(corner.x, 3.7 - i * 0.2, corner.z + 0.08);
                    this.game.scene.add(light);
                    lightMeshes.push(light);
                }

                this.trafficLights.push({
                    position: { x: corner.x, z: corner.z },
                    intersectionX: pos.x,
                    intersectionZ: pos.z,
                    lights: lightMeshes, // [red, yellow, green]
                    axis: (corner.x > pos.x) ? 'ns' : 'ew' // Opposite corners face different traffic
                });
            }
        }
    }

    updateTrafficLights(dt) {
        if (!this.trafficLights || this.trafficLights.length === 0) return;

        this._trafficLightTimer += dt;
        const phaseDuration = this._trafficPhaseDurations[this._trafficLightPhase];

        if (this._trafficLightTimer >= phaseDuration) {
            this._trafficLightTimer = 0;
            this._trafficLightPhase = (this._trafficLightPhase + 1) % 4;

            // Update all traffic light visuals
            for (const tl of this.trafficLights) {
                const [red, yellow, green] = tl.lights;
                // Phase 0: NS green, Phase 1: NS yellow, Phase 2: EW green, Phase 3: EW yellow
                // Invert phase for EW-facing lights
                const isNS = tl.axis === 'ns';
                const effectivePhase = isNS ? this._trafficLightPhase : (this._trafficLightPhase + 2) % 4;
                switch (effectivePhase) {
                    case 0: // green
                        red.material.opacity = 0.2;
                        yellow.material.opacity = 0.2;
                        green.material.opacity = 1.0;
                        break;
                    case 1: // yellow
                        red.material.opacity = 0.2;
                        yellow.material.opacity = 1.0;
                        green.material.opacity = 0.2;
                        break;
                    case 2: // EW green (NS red)
                        red.material.opacity = 1.0;
                        yellow.material.opacity = 0.2;
                        green.material.opacity = 0.2;
                        break;
                    case 3: // EW yellow (NS still red)
                        red.material.opacity = 1.0;
                        yellow.material.opacity = 0.2;
                        green.material.opacity = 0.2;
                        break;
                }
            }
        }
    }

    // Returns if traffic on a given axis should stop at this intersection
    isRedLight(intersectionX, intersectionZ, vehicleAxis) {
        // vehicleAxis: 0 = traveling along X (EW), 1 = traveling along Z (NS)
        // Phase 0,1: NS has green/yellow, EW has red
        // Phase 2,3: EW has green/yellow, NS has red
        if (vehicleAxis === 1) {
            // NS traffic: red during phases 2,3
            return this._trafficLightPhase === 2 || this._trafficLightPhase === 3;
        } else {
            // EW traffic: red during phases 0,1
            return this._trafficLightPhase === 0 || this._trafficLightPhase === 1;
        }
    }

    // Returns if a pedestrian walking on the given axis should wait at the crosswalk
    // walkAxis: 0 = walking along X (EW), 1 = walking along Z (NS)
    // Pedestrians crossing perpendicular to their walk axis need a walk signal
    isPedestrianRed(walkAxis) {
        // If walking along Z (NS), they cross EW roads — they can cross when NS is green (phases 0,1)
        // If walking along X (EW), they cross NS roads — they can cross when EW is green (phases 2,3)
        if (walkAxis === 1) {
            // Walking NS: cross signal is red during phases 2,3
            return this._trafficLightPhase === 2 || this._trafficLightPhase === 3;
        } else {
            // Walking EW: cross signal is red during phases 0,1
            return this._trafficLightPhase === 0 || this._trafficLightPhase === 1;
        }
    }

    checkCollision(x, z, radius) {
        for (const c of this.colliders) {
            if (x + radius > c.minX && x - radius < c.maxX &&
                z + radius > c.minZ && z - radius < c.maxZ) {
                return c;
            }
        }
        return null;
    }

    getDistrict(x, z) {
        for (const [key, district] of Object.entries(this.districts)) {
            const b = district.bounds;
            if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return key;
        }
        return 'downtown';
    }

    getDistrictName(x, z) {
        const key = this.getDistrict(x, z);
        return this.districts[key]?.name || 'San Claudio';
    }

    isInWater(x, z) {
        // Water surrounds the island — only count as water if outside the landmass
        // The island extends from -halfMap to +halfMap (400)
        const margin = this.halfMap - 20; // 380 — slight inset for shore
        return (x > margin || x < -margin || z > margin || z < -margin) &&
               (x >= 0 && x <= 600 && z >= 0 && z <= 600);
    }

    getWaterLevel() {
        return -0.3;
    }

    createHiddenPackages() {
        this.hiddenPackages = [];

        // 20 hidden packages spread across the map
        const locations = [
            // Downtown (5) — alleys, rooftops, behind buildings
            { x: 15, z: 15, hint: 'Behind the starter safehouse' },
            { x: -75, z: -25, hint: 'Downtown alley' },
            { x: 80, z: -80, hint: 'On a rooftop edge' },
            { x: -30, z: 90, hint: 'Under the overpass' },
            { x: 45, z: -95, hint: 'Corner of Downtown' },
            // The Strip (4) — behind casinos, in parking lots
            { x: 175, z: -175, hint: 'Behind the first casino' },
            { x: 300, z: -200, hint: 'Strip parking lot' },
            { x: 250, z: -350, hint: 'Back alley of The Strip' },
            { x: 350, z: -300, hint: 'Far end of The Strip' },
            // The Docks (3) — near water, cargo areas
            { x: -200, z: 280, hint: 'On the dock pier' },
            { x: -280, z: 200, hint: 'Behind cargo containers' },
            { x: -150, z: 350, hint: 'Warehouse loading bay' },
            // Hillside (3) — among trees, hillside paths
            { x: -200, z: -280, hint: 'Under a hillside tree' },
            { x: -300, z: -200, hint: 'Hillside overlook' },
            { x: -350, z: -350, hint: 'Remote hillside corner' },
            // Industrial (3) — factory areas
            { x: -280, z: 280, hint: 'Industrial yard' },
            { x: -350, z: 200, hint: 'Behind the factory' },
            { x: -200, z: 350, hint: 'Industrial outskirts' },
            // Edges (2) — remote areas
            { x: 380, z: 380, hint: 'Remote beach area' },
            { x: -380, z: -380, hint: 'Far corner of the map' }
        ];

        // Shared geometry and material for all packages
        const briefcaseGeo = new THREE.BoxGeometry(0.6, 0.4, 0.8);
        const briefcaseMat = new THREE.MeshStandardMaterial({
            color: 0x00ff44,
            emissive: 0x00ff44,
            emissiveIntensity: 0.6,
            metalness: 0.3,
            roughness: 0.4
        });

        // Glow ring for visibility
        const ringGeo = new THREE.RingGeometry(0.8, 1.2, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00ff44,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });

        for (let i = 0; i < locations.length; i++) {
            const loc = locations[i];
            const group = new THREE.Group();

            // Briefcase mesh
            const briefcase = new THREE.Mesh(briefcaseGeo, briefcaseMat);
            briefcase.position.y = 0.5;
            briefcase.castShadow = true;
            group.add(briefcase);

            // Handle
            const handleGeo = new THREE.TorusGeometry(0.12, 0.02, 4, 8, Math.PI);
            const handleMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
            const handle = new THREE.Mesh(handleGeo, handleMat);
            handle.position.set(0, 0.72, 0);
            handle.rotation.x = Math.PI;
            group.add(handle);

            // Ground ring
            const ring = new THREE.Mesh(ringGeo, ringMat.clone());
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.05;
            group.add(ring);

            group.position.set(loc.x, 0, loc.z);
            this.game.scene.add(group);

            this.hiddenPackages.push({
                mesh: group,
                briefcase: briefcase,
                ring: ring,
                x: loc.x,
                z: loc.z,
                hint: loc.hint,
                collected: false,
                index: i
            });
        }
    }

    updateHiddenPackages(dt) {
        if (!this.hiddenPackages) return;

        const player = this.game.systems.player;
        const time = Date.now() * 0.001;

        for (const pkg of this.hiddenPackages) {
            if (pkg.collected) continue;

            // Rotate and bob
            pkg.briefcase.rotation.y = time * 2;
            pkg.briefcase.position.y = 0.5 + Math.sin(time * 3) * 0.15;

            // Pulse ring
            pkg.ring.material.opacity = 0.2 + Math.sin(time * 4) * 0.1;
            pkg.ring.scale.setScalar(1 + Math.sin(time * 2) * 0.1);

            // Check pickup
            const dx = player.position.x - pkg.x;
            const dz = player.position.z - pkg.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 2) {
                pkg.collected = true;
                pkg.mesh.visible = false;

                // Reward
                player.addCash(500);
                this.game.stats.hiddenPackagesFound++;

                const found = this.game.stats.hiddenPackagesFound;
                const total = this.hiddenPackages.length;

                this.game.systems.audio.playPickup();
                this.game.systems.ui.showMissionText(
                    `Hidden Package ${found}/${total}\n+$500`, 3
                );

                // All found bonus
                if (found >= total) {
                    setTimeout(() => {
                        this.game.systems.ui.showMissionText(
                            'ALL HIDDEN PACKAGES FOUND!\n+$10,000 Bonus\n+Atomizer weapon', 5
                        );
                        player.addCash(10000);
                        player.addWeapon({ id: 'atomizer', ammo: 50, clipSize: 20 });
                    }, 3500);
                }
            }
        }
    }

    _createAmbientWildlife() {
        this._createBirdFlocks();
        this._createButterflies();
        this._createBlowingLeaves();
    }

    _createBirdFlocks() {
        this.birdFlocks = [];
        const flockCenters = [
            { x: 30, z: 30, y: 50 },     // Downtown (offset from origin to avoid circling sun)
            { x: -250, z: -250, y: 40 }, // Hillside (higher)
            { x: 250, z: 250, y: 25 },   // Industrial
            { x: -250, z: 250, y: 28 },  // Docks
        ];

        for (const center of flockCenters) {
            const count = 8 + Math.floor(Math.random() * 6);
            const geo = new THREE.BufferGeometry();
            const positions = new Float32Array(count * 3);
            const velocities = [];

            for (let i = 0; i < count; i++) {
                positions[i * 3] = center.x + (Math.random() - 0.5) * 20;
                positions[i * 3 + 1] = center.y + (Math.random() - 0.5) * 5;
                positions[i * 3 + 2] = center.z + (Math.random() - 0.5) * 20;
                velocities.push({
                    x: (Math.random() - 0.5) * 2,
                    y: (Math.random() - 0.5) * 0.5,
                    z: (Math.random() - 0.5) * 2
                });
            }

            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const mat = new THREE.PointsMaterial({
                color: 0x222222,
                size: 0.8,
                sizeAttenuation: true
            });
            const points = new THREE.Points(geo, mat);
            this.game.scene.add(points);

            this.birdFlocks.push({
                mesh: points,
                center: { ...center },
                velocities: velocities,
                count: count,
                scatterTimer: 0
            });
        }
    }

    _createButterflies() {
        this.butterflies = [];
        // Spawn butterflies near parks (around x:80,z:-80 area and other green areas)
        const butterflyAreas = [
            { x: 80, z: -80 },   // Downtown park
            { x: -200, z: -200 }, // Hillside gardens
            { x: 0, z: 100 },    // Mid area
        ];

        for (const area of butterflyAreas) {
            for (let i = 0; i < 6; i++) {
                const geo = new THREE.PlaneGeometry(0.3, 0.2);
                const colors = [0xff8844, 0xffcc22, 0x44aaff, 0xff44aa, 0xaaff44];
                const mat = new THREE.MeshBasicMaterial({
                    color: colors[Math.floor(Math.random() * colors.length)],
                    transparent: true,
                    opacity: 0.8,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
                const mesh = new THREE.Mesh(geo, mat);
                const x = area.x + (Math.random() - 0.5) * 30;
                const z = area.z + (Math.random() - 0.5) * 30;
                mesh.position.set(x, 1 + Math.random() * 2, z);
                this.game.scene.add(mesh);

                this.butterflies.push({
                    mesh,
                    baseX: x, baseZ: z,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.5 + Math.random() * 1.0
                });
            }
        }
    }

    _createBlowingLeaves() {
        this.leaves = [];
        const leafCount = 40;
        const geo = new THREE.PlaneGeometry(0.15, 0.1);

        for (let i = 0; i < leafCount; i++) {
            const colors = [0x558833, 0x667744, 0x886633, 0x997744, 0x445522];
            const mat = new THREE.MeshBasicMaterial({
                color: colors[Math.floor(Math.random() * colors.length)],
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geo.clone(), mat);
            mesh.position.set(
                (Math.random() - 0.5) * 600,
                Math.random() * 3,
                (Math.random() - 0.5) * 600
            );
            this.game.scene.add(mesh);

            this.leaves.push({
                mesh,
                velX: 1 + Math.random() * 2,
                velZ: (Math.random() - 0.5) * 1,
                velY: -0.2 - Math.random() * 0.3,
                spin: Math.random() * 5,
                lifetime: 10 + Math.random() * 20
            });
        }
    }

    updateAmbientWildlife(dt) {
        // Birds
        if (this.birdFlocks) {
            const player = this.game.systems.player;
            for (const flock of this.birdFlocks) {
                const positions = flock.mesh.geometry.attributes.position.array;
                const pDist = Math.sqrt(
                    (flock.center.x - player.position.x) ** 2 +
                    (flock.center.z - player.position.z) ** 2
                );

                // Scatter if player nearby or shots fired
                const scattering = pDist < 25 || flock.scatterTimer > 0;
                if (pDist < 25 && flock.scatterTimer <= 0) flock.scatterTimer = 3;
                if (flock.scatterTimer > 0) flock.scatterTimer -= dt;

                for (let i = 0; i < flock.count; i++) {
                    const vel = flock.velocities[i];
                    if (scattering) {
                        // Fly away from center rapidly
                        const awayX = positions[i * 3] - flock.center.x;
                        const awayZ = positions[i * 3 + 2] - flock.center.z;
                        const len = Math.sqrt(awayX * awayX + awayZ * awayZ) || 1;
                        vel.x = (awayX / len) * 8;
                        vel.y = 2;
                        vel.z = (awayZ / len) * 8;
                    } else {
                        // Circle around center
                        const toCenter = {
                            x: flock.center.x - positions[i * 3],
                            z: flock.center.z - positions[i * 3 + 2]
                        };
                        const dist = Math.sqrt(toCenter.x ** 2 + toCenter.z ** 2);
                        if (dist > 15) {
                            vel.x += toCenter.x * 0.02;
                            vel.z += toCenter.z * 0.02;
                        }
                        // Perpendicular orbit
                        vel.x += -toCenter.z * 0.005;
                        vel.z += toCenter.x * 0.005;
                        // Damping
                        vel.x *= 0.99;
                        vel.z *= 0.99;
                        vel.y = Math.sin(Date.now() * 0.001 + i) * 0.3;
                    }

                    positions[i * 3] += vel.x * dt;
                    positions[i * 3 + 1] += vel.y * dt;
                    positions[i * 3 + 1] = Math.max(15, Math.min(50, positions[i * 3 + 1]));
                    positions[i * 3 + 2] += vel.z * dt;
                }
                flock.mesh.geometry.attributes.position.needsUpdate = true;
            }
        }

        // Butterflies
        if (this.butterflies) {
            for (const b of this.butterflies) {
                b.phase += dt * b.speed;
                b.mesh.position.x = b.baseX + Math.sin(b.phase) * 5;
                b.mesh.position.z = b.baseZ + Math.cos(b.phase * 0.7) * 5;
                b.mesh.position.y = 1.5 + Math.sin(b.phase * 2) * 0.5;
                // Wing flap
                b.mesh.rotation.y = Math.sin(b.phase * 8) * 0.8;
                b.mesh.rotation.x = Math.sin(b.phase * 3) * 0.2;
            }
        }

        // Leaves
        if (this.leaves) {
            for (const leaf of this.leaves) {
                leaf.mesh.position.x += leaf.velX * dt;
                leaf.mesh.position.y += leaf.velY * dt;
                leaf.mesh.position.z += leaf.velZ * dt;
                leaf.mesh.rotation.x += leaf.spin * dt;
                leaf.mesh.rotation.z += leaf.spin * 0.7 * dt;

                // Reset when out of range or below ground
                leaf.lifetime -= dt;
                if (leaf.lifetime <= 0 || leaf.mesh.position.y < -0.5) {
                    const player = this.game.systems.player;
                    leaf.mesh.position.set(
                        player.position.x + (Math.random() - 0.5) * 60,
                        2 + Math.random() * 4,
                        player.position.z + (Math.random() - 0.5) * 60
                    );
                    leaf.lifetime = 10 + Math.random() * 20;
                    leaf.velY = -0.2 - Math.random() * 0.3;
                }
            }
        }
    }
}
