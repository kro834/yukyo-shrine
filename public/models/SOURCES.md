# Scanned props v25 — source and license record

Retrieved from Poly Haven's official public API on 2026-09-08. All three assets are distributed by Poly Haven under CC0 1.0. Poly Haven states that its assets may be used commercially, redistributed, and used without attribution: https://polyhaven.com/license

The saved `polyhaven-info.json` and `polyhaven-files-1k-gltf.json` files are API snapshots from `https://api.polyhaven.com/info/{id}` and `https://api.polyhaven.com/files/{id}`. The latter records every exact dependency URL, byte size, and upstream MD5.

## Wooden Chair 01 (recommended hero prop)

- Asset ID: `WoodenChair_01`
- Source: https://polyhaven.com/a/WoodenChair_01
- Author: Jake Mobley
- License: CC0 1.0
- Description/provenance: worn Victorian Gothic wooden chair with pointed tracery and carved detail; Poly Haven original/donated work per its asset license page
- Physical dimensions from API: 0.688 x 0.658 x 2.274 m
- Download format: glTF 2.0 (`.gltf` + external `.bin` + JPEG textures), 1K
- Entry URL: https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/WoodenChair_01/WoodenChair_01_1k.gltf
- Exact mesh count measured from glTF index accessors: 19,992 triangles, 1 primitive/draw call, 1 material
- Texture maps: 1024px diffuse/base color, OpenGL tangent-space normal, packed ARM (R=ambient occlusion, G=roughness, B=metallic)
- Saved transfer size: 1,079,531 bytes (1.03 MiB)
- Visual content check: no text, lettering, or logos visible in the diffuse texture

## Chinese Stool

- Asset ID: `chinese_stool`
- Source: https://polyhaven.com/a/chinese_stool
- Author: Kirill Sannikov
- License: CC0 1.0
- Description/provenance: worn traditional Asian wooden stool with ornate joinery; Poly Haven original/donated work per its asset license page
- Physical dimensions from API: 0.599 x 0.506 x 0.631 m
- Download format: glTF 2.0 (`.gltf` + external `.bin` + JPEG textures), 1K
- Entry URL: https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/chinese_stool/chinese_stool_1k.gltf
- Exact mesh count measured from glTF index accessors: 1,090 triangles, 1 primitive/draw call, 1 material
- Texture maps: 1024px diffuse/base color, OpenGL tangent-space normal, packed ARM (R=ambient occlusion, G=roughness, B=metallic)
- Saved transfer size: 1,793,116 bytes (1.71 MiB)
- Visual content check: no text, lettering, or logos visible in the diffuse texture

## Antique Ceramic Vase 01

- Asset ID: `antique_ceramic_vase_01`
- Source: https://polyhaven.com/a/antique_ceramic_vase_01
- Author: James Ray Cock
- License: CC0 1.0
- Description/provenance: worn blue floral transferware ceramic vessel with crackle glaze; Poly Haven original/donated work per its asset license page
- Physical dimensions from API: 0.255 x 0.255 x 0.440 m
- Download format: glTF 2.0 (`.gltf` + external `.bin` + JPEG textures), 1K
- Entry URL: https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/antique_ceramic_vase_01/antique_ceramic_vase_01_1k.gltf
- Exact mesh count measured from glTF index accessors: 9,408 triangles, 1 primitive/draw call, 1 material
- Texture maps: 1024px diffuse/base color, OpenGL tangent-space normal, packed ARM (R=ambient occlusion, G=roughness, B=metallic)
- Saved transfer size: 525,941 bytes (0.50 MiB)
- Visual content check: floral ornament only; no text, lettering, or logos visible in the diffuse texture

## Integration budget

Loading all three once costs 30,490 triangles, 3 draw calls, 3 materials, 803,804 bytes of geometry buffers on disk, and 3,398,588 bytes (3.24 MiB) transferred before HTTP compression. Nine 1K texture images occupy about 36 MiB when expanded to RGBA8 on the GPU.

For mobile, use `WoodenChair_01` as the single hero prop. Add the vase for close dressing (combined 29,400 triangles and 1.53 MiB transfer). The stool is the best repeated background prop by geometry cost, but its unique texture set adds about 12 MiB decoded GPU memory; instance the same loaded model instead of loading duplicates.
