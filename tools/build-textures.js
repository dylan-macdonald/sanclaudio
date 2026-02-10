#!/usr/bin/env node
// San Claudio — Texture Build Pipeline
// Generates all canvas textures as PNG files for inspection and runtime loading.
// Also generates terrain heightmap.
// Run: cd tools && node build-textures.js

import { createCanvas } from 'canvas';
import * as THREE from 'three';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'assets', 'textures');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');

// Ensure output directories exist
function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Seeded PRNG ─────────────────────────────────────────────────
// Mulberry32 — deterministic random for reproducible textures
function mulberry32(seed) {
    let a = seed | 0;
    return function () {
        a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Replace Math.random with seeded version during generation
let _rng = mulberry32(42);
const _origRandom = Math.random;
function useSeed(seed) { _rng = mulberry32(seed); Math.random = _rng; }
function restoreRandom() { Math.random = _origRandom; }

// ─── Helper: save canvas as PNG ──────────────────────────────────
function savePNG(canvas, relPath) {
    const fullPath = path.join(OUT_DIR, relPath);
    ensureDir(path.dirname(fullPath));
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(fullPath, buf);
    const kb = (buf.length / 1024).toFixed(1);
    console.log(`  ✓ ${relPath} (${canvas.width}×${canvas.height}, ${kb} KB)`);
    return relPath;
}

// ─── Color Helpers (replicating THREE.Color operations) ──────────
function hexToRGB(hex) {
    const c = new THREE.Color(hex);
    return { r: c.r, g: c.g, b: c.b };
}

function rgbToHex(r, g, b) {
    const c = new THREE.Color(r, g, b);
    return '#' + c.getHexString();
}

function averageColor(colors) {
    const c = new THREE.Color(0);
    for (const hex of colors) c.add(new THREE.Color(hex));
    c.multiplyScalar(1 / colors.length);
    return c;
}

// ─── District Definitions ────────────────────────────────────────
const districts = {
    downtown: {
        name: 'Downtown', colors: [0x4a5a78, 0x3d4d6a, 0x5a6a88, 0x6a7a98, 0x3a4a68]
    },
    docks: {
        name: 'The Docks', colors: [0x6a5040, 0x7a6050, 0x5a4535, 0x8a7060, 0x4a3525]
    },
    hillside: {
        name: 'Hillside', colors: [0x90a870, 0xa0b880, 0x80a060, 0xb0c890, 0x70a050]
    },
    strip: {
        name: 'The Strip', colors: [0xaa4488, 0xbb5599, 0x8844aa, 0xcc66aa, 0x9955bb]
    },
    industrial: {
        name: 'Industrial Park', colors: [0x505050, 0x606060, 0x555555, 0x707070, 0x484848]
    },
    northshore: {
        name: 'North Shore', colors: [0x7a8a68, 0x8a9a78, 0x6a7a58]
    },
    portside: {
        name: 'Portside', colors: [0x5a6a7a, 0x6a7a8a, 0x4a5a6a]
    },
    westend: {
        name: 'West End', colors: [0x8a7060, 0x9a8070, 0x7a6050]
    },
    eastgate: {
        name: 'Eastgate', colors: [0x6a6a8a, 0x7a7a9a, 0x5a5a7a]
    }
};

// ═══════════════════════════════════════════════════════════════════
// TEXTURE GENERATORS — extracted from game runtime code
// ═══════════════════════════════════════════════════════════════════

// ─── Building Facade ─────────────────────────────────────────────
function generateBuildingTexture(color, districtKey) {
    const canvas = createCanvas(256, 512);
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

    // Floor separation lines
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    for (let y = 30; y < 512; y += 30 + Math.random() * 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
    }

    // Brick/concrete masonry pattern
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

    // Base grime gradient at bottom ~20%
    const grimeGrad = ctx.createLinearGradient(0, 512 * 0.75, 0, 512);
    grimeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    grimeGrad.addColorStop(0.4, 'rgba(0,0,0,0.12)');
    grimeGrad.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = grimeGrad;
    ctx.fillRect(0, 512 * 0.75, 256, 512 * 0.25);

    // Extra dark grime at very bottom
    const streetGrime = ctx.createLinearGradient(0, 512 * 0.92, 0, 512);
    streetGrime.addColorStop(0, 'rgba(20,15,10,0)');
    streetGrime.addColorStop(1, 'rgba(20,15,10,0.35)');
    ctx.fillStyle = streetGrime;
    ctx.fillRect(0, 512 * 0.92, 256, 512 * 0.08);

    // Stains
    for (let i = 0; i < 4; i++) {
        const sx = Math.random() * 256;
        const sy = Math.random() * 512;
        const sr = 8 + Math.random() * 20;
        ctx.beginPath();
        ctx.ellipse(sx, sy, sr, sr * (0.6 + Math.random() * 0.8), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.floor(Math.random() * 30)},${Math.floor(Math.random() * 20)},${Math.floor(Math.random() * 15)},${0.06 + Math.random() * 0.1})`;
        ctx.fill();
    }

    // Water streaks
    for (let i = 0; i < 5; i++) {
        const wx = Math.random() * 256;
        const wy = Math.random() * 256;
        const wLen = 60 + Math.random() * 200;
        ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`;
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        for (let d = 0; d < wLen; d += 10) {
            ctx.lineTo(wx + (Math.random() - 0.5) * 2, wy + d);
        }
        ctx.stroke();
    }

    // Ground floor shopfront (bottom 18%)
    const shopTop = Math.floor(512 * 0.82);
    const shopH = 512 - shopTop;

    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, shopTop, 256, shopH);

    // Display windows
    ctx.fillStyle = 'rgba(120,140,160,0.25)';
    const winY = shopTop + 6;
    const winH = shopH - 22;
    ctx.fillRect(15, winY, 100, winH);
    ctx.fillRect(140, winY, 100, winH);
    ctx.strokeStyle = 'rgba(40,35,30,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(15, winY, 100, winH);
    ctx.strokeRect(140, winY, 100, winH);
    // Window reflections
    ctx.strokeStyle = 'rgba(180,190,200,0.15)';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(25, winY + winH); ctx.lineTo(65, winY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(150, winY + winH); ctx.lineTo(190, winY); ctx.stroke();

    // Door
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(118, winY, 18, winH);
    ctx.strokeStyle = 'rgba(60,55,50,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(119, winY + 2, 16, winH - 2);
    ctx.fillStyle = 'rgba(150,140,120,0.5)';
    ctx.fillRect(130, winY + winH * 0.5, 3, 6);

    // Window blinds (20% of upper-floor windows)
    for (let fy = 30; fy < shopTop - 30; fy += 30 + Math.floor(Math.random() * 8)) {
        for (let fx = 20; fx < 240; fx += 50 + Math.floor(Math.random() * 20)) {
            if (Math.random() < 0.2) {
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

    // AC drip stains
    for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.5) continue;
        const acX = 30 + Math.random() * 190;
        const acY = 80 + Math.random() * 250;
        ctx.fillStyle = 'rgba(90,88,85,0.25)';
        ctx.fillRect(acX, acY, 14, 8);
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

    // Graffiti for gritty districts
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

    return canvas;
}

// ─── Road Texture ────────────────────────────────────────────────
function generateRoadTexture() {
    const canvas = createCanvas(512, 512);
    const ctx = canvas.getContext('2d');

    // Base dark gray asphalt
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, 512, 512);

    // Asphalt grain
    for (let i = 0; i < 3000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const shade = 30 + Math.floor(Math.random() * 25);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
    }

    // Larger grain particles
    for (let i = 0; i < 500; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const shade = 35 + Math.floor(Math.random() * 20);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(x, y, 2, 2);
    }

    // Oil stains
    for (let i = 0; i < 6; i++) {
        const ox = Math.random() * 512;
        const oy = Math.random() * 512;
        const or_ = 10 + Math.random() * 30;
        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, or_);
        grad.addColorStop(0, `rgba(10,8,5,${0.15 + Math.random() * 0.15})`);
        grad.addColorStop(0.6, `rgba(10,8,5,${0.05 + Math.random() * 0.05})`);
        grad.addColorStop(1, 'rgba(10,8,5,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(ox - or_, oy - or_, or_ * 2, or_ * 2);
    }

    // Repair patches
    for (let i = 0; i < 3; i++) {
        const px = Math.random() * 400;
        const py = Math.random() * 400;
        const pw = 30 + Math.random() * 60;
        const ph = 20 + Math.random() * 40;
        ctx.fillStyle = `rgba(${50 + Math.floor(Math.random() * 15)},${50 + Math.floor(Math.random() * 15)},${50 + Math.floor(Math.random() * 15)},${0.3 + Math.random() * 0.2})`;
        ctx.fillRect(px, py, pw, ph);
    }

    // Crack lines
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

    // Lane markings — yellow center line (dashed)
    ctx.strokeStyle = '#c8b832';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 10]);
    ctx.beginPath(); ctx.moveTo(256, 0); ctx.lineTo(256, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(262, 0); ctx.lineTo(262, 512); ctx.stroke();
    ctx.setLineDash([]);

    // White lane dividers
    ctx.strokeStyle = 'rgba(220,220,220,0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 12]);
    ctx.beginPath(); ctx.moveTo(170, 0); ctx.lineTo(170, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(342, 0); ctx.lineTo(342, 512); ctx.stroke();
    ctx.setLineDash([]);

    // White edge lines (solid)
    ctx.strokeStyle = 'rgba(200,200,200,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(20, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(492, 0); ctx.lineTo(492, 512); ctx.stroke();

    // Tire wear marks
    ctx.strokeStyle = 'rgba(55,55,55,0.15)';
    ctx.lineWidth = 12;
    for (const laneX of [120, 200, 310, 390]) {
        ctx.beginPath();
        ctx.moveTo(laneX, 0);
        ctx.lineTo(laneX + (Math.random() - 0.5) * 4, 512);
        ctx.stroke();
    }

    return canvas;
}

// ─── Ground/Pavement Texture ─────────────────────────────────────
function generateGroundTexture() {
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#4a4a48';
    ctx.fillRect(0, 0, 256, 256);

    // Concrete panel grid
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    const panelSize = 32;
    for (let x = 0; x <= 256; x += panelSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
    }
    for (let y = 0; y <= 256; y += panelSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }

    // Per-panel color variation
    for (let px = 0; px < 256; px += panelSize) {
        for (let py = 0; py < 256; py += panelSize) {
            const shade = Math.floor(Math.random() * 10) - 5;
            ctx.fillStyle = `rgba(${74 + shade},${74 + shade},${72 + shade},0.15)`;
            ctx.fillRect(px + 1, py + 1, panelSize - 2, panelSize - 2);
        }
    }

    // Dirt patches
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

    // Wear marks
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

    // Fine noise
    for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const shade = 60 + Math.floor(Math.random() * 30);
        ctx.fillStyle = `rgba(${shade},${shade},${shade},0.08)`;
        ctx.fillRect(x, y, 1, 1);
    }

    return canvas;
}

// ─── Sidewalk Texture ────────────────────────────────────────────
function generateSidewalkTexture() {
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#5a5a58';
    ctx.fillRect(0, 0, 256, 256);

    // Slab grid
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1.5;
    const slabSize = 42;
    for (let x = 0; x <= 256; x += slabSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
    }
    for (let y = 0; y <= 256; y += slabSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }

    // Per-slab variation
    for (let px = 0; px < 256; px += slabSize) {
        for (let py = 0; py < 256; py += slabSize) {
            const shade = Math.floor(Math.random() * 12) - 6;
            ctx.fillStyle = `rgba(${90 + shade},${90 + shade},${88 + shade},0.12)`;
            ctx.fillRect(px + 2, py + 2, slabSize - 4, slabSize - 4);
        }
    }

    // Gum spots
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

    // Drain grate
    const drainX = 200 + Math.random() * 30;
    const drainY = 20 + Math.random() * 30;
    const drainW = 22, drainH = 10;
    ctx.fillStyle = 'rgba(15,12,10,0.6)';
    ctx.fillRect(drainX, drainY, drainW, drainH);
    ctx.strokeStyle = 'rgba(40,35,30,0.8)';
    ctx.lineWidth = 1;
    for (let dx = 0; dx < drainW; dx += 4) {
        ctx.beginPath();
        ctx.moveTo(drainX + dx, drainY);
        ctx.lineTo(drainX + dx, drainY + drainH);
        ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(80,75,70,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(drainX - 0.5, drainY - 0.5, drainW + 1, drainH + 1);

    // Manhole cover
    const mhX = 110 + Math.random() * 40;
    const mhY = 120 + Math.random() * 40;
    const mhR = 10;
    ctx.fillStyle = 'rgba(55,52,48,0.5)';
    ctx.beginPath(); ctx.arc(mhX, mhY, mhR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(40,38,35,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(mhX - mhR + 2, mhY); ctx.lineTo(mhX + mhR - 2, mhY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mhX, mhY - mhR + 2); ctx.lineTo(mhX, mhY + mhR - 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(70,65,60,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(mhX, mhY, mhR, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(mhX, mhY, mhR - 2, 0, Math.PI * 2); ctx.stroke();

    // Curb color zones
    if (Math.random() < 0.3) {
        ctx.fillStyle = 'rgba(180,40,30,0.25)';
        ctx.fillRect(0, 0, 256, 4);
    }
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

    return canvas;
}

// ─── Water Texture ───────────────────────────────────────────────
function generateWaterTexture() {
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');

    // Deep blue base
    ctx.fillStyle = '#1a3555';
    ctx.fillRect(0, 0, 256, 256);

    // Caustic network
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

    // Bright highlights
    for (let i = 0; i < 15; i++) {
        const hx = Math.random() * 256, hy = Math.random() * 256;
        const hr = 3 + Math.random() * 8;
        const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
        grad.addColorStop(0, 'rgba(150,200,240,0.2)');
        grad.addColorStop(1, 'rgba(150,200,240,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
    }

    // Foam/surface noise
    for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(180,210,230,${0.03 + Math.random() * 0.04})`;
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random(), 1 + Math.random());
    }

    return canvas;
}

// ─── Sky Gradient Texture ────────────────────────────────────────
function generateSkyTexture() {
    const canvas = createCanvas(1, 256);
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#1a3066');     // Deep blue at top
    grad.addColorStop(0.3, '#4488cc');   // Medium blue
    grad.addColorStop(0.6, '#88bbee');   // Light blue
    grad.addColorStop(0.85, '#bbddff');  // Very light near horizon
    grad.addColorStop(1.0, '#ddeeff');   // Almost white at horizon
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1, 256);

    return canvas;
}

// ─── Cloud Texture ───────────────────────────────────────────────
function generateCloudTexture() {
    const canvas = createCanvas(128, 64);
    const ctx = canvas.getContext('2d');

    // Transparent background
    ctx.clearRect(0, 0, 128, 64);

    // 5 overlapping circles forming cloud shape
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const circles = [
        [40, 35, 20], [60, 28, 25], [80, 35, 22],
        [50, 42, 18], [70, 42, 18]
    ];
    for (const [cx, cy, r] of circles) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    return canvas;
}

// ─── Moon Texture ────────────────────────────────────────────────
function generateMoonTexture() {
    const canvas = createCanvas(128, 128);
    const ctx = canvas.getContext('2d');

    // Base
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, '#eeeecc');
    grad.addColorStop(0.7, '#ccccaa');
    grad.addColorStop(1, '#999977');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();

    // Craters
    const craters = [
        [45, 40, 12], [75, 55, 8], [55, 75, 10],
        [35, 65, 6], [80, 35, 9], [65, 45, 5],
        [50, 55, 7], [70, 70, 6]
    ];
    for (const [cx, cy, r] of craters) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(150,150,120,${0.3 + Math.random() * 0.2})`;
        ctx.fill();
        // Highlight rim
        ctx.beginPath();
        ctx.arc(cx - 1, cy - 1, r + 1, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(200,200,180,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Surface noise
    for (let i = 0; i < 300; i++) {
        const x = 64 + (Math.random() - 0.5) * 100;
        const y = 64 + (Math.random() - 0.5) * 100;
        const dist = Math.sqrt((x - 64) ** 2 + (y - 64) ** 2);
        if (dist < 55) {
            ctx.fillStyle = `rgba(${170 + Math.floor(Math.random() * 40)},${170 + Math.floor(Math.random() * 40)},${140 + Math.floor(Math.random() * 30)},0.1)`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    return canvas;
}

// ─── Vehicle Textures ────────────────────────────────────────────
function generateSedanTexture() {
    const canvas = createCanvas(512, 256);
    const ctx = canvas.getContext('2d');

    // Base near-white (gets tinted by vertex/material color at runtime)
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, 512, 256);

    // Fine metallic grain
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 256;
        const shade = 230 + Math.floor(Math.random() * 25);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(x, y, 1, 1);
    }

    // Horizontal highlight band (environment reflection)
    const hlGrad = ctx.createLinearGradient(0, 80, 0, 160);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0)');
    hlGrad.addColorStop(0.3, 'rgba(255,255,255,0.08)');
    hlGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    hlGrad.addColorStop(0.7, 'rgba(255,255,255,0.08)');
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad;
    ctx.fillRect(0, 80, 512, 80);

    // Panel lines
    ctx.strokeStyle = '#aaaaaa';
    ctx.lineWidth = 1.5;
    // Door seam 1
    ctx.beginPath(); ctx.moveTo(512 * 0.30, 30); ctx.lineTo(512 * 0.30, 210); ctx.stroke();
    // Door seam 2
    ctx.beginPath(); ctx.moveTo(512 * 0.50, 30); ctx.lineTo(512 * 0.50, 210); ctx.stroke();
    // Hood seam
    ctx.beginPath(); ctx.moveTo(20, 50); ctx.lineTo(492, 50); ctx.stroke();
    // Trunk seam
    ctx.beginPath(); ctx.moveTo(20, 206); ctx.lineTo(492, 206); ctx.stroke();

    // Bottom rocker panel grime
    const grimeGrad = ctx.createLinearGradient(0, 218, 0, 256);
    grimeGrad.addColorStop(0, 'rgba(80,70,60,0)');
    grimeGrad.addColorStop(0.3, 'rgba(80,70,60,0.15)');
    grimeGrad.addColorStop(1, 'rgba(60,50,40,0.35)');
    ctx.fillStyle = grimeGrad;
    ctx.fillRect(0, 218, 512, 38);

    // Wheel well shadows
    ctx.fillStyle = 'rgba(40,35,30,0.3)';
    ctx.beginPath(); ctx.arc(512 * 0.20, 240, 30, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(512 * 0.80, 240, 30, Math.PI, 0); ctx.fill();

    return canvas;
}

function generateTruckTexture() {
    const canvas = createCanvas(512, 256);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, 512, 256);

    // Panel divisions
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(512 * 0.40, 10); ctx.lineTo(512 * 0.40, 246); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 128); ctx.lineTo(502, 128); ctx.stroke();

    // Rivet dots
    ctx.fillStyle = '#666666';
    for (let x = 30; x < 500; x += 25) {
        ctx.beginPath(); ctx.arc(x, 15, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x, 241, 2, 0, Math.PI * 2); ctx.fill();
    }
    for (let y = 20; y < 250; y += 25) {
        ctx.beginPath(); ctx.arc(512 * 0.40, y, 2, 0, Math.PI * 2); ctx.fill();
    }

    // Cargo bed wood grain
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
    }

    // Bottom grime
    const grimeGrad = ctx.createLinearGradient(0, 218, 0, 256);
    grimeGrad.addColorStop(0, 'rgba(80,70,60,0)');
    grimeGrad.addColorStop(0.3, 'rgba(80,70,60,0.15)');
    grimeGrad.addColorStop(1, 'rgba(60,50,40,0.35)');
    ctx.fillStyle = grimeGrad;
    ctx.fillRect(0, 218, 512, 38);

    // Wheel wells
    ctx.fillStyle = 'rgba(40,35,30,0.3)';
    ctx.beginPath(); ctx.arc(512 * 0.18, 242, 35, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(512 * 0.82, 242, 35, Math.PI, 0); ctx.fill();

    return canvas;
}

function generateMotorcycleTexture() {
    const canvas = createCanvas(256, 128);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, 256, 128);

    // Grain
    for (let i = 0; i < 500; i++) {
        const shade = 230 + Math.floor(Math.random() * 25);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(Math.random() * 256, Math.random() * 128, 1, 1);
    }

    // Center pinstripe
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 128); ctx.stroke();

    // Accent lines
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(120, 0); ctx.lineTo(120, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(136, 0); ctx.lineTo(136, 128); ctx.stroke();

    return canvas;
}

function generateHelicopterTexture() {
    const canvas = createCanvas(256, 128);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, 256, 128);

    // Panel seam lines
    ctx.strokeStyle = '#aaaaaa';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(192, 0); ctx.lineTo(192, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 64); ctx.lineTo(256, 64); ctx.stroke();

    // Rotor blur stripes
    ctx.strokeStyle = 'rgba(100,100,100,0.1)';
    ctx.lineWidth = 4;
    for (let y = 10; y < 128; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }

    return canvas;
}

function generateBoatTexture() {
    const canvas = createCanvas(256, 128);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 256, 128);

    // Waterline division
    const wlGrad = ctx.createLinearGradient(0, 80, 0, 128);
    wlGrad.addColorStop(0, 'rgba(60,80,100,0)');
    wlGrad.addColorStop(0.3, 'rgba(60,80,100,0.1)');
    wlGrad.addColorStop(1, 'rgba(40,60,80,0.25)');
    ctx.fillStyle = wlGrad;
    ctx.fillRect(0, 80, 256, 48);

    // Waterline stripe
    ctx.strokeStyle = '#3366aa';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 82); ctx.lineTo(256, 82); ctx.stroke();

    // Boat name (use seed-consistent name)
    const names = ['SEA BREEZE', 'WAVE RUNNER', 'ISLAND QUEEN', 'SC SPIRIT', 'TIDE RIDER'];
    const name = names[Math.floor(Math.random() * names.length)];
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#334466';
    ctx.fillText(name, 80, 70);

    return canvas;
}

function generatePoliceTexture() {
    const canvas = createCanvas(512, 256);
    const ctx = canvas.getContext('2d');

    // Upper body (light gray)
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, 512, 256 * 0.6);

    // Lower body (darker)
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, 256 * 0.6, 512, 256 * 0.4);

    // Dividing stripe
    ctx.strokeStyle = '#4488cc';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 256 * 0.6); ctx.lineTo(512, 256 * 0.6); ctx.stroke();

    // Unit number
    const unitNum = 100 + Math.floor(Math.random() * 900);
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText(`SC-${unitNum}`, 200, 100);

    // POLICE text
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('POLICE', 220, 256 * 0.6 + 30);

    // Chrome bottom band
    const chromeGrad = ctx.createLinearGradient(0, 230, 0, 256);
    chromeGrad.addColorStop(0, 'rgba(180,180,180,0.3)');
    chromeGrad.addColorStop(0.5, 'rgba(220,220,220,0.4)');
    chromeGrad.addColorStop(1, 'rgba(140,140,140,0.3)');
    ctx.fillStyle = chromeGrad;
    ctx.fillRect(0, 230, 512, 26);

    return canvas;
}

function generateFallbackVehicleTexture() {
    const canvas = createCanvas(64, 64);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 64, 64);
    return canvas;
}

// ─── Tree Textures ───────────────────────────────────────────────
function generateTreeTexture(type) {
    const canvas = createCanvas(128, 128);
    const ctx = canvas.getContext('2d');

    // Near-white base (gets tinted by vertex color)
    ctx.fillStyle = '#f8fff8';
    ctx.fillRect(0, 0, 128, 128);

    if (type === 'evergreen') {
        // Diagonal needle hatching
        ctx.strokeStyle = 'rgba(0,60,0,0.15)';
        ctx.lineWidth = 1;
        for (let i = -128; i < 256; i += 6) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + 64, 128);
            ctx.stroke();
        }
        // Dark depth spots
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = `rgba(0,40,0,${0.05 + Math.random() * 0.08})`;
            ctx.beginPath();
            ctx.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        // Deciduous: horizontal leaf layers
        ctx.strokeStyle = 'rgba(0,50,0,0.12)';
        ctx.lineWidth = 2;
        for (let y = 0; y < 128; y += 8) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x < 128; x += 10) {
                ctx.lineTo(x + 10, y + (Math.random() - 0.5) * 4);
            }
            ctx.stroke();
        }
        // Leaf cluster spots
        for (let i = 0; i < 50; i++) {
            const shade = Math.random() < 0.5 ? 'rgba(0,50,0,0.06)' : 'rgba(30,80,10,0.05)';
            ctx.fillStyle = shade;
            ctx.beginPath();
            ctx.arc(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    return canvas;
}

// ─── Sign Textures ───────────────────────────────────────────────
function generateAmmuNationSign() {
    const canvas = createCanvas(256, 64);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#ff8800';
    ctx.textAlign = 'center';
    ctx.fillText('AMMU-NATION', 128, 42);
    return canvas;
}

function generatePayNSpraySign() {
    const canvas = createCanvas(256, 64);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#33ff33';
    ctx.textAlign = 'center';
    ctx.fillText('PAY N SPRAY', 128, 42);
    return canvas;
}

// ─── Terrain Heightmap ───────────────────────────────────────────
function generateTerrainHeightmap() {
    const mapSize = 800;
    const resolution = 800; // 1 pixel per unit
    const canvas = createCanvas(resolution, resolution);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(resolution, resolution);

    let maxHeight = 0;

    // First pass: compute all heights to find max for normalization
    const heights = new Float32Array(resolution * resolution);
    for (let py = 0; py < resolution; py++) {
        for (let px = 0; px < resolution; px++) {
            // Map pixel to world coordinates
            const x = (px / resolution - 0.5) * mapSize;
            const z = (py / resolution - 0.5) * mapSize;
            const h = getTerrainHeight(x, z);
            heights[py * resolution + px] = h;
            if (h > maxHeight) maxHeight = h;
        }
    }

    // Second pass: normalize to 0-255 and write pixels
    const scale = maxHeight > 0 ? 255 / maxHeight : 1;
    for (let py = 0; py < resolution; py++) {
        for (let px = 0; px < resolution; px++) {
            const h = heights[py * resolution + px];
            const v = Math.floor(h * scale);
            const idx = (py * resolution + px) * 4;
            imageData.data[idx] = v;
            imageData.data[idx + 1] = v;
            imageData.data[idx + 2] = v;
            imageData.data[idx + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return { canvas, maxHeight };
}

// Current terrain height function (mirrored from world.js getTerrainHeight)
function getTerrainHeight(x, z) {
    const smoothstep = (d, r) => {
        if (d >= r) return 0;
        const t = 1 - d / r;
        return t * t * (3 - 2 * t);
    };

    let height = 0;

    // District elevation zones (1.5x scale)
    const hillDist = Math.sqrt((x + 275) * (x + 275) + (z + 275) * (z + 275));
    height += 165 * smoothstep(hillDist, 280);

    const dtDist = Math.sqrt(x * x + z * z);
    height += 27 * smoothstep(dtDist, 150);

    const nsDist = Math.sqrt(x * x + (z + 300) * (z + 300));
    height += 52 * smoothstep(nsDist, 180);

    const stripDist = Math.sqrt((x - 275) * (x - 275) + (z + 275) * (z + 275));
    height += 38 * smoothstep(stripDist, 160);

    const weDist = Math.sqrt((x + 275) * (x + 275) + z * z);
    height += 38 * smoothstep(weDist, 180);

    const egDist = Math.sqrt((x - 275) * (x - 275) + z * z);
    height += 22 * smoothstep(egDist, 160);

    const dkDist = Math.sqrt((x + 275) * (x + 275) + (z - 275) * (z - 275));
    height += 9 * smoothstep(dkDist, 160);

    const indDist = Math.sqrt((x - 275) * (x - 275) + (z - 275) * (z - 275));
    height += 12 * smoothstep(indDist, 160);

    const psDist = Math.sqrt(x * x + (z - 275) * (z - 275));
    height += 12 * smoothstep(psDist, 150);

    // Coastal falloff
    const halfMap = 400;
    const coastMargin = 60;
    const edgeDistX = halfMap - Math.abs(x);
    const edgeDistZ = halfMap - Math.abs(z);
    const edgeDist = Math.min(edgeDistX, edgeDistZ);
    if (edgeDist < coastMargin) {
        const coastFactor = Math.max(0, edgeDist / coastMargin);
        height *= coastFactor * coastFactor * (3 - 2 * coastFactor);
    }

    // Deterministic noise
    const nx = x * 0.03;
    const nz = z * 0.03;
    const noise1 = Math.sin(nx * 1.7 + nz * 2.3) * Math.cos(nz * 1.3 - nx * 0.7);
    const noise2 = Math.sin(nx * 3.1 + 1.7) * Math.cos(nz * 2.7 + 0.9) * 0.5;
    height += (noise1 + noise2) * 3.75;

    return Math.max(0, height);
}

// ─── Graffiti Pool Textures ──────────────────────────────────────
function generateGraffitiTexture(style, variant) {
    const canvas = createCanvas(128, 128);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);

    const colors = ['#e83030', '#30e830', '#4080ff', '#ff80ff', '#ffff40', '#ff8800'];
    const color = colors[variant % colors.length];

    if (style === 'tag') {
        const tags = ['VICE', 'SC KINGS', 'NWA', '187', 'CLAUDIO', 'BTK', 'NOIZ', 'BLVD'];
        ctx.font = `bold ${18 + Math.random() * 14}px Arial`;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.7 + Math.random() * 0.3;
        ctx.save();
        ctx.translate(64, 64);
        ctx.rotate((Math.random() - 0.5) * 0.4);
        ctx.fillText(tags[variant % tags.length], -30, 0);
        ctx.restore();
    } else if (style === 'abstract') {
        // Random geometric shapes
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.3 + Math.random() * 0.4;
            ctx.beginPath();
            const cx = Math.random() * 128;
            const cy = Math.random() * 128;
            ctx.arc(cx, cy, 5 + Math.random() * 20, 0, Math.PI * 2);
            ctx.fill();
        }
        // Splatter dots
        for (let i = 0; i < 15; i++) {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.2 + Math.random() * 0.3;
            ctx.beginPath();
            ctx.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        // Stencil style
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6 + Math.random() * 0.3;
        const stencils = ['★', '✦', '⚡', '☮', '✊'];
        ctx.font = `bold ${40 + Math.random() * 20}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(stencils[variant % stencils.length], 64, 80);
    }

    ctx.globalAlpha = 1.0;
    return canvas;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN BUILD
// ═══════════════════════════════════════════════════════════════════

async function main() {
    console.log('🏗️  San Claudio — Texture Build Pipeline');
    console.log('─'.repeat(50));

    ensureDir(OUT_DIR);
    const manifest = {};

    // ─── Surface Textures ────────────────────────────────────────
    console.log('\n📦 Surface Textures:');
    useSeed(100);
    manifest['road'] = savePNG(generateRoadTexture(), 'surfaces/road.png');

    useSeed(200);
    manifest['ground'] = savePNG(generateGroundTexture(), 'surfaces/ground.png');

    useSeed(300);
    manifest['sidewalk'] = savePNG(generateSidewalkTexture(), 'surfaces/sidewalk.png');

    useSeed(400);
    manifest['water'] = savePNG(generateWaterTexture(), 'surfaces/water.png');

    // ─── Building Textures (per district) ────────────────────────
    console.log('\n🏢 Building Textures:');
    let buildingSeed = 1000;
    for (const [key, district] of Object.entries(districts)) {
        useSeed(buildingSeed);
        const avgColor = averageColor(district.colors);
        const canvas = generateBuildingTexture(avgColor, key);
        manifest[`building_${key}`] = savePNG(canvas, `buildings/building_${key}.png`);
        buildingSeed += 100;
    }

    // ─── Sky & Atmosphere ────────────────────────────────────────
    console.log('\n🌤️  Sky & Atmosphere:');
    useSeed(2000);
    manifest['sky'] = savePNG(generateSkyTexture(), 'sky/sky_gradient.png');

    useSeed(2100);
    manifest['cloud'] = savePNG(generateCloudTexture(), 'sky/cloud.png');

    useSeed(2200);
    manifest['moon'] = savePNG(generateMoonTexture(), 'sky/moon.png');

    // ─── Vehicle Textures ────────────────────────────────────────
    console.log('\n🚗 Vehicle Textures:');
    useSeed(3000);
    manifest['vehicle_sedan'] = savePNG(generateSedanTexture(), 'vehicles/sedan.png');

    useSeed(3100);
    manifest['vehicle_truck'] = savePNG(generateTruckTexture(), 'vehicles/truck.png');

    useSeed(3200);
    manifest['vehicle_motorcycle'] = savePNG(generateMotorcycleTexture(), 'vehicles/motorcycle.png');

    useSeed(3300);
    manifest['vehicle_helicopter'] = savePNG(generateHelicopterTexture(), 'vehicles/helicopter.png');

    useSeed(3400);
    manifest['vehicle_boat'] = savePNG(generateBoatTexture(), 'vehicles/boat.png');

    useSeed(3500);
    manifest['vehicle_police'] = savePNG(generatePoliceTexture(), 'vehicles/police.png');

    useSeed(3600);
    manifest['vehicle_fallback'] = savePNG(generateFallbackVehicleTexture(), 'vehicles/fallback.png');

    // ─── Tree Textures ───────────────────────────────────────────
    console.log('\n🌳 Tree Textures:');
    useSeed(4000);
    manifest['tree_evergreen'] = savePNG(generateTreeTexture('evergreen'), 'nature/tree_evergreen.png');

    useSeed(4100);
    manifest['tree_deciduous'] = savePNG(generateTreeTexture('deciduous'), 'nature/tree_deciduous.png');

    // ─── Sign Textures ───────────────────────────────────────────
    console.log('\n🪧 Sign Textures:');
    useSeed(5000);
    manifest['sign_ammunation'] = savePNG(generateAmmuNationSign(), 'signs/ammunation.png');

    useSeed(5100);
    manifest['sign_paynspray'] = savePNG(generatePayNSpraySign(), 'signs/paynspray.png');

    // ─── Graffiti Pool ───────────────────────────────────────────
    console.log('\n🎨 Graffiti Textures:');
    const styles = ['tag', 'abstract', 'stencil'];
    let graffitiSeed = 6000;
    for (let i = 0; i < 12; i++) {
        useSeed(graffitiSeed + i * 10);
        const style = styles[i % 3];
        const variant = Math.floor(i / 3);
        const canvas = generateGraffitiTexture(style, variant);
        manifest[`graffiti_${i}`] = savePNG(canvas, `graffiti/graffiti_${i}.png`);
    }

    // ─── Terrain Heightmap ───────────────────────────────────────
    console.log('\n🗺️  Terrain Heightmap:');
    const { canvas: heightCanvas, maxHeight } = generateTerrainHeightmap();
    manifest['terrain_heightmap'] = savePNG(heightCanvas, 'terrain/heightmap.png');
    manifest['terrain_max_height'] = maxHeight;
    console.log(`  Peak terrain height: ${maxHeight.toFixed(1)} units`);

    // ─── Write Manifest ──────────────────────────────────────────
    console.log('\n📋 Writing manifest...');
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log(`  ✓ manifest.json (${Object.keys(manifest).length} entries)`);

    // ─── Summary ─────────────────────────────────────────────────
    restoreRandom();
    const totalFiles = Object.keys(manifest).filter(k => typeof manifest[k] === 'string').length;
    console.log(`\n✅ Generated ${totalFiles} texture files in assets/textures/`);
    console.log('─'.repeat(50));
}

main().catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});
