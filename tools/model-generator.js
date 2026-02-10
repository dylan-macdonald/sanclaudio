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
        [-0.38, 0, 0],      // L_Shoulder (relative to Chest)
        [0, -0.3, 0],       // L_Elbow (relative to L_Shoulder)
        [0, -0.3, 0],       // L_Hand (relative to L_Elbow)
        [0.38, 0, 0],       // R_Shoulder (relative to Chest)
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
    [-0.38, 1.35, 0],   // L_Shoulder
    [-0.38, 1.05, 0],   // L_Elbow
    [-0.38, 0.75, 0],   // L_Hand
    [0.38, 1.35, 0],    // R_Shoulder
    [0.38, 1.05, 0],    // R_Elbow
    [0.38, 0.75, 0],    // R_Hand
    [-0.12, 0.95, 0],   // L_Hip
    [-0.12, 0.55, 0],   // L_Knee
    [-0.12, 0.15, 0],   // L_Foot
    [0.12, 0.95, 0],    // R_Hip
    [0.12, 0.55, 0],    // R_Knee
    [0.12, 0.15, 0],    // R_Foot
];

// Vertex color constants
const SKIN = 0xd4a574;
const SHIRT = 0x3366cc;
const PANTS = 0x3d3024;
const SHOE = 0x1a1a1a;
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

        // Vertex colors — preserve if already baked (hand-crafted meshes)
        if (!geo.getAttribute('color')) {
            const colors = new Float32Array(vertCount * 3);
            const c = new THREE.Color(part.color);
            for (let v = 0; v < vertCount; v++) {
                colors[v * 3] = c.r;
                colors[v * 3 + 1] = c.g;
                colors[v * 3 + 2] = c.b;
            }
            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }

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

// ============================================================
// HAND-CRAFTED HEAD — BufferGeometry with intentional vertices
// ============================================================
// Every vertex placed to form human facial anatomy.
// No primitives (Box/Cylinder/Sphere/Lathe). Pure topology.
//
// Structure: 10 vertices per ring, 9 rings neck-to-crown, 1 cap.
// Ring vertex order (viewed from above, Z = face direction):
//   0: front-center (nose/chin)
//   1: front-right inner (inner eye R / nose wing R)
//   2: front-right outer (outer eye R / cheekbone R)
//   3: right side (temple R / ear R)
//   4: right-back
//   5: back center
//   6: left-back
//   7: left side (temple L / ear L)
//   8: front-left outer (outer eye L / cheekbone L)
//   9: front-left inner (inner eye L / nose wing L)

function buildHandCraftedHead(isFemale, morphType) {
    morphType = morphType || 'base';
    const headY = 1.70; // World Y center of head

    // Gender shape modifiers — females: narrower jaw, softer brow, smaller nose
    const jw = isFemale ? 0.85 : 1.0;  // jaw width
    const cw = isFemale ? 0.80 : 1.0;  // chin width
    const bf = isFemale ? 0.90 : 1.0;  // brow forward
    const ns = isFemale ? 0.85 : 1.0;  // nose scale

    const VPR = 10; // vertices per ring

    // GTA 3 style: ANGULAR planes, deep eye sockets, strong jaw, big nose.
    // Key depth values (Z axis, face-forward = positive Z):
    //   Brow:       0.20  — furthest forward besides nose
    //   Eye socket: 0.06  — deeply recessed (14cm behind brow!)
    //   Nose tip:   0.28  — most forward point
    //   Cheekbone:  0.12  — between eye and brow depth
    //   Jaw:        0.10  — flat angular planes
    //   Back head:  -0.16 — back of skull
    const ringDefs = [
        // Ring 0: Neck base — small cylinder
        { y: -0.22, morph: 'neck', v: [
            [0.00, 0.06],  [0.03, 0.05],  [0.05, 0.02],  [0.06, -0.01],
            [0.04, -0.05], [0.00, -0.06], [-0.04, -0.05], [-0.06, -0.01],
            [-0.05, 0.02], [-0.03, 0.05]
        ]},
        // Ring 1: Upper neck — starts widening
        { y: -0.17, morph: 'neck', v: [
            [0.00, 0.08],  [0.04, 0.07],  [0.08, 0.03],  [0.09, -0.01],
            [0.06, -0.06], [0.00, -0.08], [-0.06, -0.06], [-0.09, -0.01],
            [-0.08, 0.03], [-0.04, 0.07]
        ]},
        // Ring 2: Chin point — ANGULAR, projects forward
        { y: -0.12, morph: 'jaw', v: [
            [0.00, 0.16*cw],  [0.06*cw, 0.12*cw], [0.11, 0.04],  [0.13*jw, -0.02],
            [0.09, -0.08],    [0.00, -0.12],       [-0.09, -0.08], [-0.13*jw, -0.02],
            [-0.11, 0.04],    [-0.06*cw, 0.12*cw]
        ]},
        // Ring 3: Mouth / Jaw line — WIDE and ANGULAR, flat side planes
        { y: -0.04, morph: 'jaw', v: [
            [0.00, 0.16],  [0.07, 0.14],  [0.15*jw, 0.08], [0.18*jw, -0.01],
            [0.14, -0.09], [0.00, -0.14], [-0.14, -0.09],  [-0.18*jw, -0.01],
            [-0.15*jw, 0.08], [-0.07, 0.14]
        ]},
        // Ring 4: Nose / Upper cheek — NOSE PROJECTS WAY OUT
        { y: 0.02, morph: 'face', v: [
            [0.00, 0.28*ns],  [0.05, 0.16*ns],  [0.16, 0.12], [0.19, 0.01],
            [0.15, -0.09],    [0.00, -0.16],     [-0.15, -0.09], [-0.19, 0.01],
            [-0.16, 0.12],    [-0.05, 0.16*ns]
        ]},
        // Ring 5: Eye level — DEEPLY RECESSED sockets
        // Eyes (verts 1,2,8,9) at z=0.06 while brow above at z=0.20
        // That's 14cm of overhang — massive shadow-catching depth
        { y: 0.07, morph: 'face', v: [
            [0.00, 0.18],  [0.075, 0.06], [0.14, 0.06],  [0.20, 0.01],
            [0.17, -0.09], [0.00, -0.16], [-0.17, -0.09], [-0.20, 0.01],
            [-0.14, 0.06], [-0.075, 0.06]
        ]},
        // Ring 6: Brow ridge — PROJECTS FORWARD, overhanging eyes dramatically
        { y: 0.12, morph: 'face', v: [
            [0.00, 0.21*bf],  [0.07, 0.20*bf],  [0.14, 0.18*bf], [0.19, 0.03],
            [0.16, -0.09],    [0.00, -0.15],     [-0.16, -0.09],  [-0.19, 0.03],
            [-0.14, 0.18*bf], [-0.07, 0.20*bf]
        ]},
        // Ring 7: Forehead — wide, flat, angular
        { y: 0.18, morph: 'skull', v: [
            [0.00, 0.15],  [0.07, 0.14],  [0.13, 0.10], [0.16, 0.01],
            [0.14, -0.08], [0.00, -0.14], [-0.14, -0.08], [-0.16, 0.01],
            [-0.13, 0.10], [-0.07, 0.14]
        ]},
        // Ring 8: Crown — narrows to top, slightly back
        { y: 0.24, morph: 'skull', v: [
            [0.00, 0.09],  [0.04, 0.08],  [0.08, 0.05], [0.10, 0.00],
            [0.08, -0.06], [0.00, -0.10], [-0.08, -0.06], [-0.10, 0.00],
            [-0.08, 0.05], [-0.04, 0.08]
        ]}
    ];

    // Apply morph deformation
    const morphScales = {
        base:   { neck: 1.0,  jaw: 1.0,  face: 1.0,  skull: 1.0  },
        fat:    { neck: 1.15, jaw: 1.10, face: 1.06, skull: 1.04 },
        muscle: { neck: 1.12, jaw: 1.05, face: 1.02, skull: 1.01 }
    };
    const ms = morphScales[morphType];

    // Build vertex positions and colors
    const NR = ringDefs.length;
    const totalVerts = NR * VPR + 1; // +1 cap
    const positions = new Float32Array(totalVerts * 3);
    const colors = new Float32Array(totalVerts * 3);

    const skinC = new THREE.Color(SKIN);
    const eyeC = new THREE.Color(0x0a0a0a);
    const mouthC = new THREE.Color(isFemale ? 0xcc5555 : 0x884433);

    let vi = 0;
    for (let r = 0; r < NR; r++) {
        const ring = ringDefs[r];
        const mScale = ms[ring.morph] || 1.0;
        for (let v = 0; v < VPR; v++) {
            const [rx, rz] = ring.v[v];
            positions[vi * 3]     = rx * mScale; // X scaled by morph
            positions[vi * 3 + 1] = headY + ring.y;
            positions[vi * 3 + 2] = rz;

            // Per-vertex color
            let c = skinC;
            // Eye sockets: ring 5, verts 1,2 (right) and 8,9 (left)
            // Also darken ring 4 verts 1,9 (under-eye) for deeper socket shadow
            if (r === 5 && (v === 1 || v === 2 || v === 8 || v === 9)) c = eyeC;
            if (r === 4 && (v === 1 || v === 9)) c = new THREE.Color(0x1a1208);
            // Mouth: ring 3, verts 0,1,9 for width (center + corners)
            if (r === 3 && (v === 0 || v === 1 || v === 9)) c = mouthC;

            colors[vi * 3]     = c.r;
            colors[vi * 3 + 1] = c.g;
            colors[vi * 3 + 2] = c.b;
            vi++;
        }
    }

    // Cap vertex (top of head)
    positions[vi * 3]     = 0;
    positions[vi * 3 + 1] = headY + 0.28;
    positions[vi * 3 + 2] = 0;
    colors[vi * 3]     = skinC.r;
    colors[vi * 3 + 1] = skinC.g;
    colors[vi * 3 + 2] = skinC.b;
    const capIdx = vi;

    // Build triangle indices: ring-to-ring strips + cap fan
    const indices = [];
    for (let r = 0; r < NR - 1; r++) {
        for (let v = 0; v < VPR; v++) {
            const a = r * VPR + v;
            const b = r * VPR + (v + 1) % VPR;
            const c = (r + 1) * VPR + v;
            const d = (r + 1) * VPR + (v + 1) % VPR;
            indices.push(a, c, b);
            indices.push(b, c, d);
        }
    }
    // Cap fan
    const lastR = (NR - 1) * VPR;
    for (let v = 0; v < VPR; v++) {
        indices.push(lastR + v, capIdx, lastR + (v + 1) % VPR);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // Dummy UVs — real UVs assigned after merge in assembleCharacterMesh
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(totalVerts * 2), 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

// Hand-crafted ear — flat shape protruding from head side
function buildEarGeo(side, headY) {
    headY = headY || 1.70;
    const x = side * 0.21;  // At temple width (wider head)
    const cx = side * 0.05; // How far ear sticks out (bigger ears)
    const y = headY + 0.06; // Eye level (slightly higher for new head)
    const z = -0.01;

    // 6 vertices forming a tapered ear shape
    const positions = new Float32Array([
        x,      y + 0.05, z + 0.02,   // 0: top inner
        x + cx, y + 0.04, z + 0.02,   // 1: top outer
        x + cx, y + 0.01, z + 0.03,   // 2: mid outer (widest)
        x + cx, y - 0.04, z + 0.01,   // 3: lower outer
        x,      y - 0.06, z + 0.01,   // 4: bottom inner (lobe)
        x,      y,        z + 0.02,   // 5: center inner
    ]);

    // 4 triangles
    const idx = side > 0
        ? [0,5,1, 1,5,2, 5,4,2, 2,4,3]
        : [0,1,5, 1,2,5, 5,2,4, 2,3,4];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6 * 2), 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
}

// Hand-crafted eye highlight — tiny quad inside eye socket
function buildEyeHighlightGeo(side, headY) {
    headY = headY || 1.70;
    const x = side * 0.10;  // Between inner and outer eye verts
    const y = headY + 0.075; // At eye ring level (ring 5 y=0.07)
    const z = 0.09;          // Slightly forward of deep socket (0.06), still recessed
    const s = 0.018;         // Half-size of highlight (bigger for readability)

    const positions = new Float32Array([
        x - s, y + s, z,  // 0: top-left
        x + s, y + s, z,  // 1: top-right
        x + s, y - s, z,  // 2: bottom-right
        x - s, y - s, z,  // 3: bottom-left
    ]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(4 * 2), 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    return geo;
}

// =====================================================================
// GENERIC RING MESH BUILDER
// Builds a BufferGeometry from ring definitions — used for ALL body parts.
// Each ring: { y, v: [[x,z], [x,z], ...] }
// Options: { capTop: bool, capBottom: bool, morphScale: float }
// =====================================================================
function buildRingGeo(ringDefs, opts = {}) {
    const VPR = ringDefs[0].v.length;
    const NR = ringDefs.length;
    const ms = opts.morphScale || 1.0;
    let capCount = 0;
    if (opts.capTop) capCount++;
    if (opts.capBottom) capCount++;
    const totalVerts = NR * VPR + capCount;

    const positions = new Float32Array(totalVerts * 3);
    let vi = 0;
    for (let r = 0; r < NR; r++) {
        const ring = ringDefs[r];
        for (let v = 0; v < VPR; v++) {
            const [rx, rz] = ring.v[v];
            positions[vi * 3]     = rx * ms;
            positions[vi * 3 + 1] = ring.y;
            positions[vi * 3 + 2] = rz * ms;
            vi++;
        }
    }

    const indices = [];
    // Ring-to-ring strips
    for (let r = 0; r < NR - 1; r++) {
        for (let v = 0; v < VPR; v++) {
            const a = r * VPR + v;
            const b = r * VPR + (v + 1) % VPR;
            const c = (r + 1) * VPR + v;
            const d = (r + 1) * VPR + (v + 1) % VPR;
            indices.push(a, c, b);
            indices.push(b, c, d);
        }
    }

    // Bottom cap fan
    if (opts.capBottom) {
        const capBIdx = vi;
        const r0 = ringDefs[0];
        let cx = 0, cz = 0;
        for (const [rx, rz] of r0.v) { cx += rx; cz += rz; }
        cx /= VPR; cz /= VPR;
        positions[vi * 3] = cx * ms; positions[vi * 3 + 1] = r0.y; positions[vi * 3 + 2] = cz * ms;
        vi++;
        for (let v = 0; v < VPR; v++) {
            indices.push(v, capBIdx, (v + 1) % VPR);
        }
    }

    // Top cap fan
    if (opts.capTop) {
        const capTIdx = vi;
        const rN = ringDefs[NR - 1];
        let cx = 0, cz = 0;
        for (const [rx, rz] of rN.v) { cx += rx; cz += rz; }
        cx /= VPR; cz /= VPR;
        positions[vi * 3] = cx * ms; positions[vi * 3 + 1] = rN.y; positions[vi * 3 + 2] = cz * ms;
        vi++;
        const lastR = (NR - 1) * VPR;
        for (let v = 0; v < VPR; v++) {
            indices.push(lastR + v, capTIdx, lastR + (v + 1) % VPR);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(totalVerts * 2), 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
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

    // Add a ring-mesh body part with base/fat/muscle morph variants
    function addRingPart(ringDefs, boneIdx, color, opts, fatMS, muscleMS) {
        const base = buildRingGeo(ringDefs, opts);
        const fat = buildRingGeo(ringDefs, { ...opts, morphScale: fatMS || 1.0 });
        const muscle = buildRingGeo(ringDefs, { ...opts, morphScale: muscleMS || 1.0 });
        addPart(base, boneIdx, color, fat, muscle);
    }

    // Gender proportions
    const sw = isFemale ? 0.85 : 1.0;   // shoulder width
    const hw = isFemale ? 1.12 : 1.0;   // hip width (females wider)
    const cd = isFemale ? 0.92 : 1.0;   // chest depth
    const armX = isFemale ? 0.32 : 0.39;

    // ===== HEAD =====
    // Hand-crafted BufferGeometry — every vertex intentionally placed.
    {
        const headGeo = buildHandCraftedHead(isFemale, 'base');
        const fHeadGeo = buildHandCraftedHead(isFemale, 'fat');
        const mHeadGeo = buildHandCraftedHead(isFemale, 'muscle');
        addPart(headGeo, 3, SKIN, fHeadGeo, mHeadGeo);
        for (const side of [-1, 1]) {
            addPart(buildEyeHighlightGeo(side), 3, 0xffffff);
            addPart(buildEarGeo(side), 3, SKIN);
        }
    }

    // ===== HAIR =====
    // Hand-crafted ring meshes — angular volumes, not primitive shapes
    {
        if (isFemale) {
            // Main cap
            addRingPart([
                { y: 1.88, v: [[0,0.13],[0.09,0.09],[0.14,0],[0.09,-0.09],[0,-0.13],[-0.09,-0.09],[-0.14,0],[-0.09,0.09]] },
                { y: 1.94, v: [[0,0.14],[0.10,0.10],[0.16,0],[0.10,-0.10],[0,-0.14],[-0.10,-0.10],[-0.16,0],[-0.10,0.10]] },
                { y: 1.98, v: [[0,0.11],[0.08,0.08],[0.12,0],[0.08,-0.08],[0,-0.12],[-0.08,-0.08],[-0.12,0],[-0.08,0.08]] },
            ], 3, HAIR, { capTop: true });
            // Side drape left+right
            for (const s of [-1, 1]) {
                addRingPart([
                    { y: 1.90, v: [[s*0.14,0.04],[s*0.18,0.02],[s*0.20,0],[s*0.18,-0.04],[s*0.14,-0.06],[s*0.10,-0.04],[s*0.10,0],[s*0.10,0.02]] },
                    { y: 1.76, v: [[s*0.13,0.05],[s*0.18,0.03],[s*0.22,0],[s*0.18,-0.05],[s*0.13,-0.08],[s*0.08,-0.05],[s*0.08,0],[s*0.08,0.03]] },
                    { y: 1.60, v: [[s*0.10,0.04],[s*0.14,0.02],[s*0.17,0],[s*0.14,-0.04],[s*0.10,-0.06],[s*0.07,-0.04],[s*0.07,0],[s*0.07,0.02]] },
                ], 3, HAIR, { capBottom: true });
            }
            // Back drape
            addRingPart([
                { y: 1.90, v: [[0,-0.10],[0.12,-0.12],[0.16,-0.14],[0.12,-0.16],[0,-0.17],[-0.12,-0.16],[-0.16,-0.14],[-0.12,-0.12]] },
                { y: 1.72, v: [[0,-0.10],[0.14,-0.12],[0.18,-0.16],[0.14,-0.20],[0,-0.22],[-0.14,-0.20],[-0.18,-0.16],[-0.14,-0.12]] },
                { y: 1.56, v: [[0,-0.08],[0.10,-0.10],[0.14,-0.13],[0.10,-0.16],[0,-0.18],[-0.10,-0.16],[-0.14,-0.13],[-0.10,-0.10]] },
            ], 3, HAIR, { capBottom: true });
        } else {
            // Male: short angular hair cap with slight texture
            addRingPart([
                { y: 1.88, v: [[0,0.12],[0.09,0.09],[0.15,0],[0.09,-0.10],[0,-0.14],[-0.09,-0.10],[-0.15,0],[-0.09,0.09]] },
                { y: 1.95, v: [[0,0.14],[0.10,0.10],[0.17,0],[0.10,-0.11],[0,-0.15],[-0.10,-0.11],[-0.17,0],[-0.10,0.10]] },
                { y: 1.99, v: [[0,0.10],[0.07,0.07],[0.12,0],[0.07,-0.08],[0,-0.11],[-0.07,-0.08],[-0.12,0],[-0.07,0.07]] },
            ], 3, HAIR, { capTop: true });
            // Back volume
            addRingPart([
                { y: 1.92, v: [[0,-0.10],[0.12,-0.11],[0.16,-0.14],[0.12,-0.16],[0,-0.18],[-0.12,-0.16],[-0.16,-0.14],[-0.12,-0.11]] },
                { y: 1.82, v: [[0,-0.08],[0.10,-0.10],[0.14,-0.13],[0.10,-0.14],[0,-0.16],[-0.10,-0.14],[-0.14,-0.13],[-0.10,-0.10]] },
            ], 3, HAIR, {});
        }
    }

    // ===== NECK =====
    // 6-vert rings, slight taper — NOT a cylinder
    addRingPart([
        { y: 1.50, v: [[0,0.07],[0.06,0.04],[0.07,0],[0.06,-0.05],[0,-0.07],[-0.06,-0.05],[-0.07,0],[-0.06,0.04]] },
        { y: 1.56, v: [[0,0.06],[0.05,0.03],[0.06,0],[0.05,-0.04],[0,-0.06],[-0.05,-0.04],[-0.06,0],[-0.05,0.03]] },
        { y: 1.62, v: [[0,0.06],[0.05,0.03],[0.06,0],[0.05,-0.04],[0,-0.06],[-0.05,-0.04],[-0.06,0],[-0.05,0.03]] },
    ], 2, SKIN, {}, 1.15, 1.10);

    // ===== TORSO (Chest) — bone 2 =====
    // Wide angular shoulders, V-taper to waist, chest projects forward
    // 8 verts/ring: FC(0), FR(1), R(2), BR(3), BC(4), BL(5), L(6), FL(7)
    {
        const chestRings = [
            // Bottom: waist — narrow
            { y: 1.19, v: [
                [0, 0.13*cd],  [0.12*sw, 0.11*cd],  [0.18*sw, 0],  [0.14*sw, -0.10],
                [0, -0.12],    [-0.14*sw, -0.10],    [-0.18*sw, 0], [-0.12*sw, 0.11*cd]
            ]},
            // Lower chest
            { y: 1.28, v: [
                [0, 0.16*cd],  [0.16*sw, 0.13*cd],  [0.24*sw, 0],  [0.18*sw, -0.12],
                [0, -0.14],    [-0.18*sw, -0.12],    [-0.24*sw, 0], [-0.16*sw, 0.13*cd]
            ]},
            // Mid chest — widest, chest forward
            { y: 1.35, v: [
                [0, 0.18*cd],  [0.20*sw, 0.15*cd],  [0.28*sw, 0.02],  [0.20*sw, -0.12],
                [0, -0.15],    [-0.20*sw, -0.12],    [-0.28*sw, 0.02], [-0.20*sw, 0.15*cd]
            ]},
            // Upper chest
            { y: 1.42, v: [
                [0, 0.15*cd],  [0.22*sw, 0.12*cd],  [0.32*sw, 0.01],  [0.22*sw, -0.10],
                [0, -0.13],    [-0.22*sw, -0.10],    [-0.32*sw, 0.01], [-0.22*sw, 0.12*cd]
            ]},
            // Shoulder line — widest point
            { y: 1.48, v: [
                [0, 0.12*cd],  [0.20*sw, 0.10*cd],  [0.34*sw, 0.00],  [0.22*sw, -0.08],
                [0, -0.11],    [-0.22*sw, -0.08],    [-0.34*sw, 0.00], [-0.20*sw, 0.10*cd]
            ]},
        ];
        addRingPart(chestRings, 2, SHIRT, { capTop: true }, 1.22, 1.15);
    }

    // Female chest detail — small rounded bumps
    if (isFemale) {
        for (const side of [-1, 1]) {
            addRingPart([
                { y: 1.30, v: [[side*0.06,0.12],[side*0.09,0.10],[side*0.10,0.08],[side*0.09,0.06],[side*0.06,0.05],[side*0.03,0.06],[side*0.02,0.08],[side*0.03,0.10]] },
                { y: 1.33, v: [[side*0.06,0.15],[side*0.10,0.13],[side*0.11,0.10],[side*0.10,0.07],[side*0.06,0.06],[side*0.02,0.07],[side*0.01,0.10],[side*0.02,0.13]] },
                { y: 1.36, v: [[side*0.06,0.12],[side*0.09,0.10],[side*0.10,0.08],[side*0.09,0.06],[side*0.06,0.05],[side*0.03,0.06],[side*0.02,0.08],[side*0.03,0.10]] },
            ], 2, SHIRT, {});
        }
    }

    // ===== ABDOMEN — bone 1 =====
    // Connects waist to hips, slight taper
    addRingPart([
        { y: 1.02, v: [
            [0, 0.12*hw],  [0.10*hw, 0.10*hw],  [0.17*hw, 0],  [0.12*hw, -0.09],
            [0, -0.11],    [-0.12*hw, -0.09],    [-0.17*hw, 0], [-0.10*hw, 0.10*hw]
        ]},
        { y: 1.10, v: [
            [0, 0.13],  [0.11, 0.11],  [0.18, 0],  [0.13, -0.10],
            [0, -0.12], [-0.13, -0.10], [-0.18, 0], [-0.11, 0.11]
        ]},
        { y: 1.19, v: [
            [0, 0.13*cd],  [0.12*sw, 0.11*cd],  [0.18*sw, 0],  [0.14*sw, -0.10],
            [0, -0.12],    [-0.14*sw, -0.10],    [-0.18*sw, 0], [-0.12*sw, 0.11*cd]
        ]},
    ], 1, SHIRT, {}, 1.30, 1.0);

    // ===== HIPS — bone 0 =====
    // Wide angular box shape
    addRingPart([
        { y: 0.88, v: [
            [0, 0.10*hw],  [0.13*hw, 0.08*hw],  [0.20*hw, 0],  [0.14*hw, -0.08],
            [0, -0.10],    [-0.14*hw, -0.08],    [-0.20*hw, 0], [-0.13*hw, 0.08*hw]
        ]},
        { y: 0.95, v: [
            [0, 0.12*hw],  [0.14*hw, 0.10*hw],  [0.22*hw, 0],  [0.15*hw, -0.09],
            [0, -0.11],    [-0.15*hw, -0.09],    [-0.22*hw, 0], [-0.14*hw, 0.10*hw]
        ]},
        { y: 1.02, v: [
            [0, 0.12*hw],  [0.10*hw, 0.10*hw],  [0.17*hw, 0],  [0.12*hw, -0.09],
            [0, -0.11],    [-0.12*hw, -0.09],    [-0.17*hw, 0], [-0.10*hw, 0.10*hw]
        ]},
    ], 0, PANTS, { capBottom: true }, 1.20, 1.0);

    // ===== ARMS =====
    for (const side of [-1, 1]) {
        const sIdx = side < 0 ? 4 : 7; // shoulder bone
        const eIdx = side < 0 ? 5 : 8; // elbow bone
        const hIdx = side < 0 ? 6 : 9; // hand bone
        const x = side * armX;
        const s = side;

        // Shoulder cap — angular rounded shape
        addRingPart([
            { y: 1.42, v: [
                [x, 0.06],[x+s*0.04, 0.05],[x+s*0.07, 0],[x+s*0.04, -0.05],
                [x, -0.06],[x-s*0.04, -0.05],[x-s*0.07, 0],[x-s*0.04, 0.05]
            ]},
            { y: 1.47, v: [
                [x, 0.07],[x+s*0.05, 0.05],[x+s*0.08, 0],[x+s*0.05, -0.06],
                [x, -0.07],[x-s*0.04, -0.06],[x-s*0.06, 0],[x-s*0.04, 0.05]
            ]},
        ], sIdx, SHIRT, { capTop: true }, 1.0, 1.18);

        // Upper arm — tapered from shoulder to elbow, angular cross-section
        {
            const rt = isFemale ? 0.065 : 0.075; // top radius
            const rb = isFemale ? 0.050 : 0.060;  // bottom radius
            addRingPart([
                { y: 1.11, v: [
                    [x, rb*1.1],[x+s*rb*0.7, rb*0.7],[x+s*rb, 0],[x+s*rb*0.7, -rb*0.8],
                    [x, -rb],[x-s*rb*0.7, -rb*0.8],[x-s*rb, 0],[x-s*rb*0.7, rb*0.7]
                ]},
                { y: 1.20, v: [
                    [x, rb*1.2],[x+s*rb*0.8, rb*0.8],[x+s*rb*1.05, 0],[x+s*rb*0.8, -rb*0.9],
                    [x, -rb*1.1],[x-s*rb*0.8, -rb*0.9],[x-s*rb*1.05, 0],[x-s*rb*0.8, rb*0.8]
                ]},
                { y: 1.30, v: [
                    [x, rt*1.2],[x+s*rt*0.8, rt*0.8],[x+s*rt*1.1, 0],[x+s*rt*0.8, -rt*0.9],
                    [x, -rt*1.1],[x-s*rt*0.8, -rt*0.9],[x-s*rt*1.1, 0],[x-s*rt*0.8, rt*0.8]
                ]},
                { y: 1.39, v: [
                    [x, rt*1.1],[x+s*rt*0.7, rt*0.7],[x+s*rt, 0],[x+s*rt*0.7, -rt*0.8],
                    [x, -rt*0.9],[x-s*rt*0.7, -rt*0.8],[x-s*rt, 0],[x-s*rt*0.7, rt*0.7]
                ]},
            ], sIdx, SHIRT, {}, 1.18, 1.22);
        }

        // Forearm — skin color, elbow wider than wrist
        {
            const ft = isFemale ? 0.052 : 0.062; // top (elbow)
            const fb = isFemale ? 0.040 : 0.048;  // bottom (wrist)
            addRingPart([
                { y: 0.84, v: [
                    [x, fb*1.1],[x+s*fb*0.7, fb*0.7],[x+s*fb, 0],[x+s*fb*0.7, -fb*0.8],
                    [x, -fb],[x-s*fb*0.7, -fb*0.8],[x-s*fb, 0],[x-s*fb*0.7, fb*0.7]
                ]},
                { y: 0.92, v: [
                    [x, fb*1.15],[x+s*fb*0.75, fb*0.8],[x+s*fb*1.05, 0],[x+s*fb*0.75, -fb*0.85],
                    [x, -fb*1.05],[x-s*fb*0.75, -fb*0.85],[x-s*fb*1.05, 0],[x-s*fb*0.75, fb*0.8]
                ]},
                { y: 1.02, v: [
                    [x, ft*1.2],[x+s*ft*0.8, ft*0.8],[x+s*ft*1.1, 0],[x+s*ft*0.8, -ft*0.9],
                    [x, -ft*1.1],[x-s*ft*0.8, -ft*0.9],[x-s*ft*1.1, 0],[x-s*ft*0.8, ft*0.8]
                ]},
                { y: 1.11, v: [
                    [x, ft*1.15],[x+s*ft*0.75, ft*0.75],[x+s*ft*1.05, 0],[x+s*ft*0.75, -ft*0.85],
                    [x, -ft*1.05],[x-s*ft*0.75, -ft*0.85],[x-s*ft*1.05, 0],[x-s*ft*0.75, ft*0.75]
                ]},
            ], eIdx, SKIN, {}, 1.10, 1.15);
        }

        // Hand — angular mitten shape, not a box
        {
            const hx = x;
            const hw2 = 0.045; // half-width
            const hd = 0.035;  // half-depth
            addRingPart([
                { y: 0.73, v: [
                    [hx, hd*1.2],[hx+s*hw2*0.8, hd*0.8],[hx+s*hw2, 0],[hx+s*hw2*0.8, -hd*0.8],
                    [hx, -hd],[hx-s*hw2*0.8, -hd*0.8],[hx-s*hw2, 0],[hx-s*hw2*0.8, hd*0.8]
                ]},
                { y: 0.77, v: [
                    [hx, hd*1.3],[hx+s*hw2, hd*0.9],[hx+s*hw2*1.1, 0],[hx+s*hw2, -hd*0.9],
                    [hx, -hd*1.1],[hx-s*hw2, -hd*0.9],[hx-s*hw2*1.1, 0],[hx-s*hw2, hd*0.9]
                ]},
                { y: 0.82, v: [
                    [hx, hd*1.2],[hx+s*hw2*0.9, hd*0.8],[hx+s*hw2*1.05, 0],[hx+s*hw2*0.9, -hd*0.8],
                    [hx, -hd*1.0],[hx-s*hw2*0.9, -hd*0.8],[hx-s*hw2*1.05, 0],[hx-s*hw2*0.9, hd*0.8]
                ]},
            ], hIdx, SKIN, { capBottom: true, capTop: true });
        }
    }

    // ===== LEGS =====
    for (const side of [-1, 1]) {
        const hipIdx = side < 0 ? 10 : 13;
        const kneeIdx = side < 0 ? 11 : 14;
        const footIdx = side < 0 ? 12 : 15;
        const lx = side * 0.12;

        // Thigh — wider at hip, angular cross-section, tapers to knee
        {
            const tt = isFemale ? 0.090 : 0.085; // top radius
            const tb = isFemale ? 0.075 : 0.070;  // bottom radius
            addRingPart([
                { y: 0.41, v: [
                    [lx, tb*1.1],[lx+tb*0.8, tb*0.7],[lx+tb, 0],[lx+tb*0.8, -tb*0.8],
                    [lx, -tb*1.0],[lx-tb*0.8, -tb*0.8],[lx-tb, 0],[lx-tb*0.8, tb*0.7]
                ]},
                { y: 0.52, v: [
                    [lx, tb*1.15],[lx+tb*0.85, tb*0.8],[lx+tb*1.05, 0],[lx+tb*0.85, -tb*0.9],
                    [lx, -tb*1.1],[lx-tb*0.85, -tb*0.9],[lx-tb*1.05, 0],[lx-tb*0.85, tb*0.8]
                ]},
                { y: 0.63, v: [
                    [lx, tt*1.2],[lx+tt*0.85, tt*0.85],[lx+tt*1.1, 0],[lx+tt*0.85, -tt*0.9],
                    [lx, -tt*1.1],[lx-tt*0.85, -tt*0.9],[lx-tt*1.1, 0],[lx-tt*0.85, tt*0.85]
                ]},
                { y: 0.77, v: [
                    [lx, tt*1.15],[lx+tt*0.8, tt*0.8],[lx+tt*1.05, 0],[lx+tt*0.8, -tt*0.85],
                    [lx, -tt*1.05],[lx-tt*0.8, -tt*0.85],[lx-tt*1.05, 0],[lx-tt*0.8, tt*0.8]
                ]},
            ], hipIdx, PANTS, {}, 1.22, 1.10);
        }

        // Shin — calf wider near knee, tapers to ankle
        {
            const st = isFemale ? 0.068 : 0.072; // top (knee)
            const sb = isFemale ? 0.050 : 0.055;  // bottom (ankle)
            addRingPart([
                { y: 0.08, v: [
                    [lx, sb*1.1],[lx+sb*0.7, sb*0.7],[lx+sb, 0],[lx+sb*0.7, -sb*0.8],
                    [lx, -sb],[lx-sb*0.7, -sb*0.8],[lx-sb, 0],[lx-sb*0.7, sb*0.7]
                ]},
                { y: 0.18, v: [
                    [lx, sb*1.2],[lx+sb*0.8, sb*0.85],[lx+sb*1.05, 0],[lx+sb*0.8, -sb*0.9],
                    [lx, -sb*1.1],[lx-sb*0.8, -sb*0.9],[lx-sb*1.05, 0],[lx-sb*0.8, sb*0.85]
                ]},
                { y: 0.28, v: [
                    [lx, st*1.2],[lx+st*0.85, st*0.85],[lx+st*1.1, 0.01],[lx+st*0.85, -st*0.9],
                    [lx, -st*1.1],[lx-st*0.85, -st*0.9],[lx-st*1.1, 0.01],[lx-st*0.85, st*0.85]
                ]},
                { y: 0.41, v: [
                    [lx, st*1.15],[lx+st*0.8, st*0.8],[lx+st*1.0, 0],[lx+st*0.8, -st*0.85],
                    [lx, -st*1.05],[lx-st*0.8, -st*0.85],[lx-st*1.0, 0],[lx-st*0.8, st*0.8]
                ]},
            ], kneeIdx, PANTS, {}, 1.12, 1.05);
        }

        // Foot — angular shoe shape, not a box
        {
            const fw = 0.07;  // half-width
            addRingPart([
                // Heel
                { y: 0.01, v: [
                    [lx, -0.04],[lx+fw*0.8, -0.035],[lx+fw, 0],[lx+fw*0.8, 0.035],
                    [lx, 0.04],[lx-fw*0.8, 0.035],[lx-fw, 0],[lx-fw*0.8, -0.035]
                ]},
                // Mid foot — widest, highest
                { y: 0.06, v: [
                    [lx, -0.05],[lx+fw*0.9, -0.04],[lx+fw, 0],[lx+fw*0.9, 0.05],
                    [lx, 0.06],[lx-fw*0.9, 0.05],[lx-fw, 0],[lx-fw*0.9, -0.04]
                ]},
                // Ball of foot
                { y: 0.05, v: [
                    [lx, -0.02],[lx+fw*0.8, -0.01],[lx+fw*0.85, 0.02],[lx+fw*0.7, 0.10],
                    [lx, 0.12],[lx-fw*0.7, 0.10],[lx-fw*0.85, 0.02],[lx-fw*0.8, -0.01]
                ]},
                // Toe tip
                { y: 0.03, v: [
                    [lx, 0.05],[lx+fw*0.6, 0.06],[lx+fw*0.7, 0.10],[lx+fw*0.5, 0.16],
                    [lx, 0.18],[lx-fw*0.5, 0.16],[lx-fw*0.7, 0.10],[lx-fw*0.6, 0.06]
                ]},
            ], footIdx, SHOE, { capBottom: true, capTop: true });

            // Sole — thin dark strip
            addRingPart([
                { y: -0.01, v: [
                    [lx, -0.04],[lx+fw*0.9, -0.03],[lx+fw, 0],[lx+fw*0.8, 0.10],
                    [lx, 0.16],[lx-fw*0.8, 0.10],[lx-fw, 0],[lx-fw*0.9, -0.03]
                ]},
                { y: 0.01, v: [
                    [lx, -0.04],[lx+fw*0.9, -0.03],[lx+fw, 0],[lx+fw*0.8, 0.10],
                    [lx, 0.16],[lx-fw*0.8, 0.10],[lx-fw, 0],[lx-fw*0.9, -0.03]
                ]},
            ], footIdx, 0x111111, {});
        }
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
