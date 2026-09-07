# 幽境 — 祭殿回廊

An original, silent-enemy first-person horror game. The screen stays fixed during exploration. Three connected storeys sit above a seeded, shuffled 5 by 5 ground-floor layout with87 chambers,30 additional room themes and shrine, alley, sweet-shop, cave, field, factory, bathhouse and cistern sectors. Geometry and navigation share occupancy data; doors and stairs use matching-floor collision.

## Objectives and final pursuit

Collect and offer **six blue OR two red OR one gold magatama**. Partial offerings accumulate. The compass points to the randomly located altar; the gate behind it opens after the offering and crossing the gate completes the stage.

As soon as held plus offered beads satisfy any route, all12 ordinary enemies disappear. Exactly one randomly chosen **憎悪 (Hatred)** or **憤怒 (Wrath)** spawns22–38m away where possible. It always pursues the player's current position, including other floors, but still routes around physical walls and uses stairs. Hatred moves at6.4m/s; Wrath varies between5.4–7.6m/s. Player sprint remains faster. R2 stun and L2 time stop also affect the final pursuer. The transition grants two additional consumable mirror charges once.

Capture restores the ordinary roster, empties held/offered beads and mirrors, clears transient threat state and revives the player at another safe ground-floor location. The warning meter reflects live chase or nearby investigation; carried beads affect difficulty but do not permanently fill this meter.

## Modes and stages

Start with Gallery, Normal or Hard. Gallery provides safe sightseeing with no active enemies. Clearing a stage unlocks the choice of **深淵 (Abyss)** or **外縁 (Outer Reach)**, or a new seed for the same stage. A stage change recreates the world and input lifecycle while retaining preferences.

Abyss has lower cave ceilings, damp dark surfaces, fewer inter-sector links and longer enemy searches. Outer Reach emphasizes open fenced fields, moonlit sky, alleys and shops, with wider detection and faster pursuit. Both preserve all bead routes and tested ground navigation.

## Controls

| Action | DualSense | Keyboard / touch |
| --- | --- | --- |
| Move / look | L / R sticks | WASD / mouse or arrows; multitouch pads and view dragging |
| Sprint | Hold L1 | Hold Shift; touch dash toggles |
| Flashlight | R1 | F / light button |
| Fusuma / altar | Circle | E / nearby Circle action |
| Forward burst | R2 | Q / burst button |
| Time stop | L2 | T / time-stop button |
| Consumable mirror | Square | V / mirror button |
| Settings | Options | P or O / settings button |

Burst affects visible enemy bodies within10m and the forward120-degree cone for9 simulation seconds, with14s recharge. Time stop lasts10s with30s recharge. A mirror reveals enemies for12s, consumes one charge and cannot stack while active. Normal enemies are hidden behind walls unless a mirror is active. Running emits footsteps and attracts investigation of the last heard location; normal enemies do not detect dark, quiet walking. Breaking sight ends normal visual pursuit after0.65s with reacquisition grace. The final pursuer intentionally ignores these stealth acquisition rules.

Four additional ordinary profiles have distinct rigs and behaviour: **泥這い** detects flashlight illumination from a low stance, **鐘守** investigates distant running and searches several branches, **狐面の影** approaches a visible target from the side, and **枯枝の巡礼** alternates a visible wind-up, fast rush and recovery. All enemy movement remains silent.

Controller use hides touch controls and suppresses emulated mouse look. The cursor stays hidden during play and is visible in settings. Actual OS confinement relies on browser pointer lock through a user gesture; a site cannot disable an external desktop controller-to-mouse mapper outside that lock. Touch supports moving while toggling dash/light and using abilities. Optional stamina is off by default.

## Rendering

Photographic local PBR textures, scale-correct timber UVs, aged plaster, tatami fibres, washi and worn metal complement original geometry. Layered alley storefronts use wood, shutters, short curtains, eaves, utility fittings, gutters and irregular damp pavement. No reference-game images or text signs are embedded in the world.

Low omits relief maps, shadows and postprocessing; phones start on Low. Medium retains bloom and shadows. High uses1K PBR detail and contact occlusion. Ultra lazily loads2K maps for four major surfaces,32-sample AO, higher flashlight shadows and reflection targets. Rendering resolution adapts within device pixel budgets; mobile omits planar reflections. Static geometry is batched in24m chunks, spatially culled, and enemy parts are merged while animated joints remain independent.

See [MATERIALS.md](MATERIALS.md) and bundled provenance JSON for official CC0 material sources. This is realtime graphics with remaining geometric simplifications; photographic equivalence is not claimed.

## Development and verification

- `pnpm dev` starts the local site; `pnpm build` produces the static client.
- `node --test tests/*.test.ts` runs the145-test suite (Node24 used).
- `node node_modules/typescript/bin/tsc --noEmit` checks types.

Tests cover input transitions, concurrent touch actions, slider sensitivity, cursor state policy, all objective routes, furnished connectivity, stairs, door interaction, rendering resource/texture lifetimes, final pursuit transitions,32 real-ramp pursuit cases, mirror grants and reset, and threat/freeze/stun reliability.

Installed Chrome visual and interaction QA covers desktop and an emulated iPhone viewport. Stage-selection and final-pursuit UI fixtures are exercised separately from actual collection/capture simulations. Physical DualSense, iOS Safari and low-end hardware performance remain untested in this environment.

Spatial inspiration: https://www.spaceonigirigames.com/shadowcorridor2 . Maps, rigs, UI and fixtures are original; no game branding, map, screenshot or audio is redistributed.
