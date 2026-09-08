# Editable enemy masks and fusuma pull

`error-models.blend` contains the two masks, their review lighting, and the sliding-door pull. Runtime exports are under `public/models/error/` and share the game's material library.

To rebuild with Blender 4.5 LTS:

1. `node --experimental-transform-types scripts/export-blender-bases.mjs`
2. `blender --background --factory-startup --python-exit-code 1 --python scripts/build-error-models.py`

The export retains UVs, normals and cavity vertex colors; the browser converts glTF UV orientation for the shared texture loader. Runtime masks stay below 8,000 triangles each. The Blender runtime and review renders are local tools under ignored `work/`, not shipped with the game.
