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
// CHARACTER MODEL
// ============================================================
function buildCharacter() {
    const scene = new THREE.Scene();

    // --- Skeleton ---
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

    // Set up hierarchy
    for (let i = 0; i < parentIndices.length; i++) {
        if (parentIndices[i] >= 0) {
            bones[parentIndices[i]].add(bones[i]);
        }
    }

    const skeleton = new THREE.Skeleton(bones);

    // --- Build body geometry ---
    // Each body part positioned in world space, with skin weights assigned to nearest bone(s)

    const parts = [];

    // Helper: create a box part
    function addBox(w, h, d, posX, posY, posZ, boneIdx, color) {
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.translate(posX, posY, posZ);
        parts.push({ geo, boneIdx, color });
    }

    // Helper: create a cylinder part
    function addCylinder(rt, rb, h, posX, posY, posZ, boneIdx, color, segments = 6) {
        const geo = new THREE.CylinderGeometry(rt, rb, h, segments);
        geo.translate(posX, posY, posZ);
        parts.push({ geo, boneIdx, color });
    }

    // Colors
    const SKIN = 0xd4a574;
    const SHIRT = 0x4466aa;
    const PANTS = 0x333344;
    const SHOE = 0x222222;
    const HAIR = 0x221100;

    // Head - octagonal prism base with facial features
    // Build an 8-sided head using a custom BufferGeometry
    {
        const headGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.34, 8); // octagonal
        headGeo.translate(0, 1.7, 0);
        parts.push({ geo: headGeo, boneIdx: 3, color: SKIN });

        // Brow ridge - angular shelf
        const browGeo = new THREE.BoxGeometry(0.36, 0.05, 0.12);
        browGeo.translate(0, 1.84, 0.14);
        parts.push({ geo: browGeo, boneIdx: 3, color: SKIN });

        // Nose - triangular wedge
        const noseGeo = new THREE.CylinderGeometry(0, 0.04, 0.1, 4);
        noseGeo.rotateX(-Math.PI / 2);
        noseGeo.translate(0, 1.68, 0.2);
        parts.push({ geo: noseGeo, boneIdx: 3, color: SKIN });

        // Chin - small protruding box
        const chinGeo = new THREE.BoxGeometry(0.12, 0.06, 0.08);
        chinGeo.translate(0, 1.52, 0.1);
        parts.push({ geo: chinGeo, boneIdx: 3, color: SKIN });

        // Eye sockets - indented boxes (darker skin tone)
        for (const side of [-1, 1]) {
            const eyeGeo = new THREE.BoxGeometry(0.07, 0.04, 0.04);
            eyeGeo.translate(side * 0.08, 1.73, 0.17);
            parts.push({ geo: eyeGeo, boneIdx: 3, color: 0x222222 });
        }

        // Ears
        for (const side of [-1, 1]) {
            const earGeo = new THREE.BoxGeometry(0.04, 0.08, 0.06);
            earGeo.translate(side * 0.2, 1.7, 0);
            parts.push({ geo: earGeo, boneIdx: 3, color: SKIN });
        }
    }

    // Hair - angular polygon chunks, not a flat slab
    {
        // Main hair volume
        const hairMainGeo = new THREE.CylinderGeometry(0.19, 0.17, 0.08, 8);
        hairMainGeo.translate(0, 1.9, -0.01);
        parts.push({ geo: hairMainGeo, boneIdx: 3, color: HAIR });

        // Top tuft - angled box
        const tuftGeo = new THREE.BoxGeometry(0.24, 0.06, 0.2);
        tuftGeo.rotateZ(0.1);
        tuftGeo.translate(0.02, 1.95, 0);
        parts.push({ geo: tuftGeo, boneIdx: 3, color: HAIR });

        // Back of hair
        const backHairGeo = new THREE.BoxGeometry(0.3, 0.12, 0.1);
        backHairGeo.translate(0, 1.84, -0.14);
        parts.push({ geo: backHairGeo, boneIdx: 3, color: HAIR });
    }

    // Torso - tapered from wider shoulders to narrower waist
    addBox(0.58, 0.35, 0.3, 0, 1.35, 0, 2, SHIRT);   // Chest (widest)
    addBox(0.46, 0.25, 0.28, 0, 1.08, 0, 1, SHIRT);   // Waist (tapered)
    addBox(0.42, 0.15, 0.26, 0, 0.95, 0, 0, SHIRT);   // Hips (narrower)

    // Arms
    // Left arm
    addBox(0.12, 0.3, 0.12, -0.36, 1.25, 0, 4, SHIRT);    // L upper arm
    addBox(0.1, 0.28, 0.1, -0.36, 0.95, 0, 5, SKIN);      // L forearm
    addBox(0.08, 0.1, 0.1, -0.36, 0.78, 0, 6, SKIN);      // L hand (mitten)

    // Right arm
    addBox(0.12, 0.3, 0.12, 0.36, 1.25, 0, 7, SHIRT);     // R upper arm
    addBox(0.1, 0.28, 0.1, 0.36, 0.95, 0, 8, SKIN);       // R forearm
    addBox(0.08, 0.1, 0.1, 0.36, 0.78, 0, 9, SKIN);       // R hand (mitten)

    // Legs
    // Left leg
    addBox(0.14, 0.38, 0.14, -0.12, 0.58, 0, 10, PANTS);  // L thigh
    addBox(0.12, 0.36, 0.12, -0.12, 0.23, 0, 11, PANTS);  // L shin
    addBox(0.14, 0.08, 0.22, -0.12, 0.04, 0.04, 12, SHOE); // L foot

    // Right leg
    addBox(0.14, 0.38, 0.14, 0.12, 0.58, 0, 13, PANTS);   // R thigh
    addBox(0.12, 0.36, 0.12, 0.12, 0.23, 0, 14, PANTS);   // R shin
    addBox(0.14, 0.08, 0.22, 0.12, 0.04, 0.04, 15, SHOE); // R foot

    // --- Merge all parts into one BufferGeometry with skin indices/weights ---
    const mergedGeometries = [];
    const skinIndices = [];
    const skinWeights = [];

    // Bone world positions for weight assignment
    const boneWorldPositions = [
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

    for (const part of parts) {
        const geo = part.geo;
        const vertCount = geo.attributes.position.count;

        // Simple rigid skinning: primary bone gets weight 1.0
        for (let v = 0; v < vertCount; v++) {
            const vx = geo.attributes.position.getX(v);
            const vy = geo.attributes.position.getY(v);
            const vz = geo.attributes.position.getZ(v);

            // Find closest bone and second closest
            let minDist = Infinity, secondDist = Infinity;
            let minIdx = part.boneIdx, secondIdx = part.boneIdx;

            for (let b = 0; b < boneWorldPositions.length; b++) {
                const bp = boneWorldPositions[b];
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

            // Near joints: blend between two bones
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

        // Color the geometry vertices
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

    // Merge all geometries
    const merged = BufferGeometryUtils.mergeBufferGeometries(mergedGeometries, false);

    // Add skin attributes
    merged.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    merged.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

    // Create material with vertex colors
    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        metalness: 0.0
    });

    // Create SkinnedMesh
    const skinnedMesh = new THREE.SkinnedMesh(merged, material);
    skinnedMesh.name = 'CharacterMesh';
    skinnedMesh.add(bones[0]); // Add root bone as child
    skinnedMesh.bind(skeleton);

    scene.add(skinnedMesh);

    // --- Animation Clips ---
    const animations = [];

    // Helper: create quaternion keyframe track
    function quatTrack(boneName, times, quats) {
        return new THREE.QuaternionKeyframeTrack(
            `${boneName}.quaternion`,
            times,
            quats
        );
    }

    // Helper: create position keyframe track
    function posTrack(boneName, times, positions) {
        return new THREE.VectorKeyframeTrack(
            `${boneName}.position`,
            times,
            positions
        );
    }

    // Helper: euler to quaternion array
    function eq(x, y, z) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
        return [q.x, q.y, q.z, q.w];
    }

    // Identity quaternion
    const qi = [0, 0, 0, 1];

    // 1. Idle (2s loop)
    animations.push(new THREE.AnimationClip('idle', 2, [
        quatTrack('Spine', [0, 1, 2], [...qi, ...eq(0.01, 0, 0), ...qi]),
        quatTrack('Head', [0, 1, 2], [...qi, ...eq(0, 0.03, 0), ...qi]),
    ]));

    // 2. Walk (1s loop)
    const walkLegAngle = 30 * Math.PI / 180;
    const walkArmAngle = 25 * Math.PI / 180;
    animations.push(new THREE.AnimationClip('walk', 1, [
        // Legs swing
        quatTrack('L_Hip', [0, 0.25, 0.5, 0.75, 1], [
            ...eq(walkLegAngle, 0, 0), ...qi, ...eq(-walkLegAngle, 0, 0), ...qi, ...eq(walkLegAngle, 0, 0)
        ]),
        quatTrack('R_Hip', [0, 0.25, 0.5, 0.75, 1], [
            ...eq(-walkLegAngle, 0, 0), ...qi, ...eq(walkLegAngle, 0, 0), ...qi, ...eq(-walkLegAngle, 0, 0)
        ]),
        // Knee bend
        quatTrack('L_Knee', [0, 0.25, 0.5, 0.75, 1], [
            ...qi, ...eq(0.3, 0, 0), ...qi, ...eq(0.1, 0, 0), ...qi
        ]),
        quatTrack('R_Knee', [0, 0.25, 0.5, 0.75, 1], [
            ...qi, ...eq(0.1, 0, 0), ...qi, ...eq(0.3, 0, 0), ...qi
        ]),
        // Arms counter-swing
        quatTrack('L_Shoulder', [0, 0.25, 0.5, 0.75, 1], [
            ...eq(-walkArmAngle, 0, 0), ...qi, ...eq(walkArmAngle, 0, 0), ...qi, ...eq(-walkArmAngle, 0, 0)
        ]),
        quatTrack('R_Shoulder', [0, 0.25, 0.5, 0.75, 1], [
            ...eq(walkArmAngle, 0, 0), ...qi, ...eq(-walkArmAngle, 0, 0), ...qi, ...eq(walkArmAngle, 0, 0)
        ]),
        // Body bob
        posTrack('Root', [0, 0.25, 0.5, 0.75, 1], [
            0, 0.95, 0, 0, 1.0, 0, 0, 0.95, 0, 0, 1.0, 0, 0, 0.95, 0
        ]),
        // Torso twist
        quatTrack('Chest', [0, 0.25, 0.5, 0.75, 1], [
            ...eq(0, 0.05, 0), ...qi, ...eq(0, -0.05, 0), ...qi, ...eq(0, 0.05, 0)
        ]),
    ]));

    // 3. Run (0.6s loop)
    const runLegAngle = 45 * Math.PI / 180;
    const runArmAngle = 40 * Math.PI / 180;
    animations.push(new THREE.AnimationClip('run', 0.6, [
        quatTrack('L_Hip', [0, 0.15, 0.3, 0.45, 0.6], [
            ...eq(runLegAngle, 0, 0), ...qi, ...eq(-runLegAngle, 0, 0), ...qi, ...eq(runLegAngle, 0, 0)
        ]),
        quatTrack('R_Hip', [0, 0.15, 0.3, 0.45, 0.6], [
            ...eq(-runLegAngle, 0, 0), ...qi, ...eq(runLegAngle, 0, 0), ...qi, ...eq(-runLegAngle, 0, 0)
        ]),
        quatTrack('L_Knee', [0, 0.15, 0.3, 0.45, 0.6], [
            ...qi, ...eq(0.5, 0, 0), ...qi, ...eq(0.2, 0, 0), ...qi
        ]),
        quatTrack('R_Knee', [0, 0.15, 0.3, 0.45, 0.6], [
            ...qi, ...eq(0.2, 0, 0), ...qi, ...eq(0.5, 0, 0), ...qi
        ]),
        quatTrack('L_Shoulder', [0, 0.15, 0.3, 0.45, 0.6], [
            ...eq(-runArmAngle, 0, 0), ...qi, ...eq(runArmAngle, 0, 0), ...qi, ...eq(-runArmAngle, 0, 0)
        ]),
        quatTrack('R_Shoulder', [0, 0.15, 0.3, 0.45, 0.6], [
            ...eq(runArmAngle, 0, 0), ...qi, ...eq(-runArmAngle, 0, 0), ...qi, ...eq(runArmAngle, 0, 0)
        ]),
        // Elbow bend for run (negative X = bend forward)
        quatTrack('L_Elbow', [0, 0.3, 0.6], [...eq(-0.5, 0, 0), ...eq(-0.3, 0, 0), ...eq(-0.5, 0, 0)]),
        quatTrack('R_Elbow', [0, 0.3, 0.6], [...eq(-0.5, 0, 0), ...eq(-0.3, 0, 0), ...eq(-0.5, 0, 0)]),
        // Forward lean
        quatTrack('Spine', [0, 0.6], [...eq(0.17, 0, 0), ...eq(0.17, 0, 0)]),
        // Body bob
        posTrack('Root', [0, 0.15, 0.3, 0.45, 0.6], [
            0, 0.95, 0, 0, 1.02, 0, 0, 0.95, 0, 0, 1.02, 0, 0, 0.95, 0
        ]),
    ]));

    // 4. Sprint (0.4s loop)
    const sprintLegAngle = 55 * Math.PI / 180;
    const sprintArmAngle = 50 * Math.PI / 180;
    animations.push(new THREE.AnimationClip('sprint', 0.4, [
        quatTrack('L_Hip', [0, 0.1, 0.2, 0.3, 0.4], [
            ...eq(sprintLegAngle, 0, 0), ...qi, ...eq(-sprintLegAngle, 0, 0), ...qi, ...eq(sprintLegAngle, 0, 0)
        ]),
        quatTrack('R_Hip', [0, 0.1, 0.2, 0.3, 0.4], [
            ...eq(-sprintLegAngle, 0, 0), ...qi, ...eq(sprintLegAngle, 0, 0), ...qi, ...eq(-sprintLegAngle, 0, 0)
        ]),
        quatTrack('L_Knee', [0, 0.1, 0.2, 0.3, 0.4], [
            ...qi, ...eq(0.7, 0, 0), ...qi, ...eq(0.3, 0, 0), ...qi
        ]),
        quatTrack('R_Knee', [0, 0.1, 0.2, 0.3, 0.4], [
            ...qi, ...eq(0.3, 0, 0), ...qi, ...eq(0.7, 0, 0), ...qi
        ]),
        quatTrack('L_Shoulder', [0, 0.1, 0.2, 0.3, 0.4], [
            ...eq(-sprintArmAngle, 0, 0), ...qi, ...eq(sprintArmAngle, 0, 0), ...qi, ...eq(-sprintArmAngle, 0, 0)
        ]),
        quatTrack('R_Shoulder', [0, 0.1, 0.2, 0.3, 0.4], [
            ...eq(sprintArmAngle, 0, 0), ...qi, ...eq(-sprintArmAngle, 0, 0), ...qi, ...eq(sprintArmAngle, 0, 0)
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
        // Wind-up: R_Shoulder back
        quatTrack('R_Shoulder', [0, 0.1, 0.25, 0.4], [
            ...qi, ...eq(0.5, 0, -0.3), ...eq(-1.4, 0, 0), ...qi
        ]),
        quatTrack('R_Elbow', [0, 0.1, 0.25, 0.4], [
            ...qi, ...eq(-1.0, 0, 0), ...eq(-0.1, 0, 0), ...qi
        ]),
        // Torso twist
        quatTrack('Chest', [0, 0.1, 0.25, 0.4], [
            ...qi, ...eq(0, -0.3, 0), ...eq(0, 0.5, 0), ...qi
        ]),
    ]));

    // 6. Jump (0.6s, no loop) — crouch, launch, tuck, land
    animations.push(new THREE.AnimationClip('jump', 0.6, [
        // Crouch → launch → air → land
        posTrack('Root', [0, 0.1, 0.2, 0.4, 0.6], [
            0, 0.95, 0,  0, 0.8, 0,  0, 1.1, 0,  0, 1.05, 0,  0, 0.95, 0
        ]),
        // Legs tuck up in air
        quatTrack('L_Hip', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.3, 0, 0), ...eq(-0.6, 0, 0), ...eq(-0.3, 0, 0), ...qi
        ]),
        quatTrack('R_Hip', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.3, 0, 0), ...eq(-0.6, 0, 0), ...eq(-0.3, 0, 0), ...qi
        ]),
        // Knees bend on crouch and in air
        quatTrack('L_Knee', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.8, 0, 0), ...eq(0.5, 0, 0), ...eq(0.3, 0, 0), ...qi
        ]),
        quatTrack('R_Knee', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.8, 0, 0), ...eq(0.5, 0, 0), ...eq(0.3, 0, 0), ...qi
        ]),
        // Arms go up and out
        quatTrack('L_Shoulder', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.3, 0, 0.3), ...eq(-1.5, 0, 0.5), ...eq(-0.8, 0, 0.3), ...qi
        ]),
        quatTrack('R_Shoulder', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.3, 0, -0.3), ...eq(-1.5, 0, -0.5), ...eq(-0.8, 0, -0.3), ...qi
        ]),
        // Slight forward lean during jump
        quatTrack('Spine', [0, 0.1, 0.25, 0.45, 0.6], [
            ...qi, ...eq(0.1, 0, 0), ...eq(0.05, 0, 0), ...eq(0.08, 0, 0), ...qi
        ]),
    ]));

    return { scene, animations };
}


// ============================================================
// VEHICLE MODELS
// ============================================================
function buildVehicle(type) {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.name = type;

    const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4, metalness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x88aacc, roughness: 0.1, metalness: 0.3,
        transparent: true, opacity: 0.7
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.1, metalness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const headlightMat = new THREE.MeshStandardMaterial({
        color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.3
    });
    const taillightMat = new THREE.MeshStandardMaterial({
        color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.2
    });

    if (type === 'sedan' || type === 'sports' || type === 'police') {
        const isSports = type === 'sports';
        const isPolice = type === 'police';
        const w = isSports ? 1.9 : 2.0;
        const h = isSports ? 1.1 : 1.3;
        const l = isSports ? 4.2 : 4.5;

        // Body
        const bodyH = h * (isSports ? 0.4 : 0.5);
        const bodyGeo = new THREE.BoxGeometry(w, bodyH, l);
        const bodyMesh = new THREE.Mesh(bodyGeo, isPolice ?
            new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.6 }) : mat);
        bodyMesh.position.y = h * 0.3;
        bodyMesh.castShadow = true;
        group.add(bodyMesh);

        // Hood slope
        const hoodGeo = new THREE.BoxGeometry(w * 0.95, bodyH * 0.6, l * 0.25);
        const hood = new THREE.Mesh(hoodGeo, isPolice ?
            new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4, metalness: 0.6 }) : mat);
        hood.position.set(0, h * 0.45, l * 0.35);
        hood.rotation.x = -0.15;
        group.add(hood);

        // Trunk
        const trunkGeo = new THREE.BoxGeometry(w * 0.9, bodyH * 0.5, l * 0.2);
        const trunk = new THREE.Mesh(trunkGeo, isPolice ?
            new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4, metalness: 0.6 }) : mat);
        trunk.position.set(0, h * 0.4, -l * 0.38);
        group.add(trunk);

        // Cabin
        const cabinGeo = new THREE.BoxGeometry(w * 0.82, h * (isSports ? 0.3 : 0.4), l * 0.4);
        const cabin = new THREE.Mesh(cabinGeo, glassMat);
        cabin.position.set(0, h * (isSports ? 0.55 : 0.65), -l * 0.05);
        group.add(cabin);

        // Windshield
        const wsGeo = new THREE.PlaneGeometry(w * 0.78, h * (isSports ? 0.3 : 0.4));
        const ws = new THREE.Mesh(wsGeo, glassMat);
        ws.position.set(0, h * (isSports ? 0.55 : 0.65), l * 0.15);
        ws.rotation.x = -0.3;
        group.add(ws);

        // Bumpers
        const fbGeo = new THREE.BoxGeometry(w + 0.2, 0.2, 0.15);
        const fb = new THREE.Mesh(fbGeo, chromeMat);
        fb.position.set(0, h * 0.15, l / 2 + 0.05);
        group.add(fb);

        const rbGeo = new THREE.BoxGeometry(w + 0.2, 0.2, 0.15);
        const rb = new THREE.Mesh(rbGeo, chromeMat);
        rb.position.set(0, h * 0.15, -l / 2 - 0.05);
        group.add(rb);

        // Side mirrors
        for (const side of [-1, 1]) {
            const armGeo = new THREE.BoxGeometry(0.3, 0.05, 0.05);
            const arm = new THREE.Mesh(armGeo, chromeMat);
            arm.position.set(side * (w / 2 + 0.15), h * 0.55, l * 0.15);
            group.add(arm);
            const mirGeo = new THREE.BoxGeometry(0.08, 0.1, 0.12);
            const mir = new THREE.Mesh(mirGeo, chromeMat);
            mir.position.set(side * (w / 2 + 0.28), h * 0.55, l * 0.15);
            group.add(mir);
        }

        // Headlights
        for (const side of [-0.5, 0.5]) {
            const hlGeo = new THREE.BoxGeometry(0.2, 0.12, 0.05);
            const hl = new THREE.Mesh(hlGeo, headlightMat);
            hl.position.set(side * w * 0.4, h * 0.3, l / 2 + 0.05);
            group.add(hl);
        }

        // Taillights
        for (const side of [-0.5, 0.5]) {
            const tlGeo = new THREE.BoxGeometry(0.2, 0.1, 0.05);
            const tl = new THREE.Mesh(tlGeo, taillightMat);
            tl.position.set(side * w * 0.4, h * 0.3, -l / 2 - 0.05);
            group.add(tl);
        }

        // Spoiler for sports
        if (isSports) {
            const spGeo = new THREE.BoxGeometry(w * 0.8, 0.05, 0.3);
            const sp = new THREE.Mesh(spGeo, mat);
            sp.position.set(0, h * 0.65, -l * 0.42);
            group.add(sp);
            for (const s of [-0.3, 0.3]) {
                const aGeo = new THREE.BoxGeometry(0.05, 0.15, 0.05);
                const a = new THREE.Mesh(aGeo, mat);
                a.position.set(s, h * 0.58, -l * 0.42);
                group.add(a);
            }
        }

        // Police light bar
        if (isPolice) {
            const lbGeo = new THREE.BoxGeometry(w * 0.5, 0.12, 0.3);
            const lbMat = new THREE.MeshStandardMaterial({
                color: 0x0044ff, emissive: 0x0022aa, emissiveIntensity: 0.3
            });
            const lb = new THREE.Mesh(lbGeo, lbMat);
            lb.position.set(0, h * 0.87, -l * 0.05);
            group.add(lb);
        }

        // Wheels (separate children for rotation)
        const wheelRadius = isSports ? 0.18 : 0.22;
        addWheels(group, w, l, wheelRadius, darkMat);

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

function addWheels(group, width, length, radius, wheelMat) {
    const positions = [
        { x: -width / 2, z: length * 0.3, name: 'wheel_FL' },
        { x: width / 2, z: length * 0.3, name: 'wheel_FR' },
        { x: -width / 2, z: -length * 0.3, name: 'wheel_RL' },
        { x: width / 2, z: -length * 0.3, name: 'wheel_RR' },
    ];

    for (const pos of positions) {
        const wheelGeo = new THREE.CylinderGeometry(radius, radius, 0.15, 12);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(pos.x, radius, pos.z);
        wheel.name = pos.name;
        group.add(wheel);
    }
}


// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log('San Claudio Model Generator');
    console.log('==========================\n');

    // Character
    console.log('Building character model...');
    const charData = buildCharacter();
    await exportToGLB(charData.scene, charData.animations, 'character.glb');

    // Vehicles
    const vehicleTypes = ['sedan', 'sports', 'truck', 'motorcycle', 'boat', 'police'];
    for (const type of vehicleTypes) {
        console.log(`Building ${type} model...`);
        const vData = buildVehicle(type);
        await exportToGLB(vData.scene, vData.animations, `${type}.glb`);
    }

    console.log('\nDone! All models exported to assets/models/');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
