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

## Game Architecture

### System Overview

The game is a GTA-style 3D open-world browser game. All code is vanilla JS (no build step).
The entry point is `js/main.js` which creates the `Game` class. All subsystems live under
`window.game.systems`:

| System | File | Methods | Description |
|--------|------|---------|-------------|
| `models` | models.js | 5 | GLTF model loading, character cloning, animations |
| `physics` | physics.js | 16 | Rapier WASM physics — collisions, raycasts, vehicle bodies |
| `input` | input.js | 8 | Keyboard, mouse, gamepad, touch input |
| `world` | world.js | 57 | Terrain, buildings, roads, props, trees, lamps, weather visuals, water |
| `player` | player.js | 39 | Player movement, swimming, vehicle interaction, weapons, animations |
| `camera` | camera.js | 6 | Third-person camera with vehicle/on-foot modes, building collision |
| `vehicles` | vehicles.js | 49 | Vehicle spawning, driving physics, damage, headlights, taxi/vigilante/stunt systems |
| `weapons` | weapons.js | 31 | Weapon defs, shops, pickups, projectiles, melee combos, grenade arcs |
| `npcs` | npcs.js | 23 | Pedestrians, traffic, dialogue, reactions, population density |
| `ragdoll` | ragdoll.js | 5 | Spring-constraint ragdoll physics |
| `wanted` | wanted.js | 26 | Star system, police units, roadblocks, spike strips, Pay N Spray, bribe stars, escape zones |
| `interiors` | interiors.js | 18 | Safehouse, bank, warehouse, club, garage interiors; properties; clothing stores |
| `ui` | ui.js | 30 | HUD, minimap, full map, weapon wheel, mission text |
| `audio` | audio.js | 31 | Web Audio API — gunshots, explosions, ambience, Animalese voices, radio |
| `missions` | missions.js | 46 | 15 story missions, side missions (race/assassination/delivery), Strangers & Freaks |
| `cutscenes` | cutscenes.js | 10 | Dialogue sequences, camera rails, letterboxing, typewriter text |
| `save` | save.js | 4 | localStorage save/load/clear |
| `devtools` | devtools.js | 18 | Console, debug overlay, test suites, bug reporting |

### Top-Level Game Properties

Key properties on `window.game` (NOT inside `.systems`):

- `state` — `loading`, `title`, `playing`, `paused`, `cutscene`, `dead`, `map`, `mission_complete`
- `timeOfDay` — float, real-time clock (accumulates, NOT 0-24 range — wraps via dayDuration)
- `dayDuration` — seconds per in-game day
- `currentWeather` / `targetWeather` — `clear`, `overcast`, `rain`, `fog`, `storm`
- `weatherTransition` — float 0-1 for blending
- `timeScale` — game speed multiplier
- `deltaTime` — frame delta (already scaled by timeScale)
- `renderer`, `scene`, `skyDome`, `sunMesh`, `moonMesh`, `clouds`, `stars`
- `sunLight`, `hemiLight`, `fillLight`, `rimLight`, `ambientLight`
- `stats` — gameplay statistics object (distanceWalked, vehiclesStolen, etc.)

### Districts (9 total)

| District | Approx Center | Notable |
|----------|--------------|---------|
| Downtown | (0, 0) | Starting area, safehouse |
| Hillside | (-200, -200) | Trees, Tinfoil Ted NPC |
| The Strip | (200, -200) | Entertainment district |
| The Docks | (-200, 200) | Waterfront, boats |
| Industrial Park | (200, 200) | Factories |
| North Shore | (0, -300) | Northern coast |
| West End | (-300, 0) | Western residential |
| Eastgate | (300, 0) | Eastern district |
| Portside | (0, 300) | Southern port |

### Vehicle Types

33 vehicles total: 18 sedan, 3 sports, 5 truck, 3 boat, 2 motorcycle, 2 helicopter.

### Weapon Definitions

| ID | Type | Damage | Range | Clip |
|----|------|--------|-------|------|
| fists | melee | 10 | 2 | Inf |
| bat | melee | 25 | 2.5 | Inf |
| knife | melee | 35 | 1.8 | Inf |
| pistol | ranged | 20 | 60 | 17 |
| smg | ranged | 12 | 40 | 30 |
| shotgun | ranged | 15 | 15 | 8 |
| rifle | ranged | 30 | 100 | 30 |
| sniper | ranged | 100 | 200 | 5 |
| grenade | thrown | 80 | 8 | 10 |
| atomizer | special | 30 | 50 | 20 |

### Asset Generation

All assets are procedurally generated at runtime — no external model files required:

- **Buildings**: Box geometry with randomized width/depth/height per district, window UV patterns
- **Trees**: Cone + cylinder geometry with color/size/rotation variety
- **Vehicles**: Fallback box-based meshes with wheels (`_createFallbackVehicleMesh`)
- **Characters**: Fallback box-limb models (`_createFallbackModel`, `_createFallbackNPCModel`)
- **Props**: Instanced geometry for lamps, benches, dumpsters, traffic lights, etc.
- **Terrain**: Flat ground plane with road network overlay
- **Water**: Blue plane at y=0 for dock/port areas

The model system (`models.js`) can load GLTF if available, but falls back to procedural.

### Key Code Patterns

- **Update loop** (`main.js:854-939`): input → world → player → vehicles → physics → npcs →
  ragdoll → weapons → wanted → interiors → ui → audio → missions → camera → devtools
- **Weather**: Managed in `main.js` (updateWeather), visual effects in `world.js` (updateWeather)
- **Day/night**: `main.js:updateDayNight()` — sun position, light colors, sky dome tint
- **Building data**: `world.buildings[]` = `{ x, z, width, depth, height, yOffset, district }`
  (NOT Three.js meshes — raw data objects)
- **NPC pedestrians**: `npcs.pedestrians[]` = `{ mesh, alive, health, speed, walkDir, walkTimer,
  isFleeing, fleeTarget, dialogueCooldown, isMale, district, idleBehavior, ... }`
- **Collision**: Rapier physics bodies for player (capsule), vehicles (box), buildings (static cuboid)

## Built-in Dev Tools / QA Framework

The game has a massive embedded test suite in `js/devtools.js`:

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

**IMPORTANT**: When the test suite is active (`testSuiteActive = true`), `executeCommand()`
intercepts ALL input as ratings/feedback. To call game commands during testing, use the
underlying system APIs directly (e.g. `window.game.systems.wanted.setLevel(3)`) instead
of `executeCommand('wanted 3')`.

### Test Suites
61 suites, 203 tests. Run `testsuite all` in the dev console.
Tests are **manual QA** — each presents an instruction and waits for a 1-10 rating + feedback.
Use `startTestSuiteAll()` directly: `window.game.systems.devtools.startTestSuiteAll()`

## Key Architecture for Testing

- **Global game object**: `window.game`
- **Player model**: `window.game.systems.player.model` (NOT `.mesh`)
- **Player position**: `window.game.systems.player.position` (THREE.Vector3, separate from model)
- **NPC array**: `window.game.systems.npcs.pedestrians` (NOT `.npcs`)
- **Current weapon**: `window.game.systems.player.getCurrentWeapon().id`
- **Timescale**: `window.game.timeScale` (already built-in, no need to inject)
- **Game state**: `window.game.state`
- **Weather**: `window.game.currentWeather` / `window.game.targetWeather` (NOT a system)
- **Time of day**: `window.game.timeOfDay` (accumulating float, not clamped 0-24)
- **Wanted level**: `window.game.systems.wanted.setLevel(n)` / `.clearWanted()`
- **Save**: `window.game.systems.save.save()` (NOT `.saveGame()`)
- **Vehicle types**: `window.game.systems.vehicles.vehicles[i].type`
- **Mission defs**: `window.game.systems.missions.missionDefs` (NOT `.missions`)

## Playwright MCP Testing

### Configuration

`.mcp.json` is configured for `@playwright/mcp@latest` with `--headless --no-sandbox`.
Run `npx playwright install chromium` if the browser isn't installed.

### Headless Limitations

- **No pointer lock**: Camera orbit/look doesn't work. Player faces fixed direction.
- **Screenshot timeout**: Default 5s too short for WebGL canvas. Use `timeout: 30000`.
- **Console captures input**: Close dev console before WASD movement (blur activeElement
  or `toggleConsole()`).
- **Canvas click hangs**: `page.click('canvas')` times out. Use `page.evaluate(() =>
  document.getElementById('game-canvas').focus())` instead.

### Methodology

1. Start dev server: `python3 -m http.server 8080 &`
2. Navigate to `http://localhost:8080`, press Enter to start game
3. Use `page.evaluate()` to call game APIs directly (bypass console interception)
4. Use `browser_run_code` for multi-step sequences with `page.waitForTimeout()`
5. Screenshots via `page.screenshot({ path, type: 'png', timeout: 30000 })`
6. Read screenshots with the Read tool for visual inspection

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
used at line 176 (speed display logic). JavaScript's TDZ makes `const`/`let` variables
inaccessible before their declaration.

**Fix**: Moved `const veh = this.game.systems.vehicles` to the top of `updateHUD()`
(line 144) and removed the duplicate declaration.

### 3. Double projectile removal crash — `weapons.js:954/962`

**Problem**: In `updateProjectiles()`, when a projectile hits an NPC AND exceeds max
range in the same frame, `removeProjectile(i)` is called twice. The second call accesses
`this.projectiles[i]` which is now either `undefined` or a different projectile after
the first splice, causing `TypeError: Cannot read properties of undefined (reading 'mesh')`.

**Fix**: Added `let removed = false` flag before the NPC loop. Set `removed = true` on
hit. Guard the max-range check with `if (!removed && ...)`.

### 4. Empty helicopter exit block — `vehicles.js:2071`

**Problem**: The helicopter altitude exit check `if (input.justPressed('interact') &&
vehicle._altitude < 3)` had an empty body. Meanwhile, `player.updateInVehicle()`
unconditionally called `exitVehicle()` on E press, allowing exit at any altitude.

**Fix**: Added `this.game.systems.player.exitVehicle()` inside the helicopter block.
Added `&& this.currentVehicle.type !== 'helicopter'` guard to the generic exit in
`player.js:555`.

### 5. `showNPCDialogue` not a function — `npcs.js` (6 occurrences)

**Problem**: NPC reaction methods (`reactToGunfire`, `reactToExplosion`, `reactToStunt`)
called `this.showNPCDialogue()` which doesn't exist. The correct method is
`this.showNPCSubtitle()`.

**Fix**: Replaced all 6 occurrences of `showNPCDialogue` with `showNPCSubtitle`.

### 6. District name mismatches — `npcs.js`

**Problem**: Lookup maps used `'Docks'`, `'Industrial'`, `'East Side'` but
`world.getDistrictName()` returns `'The Docks'`, `'Industrial Park'`, `'Eastgate'`.
This caused district-specific population, dialogue, time modifiers, and clothing
palettes to silently fall back to defaults for those 3 districts.

**Fix**: Updated all map keys: `'Docks'`→`'The Docks'`, `'Industrial'`→`'Industrial Park'`,
`'East Side'`→`'Eastgate'`.

### 7. Full map never draws mission markers — `ui.js:611`

**Problem**: Code checked `missions.missions` (doesn't exist) instead of
`missions.missionDefs`. Also used `m.completed`/`m.location` instead of
`missions.completedMissions.has(m.id)`/`m.markerPos`.

**Fix**: Changed to `missions.missionDefs`, `missions.completedMissions.has(m.id)`,
and `m.markerPos`.

### 8. `saveGame()` not a function — `interiors.js:425`

**Problem**: Property rest auto-save called `this.game.systems.save.saveGame()` but
the method is `save()`. Crashed every time player rested at an owned property.

**Fix**: Changed to `this.game.systems.save.save()`.

### 9. `transitioning` soft-lock — `interiors.js:601`

**Problem**: `enterInterior()` set `this.transitioning = true` before the guard clause
`if (!interior) return`. If the guard triggered, `transitioning` stayed `true` forever,
disabling all door interactions.

**Fix**: Moved guard clause before `this.transitioning = true`.

### 10. Teleport coordinates swapped — `devtools.js:617`

**Problem**: `tp docks` teleported to (200, 200) which is Industrial Park. `tp industrial`
teleported to (-200, 200) which is The Docks. Coordinates were swapped.

**Fix**: Swapped: `docks: { x: -200, z: 200 }`, `industrial: { x: 200, z: 200 }`.

## Known Issues (Not Yet Fixed)

- **No kill plane**: Player can fall infinitely below the map (tested at y:-162 and still falling)
- **No out-of-bounds respawn**: Teleporting to (500, 500) just falls through void
- **NPC spawn cap not enforced**: `spawnPedestrian()` can exceed `maxPedestrians`
- **Death state not triggered by direct health=0**: Setting `player.health = 0` doesn't
  trigger death state — needs to go through `takeDamage()` system
- **Audio untestable in headless**: All 31 audio methods exist but cannot be verified
  without a headed browser
