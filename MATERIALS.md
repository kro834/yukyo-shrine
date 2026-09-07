# Material provenance

The following photographic PBR texture sets are Poly Haven assets released under CC0. Albedo uses sRGB; OpenGL tangent-space normal and roughness maps are linear data. Original1K JPGs are bundled locally, with no runtime dependency on Poly Haven. High graphics loads normal/roughness on demand; Low uses128px albedo and no relief maps.

| Local prefix | Original asset | Approximate tile size |
| --- | --- | --- |
| public/materials/wood_planks | https://polyhaven.com/a/wood_planks |1.5m |
| public/materials/rock_face_03 | https://polyhaven.com/a/rock_face_03 |2.7m |
| public/materials/clay_plaster | https://polyhaven.com/a/clay_plaster |2m |

Each set includes `_diff.jpg`, `_nor_gl.jpg`, and `_rough.jpg`.

License: https://polyhaven.com/license (CC0)
Technical conventions: https://docs.polyhaven.com/en/technical-standards/textures
Retrieved2026-09-07 from the official dl.polyhaven.org1K texture collection.

`public/horror-hemp.png` and `public/earthen-plaster.png` are original generated material studies for this project. The hemp is used for enemy robes. Earlier generated cedar, concrete and rust materials remain on beams and industrial fittings; no reference-game screenshots are distributed as game assets.

## Additional surface sets

| Local prefix | Official CC0 source | Tile size |
| --- | --- | --- |
| public/materials/rust_coarse_01 | https://polyhaven.com/a/rust_coarse_01 | 2.2m |
| public/materials/cobblestone_floor_001 | https://polyhaven.com/a/cobblestone_floor_001 | 2.4m |
| public/materials/concrete_floor_worn_001 | https://polyhaven.com/a/concrete_floor_worn_001 | 3m |

Each contains1K diffuse, OpenGL normal and roughness JPGs. Retrieved2026-09-07. The fully oxidized rust is a dielectric (metalness0), as in the source glTF; exposed steel remains a separate surface. Stone pavement and planks retain restrained material variation on High. Tatami reeds, washi fibres, lacquer wear and glazed-tile joints use scale-correct procedural shading; these extra shaders are disabled on Low and Medium.

## Mapping and contact detail

Curved fixtures retain their native continuous UVs, scaled to circumference and length. Cedar is cropped to a single board on slim timber and its grain follows each member before batching; photographic floorboards run along the floor's Z axis at the documented1.5m repeat. Legacy timber room overlays now use the same photographic floor material.

High uses half-resolution16-sample contact occlusion with metre-based depth limits (18mm–550mm), a nine-tap depth/normal-aware blur, and restrained strength. Transparent overlays and reflections are excluded from the normal pass. This replaces the existing AO pass rather than adding a scene render. Low allocates no post-processing pipeline. These are implementation and automated-test results; GPU appearance still requires visual verification.

## Ultra and outer stage

Ultra lazily loads 2048px diffuse, OpenGL normal and roughness maps for `wood_planks`, `clay_plaster`, `rust_coarse_01`, and `cobblestone_floor_001`. These 12 official CC0 JPGs total 30,257,397 bytes; source URLs, authors and verified MD5 hashes are retained in `public/materials/ultra/provenance.json`. High retains the 1K maps and Low does not request these detail maps. Ultra uses 32-sample contact occlusion at three-quarter resolution, up to4096px flashlight shadows, and a1024px reflection target. Multisampling is recalculated after rendering resolution changes. Phones retain their pixel budget and omit planar reflections.

The outer stage uses the official CC0 [Qwantani Moonrise PureSky](https://polyhaven.com/a/qwantani_moonrise_puresky) 1K HDR by Greg Zaal and Jarod Guest, plus Rob Tuytel's [Grass Path2](https://polyhaven.com/a/grass_path_2) 1K albedo/normal/roughness at a1m repeat. The four files total3,156,026 bytes. Verified metadata is in `public/materials/outer/provenance.json`. HDR brightness is reduced for the night setting; it is not requested on Low.

Visual QA in installed Chrome covered High wall shading, the Ultra storefront, cave and outdoor field, and desktop/mobile settings. This found and corrected discontinuities in the procedural noise, overbright flashlight highlights, and excessive sky exposure. The result is an improved realtime rendering, not a claim of photographic equivalence or physical-device performance.
