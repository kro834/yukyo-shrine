# 幽境 / YUKYO

DualSense・タッチ・キーボードに対応した、一人称視点のブラウザホラーゲームです。ランダム生成の三層構造を探索し、勾玉を集めて祭壇からの脱出を目指します。敵のいないギャラリーモード、ノーマル、ハード、最高難度の悪夢を選択できます。各ステージには物語を綴る手記が隠され、クリアするとS〜Dの評価と記録が残ります。

**[ブラウザでプレイ](https://kro834.github.io/yukyo-shrine/)**

## 自動公開

`main` へのpush・PRのマージ直後に、GitHub Actionsが自動公開を開始します。回帰テストを3分割し、型検査・ビルドと並列で実行して、すべて成功した内容をGitHub Pagesへ公開します。定期実行の待ち時間はありませんが、検証・ビルド・配信には数分かかります。PCやCodexの起動、公開依頼、個人のアクセストークン設定は不要です。失敗した場合は以前の公開版が残り、GitHubの「Actions」で原因を確認できます。

連続して更新された場合は、古いビルド・テストを中止して最新の変更を優先します。公開直前にも `main` の最新コミットか確認し、古い版による上書きを防ぎます。すでに始まった配信処理だけは最後まで完了させます。公開済みの変更はページの再読み込みで利用できます（プレイ中のゲームを強制再起動しません）。

公開処理は `.github/workflows/pages.yml` で管理しています。GitHub Pages用のビルドでは `NEXT_PUBLIC_BASE_PATH=/yukyo-shrine` を設定し、`pnpm build` の後に `node scripts/prepare-pages.mjs` を実行します。通常の `pnpm dev` は引き続きルートURLで動作します。

## はじめに

Node.js 24 と pnpm を用意し、次のコマンドで起動します。

```sh
git clone https://github.com/kro834/yukyo-shrine.git
cd yukyo-shrine
pnpm install --frozen-lockfile
pnpm dev
```

起動時に表示されるローカルURLをブラウザで開いてください。`pnpm build` の静的クライアント出力先は `dist/client` です。

| ステージ | 舞台 |
| --- | --- |
| 祭殿回廊 | 灯りの残る和風回廊と、忘れられた街 |
| 深淵 | 低い岩盤、埋没した横丁、地下水槽 |
| 外縁 | 月下のあぜ道、廃駅、廃校舎 |
| オーケストラ・ツー | ゴシック建築の暗い音楽堂 |
| 夜廻りサーカス | トロッコと可動装置のある大天幕 |
| エラー | 二種類の能面の敵が巡る異常な能舞台 |
| パラレルワールド | 空中の渡り場、家、庭園がつながる街 |
| 霧嶺 | 霧の高山、廃坑、高速トロッコ |
| ウルトラリアル | 三階を結ぶエレベーターと多様な客室を備えた陰鬱なホテル |

## 夜刻アップデート（コアループ刷新）

- **気配**：見つかる・見つからないの二択ではなく、敵の注意が段階的に高まります。灯りを点けていると距離に応じて気づかれ、消灯していても至近距離で「動けば」気配を悟られます。立ち止まる・しゃがむ・遮蔽物で切る、が対策です。気づかれかけた敵は立ち止まり、首をこちらへ傾けます。
- **夜刻の鐘**：線香が燃え尽きるごとに鐘が鳴ります。12秒前に余韻が響き、そのとき立っていた場所へ影が集まります。鐘が鳴るたび夜が深まり（宵→夜半→丑三つ時）、眠っていた影が目覚め、青い回廊の安全が薄れます。祭壇への奉納は夜を祓って鐘を遠ざけ、鐘を凌げばバーストが再充填され道具を授かります。
- **眠る影**：開始時、何体かの影は壁を向いて立ち尽くしています。鐘か、至近での動き、走る足音、鈴、バーストで目覚めます。
- **奉納は残る・落とし物**：捕まっても祭壇への奉納は失われません。持っていた勾玉は捕まった場所に落ち、近くの影が見張ります。拾い直すか、別の勾玉を探すかの選択になります。
- **道具（鈴・御札）**：タッチパッド/↑ または R で使用、L3 または 1・2 で持ち替え。鈴は投げた先へ近くの影を二体まで誘います。御札は足元に置き、追ってくる影だけを縛ります。
- **前兆と封門の儀**：条件が揃うと鐘が三つ鳴り、祭壇の反対側に追跡者が現れます。奉納後は祭壇の輪の中で8秒耐える儀式が始まり、輪の中では追跡者の速さがダッシュを超えません。
- **今宵の兆し**：同じステージ・モードの二回目以降は、夜ごとに兆し（新月・静寂・長夜・雨夜・丑の刻参り）が引かれ、鐘や影の数、聴力が変わります。評価にも倍率が付きます。
- **余剰奉納**：封門が開いた後も、余った勾玉を祭壇に捧げると点になります。

## 本格化アップデート

- **しゃがみ**：△ / R3 / C キー / タッチボタン。移動は半分の速さになり、灯りを点けていても通常の敵に見つかる距離が短くなります。ダッシュ操作で立ち上がります。
- **手記と記録帳**：各ステージに浮かぶ巻物が三つ。拾った手記はタイトル画面の「記録帳」に残り、縦書きで読めます。
- **評価と記録**：クリア時に探索時間・復活回数・追跡回避・手記から得点とS〜Dの評価を算出し、ステージとモードごとの最速時間と最高評価を保存します。
- **悪夢**：敵の感覚・速度・捜索が最も鋭く、スタミナは常に有効。祭壇の針は灯りを消している間だけ現れます。
- **音響**：環境音、警戒度と連動する心音、床材ごとの足音、各種効果音をすべてブラウザ内で合成します（外部音源なし）。敵は従来どおり無音です。
- **画面**：タイトル画面、ステージ詳細と記録、一時停止メニュー（目的・やり直し・タイトルへ）、目的表示、ステージ導入演出、捕獲演出、フィルムグレイン。

`app/` にゲームと描画処理、`public/` に配信素材、`tests/` に回帰テスト、`assets/blender/` と `scripts/` にモデル制作関連のファイルがあります。素材の出典は [MATERIALS.md](MATERIALS.md)、[モデルの出典](public/models/SOURCES.md)、[ホテル素材の出典](public/models/hotel/SOURCES.md) を参照してください。

以下はゲーム仕様と実装の詳細です。ステージ固有の移動速度・敵・仕掛けには、それぞれ専用の調整があります。

An original, silent-enemy first-person horror game. The screen stays fixed during exploration. Three connected storeys sit above a seeded, shuffled 5 by 5 ground-floor layout with87 chambers,30 additional room themes and shrine, alley, sweet-shop, cave, field, factory, bathhouse and cistern sectors. Geometry and navigation share occupancy data; doors and stairs use matching-floor collision.

## Objectives and final pursuit

Collect and offer **six blue OR two red OR one gold magatama**. Partial offerings accumulate. The compass points to the randomly located altar; the gate behind it opens after the offering and crossing the gate completes the stage.

As soon as held plus offered beads satisfy any route, all12 ordinary enemies disappear. Exactly one randomly chosen **憎悪 (Hatred)** or **憤怒 (Wrath)** spawns22–38m away where possible. It always pursues the player's current position, including other floors, but still routes around physical walls and uses stairs. Hatred moves at6.4m/s; Wrath varies between5.4–7.6m/s. Player sprint remains faster. R2 stun and L2 time stop also affect the final pursuer. The transition grants two additional consumable mirror charges once.

Capture restores the ordinary roster, empties held/offered beads and mirrors, clears transient threat state and revives the player at another safe ground-floor location. The warning meter reflects live chase or nearby investigation; carried beads affect difficulty but do not permanently fill this meter.

## Modes and stages

Choose any of the nine stages listed above from the initial screen, then start with Gallery, Normal, Hard or Nightmare. Nightmare raises enemy sensing, speed and search beyond Hard, always limits sprinting and shows the altar needle only while the flashlight is off. Every stage is available immediately, with no clear or unlock requirement. Gallery provides safe sightseeing with no active enemies. After clearing, select another stage or regenerate the same one. A stage change recreates the world and input lifecycle while retaining preferences.

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
| Crouch | Triangle or R3 | C / crouch button |
| Pause menu and settings | Options | P or O / settings button |

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

## Night clock, noticing, sleepers, tools and the rite

Enemies.notice gives each ordinary enemy a 0–1 alert gauge. A lit or running visitor fills it over about 1.2 s at the edge of sight (faster up close, instant inside nearSight or when running within 12 m); a moving visitor in the dark fills it within 2.4 m (normal) scaled per enemy kind, halved behind the enemy. Crouching slows both fills. Between 0.35 and 1 the enemy halts and turns toward the visitor; if the gauge decays below 0.2 the enemy searches the last suspected point for 8 s. The final pursuers ignore the gauge. Gallery uses NOTICE_OFF, which reproduces the previous instant rule.

The night clock (app/night-clock.ts) burns an incense fraction on live time (150/130/110 s per toll for normal/hard/nightmare) plus 0.10 per blue and 0.25 per red pickup. Twelve seconds before a toll a warning snapshots the visitor's position; at the toll 2/3/4 hunters converge on nodes within 12 m of that snapshot, a batch of sleepers wakes (never within 20 m or in view), blue-area multipliers lerp toward 1 (0.40 → 0.55 → 0.73) and fog thickens. Offering purifies 0.15 per blue and 0.40 per red. Surviving the 35 s hunt without a chase refills burst and grants a tool. Capture adds 0.6 and holds warnings for 25 s. The clock stops when the finale begins.

Sleepers are chosen per seed (5/4/3 by mode, never the gold guardian, at least one awake actor per storey). Capture keeps offerings and the open gate, drops held beads in a 0.35 m ring at the capture point (snapped to a nav node on ramps) and sends the nearest regular enemy to search there for 40 s; a second capture scatters the previous bundle home. The finale re-arms 12 s after a respawn.

Items (app/item-bag.ts): bells (cap 3) and wards (cap 2), four pickups per map, +1 ward at the finale. A thrown bell flies at 13 m/s with gravity, stops at walls, and when it lands the two nearest same-floor patrollers within clamp(0.3×hearing, 10, 45) m investigate for max(14, d/3.6+6) s; thrown during a time stop it rings when time resumes. A ward arms in 0.6 s and stuns only a chasing enemy that crosses within 1.3 m (6 s, or 2.5 s for a final pursuer followed by 8 s of immunity).

The finale opens with a 6 s omen during which the pursuer stands motionless, spawned preferably on the far side from the altar. The unlocking offering starts an 8 s rite accrued on live time within 7 m of the altar; inside that ring the pursuer's speed is scaled so it stays below the sprint speed (hatred ×0.6, wrath ×0.459). Omens (app/run-omens.ts) are drawn per seed after the first run of a stage and mode; 丑の刻参り unlocks after a ranked clear. Scoring adds survived tolls (+150 each, cap 5), a phase bonus (宵 +600, 夜半 +250) and surplus offerings (blue +200, red +500, cap 1200), multiplied by the omen.

## Presentation, sound and progression

A title screen leads to stage selection with per-stage records. The pause menu shows the current objective and run statistics, offers restart (a new seed, same mode) or return to title behind a second confirming press, and hosts the document, view, graphics, sound and control settings. Starting a stage plays a letterboxed prologue; capture shows a brief red-black sequence before waking elsewhere.

Crouching halves walking pace and lowers the eye to 1.02m. Ordinary enemies see a crouched visitor over 60% of their usual range and aim their line of sight at the lowered body; the final pursuer ignores posture. Any sprint request stands the visitor up.

Each stage hides three documents (27 in total) on reachable patrol points: two on the ground floor and one upstairs, at least 48m apart where possible and clear of the spawn, altar, magatama and mirrors. Placement uses its own seeded stream, so magatama, mirror and finale choices for a seed are unchanged. Found documents persist in `localStorage` (`yukyo-archive-v1`).

A clear scores exploration time (full value within ten minutes, none after forty), a deathless bonus or capture penalty, escapes and documents, multiplied by 1.2 on Hard and 1.5 on Nightmare. S needs 6000 points. Best time, score and rank per stage and mode persist in `yukyo-records-v1`; Gallery walks count as clears without a rank.

All audio is synthesized with Web Audio after the first user gesture, and nothing is downloaded. Stage beds combine detuned drones, gusting filtered noise and stage layers (rain, hum, shimmer), plus sparse events such as creaks, drips, insects, bells, a music box or noh drums. The heartbeat follows the on-screen threat meter; footsteps depend on the surface; time stop and menus muffle the bed. Enemies remain silent. Master, ambience and effect volumes are stored with the other preferences.

The UI font subsets were rebuilt as v66 from the recorded Noto sources to cover the new copy.

## Development and verification

- `pnpm dev` starts the local site; `pnpm build` produces the static client.
- `node --experimental-transform-types --test tests/*.test.ts` runs the regression suite (Node24 used). Type transformation is required on Node 22 and 24 because several modules use TypeScript parameter properties.
- `node node_modules/typescript/bin/tsc --noEmit` checks types.

Tests cover input transitions, concurrent touch actions, slider sensitivity, cursor state policy, all objective routes, furnished connectivity, stairs, door interaction, rendering resource/texture lifetimes, final pursuit transitions,32 real-ramp pursuit cases, mirror grants and reset, and threat/freeze/stun reliability.

Installed Chrome visual and interaction QA covers desktop and an emulated iPhone viewport. Stage-selection and final-pursuit UI fixtures are exercised separately from actual collection/capture simulations. Physical DualSense, iOS Safari and low-end hardware performance remain untested in this environment.

Spatial inspiration: https://www.spaceonigirigames.com/shadowcorridor2 . Maps, rigs, UI and fixtures are original; no game branding, map, screenshot or audio is redistributed.

## Night Circus

The fifth initially selectable stage, 夜廻りサーカス, retains the seeded5×5 sectors,87 rooms and three floors. A rounded254m rail loop connects four stations in the central big top. Circle (keyboard E, or the contextual touch button) calls an empty cart or boards the waiting cart. It accelerates to7m/s, stops for people on the track and automatically dismounts at the next station's clear exit. Camera look, light and combat abilities remain usable. Menus pause the ride; L2 freezes it with the world. Capture/restart releases the rider and resets apparatus.

Four optional mechanisms add alternative tactics: sliding curtain,90° rotating concealment wall, hinged stage bridge and a lure that sends enemies to its activation location. Devices wait while someone occupies the moving part's sweep. Rendered and collidable geometry use the same dimensions, and enemies route around closed mechanisms while retaining ordinary door interaction. Stable static collision indices are shared with the small changing mechanism groups.

Twenty continuous red/ivory canopy panels cover the big top, with low interior screens preserving standing-eye concealment. Recessed room props distinguish dressing rooms, costume stores, workshops, spectator seating, trunks, carnival booths, mirrors and dining rooms. Weathered fabric and photographic timber are batched and distance culled; apparatus adds42 meshes and3380 triangles. No text is added to the3D environment.
