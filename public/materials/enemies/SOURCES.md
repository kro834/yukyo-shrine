# Ritual mask surface

`ritual-mask-v60.png` was generated with the built-in image generation tool on 2026-09-08, using an orthographic render of this project's own procedural mask as its layout reference. It is an original generated surface, not a photograph or a scan of a historical object. The exact prompt is retained in `ritual-mask-v60-prompt.md`.

The 1024 by 1536 albedo is projected onto the fitted three-dimensional shell at `u=x/.4+.5`, `v=y/.6+.5`. Eye and mouth cavities remain actual geometry with dark recessed lining. Fine relief is limited to 0.35 mm; runtime lighting supplies highlights and cast shadows. Low quality uses a 256-pixel derivative and no relief map. All quality variants share the existing texture ownership and disposal lifecycle.

Tailored clothing reuses the photographed Rough Linen diffuse, normal and roughness maps described in `../textile/SOURCES.md`. Its mean luminance is used to dye the source linen; source RGB is not multiplied directly into an already dark cloth. The garment UVs are in units of 0.30 metres, converted to the scan's measured dimensions with the same repeat for every map.
