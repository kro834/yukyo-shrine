# 幽境 — 祭殿回廊

Original first-person shrine exploration, with a closed interconnected floor plan, processional hall, sanctum, tatami room, storehouse, bell room, lantern chamber and still-water sanctuary. The expanded plan has 957 floor cells, interlocking circulation loops, six additional furnished rooms and twelve sliding fusuma doors. Every added room has two doors. Open-door circulation is tested for connectivity and absence of dead ends.

Controls: DualSense L/R sticks move/look, L1 hold to sprint, R1 toggles flashlight, R2 emits a burst, cross opens/closes a nearby fusuma, and Options opens settings. D-pad navigates settings, cross activates and circle closes the menu. Touch supports simultaneous movement, view drag, sprint, burst and nearby door interaction. Keyboard: WASD, Shift, F; E interacts with doors, Q emits a burst; arrow keys look; P/O opens settings. Double-click canvas or use cursor icon for mouse pointer lock. Esc releases pointer lock.

Four silent patrolling enemies use sight only. Walls and closed doors block sight, and a 0.65 second sight break ends pursuit with a 2 second reacquisition grace period. Sprinting is faster than chasing. A burst stuns enemies within 10 meters and unblocked sight for exactly 9 simulation seconds. Holding R2 does not repeatedly trigger a burst. Contact returns the player to the starting hall with a silent fade. No audio is created or played.

The cursor is hidden outside settings, independently of controller detection. Controller activity hides touch controls and ignores emulated mouse look. Closing settings requests pointer lock again and defers canvas focus until after the dialog closes. Actual OS cursor confinement requires browser pointer lock through a user gesture; the website cannot disable global OS or third-party controller mouse emulation outside that lock.

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


Expansion: enclosed derelict factory, abandoned bathhouse and underground cistern wings join the shrine at multiple entrances. One red danger enemy has 32 m sight and 8 m/s chase speed (player sprint 9.2 m/s); it still loses line of sight and is stunned for nine seconds by R2.
