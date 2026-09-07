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
