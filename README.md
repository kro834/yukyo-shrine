# 幽境 — 祭殿回廊

Original first-person shrine exploration, with a closed interconnected floor plan, processional hall, sanctum, tatami room, storehouse, bell room, lantern chamber and still-water sanctuary.

Controls: DualSense L/R sticks move/look, L1 hold to sprint, R1 toggles flashlight, Options opens settings. D-pad navigates settings, cross activates and circle closes. Touch supports simultaneous movement, view drag and sprint. Keyboard: WASD, Shift, F; arrow keys look; P/O opens settings. Double-click canvas or use cursor icon for mouse pointer lock. Esc releases pointer lock.

Controller activity hides cursor/touch controls and ignores emulated mouse look. Actual OS cursor confinement requires browser pointer lock through a user gesture; the website cannot disable global OS or third-party controller mouse emulation outside that lock.

Device-local preferences include sensitivity, FOV, brightness, graphics quality, invert Y and optional motion. Gamepad manual calibration is under Controls. No account, collection or backend storage.

## Local development
Use the generated pnpm toolchain: pnpm dev, pnpm build.
Tests: node --experimental-strip-types --test tests/*.test.ts
Type check: node node_modules/typescript/bin/tsc --noEmit

## Validation scope
Pure input tests cover DualSense mapping, R1 rising-edge toggles, L1, simultaneous touch, controller-emulated pointer suppression, disconnects and settings validation. Geometry tests cover connectivity and closed wall collision, including sprinting at every external wall.
No physical DualSense, Safari device or browser visual QA has been performed in this environment. The optional feature-detected WebMCP settings and flashlight tools were not verified in a supported WebMCP context; no such context was available.

## Design provenance
Spatial inspiration only: https://www.spaceonigirigames.com/shadowcorridor2
The map, geometry, UI and fixtures are original. No game assets, branding, map or audio is reused.
public/cedar.png is a single original generated material texture.

