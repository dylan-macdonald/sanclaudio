// San Claudio — SVG-to-3D Lofting Tool
// Takes three orthographic SVG silhouettes (front, side, top) and generates a 3D GLB model.
// Run: node svg-to-model.js <config.json>
//
// The config JSON specifies:
//   - svgFront, svgSide, svgTop: paths to SVG files
//   - components: array of { id, frontPath, sidePath, topPath?, color, boneIdx }
//   - yRanges: vertex color zones [{ yMin, yMax, color }]
//   - skeleton: bone definitions for character models
//   - output: output GLB path
//   - scale: model scale factor
//   - samplesPerUnit: cross-section density (samples per unit height)
//   - vertsPerRing: vertices per cross-section ring (8-12)

import { Blob as NodeBlob } from 'buffer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Polyfill browser APIs for Three.js GLTFExporter
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
        createElement: (tag) => {
            if (tag === 'canvas') {
                try { const { createCanvas } = require('canvas'); return createCanvas(1, 1); }
                catch { return { getContext: () => null, style: {} }; }
            }
            return { style: {} };
        }
    };
}

import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// =====================================================================
// SVG PATH PARSER
// Parses SVG path d-attribute into an array of [x, y] points
// Handles: M, L, H, V, C, Q, S, T, Z (and lowercase relatives)
// =====================================================================
function parseSVGPath(d) {
    const points = [];
    const commands = d.match(/[a-zA-Z][^a-zA-Z]*/g);
    if (!commands) return points;

    let cx = 0, cy = 0;      // current position
    let sx = 0, sy = 0;      // start of subpath
    let prevCp = null;        // previous control point for S/T

    for (const cmd of commands) {
        const type = cmd[0];
        const nums = (cmd.slice(1).match(/-?\d+\.?\d*(?:e[+-]?\d+)?/gi) || []).map(Number);
        const rel = type === type.toLowerCase();

        switch (type.toUpperCase()) {
            case 'M': {
                let i = 0;
                while (i < nums.length) {
                    const x = nums[i] + (rel && i > 0 ? cx : (rel ? cx : 0));
                    const y = nums[i + 1] + (rel && i > 0 ? cy : (rel ? cy : 0));
                    if (i === 0 && !rel) { cx = nums[0]; cy = nums[1]; }
                    else if (i === 0 && rel) { cx += nums[0]; cy += nums[1]; }
                    else { cx = x; cy = y; }
                    points.push([cx, cy]);
                    if (i === 0) { sx = cx; sy = cy; }
                    i += 2;
                }
                prevCp = null;
                break;
            }
            case 'L': {
                for (let i = 0; i < nums.length; i += 2) {
                    cx = rel ? cx + nums[i] : nums[i];
                    cy = rel ? cy + nums[i + 1] : nums[i + 1];
                    points.push([cx, cy]);
                }
                prevCp = null;
                break;
            }
            case 'H': {
                for (const n of nums) {
                    cx = rel ? cx + n : n;
                    points.push([cx, cy]);
                }
                prevCp = null;
                break;
            }
            case 'V': {
                for (const n of nums) {
                    cy = rel ? cy + n : n;
                    points.push([cx, cy]);
                }
                prevCp = null;
                break;
            }
            case 'C': {
                for (let i = 0; i < nums.length; i += 6) {
                    const x1 = (rel ? cx : 0) + nums[i];
                    const y1 = (rel ? cy : 0) + nums[i + 1];
                    const x2 = (rel ? cx : 0) + nums[i + 2];
                    const y2 = (rel ? cy : 0) + nums[i + 3];
                    const x3 = (rel ? cx : 0) + nums[i + 4];
                    const y3 = (rel ? cy : 0) + nums[i + 5];
                    // Sample cubic bezier
                    const steps = 8;
                    for (let t = 1; t <= steps; t++) {
                        const u = t / steps;
                        const iu = 1 - u;
                        const px = iu * iu * iu * cx + 3 * iu * iu * u * x1 + 3 * iu * u * u * x2 + u * u * u * x3;
                        const py = iu * iu * iu * cy + 3 * iu * iu * u * y1 + 3 * iu * u * u * y2 + u * u * u * y3;
                        points.push([px, py]);
                    }
                    prevCp = [x2, y2];
                    cx = x3; cy = y3;
                }
                break;
            }
            case 'Q': {
                for (let i = 0; i < nums.length; i += 4) {
                    const x1 = (rel ? cx : 0) + nums[i];
                    const y1 = (rel ? cy : 0) + nums[i + 1];
                    const x2 = (rel ? cx : 0) + nums[i + 2];
                    const y2 = (rel ? cy : 0) + nums[i + 3];
                    const steps = 6;
                    for (let t = 1; t <= steps; t++) {
                        const u = t / steps;
                        const iu = 1 - u;
                        const px = iu * iu * cx + 2 * iu * u * x1 + u * u * x2;
                        const py = iu * iu * cy + 2 * iu * u * y1 + u * u * y2;
                        points.push([px, py]);
                    }
                    prevCp = [x1, y1];
                    cx = x2; cy = y2;
                }
                break;
            }
            case 'S': {
                for (let i = 0; i < nums.length; i += 4) {
                    // Reflect previous control point
                    const x1 = prevCp ? 2 * cx - prevCp[0] : cx;
                    const y1 = prevCp ? 2 * cy - prevCp[1] : cy;
                    const x2 = (rel ? cx : 0) + nums[i];
                    const y2 = (rel ? cy : 0) + nums[i + 1];
                    const x3 = (rel ? cx : 0) + nums[i + 2];
                    const y3 = (rel ? cy : 0) + nums[i + 3];
                    const steps = 8;
                    for (let t = 1; t <= steps; t++) {
                        const u = t / steps;
                        const iu = 1 - u;
                        const px = iu * iu * iu * cx + 3 * iu * iu * u * x1 + 3 * iu * u * u * x2 + u * u * u * x3;
                        const py = iu * iu * iu * cy + 3 * iu * iu * u * y1 + 3 * iu * u * u * y2 + u * u * u * y3;
                        points.push([px, py]);
                    }
                    prevCp = [x2, y2];
                    cx = x3; cy = y3;
                }
                break;
            }
            case 'Z': {
                cx = sx; cy = sy;
                points.push([cx, cy]);
                prevCp = null;
                break;
            }
        }
    }
    return points;
}


// =====================================================================
// SILHOUETTE SAMPLER
// Given a polyline (array of [x, y] points), sample the left/right
// boundaries at evenly spaced Y levels.
// Returns: Map<yLevel, { left: minX, right: maxX }>
// =====================================================================
function sampleSilhouette(points, yMin, yMax, numSamples) {
    const samples = new Map();
    const dy = (yMax - yMin) / (numSamples - 1);

    for (let i = 0; i < numSamples; i++) {
        const y = yMin + i * dy;
        samples.set(y, { left: Infinity, right: -Infinity });
    }

    // Walk each edge of the polyline and find intersections at each Y level
    for (let i = 0; i < points.length - 1; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[i + 1];

        if (y0 === y1) continue; // horizontal edge

        const yLo = Math.min(y0, y1);
        const yHi = Math.max(y0, y1);

        for (const [yLevel, bounds] of samples) {
            if (yLevel < yLo || yLevel > yHi) continue;
            // Interpolate X at this Y level
            const t = (yLevel - y0) / (y1 - y0);
            const x = x0 + t * (x1 - x0);
            bounds.left = Math.min(bounds.left, x);
            bounds.right = Math.max(bounds.right, x);
        }
    }

    // Clean up any Y levels with no intersections
    for (const [y, bounds] of samples) {
        if (bounds.left === Infinity) {
            samples.delete(y);
        }
    }

    return samples;
}


// =====================================================================
// TOP-VIEW OUTLINE → CROSS-SECTION SHAPE
// Converts a top-view SVG path into a normalized shape array.
// Returns array of [xFrac, zFrac] with vertsPerRing entries.
// Each entry is a point on the unit shape; multiply by halfWidth/halfDepth.
// =====================================================================
function normalizeTopOutline(topPoints, centerX, centerY, vertsPerRing) {
    if (!topPoints || topPoints.length < 3) return null;

    // Center the points
    const cx = centerX || 0;
    const cy = centerY || 0;
    const centered = topPoints.map(([x, y]) => [x - cx, y - cy]);

    // Find bounding half-extents
    const maxAbsX = Math.max(...centered.map(([x]) => Math.abs(x)));
    const maxAbsZ = Math.max(...centered.map(([, z]) => Math.abs(z)));
    if (maxAbsX < 0.001 || maxAbsZ < 0.001) return null;

    // Normalize to [-1, 1] range in each axis
    const normalized = centered.map(([x, z]) => [x / maxAbsX, z / maxAbsZ]);

    // Build edge list from the outline
    const edges = [];
    for (let i = 0; i < normalized.length; i++) {
        const [x1, z1] = normalized[i];
        const [x2, z2] = normalized[(i + 1) % normalized.length];
        edges.push({ x1, z1, x2, z2 });
    }

    // For each ring angle, cast ray from center and find intersection with outline
    const shape = [];
    for (let i = 0; i < vertsPerRing; i++) {
        const angle = (i / vertsPerRing) * Math.PI * 2;
        const dirX = Math.sin(angle);
        const dirZ = Math.cos(angle);

        let bestT = 1.0; // Default: unit ellipse

        for (const edge of edges) {
            // Ray from origin: P = t * (dirX, dirZ)
            // Edge: A + s * (B - A), s in [0, 1]
            const ex = edge.x2 - edge.x1;
            const ez = edge.z2 - edge.z1;
            const denom = dirX * ez - dirZ * ex;
            if (Math.abs(denom) < 1e-8) continue;

            const t = (edge.x1 * ez - edge.z1 * ex) / denom;
            const s = (edge.x1 * dirZ - edge.z1 * dirX) / denom;

            if (t > 0.01 && s >= 0 && s <= 1) {
                if (t < bestT) bestT = t;
            }
        }

        shape.push([dirX * bestT, dirZ * bestT]);
    }

    return shape;
}


// =====================================================================
// CROSS-SECTION GENERATOR
// Given width and depth at a Y level, generate a ring of vertices.
// Uses an ellipse, refined by top-view shape if available.
// =====================================================================
function generateRing(y, halfWidth, halfDepth, vertsPerRing, topShape) {
    const ring = [];
    for (let i = 0; i < vertsPerRing; i++) {
        let x, z;

        if (topShape && topShape[i]) {
            // topShape[i] = [xFrac, zFrac] on normalized outline
            x = topShape[i][0] * halfWidth;
            z = topShape[i][1] * halfDepth;
        } else {
            const angle = (i / vertsPerRing) * Math.PI * 2;
            x = halfWidth * Math.sin(angle);
            z = halfDepth * Math.cos(angle);
        }

        ring.push([x, y, z]);
    }
    return ring;
}


// =====================================================================
// LOFTER
// Main function: takes front/side silhouette data and produces geometry.
// =====================================================================
function loftComponent(frontSamples, sideSamples, config) {
    const {
        vertsPerRing = 10,
        yMin, yMax,
        offsetX = 0, offsetY = 0, offsetZ = 0,
        capTop = false, capBottom = false,
        topShape = null,
    } = config;

    // Merge Y levels from both views
    const yLevels = [];
    for (const y of frontSamples.keys()) {
        if (y >= yMin && y <= yMax) yLevels.push(y);
    }
    yLevels.sort((a, b) => a - b);

    if (yLevels.length < 2) {
        console.warn(`  loftComponent: fewer than 2 Y levels between ${yMin}-${yMax}`);
        return null;
    }

    // Build rings at each Y level
    const rings = [];
    for (const y of yLevels) {
        const front = frontSamples.get(y);
        const side = sideSamples.get(y);

        if (!front || !side) continue;

        const halfWidth = (front.right - front.left) / 2;
        const halfDepth = (side.right - side.left) / 2;

        if (halfWidth <= 0 || halfDepth <= 0) continue;

        // Center offset from front view
        const centerX = (front.right + front.left) / 2;
        const centerZ = (side.right + side.left) / 2;

        const ring = generateRing(y + offsetY, halfWidth, halfDepth, vertsPerRing, topShape);
        // Apply center offsets
        for (const v of ring) {
            v[0] += centerX + offsetX;
            v[2] += centerZ + offsetZ;
        }
        rings.push(ring);
    }

    if (rings.length < 2) {
        console.warn(`  loftComponent: fewer than 2 valid rings`);
        return null;
    }

    // Build BufferGeometry
    const VPR = vertsPerRing;
    const NR = rings.length;
    let capCount = 0;
    if (capTop) capCount++;
    if (capBottom) capCount++;
    const totalVerts = NR * VPR + capCount;

    const positions = new Float32Array(totalVerts * 3);
    let vi = 0;
    for (const ring of rings) {
        for (const [x, y, z] of ring) {
            positions[vi * 3] = x;
            positions[vi * 3 + 1] = y;
            positions[vi * 3 + 2] = z;
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

    // Bottom cap
    if (capBottom && rings.length > 0) {
        const capIdx = vi;
        const ring = rings[0];
        let cx = 0, cy = ring[0][1], cz = 0;
        for (const [x, , z] of ring) { cx += x; cz += z; }
        cx /= VPR; cz /= VPR;
        positions[vi * 3] = cx; positions[vi * 3 + 1] = cy; positions[vi * 3 + 2] = cz;
        vi++;
        for (let v = 0; v < VPR; v++) {
            indices.push(v, capIdx, (v + 1) % VPR);
        }
    }

    // Top cap
    if (capTop && rings.length > 0) {
        const capIdx = vi;
        const ring = rings[NR - 1];
        let cx = 0, cy = ring[0][1], cz = 0;
        for (const [x, , z] of ring) { cx += x; cz += z; }
        cx /= VPR; cz /= VPR;
        positions[vi * 3] = cx; positions[vi * 3 + 1] = cy; positions[vi * 3 + 2] = cz;
        vi++;
        const lastR = (NR - 1) * VPR;
        for (let v = 0; v < VPR; v++) {
            indices.push(lastR + v, capIdx, lastR + (v + 1) % VPR);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(totalVerts * 2), 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}


// =====================================================================
// VERTEX COLOR APPLICATOR
// Given geometry and Y-range color zones, apply vertex colors.
// =====================================================================
function parseColor(c) {
    if (typeof c === 'number') return new THREE.Color(c);
    if (typeof c === 'string') {
        if (c.startsWith('0x')) return new THREE.Color(parseInt(c, 16));
        if (c.startsWith('#')) return new THREE.Color(c);
        return new THREE.Color(parseInt(c, 16));
    }
    return new THREE.Color(0xcccccc);
}

function applyVertexColors(geo, yRanges) {
    const pos = geo.getAttribute('position');
    const count = pos.count;
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const y = pos.getY(i);
        let color = new THREE.Color(0xcccccc); // default gray

        for (const range of yRanges) {
            if (y >= range.yMin && y < range.yMax) {
                color = parseColor(range.color);
                break;
            }
        }

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}


// =====================================================================
// SVG FILE PARSER
// Reads an SVG file and extracts named paths (by id attribute)
// =====================================================================
function parseSVGFile(svgPath) {
    const content = fs.readFileSync(svgPath, 'utf-8');
    const paths = {};

    // Extract all <path> elements with their id and d attributes
    const pathRegex = /<path[^>]*\/?>/g;
    let match;
    while ((match = pathRegex.exec(content)) !== null) {
        const pathEl = match[0];
        const idMatch = pathEl.match(/id="([^"]+)"/);
        const dMatch = pathEl.match(/\sd="([^"]+)"/);
        if (dMatch) {
            const id = idMatch ? idMatch[1] : `path_${Object.keys(paths).length}`;
            const parsed = parseSVGPath(dMatch[1]);
            console.log(`    Parsed path "${id}": d="${dMatch[1].slice(0, 60)}..." → ${parsed.length} points`);
            paths[id] = parsed;
        }
    }

    return paths;
}


// =====================================================================
// CHILD OBJECTS — named sub-meshes (wheels, lights, etc.)
// =====================================================================
function buildChildObject(child) {
    const group = new THREE.Group();
    group.name = child.name;

    if (child.type === 'wheel') {
        // Wheel assembly: tire + hub cap + spokes (matching model-generator.js style)
        const r = child.radius || 0.25;
        const w = child.width || 0.14;

        const tireMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.95, metalness: 0.0 });
        const hubMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.2, metalness: 0.8 });

        // Tire
        const tireGeo = new THREE.CylinderGeometry(r, r, w, 14);
        tireGeo.rotateZ(Math.PI / 2);
        group.add(new THREE.Mesh(tireGeo, tireMat));

        // Hub cap
        const hubGeo = new THREE.CylinderGeometry(r * 0.6, r * 0.6, w + 0.02, 10);
        hubGeo.rotateZ(Math.PI / 2);
        group.add(new THREE.Mesh(hubGeo, hubMat));

        // 5 spokes
        const isRight = child.position && child.position[0] > 0;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const spokeGeo = new THREE.BoxGeometry(0.02, r * 0.35, 0.025);
            const spoke = new THREE.Mesh(spokeGeo, hubMat);
            spoke.position.set(
                isRight ? w / 2 + 0.01 : -w / 2 - 0.01,
                Math.sin(angle) * r * 0.35,
                Math.cos(angle) * r * 0.35
            );
            spoke.rotation.x = angle;
            group.add(spoke);
        }
    } else if (child.type === 'box') {
        const s = child.size || [0.1, 0.1, 0.1];
        const geo = new THREE.BoxGeometry(s[0], s[1], s[2]);
        const color = child.color ? parseInt(child.color) : 0xcccccc;
        const mat = new THREE.MeshStandardMaterial({
            color,
            roughness: child.roughness !== undefined ? child.roughness : 0.5,
            metalness: child.metalness !== undefined ? child.metalness : 0.3,
            emissive: child.emissive ? parseInt(child.emissive) : 0x000000,
            emissiveIntensity: child.emissiveIntensity || 0,
            transparent: child.transparent || false,
            opacity: child.opacity !== undefined ? child.opacity : 1.0,
        });
        group.add(new THREE.Mesh(geo, mat));
    } else if (child.type === 'cylinder') {
        const r = child.radius || 0.1;
        const h = child.height || 0.1;
        const geo = new THREE.CylinderGeometry(r, r, h, child.segments || 12);
        if (child.rotateX) geo.rotateX(child.rotateX);
        if (child.rotateZ) geo.rotateZ(child.rotateZ);
        const color = child.color ? parseInt(child.color) : 0xcccccc;
        const mat = new THREE.MeshStandardMaterial({
            color,
            roughness: child.roughness !== undefined ? child.roughness : 0.5,
            metalness: child.metalness !== undefined ? child.metalness : 0.3,
            emissive: child.emissive ? parseInt(child.emissive) : 0x000000,
            emissiveIntensity: child.emissiveIntensity || 0,
        });
        group.add(new THREE.Mesh(geo, mat));
    }

    // Position and rotation
    if (child.position) group.position.set(child.position[0], child.position[1], child.position[2]);
    if (child.rotation) group.rotation.set(child.rotation[0], child.rotation[1], child.rotation[2]);

    return group;
}


// =====================================================================
// FULL PIPELINE
// Reads config, parses SVGs, lofts components, applies colors, exports.
// =====================================================================
async function processConfig(configPath) {
    const configDir = path.dirname(configPath);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    console.log(`\nProcessing: ${config.name || configPath}`);
    console.log('='.repeat(50));

    const scale = config.scale || 1.0;
    const VPR = config.vertsPerRing || 10;
    const samplesPerUnit = config.samplesPerUnit || 40;

    // Parse SVG files
    const frontPaths = parseSVGFile(path.resolve(configDir, config.svgFront));
    const sidePaths = parseSVGFile(path.resolve(configDir, config.svgSide));
    const topPaths = config.svgTop ? parseSVGFile(path.resolve(configDir, config.svgTop)) : {};

    console.log(`  Front SVG: ${Object.keys(frontPaths).length} paths`);
    console.log(`  Side SVG: ${Object.keys(sidePaths).length} paths`);
    if (config.svgTop) console.log(`  Top SVG: ${Object.keys(topPaths).length} paths`);

    // Process each component
    const geometries = [];

    for (const comp of config.components) {
        console.log(`  Lofting component: ${comp.id}`);

        // Get the polylines for this component
        const frontPoints = frontPaths[comp.frontPath || comp.id];
        const sidePoints = sidePaths[comp.sidePath || comp.id];

        if (!frontPoints) {
            console.warn(`    WARNING: No front path found for "${comp.frontPath || comp.id}"`);
            continue;
        }
        if (!sidePoints) {
            console.warn(`    WARNING: No side path found for "${comp.sidePath || comp.id}"`);
            continue;
        }

        // Top-view outline for cross-section shaping
        const topPoints = topPaths[comp.topPath || comp.id];
        const compVPR = comp.vertsPerRing || VPR;
        let topShape = null;
        if (topPoints && topPoints.length >= 3) {
            topShape = normalizeTopOutline(
                topPoints,
                config.topCenterX || config.svgCenterX || 100,
                config.topCenterY || 100,
                compVPR
            );
            if (topShape) {
                console.log(`    Top outline: ${topPoints.length} points → ${topShape.length} shape vertices`);
            }
        }

        // SVG coordinate system: Y increases downward. We need to flip Y.
        // Also apply scale: SVG coordinates are in SVG units, we convert to world units.
        const svgScale = scale;
        const svgYFlip = config.svgHeight || 200; // Total SVG height for Y-flip

        const frontCenterX = config.svgCenterX || 100;
        const sideCenterX = config.sideCenterX || frontCenterX;

        const fPts = frontPoints.map(([x, y]) => [
            (x - frontCenterX) * svgScale,
            (svgYFlip - y) * svgScale
        ]);
        const sPts = sidePoints.map(([x, y]) => [
            (x - sideCenterX) * svgScale,
            (svgYFlip - y) * svgScale
        ]);

        console.log(`    Front points: ${frontPoints.length} raw → ${fPts.length} transformed`);
        console.log(`    Side points: ${sidePoints.length} raw → ${sPts.length} transformed`);
        if (fPts.length > 0) {
            console.log(`    Front Y range: ${Math.min(...fPts.map(p=>p[1])).toFixed(3)} - ${Math.max(...fPts.map(p=>p[1])).toFixed(3)}`);
            console.log(`    Front X range: ${Math.min(...fPts.map(p=>p[0])).toFixed(3)} - ${Math.max(...fPts.map(p=>p[0])).toFixed(3)}`);
        }

        // Determine Y range
        const allY = [...fPts.map(p => p[1]), ...sPts.map(p => p[1])];
        const yMin = comp.yMin !== undefined ? comp.yMin : Math.min(...allY);
        const yMax = comp.yMax !== undefined ? comp.yMax : Math.max(...allY);

        const numSamples = Math.max(4, Math.ceil((yMax - yMin) * samplesPerUnit));

        // Sample silhouettes
        const frontSamples = sampleSilhouette(fPts, yMin, yMax, numSamples);
        const sideSamples = sampleSilhouette(sPts, yMin, yMax, numSamples);

        console.log(`    Y range: ${yMin.toFixed(3)} - ${yMax.toFixed(3)}, ${frontSamples.size}/${sideSamples.size} samples`);

        // Loft
        const geo = loftComponent(frontSamples, sideSamples, {
            vertsPerRing: compVPR,
            yMin, yMax,
            offsetX: comp.offsetX || 0,
            offsetY: comp.offsetY || 0,
            offsetZ: comp.offsetZ || 0,
            capTop: comp.capTop !== undefined ? comp.capTop : false,
            capBottom: comp.capBottom !== undefined ? comp.capBottom : false,
            topShape,
        });

        if (!geo) {
            console.warn(`    FAILED to generate geometry for ${comp.id}`);
            continue;
        }

        // Apply vertex colors (per-component yRanges > component color > global yRanges)
        if (comp.yRanges) {
            applyVertexColors(geo, comp.yRanges);
        } else if (comp.color) {
            const c = parseColor(comp.color);
            const count = geo.getAttribute('position').count;
            const colors = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                colors[i * 3] = c.r;
                colors[i * 3 + 1] = c.g;
                colors[i * 3 + 2] = c.b;
            }
            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        } else if (config.yRanges) {
            applyVertexColors(geo, config.yRanges);
        }

        geometries.push({ geo, boneIdx: comp.boneIdx || 0, id: comp.id });
        console.log(`    OK: ${geo.getAttribute('position').count} verts, ${geo.index.count / 3} tris`);
    }

    // Process addon primitives (boxes, cylinders for face features etc.)
    if (config.addons) {
        for (const addon of config.addons) {
            console.log(`  Adding primitive: ${addon.id || addon.type}`);
            let geo;

            if (addon.type === 'box') {
                geo = new THREE.BoxGeometry(addon.size[0], addon.size[1], addon.size[2]);
            } else if (addon.type === 'cylinder') {
                geo = new THREE.CylinderGeometry(
                    addon.radiusTop || addon.radius,
                    addon.radiusBottom || addon.radius,
                    addon.height, addon.segments || 8
                );
            } else if (addon.type === 'sphere') {
                geo = new THREE.SphereGeometry(addon.radius, addon.segments || 6, addon.segments || 4);
            } else {
                console.warn(`    Unknown addon type: ${addon.type}`);
                continue;
            }

            // Apply position offset
            if (addon.position) {
                const m = new THREE.Matrix4().makeTranslation(addon.position[0], addon.position[1], addon.position[2]);
                geo.applyMatrix4(m);
            }

            // Apply rotation
            if (addon.rotation) {
                const euler = new THREE.Euler(addon.rotation[0], addon.rotation[1], addon.rotation[2]);
                const m = new THREE.Matrix4().makeRotationFromEuler(euler);
                geo.applyMatrix4(m);
            }

            // Apply vertex color
            const c = addon.color ? parseColor(addon.color) : new THREE.Color(0xcccccc);
            const count = geo.getAttribute('position').count;
            const colors = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                colors[i * 3] = c.r;
                colors[i * 3 + 1] = c.g;
                colors[i * 3 + 2] = c.b;
            }
            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            // Ensure UV attribute exists
            if (!geo.getAttribute('uv')) {
                geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
            }

            geometries.push({ geo, boneIdx: addon.boneIdx || 0, id: addon.id || addon.type });
            console.log(`    OK: ${count} verts, ${geo.index ? geo.index.count / 3 : 0} tris`);
        }
    }

    if (geometries.length === 0) {
        console.error('  ERROR: No geometries generated!');
        return;
    }

    // Merge all geometries into a single mesh
    const merged = mergeGeometries(geometries);

    let outputObject;
    let animations = null;

    if (config.skeleton) {
        // CHARACTER MODE: build skeleton, skin weights, and animations
        console.log(`\n  Building skeleton (16 bones)...`);
        const { bones, skeleton } = buildSkeleton();

        console.log(`  Computing skin weights...`);
        computeSkinWeights(merged);

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.7,
            metalness: 0.02,
            flatShading: true,
            skinning: true,
        });

        const skinnedMesh = new THREE.SkinnedMesh(merged, material);
        skinnedMesh.name = 'CharacterMesh';
        skinnedMesh.add(bones[0]);
        skinnedMesh.bind(skeleton);

        outputObject = skinnedMesh;

        console.log(`  Building animations (32 clips)...`);
        animations = buildAnimations();
        console.log(`  OK: ${animations.length} animation clips`);
    } else {
        // STATIC MODE: regular mesh (potentially inside a group with children)
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: config.roughness !== undefined ? config.roughness : 0.7,
            metalness: config.metalness !== undefined ? config.metalness : 0.02,
            flatShading: true,
        });

        const mesh = new THREE.Mesh(merged, material);
        mesh.name = config.name || 'lofted_model';

        // If we have children (e.g. wheels), wrap in a group
        if (config.children && config.children.length > 0) {
            const group = new THREE.Group();
            group.name = config.name || 'lofted_model';
            group.add(mesh);

            console.log(`\n  Adding ${config.children.length} named children...`);
            for (const child of config.children) {
                const childGroup = buildChildObject(child);
                if (childGroup) {
                    group.add(childGroup);
                    console.log(`    ${child.name}: OK`);
                }
            }

            outputObject = group;
        } else {
            outputObject = mesh;
        }
    }

    // Export
    const outputPath = path.resolve(configDir, config.output || 'output.glb');
    await exportGLB(outputObject, outputPath, animations);
    console.log(`\n  Exported: ${outputPath} (${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB)`);
}


// =====================================================================
// GEOMETRY MERGER
// =====================================================================
function mergeGeometries(geoList) {
    // Calculate total vertex count
    let totalVerts = 0;
    let totalIndices = 0;
    for (const { geo } of geoList) {
        totalVerts += geo.getAttribute('position').count;
        totalIndices += geo.index ? geo.index.count : 0;
    }

    const positions = new Float32Array(totalVerts * 3);
    const colors = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    const indices = [];

    let vertOffset = 0;
    for (const { geo } of geoList) {
        const pos = geo.getAttribute('position');
        const col = geo.getAttribute('color');
        const uv = geo.getAttribute('uv');
        const idx = geo.index;

        for (let i = 0; i < pos.count; i++) {
            positions[(vertOffset + i) * 3] = pos.getX(i);
            positions[(vertOffset + i) * 3 + 1] = pos.getY(i);
            positions[(vertOffset + i) * 3 + 2] = pos.getZ(i);

            if (col) {
                colors[(vertOffset + i) * 3] = col.getX(i);
                colors[(vertOffset + i) * 3 + 1] = col.getY(i);
                colors[(vertOffset + i) * 3 + 2] = col.getZ(i);
            }

            if (uv) {
                uvs[(vertOffset + i) * 2] = uv.getX(i);
                uvs[(vertOffset + i) * 2 + 1] = uv.getY(i);
            }
        }

        if (idx) {
            for (let i = 0; i < idx.count; i++) {
                indices.push(idx.array[i] + vertOffset);
            }
        }

        vertOffset += pos.count;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    merged.setIndex(indices);
    merged.computeVertexNormals();
    return merged;
}


// =====================================================================
// SKELETON BUILDER — 16-bone humanoid skeleton (matches model-generator.js)
// =====================================================================
function buildSkeleton() {
    const boneNames = [
        'Root','Spine','Chest','Head',
        'L_Shoulder','L_Elbow','L_Hand',
        'R_Shoulder','R_Elbow','R_Hand',
        'L_Hip','L_Knee','L_Foot',
        'R_Hip','R_Knee','R_Foot',
    ];
    const bonePositions = [
        [0, 0.95, 0],    // Root
        [0, 0.2, 0],     // Spine
        [0, 0.2, 0],     // Chest
        [0, 0.3, 0],     // Head
        [-0.38, 0, 0],   // L_Shoulder
        [0, -0.3, 0],    // L_Elbow
        [0, -0.3, 0],    // L_Hand
        [0.38, 0, 0],    // R_Shoulder
        [0, -0.3, 0],    // R_Elbow
        [0, -0.3, 0],    // R_Hand
        [-0.12, 0, 0],   // L_Hip
        [0, -0.4, 0],    // L_Knee
        [0, -0.4, 0],    // L_Foot
        [0.12, 0, 0],    // R_Hip
        [0, -0.4, 0],    // R_Knee
        [0, -0.4, 0],    // R_Foot
    ];
    const parentIndices = [-1, 0, 1, 2, 2, 4, 5, 2, 7, 8, 0, 10, 11, 0, 13, 14];

    const bones = [];
    for (let i = 0; i < boneNames.length; i++) {
        const bone = new THREE.Bone();
        bone.name = boneNames[i];
        bone.position.set(...bonePositions[i]);
        bones.push(bone);
    }
    for (let i = 0; i < parentIndices.length; i++) {
        if (parentIndices[i] >= 0) bones[parentIndices[i]].add(bones[i]);
    }
    return { bones, skeleton: new THREE.Skeleton(bones), boneNames };
}

// World-space bone positions for skinning weight calculation
const BONE_WORLD_POS = [
    [0, 0.95, 0], [0, 1.15, 0], [0, 1.35, 0], [0, 1.65, 0],
    [-0.38, 1.35, 0], [-0.38, 1.05, 0], [-0.38, 0.75, 0],
    [0.38, 1.35, 0], [0.38, 1.05, 0], [0.38, 0.75, 0],
    [-0.12, 0.95, 0], [-0.12, 0.55, 0], [-0.12, 0.15, 0],
    [0.12, 0.95, 0], [0.12, 0.55, 0], [0.12, 0.15, 0],
];


// =====================================================================
// VERTEX SKINNING — distance-based bone weight assignment
// =====================================================================
function computeSkinWeights(geometry) {
    const pos = geometry.getAttribute('position');
    const count = pos.count;
    const skinIndices = new Uint16Array(count * 4);
    const skinWeights = new Float32Array(count * 4);

    for (let v = 0; v < count; v++) {
        const vx = pos.getX(v), vy = pos.getY(v), vz = pos.getZ(v);
        let minDist = Infinity, secondDist = Infinity;
        let minIdx = 0, secondIdx = 0;

        for (let b = 0; b < BONE_WORLD_POS.length; b++) {
            const bp = BONE_WORLD_POS[b];
            const d = Math.sqrt((vx - bp[0]) ** 2 + (vy - bp[1]) ** 2 + (vz - bp[2]) ** 2);
            if (d < minDist) {
                secondDist = minDist; secondIdx = minIdx;
                minDist = d; minIdx = b;
            } else if (d < secondDist) {
                secondDist = d; secondIdx = b;
            }
        }

        const jointThreshold = 0.15;
        if (minDist < jointThreshold && secondDist < jointThreshold * 2 && minIdx !== secondIdx) {
            const total = minDist + secondDist;
            const w1 = 1 - (minDist / total);
            const w2 = 1 - (secondDist / total);
            const norm = w1 + w2;
            skinIndices[v * 4] = minIdx;     skinIndices[v * 4 + 1] = secondIdx;
            skinWeights[v * 4] = w1 / norm;  skinWeights[v * 4 + 1] = w2 / norm;
        } else {
            skinIndices[v * 4] = minIdx;
            skinWeights[v * 4] = 1;
        }
    }

    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
}


// =====================================================================
// ANIMATION BUILDER — all 32 character animations
// =====================================================================
function buildAnimations() {
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
    const animations = [];

    // 1. idle
    animations.push(new THREE.AnimationClip('idle', 2, [
        quatTrack('Spine', [0, 1, 2], [...qi, ...eq(0.02, 0, 0), ...qi]),
        quatTrack('Head', [0, 0.7, 1.4, 2], [...qi, ...eq(0, 0.04, 0), ...qi, ...eq(0, -0.04, 0)]),
        quatTrack('L_Shoulder', [0, 1, 2], [...eq(0, 0, 0.06), ...eq(0, 0, 0.03), ...eq(0, 0, 0.06)]),
        quatTrack('R_Shoulder', [0, 1, 2], [...eq(0, 0, -0.06), ...eq(0, 0, -0.03), ...eq(0, 0, -0.06)]),
    ]));

    // 2. walk
    const wl = 30 * Math.PI / 180, wa = 25 * Math.PI / 180;
    animations.push(new THREE.AnimationClip('walk', 1, [
        quatTrack('L_Hip', [0, 0.25, 0.5, 0.75, 1], [...eq(wl, 0, 0), ...qi, ...eq(-wl, 0, 0), ...qi, ...eq(wl, 0, 0)]),
        quatTrack('R_Hip', [0, 0.25, 0.5, 0.75, 1], [...eq(-wl, 0, 0), ...qi, ...eq(wl, 0, 0), ...qi, ...eq(-wl, 0, 0)]),
        quatTrack('L_Knee', [0, 0.25, 0.5, 0.75, 1], [...qi, ...eq(0.3, 0, 0), ...qi, ...eq(0.1, 0, 0), ...qi]),
        quatTrack('R_Knee', [0, 0.25, 0.5, 0.75, 1], [...qi, ...eq(0.1, 0, 0), ...qi, ...eq(0.3, 0, 0), ...qi]),
        quatTrack('L_Shoulder', [0, 0.25, 0.5, 0.75, 1], [...eq(-wa, 0, 0), ...qi, ...eq(wa, 0, 0), ...qi, ...eq(-wa, 0, 0)]),
        quatTrack('R_Shoulder', [0, 0.25, 0.5, 0.75, 1], [...eq(wa, 0, 0), ...qi, ...eq(-wa, 0, 0), ...qi, ...eq(wa, 0, 0)]),
        posTrack('Root', [0, 0.25, 0.5, 0.75, 1], [0, 0.95, 0, 0, 1.0, 0, 0, 0.95, 0, 0, 1.0, 0, 0, 0.95, 0]),
        quatTrack('Chest', [0, 0.25, 0.5, 0.75, 1], [...eq(0, 0.05, 0), ...qi, ...eq(0, -0.05, 0), ...qi, ...eq(0, 0.05, 0)]),
    ]));

    // 3. run
    const rl = 50 * Math.PI / 180, ra = 40 * Math.PI / 180;
    animations.push(new THREE.AnimationClip('run', 0.6, [
        quatTrack('L_Hip', [0, 0.15, 0.3, 0.45, 0.6], [...eq(rl, 0, 0), ...qi, ...eq(-rl, 0, 0), ...qi, ...eq(rl, 0, 0)]),
        quatTrack('R_Hip', [0, 0.15, 0.3, 0.45, 0.6], [...eq(-rl, 0, 0), ...qi, ...eq(rl, 0, 0), ...qi, ...eq(-rl, 0, 0)]),
        quatTrack('L_Knee', [0, 0.15, 0.3, 0.45, 0.6], [...eq(0.1, 0, 0), ...eq(0.8, 0, 0), ...eq(0.1, 0, 0), ...eq(0.3, 0, 0), ...eq(0.1, 0, 0)]),
        quatTrack('R_Knee', [0, 0.15, 0.3, 0.45, 0.6], [...eq(0.1, 0, 0), ...eq(0.3, 0, 0), ...eq(0.1, 0, 0), ...eq(0.8, 0, 0), ...eq(0.1, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.15, 0.3, 0.45, 0.6], [...eq(-ra, 0, 0), ...qi, ...eq(ra, 0, 0), ...qi, ...eq(-ra, 0, 0)]),
        quatTrack('R_Shoulder', [0, 0.15, 0.3, 0.45, 0.6], [...eq(ra, 0, 0), ...qi, ...eq(-ra, 0, 0), ...qi, ...eq(ra, 0, 0)]),
        quatTrack('L_Elbow', [0, 0.15, 0.3, 0.45, 0.6], [...eq(0.6, 0, 0), ...eq(0.3, 0, 0), ...eq(0.6, 0, 0), ...eq(0.9, 0, 0), ...eq(0.6, 0, 0)]),
        quatTrack('R_Elbow', [0, 0.15, 0.3, 0.45, 0.6], [...eq(0.6, 0, 0), ...eq(0.9, 0, 0), ...eq(0.6, 0, 0), ...eq(0.3, 0, 0), ...eq(0.6, 0, 0)]),
        quatTrack('Spine', [0, 0.3, 0.6], [...eq(0.1, 0, 0), ...eq(0.1, 0, 0), ...eq(0.1, 0, 0)]),
        posTrack('Root', [0, 0.15, 0.3, 0.45, 0.6], [0, 0.95, 0, 0, 1.05, 0, 0, 0.95, 0, 0, 1.05, 0, 0, 0.95, 0]),
    ]));

    // 4. sprint
    const sl = 60 * Math.PI / 180, sa = 50 * Math.PI / 180;
    animations.push(new THREE.AnimationClip('sprint', 0.4, [
        quatTrack('L_Hip', [0, 0.1, 0.2, 0.3, 0.4], [...eq(sl, 0, 0), ...qi, ...eq(-sl, 0, 0), ...qi, ...eq(sl, 0, 0)]),
        quatTrack('R_Hip', [0, 0.1, 0.2, 0.3, 0.4], [...eq(-sl, 0, 0), ...qi, ...eq(sl, 0, 0), ...qi, ...eq(-sl, 0, 0)]),
        quatTrack('L_Knee', [0, 0.1, 0.2, 0.3, 0.4], [...eq(0.1, 0, 0), ...eq(1.0, 0, 0), ...eq(0.1, 0, 0), ...eq(0.4, 0, 0), ...eq(0.1, 0, 0)]),
        quatTrack('R_Knee', [0, 0.1, 0.2, 0.3, 0.4], [...eq(0.1, 0, 0), ...eq(0.4, 0, 0), ...eq(0.1, 0, 0), ...eq(1.0, 0, 0), ...eq(0.1, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.1, 0.2, 0.3, 0.4], [...eq(-sa, 0, 0), ...qi, ...eq(sa, 0, 0), ...qi, ...eq(-sa, 0, 0)]),
        quatTrack('R_Shoulder', [0, 0.1, 0.2, 0.3, 0.4], [...eq(sa, 0, 0), ...qi, ...eq(-sa, 0, 0), ...qi, ...eq(sa, 0, 0)]),
        quatTrack('L_Elbow', [0, 0.1, 0.2, 0.3, 0.4], [...eq(0.8, 0, 0), ...eq(0.3, 0, 0), ...eq(0.8, 0, 0), ...eq(1.1, 0, 0), ...eq(0.8, 0, 0)]),
        quatTrack('R_Elbow', [0, 0.1, 0.2, 0.3, 0.4], [...eq(0.8, 0, 0), ...eq(1.1, 0, 0), ...eq(0.8, 0, 0), ...eq(0.3, 0, 0), ...eq(0.8, 0, 0)]),
        quatTrack('Spine', [0, 0.2, 0.4], [...eq(0.15, 0, 0), ...eq(0.15, 0, 0), ...eq(0.15, 0, 0)]),
        posTrack('Root', [0, 0.1, 0.2, 0.3, 0.4], [0, 0.95, 0, 0, 1.08, 0, 0, 0.95, 0, 0, 1.08, 0, 0, 0.95, 0]),
    ]));

    // 5. punch
    animations.push(new THREE.AnimationClip('punch', 0.4, [
        quatTrack('R_Shoulder', [0, 0.1, 0.25, 0.4], [...eq(-0.3, 0, -0.3), ...eq(0.8, 0, 0.2), ...eq(0.8, 0, 0.2), ...qi]),
        quatTrack('R_Elbow', [0, 0.1, 0.25, 0.4], [...eq(-0.6, 0, 0), ...eq(-0.1, 0, 0), ...eq(-0.1, 0, 0), ...qi]),
        quatTrack('Chest', [0, 0.1, 0.25, 0.4], [...eq(0, -0.1, 0), ...eq(0, 0.2, 0), ...eq(0, 0.2, 0), ...qi]),
    ]));

    // 6. jump
    animations.push(new THREE.AnimationClip('jump', 0.6, [
        posTrack('Root', [0, 0.15, 0.3, 0.45, 0.6], [0, 0.85, 0, 0, 0.95, 0, 0, 1.2, 0, 0, 1.1, 0, 0, 0.95, 0]),
        quatTrack('L_Hip', [0, 0.15, 0.3, 0.45, 0.6], [...eq(0.3, 0, 0), ...qi, ...eq(-0.2, 0, 0), ...eq(-0.1, 0, 0), ...qi]),
        quatTrack('R_Hip', [0, 0.15, 0.3, 0.45, 0.6], [...eq(0.3, 0, 0), ...qi, ...eq(-0.2, 0, 0), ...eq(-0.1, 0, 0), ...qi]),
        quatTrack('L_Knee', [0, 0.15, 0.3, 0.45, 0.6], [...eq(0.8, 0, 0), ...eq(0.3, 0, 0), ...qi, ...eq(0.1, 0, 0), ...qi]),
        quatTrack('R_Knee', [0, 0.15, 0.3, 0.45, 0.6], [...eq(0.8, 0, 0), ...eq(0.3, 0, 0), ...qi, ...eq(0.1, 0, 0), ...qi]),
        quatTrack('L_Shoulder', [0, 0.15, 0.3, 0.45, 0.6], [...eq(0.3, 0, 0.3), ...eq(-0.5, 0, -0.3), ...eq(-1.0, 0, -0.3), ...eq(-0.5, 0, 0), ...qi]),
        quatTrack('Spine', [0, 0.15, 0.6], [...eq(0.1, 0, 0), ...qi, ...qi]),
    ]));

    // 7. carjack
    animations.push(new THREE.AnimationClip('carjack', 1.2, [
        quatTrack('L_Shoulder', [0, 0.3, 0.6, 0.9, 1.2], [...qi, ...eq(-0.8, 0, -0.3), ...eq(-1.0, 0, -0.2), ...eq(-0.5, 0, 0), ...qi]),
        quatTrack('R_Shoulder', [0, 0.3, 0.6, 0.9, 1.2], [...qi, ...eq(-0.8, 0, 0.3), ...eq(-1.0, 0, 0.2), ...eq(-0.5, 0, 0), ...qi]),
        quatTrack('L_Elbow', [0, 0.3, 0.6, 0.9, 1.2], [...qi, ...eq(-0.4, 0, 0), ...eq(-0.6, 0, 0), ...eq(-0.2, 0, 0), ...qi]),
        quatTrack('R_Elbow', [0, 0.3, 0.6, 0.9, 1.2], [...qi, ...eq(-0.4, 0, 0), ...eq(-0.6, 0, 0), ...eq(-0.2, 0, 0), ...qi]),
        quatTrack('Chest', [0, 0.3, 0.6, 1.2], [...qi, ...eq(0.1, 0.2, 0), ...eq(0.1, -0.1, 0), ...qi]),
        quatTrack('Spine', [0, 0.6, 1.2], [...qi, ...eq(0.15, 0, 0), ...qi]),
    ]));

    // 8. enter_vehicle
    animations.push(new THREE.AnimationClip('enter_vehicle', 0.8, [
        posTrack('Root', [0, 0.2, 0.5, 0.8], [0, 0.95, 0, 0, 0.80, 0, 0, 0.65, 0, 0, 0.60, 0]),
        quatTrack('L_Hip', [0, 0.4, 0.8], [...qi, ...eq(1.2, 0, 0), ...eq(1.4, 0, 0)]),
        quatTrack('R_Hip', [0, 0.4, 0.8], [...qi, ...eq(1.2, 0, 0), ...eq(1.4, 0, 0)]),
        quatTrack('L_Knee', [0, 0.4, 0.8], [...qi, ...eq(1.0, 0, 0), ...eq(1.2, 0, 0)]),
        quatTrack('R_Knee', [0, 0.4, 0.8], [...qi, ...eq(1.0, 0, 0), ...eq(1.2, 0, 0)]),
        quatTrack('Spine', [0, 0.4, 0.8], [...qi, ...eq(0.2, 0, 0), ...eq(0.3, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.4, 0.8], [...qi, ...eq(0.3, 0, 0.2), ...eq(0.4, 0, 0.3)]),
        quatTrack('R_Shoulder', [0, 0.4, 0.8], [...qi, ...eq(0.3, 0, -0.2), ...eq(0.4, 0, -0.3)]),
    ]));

    // 9. exit_vehicle
    animations.push(new THREE.AnimationClip('exit_vehicle', 0.6, [
        posTrack('Root', [0, 0.3, 0.6], [0, 0.60, 0, 0, 0.80, 0, 0, 0.95, 0]),
        quatTrack('Spine', [0, 0.3, 0.6], [...eq(0.3, 0, 0), ...eq(0.1, 0, 0), ...qi]),
        quatTrack('L_Hip', [0, 0.3, 0.6], [...eq(1.4, 0, 0), ...eq(0.5, 0, 0), ...qi]),
        quatTrack('R_Hip', [0, 0.3, 0.6], [...eq(1.4, 0, 0), ...eq(0.5, 0, 0), ...qi]),
        quatTrack('L_Knee', [0, 0.3, 0.6], [...eq(1.2, 0, 0), ...eq(0.3, 0, 0), ...qi]),
        quatTrack('R_Knee', [0, 0.3, 0.6], [...eq(1.2, 0, 0), ...eq(0.3, 0, 0), ...qi]),
        quatTrack('L_Shoulder', [0, 0.3, 0.6], [...eq(0.4, 0, 0.3), ...eq(0.2, 0, 0.1), ...qi]),
        quatTrack('R_Shoulder', [0, 0.3, 0.6], [...eq(0.4, 0, -0.3), ...eq(0.2, 0, -0.1), ...qi]),
    ]));

    // 10. crouch_idle
    animations.push(new THREE.AnimationClip('crouch_idle', 1, [
        posTrack('Root', [0, 0.5, 1], [0, 0.65, 0, 0, 0.67, 0, 0, 0.65, 0]),
        quatTrack('Spine', [0, 1], [...eq(0.3, 0, 0), ...eq(0.3, 0, 0)]),
        quatTrack('L_Hip', [0, 1], [...eq(0.8, 0, 0), ...eq(0.8, 0, 0)]),
        quatTrack('R_Hip', [0, 1], [...eq(0.8, 0, 0), ...eq(0.8, 0, 0)]),
        quatTrack('L_Knee', [0, 1], [...eq(1.4, 0, 0), ...eq(1.4, 0, 0)]),
        quatTrack('R_Knee', [0, 1], [...eq(1.4, 0, 0), ...eq(1.4, 0, 0)]),
    ]));

    // 11. crouch_walk
    animations.push(new THREE.AnimationClip('crouch_walk', 0.8, [
        posTrack('Root', [0, 0.2, 0.4, 0.6, 0.8], [0, 0.65, 0, 0, 0.68, 0, 0, 0.65, 0, 0, 0.68, 0, 0, 0.65, 0]),
        quatTrack('Spine', [0, 0.8], [...eq(0.3, 0, 0), ...eq(0.3, 0, 0)]),
        quatTrack('L_Hip', [0, 0.2, 0.4, 0.6, 0.8], [...eq(1.0, 0, 0), ...eq(0.6, 0, 0), ...eq(0.8, 0, 0), ...eq(1.0, 0, 0), ...eq(1.0, 0, 0)]),
        quatTrack('R_Hip', [0, 0.2, 0.4, 0.6, 0.8], [...eq(0.8, 0, 0), ...eq(1.0, 0, 0), ...eq(1.0, 0, 0), ...eq(0.6, 0, 0), ...eq(0.8, 0, 0)]),
        quatTrack('L_Knee', [0, 0.2, 0.4, 0.6, 0.8], [...eq(1.2, 0, 0), ...eq(1.5, 0, 0), ...eq(1.2, 0, 0), ...eq(1.0, 0, 0), ...eq(1.2, 0, 0)]),
        quatTrack('R_Knee', [0, 0.2, 0.4, 0.6, 0.8], [...eq(1.2, 0, 0), ...eq(1.0, 0, 0), ...eq(1.2, 0, 0), ...eq(1.5, 0, 0), ...eq(1.2, 0, 0)]),
    ]));

    // 12. aim_pistol
    animations.push(new THREE.AnimationClip('aim_pistol', 0.3, [
        quatTrack('R_Shoulder', [0, 0.3], [...qi, ...eq(-1.4, 0, 0.3)]),
        quatTrack('R_Elbow', [0, 0.3], [...qi, ...eq(0.1, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.3], [...qi, ...eq(-0.3, 0, -0.4)]),
        quatTrack('L_Elbow', [0, 0.3], [...qi, ...eq(-0.3, 0, 0)]),
        quatTrack('Chest', [0, 0.3], [...qi, ...eq(0.05, 0.1, 0)]),
    ]));

    // 13. aim_rifle
    animations.push(new THREE.AnimationClip('aim_rifle', 0.3, [
        quatTrack('R_Shoulder', [0, 0.3], [...qi, ...eq(-1.2, 0, 0.4)]),
        quatTrack('R_Elbow', [0, 0.3], [...qi, ...eq(-0.8, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.3], [...qi, ...eq(-1.2, 0, -0.4)]),
        quatTrack('L_Elbow', [0, 0.3], [...qi, ...eq(-0.6, 0, 0)]),
        quatTrack('Spine', [0, 0.3], [...qi, ...eq(0.05, 0, 0)]),
    ]));

    // 14. fire_pistol
    animations.push(new THREE.AnimationClip('fire_pistol', 0.15, [
        quatTrack('R_Shoulder', [0, 0.05, 0.15], [...eq(-1.4, 0, 0.3), ...eq(-1.3, 0, 0.3), ...eq(-1.4, 0, 0.3)]),
        quatTrack('R_Elbow', [0, 0.05, 0.15], [...eq(0.1, 0, 0), ...eq(0.2, 0, 0), ...eq(0.1, 0, 0)]),
    ]));

    // 15. fire_rifle
    animations.push(new THREE.AnimationClip('fire_rifle', 0.12, [
        quatTrack('R_Shoulder', [0, 0.04, 0.12], [...eq(-1.2, 0, 0.4), ...eq(-1.15, 0, 0.4), ...eq(-1.2, 0, 0.4)]),
        quatTrack('L_Shoulder', [0, 0.04, 0.12], [...eq(-1.2, 0, -0.4), ...eq(-1.15, 0, -0.4), ...eq(-1.2, 0, -0.4)]),
        quatTrack('Spine', [0, 0.04, 0.12], [...eq(0.05, 0, 0), ...eq(0.08, 0, 0), ...eq(0.05, 0, 0)]),
    ]));

    // 16. melee_combo2
    animations.push(new THREE.AnimationClip('melee_combo2', 0.35, [
        quatTrack('L_Shoulder', [0, 0.1, 0.2, 0.35], [...eq(0.3, 0, 0.3), ...eq(-0.8, 0, -0.3), ...eq(-0.8, 0, -0.3), ...qi]),
        quatTrack('L_Elbow', [0, 0.1, 0.2, 0.35], [...eq(-0.6, 0, 0), ...eq(-0.1, 0, 0), ...eq(-0.1, 0, 0), ...qi]),
        quatTrack('Chest', [0, 0.1, 0.2, 0.35], [...eq(0, 0.15, 0), ...eq(0, -0.2, 0), ...eq(0, -0.2, 0), ...qi]),
    ]));

    // 17. melee_combo3 (kick)
    animations.push(new THREE.AnimationClip('melee_combo3', 0.4, [
        quatTrack('R_Hip', [0, 0.12, 0.25, 0.4], [...qi, ...eq(-0.8, 0, 0), ...eq(-1.0, 0, 0), ...qi]),
        quatTrack('R_Knee', [0, 0.12, 0.25, 0.4], [...eq(0.3, 0, 0), ...eq(0.1, 0, 0), ...eq(0.1, 0, 0), ...eq(0.3, 0, 0)]),
        quatTrack('Chest', [0, 0.12, 0.25, 0.4], [...qi, ...eq(-0.1, 0, 0), ...eq(-0.1, 0, 0), ...qi]),
        quatTrack('Spine', [0, 0.12, 0.4], [...qi, ...eq(-0.15, 0, 0), ...qi]),
    ]));

    // 18. melee_bat
    animations.push(new THREE.AnimationClip('melee_bat', 0.5, [
        quatTrack('R_Shoulder', [0, 0.15, 0.3, 0.5], [...eq(-0.3, 0, -0.8), ...eq(-0.3, 0, 1.2), ...eq(-0.3, 0, 1.2), ...qi]),
        quatTrack('R_Elbow', [0, 0.15, 0.3, 0.5], [...eq(-1.0, 0, 0), ...eq(-0.2, 0, 0), ...eq(-0.2, 0, 0), ...qi]),
        quatTrack('Chest', [0, 0.15, 0.3, 0.5], [...eq(0, -0.3, 0), ...eq(0, 0.4, 0), ...eq(0, 0.4, 0), ...qi]),
    ]));

    // 19. melee_knife
    animations.push(new THREE.AnimationClip('melee_knife', 0.3, [
        quatTrack('R_Shoulder', [0, 0.08, 0.2, 0.3], [...eq(-0.3, 0, -0.2), ...eq(-1.0, 0, 0.3), ...eq(-1.0, 0, 0.3), ...qi]),
        quatTrack('R_Elbow', [0, 0.08, 0.2, 0.3], [...eq(-0.8, 0, 0), ...eq(-0.1, 0, 0), ...eq(-0.1, 0, 0), ...qi]),
        quatTrack('Chest', [0, 0.08, 0.2, 0.3], [...eq(0, -0.1, 0), ...eq(0, 0.15, 0), ...eq(0, 0.15, 0), ...qi]),
    ]));

    // 20. fall
    animations.push(new THREE.AnimationClip('fall', 0.5, [
        quatTrack('L_Shoulder', [0, 0.25, 0.5], [...qi, ...eq(-0.5, 0, -1.0), ...eq(-0.3, 0, -1.2)]),
        quatTrack('R_Shoulder', [0, 0.25, 0.5], [...qi, ...eq(-0.5, 0, 1.0), ...eq(-0.3, 0, 1.2)]),
        quatTrack('L_Hip', [0, 0.25, 0.5], [...qi, ...eq(-0.2, 0, 0), ...eq(-0.3, 0, 0)]),
        quatTrack('R_Hip', [0, 0.25, 0.5], [...qi, ...eq(-0.2, 0, 0), ...eq(-0.3, 0, 0)]),
        quatTrack('Spine', [0, 0.25, 0.5], [...qi, ...eq(-0.1, 0, 0), ...eq(-0.15, 0, 0)]),
    ]));

    // 21. land_hard
    animations.push(new THREE.AnimationClip('land_hard', 0.3, [
        posTrack('Root', [0, 0.1, 0.2, 0.3], [0, 0.95, 0, 0, 0.70, 0, 0, 0.80, 0, 0, 0.95, 0]),
        quatTrack('L_Hip', [0, 0.1, 0.3], [...qi, ...eq(0.5, 0, 0), ...qi]),
        quatTrack('R_Hip', [0, 0.1, 0.3], [...qi, ...eq(0.5, 0, 0), ...qi]),
        quatTrack('L_Knee', [0, 0.1, 0.3], [...qi, ...eq(0.8, 0, 0), ...qi]),
        quatTrack('R_Knee', [0, 0.1, 0.3], [...qi, ...eq(0.8, 0, 0), ...qi]),
        quatTrack('Spine', [0, 0.1, 0.3], [...qi, ...eq(0.2, 0, 0), ...qi]),
    ]));

    // 22. hands_up
    animations.push(new THREE.AnimationClip('hands_up', 0.4, [
        quatTrack('L_Shoulder', [0, 0.4], [...qi, ...eq(-2.8, 0, 0)]),
        quatTrack('R_Shoulder', [0, 0.4], [...qi, ...eq(-2.8, 0, 0)]),
        quatTrack('L_Elbow', [0, 0.4], [...qi, ...eq(0.3, 0, 0)]),
        quatTrack('R_Elbow', [0, 0.4], [...qi, ...eq(0.3, 0, 0)]),
    ]));

    // 23. death_front
    animations.push(new THREE.AnimationClip('death_front', 0.8, [
        posTrack('Root', [0, 0.3, 0.6, 0.8], [0, 0.95, 0, 0, 0.70, 0, 0, 0.30, 0, 0, 0.15, 0]),
        quatTrack('Spine', [0, 0.3, 0.8], [...qi, ...eq(0.3, 0, 0), ...eq(1.2, 0, 0)]),
        quatTrack('L_Hip', [0, 0.4, 0.8], [...qi, ...eq(-0.3, 0, 0.2), ...eq(0.2, 0, 0.3)]),
        quatTrack('R_Hip', [0, 0.4, 0.8], [...qi, ...eq(-0.3, 0, -0.2), ...eq(0.2, 0, -0.3)]),
        quatTrack('L_Shoulder', [0, 0.3, 0.8], [...qi, ...eq(-0.5, 0, -0.5), ...eq(0.3, 0, -0.8)]),
        quatTrack('R_Shoulder', [0, 0.3, 0.8], [...qi, ...eq(-0.5, 0, 0.5), ...eq(0.3, 0, 0.8)]),
    ]));

    // 24. death_back
    animations.push(new THREE.AnimationClip('death_back', 0.8, [
        posTrack('Root', [0, 0.3, 0.6, 0.8], [0, 0.95, 0, 0, 0.70, 0, 0, 0.30, 0, 0, 0.15, 0]),
        quatTrack('Spine', [0, 0.3, 0.8], [...qi, ...eq(-0.3, 0, 0), ...eq(-1.2, 0, 0)]),
        quatTrack('L_Hip', [0, 0.4, 0.8], [...qi, ...eq(0.3, 0, 0.2), ...eq(-0.2, 0, 0.3)]),
        quatTrack('R_Hip', [0, 0.4, 0.8], [...qi, ...eq(0.3, 0, -0.2), ...eq(-0.2, 0, -0.3)]),
        quatTrack('L_Shoulder', [0, 0.3, 0.8], [...qi, ...eq(0.5, 0, -0.5), ...eq(-0.3, 0, -1.0)]),
        quatTrack('R_Shoulder', [0, 0.3, 0.8], [...qi, ...eq(0.5, 0, 0.5), ...eq(-0.3, 0, 1.0)]),
    ]));

    // 25. swim_surface
    animations.push(new THREE.AnimationClip('swim_surface', 1.2, [
        quatTrack('Spine', [0, 0.6, 1.2], [...eq(0.4, 0, 0), ...eq(0.4, 0, 0), ...eq(0.4, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.3, 0.6, 0.9, 1.2], [...eq(-2.0, 0, -0.3), ...eq(-1.0, 0, -0.5), ...eq(0.3, 0, -0.3), ...eq(-1.0, 0, -0.5), ...eq(-2.0, 0, -0.3)]),
        quatTrack('R_Shoulder', [0, 0.3, 0.6, 0.9, 1.2], [...eq(0.3, 0, 0.3), ...eq(-1.0, 0, 0.5), ...eq(-2.0, 0, 0.3), ...eq(-1.0, 0, 0.5), ...eq(0.3, 0, 0.3)]),
        quatTrack('L_Elbow', [0, 0.3, 0.6, 0.9, 1.2], [...eq(-0.3, 0, 0), ...eq(-0.8, 0, 0), ...eq(-0.3, 0, 0), ...eq(-0.8, 0, 0), ...eq(-0.3, 0, 0)]),
        quatTrack('R_Elbow', [0, 0.3, 0.6, 0.9, 1.2], [...eq(-0.3, 0, 0), ...eq(-0.8, 0, 0), ...eq(-0.3, 0, 0), ...eq(-0.8, 0, 0), ...eq(-0.3, 0, 0)]),
        quatTrack('L_Hip', [0, 0.3, 0.6, 0.9, 1.2], [...eq(0.3, 0, 0), ...eq(-0.3, 0, 0), ...eq(0.3, 0, 0), ...eq(-0.3, 0, 0), ...eq(0.3, 0, 0)]),
        quatTrack('R_Hip', [0, 0.3, 0.6, 0.9, 1.2], [...eq(-0.3, 0, 0), ...eq(0.3, 0, 0), ...eq(-0.3, 0, 0), ...eq(0.3, 0, 0), ...eq(-0.3, 0, 0)]),
    ]));

    // 26. swim_under
    animations.push(new THREE.AnimationClip('swim_under', 1, [
        quatTrack('Spine', [0, 1], [...eq(1.2, 0, 0), ...eq(1.2, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.25, 0.5, 0.75, 1], [...eq(-2.5, 0, -0.3), ...eq(-1.5, 0, -0.5), ...eq(0, 0, -0.3), ...eq(-1.5, 0, -0.5), ...eq(-2.5, 0, -0.3)]),
        quatTrack('R_Shoulder', [0, 0.25, 0.5, 0.75, 1], [...eq(0, 0, 0.3), ...eq(-1.5, 0, 0.5), ...eq(-2.5, 0, 0.3), ...eq(-1.5, 0, 0.5), ...eq(0, 0, 0.3)]),
        quatTrack('L_Hip', [0, 0.25, 0.5, 0.75, 1], [...eq(0.2, 0, 0), ...eq(-0.2, 0, 0), ...eq(0.2, 0, 0), ...eq(-0.2, 0, 0), ...eq(0.2, 0, 0)]),
        quatTrack('R_Hip', [0, 0.25, 0.5, 0.75, 1], [...eq(-0.2, 0, 0), ...eq(0.2, 0, 0), ...eq(-0.2, 0, 0), ...eq(0.2, 0, 0), ...eq(-0.2, 0, 0)]),
    ]));

    // 27. pulled_from_car
    animations.push(new THREE.AnimationClip('pulled_from_car', 1, [
        posTrack('Root', [0, 0.3, 0.6, 1], [0, 0.60, 0, 0, 0.75, 0, 0, 0.40, 0, 0, 0.15, 0]),
        quatTrack('Spine', [0, 0.3, 0.6, 1], [...eq(0.3, 0, 0), ...eq(-0.2, 0, 0), ...eq(0.4, 0, 0), ...eq(1.0, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.3, 1], [...eq(0.4, 0, 0.3), ...eq(-0.5, 0, -0.5), ...eq(0.3, 0, -0.8)]),
        quatTrack('R_Shoulder', [0, 0.3, 1], [...eq(0.4, 0, -0.3), ...eq(-0.5, 0, 0.5), ...eq(0.3, 0, 0.8)]),
    ]));

    // 28. aimed_at_cower
    animations.push(new THREE.AnimationClip('aimed_at_cower', 0.4, [
        quatTrack('L_Shoulder', [0, 0.4], [...qi, ...eq(-0.8, 0, -0.6)]),
        quatTrack('R_Shoulder', [0, 0.4], [...qi, ...eq(-0.8, 0, 0.6)]),
        quatTrack('Spine', [0, 0.4], [...qi, ...eq(0.3, 0, 0)]),
        quatTrack('L_Knee', [0, 0.4], [...qi, ...eq(0.4, 0, 0)]),
        quatTrack('R_Knee', [0, 0.4], [...qi, ...eq(0.4, 0, 0)]),
    ]));

    // 29. aimed_at_comply
    animations.push(new THREE.AnimationClip('aimed_at_comply', 0.5, [
        posTrack('Root', [0, 0.5], [0, 0.95, 0, 0, 0.55, 0]),
        quatTrack('L_Hip', [0, 0.5], [...qi, ...eq(0.5, 0, 0.3)]),
        quatTrack('R_Hip', [0, 0.5], [...qi, ...eq(0.5, 0, -0.3)]),
        quatTrack('L_Knee', [0, 0.5], [...qi, ...eq(1.2, 0, 0)]),
        quatTrack('R_Knee', [0, 0.5], [...qi, ...eq(1.2, 0, 0)]),
        quatTrack('L_Shoulder', [0, 0.5], [...qi, ...eq(-2.5, 0, 0)]),
        quatTrack('R_Shoulder', [0, 0.5], [...qi, ...eq(-2.5, 0, 0)]),
        quatTrack('L_Elbow', [0, 0.5], [...qi, ...eq(0.5, 0, 0)]),
        quatTrack('R_Elbow', [0, 0.5], [...qi, ...eq(0.5, 0, 0)]),
    ]));

    // 30. phone_talk
    animations.push(new THREE.AnimationClip('phone_talk', 2, [
        quatTrack('R_Shoulder', [0, 2], [...eq(-1.8, 0, 0.2), ...eq(-1.8, 0, 0.2)]),
        quatTrack('R_Elbow', [0, 2], [...eq(-2.2, 0, 0), ...eq(-2.2, 0, 0)]),
        quatTrack('Head', [0, 0.5, 1, 1.5, 2], [...eq(0, 0, 0.1), ...eq(0, 0, -0.05), ...eq(0, 0, 0.1), ...eq(0, 0, -0.05), ...eq(0, 0, 0.1)]),
    ]));

    // 31. sit_bench
    animations.push(new THREE.AnimationClip('sit_bench', 0.5, [
        posTrack('Root', [0, 0.5], [0, 0.95, 0, 0, 0.50, 0]),
        quatTrack('L_Hip', [0, 0.5], [...qi, ...eq(1.5, 0, 0)]),
        quatTrack('R_Hip', [0, 0.5], [...qi, ...eq(1.5, 0, 0)]),
        quatTrack('L_Knee', [0, 0.5], [...qi, ...eq(-1.5, 0, 0)]),
        quatTrack('R_Knee', [0, 0.5], [...qi, ...eq(-1.5, 0, 0)]),
        quatTrack('Spine', [0, 0.5], [...qi, ...eq(-0.1, 0, 0)]),
    ]));

    // 32. lean_wall
    animations.push(new THREE.AnimationClip('lean_wall', 0.3, [
        quatTrack('Spine', [0, 0.3], [...qi, ...eq(-0.1, 0, 0)]),
        quatTrack('L_Hip', [0, 0.3], [...qi, ...eq(0.2, 0, 0)]),
        quatTrack('L_Knee', [0, 0.3], [...qi, ...eq(-0.3, 0, 0)]),
        quatTrack('R_Shoulder', [0, 0.3], [...qi, ...eq(0, 0, 0.3)]),
    ]));

    return animations;
}


// =====================================================================
// GLB EXPORTER
// =====================================================================
async function exportGLB(object, outputPath, animations) {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
    const exporter = new GLTFExporter();

    return new Promise((resolve, reject) => {
        const scene = new THREE.Scene();
        scene.add(object);

        const options = { binary: true };
        if (animations && animations.length > 0) options.animations = animations;

        exporter.parse(scene, async (result) => {
            try {
                let buffer;
                if (result instanceof ArrayBuffer) {
                    buffer = Buffer.from(result);
                } else if (result instanceof Blob || (result && typeof result.arrayBuffer === 'function')) {
                    const ab = await result.arrayBuffer();
                    buffer = Buffer.from(ab);
                } else if (Buffer.isBuffer(result)) {
                    buffer = result;
                } else {
                    // Try JSON (non-binary fallback)
                    buffer = Buffer.from(JSON.stringify(result));
                }
                fs.writeFileSync(outputPath, buffer);
                resolve();
            } catch (e) {
                reject(e);
            }
        }, options);
    });
}


// =====================================================================
// CLI ENTRY POINT
// =====================================================================
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('SVG-to-3D Lofting Tool');
    console.log('Usage: node svg-to-model.js <config.json>');
    console.log('       node svg-to-model.js --test');
    console.log('');
    console.log('Config JSON format:');
    console.log(JSON.stringify({
        name: "character",
        svgFront: "character-front.svg",
        svgSide: "character-side.svg",
        svgTop: "character-top.svg",
        svgHeight: 200,
        svgCenterX: 100,
        scale: 0.01,
        vertsPerRing: 10,
        samplesPerUnit: 40,
        components: [
            { id: "body", frontPath: "body", sidePath: "body", capTop: true, capBottom: true }
        ],
        yRanges: [
            { yMin: 0, yMax: 0.08, color: "0x1a1a1a" },
            { yMin: 0.08, yMax: 0.88, color: "0x3d3024" },
            { yMin: 0.88, yMax: 1.48, color: "0x3366cc" },
            { yMin: 1.48, yMax: 2.0, color: "0xd4a574" }
        ],
        output: "output.glb"
    }, null, 2));
    process.exit(0);
}

if (args[0] === '--test') {
    // Built-in test: generate a bowling pin to verify the pipeline works
    console.log('Running built-in test: bowling pin...');
    runBowlingPinTest();
} else {
    processConfig(args[0]).catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
}


// =====================================================================
// BOWLING PIN TEST
// Simple test shape with clear front/side silhouettes.
// Verifies the full pipeline: SVG parse → sample → loft → export.
// =====================================================================
async function runBowlingPinTest() {
    // Create bowling pin SVGs programmatically
    // SVG coordinate system: 200x200, center at (100, 0), Y-down
    // Pin is symmetric front and side, so same silhouette for both

    // Bowling pin profile: wide bottom, narrow neck, rounded top
    // In SVG coords (Y=0 at top, Y=200 at bottom):
    //   Top of ball: Y=10, width=30
    //   Neck: Y=80, width=12
    //   Belly widest: Y=150, width=40
    //   Base: Y=190, width=35

    const pinPath = `M 80 10 C 78 10 70 20 70 40 C 70 55 88 70 88 80 C 88 90 75 100 72 120 C 68 140 60 155 60 165 C 60 175 62 185 65 190 L 135 190 C 138 185 140 175 140 165 C 140 155 132 140 128 120 C 125 100 112 90 112 80 C 112 70 130 55 130 40 C 130 20 122 10 120 10 Z`;

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path id="body" d="${pinPath}" fill="none" stroke="black"/>
</svg>`;

    // Write temp SVG files
    const tmpDir = path.join(__dirname, 'tmp_test');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const frontSvg = path.join(tmpDir, 'pin-front.svg');
    const sideSvg = path.join(tmpDir, 'pin-side.svg');
    fs.writeFileSync(frontSvg, svgContent);
    fs.writeFileSync(sideSvg, svgContent); // Same for both (symmetric)

    const configPath = path.join(tmpDir, 'pin-config.json');
    const config = {
        name: "bowling_pin",
        svgFront: "pin-front.svg",
        svgSide: "pin-side.svg",
        svgHeight: 200,
        svgCenterX: 100,
        scale: 0.01,
        vertsPerRing: 10,
        samplesPerUnit: 60,
        components: [
            { id: "body", frontPath: "body", sidePath: "body", capTop: true, capBottom: true }
        ],
        yRanges: [
            { yMin: 0, yMax: 0.5, color: "0xeeeeee" },
            { yMin: 0.5, yMax: 1.2, color: "0xcc0000" },
            { yMin: 1.2, yMax: 2.0, color: "0xeeeeee" }
        ],
        output: "../../assets/models/test_bowling_pin.glb"
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    await processConfig(configPath);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });

    console.log('\nBowling pin test complete!');
    console.log('Load the game and check assets/models/test_bowling_pin.glb');
}
