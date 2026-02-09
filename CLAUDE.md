# San Claudio — Claude Code Reference

## Local Dev Server

The game is a static site (no build step). Serve from the project root:

```bash
python3 -m http.server 8080
# Then open http://localhost:8080
```

The game loads Three.js, GLTFLoader, SkeletonUtils, and BufferGeometryUtils from CDN.
Physics (Rapier WASM) is loaded from `cdn.skypack.dev`. If CDNs are unavailable (e.g. sandboxed
environments), copy deps to a `vendor/` directory and swap the `<script>` tags in `index.html`
plus add an import map for Rapier (see "Offline Testing" below).

## Built-in Dev Tools / QA Framework

The game has a massive embedded test suite in `js/devtools.js` (1,133 lines):

- **Backtick (`)** opens the dev console
- **F1** toggles debug overlay (position, district, FPS, draw calls, triangles, weather, etc.)
- **F2** toggles collision wireframe
- **F4** cycles weather
- **F5 / F9** quick save / quick load

### Console Commands
`god`, `heal`, `hesoyam`, `give weapons`, `give money [amt]`, `spawn [type]`,
`wanted [0-5]`, `tp [place]`, `time [0-24]`, `weather [type]`, `speed [x]`,
`mission [1-15]`, `complete`, `ragdoll`, `explode`, `noclip`, `fps`, `wireframe`,
`stats`, `killall`, `reset`, `testsuite [id]`, `reportbug [desc]`, `endtest`, `copyresults`

### Test Suites
Run `testsuite all` (or `physics`, `trees`, `map`, `general`) in the dev console.
45+ suites, 300+ tests covering physics, NPCs, vehicles, weapons, weather, missions, etc.

## Key Architecture for Testing

- **Global game object**: `window.game`
- **Player model**: `window.game.systems.player.model` (NOT `.mesh`)
- **Player position**: `window.game.systems.player.position` (THREE.Vector3, separate from model)
- **NPC array**: `window.game.systems.npcs.pedestrians` (NOT `.npcs`)
- **Current weapon**: `window.game.systems.player.getCurrentWeapon().id`
- **Timescale**: `window.game.timeScale` (already built-in, no need to inject)
- **Game state**: `window.game.state` — one of `loading`, `title`, `playing`, `paused`, `cutscene`, `dead`, `map`, `mission_complete`

## Offline / Sandboxed Testing

When CDNs are unreachable, use local vendor files:

```bash
npm install three@0.128.0 @dimforge/rapier3d-compat
mkdir -p vendor
cp node_modules/three/build/three.min.js vendor/
cp node_modules/three/examples/js/loaders/GLTFLoader.js vendor/
cp node_modules/three/examples/js/utils/SkeletonUtils.js vendor/
cp node_modules/three/examples/js/utils/BufferGeometryUtils.js vendor/
cp node_modules/@dimforge/rapier3d-compat/rapier.mjs vendor/rapier3d-compat.mjs
cp node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm vendor/
```

Then in `index.html`, replace CDN `<script>` tags with `vendor/` paths and add:
```html
<script type="importmap">{"imports":{"https://cdn.skypack.dev/@dimforge/rapier3d-compat":"./vendor/rapier3d-compat.mjs"}}</script>
```

## Playwright MCP Config

`.mcp.json` is configured for `@playwright/mcp@latest` with `--headless --no-sandbox`.
If the MCP server's bundled Playwright version needs a newer Chromium than what's installed,
use `--executable-path /path/to/chrome` to force the pre-installed browser.

## Bugs Found & Fixed

### 1. `steerAmount` not defined — `vehicles.js:1246`

**Problem**: `steerAmount` was declared as `const` inside two block-scoped branches
(drift at line 1178, normal steering at line 1204) but referenced at line 1246
outside both blocks for the Rapier angular velocity calculation. This caused a
`ReferenceError` every frame when any NPC vehicle was driving.

**Fix**: Declared `let steerAmount = 0;` before the if/else block (line 1167) and
changed both branch declarations from `const` to assignment.

### 2. `veh` TDZ error — `ui.js:176`

**Problem**: `const veh = this.game.systems.vehicles` was declared at line 212 but
used at line 176 (speed display logic). JavaScript's Temporal Dead Zone (TDZ) makes
`const`/`let` variables inaccessible before their declaration, causing
`ReferenceError: Cannot access 'veh' before initialization` every frame.

**Fix**: Moved `const veh = this.game.systems.vehicles` to the top of `updateHUD()`
(line 144) and removed the duplicate declaration at the original location.
