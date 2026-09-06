# 幽境 — 祭殿回廊

Original first-person shrine exploration, with a closed interconnected floor plan, processional hall, sanctum, tatami rooms, storehouses, bell room, lantern chamber and still-water sanctuary. Factory, bathhouse, cistern, sweet-shop and two-storey guest annex areas connect to the shrine. Open-door circulation is tested for connectivity and absence of dead ends.

Controls: DualSense L/R sticks move/look, L1 hold to sprint, R1 toggles flashlight, R2 emits a burst, circle opens/closes a nearby fusuma, and Options opens settings. D-pad navigates settings, cross activates and circle closes the menu. Touch supports simultaneous movement, view drag, sprint, burst and nearby door interaction. Keyboard: WASD, Shift, F; E interacts with doors, Q emits a burst; arrow keys look; P/O opens settings. Double-click canvas or use cursor icon for mouse pointer lock. Esc releases pointer lock.

Twelve silent enemies use sight and hear sprint footsteps through walls. Walls and closed doors block sight, and a 0.65 second sight break ends visual pursuit with a 2 second reacquisition grace period. Enemies investigate remembered locations rather than tracking a hidden walking player. Sprinting is faster than chasing. A burst stuns enemies within 10 meters and unblocked sight for exactly 9 simulation seconds. Holding R2 does not repeatedly trigger a burst. Contact returns the player to the starting hall with a silent fade. Only the player's running footsteps produce audio.

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
public/weathered-concrete.png and public/rusted-steel.png are original generated square albedo textures. Prompts specify photographic scanned weathered grey plaster/concrete with fine pits and subtle damp grime, and corroded dark teal painted industrial steel with rust flakes and fine brushed texture, respectively. Both request seamless orthographic surfaces, neutral uniform diffuse illumination, low contrast, and no objects, text, borders or baked shadows.

Graphics: world-scale texture UVs, bump relief, weather variation, low-intensity environment reflections and HDR multisampled bloom. High quality adds contact occlusion (SSAO) and 2048px flashlight shadows; medium retains bloom and 1024px shadows; low bypasses postprocessing/shadows. Static geometry is split into 24m chunks for frustum culling. Through-wall enemy echoes are rendered separately after postprocessing. GPU appearance and physical controller behaviour still require device verification.


Expansion: enclosed derelict factory, abandoned bathhouse and underground cistern wings join the shrine at multiple entrances. One red danger enemy has 40 m sight and 8 m/s chase speed (player sprint 9.2 m/s); it still loses line of sight and is stunned for nine seconds by R2.

Guest annex: four adjoining ground-floor rooms and two upstairs rooms. Two staircases connect a walkable 4.8 m upper deck. Door selection and collision use the current floor; shared partitions contain one actual opening, and every door is tested from both sides. Enemies use the stairs to investigate sounds upstairs; floors still block sight and burst effects.

Difficulty update: 12 silent enemies; broad sprint hearing (normal 70 m, danger 120 m), last-heard-location investigation, least-visited patrol choices, obstacle routing, and a short delay before alert enemies open doors. Walking and running against a wall do not emit footstep events. Footstep audio is enabled by the first pointer or keyboard interaction; hearing logic is independent of audio availability. The sweet-shop wing has no written signage.

Performance/gameplay polish: immutable door collision snapshots feed an 8m obstacle broad phase; nearest navigation nodes are tested in distance order and repeated footsteps no longer clear routes. Half-resolution AO/bloom retain full-resolution scene geometry and textures. Enemy static costume pieces are merged by material while animated limbs remain separate. Distant geometry beyond opaque fog is culled and remote mirror rendering is skipped. Lantern output reduced from 23 to 10, ambient/reflected fill reduced, flashlight 65 to 46.

Rooms contain 15 jade magatama (including two upstairs); approaching collects them, with floor/line-of-sight checks. Collection survives being caught during the current visit and resets on reload. Five enemy profiles: normal, long-hearing listener (teal ear rings), narrow-long-vision watcher (tall violet hat), faster stalker (low gold claws), and the single red danger enemy. All remain silent and can be outrun or stunned. Touch dash toggles on each tap and resets on menu/focus loss/controller handoff; L1 remains hold-to-sprint.

CPU-only comparison before/after broad-phase/path invalidation changes on the same 180-frame sprint-noise scenario: 430ms vs 15ms for enemy simulation; startup graph construction 564ms vs 65ms. This is a synthetic CPU scenario, not a device FPS or GPU benchmark.

Goal: collecting all 15 magatama unlocks the sealed gate just behind the starting position (x0,z15.5). Return within 5m on the ground floor and its two leaves slide open; stepping into the enclosure triggers victory before enemy capture and freezes gameplay. The goal is separate from ordinary fusuma, so enemies cannot unlock it. HUD shows remaining beads, then bearing/distance; retry via touch/mouse or DualSense Cross reloads the run. New enclosure preserves the east-west corridor at z20.

Patrol/difficulty follow-up: 16 enemies share visited sector destinations with reservations, plus explicit targets for every magatama room and upstairs. Normal patrol opens fusuma after 1.5s and uses stairs without player sound. The bell pedestal is 3.0m wide to restore NPC graph clearance. Actual furnished ground navigation is checked as one connected component. Pursuit speeds: normal6, listener5.4, watcher5.7, stalker7.2, danger8.3m/s (sprint9.2). Detection distances increased. Burst retains9s stun but has a14s simulation-time recharge shown in the HUD; menus do not drain recharge.
