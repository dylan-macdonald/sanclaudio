# Known Bugs - San Claudio

This is a living reference of bugs encountered and fixed during development.

## Fixed
- **[input]**: Touch joystick Y-axis must be negated ONCE in the merge logic, not per-frame, to prevent oscillation.
- **[input]**: Gamepad Y-axis (axes[1]) negated once during polling, not in the action mapping, to match W=forward=+moveY convention.
- **[vehicles]**: Vehicle enter/exit uses single `justPressed('interact')` check to prevent double-fire on the same frame.
- **[vehicles]**: Vehicle acceleration reads BOTH actions.accel/brake AND joystick moveY axis to support all input methods.
- **[renderer]**: No variable named `renderer` in any module — always use `this.game.renderer` to avoid shadowing the Three.js WebGLRenderer.
- **[geometry]**: No use of `THREE.CapsuleGeometry` (doesn't exist in r128). Player and NPCs built with cylinders + spheres.
- **[geometry]**: No use of `THREE.OrbitControls` — camera follow implemented manually with lerp.
- **[audio]**: All Web Audio API calls wrapped in try/catch to handle browsers where AudioContext fails silently.
- **[performance]**: devicePixelRatio capped at 2 to prevent mobile performance issues.

## Known Issues
- Radio stations are placeholder (procedural music not yet fully implemented).
- NPC pathfinding is basic (random walk + building avoidance, no true sidewalk following).
- Ragdoll spring constraints are approximate — limbs may occasionally stretch.
