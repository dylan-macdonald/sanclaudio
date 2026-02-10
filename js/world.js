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

        // Destructible props system
        this.destructibleProps = []; // { x, z, radius, type, destroyed, instancedMesh, instanceIndex }
        this.debrisParticles = []; // { mesh, vel, life }

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

    // --- Procedural Texture Generators (GTA 3 gritty aesthetic) ---

    _generateBuildingTexture(width, height, color, districtKey) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const c = new THREE.Color(color);
        const hex = '#' + c.getHexString();

        // Base fill with district color
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, 256, 512);

        // Subtle color variation across surface (large patches)
        for (let i = 0; i < 8; i++) {
            const px = Math.random() * 256;
            const py = Math.random() * 512;
            const pw = 40 + Math.random() * 80;
            const ph = 40 + Math.random() * 80;
            const shift = (Math.random() - 0.5) * 0.06;
            const rc = new THREE.Color(color);
            rc.r = Math.max(0, Math.min(1, rc.r + shift));
            rc.g = Math.max(0, Math.min(1, rc.g + shift));
            rc.b = Math.max(0, Math.min(1, rc.b + shift));
            ctx.fillStyle = '#' + rc.getHexString();
            ctx.globalAlpha = 0.3 + Math.random() * 0.3;
            ctx.fillRect(px, py, pw, ph);
        }
        ctx.globalAlpha = 1.0;

        // Floor separation lines (thin dark horizontal lines every ~30px)
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        for (let y = 30; y < 512; y += 30 + Math.random() * 8) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(256, y);
            ctx.stroke();
        }

        // Brick/concrete masonry pattern - subtle vertical lines
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < 256; x += 16 + Math.random() * 8) {
            const yOffset = (Math.floor(x / 16) % 2) * 15;
            for (let y = yOffset; y < 512; y += 30) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + 15);
                ctx.stroke();
            }
        }

        // Base grime gradient at bottom ~20% of texture
        const grimeGrad = ctx.createLinearGradient(0, 512 * 0.75, 0, 512);
        grimeGrad.addColorStop(0, 'rgba(0,0,0,0)');
        grimeGrad.addColorStop(0.4, 'rgba(0,0,0,0.12)');
        grimeGrad.addColorStop(1, 'rgba(0,0,0,0.28)');
        ctx.fillStyle = grimeGrad;
        ctx.fillRect(0, 512 * 0.75, 256, 512 * 0.25);

        // Extra dark grime at very bottom (street level)
        const streetGrime = ctx.createLinearGradient(0, 512 * 0.92, 0, 512);
        streetGrime.addColorStop(0, 'rgba(20,15,10,0)');
        streetGrime.addColorStop(1, 'rgba(20,15,10,0.35)');
        ctx.fillStyle = streetGrime;
        ctx.fillRect(0, 512 * 0.92, 256, 512 * 0.08);

        // Stains - random dark splotches
        for (let i = 0; i < 4; i++) {
            const sx = Math.random() * 256;
            const sy = Math.random() * 512;
            const sr = 8 + Math.random() * 20;
            ctx.beginPath();
            ctx.ellipse(sx, sy, sr, sr * (0.6 + Math.random() * 0.8), Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${Math.floor(Math.random() * 30)},${Math.floor(Math.random() * 20)},${Math.floor(Math.random() * 15)},${0.06 + Math.random() * 0.1})`;
            ctx.fill();
        }

        // Water streaks - thin vertical dark lines trailing downward
        for (let i = 0; i < 5; i++) {
            const wx = Math.random() * 256;
            const wy = Math.random() * 256; // start in upper half
            const wLen = 60 + Math.random() * 200;
            ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`;
            ctx.lineWidth = 1 + Math.random() * 2;
            ctx.beginPath();
            ctx.moveTo(wx, wy);
            // Slight wobble
            for (let d = 0; d < wLen; d += 10) {
                ctx.lineTo(wx + (Math.random() - 0.5) * 2, wy + d);
            }
            ctx.stroke();
        }

        // === GROUND FLOOR SHOPFRONT (bottom 18% of texture) ===
        const shopTop = Math.floor(512 * 0.82);
        const shopH = 512 - shopTop;

        // Shopfront darker band (slightly recessed look)
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(0, shopTop, 256, shopH);

        // Large display windows (2 windows with frames)
        ctx.fillStyle = 'rgba(120,140,160,0.25)'; // glass tint
        const winY = shopTop + 6;
        const winH = shopH - 22;
        // Left window
        ctx.fillRect(15, winY, 100, winH);
        // Right window
        ctx.fillRect(140, winY, 100, winH);
        // Window frames
        ctx.strokeStyle = 'rgba(40,35,30,0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(15, winY, 100, winH);
        ctx.strokeRect(140, winY, 100, winH);
        // Window reflections (diagonal highlight)
        ctx.strokeStyle = 'rgba(180,190,200,0.15)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(25, winY + winH);
        ctx.lineTo(65, winY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(150, winY + winH);
        ctx.lineTo(190, winY);
        ctx.stroke();

        // Door alcove (center, darker shadow)
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(118, winY, 18, winH);
        // Door frame
        ctx.strokeStyle = 'rgba(60,55,50,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(119, winY + 2, 16, winH - 2);
        // Door handle
        ctx.fillStyle = 'rgba(150,140,120,0.5)';
        ctx.fillRect(130, winY + winH * 0.5, 3, 6);

        // === WINDOW BLINDS (20% of upper-floor windows) ===
        // Windows are roughly at regular intervals based on floor lines (~30px apart)
        for (let fy = 30; fy < shopTop - 30; fy += 30 + Math.floor(Math.random() * 8)) {
            for (let fx = 20; fx < 240; fx += 50 + Math.floor(Math.random() * 20)) {
                if (Math.random() < 0.2) {
                    // Blinds: horizontal lines across window area
                    ctx.strokeStyle = 'rgba(180,175,165,0.15)';
                    ctx.lineWidth = 1;
                    const bx = fx, by = fy + 4, bw = 22, bh = 18;
                    for (let bLine = by; bLine < by + bh; bLine += 3) {
                        ctx.beginPath();
                        ctx.moveTo(bx, bLine);
                        ctx.lineTo(bx + bw, bLine);
                        ctx.stroke();
                    }
                }
            }
        }

        // === AC DRIP STAINS (dark streaks below some windows) ===
        for (let i = 0; i < 3; i++) {
            if (Math.random() < 0.5) continue;
            const acX = 30 + Math.random() * 190;
            const acY = 80 + Math.random() * 250;
            // AC unit rectangle (small gray box)
            ctx.fillStyle = 'rgba(90,88,85,0.25)';
            ctx.fillRect(acX, acY, 14, 8);
            // Drip stain below
            ctx.strokeStyle = 'rgba(20,18,15,0.12)';
            ctx.lineWidth = 3 + Math.random() * 3;
            ctx.beginPath();
            ctx.moveTo(acX + 7, acY + 8);
            const dripLen = 30 + Math.random() * 80;
            for (let d = 0; d < dripLen; d += 8) {
                ctx.lineTo(acX + 7 + (Math.random() - 0.5) * 2, acY + 8 + d);
            }
            ctx.stroke();
        }

        // === GRAFFITI for industrial/dock/strip districts ===
        const grittyDistricts = ['docks', 'industrial', 'strip', 'portside'];
        if (districtKey && grittyDistricts.includes(districtKey) && Math.random() < 0.15) {
            const tags = ['SC', 'VICE', '187', 'RIP', 'NOIZ', 'YO', 'BTK', 'ACE'];
            const tag = tags[Math.floor(Math.random() * tags.length)];
            const tagColors = ['#e83030', '#30e830', '#4080ff', '#ff80ff', '#ffff40'];
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = tagColors[Math.floor(Math.random() * tagColors.length)];
            ctx.globalAlpha = 0.5 + Math.random() * 0.3;
            const gx = 20 + Math.random() * 160;
            const gy = shopTop - 20 - Math.random() * 100;
            ctx.save();
            ctx.translate(gx, gy);
            ctx.rotate((Math.random() - 0.5) * 0.3);
            ctx.fillText(tag, 0, 0);
            ctx.restore();
            ctx.globalAlpha = 1.0;
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;
        return texture;
    }

    _generateRoadTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base dark gray asphalt
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, 512, 512);

        // Asphalt grain - scattered tiny dots in varying dark shades
        for (let i = 0; i < 3000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const shade = 30 + Math.floor(Math.random() * 25);
            ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
            ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
        }

        // Slightly larger grain particles
        for (let i = 0; i < 500; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const shade = 35 + Math.floor(Math.random() * 20);
            ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
            ctx.fillRect(x, y, 2, 2);
        }

        // Oil stains - dark circular splotches
        for (let i = 0; i < 6; i++) {
            const ox = Math.random() * 512;
            const oy = Math.random() * 512;
            const or = 10 + Math.random() * 30;
            const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, or);
            grad.addColorStop(0, `rgba(10,8,5,${0.15 + Math.random() * 0.15})`);
            grad.addColorStop(0.6, `rgba(10,8,5,${0.05 + Math.random() * 0.05})`);
            grad.addColorStop(1, 'rgba(10,8,5,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(ox - or, oy - or, or * 2, or * 2);
        }

        // Repair patches - lighter gray rectangles
        for (let i = 0; i < 3; i++) {
            const px = Math.random() * 400;
            const py = Math.random() * 400;
            const pw = 30 + Math.random() * 60;
            const ph = 20 + Math.random() * 40;
            ctx.fillStyle = `rgba(${50 + Math.floor(Math.random() * 15)},${50 + Math.floor(Math.random() * 15)},${50 + Math.floor(Math.random() * 15)},${0.3 + Math.random() * 0.2})`;
            ctx.fillRect(px, py, pw, ph);
        }

        // Crack lines - thin dark lines
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        for (let i = 0; i < 4; i++) {
            ctx.lineWidth = 0.5 + Math.random() * 1;
            ctx.beginPath();
            let cx = Math.random() * 512;
            let cy = Math.random() * 512;
            ctx.moveTo(cx, cy);
            const segs = 3 + Math.floor(Math.random() * 5);
            for (let s = 0; s < segs; s++) {
                cx += (Math.random() - 0.5) * 80;
                cy += (Math.random() - 0.5) * 80;
                ctx.lineTo(cx, cy);
            }
            ctx.stroke();
        }

        // === LANE MARKINGS ===

        // Yellow center line (dashed) — down the middle of the tile
        ctx.strokeStyle = '#c8b832';
        ctx.lineWidth = 4;
        ctx.setLineDash([20, 10]);
        ctx.beginPath();
        ctx.moveTo(256, 0);
        ctx.lineTo(256, 512);
        ctx.stroke();
        // Double yellow (second line offset by 6px)
        ctx.beginPath();
        ctx.moveTo(262, 0);
        ctx.lineTo(262, 512);
        ctx.stroke();
        ctx.setLineDash([]);

        // White lane dividers (dashed) at 1/3 and 2/3 width
        ctx.strokeStyle = 'rgba(220,220,220,0.7)';
        ctx.lineWidth = 3;
        ctx.setLineDash([16, 12]);
        ctx.beginPath();
        ctx.moveTo(170, 0);
        ctx.lineTo(170, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(342, 0);
        ctx.lineTo(342, 512);
        ctx.stroke();
        ctx.setLineDash([]);

        // White edge lines (solid) at road borders
        ctx.strokeStyle = 'rgba(200,200,200,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(20, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(492, 0);
        ctx.lineTo(492, 512);
        ctx.stroke();

        // Tire wear marks in driving lanes (subtle lighter streaks)
        ctx.strokeStyle = 'rgba(55,55,55,0.15)';
        ctx.lineWidth = 12;
        for (const laneX of [120, 200, 310, 390]) {
            ctx.beginPath();
            ctx.moveTo(laneX, 0);
            ctx.lineTo(laneX + (Math.random() - 0.5) * 4, 512);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(40, 40);
        texture.needsUpdate = true;
        return texture;
    }

    _generateGroundTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Base ground color
        ctx.fillStyle = '#4a4a48';
        ctx.fillRect(0, 0, 256, 256);

        // Concrete panel grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        const panelSize = 32;
        for (let x = 0; x <= 256; x += panelSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 256);
            ctx.stroke();
        }
        for (let y = 0; y <= 256; y += panelSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(256, y);
            ctx.stroke();
        }

        // Per-panel slight color variation
        for (let px = 0; px < 256; px += panelSize) {
            for (let py = 0; py < 256; py += panelSize) {
                const shade = Math.floor(Math.random() * 10) - 5;
                ctx.fillStyle = `rgba(${74 + shade},${74 + shade},${72 + shade},0.15)`;
                ctx.fillRect(px + 1, py + 1, panelSize - 2, panelSize - 2);
            }
        }

        // Dirt patches - brownish splotches
        for (let i = 0; i < 5; i++) {
            const dx = Math.random() * 256;
            const dy = Math.random() * 256;
            const dr = 8 + Math.random() * 20;
            const grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr);
            grad.addColorStop(0, `rgba(80,65,45,${0.1 + Math.random() * 0.1})`);
            grad.addColorStop(1, 'rgba(80,65,45,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(dx - dr, dy - dr, dr * 2, dr * 2);
        }

        // Wear marks - lighter areas
        for (let i = 0; i < 3; i++) {
            const wx = Math.random() * 256;
            const wy = Math.random() * 256;
            const wr = 10 + Math.random() * 25;
            const grad = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
            grad.addColorStop(0, `rgba(120,120,115,${0.06 + Math.random() * 0.06})`);
            grad.addColorStop(1, 'rgba(120,120,115,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(wx - wr, wy - wr, wr * 2, wr * 2);
        }

        // Fine noise/grain
        for (let i = 0; i < 1000; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            const shade = 60 + Math.floor(Math.random() * 30);
            ctx.fillStyle = `rgba(${shade},${shade},${shade},0.08)`;
            ctx.fillRect(x, y, 1, 1);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(80, 80);
        texture.needsUpdate = true;
        return texture;
    }

    _generateSidewalkTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Base pavement color
        ctx.fillStyle = '#5a5a58';
        ctx.fillRect(0, 0, 256, 256);

        // Sidewalk slab grid
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1.5;
        const slabSize = 42;
        for (let x = 0; x <= 256; x += slabSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 256);
            ctx.stroke();
        }
        for (let y = 0; y <= 256; y += slabSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(256, y);
            ctx.stroke();
        }

        // Per-slab variation
        for (let px = 0; px < 256; px += slabSize) {
            for (let py = 0; py < 256; py += slabSize) {
                const shade = Math.floor(Math.random() * 12) - 6;
                ctx.fillStyle = `rgba(${90 + shade},${90 + shade},${88 + shade},0.12)`;
                ctx.fillRect(px + 2, py + 2, slabSize - 4, slabSize - 4);
            }
        }

        // Gum spots (tiny dark circles)
        for (let i = 0; i < 8; i++) {
            const gx = Math.random() * 256;
            const gy = Math.random() * 256;
            ctx.beginPath();
            ctx.arc(gx, gy, 1 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(30,25,20,${0.15 + Math.random() * 0.1})`;
            ctx.fill();
        }

        // Scuff marks
        for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = `rgba(40,35,30,${0.06 + Math.random() * 0.06})`;
            ctx.lineWidth = 2 + Math.random() * 3;
            ctx.beginPath();
            const sx = Math.random() * 256;
            const sy = Math.random() * 256;
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + (Math.random() - 0.5) * 40, sy + (Math.random() - 0.5) * 20);
            ctx.stroke();
        }

        // === DRAIN GRATE (one per tile, positioned near edge) ===
        const drainX = 200 + Math.random() * 30;
        const drainY = 20 + Math.random() * 30;
        const drainW = 22, drainH = 10;
        // Dark rectangle base
        ctx.fillStyle = 'rgba(15,12,10,0.6)';
        ctx.fillRect(drainX, drainY, drainW, drainH);
        // Crosshatch interior
        ctx.strokeStyle = 'rgba(40,35,30,0.8)';
        ctx.lineWidth = 1;
        for (let dx = 0; dx < drainW; dx += 4) {
            ctx.beginPath();
            ctx.moveTo(drainX + dx, drainY);
            ctx.lineTo(drainX + dx, drainY + drainH);
            ctx.stroke();
        }
        // Border
        ctx.strokeStyle = 'rgba(80,75,70,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(drainX - 0.5, drainY - 0.5, drainW + 1, drainH + 1);

        // === MANHOLE COVER (one per tile, center area) ===
        const mhX = 110 + Math.random() * 40;
        const mhY = 120 + Math.random() * 40;
        const mhR = 10;
        // Circle base
        ctx.fillStyle = 'rgba(55,52,48,0.5)';
        ctx.beginPath();
        ctx.arc(mhX, mhY, mhR, 0, Math.PI * 2);
        ctx.fill();
        // Cross pattern
        ctx.strokeStyle = 'rgba(40,38,35,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mhX - mhR + 2, mhY);
        ctx.lineTo(mhX + mhR - 2, mhY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mhX, mhY - mhR + 2);
        ctx.lineTo(mhX, mhY + mhR - 2);
        ctx.stroke();
        // Outer ring
        ctx.strokeStyle = 'rgba(70,65,60,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(mhX, mhY, mhR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(mhX, mhY, mhR - 2, 0, Math.PI * 2);
        ctx.stroke();

        // === CURB COLOR ZONES ===
        // Red curb section (no parking) — thin red strip at one edge
        if (Math.random() < 0.3) {
            ctx.fillStyle = 'rgba(180,40,30,0.25)';
            ctx.fillRect(0, 0, 256, 4);
        }
        // Yellow loading zone — thin yellow strip
        if (Math.random() < 0.2) {
            ctx.fillStyle = 'rgba(200,180,40,0.2)';
            ctx.fillRect(0, 252, 256, 4);
        }

        // Fine noise
        for (let i = 0; i < 800; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            const shade = 70 + Math.floor(Math.random() * 30);
            ctx.fillStyle = `rgba(${shade},${shade},${shade},0.06)`;
            ctx.fillRect(x, y, 1, 1);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(80, 80);
        texture.needsUpdate = true;
        return texture;
    }

    init() {
        // Pre-generate shared procedural textures
        this._roadTexture = this._generateRoadTexture();
        this._groundTexture = this._generateGroundTexture();
        this._sidewalkTexture = this._generateSidewalkTexture();
        this._buildingTextures = {};
        for (const [key, district] of Object.entries(this.districts)) {
            const avgColor = this._averageColor(district.colors);
            this._buildingTextures[key] = this._generateBuildingTexture(256, 512, avgColor, key);
        }

        this.createGround();
        this.createWater();
        this.createCoastline();
        this.createRoads();
        this.createDiagonalRoads();
        this.createBuildings();
        this.createShopSigns();
        this.createLandmarks();
        this.createProps();
        this.createStuntRamps();
        this.createNeonSigns();
        this.createGraffiti();
        this.createTrafficLights();
        this.createPhysicsColliders();
        this.initLightPool();
        this.createEasterEggs();
        this.createRainSystem();
        this.createHiddenPackages();
        this._createAmbientWildlife();
    }

    createGround() {
        // Subdivided ground plane for terrain elevation
        const segs = 160; // 160x160 = 25600 verts, ~5m resolution on 800x800 map
        const geo = new THREE.PlaneGeometry(this.mapSize, this.mapSize, segs, segs);
        geo.rotateX(-Math.PI / 2);

        // Displace Y vertices using getTerrainHeight
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            pos.setY(i, this.getTerrainHeight(x, z));
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            color: 0x4a4a48,
            roughness: 0.88,
            metalness: 0.0,
            map: this._groundTexture
        });
        const ground = new THREE.Mesh(geo, mat);
        ground.receiveShadow = true;
        this.game.scene.add(ground);
        this.groundMesh = ground;

        // Pavement layer follows terrain (slightly above)
        const pavGeo = new THREE.PlaneGeometry(this.mapSize, this.mapSize, segs, segs);
        pavGeo.rotateX(-Math.PI / 2);
        const pavPos = pavGeo.attributes.position;
        for (let i = 0; i < pavPos.count; i++) {
            const x = pavPos.getX(i);
            const z = pavPos.getZ(i);
            pavPos.setY(i, this.getTerrainHeight(x, z) + 0.005);
        }
        pavPos.needsUpdate = true;
        pavGeo.computeVertexNormals();

        const pavMat = new THREE.MeshStandardMaterial({
            color: 0x5a5a58,
            roughness: 0.9,
            metalness: 0.0,
            map: this._sidewalkTexture
        });
        const pavement = new THREE.Mesh(pavGeo, pavMat);
        pavement.receiveShadow = true;
        this.game.scene.add(pavement);
    }

    _generateWaterTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Deep blue base
        ctx.fillStyle = '#1a3555';
        ctx.fillRect(0, 0, 256, 256);

        // Caustic network — bright curved lines
        ctx.strokeStyle = 'rgba(120,180,220,0.3)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 30; i++) {
            ctx.beginPath();
            const sx = Math.random() * 256;
            const sy = Math.random() * 256;
            ctx.moveTo(sx, sy);
            const segs = 3 + Math.floor(Math.random() * 4);
            for (let s = 0; s < segs; s++) {
                ctx.bezierCurveTo(
                    sx + (Math.random() - 0.5) * 80, sy + (Math.random() - 0.5) * 80,
                    sx + (Math.random() - 0.5) * 100, sy + (Math.random() - 0.5) * 100,
                    sx + (Math.random() - 0.5) * 120, sy + (Math.random() - 0.5) * 120
                );
            }
            ctx.stroke();
        }

        // Bright highlights (where caustics converge)
        for (let i = 0; i < 15; i++) {
            const hx = Math.random() * 256, hy = Math.random() * 256;
            const hr = 3 + Math.random() * 8;
            const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
            grad.addColorStop(0, 'rgba(150,200,240,0.2)');
            grad.addColorStop(1, 'rgba(150,200,240,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
        }

        // Subtle foam/surface noise
        for (let i = 0; i < 500; i++) {
            ctx.fillStyle = `rgba(180,210,230,${0.03 + Math.random() * 0.04})`;
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random(), 1 + Math.random());
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(20, 20);
        texture.needsUpdate = true;
        return texture;
    }

    createWater() {
        // Large ocean plane surrounding the entire map
        const waterGeo = new THREE.PlaneGeometry(2000, 2000, 32, 32);
        const waterTexture = this._generateWaterTexture();
        this._waterTexture = waterTexture;
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x1a5588,
            map: waterTexture,
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
        // Sand/beach strip ring around map edges — sloping from terrain to water
        const sandMat = new THREE.MeshStandardMaterial({
            color: 0xccbb88, roughness: 0.9, metalness: 0.0
        });
        const beachWidth = 15;
        const h = this.halfMap;
        const sandGeoms = [];
        const beachSegs = 40;

        // Helper to create a sloping beach strip
        const makeBeach = (isNS, sign) => {
            const w = isNS ? this.mapSize + beachWidth * 2 : beachWidth;
            const d = isNS ? beachWidth : this.mapSize;
            const segsW = isNS ? beachSegs : 4;
            const segsD = isNS ? 4 : beachSegs;
            const geo = new THREE.PlaneGeometry(w, d, segsW, segsD);
            geo.rotateX(-Math.PI / 2);
            const tx = isNS ? 0 : sign * (h + beachWidth / 2);
            const tz = isNS ? sign * (h + beachWidth / 2) : 0;
            geo.translate(tx, 0, tz);

            // Slope: inner edge = terrain height, outer edge = water level (-0.5)
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const z = pos.getZ(i);
                // How far from map edge toward water (0 = inner edge, 1 = outer edge)
                let t;
                if (isNS) {
                    t = sign > 0
                        ? Math.max(0, Math.min(1, (z - h) / beachWidth))
                        : Math.max(0, Math.min(1, (-h - z) / beachWidth));
                } else {
                    t = sign > 0
                        ? Math.max(0, Math.min(1, (x - h) / beachWidth))
                        : Math.max(0, Math.min(1, (-h - x) / beachWidth));
                }
                const innerH = this.getTerrainHeight(
                    isNS ? x : (sign > 0 ? h : -h),
                    isNS ? (sign > 0 ? h : -h) : z
                );
                const y = innerH * (1 - t) + (-0.3) * t;
                pos.setY(i, Math.max(-0.3, y));
            }
            pos.needsUpdate = true;
            geo.computeVertexNormals();
            return geo;
        };

        sandGeoms.push(makeBeach(true, -1));   // North beach
        sandGeoms.push(makeBeach(true, 1));    // South beach
        sandGeoms.push(makeBeach(false, -1));  // West beach
        sandGeoms.push(makeBeach(false, 1));   // East beach

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
            this._collectRoadGeoms(rx, 'z', roadGeoms, dashGeoms, rotMatrix);
        }
        // Horizontal roads (along X axis)
        for (let rz = -this.halfMap; rz <= this.halfMap; rz += this.blockSize) {
            this._collectRoadGeoms(rz, 'x', roadGeoms, dashGeoms, rotMatrix);
        }

        // Crosswalks: generated per-intersection to avoid overlapping grid patterns.
        // Each intersection gets crosswalks on 2 approaches (N/S or E/W alternating
        // would still overlap; instead place on all 4 sides offset from center).
        this._generateCrosswalks(crosswalkGeoms, rotMatrix);

        // Merge and create single meshes
        if (roadGeoms.length > 0) {
            const mergedRoad = safeMerge(roadGeoms);
            this.roadMat = new THREE.MeshStandardMaterial({
                color: 0x2a2a2a, roughness: 0.82, metalness: 0.05,
                map: this._roadTexture
            });
            const roadMesh = new THREE.Mesh(mergedRoad, this.roadMat);
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

    _collectRoadGeoms(pos, axis, roadGeoms, dashGeoms, rotMatrix) {
        const length = this.mapSize;
        const width = this.roadWidth;
        const segsAlong = 40; // subdivisions along road length for terrain following

        // Road surface — subdivided to follow terrain elevation
        const roadGeo = axis === 'z'
            ? new THREE.PlaneGeometry(width, length, 1, segsAlong)
            : new THREE.PlaneGeometry(length, width, segsAlong, 1);
        roadGeo.applyMatrix4(rotMatrix);
        const translateRoad = new THREE.Matrix4();
        if (axis === 'z') {
            translateRoad.makeTranslation(pos, 0.01, 0);
        } else {
            translateRoad.makeTranslation(0, 0.01, pos);
        }
        roadGeo.applyMatrix4(translateRoad);
        // Apply terrain height to road vertices
        this._applyTerrainToGeo(roadGeo, 0.01);
        roadGeoms.push(roadGeo);

        // Center dashes
        const dashLength = 3;
        const dashSpacing = 12;
        for (let d = -this.halfMap; d < this.halfMap; d += dashSpacing) {
            const dashGeo = axis === 'z'
                ? new THREE.PlaneGeometry(0.15, dashLength)
                : new THREE.PlaneGeometry(dashLength, 0.15);
            dashGeo.applyMatrix4(rotMatrix);
            const dx = axis === 'z' ? pos : d;
            const dz = axis === 'z' ? d : pos;
            const dy = this.getTerrainHeight(dx, dz) + 0.02;
            const t = new THREE.Matrix4();
            t.makeTranslation(dx, dy, dz);
            dashGeo.applyMatrix4(t);
            dashGeoms.push(dashGeo);
        }
    }

    // Generate crosswalks at intersections as proper zebra stripes.
    // Places stripe groups on each of the 4 approach sides of every intersection,
    // offset so they don't overlap in the center.
    _generateCrosswalks(crosswalkGeoms, rotMatrix) {
        const hw = this.roadWidth / 2;
        const stripeCount = 6;   // number of stripes per crosswalk
        const stripeGap = 0.8;   // gap between stripes
        const stripeWidth = 0.5; // width of each stripe along the crossing direction
        const stripeLen = this.roadWidth * 0.8; // length spanning across the road
        // Offset from intersection center to first stripe center
        const groupStart = hw + 1.0;

        for (let ix = -this.halfMap; ix <= this.halfMap; ix += this.blockSize) {
            for (let iz = -this.halfMap; iz <= this.halfMap; iz += this.blockSize) {
                const iy = this.getTerrainHeight(ix, iz) + 0.025;
                // North approach (stripes span in X, stacked along -Z from intersection)
                for (let s = 0; s < stripeCount; s++) {
                    const cwGeo = new THREE.PlaneGeometry(stripeLen, stripeWidth);
                    cwGeo.applyMatrix4(rotMatrix);
                    const t = new THREE.Matrix4();
                    t.makeTranslation(ix, iy, iz - groupStart - s * (stripeWidth + stripeGap));
                    cwGeo.applyMatrix4(t);
                    crosswalkGeoms.push(cwGeo);
                }
                // South approach (stripes span in X, stacked along +Z)
                for (let s = 0; s < stripeCount; s++) {
                    const cwGeo = new THREE.PlaneGeometry(stripeLen, stripeWidth);
                    cwGeo.applyMatrix4(rotMatrix);
                    const t = new THREE.Matrix4();
                    t.makeTranslation(ix, iy, iz + groupStart + s * (stripeWidth + stripeGap));
                    cwGeo.applyMatrix4(t);
                    crosswalkGeoms.push(cwGeo);
                }
                // West approach (stripes span in Z, stacked along -X)
                for (let s = 0; s < stripeCount; s++) {
                    const cwGeo = new THREE.PlaneGeometry(stripeWidth, stripeLen);
                    cwGeo.applyMatrix4(rotMatrix);
                    const t = new THREE.Matrix4();
                    t.makeTranslation(ix - groupStart - s * (stripeWidth + stripeGap), iy, iz);
                    cwGeo.applyMatrix4(t);
                    crosswalkGeoms.push(cwGeo);
                }
                // East approach (stripes span in Z, stacked along +X)
                for (let s = 0; s < stripeCount; s++) {
                    const cwGeo = new THREE.PlaneGeometry(stripeWidth, stripeLen);
                    cwGeo.applyMatrix4(rotMatrix);
                    const t = new THREE.Matrix4();
                    t.makeTranslation(ix + groupStart + s * (stripeWidth + stripeGap), iy, iz);
                    cwGeo.applyMatrix4(t);
                    crosswalkGeoms.push(cwGeo);
                }
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

            // Road surface (subdivided for terrain)
            const diagSegs = Math.max(4, Math.floor(length / 20));
            const roadGeo = new THREE.PlaneGeometry(this.roadWidth, length, 1, diagSegs);
            roadGeo.applyMatrix4(rotMatrix);
            const t = new THREE.Matrix4().makeRotationY(angle);
            roadGeo.applyMatrix4(t);
            const pos = new THREE.Matrix4().makeTranslation(midX, 0.015, midZ);
            roadGeo.applyMatrix4(pos);
            this._applyTerrainToGeo(roadGeo, 0.015);
            roadGeoms.push(roadGeo);

            // Center dashes
            const dashCount = Math.floor(length / 12);
            for (let d = 0; d < dashCount; d++) {
                const frac = (d + 0.5) / dashCount;
                const cx = diag.x1 + dx * frac;
                const cz = diag.z1 + dz * frac;
                const cy = this.getTerrainHeight(cx, cz) + 0.025;
                const dashGeo = new THREE.PlaneGeometry(0.15, 3);
                dashGeo.applyMatrix4(rotMatrix);
                dashGeo.applyMatrix4(new THREE.Matrix4().makeRotationY(angle));
                dashGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(cx, cy, cz));
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

            const segGeo = new THREE.PlaneGeometry(this.roadWidth * 1.2, segLen + 2, 1, 2);
            segGeo.applyMatrix4(rotMatrix);
            segGeo.applyMatrix4(new THREE.Matrix4().makeRotationY(segAngle));
            segGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(segMx, 0.018, segMz));
            this._applyTerrainToGeo(segGeo, 0.018);
            roadGeoms.push(segGeo);
        }

        // Merge and render
        if (roadGeoms.length > 0) {
            const merged = safeMerge(roadGeoms);
            const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({
                color: 0x2a2a2a, roughness: 0.82, metalness: 0.05,
                map: this._roadTexture
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

                // Add vertex color noise for weathering
                const posAttr = merged.attributes.position;
                const normalAttr = merged.attributes.normal;
                const colorArr = new Float32Array(posAttr.count * 3);
                const baseC = new THREE.Color(avgColor);
                for (let vi = 0; vi < posAttr.count; vi++) {
                    let r = baseC.r + (Math.random() - 0.5) * 0.06;
                    let g = baseC.g + (Math.random() - 0.5) * 0.06;
                    let b = baseC.b + (Math.random() - 0.5) * 0.06;
                    // Darken vertices near ground level
                    const vy = posAttr.getY(vi);
                    if (vy < 3) {
                        const grimeFactor = 0.82 + 0.18 * Math.min(1, vy / 3);
                        r *= grimeFactor;
                        g *= grimeFactor;
                        b *= grimeFactor;
                    }
                    // Slightly darken downward-facing vertices
                    if (normalAttr) {
                        const ny = normalAttr.getY(vi);
                        if (ny < 0) {
                            const darkFactor = 1.0 + ny * 0.1;
                            r *= darkFactor;
                            g *= darkFactor;
                            b *= darkFactor;
                        }
                    }
                    colorArr[vi * 3] = Math.max(0, Math.min(1, r));
                    colorArr[vi * 3 + 1] = Math.max(0, Math.min(1, g));
                    colorArr[vi * 3 + 2] = Math.max(0, Math.min(1, b));
                }
                merged.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));

                const bodyMat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    roughness: 0.55,
                    metalness: 0.15,
                    vertexColors: true,
                    map: this._buildingTextures[key]
                });
                const mesh = new THREE.Mesh(merged, bodyMat);
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

        // Landmark exclusion zones — prevent random buildings from overlapping landmarks
        const exclusionZones = [
            { minX: -130, maxX: -70, minZ: -100, maxZ: -60 },   // Claudio Gardens
            { minX: 48, maxX: 72, minZ: -30, maxZ: 30 },        // The Canyon
            { minX: 185, maxX: 215, minZ: -215, maxZ: -185 },   // Claudio Square
        ];

        for (let bx = bounds.minX + this.blockSize / 2; bx < bounds.maxX; bx += this.blockSize) {
            for (let bz = bounds.minZ + this.blockSize / 2; bz < bounds.maxZ; bz += this.blockSize) {
                if (Math.random() > density) continue;

                // Skip if block center falls inside a landmark exclusion zone
                if (exclusionZones.some(z => bx >= z.minX && bx <= z.maxX && bz >= z.minZ && bz <= z.maxZ)) continue;

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

        // Floor-level ledges/cornices (only for taller buildings, max 3)
        if (height > 10) {
            const floorH = 3.5;
            let ledgeCount = 0;
            for (let ly = floorH; ly < height - 2; ly += floorH) {
                if (ledgeCount >= 3) break;
                const ledgeGeo = new THREE.BoxGeometry(width + 0.3, 0.15, depth + 0.3);
                translate.makeTranslation(x, ly + yOffset, z);
                ledgeGeo.applyMatrix4(translate);
                geoms.roofs.push(ledgeGeo); // uses the trim/dark material
                ledgeCount++;
            }
        }

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

        // Water tank (30% chance)
        if (Math.random() < 0.3) {
            const tankX = x + (Math.random() - 0.5) * width * 0.4;
            const tankZ = z + (Math.random() - 0.5) * depth * 0.4;
            // Main tank body (cylinder)
            const tankGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 8);
            translate.makeTranslation(tankX, height + 0.6 + yOffset, tankZ);
            tankGeo.applyMatrix4(translate);
            geoms.ac_units.push(tankGeo);
            // Small chimney/pipe on top
            const pipeGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 4);
            translate.makeTranslation(tankX, height + 1.45 + yOffset, tankZ);
            pipeGeo.applyMatrix4(translate);
            geoms.ac_units.push(pipeGeo);
        }

        // Antenna/pole (20% chance)
        if (Math.random() < 0.2) {
            const antGeo = new THREE.CylinderGeometry(0.03, 0.04, 3, 4);
            translate.makeTranslation(
                x + (Math.random() - 0.5) * width * 0.3,
                height + 1.5 + yOffset,
                z + (Math.random() - 0.5) * depth * 0.3
            );
            antGeo.applyMatrix4(translate);
            geoms.ac_units.push(antGeo);
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

        // Fire escape (25% chance on buildings > 12 units tall)
        if (height > 12 && Math.random() < 0.25) {
            const feSide = Math.random() > 0.5 ? 1 : -1; // left or right side face
            const feX = x + feSide * (width / 2 + 0.08);
            const floorH = 3.5;
            const floors = Math.floor(height / floorH);
            const feWidth = Math.min(2.5, depth * 0.4);

            for (let f = 1; f < floors; f++) {
                const fy = f * floorH + yOffset;
                // Platform
                const platGeo = new THREE.BoxGeometry(0.8, 0.06, feWidth);
                translate.makeTranslation(feX + feSide * 0.4, fy, z);
                platGeo.applyMatrix4(translate);
                geoms.ac_units.push(platGeo);
                // Railing front
                const railGeo = new THREE.BoxGeometry(0.04, 0.7, feWidth);
                translate.makeTranslation(feX + feSide * 0.78, fy + 0.35, z);
                railGeo.applyMatrix4(translate);
                geoms.ac_units.push(railGeo);
                // Ladder between floors (thin box)
                if (f < floors - 1) {
                    const ladderGeo = new THREE.BoxGeometry(0.04, floorH - 0.1, 0.3);
                    const ladderOffZ = (f % 2 === 0) ? feWidth * 0.25 : -feWidth * 0.25;
                    translate.makeTranslation(feX + feSide * 0.4, fy + floorH / 2, z + ladderOffZ);
                    ladderGeo.applyMatrix4(translate);
                    geoms.ac_units.push(ladderGeo);
                }
            }
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

    createShopSigns() {
        // District-specific shop sign text lists
        const signLists = {
            downtown: ['BANK OF SC', 'LAW OFFICES', 'COFFEE', 'NEWSSTAND', 'TAXI CO.', 'PAWN SHOP', 'DELI', 'INSURANCE'],
            strip: ['CASINO', 'NEON LOUNGE', 'TATTOO', '24HR LIQUOR', 'SLOTS', "GENTLEMEN'S", 'KARAOKE', 'COCKTAILS'],
            docks: ['MARINE SUPPLY', 'FRESH FISH', 'UNION HALL', 'COLD STORAGE', 'BAIT & TACKLE', 'CHANDLER', 'CRAB SHACK'],
            industrial: ['AUTO PARTS', 'METAL WORKS', 'WAREHOUSE 7', 'SCRAP YARD', 'WELDING', 'PALLETS', 'TIRE SHOP'],
            hillside: ['ORGANIC MARKET', 'HIKING TRAILS', 'POTTERY', 'YOGA STUDIO', 'BOOKSHOP', 'CAFE', 'FLORIST'],
            northshore: ['SURF SHOP', 'SEAFOOD', 'MOTEL', 'ICE CREAM', 'BEACH RENTAL', 'TIKI BAR', 'SHELLS'],
            westend: ['LAUNDROMAT', 'BARBER', 'CORNER STORE', 'USED CARS', 'DRY CLEANING', 'FLORIST', 'PIZZA'],
            eastgate: ['ELECTRONICS', 'NOODLE HOUSE', 'PHARMACY', 'PRINT SHOP', 'TAILOR', 'TEA ROOM', 'SUSHI'],
            portside: ['IMPORT/EXPORT', 'CUSTOMS', 'HARBOR MASTER', 'DRY DOCK', 'SHIPPING CO.', 'ANCHOR INN']
        };

        // District sign color palettes: { bg, text }
        const signColors = {
            downtown: { bg: '#1a2744', text: '#e8d080' },
            strip: { bg: '#6b1a4a', text: '#ff80d0' },
            docks: { bg: '#2a3a2a', text: '#c0d0b0' },
            industrial: { bg: '#4a3020', text: '#d0c0a0' },
            hillside: { bg: '#2a4a2a', text: '#e0f0d0' },
            northshore: { bg: '#1a3a5a', text: '#a0d8f0' },
            westend: { bg: '#3a2a1a', text: '#e0d0c0' },
            eastgate: { bg: '#4a1a1a', text: '#f0c0a0' },
            portside: { bg: '#1a2a3a', text: '#b0c8d8' }
        };

        // Generate one texture atlas per district (1024x512, 4x8 grid = 32 sign slots)
        const atlasW = 1024, atlasH = 512;
        const cellW = atlasW / 4, cellH = atlasH / 8; // 256x64 per sign
        const signAtlases = {};

        for (const [distKey, texts] of Object.entries(signLists)) {
            const canvas = document.createElement('canvas');
            canvas.width = atlasW;
            canvas.height = atlasH;
            const ctx = canvas.getContext('2d');
            const colors = signColors[distKey] || signColors.downtown;

            // Fill each cell with a sign
            for (let i = 0; i < 32; i++) {
                const col = i % 4;
                const row = Math.floor(i / 4);
                const cx = col * cellW;
                const cy = row * cellH;
                const text = texts[i % texts.length];

                // Background with slight variation
                ctx.fillStyle = colors.bg;
                ctx.fillRect(cx, cy, cellW, cellH);

                // Subtle wear patches
                for (let w = 0; w < 3; w++) {
                    ctx.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.05})`;
                    ctx.fillRect(
                        cx + Math.random() * cellW * 0.8,
                        cy + Math.random() * cellH * 0.6,
                        20 + Math.random() * 40,
                        10 + Math.random() * 20
                    );
                }

                // Faded edges
                const edgeGrad = ctx.createLinearGradient(cx, cy, cx, cy + cellH);
                edgeGrad.addColorStop(0, 'rgba(0,0,0,0.15)');
                edgeGrad.addColorStop(0.15, 'rgba(0,0,0,0)');
                edgeGrad.addColorStop(0.85, 'rgba(0,0,0,0)');
                edgeGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
                ctx.fillStyle = edgeGrad;
                ctx.fillRect(cx, cy, cellW, cellH);

                // Border
                ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                ctx.lineWidth = 1;
                ctx.strokeRect(cx + 2, cy + 2, cellW - 4, cellH - 4);

                // Text
                ctx.font = 'bold 28px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = colors.text;
                ctx.shadowColor = colors.text;
                ctx.shadowBlur = 4;
                ctx.fillText(text, cx + cellW / 2, cy + cellH / 2);
                ctx.fillText(text, cx + cellW / 2, cy + cellH / 2); // Double for brightness
                ctx.shadowBlur = 0;
            }

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            signAtlases[distKey] = texture;
        }

        // Place signs on buildings
        this.shopSigns = [];
        const signGeomsByDistrict = {};

        for (const building of this.buildings) {
            if (building.isWindow) continue;
            if (!building.district) continue;
            if (building.height < 4) continue; // Too short for a sign
            if (Math.random() > 0.6) continue; // 60% of buildings get signs

            const distKey = building.district;
            const texts = signLists[distKey];
            if (!texts) continue;

            if (!signGeomsByDistrict[distKey]) {
                signGeomsByDistrict[distKey] = [];
            }

            // Pick a random sign index for UV mapping
            const signIdx = Math.floor(Math.random() * texts.length);
            const col = signIdx % 4;
            const row = Math.floor(signIdx / 4) % 8;

            // UV coordinates for this sign's atlas cell
            const u0 = col / 4;
            const u1 = (col + 1) / 4;
            const v0 = 1 - (row + 1) / 8; // Flip V
            const v1 = 1 - row / 8;

            // Sign dimensions
            const signW = Math.min(building.width * 0.8, 5);
            const signH = 1.2;

            // Place on front face (positive Z direction from building center)
            const geo = new THREE.PlaneGeometry(signW, signH);
            // Set custom UVs
            const uvAttr = geo.attributes.uv;
            uvAttr.setXY(0, u0, v1); // top-left
            uvAttr.setXY(1, u1, v1); // top-right
            uvAttr.setXY(2, u0, v0); // bottom-left
            uvAttr.setXY(3, u1, v0); // bottom-right
            uvAttr.needsUpdate = true;

            // Position: front face, above door height
            const signY = (building.yOffset || 0) + 3.5;
            const m = new THREE.Matrix4();
            m.makeTranslation(building.x, signY, building.z + building.depth / 2 + 0.05);
            geo.applyMatrix4(m);

            signGeomsByDistrict[distKey].push(geo);

            // Also place on back face for some buildings
            if (Math.random() < 0.3) {
                const geo2 = new THREE.PlaneGeometry(signW, signH);
                geo2.attributes.uv.setXY(0, u0, v1);
                geo2.attributes.uv.setXY(1, u1, v1);
                geo2.attributes.uv.setXY(2, u0, v0);
                geo2.attributes.uv.setXY(3, u1, v0);
                geo2.attributes.uv.needsUpdate = true;
                const m2 = new THREE.Matrix4();
                m2.makeRotationY(Math.PI);
                m2.setPosition(building.x, signY, building.z - building.depth / 2 - 0.05);
                geo2.applyMatrix4(m2);
                signGeomsByDistrict[distKey].push(geo2);
            }
        }

        // Merge and add to scene per district
        for (const [distKey, geos] of Object.entries(signGeomsByDistrict)) {
            if (geos.length === 0) continue;
            const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false);
            if (!merged) {
                for (const g of geos) g.dispose();
                continue;
            }
            const mat = new THREE.MeshStandardMaterial({
                map: signAtlases[distKey],
                emissive: 0xffffff,
                emissiveMap: signAtlases[distKey],
                emissiveIntensity: 0.3,
                roughness: 0.6,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(merged, mat);
            this.game.scene.add(mesh);
            this.shopSigns.push({ mesh, district: distKey, material: mat });
            for (const g of geos) g.dispose();
        }
    }

    _generateLandmarkTexture(name) {
        const canvas = document.createElement('canvas');
        let w = 256, h = 256;
        if (name === 'bridge') { w = 512; h = 128; }
        if (name === 'sign') { w = 256; h = 64; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Base near-white
        ctx.fillStyle = '#f2efe8';
        ctx.fillRect(0, 0, w, h);

        switch (name) {
            case 'city_hall': {
                // Stone block pattern
                ctx.strokeStyle = 'rgba(0,0,0,0.12)';
                ctx.lineWidth = 0.5;
                for (let y = 0; y < h; y += 16) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(w, y);
                    ctx.stroke();
                    const offset = (Math.floor(y / 16) % 2) * 32;
                    for (let x = offset; x < w; x += 64) {
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x, y + 16);
                        ctx.stroke();
                    }
                }
                // Window frames on upper portion
                for (let wx = 40; wx < w - 40; wx += 45) {
                    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(wx, h * 0.2, 20, 35);
                    // Window pane
                    ctx.fillStyle = 'rgba(100,120,140,0.12)';
                    ctx.fillRect(wx + 1, h * 0.2 + 1, 18, 33);
                }
                // "CITY HALL" inscription
                ctx.font = 'bold 14px serif';
                ctx.fillStyle = 'rgba(40,35,30,0.2)';
                ctx.textAlign = 'center';
                ctx.fillText('CITY HALL', w / 2, h * 0.12);
                ctx.textAlign = 'left';
                break;
            }
            case 'clock_tower': {
                // Brick pattern
                ctx.strokeStyle = 'rgba(80,40,20,0.12)';
                ctx.lineWidth = 0.5;
                for (let y = 0; y < h; y += 8) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(w, y);
                    ctx.stroke();
                    const off = (Math.floor(y / 8) % 2) * 12;
                    for (let x = off; x < w; x += 24) {
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x, y + 8);
                        ctx.stroke();
                    }
                }
                // Clock face (large circle with numerals)
                const cx = w / 2, cy = h * 0.3, cr = 30;
                ctx.beginPath();
                ctx.arc(cx, cy, cr, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,240,0.3)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(40,30,20,0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();
                // Roman numerals at 12, 3, 6, 9
                ctx.font = 'bold 8px serif';
                ctx.fillStyle = 'rgba(20,15,10,0.3)';
                ctx.textAlign = 'center';
                ctx.fillText('XII', cx, cy - cr + 10);
                ctx.fillText('III', cx + cr - 6, cy + 3);
                ctx.fillText('VI', cx, cy + cr - 4);
                ctx.fillText('IX', cx - cr + 6, cy + 3);
                // Clock hands
                ctx.strokeStyle = 'rgba(20,15,10,0.3)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx, cy - cr * 0.7);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + cr * 0.5, cy);
                ctx.stroke();
                ctx.textAlign = 'left';
                break;
            }
            case 'stadium': {
                // Concrete panel lines
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 1;
                for (let y = 0; y < h; y += 32) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(w, y);
                    ctx.stroke();
                }
                for (let x = 0; x < w; x += 48) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, h);
                    ctx.stroke();
                }
                // Section numbers
                ctx.font = 'bold 20px Arial';
                ctx.fillStyle = 'rgba(40,40,100,0.15)';
                ctx.textAlign = 'center';
                const sections = ['A', 'B', 'C', 'D'];
                for (let i = 0; i < 4; i++) {
                    ctx.fillText(sections[i], (i + 0.5) * (w / 4), h * 0.5);
                }
                // Entrance gates
                for (let gx = 30; gx < w; gx += 80) {
                    ctx.fillStyle = 'rgba(0,0,0,0.12)';
                    ctx.fillRect(gx, h * 0.7, 25, h * 0.25);
                }
                ctx.textAlign = 'left';
                break;
            }
            case 'bridge': {
                // Steel rivet lines
                ctx.strokeStyle = 'rgba(0,0,0,0.12)';
                ctx.lineWidth = 1;
                for (let y = 10; y < h; y += 20) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(w, y);
                    ctx.stroke();
                    // Rivet dots
                    for (let x = 8; x < w; x += 16) {
                        ctx.beginPath();
                        ctx.arc(x, y, 2, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(60,55,50,0.15)';
                        ctx.fill();
                    }
                }
                // Paint wear at joints
                for (let i = 0; i < 5; i++) {
                    ctx.fillStyle = `rgba(120,80,40,${0.06 + Math.random() * 0.06})`;
                    const jx = Math.random() * w;
                    ctx.fillRect(jx, 0, 15, h);
                }
                // Rust streaks
                for (let i = 0; i < 4; i++) {
                    ctx.strokeStyle = `rgba(140,70,30,${0.08 + Math.random() * 0.06})`;
                    ctx.lineWidth = 2 + Math.random() * 3;
                    const sx = Math.random() * w;
                    ctx.beginPath();
                    ctx.moveTo(sx, Math.random() * h * 0.3);
                    ctx.lineTo(sx + (Math.random() - 0.5) * 10, h);
                    ctx.stroke();
                }
                break;
            }
            case 'statue': {
                // Patina copper streaks
                for (let i = 0; i < 20; i++) {
                    ctx.strokeStyle = `rgba(60,120,100,${0.08 + Math.random() * 0.1})`;
                    ctx.lineWidth = 2 + Math.random() * 4;
                    const sx = Math.random() * w;
                    const sy = Math.random() * h * 0.3;
                    ctx.beginPath();
                    ctx.moveTo(sx, sy);
                    for (let d = 0; d < 50 + Math.random() * 100; d += 8) {
                        ctx.lineTo(sx + (Math.random() - 0.5) * 6, sy + d);
                    }
                    ctx.stroke();
                }
                // Robe fold shadows (dark lines)
                for (let i = 0; i < 8; i++) {
                    ctx.strokeStyle = 'rgba(30,50,40,0.1)';
                    ctx.lineWidth = 2;
                    const fx = 30 + Math.random() * (w - 60);
                    ctx.beginPath();
                    ctx.moveTo(fx, h * 0.3);
                    ctx.bezierCurveTo(fx + 10, h * 0.5, fx - 10, h * 0.7, fx + 5, h * 0.9);
                    ctx.stroke();
                }
                break;
            }
            case 'sign': {
                // Hollywood-style light bulb dots
                ctx.fillStyle = 'rgba(255,240,200,0.25)';
                for (let x = 5; x < w; x += 8) {
                    for (let y = 5; y < h; y += 12) {
                        ctx.beginPath();
                        ctx.arc(x, y, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                // Rust / paint wear
                for (let i = 0; i < 6; i++) {
                    ctx.fillStyle = `rgba(120,70,30,${0.08 + Math.random() * 0.08})`;
                    ctx.fillRect(Math.random() * w, Math.random() * h, 10 + Math.random() * 20, 5 + Math.random() * 10);
                }
                // Structural beams behind
                ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                ctx.lineWidth = 3;
                for (let x = 20; x < w; x += 40) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, h);
                    ctx.stroke();
                }
                break;
            }
            default: break;
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;
        return texture;
    }

    createLandmarks() {
        // Helper: bake position/rotation into geometry
        const bakeTransform = (geo, px, py, pz, ry, rx, rz) => {
            const m = new THREE.Matrix4();
            const euler = new THREE.Euler(rx || 0, ry || 0, rz || 0);
            m.makeRotationFromEuler(euler);
            m.setPosition(px || 0, py || 0, pz || 0);
            geo.applyMatrix4(m);
            return geo;
        };

        // City Hall at Downtown center — merge into 2 materials
        {
            const gx = 0, gz = -30; // group position
            const mat = new THREE.MeshStandardMaterial({ color: 0xddddcc, roughness: 0.5, metalness: 0.1, map: this._generateLandmarkTexture('city_hall') });
            const colMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4, metalness: 0.1 });
            const matGeoms = [];
            const colGeoms = [];

            // Main building
            const bodyGeo = new THREE.BoxGeometry(20, 12, 15);
            bakeTransform(bodyGeo, gx, 6, gz);
            matGeoms.push(bodyGeo);

            // Columns (6 across front)
            for (let i = 0; i < 6; i++) {
                const colGeo = new THREE.CylinderGeometry(0.4, 0.5, 10, 8);
                bakeTransform(colGeo, gx + (-7.5 + i * 3), 5, gz + 8);
                colGeoms.push(colGeo);
            }

            // Pediment (triangular roof)
            const pedShape = new THREE.Shape();
            pedShape.moveTo(-10.5, 0);
            pedShape.lineTo(0, 4);
            pedShape.lineTo(10.5, 0);
            pedShape.lineTo(-10.5, 0);
            const pedGeo = new THREE.ExtrudeGeometry(pedShape, { steps: 1, depth: 1, bevelEnabled: false });
            bakeTransform(pedGeo, gx, 12, gz + 7.5);
            matGeoms.push(pedGeo);

            // Steps
            for (let s = 0; s < 4; s++) {
                const stepGeo = new THREE.BoxGeometry(22 - s * 0.5, 0.3, 1);
                bakeTransform(stepGeo, gx, s * 0.3, gz + 8.5 + s * 0.5);
                colGeoms.push(stepGeo);
            }

            if (matGeoms.length > 0) {
                const m = safeMerge(matGeoms);
                const mesh = new THREE.Mesh(m, mat);
                mesh.castShadow = true;
                this.game.scene.add(mesh);
                for (const g of matGeoms) g.dispose();
            }
            if (colGeoms.length > 0) {
                const m = safeMerge(colGeoms);
                const mesh = new THREE.Mesh(m, colMat);
                mesh.castShadow = true;
                this.game.scene.add(mesh);
                for (const g of colGeoms) g.dispose();
            }
            this.colliders.push({ type: 'building', minX: -10, maxX: 10, minZ: -45, maxZ: -22.5, height: 16 });
        }

        // Clock Tower at Downtown center — merge into 2 materials
        {
            const gx = 20, gz = 20;
            const mat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.6, metalness: 0.15, map: this._generateLandmarkTexture('clock_tower') });
            const clockMat = new THREE.MeshStandardMaterial({ color: 0xfffff0, roughness: 0.3 });
            const matGeoms = [];
            const clockGeoms = [];

            // Base
            const baseGeo = new THREE.BoxGeometry(5, 20, 5);
            bakeTransform(baseGeo, gx, 10, gz);
            matGeoms.push(baseGeo);

            // Clock faces (4 sides)
            for (let i = 0; i < 4; i++) {
                const clockGeo = new THREE.CircleGeometry(1.5, 16);
                const angle = (i / 4) * Math.PI * 2;
                bakeTransform(clockGeo,
                    gx + Math.sin(angle) * 2.55, 18,
                    gz + Math.cos(angle) * 2.55, angle);
                clockGeoms.push(clockGeo);
            }

            // Pointed top
            const topGeo = new THREE.ConeGeometry(3, 6, 4);
            bakeTransform(topGeo, gx, 24, gz, Math.PI / 4);
            matGeoms.push(topGeo);

            if (matGeoms.length > 0) {
                const m = safeMerge(matGeoms);
                const mesh = new THREE.Mesh(m, mat);
                mesh.castShadow = true;
                this.game.scene.add(mesh);
                for (const g of matGeoms) g.dispose();
            }
            if (clockGeoms.length > 0) {
                const m = safeMerge(clockGeoms);
                const mesh = new THREE.Mesh(m, clockMat);
                this.game.scene.add(mesh);
                for (const g of clockGeoms) g.dispose();
            }
            this.colliders.push({ type: 'building', minX: 17.5, maxX: 22.5, minZ: 17.5, maxZ: 22.5, height: 27 });
        }

        // Stadium at Eastgate — merge into 2 materials
        {
            const gx = 280, gz = 0;
            const mat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.5, metalness: 0.2, map: this._generateLandmarkTexture('stadium') });
            const fieldMat = new THREE.MeshStandardMaterial({ color: 0x338833, roughness: 0.9 });
            const wallGeoms = [];

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
                bakeTransform(wallGeo, gx + mx, 7.5, gz + mz, segAngle);
                wallGeoms.push(wallGeo);
            }

            if (wallGeoms.length > 0) {
                const m = safeMerge(wallGeoms);
                const mesh = new THREE.Mesh(m, mat);
                mesh.castShadow = true;
                this.game.scene.add(mesh);
                for (const g of wallGeoms) g.dispose();
            }

            // Field (green center)
            const fieldGeo = new THREE.CircleGeometry(20, 8);
            fieldGeo.rotateX(-Math.PI / 2);
            bakeTransform(fieldGeo, gx, 0.1, gz);
            const field = new THREE.Mesh(fieldGeo, fieldMat);
            field.receiveShadow = true;
            this.game.scene.add(field);

            this.colliders.push({ type: 'building', minX: 255, maxX: 305, minZ: -25, maxZ: 25, height: 15 });
        }

        // Bridge from Portside to Docks — merge by material
        {
            const gx = -120, gz = 260, gry = Math.PI * 0.3;
            const groupMat = new THREE.Matrix4();
            groupMat.makeRotationY(gry);
            groupMat.setPosition(gx, 0, gz);

            const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.6, metalness: 0.3, map: this._generateLandmarkTexture('bridge') });
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.7, metalness: 0.2 });
            const cableMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.4, metalness: 0.5 });
            const bridgeGeoms = [];
            const pillarGeoms = [];
            const cableGeoms = [];

            // Road deck
            const deckGeo = new THREE.BoxGeometry(10, 0.5, 80);
            deckGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 4, 0));
            deckGeo.applyMatrix4(groupMat);
            bridgeGeoms.push(deckGeo);

            // Support pillars
            for (let p = -30; p <= 30; p += 20) {
                for (const side of [-4, 4]) {
                    const pillarGeo = new THREE.BoxGeometry(1, 5, 1);
                    pillarGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(side, 2, p));
                    pillarGeo.applyMatrix4(groupMat);
                    pillarGeoms.push(pillarGeo);
                }
            }

            // Cable stays
            for (let c = -30; c <= 30; c += 15) {
                for (const side of [-5.5, 5.5]) {
                    const cableGeo = new THREE.CylinderGeometry(0.05, 0.05, 10, 4);
                    const childMat = new THREE.Matrix4();
                    childMat.makeRotationZ(side > 0 ? 0.4 : -0.4);
                    childMat.setPosition(side, 7, c);
                    cableGeo.applyMatrix4(childMat);
                    cableGeo.applyMatrix4(groupMat);
                    cableGeoms.push(cableGeo);
                }
            }

            // Railing posts
            for (let r = -40; r <= 40; r += 3) {
                for (const side of [-5, 5]) {
                    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 4);
                    postGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(side, 5, r));
                    postGeo.applyMatrix4(groupMat);
                    bridgeGeoms.push(postGeo);
                }
            }

            if (bridgeGeoms.length > 0) {
                const m = safeMerge(bridgeGeoms);
                const mesh = new THREE.Mesh(m, bridgeMat);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.game.scene.add(mesh);
                for (const g of bridgeGeoms) g.dispose();
            }
            if (pillarGeoms.length > 0) {
                const m = safeMerge(pillarGeoms);
                const mesh = new THREE.Mesh(m, pillarMat);
                mesh.castShadow = true;
                this.game.scene.add(mesh);
                for (const g of pillarGeoms) g.dispose();
            }
            if (cableGeoms.length > 0) {
                const m = safeMerge(cableGeoms);
                const mesh = new THREE.Mesh(m, cableMat);
                this.game.scene.add(mesh);
                for (const g of cableGeoms) g.dispose();
            }
        }

        // ─── Claudio Square (Times Square) — The Strip ───
        {
            const gx = 200, gz = -200;
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7, metalness: 0.4 });
            const panelMat1 = new THREE.MeshStandardMaterial({ color: 0xff2266, emissive: 0xff2266, emissiveIntensity: 0.6, roughness: 0.3 });
            const panelMat2 = new THREE.MeshStandardMaterial({ color: 0x22aaff, emissive: 0x22aaff, emissiveIntensity: 0.6, roughness: 0.3 });
            const panelMat3 = new THREE.MeshStandardMaterial({ color: 0xffee00, emissive: 0xffee00, emissiveIntensity: 0.6, roughness: 0.3 });
            const frameGeoms = [];
            const p1Geoms = [];
            const p2Geoms = [];
            const p3Geoms = [];

            // Billboard structures — 4 angled frames with glowing panels
            const billboards = [
                { x: -8, z: -8, ry: 0.3, h: 25, pw: 7, ph: 10, panels: p1Geoms },
                { x: 9, z: -5, ry: -0.4, h: 20, pw: 6, ph: 8, panels: p2Geoms },
                { x: -5, z: 8, ry: 0.6, h: 22, pw: 8, ph: 7, panels: p3Geoms },
                { x: 7, z: 7, ry: -0.2, h: 18, pw: 5, ph: 9, panels: p1Geoms },
            ];

            for (const bb of billboards) {
                // Frame pole
                const poleGeo = new THREE.BoxGeometry(1.2, bb.h, 1.2);
                bakeTransform(poleGeo, gx + bb.x, bb.h / 2, gz + bb.z, bb.ry);
                frameGeoms.push(poleGeo);
                // Panel face
                const panelGeo = new THREE.BoxGeometry(bb.pw, bb.ph, 0.3);
                bakeTransform(panelGeo, gx + bb.x, bb.h - bb.ph / 2 - 1, gz + bb.z + 0.8, bb.ry);
                bb.panels.push(panelGeo);
            }

            // Marquee base structure
            const marqueeGeo = new THREE.BoxGeometry(12, 3, 12);
            bakeTransform(marqueeGeo, gx, 1.5, gz);
            frameGeoms.push(marqueeGeo);

            // Neon accent strips
            for (let i = 0; i < 3; i++) {
                const stripGeo = new THREE.BoxGeometry(0.2, 0.2, 14);
                bakeTransform(stripGeo, gx - 5 + i * 5, 3.2, gz);
                p2Geoms.push(stripGeo);
            }

            const fmesh = new THREE.Mesh(safeMerge(frameGeoms), frameMat);
            fmesh.castShadow = true;
            this.game.scene.add(fmesh);
            for (const g of frameGeoms) g.dispose();

            if (p1Geoms.length > 0) { const m = new THREE.Mesh(safeMerge(p1Geoms), panelMat1); this.game.scene.add(m); for (const g of p1Geoms) g.dispose(); }
            if (p2Geoms.length > 0) { const m = new THREE.Mesh(safeMerge(p2Geoms), panelMat2); this.game.scene.add(m); for (const g of p2Geoms) g.dispose(); }
            if (p3Geoms.length > 0) { const m = new THREE.Mesh(safeMerge(p3Geoms), panelMat3); this.game.scene.add(m); for (const g of p3Geoms) g.dispose(); }

            this.colliders.push({ type: 'building', minX: gx - 15, maxX: gx + 15, minZ: gz - 15, maxZ: gz + 15, height: 25 });
        }

        // ─── Lady Claudio (Statue of Liberty) — Offshore near The Docks ───
        {
            const gx = -350, gz = 280;
            const statueMat = new THREE.MeshStandardMaterial({ color: 0x6b8e6b, roughness: 0.6, metalness: 0.3, map: this._generateLandmarkTexture('statue') });
            const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x999988, roughness: 0.7, metalness: 0.1 });
            const islandMat = new THREE.MeshStandardMaterial({ color: 0xccbb88, roughness: 0.9 });
            const torchMat = new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0xffaa00, emissiveIntensity: 0.8, roughness: 0.3 });
            const statueGeoms = [];
            const pedGeoms = [];
            const islandGeoms = [];
            const torchGeoms = [];

            // Island base (flattened cylinder)
            const islandGeo = new THREE.CylinderGeometry(20, 22, 2, 12);
            bakeTransform(islandGeo, gx, 0.5, gz);
            islandGeoms.push(islandGeo);

            // Rectangular pedestal
            const pedGeo = new THREE.BoxGeometry(8, 8, 8);
            bakeTransform(pedGeo, gx, 5.5, gz);
            pedGeoms.push(pedGeo);
            // Pedestal base (wider)
            const pedBase = new THREE.BoxGeometry(10, 2, 10);
            bakeTransform(pedBase, gx, 1.5, gz);
            pedGeoms.push(pedBase);

            // Statue body (tapered cylinder)
            const bodyGeo = new THREE.CylinderGeometry(1.5, 2.5, 12, 8);
            bakeTransform(bodyGeo, gx, 15.5, gz);
            statueGeoms.push(bodyGeo);

            // Head
            const headGeo = new THREE.SphereGeometry(1.2, 8, 6);
            bakeTransform(headGeo, gx, 22.5, gz);
            statueGeoms.push(headGeo);

            // Crown (small ring of spikes)
            for (let i = 0; i < 7; i++) {
                const spikeGeo = new THREE.ConeGeometry(0.15, 1.2, 4);
                const angle = (i / 7) * Math.PI * 2;
                bakeTransform(spikeGeo, gx + Math.sin(angle) * 1.1, 24, gz + Math.cos(angle) * 1.1);
                statueGeoms.push(spikeGeo);
            }

            // Raised right arm with torch
            const armGeo = new THREE.CylinderGeometry(0.4, 0.5, 6, 6);
            bakeTransform(armGeo, gx + 1.5, 24, gz, 0, 0, -0.3);
            statueGeoms.push(armGeo);

            // Torch flame
            const flameGeo = new THREE.SphereGeometry(0.7, 6, 6);
            bakeTransform(flameGeo, gx + 2.5, 27.5, gz);
            torchGeoms.push(flameGeo);

            // Left arm (holding tablet)
            const lArmGeo = new THREE.BoxGeometry(0.5, 4, 0.8);
            bakeTransform(lArmGeo, gx - 1.8, 18, gz);
            statueGeoms.push(lArmGeo);

            // Tablet
            const tabletGeo = new THREE.BoxGeometry(0.3, 3, 2);
            bakeTransform(tabletGeo, gx - 2.2, 18, gz);
            statueGeoms.push(tabletGeo);

            const smesh = new THREE.Mesh(safeMerge(statueGeoms), statueMat);
            smesh.castShadow = true;
            this.game.scene.add(smesh);
            for (const g of statueGeoms) g.dispose();

            const pmesh = new THREE.Mesh(safeMerge(pedGeoms), pedestalMat);
            pmesh.castShadow = true;
            this.game.scene.add(pmesh);
            for (const g of pedGeoms) g.dispose();

            const imesh = new THREE.Mesh(safeMerge(islandGeoms), islandMat);
            imesh.receiveShadow = true;
            this.game.scene.add(imesh);
            for (const g of islandGeoms) g.dispose();

            const tmesh = new THREE.Mesh(safeMerge(torchGeoms), torchMat);
            this.game.scene.add(tmesh);
            for (const g of torchGeoms) g.dispose();

            this.colliders.push({ type: 'building', minX: gx - 5, maxX: gx + 5, minZ: gz - 5, maxZ: gz + 5, height: 28 });
        }

        // ─── Claudio Gardens (Central Park) — Between Downtown and Hillside ───
        {
            const gx = -100, gz = -80;
            const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.9 });
            const pathMat = new THREE.MeshStandardMaterial({ color: 0xbbbbaa, roughness: 0.8 });
            const stoneMat = new THREE.MeshStandardMaterial({ color: 0xccccbb, roughness: 0.6, metalness: 0.1 });
            const waterMat = new THREE.MeshStandardMaterial({ color: 0x3388aa, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.8 });
            const wallMat = new THREE.MeshStandardMaterial({ color: 0x887766, roughness: 0.7 });
            const grassGeoms = [];
            const pathGeoms = [];
            const stoneGeoms = [];
            const waterGeoms = [];
            const wallGeoms = [];

            // Main green ground plane
            const lawnGeo = new THREE.BoxGeometry(60, 0.15, 40);
            bakeTransform(lawnGeo, gx, 0.08, gz);
            grassGeoms.push(lawnGeo);

            // Perimeter low wall
            const wallSegments = [
                { x: gx, z: gz - 20, w: 60, d: 0.6 },  // south
                { x: gx, z: gz + 20, w: 60, d: 0.6 },  // north
                { x: gx - 30, z: gz, w: 0.6, d: 40 },   // west
                { x: gx + 30, z: gz, w: 0.6, d: 40 },   // east
            ];
            for (const ws of wallSegments) {
                const wGeo = new THREE.BoxGeometry(ws.w, 1.2, ws.d);
                bakeTransform(wGeo, ws.x, 0.6, ws.z);
                wallGeoms.push(wGeo);
            }

            // Walking paths (cross shape)
            const hPath = new THREE.BoxGeometry(58, 0.05, 3);
            bakeTransform(hPath, gx, 0.18, gz);
            pathGeoms.push(hPath);
            const vPath = new THREE.BoxGeometry(3, 0.05, 38);
            bakeTransform(vPath, gx, 0.18, gz);
            pathGeoms.push(vPath);

            // Central circular fountain basin
            const basinGeo = new THREE.CylinderGeometry(5, 5.5, 1.2, 16);
            bakeTransform(basinGeo, gx, 0.6, gz);
            stoneGeoms.push(basinGeo);

            // Fountain water surface
            const fwGeo = new THREE.CircleGeometry(4.5, 16);
            fwGeo.rotateX(-Math.PI / 2);
            bakeTransform(fwGeo, gx, 1.0, gz);
            waterGeoms.push(fwGeo);

            // Central spout column
            const spoutGeo = new THREE.CylinderGeometry(0.3, 0.4, 3, 8);
            bakeTransform(spoutGeo, gx, 2.5, gz);
            stoneGeoms.push(spoutGeo);

            // Benches along paths (8 total)
            for (let i = -2; i <= 2; i++) {
                if (i === 0) continue;
                const benchGeo = new THREE.BoxGeometry(2, 0.6, 0.8);
                bakeTransform(benchGeo, gx + i * 10, 0.45, gz + 3);
                stoneGeoms.push(benchGeo);
                const benchGeo2 = new THREE.BoxGeometry(2, 0.6, 0.8);
                bakeTransform(benchGeo2, gx + i * 10, 0.45, gz - 3);
                stoneGeoms.push(benchGeo2);
            }

            // Tree clusters (simple cylinders + spheres, not instanced — just a few)
            for (const tp of [[-22, -12], [-22, 12], [22, -12], [22, 12], [-12, -15], [12, 15]]) {
                const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 4, 6);
                bakeTransform(trunkGeo, gx + tp[0], 2, gz + tp[1]);
                wallGeoms.push(trunkGeo); // reuse brown-ish material
                const canopyGeo = new THREE.SphereGeometry(2.5, 6, 5);
                bakeTransform(canopyGeo, gx + tp[0], 5.5, gz + tp[1]);
                grassGeoms.push(canopyGeo); // reuse green material
            }

            const gmesh = new THREE.Mesh(safeMerge(grassGeoms), grassMat);
            gmesh.receiveShadow = true;
            this.game.scene.add(gmesh);
            for (const g of grassGeoms) g.dispose();

            if (pathGeoms.length > 0) { const m = new THREE.Mesh(safeMerge(pathGeoms), pathMat); m.receiveShadow = true; this.game.scene.add(m); for (const g of pathGeoms) g.dispose(); }
            if (stoneGeoms.length > 0) { const m = new THREE.Mesh(safeMerge(stoneGeoms), stoneMat); m.castShadow = true; this.game.scene.add(m); for (const g of stoneGeoms) g.dispose(); }
            if (waterGeoms.length > 0) { const m = new THREE.Mesh(safeMerge(waterGeoms), waterMat); this.game.scene.add(m); for (const g of waterGeoms) g.dispose(); }
            if (wallGeoms.length > 0) { const m = new THREE.Mesh(safeMerge(wallGeoms), wallMat); m.castShadow = true; this.game.scene.add(m); for (const g of wallGeoms) g.dispose(); }

            // Only collide on fountain and walls, not the open park
            this.colliders.push({ type: 'building', minX: gx - 5.5, maxX: gx + 5.5, minZ: gz - 5.5, maxZ: gz + 5.5, height: 4 });
        }

        // ─── The Canyon (Wall Street) — Downtown East ───
        {
            const gx = 60, gz = 0;
            const stoneMat = new THREE.MeshStandardMaterial({ color: 0x666677, roughness: 0.5, metalness: 0.2 });
            const glassMat = new THREE.MeshStandardMaterial({ color: 0x334455, emissive: 0x112233, emissiveIntensity: 0.3, roughness: 0.2, metalness: 0.5 });
            const stoneGeoms = [];
            const glassGeoms = [];

            // Tall narrow buildings flanking both sides of a narrow street
            const buildings = [
                // West row (x < gx)
                { x: -8, z: -20, w: 10, h: 45, d: 12 },
                { x: -9, z: -5, w: 8, h: 38, d: 10 },
                { x: -8, z: 8, w: 10, h: 50, d: 14 },
                { x: -9, z: 22, w: 9, h: 42, d: 10 },
                // East row (x > gx)
                { x: 8, z: -18, w: 10, h: 40, d: 12 },
                { x: 9, z: -3, w: 8, h: 48, d: 10 },
                { x: 8, z: 10, w: 10, h: 35, d: 13 },
                { x: 9, z: 24, w: 9, h: 44, d: 11 },
            ];

            for (const b of buildings) {
                // Main building body
                const bodyGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
                bakeTransform(bodyGeo, gx + b.x, b.h / 2, gz + b.z);
                stoneGeoms.push(bodyGeo);

                // Glass window strips on faces
                const stripH = b.h - 4;
                const stripGeo = new THREE.BoxGeometry(b.w * 0.8, stripH, 0.15);
                bakeTransform(stripGeo, gx + b.x, stripH / 2 + 2, gz + b.z + b.d / 2 + 0.08);
                glassGeoms.push(stripGeo);
                const stripGeo2 = new THREE.BoxGeometry(b.w * 0.8, stripH, 0.15);
                bakeTransform(stripGeo2, gx + b.x, stripH / 2 + 2, gz + b.z - b.d / 2 - 0.08);
                glassGeoms.push(stripGeo2);
            }

            // Ground-level columns at entries
            for (const z of [-25, 25]) {
                for (const side of [-5, 5]) {
                    const colGeo = new THREE.CylinderGeometry(0.3, 0.4, 4, 6);
                    bakeTransform(colGeo, gx + side, 2, gz + z);
                    stoneGeoms.push(colGeo);
                }
            }

            const smesh = new THREE.Mesh(safeMerge(stoneGeoms), stoneMat);
            smesh.castShadow = true;
            this.game.scene.add(smesh);
            for (const g of stoneGeoms) g.dispose();

            const gmesh = new THREE.Mesh(safeMerge(glassGeoms), glassMat);
            this.game.scene.add(gmesh);
            for (const g of glassGeoms) g.dispose();

            // Colliders for each row
            this.colliders.push({ type: 'building', minX: gx - 14, maxX: gx - 3, minZ: gz - 28, maxZ: gz + 28, height: 50 });
            this.colliders.push({ type: 'building', minX: gx + 3, maxX: gx + 14, minZ: gz - 28, maxZ: gz + 28, height: 50 });
        }

        // ─── Dragon Gate (Chinatown) — West End ───
        {
            const gx = -280, gz = 20;
            const redMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.5, metalness: 0.15 });
            const goldMat = new THREE.MeshStandardMaterial({ color: 0xddaa33, roughness: 0.3, metalness: 0.6 });
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x443333, roughness: 0.7, metalness: 0.1 });
            const lanternMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff2200, emissiveIntensity: 0.5, roughness: 0.4 });
            const redGeoms = [];
            const goldGeoms = [];
            const roofGeoms = [];
            const lanternGeoms = [];

            // Two main pillars
            for (const side of [-6, 6]) {
                const pillarGeo = new THREE.BoxGeometry(1.2, 10, 1.2);
                bakeTransform(pillarGeo, gx + side, 5, gz);
                redGeoms.push(pillarGeo);

                // Pillar cap
                const capGeo = new THREE.BoxGeometry(1.8, 0.4, 1.8);
                bakeTransform(capGeo, gx + side, 10.2, gz);
                goldGeoms.push(capGeo);

                // Pillar base
                const baseGeo = new THREE.BoxGeometry(1.8, 0.6, 1.8);
                bakeTransform(baseGeo, gx + side, 0.3, gz);
                goldGeoms.push(baseGeo);
            }

            // Main crossbar
            const crossGeo = new THREE.BoxGeometry(14, 1, 1.5);
            bakeTransform(crossGeo, gx, 9, gz);
            redGeoms.push(crossGeo);

            // Decorative top crossbar
            const topCrossGeo = new THREE.BoxGeometry(15, 0.5, 1.8);
            bakeTransform(topCrossGeo, gx, 10.5, gz);
            goldGeoms.push(topCrossGeo);

            // Curved roof segments (approximated with tilted boxes)
            for (const side of [-1, 1]) {
                const roofGeo = new THREE.BoxGeometry(8, 0.4, 2.5);
                bakeTransform(roofGeo, gx + side * 3.5, 11.2, gz, 0, 0, side * 0.15);
                roofGeoms.push(roofGeo);
            }
            // Roof ridge
            const ridgeGeo = new THREE.BoxGeometry(16, 0.3, 0.8);
            bakeTransform(ridgeGeo, gx, 11.5, gz);
            roofGeoms.push(ridgeGeo);

            // Curved eave tips
            for (const side of [-1, 1]) {
                const eaveGeo = new THREE.ConeGeometry(0.3, 1, 4);
                bakeTransform(eaveGeo, gx + side * 8, 11.5, gz, 0, 0, side * 0.8);
                roofGeoms.push(eaveGeo);
            }

            // Hanging lanterns
            for (const lx of [-4, -1.5, 1.5, 4]) {
                const lanternGeo = new THREE.SphereGeometry(0.4, 6, 6);
                bakeTransform(lanternGeo, gx + lx, 8, gz);
                lanternGeoms.push(lanternGeo);
                // Lantern string
                const stringGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 4);
                bakeTransform(stringGeo, gx + lx, 8.7, gz);
                goldGeoms.push(stringGeo);
            }

            const rmesh = new THREE.Mesh(safeMerge(redGeoms), redMat);
            rmesh.castShadow = true;
            this.game.scene.add(rmesh);
            for (const g of redGeoms) g.dispose();

            if (goldGeoms.length > 0) { const m = new THREE.Mesh(safeMerge(goldGeoms), goldMat); m.castShadow = true; this.game.scene.add(m); for (const g of goldGeoms) g.dispose(); }
            if (roofGeoms.length > 0) { const m = new THREE.Mesh(safeMerge(roofGeoms), roofMat); m.castShadow = true; this.game.scene.add(m); for (const g of roofGeoms) g.dispose(); }
            if (lanternGeoms.length > 0) { const m = new THREE.Mesh(safeMerge(lanternGeoms), lanternMat); this.game.scene.add(m); for (const g of lanternGeoms) g.dispose(); }

            this.colliders.push({ type: 'building', minX: gx - 7, maxX: gx - 5.4, minZ: gz - 0.6, maxZ: gz + 0.6, height: 10 });
            this.colliders.push({ type: 'building', minX: gx + 5.4, maxX: gx + 7, minZ: gz - 0.6, maxZ: gz + 0.6, height: 10 });
        }

        // ─── Claudio Pier (Coney Island) — North Shore ───
        {
            const gx = 0, gz = -370;
            const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8, metalness: 0.05 });
            const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.6 });
            const carMat1 = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.5 });
            const carMat2 = new THREE.MeshStandardMaterial({ color: 0x4444ff, roughness: 0.5 });
            const woodGeoms = [];
            const metalGeoms = [];
            const car1Geoms = [];
            const car2Geoms = [];

            // Main pier deck
            const deckGeo = new THREE.BoxGeometry(15, 0.6, 40);
            bakeTransform(deckGeo, gx, 1.5, gz);
            woodGeoms.push(deckGeo);

            // Pier support pillars
            for (let pz = -18; pz <= 18; pz += 6) {
                for (const side of [-6, 6]) {
                    const pillarGeo = new THREE.CylinderGeometry(0.4, 0.5, 3, 6);
                    bakeTransform(pillarGeo, gx + side, 0.3, gz + pz);
                    woodGeoms.push(pillarGeo);
                }
            }

            // Railing posts
            for (let rz = -19; rz <= 19; rz += 2.5) {
                for (const side of [-7.5, 7.5]) {
                    const postGeo = new THREE.BoxGeometry(0.15, 1.2, 0.15);
                    bakeTransform(postGeo, gx + side, 2.4, gz + rz);
                    woodGeoms.push(postGeo);
                }
            }
            // Railing top rails
            for (const side of [-7.5, 7.5]) {
                const railGeo = new THREE.BoxGeometry(0.1, 0.1, 40);
                bakeTransform(railGeo, gx + side, 3.0, gz);
                woodGeoms.push(railGeo);
            }

            // Ferris wheel — positioned at far end of pier
            const fwX = gx, fwZ = gz - 12, fwR = 10;

            // Central hub
            const hubGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 8);
            bakeTransform(hubGeo, fwX, fwR + 4, fwZ, 0, 0, Math.PI / 2);
            metalGeoms.push(hubGeo);

            // Support legs (A-frame)
            for (const side of [-1, 1]) {
                const legGeo = new THREE.CylinderGeometry(0.3, 0.4, fwR + 3, 6);
                bakeTransform(legGeo, fwX + side * 3, (fwR + 4) / 2, fwZ, 0, 0, side * 0.25);
                metalGeoms.push(legGeo);
            }

            // Spokes (8 radiating from center)
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const spokeGeo = new THREE.CylinderGeometry(0.08, 0.08, fwR, 4);
                const mx = Math.cos(angle) * fwR / 2;
                const my = Math.sin(angle) * fwR / 2;
                bakeTransform(spokeGeo, fwX, fwR + 4 + my, fwZ + mx, Math.atan2(mx, my));
                metalGeoms.push(spokeGeo);
            }

            // Rim segments (octagonal ring)
            for (let i = 0; i < 16; i++) {
                const a1 = (i / 16) * Math.PI * 2;
                const a2 = ((i + 1) / 16) * Math.PI * 2;
                const x1 = Math.cos(a1) * fwR, y1 = Math.sin(a1) * fwR;
                const x2 = Math.cos(a2) * fwR, y2 = Math.sin(a2) * fwR;
                const segLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                const segAngle = Math.atan2(y2 - y1, x2 - x1);
                const rimGeo = new THREE.CylinderGeometry(0.06, 0.06, segLen, 4);
                bakeTransform(rimGeo, fwX, fwR + 4 + (y1 + y2) / 2, fwZ + (x1 + x2) / 2, segAngle);
                metalGeoms.push(rimGeo);
            }

            // Gondola cars at spoke ends (alternating colors)
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const cx = Math.cos(angle) * fwR;
                const cy = Math.sin(angle) * fwR;
                const carGeo = new THREE.SphereGeometry(0.6, 6, 5);
                bakeTransform(carGeo, fwX, fwR + 4 + cy, fwZ + cx);
                (i % 2 === 0 ? car1Geoms : car2Geoms).push(carGeo);
            }

            const wmesh = new THREE.Mesh(safeMerge(woodGeoms), woodMat);
            wmesh.castShadow = true;
            wmesh.receiveShadow = true;
            this.game.scene.add(wmesh);
            for (const g of woodGeoms) g.dispose();

            const mmesh = new THREE.Mesh(safeMerge(metalGeoms), metalMat);
            mmesh.castShadow = true;
            this.game.scene.add(mmesh);
            for (const g of metalGeoms) g.dispose();

            if (car1Geoms.length > 0) { const m = new THREE.Mesh(safeMerge(car1Geoms), carMat1); this.game.scene.add(m); for (const g of car1Geoms) g.dispose(); }
            if (car2Geoms.length > 0) { const m = new THREE.Mesh(safeMerge(car2Geoms), carMat2); this.game.scene.add(m); for (const g of car2Geoms) g.dispose(); }

            this.colliders.push({ type: 'building', minX: gx - 8, maxX: gx + 8, minZ: gz - 20, maxZ: gz + 20, height: 2.4 });
            this.colliders.push({ type: 'building', minX: fwX - 4, maxX: fwX + 4, minZ: fwZ - 1, maxZ: fwZ + 1, height: fwR * 2 + 5 });
        }

        // ─── SAN CLAUDIO Sign (Hollywood Sign) — Hillside ───
        {
            const gx = -220, gz = -250, gy = 3;
            const letterMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1, map: this._generateLandmarkTexture('sign') });
            const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7 });
            const letterGeoms = [];
            const poleGeoms = [];

            const letters = 'SANCLAUDIO';
            const letterWidth = 4;
            const letterHeight = 6;
            const letterDepth = 0.5;
            const spacing = 1.2;
            const totalWidth = letters.length * letterWidth + (letters.length - 1) * spacing;
            const startX = gx - totalWidth / 2 + letterWidth / 2;

            // Add a space gap after 'SAN' (index 3)
            let xOffset = 0;
            for (let i = 0; i < letters.length; i++) {
                if (i === 3) xOffset += letterWidth * 0.6; // space between SAN and CLAUDIO

                const lx = startX + i * (letterWidth + spacing) + xOffset;

                // Letter body
                const letterGeo = new THREE.BoxGeometry(letterWidth, letterHeight, letterDepth);
                bakeTransform(letterGeo, lx, gy + letterHeight / 2 + 2, gz);
                letterGeoms.push(letterGeo);

                // Two support poles per letter
                for (const ps of [-1.2, 1.2]) {
                    const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 2.5, 4);
                    bakeTransform(poleGeo, lx + ps, gy + 1.25, gz);
                    poleGeoms.push(poleGeo);
                }
            }

            const lmesh = new THREE.Mesh(safeMerge(letterGeoms), letterMat);
            lmesh.castShadow = true;
            this.game.scene.add(lmesh);
            for (const g of letterGeoms) g.dispose();

            const pmesh = new THREE.Mesh(safeMerge(poleGeoms), poleMat);
            this.game.scene.add(pmesh);
            for (const g of poleGeoms) g.dispose();

            // Uplights illuminating the sign at night (warm white, aimed upward at letters)
            const numLights = 5;
            const lightSpan = totalWidth + letterWidth * 0.6;
            for (let i = 0; i < numLights; i++) {
                const t = i / (numLights - 1);
                const lx = gx - lightSpan / 2 + t * lightSpan;
                const light = new THREE.PointLight(0xffeedd, 0.8, 20);
                light.position.set(lx, gy + 0.5, gz + 3);
                this.game.scene.add(light);
            }

            this.colliders.push({ type: 'building', minX: gx - totalWidth / 2 - 1, maxX: gx + totalWidth / 2 + 1 + letterWidth * 0.6, minZ: gz - 1, maxZ: gz + 1, height: 10 });
        }

        // ─── Construction Cranes — Urban skyline elements ───
        {
            const craneMat = new THREE.MeshStandardMaterial({ color: 0xddaa22, roughness: 0.5, metalness: 0.3 });
            const cableMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
            const craneGeoms = [];
            const cableGeoms = [];

            const craneConfigs = [
                { x: 80, z: -60, height: 55, jibLength: 25, rot: 0.3 },    // Downtown
                { x: 230, z: 220, height: 40, jibLength: 20, rot: -0.8 },   // Industrial
                { x: -150, z: 150, height: 45, jibLength: 22, rot: 1.5 },   // Near Docks
            ];

            for (const cfg of craneConfigs) {
                const baseY = this.getTerrainHeight(cfg.x, cfg.z);

                // Mast (vertical tower)
                const mastGeo = new THREE.BoxGeometry(1.2, cfg.height, 1.2);
                bakeTransform(mastGeo, cfg.x, baseY + cfg.height / 2, cfg.z);
                craneGeoms.push(mastGeo);

                // Mast lattice cross-braces (visual detail)
                for (let h = 5; h < cfg.height - 2; h += 5) {
                    const braceGeo = new THREE.BoxGeometry(1.6, 0.15, 0.15);
                    bakeTransform(braceGeo, cfg.x, baseY + h, cfg.z, cfg.rot);
                    craneGeoms.push(braceGeo);
                }

                // Jib (horizontal arm) — rotated by cfg.rot
                const jibGeo = new THREE.BoxGeometry(cfg.jibLength, 0.6, 0.6);
                const jibX = cfg.x + Math.sin(cfg.rot) * cfg.jibLength / 2;
                const jibZ = cfg.z + Math.cos(cfg.rot) * cfg.jibLength / 2;
                bakeTransform(jibGeo, jibX, baseY + cfg.height - 0.3, jibZ, cfg.rot);
                craneGeoms.push(jibGeo);

                // Counter-jib (shorter, opposite direction)
                const cjibLen = cfg.jibLength * 0.35;
                const cjibGeo = new THREE.BoxGeometry(cjibLen, 0.6, 0.6);
                const cjibX = cfg.x - Math.sin(cfg.rot) * cjibLen / 2;
                const cjibZ = cfg.z - Math.cos(cfg.rot) * cjibLen / 2;
                bakeTransform(cjibGeo, cjibX, baseY + cfg.height - 0.3, cjibZ, cfg.rot);
                craneGeoms.push(cjibGeo);

                // Counterweight block
                const cwGeo = new THREE.BoxGeometry(2.5, 1.5, 1.5);
                const cwX = cfg.x - Math.sin(cfg.rot) * cjibLen;
                const cwZ = cfg.z - Math.cos(cfg.rot) * cjibLen;
                bakeTransform(cwGeo, cwX, baseY + cfg.height - 1, cwZ);
                craneGeoms.push(cwGeo);

                // Operator cab
                const cabGeo = new THREE.BoxGeometry(1.8, 1.5, 1.8);
                bakeTransform(cabGeo, cfg.x, baseY + cfg.height - 1.5, cfg.z);
                craneGeoms.push(cabGeo);

                // Hanging cable (from jib tip to near ground)
                const cableLen = cfg.height * 0.6;
                const cableGeo = new THREE.CylinderGeometry(0.04, 0.04, cableLen, 4);
                const tipX = cfg.x + Math.sin(cfg.rot) * cfg.jibLength * 0.85;
                const tipZ = cfg.z + Math.cos(cfg.rot) * cfg.jibLength * 0.85;
                bakeTransform(cableGeo, tipX, baseY + cfg.height - cableLen / 2, tipZ);
                cableGeoms.push(cableGeo);

                // Hook at cable end
                const hookGeo = new THREE.BoxGeometry(0.4, 0.3, 0.4);
                bakeTransform(hookGeo, tipX, baseY + cfg.height - cableLen - 0.15, tipZ);
                cableGeoms.push(hookGeo);

                // Collider for mast base
                this.colliders.push({
                    type: 'building',
                    minX: cfg.x - 1, maxX: cfg.x + 1,
                    minZ: cfg.z - 1, maxZ: cfg.z + 1,
                    height: cfg.height + baseY
                });
            }

            if (craneGeoms.length > 0) {
                const craneMesh = new THREE.Mesh(safeMerge(craneGeoms), craneMat);
                craneMesh.castShadow = true;
                this.game.scene.add(craneMesh);
                for (const g of craneGeoms) g.dispose();
            }
            if (cableGeoms.length > 0) {
                const cableMesh = new THREE.Mesh(safeMerge(cableGeoms), cableMat);
                this.game.scene.add(cableMesh);
                for (const g of cableGeoms) g.dispose();
            }
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

        // New street-level props
        const parkingMeterPositions = [];
        const newspaperBoxPositions = [];
        const busStopPositions = [];
        const manholePositions = [];
        const vendorCartPositions = [];
        const pottedPlantPositions = [];
        const awningPositions = [];
        const steamVentPositions = [];

        // Parking meters along downtown and strip streets
        for (const distKey of ['downtown', 'strip']) {
            const dist = this.districts[distKey];
            for (let i = 0; i < 25; i++) {
                const px = dist.bounds.minX + Math.random() * (dist.bounds.maxX - dist.bounds.minX);
                const pz = dist.bounds.minZ + Math.random() * (dist.bounds.maxZ - dist.bounds.minZ);
                if (this.isOnRoad(px) || this.isOnRoad(pz)) {
                    const nearest = Math.round(px / this.blockSize) * this.blockSize;
                    parkingMeterPositions.push({ x: nearest + this.roadWidth / 2 + 2.0, z: pz });
                }
            }
        }

        // Newspaper boxes in downtown and portside
        for (const distKey of ['downtown', 'portside', 'strip']) {
            const dist = this.districts[distKey];
            for (let i = 0; i < 6; i++) {
                const nx = dist.bounds.minX + Math.random() * (dist.bounds.maxX - dist.bounds.minX);
                const nz = dist.bounds.minZ + Math.random() * (dist.bounds.maxZ - dist.bounds.minZ);
                if (this.isOnRoad(nx) || this.isOnRoad(nz)) {
                    const nearest = Math.round(nx / this.blockSize) * this.blockSize;
                    newspaperBoxPositions.push({ x: nearest + this.roadWidth / 2 + 2.5, z: nz });
                }
            }
        }

        // Bus stops along major roads (every 2 blocks in each district)
        for (let x = -this.halfMap + this.blockSize; x < this.halfMap; x += this.blockSize * 2) {
            for (const zOff of [-100, 0, 100]) {
                if (Math.random() < 0.3) {
                    busStopPositions.push({ x: x + this.roadWidth / 2 + 3, z: zOff, rot: 0 });
                }
            }
        }

        // Manholes at intersections (subset)
        for (let x = -this.halfMap; x <= this.halfMap; x += this.blockSize) {
            for (let z = -this.halfMap; z <= this.halfMap; z += this.blockSize) {
                if (Math.random() < 0.25) {
                    manholePositions.push({ x: x + 2, z: z + 2 });
                }
            }
        }

        // Vendor carts on The Strip and Downtown
        for (const distKey of ['strip', 'downtown']) {
            const dist = this.districts[distKey];
            for (let i = 0; i < 5; i++) {
                const vx = dist.bounds.minX + 30 + Math.random() * (dist.bounds.maxX - dist.bounds.minX - 60);
                const vz = dist.bounds.minZ + 30 + Math.random() * (dist.bounds.maxZ - dist.bounds.minZ - 60);
                if (!this.isOnRoad(vx) && !this.isOnRoad(vz)) {
                    vendorCartPositions.push({ x: vx, z: vz, rot: Math.random() * Math.PI * 2 });
                }
            }
        }

        // Potted plants outside shops (near buildings)
        for (const b of this.buildings) {
            if (b.height < 12 && Math.random() < 0.15) {
                pottedPlantPositions.push({ x: b.x + b.width / 2 + 0.5, z: b.z });
                if (Math.random() < 0.5) {
                    pottedPlantPositions.push({ x: b.x - b.width / 2 - 0.5, z: b.z });
                }
            }
        }

        // Awnings on ground-floor shops (short buildings)
        for (const b of this.buildings) {
            if (b.height < 15 && b.height > 4 && Math.random() < 0.3) {
                // Pick a random face
                const face = Math.floor(Math.random() * 4);
                let ax, az, arot;
                if (face === 0) { ax = b.x; az = b.z + b.depth / 2; arot = 0; }
                else if (face === 1) { ax = b.x; az = b.z - b.depth / 2; arot = Math.PI; }
                else if (face === 2) { ax = b.x + b.width / 2; az = b.z; arot = Math.PI / 2; }
                else { ax = b.x - b.width / 2; az = b.z; arot = -Math.PI / 2; }
                awningPositions.push({ x: ax, z: az, rot: arot, w: Math.min(b.width, b.depth, 6) });
            }
        }

        // Steam vents from manholes in industrial and docks
        for (const distKey of ['industrial', 'docks']) {
            const dist = this.districts[distKey];
            for (let i = 0; i < 6; i++) {
                const sx = dist.bounds.minX + Math.random() * (dist.bounds.maxX - dist.bounds.minX);
                const sz = dist.bounds.minZ + Math.random() * (dist.bounds.maxZ - dist.bounds.minZ);
                if (this.isOnRoad(sx) || this.isOnRoad(sz)) {
                    steamVentPositions.push({ x: sx, z: sz });
                }
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

        // New prop instances
        this._createParkingMeterInstances(parkingMeterPositions);
        this._createNewspaperBoxInstances(newspaperBoxPositions);
        this._createBusStopInstances(busStopPositions);
        this._createManholeInstances(manholePositions);
        this._createVendorCartInstances(vendorCartPositions);
        this._createPottedPlantInstances(pottedPlantPositions);
        this._createAwningInstances(awningPositions);
        this._createSteamVents(steamVentPositions);

        // Hedges along sidewalks in residential areas
        const hedgePositions = [];
        for (const distKey of ['westend', 'northshore', 'hillside']) {
            const dist = this.districts[distKey];
            if (!dist) continue;
            for (let i = 0; i < 25; i++) {
                const hx = dist.bounds.minX + Math.random() * (dist.bounds.maxX - dist.bounds.minX);
                const hz = dist.bounds.minZ + Math.random() * (dist.bounds.maxZ - dist.bounds.minZ);
                if (!this.isOnRoad(hx) && !this.isOnRoad(hz)) {
                    hedgePositions.push({ x: hx, z: hz, rot: Math.random() < 0.5 ? 0 : Math.PI / 2 });
                }
            }
        }
        this._createHedgeInstances(hedgePositions);

        // Grass patches in parks and green areas
        const grassPositions = [];
        for (let i = 0; i < 80; i++) {
            const gx = -350 + Math.random() * 700;
            const gz = -350 + Math.random() * 700;
            if (!this.isOnRoad(gx) && !this.isOnRoad(gz)) {
                // Only in non-industrial areas
                const district = this.getDistrictName(gx, gz);
                if (district !== 'Industrial Park' && district !== 'The Docks') {
                    grassPositions.push({ x: gx, z: gz });
                }
            }
        }
        this._createGrassPatchInstances(grassPositions);

        // Flower beds near buildings in residential districts
        const flowerPositions = [];
        for (const b of this.buildings) {
            if (b.height < 10 && Math.random() < 0.08) {
                const district = this.getDistrictName(b.x, b.z);
                if (district === 'West End' || district === 'Hillside' || district === 'North Shore') {
                    flowerPositions.push({ x: b.x + b.width / 2 + 0.3, z: b.z });
                }
            }
        }
        this._createFlowerBedInstances(flowerPositions);

        // District-specific props
        this._createDistrictProps();
    }

    _createDistrictProps() {
        const distProps = {};

        // Helper: spawn N positions in district avoiding roads
        const spawnInDist = (distKey, count) => {
            const d = this.districts[distKey];
            const results = [];
            for (let i = 0; i < count; i++) {
                const x = d.bounds.minX + 15 + Math.random() * (d.bounds.maxX - d.bounds.minX - 30);
                const z = d.bounds.minZ + 15 + Math.random() * (d.bounds.maxZ - d.bounds.minZ - 30);
                if (!this.isOnRoad(x) && !this.isOnRoad(z)) {
                    results.push({ x, z, rot: Math.random() * Math.PI * 2 });
                }
            }
            return results;
        };

        // Helper: spawn on sidewalks near roads
        const spawnOnSidewalk = (distKey, count) => {
            const d = this.districts[distKey];
            const results = [];
            for (let i = 0; i < count; i++) {
                const x = d.bounds.minX + Math.random() * (d.bounds.maxX - d.bounds.minX);
                const z = d.bounds.minZ + Math.random() * (d.bounds.maxZ - d.bounds.minZ);
                if (this.isOnRoad(x) || this.isOnRoad(z)) {
                    const nearest = Math.round(x / this.blockSize) * this.blockSize;
                    results.push({ x: nearest + this.roadWidth / 2 + 2.5, z, rot: Math.random() * Math.PI * 2 });
                }
            }
            return results;
        };

        // ── DOWNTOWN: Urban street furniture ──
        this._createDistrictPropType('sandwichBoard', spawnOnSidewalk('downtown', 15), {
            build: () => {
                const board = new THREE.BoxGeometry(0.6, 0.8, 0.05);
                board.translate(0, 0.7, 0);
                const leg1 = new THREE.BoxGeometry(0.04, 0.7, 0.04);
                leg1.translate(-0.25, 0.35, 0.15);
                const leg2 = new THREE.BoxGeometry(0.04, 0.7, 0.04);
                leg2.translate(0.25, 0.35, 0.15);
                return { geo: safeMerge([board, leg1, leg2]), mat: new THREE.MeshStandardMaterial({ color: 0x996633, roughness: 0.8 }), disposables: [board, leg1, leg2] };
            }
        });

        this._createDistrictPropType('atm', spawnOnSidewalk('downtown', 8), {
            build: () => {
                const body = new THREE.BoxGeometry(0.6, 1.4, 0.4);
                body.translate(0, 0.7, 0);
                const screen = new THREE.BoxGeometry(0.35, 0.25, 0.02);
                screen.translate(0, 1.0, 0.21);
                return { geo: safeMerge([body, screen]), mat: new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.4, metalness: 0.5 }), disposables: [body, screen] };
            }
        });

        this._createDistrictPropType('streetSign', spawnOnSidewalk('downtown', 20), {
            build: () => {
                const pole = new THREE.CylinderGeometry(0.04, 0.04, 3, 4);
                pole.translate(0, 1.5, 0);
                const sign = new THREE.BoxGeometry(0.8, 0.25, 0.03);
                sign.translate(0.2, 3.0, 0);
                return { geo: safeMerge([pole, sign]), mat: new THREE.MeshStandardMaterial({ color: 0x228833, roughness: 0.5 }), disposables: [pole, sign] };
            }
        });

        this._createDistrictPropType('taxiSign', spawnOnSidewalk('downtown', 6), {
            build: () => {
                const post = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 4);
                post.translate(0, 1.25, 0);
                const sign = new THREE.BoxGeometry(0.8, 0.4, 0.08);
                sign.translate(0, 2.6, 0);
                return { geo: safeMerge([post, sign]), mat: new THREE.MeshStandardMaterial({ color: 0xddcc22, roughness: 0.5, emissive: 0x332200, emissiveIntensity: 0.2 }), disposables: [post, sign] };
            }
        });

        // ── THE STRIP: Entertainment props ──
        this._createDistrictPropType('neonPole', spawnOnSidewalk('strip', 20), {
            build: () => {
                const pole = new THREE.CylinderGeometry(0.06, 0.06, 4, 6);
                pole.translate(0, 2, 0);
                const sign = new THREE.BoxGeometry(1.2, 0.6, 0.08);
                sign.translate(0, 4.3, 0);
                return { geo: safeMerge([pole, sign]), mat: new THREE.MeshStandardMaterial({ color: 0xff44cc, roughness: 0.3, emissive: 0xff2288, emissiveIntensity: 0.4 }), disposables: [pole, sign] };
            }
        });

        this._createDistrictPropType('velvetRope', spawnOnSidewalk('strip', 12), {
            build: () => {
                const post1 = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6);
                post1.translate(-0.5, 0.45, 0);
                const post2 = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6);
                post2.translate(0.5, 0.45, 0);
                const rope = new THREE.CylinderGeometry(0.02, 0.02, 1.0, 4);
                rope.rotateZ(Math.PI / 2);
                rope.translate(0, 0.75, 0);
                const top1 = new THREE.SphereGeometry(0.06, 6, 4);
                top1.translate(-0.5, 0.92, 0);
                const top2 = new THREE.SphereGeometry(0.06, 6, 4);
                top2.translate(0.5, 0.92, 0);
                return { geo: safeMerge([post1, post2, rope, top1, top2]), mat: new THREE.MeshStandardMaterial({ color: 0xccaa44, roughness: 0.2, metalness: 0.7 }), disposables: [post1, post2, rope, top1, top2] };
            }
        });

        this._createDistrictPropType('marquee', spawnOnSidewalk('strip', 8), {
            build: () => {
                const frame = new THREE.BoxGeometry(2, 1.2, 0.1);
                frame.translate(0, 3, 0);
                const bulbRow = new THREE.BoxGeometry(1.8, 0.08, 0.12);
                bulbRow.translate(0, 3.6, 0);
                const bulbRow2 = new THREE.BoxGeometry(1.8, 0.08, 0.12);
                bulbRow2.translate(0, 2.4, 0);
                return { geo: safeMerge([frame, bulbRow, bulbRow2]), mat: new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.4, emissive: 0xffaa00, emissiveIntensity: 0.3 }), disposables: [frame, bulbRow, bulbRow2] };
            }
        });

        // ── THE DOCKS: Maritime props ──
        this._createDistrictPropType('ropeCoil', spawnInDist('docks', 20), {
            build: () => {
                const coil = new THREE.TorusGeometry(0.3, 0.06, 6, 12);
                coil.rotateX(Math.PI / 2);
                coil.translate(0, 0.06, 0);
                return { geo: coil, mat: new THREE.MeshStandardMaterial({ color: 0x886644, roughness: 0.9 }), disposables: [coil] };
            }
        });

        this._createDistrictPropType('crabTrap', spawnInDist('docks', 15), {
            build: () => {
                const cage = new THREE.BoxGeometry(0.6, 0.4, 0.5);
                cage.translate(0, 0.2, 0);
                return { geo: cage, mat: new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.3, wireframe: true }), disposables: [cage] };
            }
        });

        this._createDistrictPropType('barrel', spawnInDist('docks', 18), {
            build: () => {
                const barrel = new THREE.CylinderGeometry(0.3, 0.28, 0.9, 10);
                barrel.translate(0, 0.45, 0);
                const band1 = new THREE.CylinderGeometry(0.32, 0.32, 0.04, 10);
                band1.translate(0, 0.2, 0);
                const band2 = new THREE.CylinderGeometry(0.32, 0.32, 0.04, 10);
                band2.translate(0, 0.7, 0);
                return { geo: safeMerge([barrel, band1, band2]), mat: new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.8 }), disposables: [barrel, band1, band2] };
            }
        });

        this._createDistrictPropType('dockCleat', spawnInDist('docks', 25), {
            build: () => {
                const base = new THREE.CylinderGeometry(0.08, 0.1, 0.15, 6);
                base.translate(0, 0.075, 0);
                const horn1 = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 4);
                horn1.rotateZ(Math.PI / 2);
                horn1.translate(0, 0.15, 0);
                return { geo: safeMerge([base, horn1]), mat: new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.7 }), disposables: [base, horn1] };
            }
        });

        this._createDistrictPropType('anchor', spawnInDist('docks', 5), {
            build: () => {
                const shaft = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6);
                shaft.translate(0, 0.6, 0);
                const ring = new THREE.TorusGeometry(0.12, 0.03, 6, 8);
                ring.translate(0, 1.2, 0);
                const arm = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 4);
                arm.rotateZ(Math.PI / 2);
                arm.translate(0, 0.15, 0);
                return { geo: safeMerge([shaft, ring, arm]), mat: new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.6 }), disposables: [shaft, ring, arm] };
            }
        });

        // ── INDUSTRIAL: Factory props ──
        this._createDistrictPropType('oilDrum', spawnInDist('industrial', 25), {
            build: () => {
                const drum = new THREE.CylinderGeometry(0.28, 0.28, 0.85, 10);
                drum.translate(0, 0.425, 0);
                const rim = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 10);
                rim.translate(0, 0.85, 0);
                return { geo: safeMerge([drum, rim]), mat: new THREE.MeshStandardMaterial({ color: 0x2255aa, roughness: 0.6, metalness: 0.4 }), disposables: [drum, rim] };
            },
            colorVariants: [0x2255aa, 0xcc4422, 0x228833, 0xdddd22, 0x444444]
        });

        this._createDistrictPropType('pallet', spawnInDist('industrial', 20), {
            build: () => {
                const top = new THREE.BoxGeometry(1.0, 0.04, 1.0);
                top.translate(0, 0.15, 0);
                const r1 = new THREE.BoxGeometry(1.0, 0.1, 0.1);
                r1.translate(0, 0.05, -0.35);
                const r2 = new THREE.BoxGeometry(1.0, 0.1, 0.1);
                r2.translate(0, 0.05, 0);
                const r3 = new THREE.BoxGeometry(1.0, 0.1, 0.1);
                r3.translate(0, 0.05, 0.35);
                return { geo: safeMerge([top, r1, r2, r3]), mat: new THREE.MeshStandardMaterial({ color: 0x997755, roughness: 0.9 }), disposables: [top, r1, r2, r3] };
            }
        });

        this._createDistrictPropType('warningSign', spawnOnSidewalk('industrial', 10), {
            build: () => {
                const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.0, 4);
                pole.translate(0, 1.0, 0);
                const sign = new THREE.BoxGeometry(0.5, 0.5, 0.03);
                sign.rotateZ(Math.PI / 4);
                sign.translate(0, 2.2, 0);
                return { geo: safeMerge([pole, sign]), mat: new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.5 }), disposables: [pole, sign] };
            }
        });

        this._createDistrictPropType('pipes', spawnInDist('industrial', 15), {
            build: () => {
                const p1 = new THREE.CylinderGeometry(0.08, 0.08, 3, 6);
                p1.rotateZ(Math.PI / 2);
                p1.translate(0, 0.5, 0);
                const p2 = new THREE.CylinderGeometry(0.06, 0.06, 3, 6);
                p2.rotateZ(Math.PI / 2);
                p2.translate(0, 0.7, 0.2);
                const valve = new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8);
                valve.translate(0, 0.5, 0);
                return { geo: safeMerge([p1, p2, valve]), mat: new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.4, metalness: 0.5 }), disposables: [p1, p2, valve] };
            }
        });

        this._createDistrictPropType('crate', spawnInDist('industrial', 18), {
            build: () => {
                const box = new THREE.BoxGeometry(0.8, 0.8, 0.8);
                box.translate(0, 0.4, 0);
                const strip1 = new THREE.BoxGeometry(0.82, 0.06, 0.82);
                strip1.translate(0, 0.2, 0);
                const strip2 = new THREE.BoxGeometry(0.82, 0.06, 0.82);
                strip2.translate(0, 0.6, 0);
                return { geo: safeMerge([box, strip1, strip2]), mat: new THREE.MeshStandardMaterial({ color: 0xaa8855, roughness: 0.85 }), disposables: [box, strip1, strip2] };
            }
        });

        // ── HILLSIDE: Rustic/natural props ──
        this._createDistrictPropType('logPile', spawnInDist('hillside', 15), {
            build: () => {
                const logs = [];
                for (let i = 0; i < 4; i++) {
                    const log = new THREE.CylinderGeometry(0.1, 0.12, 1.0, 6);
                    log.rotateZ(Math.PI / 2);
                    log.translate(0, 0.12 + i * 0.22, (i % 2) * 0.05);
                    logs.push(log);
                }
                return { geo: safeMerge(logs), mat: new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.9 }), disposables: logs };
            }
        });

        this._createDistrictPropType('rockFormation', spawnInDist('hillside', 20), {
            build: () => {
                const r1 = new THREE.SphereGeometry(0.5, 5, 4);
                r1.scale(1, 0.6, 1);
                r1.translate(0, 0.3, 0);
                const r2 = new THREE.SphereGeometry(0.3, 5, 4);
                r2.scale(1, 0.5, 0.8);
                r2.translate(0.3, 0.15, 0.2);
                return { geo: safeMerge([r1, r2]), mat: new THREE.MeshStandardMaterial({ color: 0x777766, roughness: 0.9 }), disposables: [r1, r2] };
            }
        });

        this._createDistrictPropType('birdFeeder', spawnInDist('hillside', 10), {
            build: () => {
                const pole = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 4);
                pole.translate(0, 0.75, 0);
                const house = new THREE.BoxGeometry(0.3, 0.2, 0.3);
                house.translate(0, 1.55, 0);
                const roof = new THREE.ConeGeometry(0.25, 0.15, 4);
                roof.translate(0, 1.72, 0);
                return { geo: safeMerge([pole, house, roof]), mat: new THREE.MeshStandardMaterial({ color: 0x996633, roughness: 0.8 }), disposables: [pole, house, roof] };
            }
        });

        this._createDistrictPropType('campChair', spawnInDist('hillside', 8), {
            build: () => {
                const seat = new THREE.BoxGeometry(0.4, 0.04, 0.35);
                seat.translate(0, 0.4, 0);
                const back = new THREE.BoxGeometry(0.4, 0.35, 0.04);
                back.translate(0, 0.6, -0.15);
                const l1 = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4);
                l1.translate(-0.17, 0.2, 0.13);
                const l2 = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4);
                l2.translate(0.17, 0.2, 0.13);
                return { geo: safeMerge([seat, back, l1, l2]), mat: new THREE.MeshStandardMaterial({ color: 0x336633, roughness: 0.7 }), disposables: [seat, back, l1, l2] };
            }
        });

        // ── NORTH SHORE: Coastal props ──
        this._createDistrictPropType('lifeguardTower', spawnInDist('northshore', 4), {
            build: () => {
                const p1 = new THREE.CylinderGeometry(0.06, 0.06, 3, 4);
                p1.translate(-0.6, 1.5, -0.4);
                const p2 = new THREE.CylinderGeometry(0.06, 0.06, 3, 4);
                p2.translate(0.6, 1.5, -0.4);
                const p3 = new THREE.CylinderGeometry(0.06, 0.06, 3, 4);
                p3.translate(-0.6, 1.5, 0.4);
                const p4 = new THREE.CylinderGeometry(0.06, 0.06, 3, 4);
                p4.translate(0.6, 1.5, 0.4);
                const platform = new THREE.BoxGeometry(1.5, 0.08, 1.2);
                platform.translate(0, 3, 0);
                const cabin = new THREE.BoxGeometry(1.2, 1.0, 0.9);
                cabin.translate(0, 3.55, 0);
                return { geo: safeMerge([p1, p2, p3, p4, platform, cabin]), mat: new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.7 }), disposables: [p1, p2, p3, p4, platform, cabin] };
            }
        });

        this._createDistrictPropType('beachUmbrella', spawnInDist('northshore', 12), {
            build: () => {
                const pole = new THREE.CylinderGeometry(0.02, 0.02, 2.0, 4);
                pole.translate(0, 1.0, 0);
                const top = new THREE.ConeGeometry(1.0, 0.4, 8);
                top.translate(0, 2.2, 0);
                return { geo: safeMerge([pole, top]), mat: new THREE.MeshStandardMaterial({ color: 0xff6644, roughness: 0.7 }), disposables: [pole, top] };
            },
            colorVariants: [0xff6644, 0x4488ff, 0xffcc00, 0x44cc44, 0xff44cc]
        });

        // ── WEST END: Residential props ──
        this._createDistrictPropType('gardenGnome', spawnInDist('westend', 10), {
            build: () => {
                const body = new THREE.CylinderGeometry(0.08, 0.12, 0.25, 8);
                body.translate(0, 0.125, 0);
                const head = new THREE.SphereGeometry(0.07, 6, 4);
                head.translate(0, 0.3, 0);
                const hat = new THREE.ConeGeometry(0.08, 0.15, 6);
                hat.translate(0, 0.42, 0);
                return { geo: safeMerge([body, head, hat]), mat: new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.7 }), disposables: [body, head, hat] };
            }
        });

        this._createDistrictPropType('wheelbarrow', spawnInDist('westend', 8), {
            build: () => {
                const trough = new THREE.BoxGeometry(0.6, 0.25, 0.4);
                trough.translate(0, 0.3, 0);
                const wheel = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8);
                wheel.rotateZ(Math.PI / 2);
                wheel.translate(0.4, 0.12, 0);
                const handle1 = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4);
                handle1.rotateX(0.3);
                handle1.translate(-0.15, 0.3, -0.4);
                const handle2 = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4);
                handle2.rotateX(0.3);
                handle2.translate(0.15, 0.3, -0.4);
                return { geo: safeMerge([trough, wheel, handle1, handle2]), mat: new THREE.MeshStandardMaterial({ color: 0x228833, roughness: 0.7 }), disposables: [trough, wheel, handle1, handle2] };
            }
        });

        this._createDistrictPropType('picketFence', spawnInDist('westend', 15), {
            build: () => {
                const rail = new THREE.BoxGeometry(2, 0.04, 0.04);
                rail.translate(0, 0.6, 0);
                const rail2 = new THREE.BoxGeometry(2, 0.04, 0.04);
                rail2.translate(0, 0.3, 0);
                const pickets = [];
                for (let i = -4; i <= 4; i++) {
                    const p = new THREE.BoxGeometry(0.06, 0.8, 0.04);
                    p.translate(i * 0.22, 0.4, 0);
                    pickets.push(p);
                }
                return { geo: safeMerge([rail, rail2, ...pickets]), mat: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.7 }), disposables: [rail, rail2, ...pickets] };
            }
        });

        // ── EASTGATE: Commercial/modern props ──
        this._createDistrictPropType('vendingMachine', spawnOnSidewalk('eastgate', 10), {
            build: () => {
                const body = new THREE.BoxGeometry(0.7, 1.6, 0.5);
                body.translate(0, 0.8, 0);
                const slot = new THREE.BoxGeometry(0.1, 0.05, 0.02);
                slot.translate(0.15, 1.0, 0.26);
                return { geo: safeMerge([body, slot]), mat: new THREE.MeshStandardMaterial({ color: 0x2244cc, roughness: 0.4, emissive: 0x112244, emissiveIntensity: 0.15 }), disposables: [body, slot] };
            },
            colorVariants: [0x2244cc, 0xcc2222, 0x22aa44]
        });

        this._createDistrictPropType('planter', spawnOnSidewalk('eastgate', 12), {
            build: () => {
                const box = new THREE.BoxGeometry(1.2, 0.5, 0.5);
                box.translate(0, 0.25, 0);
                const bush = new THREE.SphereGeometry(0.4, 6, 4);
                bush.translate(0, 0.65, 0);
                return { geo: safeMerge([box, bush]), mat: new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 }), disposables: [box, bush] };
            }
        });

        // ── PORTSIDE: Port/shipping props ──
        this._createDistrictPropType('mooring', spawnInDist('portside', 20), {
            build: () => {
                const post = new THREE.CylinderGeometry(0.1, 0.12, 0.8, 6);
                post.translate(0, 0.4, 0);
                const cap = new THREE.CylinderGeometry(0.14, 0.1, 0.1, 6);
                cap.translate(0, 0.85, 0);
                return { geo: safeMerge([post, cap]), mat: new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.5 }), disposables: [post, cap] };
            }
        });

        this._createDistrictPropType('lifebuoy', spawnInDist('portside', 10), {
            build: () => {
                const ring = new THREE.TorusGeometry(0.2, 0.05, 6, 12);
                ring.translate(0, 1.0, 0);
                const post = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4);
                post.translate(0, 0.6, 0);
                return { geo: safeMerge([ring, post]), mat: new THREE.MeshStandardMaterial({ color: 0xff4422, roughness: 0.6 }), disposables: [ring, post] };
            }
        });
    }

    _createHedgeInstances(positions) {
        if (positions.length === 0) return;
        // Rectangular hedge: box body with slight randomness
        const bodyGeo = new THREE.BoxGeometry(3.0, 1.2, 0.8);
        bodyGeo.translate(0, 0.6, 0);
        // Round the top with a half-cylinder
        const topGeo = new THREE.CylinderGeometry(0.4, 0.4, 3.0, 6);
        topGeo.rotateZ(Math.PI / 2);
        topGeo.translate(0, 1.2, 0);
        const mergedGeo = safeMerge([bodyGeo, topGeo]);
        const mat = new THREE.MeshStandardMaterial({ color: 0x2a6622, roughness: 0.75 });
        const inst = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
            dummy.rotation.y = positions[i].rot || 0;
            const scaleX = 0.7 + Math.random() * 0.6;
            dummy.scale.set(scaleX, 0.8 + Math.random() * 0.4, 1);
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
            // Slight color variation
            const h = 0.33 + (Math.random() - 0.5) * 0.05;
            const s = 0.5 + Math.random() * 0.2;
            const l = 0.2 + Math.random() * 0.1;
            inst.setColorAt(i, new THREE.Color().setHSL(h, s, l));
        }
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        inst.castShadow = true;
        this.game.scene.add(inst);
        bodyGeo.dispose(); topGeo.dispose();
    }

    _createGrassPatchInstances(positions) {
        if (positions.length === 0) return;
        // Flat disc of grass with slightly raised center
        const grassGeo = new THREE.CylinderGeometry(1.5, 2.0, 0.08, 8);
        grassGeo.translate(0, 0.04, 0);
        const mat = new THREE.MeshStandardMaterial({ color: 0x448833, roughness: 0.85 });
        const inst = new THREE.InstancedMesh(grassGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            const s = 0.6 + Math.random() * 0.8;
            dummy.scale.set(s, 1, s);
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
            // Green variation
            const h = 0.3 + (Math.random() - 0.5) * 0.06;
            const sat = 0.4 + Math.random() * 0.3;
            const lum = 0.22 + Math.random() * 0.1;
            inst.setColorAt(i, new THREE.Color().setHSL(h, sat, lum));
        }
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        this.game.scene.add(inst);
        grassGeo.dispose();
    }

    _createFlowerBedInstances(positions) {
        if (positions.length === 0) return;
        // Small raised bed with colored flowers
        const bedGeo = new THREE.BoxGeometry(1.0, 0.15, 0.4);
        bedGeo.translate(0, 0.075, 0);
        const flowers = [];
        for (let i = 0; i < 5; i++) {
            const f = new THREE.SphereGeometry(0.06, 4, 3);
            f.translate(-0.35 + i * 0.18, 0.2, 0);
            flowers.push(f);
        }
        const mergedGeo = safeMerge([bedGeo, ...flowers]);
        const mat = new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.8 });
        const inst = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
            // Colorful flower variants
            const flowerColors = [0xff4466, 0xffcc22, 0xff66aa, 0xaa44ff, 0xff8844, 0xffff44];
            inst.setColorAt(i, new THREE.Color(flowerColors[i % flowerColors.length]));
        }
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        this.game.scene.add(inst);
        bedGeo.dispose();
        for (const f of flowers) f.dispose();
    }

    _createDistrictPropType(name, positions, config) {
        if (!positions || positions.length === 0) return;
        const { geo, mat, disposables } = config.build();
        const inst = new THREE.InstancedMesh(geo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            const p = positions[i];
            dummy.position.set(p.x, this.getTerrainHeight(p.x, p.z), p.z);
            dummy.rotation.y = p.rot || 0;
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
            if (config.colorVariants) {
                inst.setColorAt(i, new THREE.Color(config.colorVariants[i % config.colorVariants.length]));
            }
        }
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        inst.castShadow = true;
        this.game.scene.add(inst);
        if (disposables) {
            for (const d of disposables) d.dispose();
        }
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
            const lampY = this.getTerrainHeight(positions[i].x, positions[i].z);
            dummy.position.set(positions[i].x, lampY, positions[i].z);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);

            // Store world position of fixture for light pool
            this.lampPositions.push(new THREE.Vector3(positions[i].x + 1.6, lampY + 4.5, positions[i].z));
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

        // Helper: paint all vertices of a geometry a given color
        const paintVerts = (geo, color) => {
            const count = geo.attributes.position.count;
            const colors = new Float32Array(count * 3);
            const c = new THREE.Color(color);
            for (let i = 0; i < count; i++) {
                colors[i * 3] = c.r;
                colors[i * 3 + 1] = c.g;
                colors[i * 3 + 2] = c.b;
            }
            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        };

        const trunkColor = 0x6B3410;
        const trunkDark = 0x4a2208;

        if (type === 'evergreen') {
            // Multi-layered pine tree: tapered trunk + 3 cone layers
            const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 2.5, 6);
            trunkGeo.translate(0, 1.25, 0);
            paintVerts(trunkGeo, trunkColor);
            // Three stacked cones getting smaller toward top
            const layer1 = new THREE.ConeGeometry(2.0, 2.0, 7);
            layer1.translate(0, 3.0, 0);
            paintVerts(layer1, 0x1a5522);
            const layer2 = new THREE.ConeGeometry(1.5, 1.8, 7);
            layer2.translate(0, 4.2, 0);
            paintVerts(layer2, 0x1d6628);
            const layer3 = new THREE.ConeGeometry(1.0, 1.5, 7);
            layer3.translate(0, 5.2, 0);
            paintVerts(layer3, 0x207730);
            // Exposed roots at base
            const root1 = new THREE.CylinderGeometry(0.04, 0.08, 0.6, 4);
            root1.rotateZ(0.6);
            root1.translate(0.25, 0.15, 0);
            paintVerts(root1, trunkDark);
            const root2 = new THREE.CylinderGeometry(0.04, 0.08, 0.6, 4);
            root2.rotateZ(-0.5);
            root2.translate(-0.2, 0.15, 0.15);
            paintVerts(root2, trunkDark);
            const disposables = [trunkGeo, layer1, layer2, layer3, root1, root2];
            mergedGeo = safeMerge(disposables);
            mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, map: this._generateTreeTexture('evergreen') });
            for (const d of disposables) d.dispose();
        } else if (type === 'deciduous') {
            // Natural deciduous: irregular trunk + multiple overlapping canopy spheres
            const trunkGeo = new THREE.CylinderGeometry(0.12, 0.28, 2.5, 6);
            trunkGeo.translate(0, 1.25, 0);
            paintVerts(trunkGeo, trunkColor);
            // Branch stubs
            const branch1 = new THREE.CylinderGeometry(0.04, 0.08, 0.8, 4);
            branch1.rotateZ(Math.PI / 3);
            branch1.translate(0.5, 2.0, 0);
            paintVerts(branch1, trunkDark);
            const branch2 = new THREE.CylinderGeometry(0.04, 0.08, 0.7, 4);
            branch2.rotateZ(-Math.PI / 3.5);
            branch2.translate(-0.4, 2.3, 0.2);
            paintVerts(branch2, trunkDark);
            // Multi-sphere canopy (3-4 overlapping)
            const c1 = new THREE.SphereGeometry(1.6, 7, 5);
            c1.translate(0, 4.0, 0);
            paintVerts(c1, 0x338833);
            const c2 = new THREE.SphereGeometry(1.3, 7, 5);
            c2.translate(0.8, 4.5, 0.3);
            paintVerts(c2, 0x2d7d2d);
            const c3 = new THREE.SphereGeometry(1.1, 7, 5);
            c3.translate(-0.6, 4.3, -0.4);
            paintVerts(c3, 0x3a9a3a);
            const c4 = new THREE.SphereGeometry(0.9, 6, 4);
            c4.translate(0.2, 5.0, 0.5);
            paintVerts(c4, 0x2a8a2a);
            const disposables = [trunkGeo, branch1, branch2, c1, c2, c3, c4];
            mergedGeo = safeMerge(disposables);
            mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, map: this._generateTreeTexture('deciduous') });
            for (const d of disposables) d.dispose();
        } else {
            // Palm with curved trunk + individual fronds
            const trunkGeo = new THREE.CylinderGeometry(0.08, 0.18, 5, 6);
            trunkGeo.translate(0, 2.5, 0);
            // Add slight curve by offsetting top verts
            const tPos = trunkGeo.attributes.position;
            for (let i = 0; i < tPos.count; i++) {
                const y = tPos.getY(i);
                const curve = Math.sin((y / 5) * Math.PI * 0.3) * 0.4;
                tPos.setX(i, tPos.getX(i) + curve);
            }
            paintVerts(trunkGeo, trunkColor);
            // Bark ring segments
            const ring1 = new THREE.CylinderGeometry(0.14, 0.16, 0.06, 6);
            ring1.translate(0, 1.5, 0);
            paintVerts(ring1, trunkDark);
            const ring2 = new THREE.CylinderGeometry(0.11, 0.13, 0.06, 6);
            ring2.translate(0, 3.0, 0);
            paintVerts(ring2, trunkDark);
            // Coconut cluster at top
            const coconut1 = new THREE.SphereGeometry(0.08, 5, 4);
            coconut1.translate(0.08, 5.0, 0);
            paintVerts(coconut1, 0x664422);
            const coconut2 = new THREE.SphereGeometry(0.08, 5, 4);
            coconut2.translate(-0.06, 4.95, 0.06);
            paintVerts(coconut2, 0x664422);
            // Palm fronds (elongated scaled spheres radiating from top)
            const fronds = [];
            for (let f = 0; f < 6; f++) {
                const angle = (f / 6) * Math.PI * 2;
                const frond = new THREE.SphereGeometry(0.6, 5, 3);
                frond.scale(0.5, 0.15, 1.8);
                frond.rotateY(angle);
                frond.translate(Math.sin(angle) * 0.8, 5.0 - Math.random() * 0.3, Math.cos(angle) * 0.8);
                // Droop the tips
                const fp = frond.attributes.position;
                for (let i = 0; i < fp.count; i++) {
                    const dist = Math.sqrt(fp.getX(i) ** 2 + fp.getZ(i) ** 2);
                    if (dist > 0.5) fp.setY(i, fp.getY(i) - dist * 0.3);
                }
                paintVerts(frond, 0x2a7a2a);
                fronds.push(frond);
            }
            const disposables = [trunkGeo, ring1, ring2, coconut1, coconut2, ...fronds];
            mergedGeo = safeMerge(disposables);
            mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, map: this._generateTreeTexture('palm') });
            for (const d of disposables) d.dispose();
        }

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        instancedMesh.castShadow = true;

        // Per-instance color variety via HSL shifts (base on canopy color, not mat.color)
        const canopyColors = { evergreen: 0x1a5522, deciduous: 0x338833, palm: 0x2a7a2a };
        const baseColor = new THREE.Color(canopyColors[type] || 0x338833);
        const hsl = {};
        baseColor.getHSL(hsl);

        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            const scale = 0.8 + Math.random() * 0.5; // 0.8 - 1.3x
            const ty = this.getTerrainHeight(positions[i].x, positions[i].z);
            dummy.position.set(positions[i].x, ty, positions[i].z);
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

    _generatePropTexture(type) {
        if (!this._propTextureCache) this._propTextureCache = {};
        if (this._propTextureCache[type]) return this._propTextureCache[type];

        let w = 128, h = 128;
        if (type === 'bench' || type === 'cargo' || type === 'newspaper' || type === 'bus_stop' || type === 'vendor_cart') w = 256;
        if (type === 'bench' || type === 'newspaper') h = 64;
        if (type === 'parking_meter') { w = 64; h = 128; }
        if (type === 'bollard') { w = 32; h = 64; }
        if (type === 'hydrant' || type === 'trash' || type === 'mailbox') { w = 64; h = 64; }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Base near-white (multiplied with material color)
        ctx.fillStyle = '#f0ece8';
        ctx.fillRect(0, 0, w, h);

        switch (type) {
            case 'bench': {
                // Wood plank grain lines
                ctx.strokeStyle = 'rgba(80,50,20,0.25)';
                ctx.lineWidth = 0.8;
                for (let i = 0; i < 15; i++) {
                    const y = (i / 15) * h;
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.bezierCurveTo(w * 0.3, y + Math.sin(i * 1.7) * 2, w * 0.7, y - Math.sin(i * 1.3) * 2, w, y);
                    ctx.stroke();
                }
                // Knots
                for (let k = 0; k < 3; k++) {
                    const kx = 20 + Math.random() * (w - 40), ky = 10 + Math.random() * (h - 20);
                    ctx.beginPath();
                    ctx.ellipse(kx, ky, 4, 3, Math.random() * Math.PI, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(60,35,15,0.3)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
                // Metal armrest highlight lines
                ctx.strokeStyle = 'rgba(120,120,120,0.2)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(w * 0.15, 0);
                ctx.lineTo(w * 0.15, h);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(w * 0.85, 0);
                ctx.lineTo(w * 0.85, h);
                ctx.stroke();
                break;
            }
            case 'dumpster': {
                // Corrugated surface lines
                ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                ctx.lineWidth = 1;
                for (let y = 5; y < h; y += 6) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(w, y);
                    ctx.stroke();
                }
                // Rust patches
                for (let r = 0; r < 5; r++) {
                    const rx = Math.random() * w, ry = Math.random() * h;
                    const rs = 8 + Math.random() * 15;
                    ctx.beginPath();
                    ctx.ellipse(rx, ry, rs, rs * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(160,90,40,${0.15 + Math.random() * 0.15})`;
                    ctx.fill();
                }
                // Dent shadows
                for (let d = 0; d < 3; d++) {
                    const dx = Math.random() * w, dy = Math.random() * h;
                    ctx.beginPath();
                    ctx.ellipse(dx, dy, 6, 4, 0, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(0,0,0,0.1)';
                    ctx.fill();
                }
                // Painted number
                ctx.font = 'bold 18px Arial';
                ctx.fillStyle = 'rgba(220,220,200,0.3)';
                ctx.fillText(String(Math.floor(Math.random() * 9) + 1), w * 0.4, h * 0.55);
                break;
            }
            case 'hydrant': {
                // Paint chipping (lighter spots)
                for (let p = 0; p < 6; p++) {
                    ctx.fillStyle = `rgba(255,200,180,${0.1 + Math.random() * 0.1})`;
                    ctx.fillRect(Math.random() * w, Math.random() * h, 5 + Math.random() * 8, 3 + Math.random() * 5);
                }
                // Bolt head circles
                for (const bx of [w * 0.3, w * 0.7]) {
                    ctx.beginPath();
                    ctx.arc(bx, h * 0.3, 3, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
                // Cap seam
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, h * 0.25);
                ctx.lineTo(w, h * 0.25);
                ctx.stroke();
                // Grime at base gradient
                const grime = ctx.createLinearGradient(0, h * 0.7, 0, h);
                grime.addColorStop(0, 'rgba(0,0,0,0)');
                grime.addColorStop(1, 'rgba(40,30,20,0.3)');
                ctx.fillStyle = grime;
                ctx.fillRect(0, h * 0.7, w, h * 0.3);
                break;
            }
            case 'trash': {
                // Dent marks
                for (let d = 0; d < 4; d++) {
                    ctx.beginPath();
                    ctx.ellipse(Math.random() * w, Math.random() * h, 5, 3, 0, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(0,0,0,0.08)';
                    ctx.fill();
                }
                // Lid rim
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, h * 0.12);
                ctx.lineTo(w, h * 0.12);
                ctx.stroke();
                // Grime gradient at bottom
                const grime = ctx.createLinearGradient(0, h * 0.7, 0, h);
                grime.addColorStop(0, 'rgba(0,0,0,0)');
                grime.addColorStop(1, 'rgba(30,25,15,0.25)');
                ctx.fillStyle = grime;
                ctx.fillRect(0, h * 0.7, w, h * 0.3);
                // Liner bag edge
                ctx.strokeStyle = 'rgba(20,20,20,0.15)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(w * 0.2, h * 0.15);
                ctx.quadraticCurveTo(w * 0.5, h * 0.2, w * 0.8, h * 0.15);
                ctx.stroke();
                break;
            }
            case 'cargo': {
                // Corrugated ridges (vertical lines)
                ctx.strokeStyle = 'rgba(0,0,0,0.12)';
                ctx.lineWidth = 1;
                for (let x = 4; x < w; x += 6) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, h);
                    ctx.stroke();
                }
                // Rust at edges
                for (let e = 0; e < 4; e++) {
                    ctx.fillStyle = `rgba(160,85,35,${0.12 + Math.random() * 0.12})`;
                    const ex = Math.random() < 0.5 ? 0 : w - 15;
                    ctx.fillRect(ex, Math.random() * h, 15, 10 + Math.random() * 20);
                }
                // Shipping company text
                const companies = ['MAERSK', 'COSCO', 'EVERGREEN', 'MSC', 'CMA CGM'];
                ctx.font = 'bold 14px Arial';
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillText(companies[Math.floor(Math.random() * companies.length)], w * 0.1, h * 0.4);
                // Door latch rectangles
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.strokeRect(w * 0.85, h * 0.3, 8, 20);
                ctx.strokeRect(w * 0.85, h * 0.6, 8, 20);
                break;
            }
            case 'fence': {
                // Diamond mesh pattern
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 0.8;
                const spacing = 8;
                for (let d = -h; d < w + h; d += spacing) {
                    ctx.beginPath();
                    ctx.moveTo(d, 0);
                    ctx.lineTo(d + h, h);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(d + h, 0);
                    ctx.lineTo(d, h);
                    ctx.stroke();
                }
                // Frame edge
                ctx.strokeStyle = 'rgba(80,80,80,0.3)';
                ctx.lineWidth = 3;
                ctx.strokeRect(1, 1, w - 2, h - 2);
                break;
            }
            case 'phone_booth': {
                // Glass panel frames
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 2;
                ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.55);
                // "PHONE" text
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = 'rgba(40,40,200,0.3)';
                ctx.textAlign = 'center';
                ctx.fillText('PHONE', w * 0.5, h * 0.08);
                ctx.textAlign = 'left';
                // Number pad grid
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        ctx.fillStyle = 'rgba(180,180,180,0.2)';
                        ctx.fillRect(w * 0.3 + c * 12, h * 0.72 + r * 10, 8, 6);
                    }
                }
                break;
            }
            case 'mailbox': {
                // "US MAIL" text
                ctx.font = 'bold 8px Arial';
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.textAlign = 'center';
                ctx.fillText('US MAIL', w * 0.5, h * 0.25);
                ctx.textAlign = 'left';
                // Slot rectangle
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                ctx.fillRect(w * 0.2, h * 0.35, w * 0.6, 4);
                // Pull handle
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(w * 0.35, h * 0.55);
                ctx.lineTo(w * 0.65, h * 0.55);
                ctx.stroke();
                // Paint chips
                for (let p = 0; p < 4; p++) {
                    ctx.fillStyle = `rgba(200,210,220,${0.1 + Math.random() * 0.1})`;
                    ctx.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 6, 3 + Math.random() * 4);
                }
                break;
            }
            case 'bollard': {
                // Reflective stripe bands
                ctx.fillStyle = 'rgba(220,200,40,0.35)';
                ctx.fillRect(0, h * 0.25, w, h * 0.1);
                ctx.fillRect(0, h * 0.55, w, h * 0.1);
                // Scuff marks
                for (let s = 0; s < 3; s++) {
                    ctx.fillStyle = 'rgba(0,0,0,0.1)';
                    ctx.fillRect(Math.random() * w, Math.random() * h, 4, 3);
                }
                // Bolt circles
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(w * 0.5, h * 0.1, 3, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
            case 'parking_meter': {
                // Coin slot
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillRect(w * 0.3, h * 0.15, w * 0.4, 3);
                // Time display
                ctx.fillStyle = 'rgba(180,30,30,0.25)';
                ctx.fillRect(w * 0.15, h * 0.22, w * 0.7, h * 0.12);
                ctx.font = 'bold 8px monospace';
                ctx.fillStyle = 'rgba(255,60,60,0.4)';
                ctx.textAlign = 'center';
                ctx.fillText('EXPIRED', w * 0.5, h * 0.3);
                ctx.textAlign = 'left';
                // Chrome cap highlight
                const capGrad = ctx.createLinearGradient(0, 0, 0, h * 0.1);
                capGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
                capGrad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = capGrad;
                ctx.fillRect(0, 0, w, h * 0.1);
                // Pole grime
                const poleGrime = ctx.createLinearGradient(0, h * 0.6, 0, h);
                poleGrime.addColorStop(0, 'rgba(0,0,0,0)');
                poleGrime.addColorStop(1, 'rgba(30,25,15,0.25)');
                ctx.fillStyle = poleGrime;
                ctx.fillRect(0, h * 0.6, w, h * 0.4);
                break;
            }
            case 'newspaper': {
                // Masthead
                ctx.font = 'bold 10px serif';
                ctx.fillStyle = 'rgba(0,0,80,0.4)';
                ctx.textAlign = 'center';
                ctx.fillText('SC TIMES', w * 0.5, h * 0.25);
                ctx.textAlign = 'left';
                // Window pane
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.strokeRect(w * 0.1, h * 0.35, w * 0.8, h * 0.4);
                // Coin slot
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(w * 0.35, h * 0.82, w * 0.3, 3);
                break;
            }
            case 'bus_stop': {
                // "BUS STOP" text
                ctx.font = 'bold 14px Arial';
                ctx.fillStyle = 'rgba(30,60,120,0.35)';
                ctx.textAlign = 'center';
                ctx.fillText('BUS STOP', w * 0.5, h * 0.1);
                ctx.textAlign = 'left';
                // Route map rectangle
                ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                ctx.lineWidth = 1;
                ctx.strokeRect(w * 0.1, h * 0.15, w * 0.35, h * 0.6);
                // Ad panel
                const adTexts = ['SPRUNK', 'eCola', 'REDWOOD', 'PISSWASSER', 'CLUCKIN BELL'];
                ctx.font = 'bold 16px Arial';
                ctx.fillStyle = 'rgba(180,40,40,0.25)';
                ctx.textAlign = 'center';
                ctx.fillText(adTexts[Math.floor(Math.random() * adTexts.length)], w * 0.7, h * 0.45);
                ctx.textAlign = 'left';
                // Bench slat lines
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                for (let s = 0; s < 4; s++) {
                    ctx.beginPath();
                    ctx.moveTo(w * 0.1, h * 0.85 + s * 4);
                    ctx.lineTo(w * 0.9, h * 0.85 + s * 4);
                    ctx.stroke();
                }
                break;
            }
            case 'vendor_cart': {
                // Menu text
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = 'rgba(200,40,40,0.35)';
                ctx.textAlign = 'center';
                ctx.fillText('HOT DOGS $2', w * 0.5, h * 0.15);
                ctx.fillText('PRETZELS $1', w * 0.5, h * 0.28);
                ctx.textAlign = 'left';
                // Umbrella stripes
                ctx.strokeStyle = 'rgba(200,40,40,0.2)';
                ctx.lineWidth = 8;
                for (let s = 0; s < w; s += 20) {
                    ctx.beginPath();
                    ctx.moveTo(s, 0);
                    ctx.lineTo(s + 10, h * 0.08);
                    ctx.stroke();
                }
                // Serving window
                ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                ctx.lineWidth = 1;
                ctx.strokeRect(w * 0.2, h * 0.4, w * 0.6, h * 0.3);
                break;
            }
            default: {
                // Generic: subtle noise
                for (let i = 0; i < 200; i++) {
                    ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`;
                    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
                }
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;
        this._propTextureCache[type] = texture;
        return texture;
    }

    _generateTreeTexture(type) {
        if (!this._treeTextureCache) this._treeTextureCache = {};
        if (this._treeTextureCache[type]) return this._treeTextureCache[type];

        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Base near-white (multiplied with vertex colors)
        ctx.fillStyle = '#f0ece8';
        ctx.fillRect(0, 0, 128, 128);

        if (type === 'evergreen') {
            // Needle hatching pattern (dense diagonal lines)
            ctx.strokeStyle = 'rgba(20,50,20,0.2)';
            ctx.lineWidth = 0.8;
            for (let i = -128; i < 256; i += 5) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 64, 128);
                ctx.stroke();
            }
            // Darker spots for depth
            for (let s = 0; s < 15; s++) {
                ctx.fillStyle = `rgba(10,30,10,${0.05 + Math.random() * 0.08})`;
                ctx.beginPath();
                ctx.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 8, 0, Math.PI * 2);
                ctx.fill();
            }
            // Bark: rough vertical fissures on lower part
            ctx.strokeStyle = 'rgba(50,25,10,0.15)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 8; i++) {
                const x = Math.random() * 128;
                ctx.beginPath();
                ctx.moveTo(x, 90);
                for (let d = 90; d < 128; d += 5) {
                    ctx.lineTo(x + (Math.random() - 0.5) * 3, d);
                }
                ctx.stroke();
            }
        } else if (type === 'deciduous') {
            // Overlapping leaf shapes
            ctx.strokeStyle = 'rgba(30,60,20,0.15)';
            ctx.lineWidth = 0.8;
            for (let i = 0; i < 40; i++) {
                const lx = Math.random() * 128, ly = Math.random() * 128;
                const lr = 3 + Math.random() * 6;
                const angle = Math.random() * Math.PI;
                ctx.beginPath();
                ctx.ellipse(lx, ly, lr, lr * 0.5, angle, 0, Math.PI * 2);
                ctx.stroke();
            }
            // Light spots
            for (let s = 0; s < 10; s++) {
                ctx.fillStyle = `rgba(200,220,180,${0.06 + Math.random() * 0.06})`;
                ctx.beginPath();
                ctx.arc(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 5, 0, Math.PI * 2);
                ctx.fill();
            }
            // Bark: smoother, horizontal lenticels
            ctx.strokeStyle = 'rgba(60,40,20,0.12)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 6; i++) {
                const y = 95 + Math.random() * 30;
                const x = Math.random() * 100;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + 5 + Math.random() * 10, y);
                ctx.stroke();
            }
        } else { // palm
            // Parallel vein lines radiating
            ctx.strokeStyle = 'rgba(30,80,20,0.2)';
            ctx.lineWidth = 0.8;
            for (let i = 0; i < 20; i++) {
                const y = (i / 20) * 128;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(128, y + (Math.random() - 0.5) * 8);
                ctx.stroke();
            }
            // Browning at tips
            const tipGrad = ctx.createLinearGradient(100, 0, 128, 0);
            tipGrad.addColorStop(0, 'rgba(0,0,0,0)');
            tipGrad.addColorStop(1, 'rgba(100,70,30,0.15)');
            ctx.fillStyle = tipGrad;
            ctx.fillRect(0, 0, 128, 128);
            // Ring pattern on bark (lower portion)
            ctx.strokeStyle = 'rgba(60,35,15,0.15)';
            ctx.lineWidth = 1;
            for (let y = 90; y < 128; y += 5) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(128, y);
                ctx.stroke();
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;
        this._treeTextureCache[type] = texture;
        return texture;
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
        const mat = new THREE.MeshStandardMaterial({ color: 0x886644, roughness: 0.8, map: this._generatePropTexture('bench') });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
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
        const mat = new THREE.MeshStandardMaterial({ color: 0x336633, roughness: 0.8, map: this._generatePropTexture('dumpster') });

        const instancedMesh = new THREE.InstancedMesh(geo, mat, positions.length);
        instancedMesh.castShadow = true;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
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
        const mat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6, map: this._generatePropTexture('hydrant') });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
            // Register as destructible
            this.destructibleProps.push({ x: positions[i].x, z: positions[i].z, radius: 0.5, type: 'hydrant', destroyed: false, instancedMesh, instanceIndex: i });
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
        const mat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8, map: this._generatePropTexture('trash') });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        instancedMesh.castShadow = true;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
            this.destructibleProps.push({ x: positions[i].x, z: positions[i].z, radius: 0.5, type: 'trashcan', destroyed: false, instancedMesh, instanceIndex: i });
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
        const mat = new THREE.MeshStandardMaterial({ color: 0xcc4422, roughness: 0.7, metalness: 0.3, map: this._generatePropTexture('cargo') });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        instancedMesh.castShadow = true;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
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
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.7, map: this._generatePropTexture('fence') });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
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
        const mat = new THREE.MeshStandardMaterial({ color: 0x224488, roughness: 0.5, transparent: true, opacity: 0.85, map: this._generatePropTexture('phone_booth') });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        instancedMesh.castShadow = true;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
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
        const mat = new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.6, map: this._generatePropTexture('mailbox') });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
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
        const mat = new THREE.MeshStandardMaterial({ color: 0xccaa44, roughness: 0.3, metalness: 0.6, map: this._generatePropTexture('bollard') });

        const instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
            this.destructibleProps.push({ x: positions[i].x, z: positions[i].z, radius: 0.3, type: 'bollard', destroyed: false, instancedMesh, instanceIndex: i });
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        this.game.scene.add(instancedMesh);

        postGeo.dispose(); capGeo.dispose();
    }

    _createParkingMeterInstances(positions) {
        if (positions.length === 0) return;
        // Thin post with meter head
        const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 4);
        postGeo.translate(0, 0.5, 0);
        const headGeo = new THREE.BoxGeometry(0.15, 0.25, 0.1);
        headGeo.translate(0, 1.15, 0);
        const mergedGeo = safeMerge([postGeo, headGeo]);
        const mat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4, metalness: 0.5, map: this._generatePropTexture('parking_meter') });
        const inst = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
            this.destructibleProps.push({ x: positions[i].x, z: positions[i].z, radius: 0.3, type: 'meter', destroyed: false, instancedMesh: inst, instanceIndex: i });
        }
        inst.instanceMatrix.needsUpdate = true;
        this.game.scene.add(inst);
        postGeo.dispose(); headGeo.dispose();
    }

    _createNewspaperBoxInstances(positions) {
        if (positions.length === 0) return;
        // Boxy newspaper dispenser
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.9, 0.4);
        bodyGeo.translate(0, 0.45, 0);
        const legGeo = new THREE.BoxGeometry(0.45, 0.15, 0.35);
        legGeo.translate(0, 0.075, 0);
        const mergedGeo = safeMerge([bodyGeo, legGeo]);
        const mat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.6, map: this._generatePropTexture('newspaper') });
        const inst = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
            const colors = [0xcc3333, 0x2244aa, 0xccaa22];
            inst.setColorAt(i, new THREE.Color(colors[i % colors.length]));
            this.destructibleProps.push({ x: positions[i].x, z: positions[i].z, radius: 0.4, type: 'newsbox', destroyed: false, instancedMesh: inst, instanceIndex: i });
        }
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        this.game.scene.add(inst);
        bodyGeo.dispose(); legGeo.dispose();
    }

    _createBusStopInstances(positions) {
        if (positions.length === 0) return;
        // Bus shelter: two posts + roof + back panel + bench
        const post1 = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 4);
        post1.translate(-1.5, 1.25, 0);
        const post2 = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 4);
        post2.translate(1.5, 1.25, 0);
        const roof = new THREE.BoxGeometry(3.5, 0.08, 1.5);
        roof.translate(0, 2.55, 0);
        const back = new THREE.BoxGeometry(3.3, 1.8, 0.05);
        back.translate(0, 1.5, -0.7);
        const bench = new THREE.BoxGeometry(2.5, 0.08, 0.4);
        bench.translate(0, 0.5, -0.3);
        const mergedGeo = safeMerge([post1, post2, roof, back, bench]);
        const mat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.5, metalness: 0.3, map: this._generatePropTexture('bus_stop') });
        const inst = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        inst.castShadow = true;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
            dummy.rotation.y = positions[i].rot || 0;
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        this.game.scene.add(inst);
        post1.dispose(); post2.dispose(); roof.dispose(); back.dispose(); bench.dispose();
    }

    _createManholeInstances(positions) {
        if (positions.length === 0) return;
        // Flat disc on road surface
        const coverGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.03, 12);
        coverGeo.translate(0, 0.015, 0);
        const mat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8, metalness: 0.4 });
        const inst = new THREE.InstancedMesh(coverGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        this.game.scene.add(inst);
        coverGeo.dispose();
    }

    _createVendorCartInstances(positions) {
        if (positions.length === 0) return;
        // Hot dog / pretzel cart: box body + wheels + umbrella pole + umbrella
        const body = new THREE.BoxGeometry(1.5, 0.8, 0.8);
        body.translate(0, 0.8, 0);
        const wheel1 = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8);
        wheel1.rotateZ(Math.PI / 2);
        wheel1.translate(-0.6, 0.2, 0.45);
        const wheel2 = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8);
        wheel2.rotateZ(Math.PI / 2);
        wheel2.translate(-0.6, 0.2, -0.45);
        const pole = new THREE.CylinderGeometry(0.02, 0.02, 1.5, 4);
        pole.translate(0.3, 1.95, 0);
        const umbrella = new THREE.ConeGeometry(0.8, 0.3, 8);
        umbrella.translate(0.3, 2.85, 0);
        const mergedGeo = safeMerge([body, wheel1, wheel2, pole, umbrella]);
        const mat = new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.7, map: this._generatePropTexture('vendor_cart') });
        const inst = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        inst.castShadow = true;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
            dummy.rotation.y = positions[i].rot || 0;
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
            // Alternate cart colors
            const colors = [0xcc4444, 0x2266aa, 0xddaa22, 0x44aa44];
            inst.setColorAt(i, new THREE.Color(colors[i % colors.length]));
        }
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        this.game.scene.add(inst);
        body.dispose(); wheel1.dispose(); wheel2.dispose(); pole.dispose(); umbrella.dispose();
    }

    _createPottedPlantInstances(positions) {
        if (positions.length === 0) return;
        // Terracotta pot + small bush
        const potGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8);
        potGeo.translate(0, 0.15, 0);
        const plantGeo = new THREE.SphereGeometry(0.25, 6, 4);
        plantGeo.translate(0, 0.45, 0);

        // Vertex colors for pot (brown) and plant (green)
        const paintVerts = (geo, color) => {
            const count = geo.attributes.position.count;
            const colors = new Float32Array(count * 3);
            const c = new THREE.Color(color);
            for (let i = 0; i < count; i++) {
                colors[i * 3] = c.r;
                colors[i * 3 + 1] = c.g;
                colors[i * 3 + 2] = c.b;
            }
            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        };
        paintVerts(potGeo, 0xaa5533);
        paintVerts(plantGeo, 0x337722);

        const mergedGeo = safeMerge([potGeo, plantGeo]);
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
        const inst = new THREE.InstancedMesh(mergedGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        this.game.scene.add(inst);
        potGeo.dispose(); plantGeo.dispose();
    }

    _createAwningInstances(positions) {
        if (positions.length === 0) return;
        // Simple angled awning — tilted plane extending from building face
        const awningGeo = new THREE.BoxGeometry(1, 0.04, 1.5);
        // Tilt forward
        awningGeo.rotateX(-0.15);
        awningGeo.translate(0, 3.5, 0.75);
        const mat = new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.8 });
        const inst = new THREE.InstancedMesh(awningGeo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.set(positions[i].x, this.getTerrainHeight(positions[i].x, positions[i].z), positions[i].z);
            dummy.rotation.y = positions[i].rot || 0;
            dummy.scale.x = (positions[i].w || 4) / 1; // Scale width to match building
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
            // Varied awning colors
            const colors = [0xcc4444, 0x44aa44, 0x4444aa, 0xcc8833, 0x882244, 0x228888];
            inst.setColorAt(i, new THREE.Color(colors[i % colors.length]));
        }
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        this.game.scene.add(inst);
        awningGeo.dispose();
    }

    _createSteamVents(positions) {
        if (positions.length === 0) return;
        // Store positions for animated steam particle effect
        this.steamVentPositions = positions.map(p => ({
            x: p.x,
            y: this.getTerrainHeight(p.x, p.z) + 0.05,
            z: p.z
        }));

        // Create a simple particle system for each vent
        const particleCount = 20;
        const totalParticles = positions.length * particleCount;
        const steamGeo = new THREE.BufferGeometry();
        const steamPositions = new Float32Array(totalParticles * 3);
        const steamAlphas = new Float32Array(totalParticles);

        for (let v = 0; v < positions.length; v++) {
            const vp = this.steamVentPositions[v];
            for (let p = 0; p < particleCount; p++) {
                const idx = (v * particleCount + p) * 3;
                steamPositions[idx] = vp.x + (Math.random() - 0.5) * 0.3;
                steamPositions[idx + 1] = vp.y + Math.random() * 2;
                steamPositions[idx + 2] = vp.z + (Math.random() - 0.5) * 0.3;
                steamAlphas[v * particleCount + p] = Math.random();
            }
        }

        steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPositions, 3));
        const steamMat = new THREE.PointsMaterial({
            color: 0xcccccc,
            size: 0.3,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            sizeAttenuation: true
        });
        this.steamParticles = new THREE.Points(steamGeo, steamMat);
        this.steamParticleCount = particleCount;
        this.game.scene.add(this.steamParticles);
    }

    // Destructible prop collision — called by vehicles.js
    checkPropCollision(vehicleX, vehicleZ, vehicleSpeed, vehicleRadius) {
        if (Math.abs(vehicleSpeed) < 3) return false; // Min speed to destroy
        let hitAny = false;
        const dummy = new THREE.Object3D();
        for (const prop of this.destructibleProps) {
            if (prop.destroyed) continue;
            const dx = vehicleX - prop.x;
            const dz = vehicleZ - prop.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < vehicleRadius + prop.radius) {
                // Destroy it — move instance underground
                prop.destroyed = true;
                dummy.position.set(prop.x, -100, prop.z);
                dummy.updateMatrix();
                prop.instancedMesh.setMatrixAt(prop.instanceIndex, dummy.matrix);
                prop.instancedMesh.instanceMatrix.needsUpdate = true;

                // Spawn debris
                this._spawnDebris(prop.x, this.getTerrainHeight(prop.x, prop.z), prop.z, prop.type);
                hitAny = true;

                // Play crash sound
                if (this.game.systems.audio && this.game.systems.audio.playExplosion) {
                    this.game.systems.audio.playExplosion();
                }
            }
        }
        return hitAny;
    }

    _spawnDebris(x, y, z, type) {
        const colors = {
            hydrant: 0xcc2222, trashcan: 0x444444, meter: 0x666666,
            newsbox: 0xcc3333, bollard: 0xccaa44
        };
        const color = colors[type] || 0x888888;
        const count = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            const size = 0.05 + Math.random() * 0.15;
            const geo = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x + (Math.random() - 0.5) * 0.5, y + 0.5 + Math.random() * 0.5, z + (Math.random() - 0.5) * 0.5);
            this.game.scene.add(mesh);
            this.debrisParticles.push({
                mesh,
                vel: new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6),
                life: 2 + Math.random() * 1
            });
        }
    }

    updateDebris(dt) {
        for (let i = this.debrisParticles.length - 1; i >= 0; i--) {
            const d = this.debrisParticles[i];
            d.life -= dt;
            if (d.life <= 0) {
                this.game.scene.remove(d.mesh);
                d.mesh.geometry.dispose();
                d.mesh.material.dispose();
                this.debrisParticles.splice(i, 1);
                continue;
            }
            d.vel.y -= 12 * dt; // Gravity
            d.mesh.position.add(d.vel.clone().multiplyScalar(dt));
            d.mesh.rotation.x += dt * 5;
            d.mesh.rotation.z += dt * 3;
            // Bounce off ground
            const groundY = this.getTerrainHeight(d.mesh.position.x, d.mesh.position.z);
            if (d.mesh.position.y < groundY + 0.05) {
                d.mesh.position.y = groundY + 0.05;
                d.vel.y = Math.abs(d.vel.y) * 0.3;
                d.vel.x *= 0.7;
                d.vel.z *= 0.7;
            }
            // Fade out in last 0.5s
            if (d.life < 0.5) {
                d.mesh.material.opacity = d.life / 0.5;
                d.mesh.material.transparent = true;
            }
        }
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

        // Merge all ramp and stripe geometries into single meshes
        const rampGeoms = [];
        const stripeGeoms = [];

        for (const loc of rampLocations) {
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
            // Bake child transform (position + rotation within group)
            const childMat = new THREE.Matrix4();
            childMat.makeRotationY(Math.PI / 2);
            childMat.setPosition(-2.5, 0, -3);
            rampGeo.applyMatrix4(childMat);
            // Bake group transform (world position + rotation)
            const groupMat = new THREE.Matrix4();
            groupMat.makeRotationY(loc.rotY);
            groupMat.setPosition(loc.x, 0, loc.z);
            rampGeo.applyMatrix4(groupMat);
            rampGeoms.push(rampGeo);

            // Yellow warning stripes on top
            const stripeGeo = new THREE.PlaneGeometry(4.5, 5.5);
            const stripeChild = new THREE.Matrix4();
            stripeChild.makeRotationX(-Math.atan2(3, 6));
            stripeChild.setPosition(0, 1.55, 0);
            stripeGeo.applyMatrix4(stripeChild);
            stripeGeo.applyMatrix4(groupMat);
            stripeGeoms.push(stripeGeo);

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

        if (rampGeoms.length > 0) {
            const merged = safeMerge(rampGeoms);
            const mesh = new THREE.Mesh(merged, rampMat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.game.scene.add(mesh);
            for (const g of rampGeoms) g.dispose();
        }
        if (stripeGeoms.length > 0) {
            const merged = safeMerge(stripeGeoms);
            const mesh = new THREE.Mesh(merged, stripeMat);
            this.game.scene.add(mesh);
            for (const g of stripeGeoms) g.dispose();
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

    // Displace Y of geometry vertices to follow terrain, preserving existing Y as offset
    _applyTerrainToGeo(geo, baseY) {
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            pos.setY(i, this.getTerrainHeight(x, z) + (baseY || 0));
        }
        pos.needsUpdate = true;
    }

    getTerrainHeight(x, z) {
        // Smooth hermite interpolation (0 at edge, 1 at center)
        const smoothstep = (d, r) => {
            if (d >= r) return 0;
            const t = 1 - d / r;
            return t * t * (3 - 2 * t);
        };

        let height = 0;

        // --- District elevation zones (overlapping radial influences) ---
        // All heights at 1.5x scale for dramatic elevation

        // Hillside (NW): dramatic peak at 165, radius 280
        const hillDist = Math.sqrt((x + 275) * (x + 275) + (z + 275) * (z + 275));
        height += 165 * smoothstep(hillDist, 280);

        // Downtown (center): elevated plateau at 27, radius 150
        const dtDist = Math.sqrt(x * x + z * z);
        height += 27 * smoothstep(dtDist, 150);

        // North Shore (N edge): ridge at 52, centered z=-300, radius 180
        const nsDist = Math.sqrt(x * x + (z + 300) * (z + 300));
        height += 52 * smoothstep(nsDist, 180);

        // The Strip (NE): moderate hills at 38, radius 160
        const stripDist = Math.sqrt((x - 275) * (x - 275) + (z + 275) * (z + 275));
        height += 38 * smoothstep(stripDist, 160);

        // West End (W): moderate slope 38, radius 180
        const weDist = Math.sqrt((x + 275) * (x + 275) + z * z);
        height += 38 * smoothstep(weDist, 180);

        // Eastgate (E): gentle hills 22, radius 160
        const egDist = Math.sqrt((x - 275) * (x - 275) + z * z);
        height += 22 * smoothstep(egDist, 160);

        // The Docks (SW): low waterfront 9, radius 160
        const dkDist = Math.sqrt((x + 275) * (x + 275) + (z - 275) * (z - 275));
        height += 9 * smoothstep(dkDist, 160);

        // Industrial Park (SE): low flat 12, radius 160
        const indDist = Math.sqrt((x - 275) * (x - 275) + (z - 275) * (z - 275));
        height += 12 * smoothstep(indDist, 160);

        // Portside (S): low port 12, radius 150
        const psDist = Math.sqrt(x * x + (z - 275) * (z - 275));
        height += 12 * smoothstep(psDist, 150);

        // --- Coastal falloff: slope to 0 at map edges ---
        const halfMap = 400;
        const coastMargin = 60; // start dropping 60 units from edge
        const edgeDistX = halfMap - Math.abs(x);
        const edgeDistZ = halfMap - Math.abs(z);
        const edgeDist = Math.min(edgeDistX, edgeDistZ);
        if (edgeDist < coastMargin) {
            const coastFactor = Math.max(0, edgeDist / coastMargin);
            // Smooth coastal curve
            height *= coastFactor * coastFactor * (3 - 2 * coastFactor);
        }

        // --- Deterministic noise for micro variation (2-4 units) ---
        const nx = x * 0.03;
        const nz = z * 0.03;
        const noise1 = Math.sin(nx * 1.7 + nz * 2.3) * Math.cos(nz * 1.3 - nx * 0.7);
        const noise2 = Math.sin(nx * 3.1 + 1.7) * Math.cos(nz * 2.7 + 0.9) * 0.5;
        height += (noise1 + noise2) * 3.75;

        // Never go below 0 (water level)
        return Math.max(0, height);
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

        // Wet road sheen — roads become more reflective in rain
        if (this.roadMat) {
            const targetMetal = isRaining ? 0.35 : 0.05;
            const targetRough = isRaining ? 0.3 : 0.82;
            this.roadMat.metalness += (targetMetal - this.roadMat.metalness) * dt * 2;
            this.roadMat.roughness += (targetRough - this.roadMat.roughness) * dt * 2;
        }

        // Wet ground and sidewalk during rain
        if (this.groundPlane && this.groundPlane.material) {
            const targetRough = isRaining ? 0.25 : 0.55;
            this.groundPlane.material.roughness += (targetRough - this.groundPlane.material.roughness) * dt * 2;
        }

        // Animate steam vents
        if (this.steamParticles && this.steamVentPositions) {
            const posAttr = this.steamParticles.geometry.getAttribute('position');
            const pc = this.steamParticleCount;
            for (let v = 0; v < this.steamVentPositions.length; v++) {
                const vp = this.steamVentPositions[v];
                for (let p = 0; p < pc; p++) {
                    const idx = (v * pc + p) * 3;
                    posAttr.array[idx + 1] += dt * (0.5 + Math.random() * 0.5); // Rise
                    posAttr.array[idx] += (Math.random() - 0.5) * dt * 0.3; // Drift X
                    posAttr.array[idx + 2] += (Math.random() - 0.5) * dt * 0.3; // Drift Z
                    // Reset if too high
                    if (posAttr.array[idx + 1] > vp.y + 3) {
                        posAttr.array[idx] = vp.x + (Math.random() - 0.5) * 0.3;
                        posAttr.array[idx + 1] = vp.y;
                        posAttr.array[idx + 2] = vp.z + (Math.random() - 0.5) * 0.3;
                    }
                }
            }
            posAttr.needsUpdate = true;
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
        this.updateDebris(dt);
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

        // Animate water caustic texture UV offset
        if (this._waterTexture) {
            this._waterTexture.offset.x = Math.sin(this._waveTime * 0.1) * 0.05;
            this._waterTexture.offset.y = Math.cos(this._waveTime * 0.08) * 0.05;
        }
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

    createGraffiti() {
        // Procedural graffiti/street art on building walls in gritty districts
        const graffitiDistricts = ['docks', 'industrial', 'strip', 'westend'];
        const graffitiGeoms = [];
        const graffitiTextures = [];

        // Generate a few unique graffiti canvas textures
        const makeGraffitiTexture = (style) => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');

            // Dark wall background
            ctx.fillStyle = '#333';
            ctx.fillRect(0, 0, 128, 128);

            if (style === 'tag') {
                // Graffiti tag — bold colored text
                const colors = ['#ff2244', '#44ff88', '#ffaa00', '#ff66cc', '#44aaff', '#ff4400'];
                ctx.save();
                ctx.translate(64, 64);
                ctx.rotate((Math.random() - 0.5) * 0.3);
                ctx.font = 'bold ' + (28 + Math.floor(Math.random() * 16)) + 'px Impact, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const tags = ['CLAUDIO', 'SC', 'CREW', 'REBEL', '187', 'GHOST', 'VENOM', 'ACE', 'BLAZE', 'KARMA'];
                const tag = tags[Math.floor(Math.random() * tags.length)];
                const col = colors[Math.floor(Math.random() * colors.length)];
                // Outline
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 4;
                ctx.strokeText(tag, 0, 0);
                // Fill
                ctx.fillStyle = col;
                ctx.fillText(tag, 0, 0);
                ctx.restore();
            } else if (style === 'abstract') {
                // Abstract color splash
                const colors = ['#ff3366', '#33ccff', '#ffcc00', '#66ff33', '#cc33ff'];
                for (let i = 0; i < 5 + Math.floor(Math.random() * 4); i++) {
                    ctx.beginPath();
                    const cx = Math.random() * 128;
                    const cy = Math.random() * 128;
                    const r = 10 + Math.random() * 30;
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
                // Drip lines
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    const dx = Math.random() * 128;
                    ctx.moveTo(dx, Math.random() * 60);
                    ctx.lineTo(dx + (Math.random() - 0.5) * 10, 128);
                    ctx.strokeStyle = colors[Math.floor(Math.random() * colors.length)];
                    ctx.lineWidth = 1 + Math.random() * 2;
                    ctx.stroke();
                }
            } else {
                // Stencil art — simple geometric shape
                ctx.fillStyle = '#fff';
                ctx.globalAlpha = 0.8;
                const shape = Math.floor(Math.random() * 3);
                if (shape === 0) {
                    // Star
                    ctx.beginPath();
                    for (let i = 0; i < 5; i++) {
                        const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
                        const r = 35;
                        ctx[i === 0 ? 'moveTo' : 'lineTo'](64 + Math.cos(angle) * r, 64 + Math.sin(angle) * r);
                    }
                    ctx.closePath();
                    ctx.fill();
                } else if (shape === 1) {
                    // Arrow
                    ctx.beginPath();
                    ctx.moveTo(20, 64);
                    ctx.lineTo(90, 64);
                    ctx.lineTo(75, 40);
                    ctx.moveTo(90, 64);
                    ctx.lineTo(75, 88);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 6;
                    ctx.stroke();
                } else {
                    // Circle with X
                    ctx.beginPath();
                    ctx.arc(64, 64, 35, 0, Math.PI * 2);
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 4;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(40, 40);
                    ctx.lineTo(88, 88);
                    ctx.moveTo(88, 40);
                    ctx.lineTo(40, 88);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }

            const tex = new THREE.CanvasTexture(canvas);
            tex.minFilter = THREE.LinearFilter;
            return tex;
        };

        // Pre-generate pool of textures + materials (shared per texture index)
        const styles = ['tag', 'abstract', 'stencil'];
        const materialPool = [];
        const geomBuckets = []; // one geometry array per material
        for (let i = 0; i < 12; i++) {
            const tex = makeGraffitiTexture(styles[i % 3]);
            materialPool.push(new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false
            }));
            geomBuckets.push([]);
        }

        // Collect graffiti geometry, grouped by material index
        const translate = new THREE.Matrix4();
        for (const bld of this.buildings) {
            if (bld.isWindow) continue;
            const distKey = bld.district;
            if (!graffitiDistricts.includes(distKey)) continue;
            if (bld.height < 5) continue;
            if (Math.random() > 0.2) continue; // 20% of eligible buildings

            const matIdx = Math.floor(Math.random() * 12);
            const face = Math.floor(Math.random() * 4);
            const grafW = 2 + Math.random() * 3;
            const grafH = 2 + Math.random() * 3;
            const yPos = 2 + Math.random() * Math.min(bld.height - 4, 6) + (bld.yOffset || 0);
            const geo = new THREE.PlaneGeometry(grafW, grafH);

            let gx = bld.x, gz = bld.z;
            if (face === 0) {
                gz += bld.depth / 2 + 0.05;
            } else if (face === 1) {
                gz -= bld.depth / 2 + 0.05;
                geo.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI));
            } else if (face === 2) {
                gx -= bld.width / 2 + 0.05;
                geo.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2));
            } else {
                gx += bld.width / 2 + 0.05;
                geo.applyMatrix4(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
            }

            if (face < 2) gx += (Math.random() - 0.5) * Math.max(0, bld.width - grafW);
            else gz += (Math.random() - 0.5) * Math.max(0, bld.depth - grafH);

            translate.makeTranslation(gx, yPos, gz);
            geo.applyMatrix4(translate);
            geomBuckets[matIdx].push(geo);
        }

        // Merge each bucket into a single mesh
        for (let i = 0; i < 12; i++) {
            if (geomBuckets[i].length === 0) continue;
            const merged = safeMerge(geomBuckets[i]);
            if (merged) {
                const mesh = new THREE.Mesh(merged, materialPool[i]);
                this.game.scene.add(mesh);
            }
            for (const g of geomBuckets[i]) g.dispose();
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

        // Collect pole and housing geometries for merging
        const poleGeoms = [];
        const housingGeoms = [];
        const rotMatrix = new THREE.Matrix4(); // identity, no rotation needed

        // Shared prototype geometries
        const protoPole = new THREE.CylinderGeometry(0.06, 0.06, 3.5, 4);
        const protoHousing = new THREE.BoxGeometry(0.2, 0.6, 0.15);
        const protoLight = new THREE.SphereGeometry(0.06, 6, 6);

        // 6 shared materials: NS and EW each have red, yellow, green
        // All NS lights of the same color share one material, enabling batch opacity updates
        const lightColors = [0xff0000, 0xffaa00, 0x00ff00];
        this._tlMats = {
            ns: lightColors.map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.2 })),
            ew: lightColors.map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.2 }))
        };

        // Collect light positions per axis per color for InstancedMesh
        const lightPositions = {
            ns: [[], [], []], // [red[], yellow[], green[]]
            ew: [[], [], []]
        };

        for (const pos of selectedPositions) {
            const offset = this.roadWidth / 2 + 0.5;

            const corners = [
                { x: pos.x + offset, z: pos.z + offset, axis: 'ns' },
                { x: pos.x - offset, z: pos.z - offset, axis: 'ew' },
            ];

            for (const corner of corners) {
                // Pole geometry - translate and collect for merge
                const pGeo = protoPole.clone();
                pGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(corner.x, 1.75, corner.z));
                poleGeoms.push(pGeo);

                // Housing geometry - translate and collect for merge
                const hGeo = protoHousing.clone();
                hGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(corner.x, 3.5, corner.z));
                housingGeoms.push(hGeo);

                // Light sphere positions
                for (let i = 0; i < 3; i++) {
                    lightPositions[corner.axis][i].push({
                        x: corner.x, y: 3.7 - i * 0.2, z: corner.z + 0.08
                    });
                }

                // Store data for game logic (isRedLight, pedestrian checks)
                this.trafficLights.push({
                    position: { x: corner.x, z: corner.z },
                    intersectionX: pos.x,
                    intersectionZ: pos.z,
                    axis: corner.axis
                });
            }
        }

        // Merge poles into one mesh
        if (poleGeoms.length > 0) {
            const merged = safeMerge(poleGeoms);
            const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 }));
            this.game.scene.add(mesh);
            for (const g of poleGeoms) g.dispose();
        }

        // Merge housings into one mesh
        if (housingGeoms.length > 0) {
            const merged = safeMerge(housingGeoms);
            const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0x222222 }));
            this.game.scene.add(mesh);
            for (const g of housingGeoms) g.dispose();
        }

        // Create 6 InstancedMeshes for light spheres (NS/EW x red/yellow/green)
        for (const axis of ['ns', 'ew']) {
            for (let ci = 0; ci < 3; ci++) {
                const posList = lightPositions[axis][ci];
                if (posList.length === 0) continue;
                const im = new THREE.InstancedMesh(protoLight, this._tlMats[axis][ci], posList.length);
                const mat4 = new THREE.Matrix4();
                for (let j = 0; j < posList.length; j++) {
                    mat4.makeTranslation(posList[j].x, posList[j].y, posList[j].z);
                    im.setMatrixAt(j, mat4);
                }
                im.instanceMatrix.needsUpdate = true;
                this.game.scene.add(im);
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

            // Update shared materials — all NS or EW lights change in sync
            for (const axis of ['ns', 'ew']) {
                const isNS = axis === 'ns';
                const effectivePhase = isNS ? this._trafficLightPhase : (this._trafficLightPhase + 2) % 4;
                const [redMat, yellowMat, greenMat] = this._tlMats[axis];
                switch (effectivePhase) {
                    case 0: // green
                        redMat.opacity = 0.2;
                        yellowMat.opacity = 0.2;
                        greenMat.opacity = 1.0;
                        break;
                    case 1: // yellow
                        redMat.opacity = 0.2;
                        yellowMat.opacity = 1.0;
                        greenMat.opacity = 0.2;
                        break;
                    case 2: // red
                        redMat.opacity = 1.0;
                        yellowMat.opacity = 0.2;
                        greenMat.opacity = 0.2;
                        break;
                    case 3: // still red
                        redMat.opacity = 1.0;
                        yellowMat.opacity = 0.2;
                        greenMat.opacity = 0.2;
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
        // Water surrounds the island — count as water if outside the landmass
        // The island extends from -halfMap to +halfMap (400)
        const margin = this.halfMap - 20; // 380 — slight inset for shore
        return Math.abs(x) > margin || Math.abs(z) > margin;
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
        this._createGroundPigeons();
        this._createStrayAnimals();
        this._createSeagulls();
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

    _createGroundPigeons() {
        this.pigeonFlocks = [];
        // Pigeons gather at plazas, parks, and sidewalk areas
        const pigeonSpots = [
            { x: 0, z: 0 },       // Downtown center
            { x: 50, z: -30 },    // Downtown park
            { x: -80, z: 80 },    // Near downtown
            { x: 220, z: -220 },  // The Strip
            { x: -220, z: 220 },  // Docks
            { x: 0, z: -250 },    // North Shore
            { x: -250, z: -200 }, // Hillside
            { x: 250, z: 100 },   // Eastgate
        ];

        for (const spot of pigeonSpots) {
            const count = 4 + Math.floor(Math.random() * 5);
            const pigeons = [];
            for (let i = 0; i < count; i++) {
                // Simple pigeon: small body + head
                const bodyGeo = new THREE.SphereGeometry(0.08, 6, 4);
                bodyGeo.scale(1, 0.6, 1.3);
                const headGeo = new THREE.SphereGeometry(0.04, 5, 4);
                headGeo.translate(0, 0.05, 0.1);
                const merged = safeMerge([bodyGeo, headGeo]);
                const colors = [0x555566, 0x666677, 0x444455, 0x777788];
                const mat = new THREE.MeshStandardMaterial({
                    color: colors[Math.floor(Math.random() * colors.length)],
                    roughness: 0.7
                });
                const mesh = new THREE.Mesh(merged, mat);
                const px = spot.x + (Math.random() - 0.5) * 8;
                const pz = spot.z + (Math.random() - 0.5) * 8;
                const py = this.getTerrainHeight(px, pz) + 0.08;
                mesh.position.set(px, py, pz);
                mesh.rotation.y = Math.random() * Math.PI * 2;
                this.game.scene.add(mesh);

                pigeons.push({
                    mesh,
                    baseX: px, baseZ: pz,
                    walkDir: Math.random() * Math.PI * 2,
                    walkTimer: Math.random() * 3,
                    pecking: Math.random() < 0.3,
                    scattered: false,
                    scatterVel: { x: 0, y: 0, z: 0 },
                    scatterTimer: 0
                });
                bodyGeo.dispose(); headGeo.dispose();
            }
            this.pigeonFlocks.push({ center: spot, pigeons, scatterRadius: 12 });
        }
    }

    _createStrayAnimals() {
        this.strayAnimals = [];
        // Stray cats in alley-like areas (near dumpsters, industrial, docks)
        const animalSpots = [
            { x: 30, z: 30, type: 'cat' },
            { x: -180, z: 220, type: 'cat' },
            { x: 200, z: 200, type: 'cat' },
            { x: -100, z: -50, type: 'dog' },
            { x: 100, z: -180, type: 'dog' },
            { x: -250, z: 260, type: 'dog' },
            { x: 250, z: -250, type: 'cat' },
            { x: -200, z: -180, type: 'dog' },
        ];

        for (const spot of animalSpots) {
            let mesh;
            if (spot.type === 'cat') {
                // Small cat body + head + tail
                const body = new THREE.BoxGeometry(0.15, 0.1, 0.3);
                body.translate(0, 0.12, 0);
                const head = new THREE.SphereGeometry(0.06, 5, 4);
                head.translate(0, 0.18, 0.17);
                const tail = new THREE.CylinderGeometry(0.015, 0.01, 0.2, 4);
                tail.rotateX(-0.8);
                tail.translate(0, 0.18, -0.2);
                const ears = [];
                for (const side of [-1, 1]) {
                    const ear = new THREE.ConeGeometry(0.025, 0.04, 3);
                    ear.translate(side * 0.035, 0.25, 0.17);
                    ears.push(ear);
                }
                const merged = safeMerge([body, head, tail, ...ears]);
                const catColors = [0x333333, 0x886644, 0xddaa66, 0x666666, 0xeeeeee];
                const mat = new THREE.MeshStandardMaterial({
                    color: catColors[Math.floor(Math.random() * catColors.length)],
                    roughness: 0.7
                });
                mesh = new THREE.Mesh(merged, mat);
                body.dispose(); head.dispose(); tail.dispose();
                for (const e of ears) e.dispose();
            } else {
                // Small dog body + head + legs
                const body = new THREE.BoxGeometry(0.18, 0.14, 0.35);
                body.translate(0, 0.18, 0);
                const head = new THREE.BoxGeometry(0.12, 0.1, 0.12);
                head.translate(0, 0.25, 0.2);
                const snout = new THREE.BoxGeometry(0.06, 0.05, 0.08);
                snout.translate(0, 0.22, 0.28);
                const tail = new THREE.CylinderGeometry(0.015, 0.01, 0.15, 4);
                tail.rotateX(-1.0);
                tail.translate(0, 0.25, -0.22);
                const legs = [];
                for (const sx of [-1, 1]) {
                    for (const sz of [-1, 1]) {
                        const leg = new THREE.CylinderGeometry(0.02, 0.02, 0.12, 4);
                        leg.translate(sx * 0.06, 0.06, sz * 0.12);
                        legs.push(leg);
                    }
                }
                const merged = safeMerge([body, head, snout, tail, ...legs]);
                const dogColors = [0x886644, 0x553311, 0xddaa66, 0x444444, 0xeeeeee];
                const mat = new THREE.MeshStandardMaterial({
                    color: dogColors[Math.floor(Math.random() * dogColors.length)],
                    roughness: 0.7
                });
                mesh = new THREE.Mesh(merged, mat);
                body.dispose(); head.dispose(); snout.dispose(); tail.dispose();
                for (const l of legs) l.dispose();
            }

            const px = spot.x + (Math.random() - 0.5) * 10;
            const pz = spot.z + (Math.random() - 0.5) * 10;
            mesh.position.set(px, this.getTerrainHeight(px, pz), pz);
            mesh.rotation.y = Math.random() * Math.PI * 2;
            this.game.scene.add(mesh);

            this.strayAnimals.push({
                mesh,
                type: spot.type,
                baseX: px, baseZ: pz,
                walkDir: Math.random() * Math.PI * 2,
                walkTimer: 2 + Math.random() * 5,
                state: 'idle', // idle, walking, fleeing
                fleeTimer: 0,
                speed: spot.type === 'cat' ? 4 : 3
            });
        }
    }

    _createSeagulls() {
        this.seagulls = [];
        // Seagulls at dock/port areas — low-flying, circling over water
        const docks = this.districts.docks;
        const portside = this.districts.portside;

        for (const dist of [docks, portside]) {
            for (let i = 0; i < 6; i++) {
                // Simple seagull: body + wings (two planes)
                const body = new THREE.CylinderGeometry(0.03, 0.02, 0.2, 4);
                body.rotateX(Math.PI / 2);
                const wing1 = new THREE.PlaneGeometry(0.35, 0.06);
                wing1.translate(-0.18, 0, 0);
                const wing2 = new THREE.PlaneGeometry(0.35, 0.06);
                wing2.translate(0.18, 0, 0);
                const merged = safeMerge([body, wing1, wing2]);
                const mat = new THREE.MeshStandardMaterial({
                    color: 0xeeeeee,
                    roughness: 0.6,
                    side: THREE.DoubleSide
                });
                const mesh = new THREE.Mesh(merged, mat);
                const cx = dist.center.x + (Math.random() - 0.5) * 80;
                const cz = dist.center.z + (Math.random() - 0.5) * 80;
                mesh.position.set(cx, 8 + Math.random() * 10, cz);
                this.game.scene.add(mesh);

                this.seagulls.push({
                    mesh,
                    centerX: cx, centerZ: cz,
                    radius: 15 + Math.random() * 20,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.3 + Math.random() * 0.3,
                    baseY: 8 + Math.random() * 10
                });
                body.dispose(); wing1.dispose(); wing2.dispose();
            }
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

        // Ground pigeons
        if (this.pigeonFlocks) {
            const player = this.game.systems.player;
            for (const flock of this.pigeonFlocks) {
                const pDist = Math.sqrt(
                    (flock.center.x - player.position.x) ** 2 +
                    (flock.center.z - player.position.z) ** 2
                );
                const scatterNow = pDist < flock.scatterRadius;

                for (const p of flock.pigeons) {
                    if (scatterNow && !p.scattered) {
                        // Scatter — fly away from player
                        p.scattered = true;
                        p.scatterTimer = 4 + Math.random() * 2;
                        const awayX = p.mesh.position.x - player.position.x;
                        const awayZ = p.mesh.position.z - player.position.z;
                        const len = Math.sqrt(awayX * awayX + awayZ * awayZ) || 1;
                        p.scatterVel.x = (awayX / len) * (4 + Math.random() * 3);
                        p.scatterVel.y = 3 + Math.random() * 2;
                        p.scatterVel.z = (awayZ / len) * (4 + Math.random() * 3);
                    }

                    if (p.scattered) {
                        p.scatterTimer -= dt;
                        p.mesh.position.x += p.scatterVel.x * dt;
                        p.mesh.position.y += p.scatterVel.y * dt;
                        p.mesh.position.z += p.scatterVel.z * dt;
                        p.scatterVel.y -= 2 * dt; // Gravity-ish (birds slow descent)
                        // Wing flap rotation
                        p.mesh.rotation.z = Math.sin(Date.now() * 0.02) * 0.3;

                        if (p.scatterTimer <= 0) {
                            // Return to ground near base
                            p.scattered = false;
                            p.mesh.position.set(
                                p.baseX + (Math.random() - 0.5) * 8,
                                this.getTerrainHeight(p.baseX, p.baseZ) + 0.08,
                                p.baseZ + (Math.random() - 0.5) * 8
                            );
                            p.mesh.rotation.z = 0;
                            p.mesh.rotation.y = Math.random() * Math.PI * 2;
                        }
                    } else {
                        // Idle pecking/walking
                        p.walkTimer -= dt;
                        if (p.walkTimer <= 0) {
                            p.walkDir = Math.random() * Math.PI * 2;
                            p.walkTimer = 1 + Math.random() * 3;
                            p.pecking = Math.random() < 0.4;
                        }
                        if (!p.pecking) {
                            p.mesh.position.x += Math.sin(p.walkDir) * 0.3 * dt;
                            p.mesh.position.z += Math.cos(p.walkDir) * 0.3 * dt;
                            p.mesh.rotation.y = p.walkDir;
                        } else {
                            // Pecking head bob
                            p.mesh.rotation.x = Math.sin(Date.now() * 0.01) * 0.2;
                        }
                        p.mesh.position.y = this.getTerrainHeight(p.mesh.position.x, p.mesh.position.z) + 0.08;
                    }
                }
            }
        }

        // Stray animals
        if (this.strayAnimals) {
            const player = this.game.systems.player;
            for (const animal of this.strayAnimals) {
                const dx = animal.mesh.position.x - player.position.x;
                const dz = animal.mesh.position.z - player.position.z;
                const pDist = Math.sqrt(dx * dx + dz * dz);

                if (animal.state === 'fleeing') {
                    animal.fleeTimer -= dt;
                    animal.mesh.position.x += Math.sin(animal.walkDir) * animal.speed * 1.5 * dt;
                    animal.mesh.position.z += Math.cos(animal.walkDir) * animal.speed * 1.5 * dt;
                    animal.mesh.position.y = this.getTerrainHeight(animal.mesh.position.x, animal.mesh.position.z);
                    if (animal.fleeTimer <= 0) {
                        animal.state = 'idle';
                        animal.walkTimer = 3 + Math.random() * 5;
                    }
                } else if (pDist < 8) {
                    // Flee from player
                    animal.state = 'fleeing';
                    animal.fleeTimer = 3;
                    animal.walkDir = Math.atan2(dx, dz);
                    animal.mesh.rotation.y = animal.walkDir;
                } else {
                    animal.walkTimer -= dt;
                    if (animal.walkTimer <= 0) {
                        if (animal.state === 'idle') {
                            animal.state = 'walking';
                            animal.walkDir = Math.random() * Math.PI * 2;
                            animal.walkTimer = 2 + Math.random() * 3;
                        } else {
                            animal.state = 'idle';
                            animal.walkTimer = 3 + Math.random() * 5;
                        }
                    }
                    if (animal.state === 'walking') {
                        animal.mesh.position.x += Math.sin(animal.walkDir) * animal.speed * 0.3 * dt;
                        animal.mesh.position.z += Math.cos(animal.walkDir) * animal.speed * 0.3 * dt;
                        animal.mesh.rotation.y = animal.walkDir;
                        animal.mesh.position.y = this.getTerrainHeight(animal.mesh.position.x, animal.mesh.position.z);
                    }
                    // Keep near base area
                    const distFromBase = Math.sqrt((animal.mesh.position.x - animal.baseX) ** 2 + (animal.mesh.position.z - animal.baseZ) ** 2);
                    if (distFromBase > 20) {
                        animal.walkDir = Math.atan2(animal.baseX - animal.mesh.position.x, animal.baseZ - animal.mesh.position.z);
                        animal.state = 'walking';
                        animal.walkTimer = 2;
                    }
                }
            }
        }

        // Seagulls — circle over water areas
        if (this.seagulls) {
            for (const gull of this.seagulls) {
                gull.phase += dt * gull.speed;
                gull.mesh.position.x = gull.centerX + Math.cos(gull.phase) * gull.radius;
                gull.mesh.position.z = gull.centerZ + Math.sin(gull.phase) * gull.radius;
                gull.mesh.position.y = gull.baseY + Math.sin(gull.phase * 2) * 1.5;
                // Face direction of travel
                gull.mesh.rotation.y = gull.phase + Math.PI / 2;
                // Gentle wing flap (slight roll)
                gull.mesh.rotation.z = Math.sin(gull.phase * 4) * 0.15;
            }
        }
    }
}
