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

### Asset Generation & GLB Models

**All 3D models are generated as `.glb` files** via `tools/model-generator.js`. Run:
```bash
cd tools && npm install && node model-generator.js
```

This generates all models to `assets/models/`:

| Model | File | Size | Description |
|-------|------|------|-------------|
| Character | character.glb | 72 KB | Skinned mesh, 16-bone skeleton, vertex colors, walk/run/idle animations |
| Sedan | sedan.glb | 41 KB | Car with named wheel parts |
| Sports | sports.glb | 46 KB | Sports car with spoiler |
| Truck | truck.glb | 29 KB | Cab + cargo bed |
| Motorcycle | motorcycle.glb | 25 KB | Frame, engine, forks |
| Boat | boat.glb | 13 KB | Hull, cabin, motor |
| Police | police.glb | 43 KB | Sedan variant with lightbar |
| Bat | weapon_bat.glb | 9 KB | Wood shaft, grip tape, knob |
| Knife | weapon_knife.glb | 10 KB | Blade, guard, handle, pommel |
| Pistol | weapon_pistol.glb | 13 KB | Slide, barrel, grip, sights |
| SMG | weapon_smg.glb | 13 KB | Body, shroud, magazine, foregrip |
| Shotgun | weapon_shotgun.glb | 14 KB | Barrel, pump, receiver, wood stock |
| Rifle | weapon_rifle.glb | 17 KB | Barrel, handguard, magazine, carry handle |
| Sniper | weapon_sniper.glb | 28 KB | Long barrel, scope+lens, bolt, bipod, wood stock |
| Grenade | weapon_grenade.glb | 25 KB | Sphere body, ridges, spoon, pin ring |
| Atomizer | weapon_atomizer.glb | 34 KB | Cylinder body, emitter sphere, energy coils |

**Model loading priority**: GLB first → procedural fallback. Both `vehicles.js` and `weapons.js`
check `models.hasModel()` before falling back to `_createFallbackVehicleMesh()` or procedural geometry.

**Other procedural assets** (NOT GLB — generated at runtime):
- **Buildings**: Box geometry with randomized width/depth/height per district, window UV patterns
- **Trees**: Instanced cone/sphere/cylinder with per-instance HSL variation
- **Props**: Instanced geometry for lamps, benches, dumpsters, traffic lights, etc.
- **Terrain**: Flat ground plane with road network overlay
- **Water**: Blue plane at y=0 for dock/port areas

### Weapon Model System

Weapons attach to the player's R_Hand bone (GLTF) or `parts.rightHand` (fallback).
Key files: `weapons.js:createWeaponModel()`, `player.js:_updateHeldWeapon()`.

- Weapon mesh swaps automatically when `currentWeaponIndex` changes
- Fists = no model (mesh removed)
- Hidden when player is in vehicle (`_currentWeaponMesh.visible = false`)
- GLB models are 3x scale relative to bone space

### Clothing / Appearance System

Two systems for changing player appearance:

1. **Clothing Shops** (`interiors.js:36-40`, `ui.js:1136-1310`): Color pickers for shirt/pants,
   toggles for hat/sunglasses. Costs money. Stores: Binco Downtown, SubUrban Strip, Victim Docks.
2. **Wardrobe** (`player.js:1165`): 8 preset outfits, accessed via C key in owned properties.

Both systems sync to `player.appearance` and persist via save/load.

**GLTF vertex color mapping** (character.glb):
- Shirt `0x4466aa` → R_Shoulder, L_Shoulder, R_Elbow, L_Elbow, R_Hip, L_Hip (120 verts)
- Pants `0x333344` → Root, L_Knee, R_Knee, L_Foot, R_Foot, L_Hand, R_Hand (96 verts)
- Shoes `0x222222` → L_Foot, R_Foot only (48 verts, filtered by foot bone)
- Skin `0xd4a574`, Hair `0x221100` — not modified by clothing

`applyAppearance()` modifies vertex colors via `_applyAppearanceToGLTF()`.
Hat/sunglasses attach to the Head bone.

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

### 11. `Infinity` lost on save/load — `save.js:85`

**Problem**: `JSON.stringify(Infinity)` produces `null`. After a save/load cycle, the
fists weapon's `ammo` and `clipSize` changed from `Infinity` to `null`, breaking melee
combat (ammo checks fail, `ammo--` produces `NaN`).

**Fix**: Added `.map()` in the load path to restore `null` back to `Infinity`:
`ammo: w.ammo === null ? Infinity : w.ammo`.

### 12. Rampage weapons never restored — `missions.js:1967`

**Problem**: `_startRampage()` saved the player's original weapons and index but
`_cleanupRampage()` never restored them. After any rampage, the temporary weapon
persisted permanently.

**Fix**: Added weapon/index restoration from `_rampageOrigWeapons`/`_rampageOrigIndex`
at the top of `_cleanupRampage()`.

### 13. Rampage enemies never despawned — `missions.js:1967`

**Problem**: When a rampage ended (pass or fail), the spawned hostile enemies remained
alive in the game world permanently, causing ongoing unintended combat.

**Fix**: Added enemy cleanup loop in `_cleanupRampage()` that sets `health = 0` and
`alive = false` on all rampage enemies.

### 14. Assassination marker removed from wrong parent — `missions.js:867`

**Problem**: The assassination target marker was added as a child of `npc.mesh`, but
on target kill, `this.game.scene.remove(sm.targetMarker)` tried to remove it from
the scene (wrong parent). The marker silently persisted in the scene graph.

**Fix**: Changed to `sm.targetMarker.parent.remove(sm.targetMarker)`.

### 15. Side mission cleanup misses assassination markers — `missions.js:1997`

**Problem**: `_cleanupSideMission()` handled race checkpoints and delivery markers but
not assassination target markers. Failed assassination missions left orphaned markers.

**Fix**: Added assassination target marker cleanup at the end of `_cleanupSideMission()`.

### 16. Main mission waypoint persists after complete/fail — `missions.js:444,487`

**Problem**: `completeMission()` and `failMission()` never cleared `ui.waypoint`,
leaving a stale waypoint on the minimap after missions ended.

**Fix**: Added `this.game.systems.ui.waypoint = null` to both methods.

### 17. Save/load guards too cautious — `save.js:126,129`

**Problem**: `rampageCompleted` and `sfCompleted` restore was guarded by
`missions.X !== undefined`, which could fail if `load()` ran before full init.

**Fix**: Removed the `!== undefined` guard — always restore if data exists.

### 18. No kill plane — `player.js:update()`

**Problem**: Player could fall infinitely below the map with no recovery. Tested at
y:-162 and still falling. Also affected players in vehicles and swimming states.

**Fix**: Added kill plane check at top of `update()` (before any early returns for
swimming/vehicle/noclip). If `position.y < -50`, resets position to (0, 2, 0), applies
30 fall damage, force-exits vehicles and clears swimming state.

### 19. No out-of-bounds respawn — `player.js:update()`

**Problem**: Teleporting beyond map bounds (e.g. 500, 500) caused player to fall through
void. The water detection marked the area as swimming, so the on-foot bounds check never
ran (swimming returns early).

**Fix**: Added bounds clamp at top of `update()` (before swimming/vehicle checks). Clamps
position to `±(mapSize/2 - 5)` = ±395. Updates model position immediately.

### 20. NPC spawn cap not enforced — `npcs.js:spawnPedestrian()`

**Problem**: `spawnPedestrian()` had no internal cap. Event spawns (accidents, robberies)
could push count past `maxPedestrians + 5`.

**Fix**: Added guard at top of `spawnPedestrian(forceSpawn)`. Returns `null` if
`pedestrians.length >= maxPedestrians + 5` unless `forceSpawn = true`. Event spawns
use `forceSpawn = true` to bypass the cap for scripted NPCs.

### 21. Death state not triggered by direct health=0 — `player.js:update()`

**Problem**: Setting `player.health = 0` via console or external code didn't trigger
death. Only `takeDamage()` called `die()`.

**Fix**: Added health check at top of `update()`: if `health <= 0 && !isDead`, sets
health to 0 and calls `die()`.

### 22. Negative damage increases health — `player.js:takeDamage()`

**Problem**: `takeDamage(-50)` subtracted negative damage, adding 50 health. Health
could exceed `maxHealth` with no cap.

**Fix**: Added `if (amount <= 0) return;` guard at top of `takeDamage()`.

### 23. Race checkpoint out-of-bounds access — `missions.js:_updateRace()`

**Problem**: If `_completeSideMission()` didn't clear `activeSideMission` before the
next frame, `sm.checkpoints[sm.currentCheckpoint]` could be `undefined`, causing a
TypeError on `.x` / `.z` access.

**Fix**: Added `if (!cp) return;` guard after checkpoint lookup.

## Known Issues (Not Yet Fixed)

- **Audio untestable in headless**: All 31 audio methods exist but cannot be verified
  without a headed browser
