// San Claudio - Model Generator
// Generates low-poly .glb models for characters and vehicles
// Run: cd tools && npm install && node model-generator.js

// Polyfill browser APIs needed by GLTFExporter in Node.js
import { Blob as NodeBlob } from 'buffer';
globalThis.window = globalThis;
globalThis.Blob = globalThis.Blob || NodeBlob;
if (!globalThis.FileReader) {
    globalThis.FileReader = class FileReader {
        readAsArrayBuffer(blob) {
            blob.arrayBuffer().then(buf => {
                this.result = buf;
                if (this.onloadend) this.onloadend({ target: this });
                if (this.onload) this.onload({ target: this });
            });
        }
        readAsDataURL(blob) {
            blob.arrayBuffer().then(buf => {
                const b64 = Buffer.from(buf).toString('base64');
                this.result = `data:application/octet-stream;base64,${b64}`;
                if (this.onloadend) this.onloadend({ target: this });
                if (this.onload) this.onload({ target: this });
            });
        }
    };
}
if (!globalThis.document) {
    globalThis.document = {
        createElementNS: () => ({ style: {} }),
        createElement: () => ({ getContext: () => null, style: {} })
    };
}

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'models');

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// --- Helper: export scene to .glb file ---
async function exportToGLB(scene, animations, filename) {
    return new Promise((resolve, reject) => {
        const exporter = new GLTFExporter();
        const options = {
            binary: true,
            animations: animations || []
        };
        try {
            exporter.parse(scene, (result) => {
                try {
                    const outPath = path.join(OUTPUT_DIR, filename);
                    if (result instanceof ArrayBuffer) {
                        fs.writeFileSync(outPath, Buffer.from(result));
                        console.log(`  Exported: ${filename} (${(result.byteLength / 1024).toFixed(1)} KB)`);
                    } else {
                        // JSON result (non-binary fallback)
                        const json = JSON.stringify(result);
                        fs.writeFileSync(outPath, json);
                        console.log(`  Exported: ${filename} (${(json.length / 1024).toFixed(1)} KB, JSON)`);
                    }
                    resolve();
                } catch (e) {
                    reject(e);
                }
            }, options);
        } catch (e) {
            reject(e);
        }
    });
}

// ============================================================
// CHARACTER MODEL — Stylized low-poly with proper proportions
// ============================================================

// Shared skeleton builder for male/female characters
function buildSkeleton() {
    const bones = [];
    const boneNames = [
        'Root',        // 0  - hips
        'Spine',       // 1
        'Chest',       // 2
        'Head',        // 3
        'L_Shoulder',  // 4
        'L_Elbow',     // 5
        'L_Hand',      // 6
        'R_Shoulder',  // 7
        'R_Elbow',     // 8
        'R_Hand',      // 9
        'L_Hip',       // 10
        'L_Knee',      // 11
        'L_Foot',      // 12
        'R_Hip',       // 13
        'R_Knee',      // 14
        'R_Foot',      // 15
    ];

    const bonePositions = [
        [0, 0.95, 0],       // Root (hips)
        [0, 0.2, 0],        // Spine (relative to Root)
        [0, 0.2, 0],        // Chest (relative to Spine)
        [0, 0.3, 0],        // Head (relative to Chest)
        [-0.35, 0, 0],      // L_Shoulder (relative to Chest)
        [0, -0.3, 0],       // L_Elbow (relative to L_Shoulder)
        [0, -0.3, 0],       // L_Hand (relative to L_Elbow)
        [0.35, 0, 0],       // R_Shoulder (relative to Chest)
        [0, -0.3, 0],       // R_Elbow (relative to R_Shoulder)
        [0, -0.3, 0],       // R_Hand (relative to R_Elbow)
        [-0.12, 0, 0],      // L_Hip (relative to Root)
        [0, -0.4, 0],       // L_Knee (relative to L_Hip)
        [0, -0.4, 0],       // L_Foot (relative to L_Knee)
        [0.12, 0, 0],       // R_Hip (relative to Root)
        [0, -0.4, 0],       // R_Knee (relative to R_Hip)
        [0, -0.4, 0],       // R_Foot (relative to R_Knee)
    ];

    const parentIndices = [-1, 0, 1, 2, 2, 4, 5, 2, 7, 8, 0, 10, 11, 0, 13, 14];

    for (let i = 0; i < boneNames.length; i++) {
        const bone = new THREE.Bone();
        bone.name = boneNames[i];
        bone.position.set(...bonePositions[i]);
        bones.push(bone);
    }

    for (let i = 0; i < parentIndices.length; i++) {
        if (parentIndices[i] >= 0) {
            bones[parentIndices[i]].add(bones[i]);
        }
    }

    return { bones, boneNames, skeleton: new THREE.Skeleton(bones) };
}

// Bone world positions for skinning weight calculation
const BONE_WORLD_POS = [
    [0, 0.95, 0],       // Root
    [0, 1.15, 0],       // Spine
    [0, 1.35, 0],       // Chest
    [0, 1.65, 0],       // Head
    [-0.35, 1.35, 0],   // L_Shoulder
    [-0.35, 1.05, 0],   // L_Elbow
    [-0.35, 0.75, 0],   // L_Hand
    [0.35, 1.35, 0],    // R_Shoulder
    [0.35, 1.05, 0],    // R_Elbow
    [0.35, 0.75, 0],    // R_Hand
    [-0.12, 0.95, 0],   // L_Hip
    [-0.12, 0.55, 0],   // L_Knee
    [-0.12, 0.15, 0],   // L_Foot
    [0.12, 0.95, 0],    // R_Hip
    [0.12, 0.55, 0],    // R_Knee
    [0.12, 0.15, 0],    // R_Foot
];

// Vertex color constants
const SKIN = 0xd4a574;
const SHIRT = 0x4466aa;
const PANTS = 0x333344;
const SHOE = 0x222222;
const HAIR = 0x221100;
const JACKET = 0x556677;
const SHORTS = 0x445566;
const GLOVES = 0x334455;

// Helper: create a lathe profile (revolved curve) centered at a Y position
function createLatheSection(profilePoints, posY, segments = 10) {
    // profilePoints: array of [radius, height] pairs (bottom to top)
    const points = profilePoints.map(p => new THREE.Vector2(p[0], p[1]));
    const geo = new THREE.LatheGeometry(points, segments);
    geo.translate(0, posY, 0);
    return geo;
}

// Merge parts into skinned geometry with vertex colors and morph targets
function assembleCharacterMesh(parts, morphSets, bones, skeleton) {
    const mergedGeometries = [];
    const skinIndices = [];
    const skinWeights = [];

    for (const part of parts) {
        const geo = part.geo;
        const vertCount = geo.attributes.position.count;

        for (let v = 0; v < vertCount; v++) {
            const vx = geo.attributes.position.getX(v);
            const vy = geo.attributes.position.getY(v);
            const vz = geo.attributes.position.getZ(v);

            let minDist = Infinity, secondDist = Infinity;
            let minIdx = part.boneIdx, secondIdx = part.boneIdx;

            for (let b = 0; b < BONE_WORLD_POS.length; b++) {
                const bp = BONE_WORLD_POS[b];
                const d = Math.sqrt((vx - bp[0]) ** 2 + (vy - bp[1]) ** 2 + (vz - bp[2]) ** 2);
                if (d < minDist) {
                    secondDist = minDist;
                    secondIdx = minIdx;
                    minDist = d;
                    minIdx = b;
                } else if (d < secondDist) {
                    secondDist = d;
                    secondIdx = b;
                }
            }

            const jointThreshold = 0.15;
            if (minDist < jointThreshold && secondDist < jointThreshold * 2 && minIdx !== secondIdx) {
                const total = minDist + secondDist;
                const w1 = 1 - (minDist / total);
                const w2 = 1 - (secondDist / total);
                const norm = w1 + w2;
                skinIndices.push(minIdx, secondIdx, 0, 0);
                skinWeights.push(w1 / norm, w2 / norm, 0, 0);
            } else {
                skinIndices.push(minIdx, 0, 0, 0);
                skinWeights.push(1, 0, 0, 0);
            }
        }

        // Vertex colors
        const colors = new Float32Array(vertCount * 3);
        const c = new THREE.Color(part.color);
        for (let v = 0; v < vertCount; v++) {
            colors[v * 3] = c.r;
            colors[v * 3 + 1] = c.g;
            colors[v * 3 + 2] = c.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        mergedGeometries.push(geo);
    }

    const merged = BufferGeometryUtils.mergeBufferGeometries(mergedGeometries, false);
    merged.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    merged.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

    // UV coordinate assignment based on body region
    const posAttr = merged.attributes.position;
    const colorAttr = merged.attributes.color;
    const skinIdxAttr = merged.getAttribute('skinIndex');
    const uvs = new Float32Array(posAttr.count * 2);

    // Hair color for detection
    const hairColor = new THREE.Color(HAIR);
    const hairEps = 0.05;

    // Bone → region mapping
    // Regions: torso(0), pants(1), face(2), arms(3), shoes(4), hair(5)
    const boneToRegion = {
        0: -1,  // Root — depends on vertex color (shirt=torso, pants=pants)
        1: 0,   // Spine → torso
        2: 0,   // Chest → torso
        3: 2,   // Head → face
        4: 0,   // L_Shoulder → torso
        5: 3,   // L_Elbow → arms
        6: 3,   // L_Hand → arms
        7: 0,   // R_Shoulder → torso
        8: 3,   // R_Elbow → arms
        9: 3,   // R_Hand → arms
        10: 1,  // L_Hip → pants (most vertices here are pants)
        11: 1,  // L_Knee → pants
        12: 4,  // L_Foot → shoes
        13: 1,  // R_Hip → pants
        14: 1,  // R_Knee → pants
        15: 4,  // R_Foot → shoes
    };

    // Region UV bounds: [minU, minV, maxU, maxV]
    const regionBounds = [
        [0, 0, 0.5, 0.33],       // 0: torso
        [0, 0.33, 0.5, 0.66],    // 1: pants
        [0.5, 0, 1.0, 0.33],     // 2: face
        [0.5, 0.33, 1.0, 0.66],  // 3: arms
        [0, 0.66, 0.5, 1.0],     // 4: shoes
        [0.5, 0.66, 1.0, 1.0],   // 5: hair
    ];

    // Collect vertex positions per region to compute bounding boxes
    const regionVerts = [[], [], [], [], [], []];
    const vertRegion = new Int8Array(posAttr.count);

    for (let i = 0; i < posAttr.count; i++) {
        const boneIdx = skinIdxAttr.getX(i);
        const cr = colorAttr.getX(i);
        const cg = colorAttr.getY(i);
        const cb = colorAttr.getZ(i);

        // Check if hair
        if (Math.abs(cr - hairColor.r) < hairEps &&
            Math.abs(cg - hairColor.g) < hairEps &&
            Math.abs(cb - hairColor.b) < hairEps) {
            vertRegion[i] = 5; // hair
        } else {
            let region = boneToRegion[boneIdx];
            if (region === undefined) region = 0;
            if (region === -1) {
                // Root bone — check vertex color to disambiguate
                const shirtColor = new THREE.Color(SHIRT);
                if (Math.abs(cr - shirtColor.r) < 0.05 &&
                    Math.abs(cg - shirtColor.g) < 0.05 &&
                    Math.abs(cb - shirtColor.b) < 0.05) {
                    region = 0; // torso
                } else {
                    region = 1; // pants
                }
            }
            vertRegion[i] = region;
        }

        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        regionVerts[vertRegion[i]].push({ idx: i, x: vx, y: vy, z: posAttr.getZ(i) });
    }

    // Assign UVs per region using XY projection
    for (let r = 0; r < 6; r++) {
        const verts = regionVerts[r];
        if (verts.length === 0) continue;

        const bounds = regionBounds[r];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const v of verts) {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
        }

        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const uMin = bounds[0], vMin = bounds[1];
        const uRange = bounds[2] - bounds[0];
        const vRange = bounds[3] - bounds[1];

        // Small padding (5%) to avoid edge bleed
        const pad = 0.05;
        const uPad = uRange * pad;
        const vPad = vRange * pad;

        for (const v of verts) {
            const nu = ((v.x - minX) / rangeX); // 0-1
            const nv = ((v.y - minY) / rangeY); // 0-1
            uvs[v.idx * 2] = uMin + uPad + nu * (uRange - 2 * uPad);
            uvs[v.idx * 2 + 1] = vMin + vPad + nv * (vRange - 2 * vPad);
        }
    }

    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    // Morph targets for fat/muscle body types
    if (morphSets && morphSets.length > 0) {
        const basePos = merged.attributes.position;
        merged.morphAttributes.position = [];

        for (const morphParts of morphSets) {
            // Build morph merged geometry the same way
            const morphGeos = [];
            for (let i = 0; i < morphParts.length; i++) {
                const mp = morphParts[i];
                const mg = mp.geo.clone();
                // Apply vertex colors to match base (required for merge compatibility)
                const vc = parts[i].color;
                const cc = new THREE.Color(vc);
                const cols = new Float32Array(mg.attributes.position.count * 3);
                for (let v = 0; v < mg.attributes.position.count; v++) {
                    cols[v * 3] = cc.r;
                    cols[v * 3 + 1] = cc.g;
                    cols[v * 3 + 2] = cc.b;
                }
                mg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
                morphGeos.push(mg);
            }
            const morphMerged = BufferGeometryUtils.mergeBufferGeometries(morphGeos, false);
            const morphPositions = morphMerged.attributes.position;
            merged.morphAttributes.position.push(morphPositions);
        }
        merged.morphTargetsRelative = false;
    }

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.7,
        metalness: 0.02,
        morphTargets: morphSets && morphSets.length > 0,
    });

    const skinnedMesh = new THREE.SkinnedMesh(merged, material);
    skinnedMesh.name = 'CharacterMesh';
    skinnedMesh.add(bones[0]);
    skinnedMesh.bind(skeleton);

    return skinnedMesh;
}

// Build character body parts for a given gender config
// gender: 'male' or 'female'
// Returns { baseParts, fatParts, muscleParts } — arrays of { geo, boneIdx, color }
function buildCharacterParts(gender = 'male') {
    const isFemale = gender === 'female';
    const parts = [];
    const fatParts = [];
    const muscleParts = [];

    function addPart(geo, boneIdx, color, fatGeo, muscleGeo) {
        parts.push({ geo, boneIdx, color });
        fatParts.push({ geo: fatGeo || geo.clone(), boneIdx, color });
        muscleParts.push({ geo: muscleGeo || geo.clone(), boneIdx, color });
    }

    // Helper: create geo and optionally inflated/sculpted morph variants
    function addBox(w, h, d, posX, posY, posZ, boneIdx, color, fatScale, muscleScale) {
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.translate(posX, posY, posZ);
        const fGeo = new THREE.BoxGeometry(w * (fatScale || 1), h * (fatScale ? 1.05 : 1), d * (fatScale || 1));
        fGeo.translate(posX, posY, posZ);
        const mGeo = new THREE.BoxGeometry(w * (muscleScale || 1), h, d * (muscleScale || 1));
        mGeo.translate(posX, posY, posZ);
        addPart(geo, boneIdx, color, fGeo, mGeo);
    }

    function addCylinder(rt, rb, h, posX, posY, posZ, boneIdx, color, segments, fatMult, muscleMult) {
        segments = segments || 8;
        const geo = new THREE.CylinderGeometry(rt, rb, h, segments);
        geo.translate(posX, posY, posZ);
        const fm = fatMult || 1;
        const mm = muscleMult || 1;
        const fGeo = new THREE.CylinderGeometry(rt * fm, rb * fm, h * 1.02, segments);
        fGeo.translate(posX, posY, posZ);
        const mGeo = new THREE.CylinderGeometry(rt * mm, rb * mm, h, segments);
        mGeo.translate(posX, posY, posZ);
        addPart(geo, boneIdx, color, fGeo, mGeo);
    }

    // Proportions differ by gender
    const shoulderW = isFemale ? 0.30 : 0.35;
    const hipW = isFemale ? 0.25 : 0.22;
    const chestR = isFemale ? 0.24 : 0.28;
    const waistR = isFemale ? 0.20 : 0.22;
    const hipBoxW = isFemale ? 0.44 : 0.42;
    const armX = isFemale ? 0.32 : 0.36;

    // ===== HEAD =====
    // Lathe-revolved skull shape: chin → jaw → cheek → temple → crown
    {
        const headProfile = isFemale
            ? [[0, -0.17], [0.14, -0.14], [0.16, -0.06], [0.17, 0.02], [0.16, 0.10], [0.14, 0.15], [0.08, 0.18], [0, 0.19]]
            : [[0, -0.18], [0.15, -0.15], [0.17, -0.06], [0.18, 0.02], [0.17, 0.10], [0.15, 0.15], [0.09, 0.19], [0, 0.20]];
        const headGeo = createLatheSection(headProfile, 1.70, 10);
        const fHeadGeo = createLatheSection(headProfile.map(p => [p[0] * 1.08, p[1]]), 1.70, 10);
        const mHeadGeo = createLatheSection(headProfile.map(p => [p[0] * 1.02, p[1]]), 1.70, 10);
        addPart(headGeo, 3, SKIN, fHeadGeo, mHeadGeo);

        // Brow ridge
        const browGeo = new THREE.BoxGeometry(isFemale ? 0.30 : 0.34, isFemale ? 0.035 : 0.05, 0.10);
        browGeo.translate(0, 1.82, 0.13);
        addPart(browGeo, 3, SKIN);

        // Nose — wedge pointing forward
        const noseGeo = new THREE.CylinderGeometry(0, isFemale ? 0.03 : 0.04, isFemale ? 0.08 : 0.10, 4);
        noseGeo.rotateX(-Math.PI / 2);
        noseGeo.translate(0, 1.68, isFemale ? 0.18 : 0.20);
        addPart(noseGeo, 3, SKIN);

        // Jaw/chin — angular box, wider for male
        const chinGeo = new THREE.BoxGeometry(isFemale ? 0.10 : 0.14, 0.06, 0.08);
        chinGeo.translate(0, 1.52, 0.08);
        addPart(chinGeo, 3, SKIN);

        // Eyes — dark inset boxes with white highlight dot
        for (const side of [-1, 1]) {
            // Dark eye socket
            const eyeGeo = new THREE.BoxGeometry(0.065, 0.04, 0.035);
            eyeGeo.translate(side * 0.07, 1.73, 0.16);
            addPart(eyeGeo, 3, 0x111111);
            // White eye highlight
            const hlGeo = new THREE.BoxGeometry(0.02, 0.02, 0.01);
            hlGeo.translate(side * 0.06, 1.735, 0.185);
            addPart(hlGeo, 3, 0xeeeeee);
        }

        // Ears — small extruded shapes
        for (const side of [-1, 1]) {
            const earGeo = new THREE.BoxGeometry(0.04, 0.09, 0.06);
            earGeo.translate(side * 0.19, 1.70, -0.01);
            addPart(earGeo, 3, SKIN);
        }

        // Mouth line
        const mouthGeo = new THREE.BoxGeometry(isFemale ? 0.08 : 0.10, 0.012, 0.01);
        mouthGeo.translate(0, 1.58, 0.16);
        addPart(mouthGeo, 3, isFemale ? 0xcc6666 : 0x995544);
    }

    // ===== HAIR =====
    {
        if (isFemale) {
            // Longer hair — main volume with back drape
            const hairMainGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.10, 10);
            hairMainGeo.translate(0, 1.91, -0.01);
            addPart(hairMainGeo, 3, HAIR);
            // Side volume
            for (const side of [-1, 1]) {
                const sideGeo = new THREE.BoxGeometry(0.08, 0.22, 0.14);
                sideGeo.translate(side * 0.16, 1.74, -0.04);
                addPart(sideGeo, 3, HAIR);
            }
            // Back drape
            const backGeo = new THREE.BoxGeometry(0.28, 0.28, 0.08);
            backGeo.translate(0, 1.74, -0.14);
            addPart(backGeo, 3, HAIR);
        } else {
            // Short cropped — angular chunks
            const hairMainGeo = new THREE.CylinderGeometry(0.19, 0.17, 0.08, 10);
            hairMainGeo.translate(0, 1.91, -0.01);
            addPart(hairMainGeo, 3, HAIR);
            // Top tuft
            const tuftGeo = new THREE.BoxGeometry(0.22, 0.05, 0.18);
            tuftGeo.rotateZ(0.08);
            tuftGeo.translate(0.02, 1.96, 0);
            addPart(tuftGeo, 3, HAIR);
            // Back
            const backHairGeo = new THREE.BoxGeometry(0.28, 0.10, 0.08);
            backHairGeo.translate(0, 1.85, -0.13);
            addPart(backHairGeo, 3, HAIR);
        }
    }

    // ===== NECK =====
    addCylinder(0.07, 0.09, 0.12, 0, 1.56, 0, 2, SKIN, 8, 1.15, 1.1);

    // ===== TORSO =====
    // Chest — broad shoulders, tapers to waist
    addCylinder(chestR, waistR, 0.32, 0, 1.35, 0, 2, SHIRT, 10, 1.25, 1.15);

    // Shoulder caps — rounded for better silhouette
    for (const side of [-1, 1]) {
        const capGeo = new THREE.SphereGeometry(isFemale ? 0.065 : 0.08, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
        capGeo.rotateZ(side > 0 ? -Math.PI / 2 : Math.PI / 2);
        capGeo.translate(side * shoulderW, 1.42, 0);
        const fCapGeo = capGeo.clone();
        const mCapGeo = new THREE.SphereGeometry(isFemale ? 0.07 : 0.095, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
        mCapGeo.rotateZ(side > 0 ? -Math.PI / 2 : Math.PI / 2);
        mCapGeo.translate(side * shoulderW, 1.42, 0);
        addPart(capGeo, side < 0 ? 4 : 7, SHIRT, fCapGeo, mCapGeo);
    }

    // Abdomen/waist
    addCylinder(waistR, hipW * 0.9, 0.18, 0, 1.10, 0, 1, SHIRT, 10, 1.35, 1.0);

    // Hips
    addBox(hipBoxW, 0.14, 0.24, 0, 0.95, 0, 0, SHIRT, 1.2, 1.0);

    // Female chest detail
    if (isFemale) {
        for (const side of [-1, 1]) {
            const bustGeo = new THREE.SphereGeometry(0.06, 6, 4);
            bustGeo.translate(side * 0.08, 1.32, 0.12);
            addPart(bustGeo, 2, SHIRT);
        }
    }

    // ===== ARMS =====
    for (const side of [-1, 1]) {
        const sIdx = side < 0 ? 4 : 7; // shoulder bone
        const eIdx = side < 0 ? 5 : 8; // elbow bone
        const hIdx = side < 0 ? 6 : 9; // hand bone
        const x = side * armX;

        // Upper arm — tapered, shirt color
        const uaRT = isFemale ? 0.06 : 0.07;
        const uaRB = isFemale ? 0.048 : 0.055;
        addCylinder(uaRT, uaRB, 0.28, x, 1.25, 0, sIdx, SHIRT, 8, 1.2, 1.25);

        // Forearm — skin color
        const faRT = isFemale ? 0.048 : 0.055;
        const faRB = isFemale ? 0.035 : 0.04;
        addCylinder(faRT, faRB, 0.26, x, 0.97, 0, eIdx, SKIN, 8, 1.1, 1.15);

        // Hand — mitten with finger groove (GTA 3 style), 15% oversized
        const handW = 0.09;
        const handH = 0.12;
        const handD = 0.07;
        const handGeo = new THREE.BoxGeometry(handW, handH, handD);
        handGeo.translate(x, 0.79, 0);
        addPart(handGeo, hIdx, SKIN);

        // Finger groove — thin dark line down middle of hand
        const grooveGeo = new THREE.BoxGeometry(0.005, handH * 0.7, handD * 0.3);
        grooveGeo.translate(x, 0.77, handD * 0.15);
        addPart(grooveGeo, hIdx, 0xbb8866);

        // Thumb nub
        const thumbGeo = new THREE.BoxGeometry(0.035, 0.04, 0.04);
        thumbGeo.translate(x + side * 0.055, 0.81, 0.02);
        addPart(thumbGeo, hIdx, SKIN);
    }

    // ===== LEGS =====
    for (const side of [-1, 1]) {
        const hipIdx = side < 0 ? 10 : 13;
        const kneeIdx = side < 0 ? 11 : 14;
        const footIdx = side < 0 ? 12 : 15;
        const lx = side * 0.12;

        // Thigh — wider at hip
        const thRT = isFemale ? 0.085 : 0.08;
        const thRB = isFemale ? 0.07 : 0.065;
        addCylinder(thRT, thRB, 0.36, lx, 0.59, 0, hipIdx, PANTS, 8, 1.25, 1.1);

        // Shin — slight calf bulge (wider near knee, tapers to ankle)
        const shRT = isFemale ? 0.065 : 0.065;
        const shRB = isFemale ? 0.045 : 0.05;
        addCylinder(shRT, shRB, 0.34, lx, 0.25, 0, kneeIdx, PANTS, 8, 1.15, 1.05);

        // Foot — angled shoe with sole thickness, slightly oversized
        const footGeo = new THREE.BoxGeometry(0.13, 0.08, 0.25);
        footGeo.translate(lx, 0.04, 0.04);
        const fFootGeo = new THREE.BoxGeometry(0.15, 0.09, 0.27);
        fFootGeo.translate(lx, 0.04, 0.04);
        addPart(footGeo, footIdx, SHOE, fFootGeo, footGeo.clone());

        // Toe cap
        const toeGeo = new THREE.BoxGeometry(0.11, 0.05, 0.06);
        toeGeo.translate(lx, 0.035, 0.19);
        addPart(toeGeo, footIdx, SHOE);

        // Sole — thin dark strip under foot
        const soleGeo = new THREE.BoxGeometry(0.13, 0.02, 0.26);
        soleGeo.translate(lx, -0.01, 0.04);
        addPart(soleGeo, footIdx, 0x111111);
    }

    return { baseParts: parts, fatParts, muscleParts };
}


// Animation helper functions
function quatTrack(boneName, times, quats) {
    return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, quats);
}
function posTrack(boneName, times, positions) {
    return new THREE.VectorKeyframeTrack(`${boneName}.position`, times, positions);
}
function eq(x, y, z) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
    return [q.x, q.y, q.z, q.w];
}
const qi = [0, 0, 0, 1];


// Build all character animations (shared between male/female)
function buildCharacterAnimations() {
    const animations = [];

    // 1. Idle (2s loop)
    animations.push(new THREE.AnimationClip('idle', 2, [
        quatTrack('Spine', [0, 1, 2], [...qi, ...eq(0.01, 0, 0), ...qi]),
        quatTrack('Head', [0, 1, 2], [...qi, ...eq(0, 0.03, 0), ...qi]),
        // Subtle arm sway
        quatTrack('L_Shoulder', [0, 1, 2], [...qi, ...eq(0, 0, 0.02), ...qi]),
        quatTrack('R_Shoulder', [0, 1, 2], [...qi, ...eq(0, 0, -0.02), ...qi]),
    ]));

    // 2. Walk (1s loop)
    const wl = 30 * Math.PI / 180, wa = 25 * Math.PI / 180;
    animations.push(new THREE.AnimationClip('walk', 1, [
        quatTrack('L_Hip', [0, 0.25, 0.5, 0.75, 1], [
            ...eq(wl, 0, 0), ...qi, ...eq(-wl, 0, 0), ...qi, ...eq(wl, 0, 0)
        ]),
        quatTrack('R_Hip', [0, 0.25, 0.5, 0.75, 1], [
            ...eq(-wl, 0, 0), ...qi, ...eq(wl, 0, 0), ...qi, ...eq(-wl, 0, 0)
        ]),
        quatTrack('L_Knee', [0, 0.25, 0.5, 0.75, 1], [
            ...qi, ...eq(0.3, 0, 0), ...qi, ...eq(0.1, 0, 0), ...qi
        ]),
        quatTrack('R_Knee', [0, 0.25, 0.5, 0.75, 1], [
            ...qi, ...eq(0.1, 0, 0), ...qi, ...eq(0.3, 0, 0), ...qi
        ]),
        quatTrack('L_Shoulder', [0, 0.25, 0.5, 0.75, 1], [
            ...eq(-wa, 0, 0), ...qi, ...eq(wa, 0, 0), ...qi, ...eq(-wa, 0, 0)
        ]),
        quatTrack('R_Shoulder', [0, 0.25, 0.5, 0.75, 1], [
            ...eq(wa, 0, 0), ...qi, ...eq(-wa, 0, 0), ...qi, ...eq(wa, 0, 0)
        ]),
        posTrack('Root', [0, 0.25, 0.5, 0.75, 1], [
            0, 0.95, 0, 0, 1.0, 0, 0, 0.95, 0, 0, 1.0, 0, 0, 0.95, 0
        ]),
        quatTrack('Chest', [0, 0.25, 0.5, 0.75, 1], [
            ...eq(0, 0.05, 0), ...qi, ...eq(0, -0.05, 0), ...qi, ...eq(0, 0.05, 0)
        ]),
    ]));

    // 3. Run (0.6s loop)
    const rl = 45 * Math.PI / 180, ra = 40 * Math.PI / 180;
    animations.push(new THREE.AnimationClip('run', 0.6, [
        quatTrack('L_Hip', [0, 0.15, 0.3, 0.45, 0.6], [
            ...eq(rl, 0, 0), ...qi, ...eq(-rl, 0, 0), ...qi, ...eq(rl, 0, 0)
        ]),
        quatTrack('R_Hip', [0, 0.15, 0.3, 0.45, 0.6], [
            ...eq(-rl, 0, 0), ...qi, ...eq(rl, 0, 0), ...qi, ...eq(-rl, 0, 0)
        ]),
        quatTrack('L_Knee', [0, 0.15, 0.3, 0.45, 0.6], [
            ...qi, ...eq(0.5, 0, 0), ...qi, ...eq(0.2, 0, 0), ...qi
        ]),
        quatTrack('R_Knee', [0, 0.15, 0.3, 0.45, 0.6], [
            ...qi, ...eq(0.2, 0, 0), ...qi, ...eq(0.5, 0, 0), ...qi
        ]),
        quatTrack('L_Shoulder', [0, 0.15, 0.3, 0.45, 0.6], [
            ...eq(-ra, 0, 0), ...qi, ...eq(ra, 0, 0), ...qi, ...eq(-ra, 0, 0)
        ]),
        quatTrack('R_Shoulder', [0, 0.15, 0.3, 0.45, 0.6], [
            ...eq(ra, 0, 0), ...qi, ...eq(-ra, 0, 0), ...qi, ...eq(ra, 0, 0)
        ]),
        quatTrack('L_Elbow', [0, 0.3, 0.6], [...eq(-0.5, 0, 0), ...eq(-0.3, 0, 0), ...eq(-0.5, 0, 0)]),
        quatTrack('R_Elbow', [0, 0.3, 0.6], [...eq(-0.5, 0, 0), ...eq(-0.3, 0, 0), ...eq(-0.5, 0, 0)]),
        quatTrack('Spine', [0, 0.6], [...eq(0.17, 0, 0), ...eq(0.17, 0, 0)]),
        posTrack('Root', [0, 0.15, 0.3, 0.45, 0.6], [
            0, 0.95, 0, 0, 1.02, 0, 0, 0.95, 0, 0, 1.02, 0, 0, 0.95, 0
        ]),
    ]));

    // 4. Sprint (0.4s loop)
    const sl = 55 * Math.PI / 180, sa = 50 * Math.PI / 180;
    animations.push(new THREE.AnimationClip('sprint', 0.4, [
        quatTrack('L_Hip', [0, 0.1, 0.2, 0.3, 0.4], [
            ...eq(sl, 0, 0), ...qi, ...eq(-sl, 0, 0), ...qi, ...eq(sl, 0, 0)
        ]),
        quatTrack('R_Hip', [0, 0.1, 0.2, 0.3, 0.4], [
            ...eq(-sl, 0, 0), ...qi, ...eq(sl, 0, 0), ...qi, ...eq(-sl, 0, 0)
        ]),
        quatTrack('L_Knee', [0, 0.1, 0.2, 0.3, 0.4], [
            ...qi, ...eq(0.7, 0, 0), ...qi, ...eq(0.3, 0, 0), ...qi
        ]),
        quatTrack('R_Knee', [0, 0.1, 0.2, 0.3, 0.4], [
            ...qi, ...eq(0.3, 0, 0), ...qi, ...eq(0.7, 0, 0), ...qi
        ]),
        quatTrack('L_Shoulder', [0, 0.1, 0.2, 0.3, 0.4], [
            ...eq(-sa, 0, 0), ...qi, ...eq(sa, 0, 0), ...qi, ...eq(-sa, 0, 0)
        ]),
        quatTrack('R_Shoulder', [0, 0.1, 0.2, 0.3, 0.4], [
            ...eq(sa, 0, 0), ...qi, ...eq(-sa, 0, 0), ...qi, ...eq(sa, 0, 0)
        ]),
        quatTrack('L_Elbow', [0, 0.2, 0.4], [...eq(-0.7, 0, 0), ...eq(-0.4, 0, 0), ...eq(-0.7, 0, 0)]),
        quatTrack('R_Elbow', [0, 0.2, 0.4], [...eq(-0.7, 0, 0), ...eq(-0.4, 0, 0), ...eq(-0.7, 0, 0)]),
        quatTrack('Spine', [0, 0.4], [...eq(0.26, 0, 0), ...eq(0.26, 0, 0)]),
        posTrack('Root', [0, 0.1, 0.2, 0.3, 0.4], [
            0, 0.92, 0, 0, 1.0, 0, 0, 0.92, 0, 0, 1.0, 0, 0, 0.92, 0
        ]),
    ]));

    // 5. Punch (0.4s, no loop)
    animations.push(new THREE.AnimationClip('punch', 0.4, [
        quatTrack('R_Shoulder', [0, 0.1, 0.25, 0.4], [
            ...qi, ...eq(0.5, 0, -0.3), ...eq(-1.4, 0, 0), ...qi
        ]),
        quatTrack('R_Elbow', [0, 0.1, 0.25, 0.4], [
            ...qi, ...eq(-1.0, 0, 0), ...eq(-0.1, 0, 0), ...qi
        ]),
        quatTrack('Chest', [0, 0.1, 0.25, 0.4], [
            ...qi, ...eq(0, -0.3, 0), ...eq(0, 0.5, 0), ...qi
        ]),
    ]));

    // 6. Jump (0.6s, no loop)
    animations.push(new THREE.AnimationClip('jump', 0.6, [
        posTrack('Root', [0, 0.1, 0.2, 0.4, 0.6], [
            0, 0.95, 0,  0, 0.8, 0,  0, 1.1, 0,  0, 1.05, 0,  0, 0.95, 0
        ]),
        quatTrack('L_Hip', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.3, 0, 0), ...eq(-0.6, 0, 0), ...eq(-0.3, 0, 0), ...qi
        ]),
        quatTrack('R_Hip', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.3, 0, 0), ...eq(-0.6, 0, 0), ...eq(-0.3, 0, 0), ...qi
        ]),
        quatTrack('L_Knee', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.8, 0, 0), ...eq(0.5, 0, 0), ...eq(0.3, 0, 0), ...qi
        ]),
        quatTrack('R_Knee', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.8, 0, 0), ...eq(0.5, 0, 0), ...eq(0.3, 0, 0), ...qi
        ]),
        quatTrack('L_Shoulder', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.3, 0, 0.3), ...eq(-1.5, 0, 0.5), ...eq(-0.8, 0, 0.3), ...qi
        ]),
        quatTrack('R_Shoulder', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.3, 0, -0.3), ...eq(-1.5, 0, -0.5), ...eq(-0.8, 0, -0.3), ...qi
        ]),
        quatTrack('Spine', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.1, 0, 0), ...eq(0.05, 0, 0), ...eq(0.08, 0, 0), ...qi
        ]),
    ]));

    // 7. Carjack (1.2s, no loop)
    animations.push(new THREE.AnimationClip('carjack', 1.2, [
        quatTrack('L_Shoulder', [0, 0.3, 0.7, 1.0, 1.2], [
            ...qi, ...eq(-1.2, 0, 0), ...eq(-0.4, 0, 0), ...eq(-0.2, 0, 0.3), ...qi
        ]),
        quatTrack('R_Shoulder', [0, 0.3, 0.7, 1.0, 1.2], [
            ...qi, ...eq(-1.2, 0, 0), ...eq(-0.4, 0, 0), ...eq(-1.0, 0, -0.3), ...qi
        ]),
        quatTrack('L_Elbow', [0, 0.3, 0.7, 1.0, 1.2], [
            ...qi, ...eq(-0.3, 0, 0), ...eq(-0.8, 0, 0), ...eq(-0.2, 0, 0), ...qi
        ]),
        quatTrack('R_Elbow', [0, 0.3, 0.7, 1.0, 1.2], [
            ...qi, ...eq(-0.3, 0, 0), ...eq(-0.8, 0, 0), ...eq(-0.1, 0, 0), ...qi
        ]),
        quatTrack('Chest', [0, 0.3, 0.7, 1.0, 1.2], [
            ...qi, ...eq(0.1, 0, 0), ...eq(0, 0.4, 0), ...eq(0, -0.3, 0), ...qi
        ]),
        quatTrack('Spine', [0, 0.3, 0.7, 1.0, 1.2], [
            ...qi, ...eq(0.15, 0, 0), ...eq(0.1, 0, 0), ...eq(0.05, 0, 0), ...qi
        ]),
    ]));

    // 8. Enter vehicle (0.8s, no loop)
    animations.push(new THREE.AnimationClip('enter_vehicle', 0.8, [
        posTrack('Root', [0, 0.2, 0.5, 0.7, 0.8], [
            0, 0.95, 0,  0, 0.8, 0,  0, 0.7, 0,  0, 0.7, 0,  0, 0.7, 0
        ]),
        quatTrack('L_Hip', [0, 0.2, 0.5, 0.7, 0.8], [
            ...qi, ...eq(0.2, 0, 0), ...eq(-0.3, 0, 0.8), ...eq(-0.5, 0, 0.2), ...eq(-0.5, 0, 0)
        ]),
        quatTrack('L_Knee', [0, 0.2, 0.5, 0.7, 0.8], [
            ...qi, ...eq(0.3, 0, 0), ...eq(0.6, 0, 0), ...eq(0.8, 0, 0), ...eq(0.8, 0, 0)
        ]),
        quatTrack('R_Hip', [0, 0.2, 0.5, 0.7, 0.8], [
            ...qi, ...qi, ...eq(-0.2, 0, 0), ...eq(-0.5, 0, 0), ...eq(-0.5, 0, 0)
        ]),
        quatTrack('R_Knee', [0, 0.2, 0.5, 0.7, 0.8], [
            ...qi, ...qi, ...eq(0.3, 0, 0), ...eq(0.8, 0, 0), ...eq(0.8, 0, 0)
        ]),
        quatTrack('Spine', [0, 0.2, 0.5, 0.7, 0.8], [
            ...qi, ...eq(0.1, 0, 0), ...eq(0.15, 0, 0), ...eq(0.1, 0, 0), ...eq(0.05, 0, 0)
        ]),
        quatTrack('L_Shoulder', [0, 0.2, 0.5, 0.8], [
            ...qi, ...eq(-0.5, 0, 0.4), ...eq(-0.3, 0, 0.2), ...qi
        ]),
        quatTrack('R_Shoulder', [0, 0.2, 0.5, 0.8], [
            ...qi, ...eq(-0.3, 0, -0.2), ...eq(-0.6, 0, 0), ...eq(-0.5, 0, 0)
        ]),
    ]));

    // 9. Exit vehicle (0.6s, no loop)
    animations.push(new THREE.AnimationClip('exit_vehicle', 0.6, [
        posTrack('Root', [0, 0.15, 0.35, 0.5, 0.6], [
            0, 0.7, 0,  0, 0.8, 0,  0, 0.95, 0,  0, 0.95, 0,  0, 0.95, 0
        ]),
        quatTrack('Spine', [0, 0.15, 0.35, 0.5, 0.6], [
            ...eq(0.05, 0, 0), ...eq(0.15, 0, 0), ...eq(0.08, 0, 0), ...eq(0.03, 0, 0), ...qi
        ]),
        quatTrack('L_Hip', [0, 0.15, 0.35, 0.5, 0.6], [
            ...eq(-0.5, 0, 0), ...eq(-0.3, 0, -0.6), ...eq(0.1, 0, -0.3), ...eq(0.05, 0, 0), ...qi
        ]),
        quatTrack('L_Knee', [0, 0.15, 0.35, 0.5, 0.6], [
            ...eq(0.8, 0, 0), ...eq(0.5, 0, 0), ...eq(0.2, 0, 0), ...eq(0.1, 0, 0), ...qi
        ]),
        quatTrack('R_Hip', [0, 0.15, 0.35, 0.5, 0.6], [
            ...eq(-0.5, 0, 0), ...eq(-0.5, 0, 0), ...eq(-0.2, 0, 0), ...eq(0, 0, 0), ...qi
        ]),
        quatTrack('R_Knee', [0, 0.15, 0.35, 0.5, 0.6], [
            ...eq(0.8, 0, 0), ...eq(0.8, 0, 0), ...eq(0.4, 0, 0), ...eq(0.1, 0, 0), ...qi
        ]),
        quatTrack('L_Shoulder', [0, 0.15, 0.35, 0.5, 0.6], [
            ...qi, ...eq(-0.4, 0, 0.3), ...eq(-0.2, 0, 0.2), ...eq(-0.1, 0, 0), ...qi
        ]),
        quatTrack('R_Shoulder', [0, 0.15, 0.35, 0.5, 0.6], [
            ...eq(-0.5, 0, 0), ...eq(-0.3, 0, -0.2), ...eq(-0.1, 0, 0), ...qi, ...qi
        ]),
    ]));

    // 10. Crouch idle (1.0s loop)
    animations.push(new THREE.AnimationClip('crouch_idle', 1.0, [
        posTrack('Root', [0, 1.0], [0, 0.65, 0, 0, 0.65, 0]),
        quatTrack('Spine', [0, 0.5, 1.0], [...eq(0.25, 0, 0), ...eq(0.27, 0, 0), ...eq(0.25, 0, 0)]),
        quatTrack('L_Hip', [0, 1.0], [...eq(-0.8, 0, 0), ...eq(-0.8, 0, 0)]),
        quatTrack('R_Hip', [0, 1.0], [...eq(-0.8, 0, 0), ...eq(-0.8, 0, 0)]),
        quatTrack('L_Knee', [0, 1.0], [...eq(1.2, 0, 0), ...eq(1.2, 0, 0)]),
        quatTrack('R_Knee', [0, 1.0], [...eq(1.2, 0, 0), ...eq(1.2, 0, 0)]),
    ]));

    // 11. Crouch walk (0.8s loop)
    const cwl = 20 * Math.PI / 180;
    animations.push(new THREE.AnimationClip('crouch_walk', 0.8, [
        posTrack('Root', [0, 0.2, 0.4, 0.6, 0.8], [
            0, 0.65, 0, 0, 0.68, 0, 0, 0.65, 0, 0, 0.68, 0, 0, 0.65, 0
        ]),
        quatTrack('Spine', [0, 0.8], [...eq(0.25, 0, 0), ...eq(0.25, 0, 0)]),
        quatTrack('L_Hip', [0, 0.2, 0.4, 0.6, 0.8], [
            ...eq(-0.8 + cwl, 0, 0), ...eq(-0.8, 0, 0), ...eq(-0.8 - cwl, 0, 0), ...eq(-0.8, 0, 0), ...eq(-0.8 + cwl, 0, 0)
        ]),
        quatTrack('R_Hip', [0, 0.2, 0.4, 0.6, 0.8], [
            ...eq(-0.8 - cwl, 0, 0), ...eq(-0.8, 0, 0), ...eq(-0.8 + cwl, 0, 0), ...eq(-0.8, 0, 0), ...eq(-0.8 - cwl, 0, 0)
        ]),
        quatTrack('L_Knee', [0, 0.8], [...eq(1.2, 0, 0), ...eq(1.2, 0, 0)]),
        quatTrack('R_Knee', [0, 0.8], [...eq(1.2, 0, 0), ...eq(1.2, 0, 0)]),
    ]));

    // 12. Aim pistol (0.3s, once→hold)
    animations.push(new THREE.AnimationClip('aim_pistol', 0.3, [
        quatTrack('R_Shoulder', [0, 0.3], [...qi, ...eq(-1.4, 0, 0)]),
        quatTrack('R_Elbow', [0, 0.3], [...qi, ...eq(-0.05, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.3], [...qi, ...eq(-0.8, 0, 0.3)]),
        quatTrack('L_Elbow', [0, 0.3], [...qi, ...eq(-0.6, 0, 0)]),
        quatTrack('Chest', [0, 0.3], [...qi, ...eq(0, 0.15, 0)]),
    ]));

    // 13. Aim rifle (0.3s, once→hold)
    animations.push(new THREE.AnimationClip('aim_rifle', 0.3, [
        quatTrack('R_Shoulder', [0, 0.3], [...qi, ...eq(-1.3, 0, -0.2)]),
        quatTrack('R_Elbow', [0, 0.3], [...qi, ...eq(-0.8, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.3], [...qi, ...eq(-1.3, 0, 0.3)]),
        quatTrack('L_Elbow', [0, 0.3], [...qi, ...eq(-0.7, 0, 0)]),
        quatTrack('Spine', [0, 0.3], [...qi, ...eq(0.05, 0, 0)]),
    ]));

    // 14. Fire pistol (0.15s, once)
    animations.push(new THREE.AnimationClip('fire_pistol', 0.15, [
        quatTrack('R_Shoulder', [0, 0.05, 0.15], [
            ...eq(-1.4, 0, 0), ...eq(-1.2, 0, 0), ...eq(-1.4, 0, 0)
        ]),
        quatTrack('R_Elbow', [0, 0.05, 0.15], [
            ...eq(-0.05, 0, 0), ...eq(-0.15, 0, 0), ...eq(-0.05, 0, 0)
        ]),
    ]));

    // 15. Fire rifle (0.12s, once)
    animations.push(new THREE.AnimationClip('fire_rifle', 0.12, [
        quatTrack('R_Shoulder', [0, 0.04, 0.12], [
            ...eq(-1.3, 0, -0.2), ...eq(-1.15, 0, -0.2), ...eq(-1.3, 0, -0.2)
        ]),
        quatTrack('L_Shoulder', [0, 0.04, 0.12], [
            ...eq(-1.3, 0, 0.3), ...eq(-1.15, 0, 0.3), ...eq(-1.3, 0, 0.3)
        ]),
        quatTrack('Spine', [0, 0.04, 0.12], [
            ...eq(0.05, 0, 0), ...eq(0.02, 0, 0), ...eq(0.05, 0, 0)
        ]),
    ]));

    // 16. Melee combo 2 — left hook (0.35s, once)
    animations.push(new THREE.AnimationClip('melee_combo2', 0.35, [
        quatTrack('L_Shoulder', [0, 0.1, 0.22, 0.35], [
            ...qi, ...eq(0.4, 0, 0.3), ...eq(-1.3, 0, 0), ...qi
        ]),
        quatTrack('L_Elbow', [0, 0.1, 0.22, 0.35], [
            ...qi, ...eq(-0.9, 0, 0), ...eq(-0.2, 0, 0), ...qi
        ]),
        quatTrack('Chest', [0, 0.1, 0.22, 0.35], [
            ...qi, ...eq(0, 0.3, 0), ...eq(0, -0.4, 0), ...qi
        ]),
    ]));

    // 17. Melee combo 3 — roundhouse kick (0.4s, once)
    animations.push(new THREE.AnimationClip('melee_combo3', 0.4, [
        quatTrack('R_Hip', [0, 0.1, 0.25, 0.4], [
            ...qi, ...eq(-0.3, 0, 0), ...eq(-1.4, 0, -0.5), ...qi
        ]),
        quatTrack('R_Knee', [0, 0.1, 0.25, 0.4], [
            ...qi, ...eq(0.4, 0, 0), ...eq(0.1, 0, 0), ...qi
        ]),
        quatTrack('Chest', [0, 0.1, 0.25, 0.4], [
            ...qi, ...eq(0, -0.4, 0), ...eq(0, -0.8, 0), ...qi
        ]),
        quatTrack('Spine', [0, 0.4], [...eq(0.1, 0, 0), ...eq(0.1, 0, 0)]),
    ]));

    // 18. Melee bat swing (0.5s, once)
    animations.push(new THREE.AnimationClip('melee_bat', 0.5, [
        quatTrack('R_Shoulder', [0, 0.15, 0.3, 0.5], [
            ...qi, ...eq(-2.5, 0, -0.3), ...eq(-0.8, 0, 0.5), ...qi
        ]),
        quatTrack('R_Elbow', [0, 0.15, 0.3, 0.5], [
            ...qi, ...eq(-0.3, 0, 0), ...eq(-0.1, 0, 0), ...qi
        ]),
        quatTrack('Chest', [0, 0.15, 0.3, 0.5], [
            ...qi, ...eq(0, -0.5, 0), ...eq(0, 0.6, 0), ...qi
        ]),
    ]));

    // 19. Melee knife slash (0.3s, once)
    animations.push(new THREE.AnimationClip('melee_knife', 0.3, [
        quatTrack('R_Shoulder', [0, 0.08, 0.2, 0.3], [
            ...qi, ...eq(-0.8, 0, -0.4), ...eq(-1.2, 0, 0.3), ...qi
        ]),
        quatTrack('R_Elbow', [0, 0.08, 0.2, 0.3], [
            ...qi, ...eq(-0.4, 0, 0), ...eq(-0.1, 0, 0), ...qi
        ]),
        quatTrack('Chest', [0, 0.08, 0.2, 0.3], [
            ...qi, ...eq(0, -0.2, 0), ...eq(0, 0.3, 0), ...qi
        ]),
    ]));

    // 20. Fall (0.5s, once)
    animations.push(new THREE.AnimationClip('fall', 0.5, [
        quatTrack('L_Shoulder', [0, 0.2, 0.5], [
            ...qi, ...eq(-1.8, 0, 0.6), ...eq(-2.0, 0, 0.4)
        ]),
        quatTrack('R_Shoulder', [0, 0.2, 0.5], [
            ...qi, ...eq(-1.8, 0, -0.6), ...eq(-2.0, 0, -0.4)
        ]),
        quatTrack('L_Hip', [0, 0.5], [...qi, ...eq(-0.3, 0, 0.2)]),
        quatTrack('R_Hip', [0, 0.5], [...qi, ...eq(-0.2, 0, -0.15)]),
        quatTrack('Spine', [0, 0.5], [...qi, ...eq(-0.15, 0, 0)]),
    ]));

    // 21. Land hard (0.3s, once)
    animations.push(new THREE.AnimationClip('land_hard', 0.3, [
        posTrack('Root', [0, 0.1, 0.3], [0, 0.95, 0, 0, 0.7, 0, 0, 0.95, 0]),
        quatTrack('L_Hip', [0, 0.1, 0.3], [...qi, ...eq(-0.5, 0, 0), ...qi]),
        quatTrack('R_Hip', [0, 0.1, 0.3], [...qi, ...eq(-0.5, 0, 0), ...qi]),
        quatTrack('L_Knee', [0, 0.1, 0.3], [...qi, ...eq(0.8, 0, 0), ...qi]),
        quatTrack('R_Knee', [0, 0.1, 0.3], [...qi, ...eq(0.8, 0, 0), ...qi]),
        quatTrack('Spine', [0, 0.1, 0.3], [...qi, ...eq(0.2, 0, 0), ...qi]),
    ]));

    // 22. Hands up / surrender (0.4s, once→hold)
    animations.push(new THREE.AnimationClip('hands_up', 0.4, [
        quatTrack('L_Shoulder', [0, 0.4], [...qi, ...eq(-2.8, 0, 0.3)]),
        quatTrack('R_Shoulder', [0, 0.4], [...qi, ...eq(-2.8, 0, -0.3)]),
        quatTrack('L_Elbow', [0, 0.4], [...qi, ...eq(-0.3, 0, 0)]),
        quatTrack('R_Elbow', [0, 0.4], [...qi, ...eq(-0.3, 0, 0)]),
    ]));

    // 23. Death front (0.8s, once)
    animations.push(new THREE.AnimationClip('death_front', 0.8, [
        posTrack('Root', [0, 0.3, 0.6, 0.8], [
            0, 0.95, 0,  0, 0.7, 0,  0, 0.3, 0,  0, 0.15, 0
        ]),
        quatTrack('Spine', [0, 0.3, 0.6, 0.8], [
            ...qi, ...eq(0.3, 0, 0), ...eq(0.8, 0, 0), ...eq(1.2, 0, 0)
        ]),
        quatTrack('L_Hip', [0, 0.8], [...qi, ...eq(-0.3, 0, 0.2)]),
        quatTrack('R_Hip', [0, 0.8], [...qi, ...eq(-0.2, 0, -0.1)]),
        quatTrack('L_Shoulder', [0, 0.4, 0.8], [...qi, ...eq(0.5, 0, 0.3), ...eq(0.2, 0, 0.4)]),
        quatTrack('R_Shoulder', [0, 0.4, 0.8], [...qi, ...eq(0.5, 0, -0.3), ...eq(0.2, 0, -0.4)]),
    ]));

    // 24. Death back (0.8s, once)
    animations.push(new THREE.AnimationClip('death_back', 0.8, [
        posTrack('Root', [0, 0.3, 0.6, 0.8], [
            0, 0.95, 0,  0, 0.7, 0,  0, 0.3, 0,  0, 0.15, 0
        ]),
        quatTrack('Spine', [0, 0.3, 0.6, 0.8], [
            ...qi, ...eq(-0.2, 0, 0), ...eq(-0.6, 0, 0), ...eq(-1.0, 0, 0)
        ]),
        quatTrack('L_Hip', [0, 0.8], [...qi, ...eq(0.3, 0, 0.2)]),
        quatTrack('R_Hip', [0, 0.8], [...qi, ...eq(0.2, 0, -0.15)]),
        quatTrack('L_Shoulder', [0, 0.8], [...qi, ...eq(-0.8, 0, 0.5)]),
        quatTrack('R_Shoulder', [0, 0.8], [...qi, ...eq(-0.8, 0, -0.5)]),
    ]));

    // 25. Swim surface (1.2s loop) — breaststroke
    animations.push(new THREE.AnimationClip('swim_surface', 1.2, [
        quatTrack('Spine', [0, 1.2], [...eq(0.4, 0, 0), ...eq(0.4, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.3, 0.6, 0.9, 1.2], [
            ...eq(-1.5, 0, 0.5), ...eq(-0.5, 0, 0.8), ...eq(0.2, 0, 0.3), ...eq(-0.8, 0, 0.2), ...eq(-1.5, 0, 0.5)
        ]),
        quatTrack('R_Shoulder', [0, 0.3, 0.6, 0.9, 1.2], [
            ...eq(-1.5, 0, -0.5), ...eq(-0.5, 0, -0.8), ...eq(0.2, 0, -0.3), ...eq(-0.8, 0, -0.2), ...eq(-1.5, 0, -0.5)
        ]),
        quatTrack('L_Elbow', [0, 0.3, 0.6, 1.2], [
            ...eq(-0.3, 0, 0), ...eq(-0.8, 0, 0), ...eq(-0.2, 0, 0), ...eq(-0.3, 0, 0)
        ]),
        quatTrack('R_Elbow', [0, 0.3, 0.6, 1.2], [
            ...eq(-0.3, 0, 0), ...eq(-0.8, 0, 0), ...eq(-0.2, 0, 0), ...eq(-0.3, 0, 0)
        ]),
        quatTrack('L_Hip', [0, 0.6, 1.2], [...eq(-0.2, 0, 0), ...eq(0.3, 0, 0), ...eq(-0.2, 0, 0)]),
        quatTrack('R_Hip', [0, 0.6, 1.2], [...eq(0.3, 0, 0), ...eq(-0.2, 0, 0), ...eq(0.3, 0, 0)]),
    ]));

    // 26. Swim underwater (1.0s loop) — crawl stroke
    animations.push(new THREE.AnimationClip('swim_under', 1.0, [
        quatTrack('Spine', [0, 1.0], [...eq(1.2, 0, 0), ...eq(1.2, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.25, 0.5, 0.75, 1.0], [
            ...eq(-2.5, 0, 0.3), ...eq(-1.0, 0, 0.5), ...eq(0.3, 0, 0.2), ...eq(-1.5, 0, 0.3), ...eq(-2.5, 0, 0.3)
        ]),
        quatTrack('R_Shoulder', [0, 0.25, 0.5, 0.75, 1.0], [
            ...eq(0.3, 0, -0.2), ...eq(-1.5, 0, -0.3), ...eq(-2.5, 0, -0.3), ...eq(-1.0, 0, -0.5), ...eq(0.3, 0, -0.2)
        ]),
        quatTrack('L_Hip', [0, 0.5, 1.0], [...eq(0.2, 0, 0), ...eq(-0.2, 0, 0), ...eq(0.2, 0, 0)]),
        quatTrack('R_Hip', [0, 0.5, 1.0], [...eq(-0.2, 0, 0), ...eq(0.2, 0, 0), ...eq(-0.2, 0, 0)]),
    ]));

    // 27. NPC: pulled from car (1.0s, once)
    animations.push(new THREE.AnimationClip('pulled_from_car', 1.0, [
        posTrack('Root', [0, 0.3, 0.6, 1.0], [
            0, 0.7, 0,  0, 0.85, 0,  0, 0.5, 0,  0, 0.95, 0
        ]),
        quatTrack('Spine', [0, 0.3, 0.6, 1.0], [
            ...eq(0.1, 0, 0), ...eq(-0.3, 0, 0), ...eq(0.4, 0, 0.2), ...qi
        ]),
        quatTrack('L_Shoulder', [0, 0.3, 0.6, 1.0], [
            ...qi, ...eq(-1.0, 0, 0.5), ...eq(-0.5, 0, 0.3), ...qi
        ]),
        quatTrack('R_Shoulder', [0, 0.3, 0.6, 1.0], [
            ...qi, ...eq(-1.0, 0, -0.5), ...eq(-0.5, 0, -0.3), ...qi
        ]),
    ]));

    // 28. NPC: cower with hands up (0.4s, once→hold)
    animations.push(new THREE.AnimationClip('aimed_at_cower', 0.4, [
        quatTrack('L_Shoulder', [0, 0.4], [...qi, ...eq(-2.5, 0, 0.4)]),
        quatTrack('R_Shoulder', [0, 0.4], [...qi, ...eq(-2.5, 0, -0.4)]),
        quatTrack('Spine', [0, 0.4], [...qi, ...eq(-0.3, 0, 0)]),
        quatTrack('L_Knee', [0, 0.4], [...qi, ...eq(0.2, 0, 0)]),
        quatTrack('R_Knee', [0, 0.4], [...qi, ...eq(0.2, 0, 0)]),
    ]));

    // 29. NPC: comply — kneel with hands behind head (0.5s, once→hold)
    animations.push(new THREE.AnimationClip('aimed_at_comply', 0.5, [
        posTrack('Root', [0, 0.5], [0, 0.95, 0, 0, 0.55, 0]),
        quatTrack('L_Hip', [0, 0.5], [...qi, ...eq(-1.2, 0, 0)]),
        quatTrack('R_Hip', [0, 0.5], [...qi, ...eq(-1.2, 0, 0)]),
        quatTrack('L_Knee', [0, 0.5], [...qi, ...eq(2.0, 0, 0)]),
        quatTrack('R_Knee', [0, 0.5], [...qi, ...eq(2.0, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.5], [...qi, ...eq(-2.8, 0, 0.3)]),
        quatTrack('R_Shoulder', [0, 0.5], [...qi, ...eq(-2.8, 0, -0.3)]),
        quatTrack('L_Elbow', [0, 0.5], [...qi, ...eq(-1.5, 0, 0)]),
        quatTrack('R_Elbow', [0, 0.5], [...qi, ...eq(-1.5, 0, 0)]),
    ]));

    // 30. NPC: phone talk (2.0s loop)
    animations.push(new THREE.AnimationClip('phone_talk', 2.0, [
        quatTrack('R_Shoulder', [0, 2.0], [...eq(-1.8, 0, -0.3), ...eq(-1.8, 0, -0.3)]),
        quatTrack('R_Elbow', [0, 2.0], [...eq(-2.0, 0, 0), ...eq(-2.0, 0, 0)]),
        quatTrack('Head', [0, 0.5, 1.0, 1.5, 2.0], [
            ...qi, ...eq(0.08, 0, 0), ...qi, ...eq(0.05, 0.05, 0), ...qi
        ]),
    ]));

    // 31. NPC: sit on bench (0.5s, once→hold)
    animations.push(new THREE.AnimationClip('sit_bench', 0.5, [
        posTrack('Root', [0, 0.5], [0, 0.95, 0, 0, 0.55, 0]),
        quatTrack('L_Hip', [0, 0.5], [...qi, ...eq(-1.4, 0, 0)]),
        quatTrack('R_Hip', [0, 0.5], [...qi, ...eq(-1.4, 0, 0)]),
        quatTrack('L_Knee', [0, 0.5], [...qi, ...eq(1.4, 0, 0)]),
        quatTrack('R_Knee', [0, 0.5], [...qi, ...eq(1.4, 0, 0)]),
        quatTrack('Spine', [0, 0.5], [...qi, ...eq(-0.1, 0, 0)]),
    ]));

    // 32. NPC: lean against wall (0.3s, once→hold)
    animations.push(new THREE.AnimationClip('lean_wall', 0.3, [
        quatTrack('Spine', [0, 0.3], [...qi, ...eq(-0.15, 0, 0)]),
        quatTrack('L_Hip', [0, 0.3], [...qi, ...eq(0.2, 0, 0.3)]),
        quatTrack('L_Knee', [0, 0.3], [...qi, ...eq(0.5, 0, 0)]),
        quatTrack('R_Shoulder', [0, 0.3], [...qi, ...eq(0.1, 0, -0.2)]),
    ]));

    return animations;
}


function buildCharacter(gender = 'male') {
    const scene = new THREE.Scene();
    const { bones, skeleton } = buildSkeleton();

    const { baseParts, fatParts, muscleParts } = buildCharacterParts(gender);
    const skinnedMesh = assembleCharacterMesh(
        baseParts, [fatParts, muscleParts], bones, skeleton
    );

    scene.add(skinnedMesh);

    const animations = buildCharacterAnimations();
    return { scene, animations };
}


// ============================================================
// VEHICLE MODELS — Curved profiles, proper silhouettes
// ============================================================
function buildVehicle(type) {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.name = type;

    const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4, metalness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x88aacc, roughness: 0.1, metalness: 0.3,
        transparent: true, opacity: 0.6
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.08, metalness: 0.95 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.95, metalness: 0.0 });
    const headlightMat = new THREE.MeshStandardMaterial({
        color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.4
    });
    const taillightMat = new THREE.MeshStandardMaterial({
        color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.3
    });

    if (type === 'sedan' || type === 'sports' || type === 'police') {
        const isSports = type === 'sports';
        const isPolice = type === 'police';
        const w = isSports ? 1.9 : 2.0;
        const h = isSports ? 1.1 : 1.3;
        const l = isSports ? 4.2 : 4.5;
        const bodyMat = isPolice
            ? new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.6 })
            : mat;
        const policeTrim = isPolice
            ? new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4, metalness: 0.6 })
            : null;

        // Lower body — extruded side profile with curved hood and trunk
        const bodyShape = new THREE.Shape();
        const bh = h * 0.45;
        bodyShape.moveTo(-l/2, 0);
        bodyShape.lineTo(-l/2, bh * 0.8);  // rear face
        bodyShape.lineTo(-l*0.3, bh);       // trunk rise
        bodyShape.lineTo(l*0.1, bh);        // roof rear
        bodyShape.lineTo(l*0.35, bh * 0.7); // hood slope
        bodyShape.lineTo(l/2, bh * 0.55);   // front nose
        bodyShape.lineTo(l/2, 0);            // front bottom
        bodyShape.lineTo(-l/2, 0);           // close
        const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
            steps: 1, depth: w, bevelEnabled: false
        });
        bodyGeo.translate(0, 0, -w/2);
        bodyGeo.rotateY(Math.PI / 2);
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = h * 0.12;
        bodyMesh.castShadow = true;
        group.add(bodyMesh);

        // Cabin / greenhouse — glass box with tapered shape
        const cabW = w * 0.78;
        const cabH = isSports ? h * 0.28 : h * 0.38;
        const cabL = l * 0.35;
        const cabGeo = new THREE.BoxGeometry(cabW, cabH, cabL);
        const cabin = new THREE.Mesh(cabGeo, glassMat);
        cabin.position.set(0, h * (isSports ? 0.58 : 0.68), -l * 0.04);
        group.add(cabin);

        // A-pillars (windshield frame)
        for (const side of [-1, 1]) {
            const pillarGeo = new THREE.BoxGeometry(0.06, cabH * 1.05, 0.06);
            const pillar = new THREE.Mesh(pillarGeo, bodyMat);
            pillar.position.set(side * cabW/2, cabin.position.y, l * 0.12);
            pillar.rotation.x = -0.25;
            group.add(pillar);
        }

        // Windshield (angled glass plane)
        const wsGeo = new THREE.PlaneGeometry(cabW - 0.1, cabH * 0.95);
        const ws = new THREE.Mesh(wsGeo, glassMat);
        ws.position.set(0, cabin.position.y, l * 0.15);
        ws.rotation.x = isSports ? -0.35 : -0.28;
        group.add(ws);

        // Rear window
        const rwGeo = new THREE.PlaneGeometry(cabW - 0.1, cabH * 0.8);
        const rw = new THREE.Mesh(rwGeo, glassMat);
        rw.position.set(0, cabin.position.y, -l * 0.2);
        rw.rotation.x = 0.25;
        group.add(rw);

        // Front bumper — rounded
        const fbGeo = new THREE.BoxGeometry(w + 0.15, 0.18, 0.12);
        const fb = new THREE.Mesh(fbGeo, chromeMat);
        fb.position.set(0, h * 0.18, l / 2 + 0.02);
        group.add(fb);

        // Rear bumper
        const rbGeo = new THREE.BoxGeometry(w + 0.15, 0.18, 0.12);
        const rb = new THREE.Mesh(rbGeo, chromeMat);
        rb.position.set(0, h * 0.18, -l / 2 - 0.02);
        group.add(rb);

        // Wheel arches — curved cutouts (half-cylinders)
        const wheelR = isSports ? 0.22 : 0.25;
        for (const side of [-1, 1]) {
            for (const fz of [l * 0.3, -l * 0.3]) {
                const archGeo = new THREE.CylinderGeometry(wheelR + 0.08, wheelR + 0.08, 0.12, 10, 1, false, 0, Math.PI);
                archGeo.rotateX(Math.PI / 2);
                archGeo.rotateY(side > 0 ? 0 : Math.PI);
                const arch = new THREE.Mesh(archGeo, bodyMat);
                arch.position.set(side * w/2, wheelR + h * 0.12, fz);
                group.add(arch);
            }
        }

        // Side mirrors
        for (const side of [-1, 1]) {
            const armGeo = new THREE.BoxGeometry(0.25, 0.04, 0.04);
            const arm = new THREE.Mesh(armGeo, bodyMat);
            arm.position.set(side * (w / 2 + 0.12), h * 0.58, l * 0.14);
            group.add(arm);
            const mirGeo = new THREE.BoxGeometry(0.06, 0.08, 0.1);
            const mir = new THREE.Mesh(mirGeo, chromeMat);
            mir.position.set(side * (w / 2 + 0.24), h * 0.58, l * 0.14);
            group.add(mir);
        }

        // Headlights — inset with lens
        for (const side of [-1, 1]) {
            const hlGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 8);
            hlGeo.rotateX(Math.PI / 2);
            const hl = new THREE.Mesh(hlGeo, headlightMat);
            hl.position.set(side * w * 0.35, h * 0.32, l / 2 + 0.04);
            group.add(hl);
        }

        // Taillights
        for (const side of [-1, 1]) {
            const tlGeo = new THREE.BoxGeometry(0.22, 0.08, 0.04);
            const tl = new THREE.Mesh(tlGeo, taillightMat);
            tl.position.set(side * w * 0.35, h * 0.32, -l / 2 - 0.04);
            group.add(tl);
        }

        // Door handle lines (thin grooves)
        for (const side of [-1, 1]) {
            const handleGeo = new THREE.BoxGeometry(0.01, 0.03, 0.08);
            const handle = new THREE.Mesh(handleGeo, chromeMat);
            handle.position.set(side * (w/2 + 0.01), h * 0.42, l * 0.02);
            group.add(handle);
        }

        // Grille
        const grilleGeo = new THREE.BoxGeometry(w * 0.5, h * 0.12, 0.03);
        const grille = new THREE.Mesh(grilleGeo, darkMat);
        grille.position.set(0, h * 0.25, l / 2 + 0.04);
        group.add(grille);

        // License plate area
        const plateGeo = new THREE.BoxGeometry(0.3, 0.08, 0.01);
        const plate = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({ color: 0xffffee, roughness: 0.5 }));
        plate.position.set(0, h * 0.15, -l / 2 - 0.06);
        group.add(plate);

        // Spoiler for sports
        if (isSports) {
            const spGeo = new THREE.BoxGeometry(w * 0.75, 0.04, 0.25);
            const sp = new THREE.Mesh(spGeo, mat);
            sp.position.set(0, h * 0.62, -l * 0.42);
            group.add(sp);
            for (const s of [-0.3, 0.3]) {
                const stGeo = new THREE.BoxGeometry(0.04, 0.12, 0.04);
                const st = new THREE.Mesh(stGeo, mat);
                st.position.set(s, h * 0.56, -l * 0.42);
                group.add(st);
            }
            // Side vents
            for (const side of [-1, 1]) {
                for (let i = 0; i < 3; i++) {
                    const ventGeo = new THREE.BoxGeometry(0.01, 0.02, 0.15);
                    const vent = new THREE.Mesh(ventGeo, darkMat);
                    vent.position.set(side * (w/2 + 0.01), h * 0.35 + i * 0.04, l * 0.15);
                    group.add(vent);
                }
            }
        }

        // Police light bar
        if (isPolice) {
            const lbBase = new THREE.Mesh(
                new THREE.BoxGeometry(w * 0.45, 0.06, 0.25), darkMat
            );
            lbBase.position.set(0, h * 0.88, -l * 0.04);
            group.add(lbBase);
            // Red light
            const redLight = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.08, 0.15),
                new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 })
            );
            redLight.position.set(-0.2, h * 0.93, -l * 0.04);
            group.add(redLight);
            // Blue light
            const blueLight = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.08, 0.15),
                new THREE.MeshStandardMaterial({ color: 0x0044ff, emissive: 0x0022aa, emissiveIntensity: 0.5 })
            );
            blueLight.position.set(0.2, h * 0.93, -l * 0.04);
            group.add(blueLight);
            // Push bumper
            const pushGeo = new THREE.BoxGeometry(w * 0.6, 0.25, 0.08);
            const pushBumper = new THREE.Mesh(pushGeo, darkMat);
            pushBumper.position.set(0, h * 0.18, l / 2 + 0.12);
            group.add(pushBumper);
        }

        // Wheels with hub detail
        addWheels(group, w, l, wheelR, tireMat, isSports);

    } else if (type === 'truck') {
        const w = 2.4, h = 2.2, l = 6;

        // Cab
        const cabGeo = new THREE.BoxGeometry(w, h * 0.7, l * 0.35);
        const cab = new THREE.Mesh(cabGeo, mat);
        cab.position.set(0, h * 0.4, l * 0.25);
        cab.castShadow = true;
        group.add(cab);

        // Windshield
        const wsGeo = new THREE.PlaneGeometry(w * 0.8, h * 0.35);
        const ws = new THREE.Mesh(wsGeo, glassMat);
        ws.position.set(0, h * 0.65, l * 0.42);
        ws.rotation.x = -0.2;
        group.add(ws);

        // Bed
        const bedGeo = new THREE.BoxGeometry(w, h * 0.3, l * 0.6);
        const bed = new THREE.Mesh(bedGeo, mat);
        bed.position.set(0, h * 0.2, -l * 0.15);
        group.add(bed);

        // Bed walls
        for (const side of [-1, 1]) {
            const wallGeo = new THREE.BoxGeometry(0.1, h * 0.25, l * 0.6);
            const wall = new THREE.Mesh(wallGeo, mat);
            wall.position.set(side * w / 2, h * 0.45, -l * 0.15);
            group.add(wall);
        }

        // Tailgate
        const tgGeo = new THREE.BoxGeometry(w, h * 0.25, 0.1);
        const tg = new THREE.Mesh(tgGeo, mat);
        tg.position.set(0, h * 0.45, -l * 0.45);
        group.add(tg);

        // Step rails
        for (const side of [-1, 1]) {
            const railGeo = new THREE.BoxGeometry(0.1, 0.05, l * 0.2);
            const rail = new THREE.Mesh(railGeo, chromeMat);
            rail.position.set(side * (w / 2 + 0.05), h * 0.1, l * 0.1);
            group.add(rail);
        }

        addWheels(group, w, l, 0.3, darkMat);

    } else if (type === 'motorcycle') {
        const l = 2;

        // Frame
        const frameGeo = new THREE.CylinderGeometry(0.06, 0.06, l * 0.8, 6);
        frameGeo.rotateX(Math.PI / 2);
        const frame = new THREE.Mesh(frameGeo, mat);
        frame.position.y = 0.5;
        group.add(frame);

        // Engine block
        const engGeo = new THREE.BoxGeometry(0.25, 0.2, 0.3);
        const eng = new THREE.Mesh(engGeo, darkMat);
        eng.position.set(0, 0.35, 0.1);
        group.add(eng);

        // Gas tank
        const tankGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.3, 8);
        tankGeo.rotateX(Math.PI / 2);
        const tank = new THREE.Mesh(tankGeo, mat);
        tank.position.set(0, 0.65, 0.15);
        group.add(tank);

        // Seat
        const seatGeo = new THREE.BoxGeometry(0.25, 0.08, 0.5);
        const seat = new THREE.Mesh(seatGeo, darkMat);
        seat.position.set(0, 0.7, -0.15);
        group.add(seat);

        // Forks
        for (const side of [-0.08, 0.08]) {
            const fGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4);
            const f = new THREE.Mesh(fGeo, chromeMat);
            f.position.set(side, 0.5, 0.6);
            f.rotation.x = -0.2;
            group.add(f);
        }

        // Handlebars
        const hbGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4);
        const hb = new THREE.Mesh(hbGeo, chromeMat);
        hb.position.set(0, 0.85, 0.55);
        group.add(hb);

        // Wheels (motorcycle: 2 wheels inline)
        for (const zOff of [-0.7, 0.7]) {
            const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12);
            wheelGeo.rotateZ(Math.PI / 2);
            const wheel = new THREE.Mesh(wheelGeo, darkMat);
            wheel.position.set(0, 0.3, zOff);
            wheel.name = 'wheel';
            group.add(wheel);
        }

        // Exhaust
        const exGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.8, 6);
        exGeo.rotateX(Math.PI / 2);
        const ex = new THREE.Mesh(exGeo, chromeMat);
        ex.position.set(0.15, 0.25, -0.2);
        group.add(ex);

    } else if (type === 'boat') {
        const w = 2.5, h = 1.0, l = 5;

        // Hull - wedge shape
        const hullShape = new THREE.Shape();
        hullShape.moveTo(0, l / 2);
        hullShape.lineTo(-w / 2, -l * 0.2);
        hullShape.lineTo(-w / 2, -l / 2);
        hullShape.lineTo(w / 2, -l / 2);
        hullShape.lineTo(w / 2, -l * 0.2);
        hullShape.lineTo(0, l / 2);
        const hullGeo = new THREE.ExtrudeGeometry(hullShape, { steps: 1, depth: h * 0.5, bevelEnabled: false });
        const hull = new THREE.Mesh(hullGeo, mat);
        hull.rotation.x = -Math.PI / 2;
        hull.position.y = -h * 0.1;
        group.add(hull);

        // Gunwales
        for (const side of [-1, 1]) {
            const rGeo = new THREE.BoxGeometry(0.1, 0.15, l * 0.7);
            const r = new THREE.Mesh(rGeo, mat);
            r.position.set(side * w * 0.48, h * 0.3, -l * 0.05);
            group.add(r);
        }

        // Cabin
        const cabGeo = new THREE.BoxGeometry(w * 0.6, h * 0.5, l * 0.25);
        const cab = new THREE.Mesh(cabGeo, mat);
        cab.position.set(0, h * 0.45, -l * 0.1);
        group.add(cab);

        // Windshield
        const bwsGeo = new THREE.PlaneGeometry(w * 0.55, h * 0.4);
        const bws = new THREE.Mesh(bwsGeo, glassMat);
        bws.position.set(0, h * 0.55, -l * 0.1 + l * 0.125 + 0.01);
        bws.rotation.x = -0.2;
        group.add(bws);

        // Motor
        const motGeo = new THREE.BoxGeometry(0.4, 0.5, 0.3);
        const motMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
        const mot = new THREE.Mesh(motGeo, motMat);
        mot.position.set(0, 0, -l / 2 - 0.1);
        group.add(mot);

        // Motor shaft
        const shaftGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 4);
        const shaft = new THREE.Mesh(shaftGeo, motMat);
        shaft.position.set(0, -0.3, -l / 2 - 0.1);
        group.add(shaft);
    }

    scene.add(group);
    return { scene, animations: [] };
}

function addWheels(group, width, length, radius, wheelMat, isSports) {
    const positions = [
        { x: -width / 2, z: length * 0.3, name: 'wheel_FL' },
        { x: width / 2, z: length * 0.3, name: 'wheel_FR' },
        { x: -width / 2, z: -length * 0.3, name: 'wheel_RL' },
        { x: width / 2, z: -length * 0.3, name: 'wheel_RR' },
    ];

    const hubMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.2, metalness: 0.8 });
    const tireWidth = isSports ? 0.18 : 0.14;

    for (const pos of positions) {
        const wheelGroup = new THREE.Group();
        wheelGroup.name = pos.name;

        // Tire (outer ring)
        const tireGeo = new THREE.CylinderGeometry(radius, radius, tireWidth, 14);
        tireGeo.rotateZ(Math.PI / 2);
        const tire = new THREE.Mesh(tireGeo, wheelMat);
        wheelGroup.add(tire);

        // Hub cap (smaller disc)
        const hubGeo = new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, tireWidth + 0.02, 10);
        hubGeo.rotateZ(Math.PI / 2);
        const hub = new THREE.Mesh(hubGeo, hubMat);
        wheelGroup.add(hub);

        // 5 spokes
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const spokeGeo = new THREE.BoxGeometry(0.02, radius * 0.35, 0.025);
            const spoke = new THREE.Mesh(spokeGeo, hubMat);
            spoke.position.set(
                pos.x > 0 ? tireWidth/2 + 0.01 : -tireWidth/2 - 0.01,
                Math.sin(angle) * radius * 0.35,
                Math.cos(angle) * radius * 0.35
            );
            spoke.rotation.x = angle;
            // Spokes are children of the group but positioned relative
            // Just add to the wheelGroup for simplicity
            wheelGroup.add(spoke);
        }

        wheelGroup.position.set(pos.x, radius, pos.z);
        group.add(wheelGroup);
    }
}


// ============================================================
// WEAPON MODELS
// ============================================================

function buildWeapon(weaponId) {
    const scene = new THREE.Scene();
    const metal = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.7 });
    const wood = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.1 });
    const matte = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.3 });

    const group = new THREE.Group();
    group.name = weaponId;

    switch (weaponId) {
        case 'bat': {
            const shaft = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.105, 1.65, 8),
                wood(0x8B5A2B)
            );
            shaft.rotation.x = Math.PI / 2;
            shaft.position.z = 0.75;
            shaft.name = 'shaft';
            group.add(shaft);
            const grip = new THREE.Mesh(
                new THREE.CylinderGeometry(0.066, 0.066, 0.36, 8),
                matte(0x222222)
            );
            grip.rotation.x = Math.PI / 2;
            grip.position.z = -0.06;
            grip.name = 'grip';
            group.add(grip);
            // Knob at end of handle
            const knob = new THREE.Mesh(
                new THREE.SphereGeometry(0.072, 6, 6),
                wood(0x7a4e25)
            );
            knob.position.z = -0.24;
            knob.name = 'knob';
            group.add(knob);
            break;
        }

        case 'knife': {
            const blade = new THREE.Mesh(
                new THREE.BoxGeometry(0.024, 0.075, 0.54),
                metal(0xbbccdd)
            );
            blade.position.z = 0.42;
            blade.name = 'blade';
            group.add(blade);
            // Blade edge taper
            const edge = new THREE.Mesh(
                new THREE.BoxGeometry(0.006, 0.06, 0.48),
                metal(0xddeeff)
            );
            edge.position.set(0, -0.01, 0.42);
            edge.name = 'edge';
            group.add(edge);
            const handle = new THREE.Mesh(
                new THREE.BoxGeometry(0.066, 0.096, 0.24),
                wood(0x332211)
            );
            handle.position.z = 0.03;
            handle.name = 'handle';
            group.add(handle);
            const guard = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, 0.024, 0.024),
                metal(0x888888)
            );
            guard.position.z = 0.15;
            guard.name = 'guard';
            group.add(guard);
            // Pommel
            const pommel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.036, 0.03, 6),
                metal(0x888888)
            );
            pommel.rotation.x = Math.PI / 2;
            pommel.position.z = -0.09;
            pommel.name = 'pommel';
            group.add(pommel);
            break;
        }

        case 'pistol': {
            const slide = new THREE.Mesh(
                new THREE.BoxGeometry(0.084, 0.096, 0.42),
                metal(0x2a2a2a)
            );
            slide.position.z = 0.18;
            slide.name = 'slide';
            group.add(slide);
            const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.024, 0.024, 0.12, 8),
                metal(0x333333)
            );
            barrel.rotation.x = Math.PI / 2;
            barrel.position.z = 0.45;
            barrel.name = 'barrel';
            group.add(barrel);
            const pGrip = new THREE.Mesh(
                new THREE.BoxGeometry(0.072, 0.18, 0.09),
                matte(0x1a1a1a)
            );
            pGrip.position.set(0, -0.12, -0.015);
            pGrip.rotation.x = 0.2;
            pGrip.name = 'grip';
            group.add(pGrip);
            const tGuard = new THREE.Mesh(
                new THREE.BoxGeometry(0.009, 0.06, 0.09),
                metal(0x333333)
            );
            tGuard.position.set(0, -0.054, 0.06);
            tGuard.name = 'trigger_guard';
            group.add(tGuard);
            // Front sight
            const fSight = new THREE.Mesh(
                new THREE.BoxGeometry(0.012, 0.024, 0.012),
                metal(0x444444)
            );
            fSight.position.set(0, 0.06, 0.36);
            fSight.name = 'front_sight';
            group.add(fSight);
            // Rear sight
            const rSight = new THREE.Mesh(
                new THREE.BoxGeometry(0.042, 0.024, 0.012),
                metal(0x444444)
            );
            rSight.position.set(0, 0.06, 0.03);
            rSight.name = 'rear_sight';
            group.add(rSight);
            break;
        }

        case 'smg': {
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(0.105, 0.12, 0.66),
                metal(0x222222)
            );
            body.position.z = 0.24;
            body.name = 'body';
            group.add(body);
            const shroud = new THREE.Mesh(
                new THREE.CylinderGeometry(0.036, 0.036, 0.24, 8),
                metal(0x333333)
            );
            shroud.rotation.x = Math.PI / 2;
            shroud.position.z = 0.69;
            shroud.name = 'shroud';
            group.add(shroud);
            const sGrip = new THREE.Mesh(
                new THREE.BoxGeometry(0.075, 0.165, 0.075),
                matte(0x1a1a1a)
            );
            sGrip.position.set(0, -0.12, 0.06);
            sGrip.rotation.x = 0.15;
            sGrip.name = 'grip';
            group.add(sGrip);
            const mag = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, 0.18, 0.045),
                metal(0x2a2a2a)
            );
            mag.position.set(0, -0.135, 0.24);
            mag.name = 'magazine';
            group.add(mag);
            const stock = new THREE.Mesh(
                new THREE.BoxGeometry(0.075, 0.045, 0.18),
                metal(0x2a2a2a)
            );
            stock.position.set(0, 0.03, -0.18);
            stock.name = 'stock';
            group.add(stock);
            // Foregrip
            const fGrip = new THREE.Mesh(
                new THREE.BoxGeometry(0.045, 0.09, 0.045),
                matte(0x1a1a1a)
            );
            fGrip.position.set(0, -0.09, 0.45);
            fGrip.name = 'foregrip';
            group.add(fGrip);
            break;
        }

        case 'shotgun': {
            const sgBarrel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.045, 0.045, 1.5, 8),
                metal(0x3a3a3a)
            );
            sgBarrel.rotation.x = Math.PI / 2;
            sgBarrel.position.z = 0.66;
            sgBarrel.name = 'barrel';
            group.add(sgBarrel);
            const pump = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.03, 0.36, 8),
                metal(0x555555)
            );
            pump.rotation.x = Math.PI / 2;
            pump.position.set(0, -0.06, 0.45);
            pump.name = 'pump';
            group.add(pump);
            const recv = new THREE.Mesh(
                new THREE.BoxGeometry(0.105, 0.12, 0.36),
                metal(0x2a2a2a)
            );
            recv.position.z = -0.06;
            recv.name = 'receiver';
            group.add(recv);
            const sgStock = new THREE.Mesh(
                new THREE.BoxGeometry(0.075, 0.12, 0.54),
                wood(0x6b4226)
            );
            sgStock.position.set(0, -0.015, -0.51);
            sgStock.rotation.x = -0.08;
            sgStock.name = 'stock';
            group.add(sgStock);
            const sgGrip = new THREE.Mesh(
                new THREE.BoxGeometry(0.066, 0.135, 0.06),
                wood(0x5a3520)
            );
            sgGrip.position.set(0, -0.105, -0.03);
            sgGrip.rotation.x = 0.2;
            sgGrip.name = 'grip';
            group.add(sgGrip);
            // Front bead sight
            const bead = new THREE.Mesh(
                new THREE.SphereGeometry(0.015, 4, 4),
                metal(0xcccccc)
            );
            bead.position.set(0, 0.054, 1.35);
            bead.name = 'bead_sight';
            group.add(bead);
            break;
        }

        case 'rifle': {
            const rBarrel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8),
                metal(0x333333)
            );
            rBarrel.rotation.x = Math.PI / 2;
            rBarrel.position.z = 0.84;
            rBarrel.name = 'barrel';
            group.add(rBarrel);
            const handguard = new THREE.Mesh(
                new THREE.BoxGeometry(0.096, 0.09, 0.48),
                matte(0x2a2a2a)
            );
            handguard.position.z = 0.54;
            handguard.name = 'handguard';
            group.add(handguard);
            const rRecv = new THREE.Mesh(
                new THREE.BoxGeometry(0.105, 0.135, 0.42),
                metal(0x222222)
            );
            rRecv.position.z = 0.06;
            rRecv.name = 'receiver';
            group.add(rRecv);
            const rMag = new THREE.Mesh(
                new THREE.BoxGeometry(0.054, 0.195, 0.054),
                metal(0x2a2a2a)
            );
            rMag.position.set(0, -0.15, 0.09);
            rMag.rotation.x = 0.1;
            rMag.name = 'magazine';
            group.add(rMag);
            const rStock = new THREE.Mesh(
                new THREE.BoxGeometry(0.084, 0.12, 0.42),
                matte(0x2a2a2a)
            );
            rStock.position.set(0, -0.015, -0.36);
            rStock.name = 'stock';
            group.add(rStock);
            const rGrip = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, 0.12, 0.06),
                matte(0x1a1a1a)
            );
            rGrip.position.set(0, -0.105, -0.06);
            rGrip.rotation.x = 0.25;
            rGrip.name = 'grip';
            group.add(rGrip);
            // Front sight post
            const fSight = new THREE.Mesh(
                new THREE.BoxGeometry(0.009, 0.045, 0.009),
                metal(0x444444)
            );
            fSight.position.set(0, 0.075, 0.75);
            fSight.name = 'front_sight';
            group.add(fSight);
            // Carry handle / rear sight
            const carry = new THREE.Mesh(
                new THREE.BoxGeometry(0.03, 0.045, 0.12),
                metal(0x333333)
            );
            carry.position.set(0, 0.09, 0.15);
            carry.name = 'carry_handle';
            group.add(carry);
            break;
        }

        case 'sniper': {
            const sBarrel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.036, 0.03, 1.65, 8),
                metal(0x333333)
            );
            sBarrel.rotation.x = Math.PI / 2;
            sBarrel.position.z = 1.05;
            sBarrel.name = 'barrel';
            group.add(sBarrel);
            const sBody = new THREE.Mesh(
                new THREE.BoxGeometry(0.105, 0.12, 0.75),
                metal(0x222222)
            );
            sBody.position.z = 0.09;
            sBody.name = 'body';
            group.add(sBody);
            // Scope
            const scope = new THREE.Mesh(
                new THREE.CylinderGeometry(0.045, 0.045, 0.36, 8),
                metal(0x111111)
            );
            scope.rotation.x = Math.PI / 2;
            scope.position.set(0, 0.105, 0.18);
            scope.name = 'scope';
            group.add(scope);
            // Scope lens
            const lens = new THREE.Mesh(
                new THREE.CylinderGeometry(0.042, 0.042, 0.006, 8),
                new THREE.MeshStandardMaterial({ color: 0x4488ff, metalness: 0.9, roughness: 0.1 })
            );
            lens.rotation.x = Math.PI / 2;
            lens.position.set(0, 0.105, 0.36);
            lens.name = 'lens';
            group.add(lens);
            // Scope mounts
            for (let i = 0; i < 2; i++) {
                const mount = new THREE.Mesh(
                    new THREE.BoxGeometry(0.024, 0.06, 0.024),
                    metal(0x444444)
                );
                mount.position.set(0, 0.075, 0.06 + i * 0.24);
                mount.name = `scope_mount_${i}`;
                group.add(mount);
            }
            const bolt = new THREE.Mesh(
                new THREE.CylinderGeometry(0.015, 0.015, 0.075, 6),
                metal(0x444444)
            );
            bolt.rotation.z = Math.PI / 2;
            bolt.position.set(0.075, 0.03, 0.0);
            bolt.name = 'bolt';
            group.add(bolt);
            // Bolt knob
            const boltKnob = new THREE.Mesh(
                new THREE.SphereGeometry(0.024, 4, 4),
                metal(0x555555)
            );
            boltKnob.position.set(0.11, 0.03, 0.0);
            boltKnob.name = 'bolt_knob';
            group.add(boltKnob);
            const sStock = new THREE.Mesh(
                new THREE.BoxGeometry(0.09, 0.135, 0.6),
                wood(0x5a3520)
            );
            sStock.position.set(0, -0.015, -0.54);
            sStock.rotation.x = -0.05;
            sStock.name = 'stock';
            group.add(sStock);
            const sGrip = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, 0.12, 0.06),
                matte(0x1a1a1a)
            );
            sGrip.position.set(0, -0.105, -0.09);
            sGrip.rotation.x = 0.25;
            sGrip.name = 'grip';
            group.add(sGrip);
            // Bipod legs
            for (const side of [-1, 1]) {
                const leg = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.009, 0.009, 0.24, 6),
                    metal(0x444444)
                );
                leg.rotation.x = Math.PI / 2;
                leg.position.set(side * 0.045, -0.06, 0.6);
                leg.name = `bipod_${side > 0 ? 'r' : 'l'}`;
                group.add(leg);
            }
            break;
        }

        case 'grenade': {
            const gBody = new THREE.Mesh(
                new THREE.SphereGeometry(0.105, 10, 10),
                matte(0x445533)
            );
            gBody.position.z = 0.06;
            gBody.name = 'body';
            group.add(gBody);
            // Pineapple texture ridges
            for (let row = 0; row < 3; row++) {
                const ridge = new THREE.Mesh(
                    new THREE.TorusGeometry(0.09, 0.006, 4, 12),
                    matte(0x3a4a28)
                );
                ridge.position.set(0, -0.06 + row * 0.06, 0.06);
                ridge.name = `ridge_${row}`;
                group.add(ridge);
            }
            const cap = new THREE.Mesh(
                new THREE.CylinderGeometry(0.036, 0.045, 0.075, 8),
                metal(0x666666)
            );
            cap.position.set(0, 0.105, 0.06);
            cap.name = 'cap';
            group.add(cap);
            // Spoon/lever
            const spoon = new THREE.Mesh(
                new THREE.BoxGeometry(0.018, 0.006, 0.12),
                metal(0x888888)
            );
            spoon.position.set(0.03, 0.09, 0.06);
            spoon.name = 'spoon';
            group.add(spoon);
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.03, 0.006, 4, 8),
                metal(0x888888)
            );
            ring.position.set(0, 0.15, 0.06);
            ring.rotation.x = Math.PI / 2;
            ring.name = 'ring';
            group.add(ring);
            break;
        }

        case 'atomizer': {
            const aBody = new THREE.Mesh(
                new THREE.CylinderGeometry(0.075, 0.09, 0.6, 10),
                metal(0x4a3a6a)
            );
            aBody.rotation.x = Math.PI / 2;
            aBody.position.z = 0.24;
            aBody.name = 'body';
            group.add(aBody);
            const emitter = new THREE.Mesh(
                new THREE.SphereGeometry(0.09, 10, 10),
                new THREE.MeshStandardMaterial({
                    color: 0x6644cc,
                    emissive: 0x4422aa,
                    emissiveIntensity: 0.6,
                    roughness: 0.2,
                    metalness: 0.8
                })
            );
            emitter.position.z = 0.6;
            emitter.name = 'emitter';
            group.add(emitter);
            // Energy coils
            for (let i = 0; i < 4; i++) {
                const coil = new THREE.Mesh(
                    new THREE.TorusGeometry(0.084, 0.009, 6, 12),
                    new THREE.MeshStandardMaterial({
                        color: 0x8866ff,
                        emissive: 0x6644cc,
                        emissiveIntensity: 0.4
                    })
                );
                coil.position.z = 0.06 + i * 0.15;
                coil.name = `coil_${i}`;
                group.add(coil);
            }
            const aGrip = new THREE.Mesh(
                new THREE.BoxGeometry(0.066, 0.15, 0.075),
                matte(0x2a2a3a)
            );
            aGrip.position.set(0, -0.12, 0.06);
            aGrip.rotation.x = 0.2;
            aGrip.name = 'grip';
            group.add(aGrip);
            // Rear cap
            const rearCap = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.075, 0.06, 8),
                metal(0x3a2a5a)
            );
            rearCap.rotation.x = Math.PI / 2;
            rearCap.position.z = -0.06;
            rearCap.name = 'rear_cap';
            group.add(rearCap);
            break;
        }
    }

    group.traverse(child => { if (child.isMesh) child.castShadow = true; });
    scene.add(group);
    return { scene, animations: [] };
}

// ============================================================
// HELICOPTER MODEL
// ============================================================
function buildHelicopter() {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.name = 'helicopter';

    const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4, metalness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x88aacc, roughness: 0.1, metalness: 0.3,
        transparent: true, opacity: 0.6
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

    // Fuselage — egg shape via lathe
    const fuselageProfile = [
        [0, -1.2], [0.5, -1.0], [0.8, -0.6], [0.9, 0], [0.85, 0.4],
        [0.7, 0.8], [0.4, 1.0], [0, 1.1]
    ].map(p => new THREE.Vector2(p[0], p[1]));
    const fuselageGeo = new THREE.LatheGeometry(fuselageProfile, 10);
    fuselageGeo.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeo, mat);
    fuselage.position.y = 1.0;
    fuselage.castShadow = true;
    group.add(fuselage);

    // Cockpit bubble — front glass
    const cockpitGeo = new THREE.SphereGeometry(0.65, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    cockpitGeo.rotateX(-Math.PI / 4);
    const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
    cockpit.position.set(0, 1.15, 0.7);
    group.add(cockpit);

    // Tail boom — tapered cone
    const tailGeo = new THREE.CylinderGeometry(0.15, 0.35, 2.5, 8);
    tailGeo.rotateX(Math.PI / 2);
    const tail = new THREE.Mesh(tailGeo, mat);
    tail.position.set(0, 1.1, -2.2);
    group.add(tail);

    // Tail fin — vertical
    const finGeo = new THREE.BoxGeometry(0.05, 0.6, 0.4);
    const fin = new THREE.Mesh(finGeo, mat);
    fin.position.set(0, 1.5, -3.2);
    group.add(fin);

    // Horizontal stabilizer
    const hStabGeo = new THREE.BoxGeometry(1.0, 0.05, 0.3);
    const hStab = new THREE.Mesh(hStabGeo, mat);
    hStab.position.set(0, 1.2, -3.1);
    group.add(hStab);

    // Main rotor — proper blade shapes
    const rotorHub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8),
        darkMat
    );
    rotorHub.position.set(0, 2.0, 0);
    rotorHub.name = 'rotor_hub';
    group.add(rotorHub);

    for (let i = 0; i < 4; i++) {
        const bladeGeo = new THREE.BoxGeometry(3.5, 0.02, 0.15);
        bladeGeo.translate(1.75, 0, 0);
        const blade = new THREE.Mesh(bladeGeo, darkMat);
        blade.position.set(0, 2.05, 0);
        blade.rotation.y = (Math.PI / 2) * i;
        blade.name = `rotor_blade_${i}`;
        group.add(blade);
    }

    // Tail rotor
    const tailRotorHub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6), darkMat
    );
    tailRotorHub.position.set(0.2, 1.5, -3.35);
    tailRotorHub.rotation.z = Math.PI / 2;
    group.add(tailRotorHub);

    for (let i = 0; i < 2; i++) {
        const tBladeGeo = new THREE.BoxGeometry(0.5, 0.02, 0.08);
        tBladeGeo.translate(0.25, 0, 0);
        const tBlade = new THREE.Mesh(tBladeGeo, darkMat);
        tBlade.position.set(0.2, 1.5, -3.35);
        tBlade.rotation.x = Math.PI / 2 * i;
        tBlade.rotation.z = Math.PI / 2;
        group.add(tBlade);
    }

    // Skids — tube frame
    for (const side of [-1, 1]) {
        // Skid rail
        const skidGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.5, 6);
        skidGeo.rotateX(Math.PI / 2);
        const skid = new THREE.Mesh(skidGeo, darkMat);
        skid.position.set(side * 0.7, 0, 0);
        group.add(skid);

        // Struts connecting to fuselage
        for (const zOff of [-0.5, 0.5]) {
            const strutGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4);
            const strut = new THREE.Mesh(strutGeo, darkMat);
            strut.position.set(side * 0.5, 0.5, zOff);
            strut.rotation.z = side * 0.3;
            group.add(strut);
        }
    }

    scene.add(group);
    return { scene, animations: [] };
}


// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log('San Claudio Model Generator — Visual Revamp');
    console.log('============================================\n');

    // Male character
    console.log('Building male character model...');
    const charData = buildCharacter('male');
    await exportToGLB(charData.scene, charData.animations, 'character.glb');

    // Female character
    console.log('Building female character model...');
    const femData = buildCharacter('female');
    await exportToGLB(femData.scene, femData.animations, 'character_female.glb');

    // Vehicles
    const vehicleTypes = ['sedan', 'sports', 'truck', 'motorcycle', 'boat', 'police'];
    for (const type of vehicleTypes) {
        console.log(`Building ${type} model...`);
        const vData = buildVehicle(type);
        await exportToGLB(vData.scene, vData.animations, `${type}.glb`);
    }

    // Helicopter (separate builder)
    console.log('Building helicopter model...');
    const heliData = buildHelicopter();
    await exportToGLB(heliData.scene, heliData.animations, 'helicopter.glb');

    // Weapons
    const weaponTypes = ['bat', 'knife', 'pistol', 'smg', 'shotgun', 'rifle', 'sniper', 'grenade', 'atomizer'];
    for (const type of weaponTypes) {
        console.log(`Building ${type} weapon model...`);
        const wData = buildWeapon(type);
        await exportToGLB(wData.scene, [], `weapon_${type}.glb`);
    }

    console.log('\nDone! All models exported to assets/models/');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
