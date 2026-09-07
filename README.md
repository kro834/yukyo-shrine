# 幽境 — 祭殿回廊

An original, silent-enemy first-person horror game. The screen stays fixed during exploration. Three connected storeys sit above a seeded, shuffled 5 by 5 ground-floor layout with87 chambers,30 additional room themes and shrine, alley, sweet-shop, cave, field, factory, bathhouse and cistern sectors. Geometry and navigation share occupancy data; doors and stairs use matching-floor collision.

## Objectives and final pursuit

Collect and offer **six blue OR two red OR one gold magatama**. Partial offerings accumulate. The compass points to the randomly located altar; the gate behind it opens after the offering and crossing the gate completes the stage.

As soon as held plus offered beads satisfy any route, all12 ordinary enemies disappear. Exactly one randomly chosen **憎悪 (Hatred)** or **憤怒 (Wrath)** spawns22–38m away where possible. It always pursues the player's current position, including other floors, but still routes around physical walls and uses stairs. Hatred moves at6.4m/s; Wrath varies between5.4–7.6m/s. Player sprint remains faster. R2 stun and L2 time stop also affect the final pursuer. The transition grants two additional consumable mirror charges once.

Capture restores the ordinary roster, empties held/offered beads and mirrors, clears transient threat state and revives the player at another safe ground-floor location. The warning meter reflects live chase or nearby investigation; carried beads affect difficulty but do not permanently fill this meter.

## Modes and stages

Choose **祭殿回廊 (Shrine)**, **深淵 (Abyss)**, **外縁 (Outer Reach)** or **オーケストラ・ツー (Orchestra Two)** from the initial screen, then start with Gallery, Normal or Hard. Every stage is available immediately, with no clear or unlock requirement. Gallery provides safe sightseeing with no active enemies. After clearing, select another stage or regenerate the same one. A stage change recreates the world and input lifecycle while retaining preferences.

Abyss has lower cave ceilings, damp dark surfaces, fewer inter-sector links and longer enemy searches. Outer Reach emphasizes open fenced fields, moonlit sky, alleys and shops, with wider detection and faster pursuit. Both preserve all bead routes and tested ground navigation.

Outer Reach also contains eight exclusive nostalgic interiors, placed in eight separate random sectors without replacing the original30 themes: 終電の去った木造駅, 夕暮れの廃校舎, 閉館した銀映館, 祭りのあとの縁日, 雨待ちの旧旅籠, 忘れ湯の浴場, 宛先のない郵便局 and 夕凪の蓄音室. Low timber ceilings, corner wall linings, shaded lamps and distinct furniture establish their identities. Room IDs, bead routes and altar selection are preserved; furnishings leave the offset entrance cross clear.

Six outdoor sectors now have different returning route plans: 月見の土手, 水際の遊歩道, 終電後の高架下, 団地裏の緑道, 旧水門の管理道 and 夕暮れの農道. Walking crests stay at the navigation floor while actual banks descend0.65–2.2m to water or dry ground. Continuous slopes, shared edge normals and triangle-sampled vegetation prevent visible gaps and floating grass. Optional dead-end stubs are trimmed; protected room/upper-floor connections receive alternate routes. Every field keeps its room entrances.

Weathered bus shelters, concrete underpass bays, floodgate machinery and residential service alleys occupy selected straight paths. Bench slats, roof ribs, drains, cable trays, meters, condensers and railings are modeled without text. Their real solid footprints preserve a1.6m central walking strip; perpendicular junctions, doors and stairs remain open. Structures above4.45m avoid upper-floor footprints. Placement and collision use the same final seeded grid.

The civic kits are authored at their final4m width, preserving round pipe sections,76mm shelter posts and460mm bench seats. Equipment feet and drainage grates meet the ground; the world owns the walking surface, avoiding overlapping slabs and visible striping. Vertical concrete has its own wall photograph, while metal cabinets retain paint or enamel. A20-seed audit of116,726 adjacent edges found no new passage blockage from these kits.

Orchestra Two is a dark Gothic music complex: black stone walls, pointed arches, blind tracery windows, wooden sliding doors and sparse warm fixtures. Four exclusive rooms contain a pipe organ, abandoned string instruments, a closed curtained stage and old clocks. It retains the three-floor layout, all objective routes and the existing controls, with longer enemy searches and reduced ambient light. Dedicated rooms occupy four separate sectors and leave stair volumes and door approaches clear.

Selected chambers contain CC0 scanned wooden chairs, stools and ceramic vases with shared local instancing, conservative collision bounds and soft contact shading. Scans load asynchronously with fitted local fallbacks; Low disables normal and ARM sampling, while higher settings restore material detail. Sources and licenses are recorded in `public/models/SOURCES.md`. Recessed fusuma panels, dished pulls and Gothic oak panels preserve the original sliding envelope. Stage changes dispose model textures, geometry and door instance buffers.

Ordinary room and door paper uses a restrained aged-wallpaper photograph, and tatami uses a measured straw-mat photograph with separate cloth edging and whole0.9×1.8m mats. All three maps share the same cropped UVs; mat crowns remain within the prior finished-floor height. Low retains256px albedo for these fine patterns while omitting their relief maps. The flashlight sits slightly below and to the right of the eye and its lower intensity preserves surface highlights.

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

Narrow passages have recessed plaster/shoji, individual waist boards, timber returns and ceiling joinery within the navigation envelope. Suspended lamps fit below the ceiling. Continuous photographic board crops avoid artificial joints on posts; prominent timber edges are chamfered with indexed geometry. The six special enemies wear layered clothing shaped around shoulders, chest and waist, with obi, cuffs, articulated fingers and grounded split-toe footwear. Sculpted masks and skin gain local, distance-filtered surface detail on High and Ultra; normalized linen reflectance preserves the distinction between pale and dark clothing at every quality.

Desktop High and Ultra use one nearby hanging fixture's downward shadow, with stable ownership and a fade before changing fixtures. Static rooms reuse the shadow atlas; nearby moving enemies, doors, collectibles and the opening goal refresh it. Mobile, Low and Medium omit this additional shadow pass.

Lanterns use fitted curved shades, caps and bamboo ribs. Continuous, distance-filtered transmission varies the emission itself, preserving paper detail without seams on curved surfaces. Emissive materials retain consistent intensity across quality changes; bloom halos are restrained. Recreated effects explicitly release their high-pass materials. Unowned shadow fixtures remain hidden until their depth atlas can be initialized, avoiding discarded PCF draws in unlit areas.

The internal glow follows the shade's lower and upper caps instead of repeating with the texture. A nearby flashlight retains the paper's warm gradient, and close halos fade without changing room-light intensity or the user's exposure setting.

Caves use continuous vaulted surfaces, outward weathered wall relief, sealed floor seams and lantern suspension matched to the actual ceiling. Field tiles share slight ground relief and exact edges; grass roots follow the rendered triangles. Curved opaque grasses sit in patches, with taller plants behind exterior fences and outside walkable cells. High and Ultra blend matched albedo/normal/roughness offsets to soften repeated rock and earth textures. Lower settings omit this shader; mobile cave tessellation and distance-capped foliage limit added geometry.

Low omits relief maps, shadows and postprocessing; phones start on Low. Medium retains bloom and shadows. High uses1K PBR detail and contact occlusion. Ultra lazily loads2K maps for four major surfaces,32-sample AO, higher flashlight shadows and reflection targets. Rendering resolution adapts within device pixel budgets; mobile omits planar reflections. Static geometry is batched in24m chunks, spatially culled, and enemy parts are merged while animated joints remain independent.

See [MATERIALS.md](MATERIALS.md) and bundled provenance JSON for official CC0 material sources. This is realtime graphics with remaining geometric simplifications; photographic equivalence is not claimed.

## Development and verification

- `pnpm dev` starts the local site; `pnpm build` produces the static client.
- `node --test tests/*.test.ts` runs the regression suite (Node24 used).
- `node node_modules/typescript/bin/tsc --noEmit` checks types.

Tests cover input transitions, concurrent touch actions, slider sensitivity, cursor state policy, all objective routes, furnished connectivity, stairs, door interaction, rendering resource/texture lifetimes, final pursuit transitions,32 real-ramp pursuit cases, mirror grants and reset, and threat/freeze/stun reliability.

Installed Chrome visual and interaction QA covers desktop and an emulated iPhone viewport. Stage-selection and final-pursuit UI fixtures are exercised separately from actual collection/capture simulations. Physical DualSense, iOS Safari and low-end hardware performance remain untested in this environment.

Spatial inspiration: https://www.spaceonigirigames.com/shadowcorridor2 . Maps, rigs, UI and fixtures are original; no game branding, map, screenshot or audio is redistributed.
