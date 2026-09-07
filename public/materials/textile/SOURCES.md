# Photographed linen

- Asset: [Rough Linen](https://polyhaven.com/a/rough_linen).
- Photography: colormass. Processing: Rico Cilliers.
- License: [CC0](https://polyhaven.com/license).
- Six unmodified official JPG files: diffuse, OpenGL normal and roughness at 1K and 2K. URLs, MD5 hashes and byte sizes are recorded in `rough-linen-files.json`; every download was verified against its official MD5.
- Official measured coverage: 270.7081392676629 by 271.29998803138733 mm. Runtime UVs are in metres; all three maps use the same physical repeat.
- The source is blue linen. The shader retains its luminance structure and dyes it red or ivory; it is not an assertion that the photograph depicts aged tent canvas. Average linear luminance of the 1K source, sampled every fourth pixel: 0.3993317399970887 (65,792 samples). Normal strength is 0.4 and broad wear remains separate from the photographic microstructure.
- Low uses a 256px albedo derivative generated at runtime and does not request normals, roughness or 2K maps. High uses 1K maps; Ultra requests the 2K set lazily. Existing asynchronous quality-switch protection also applies to this material.
- Cloth is restricted to curtains, tent panels and costumes. Painted signs, masks, plates and machinery use separate materials.

Retrieved 2026-09-08. API metadata is retained in `rough-linen-info.json`.
