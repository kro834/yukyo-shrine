# Interior surfaces v26 — source and license record

Retrieved from Poly Haven's official public API on 2026-09-08. Poly Haven publishes all assets under CC0 1.0 and permits commercial use, modification, redistribution, and use without attribution: https://polyhaven.com/license

Each asset folder contains the exact 1K JPEG maps used at runtime plus official API snapshots. `polyhaven-files-selected.json` records the upstream URL, byte size, and MD5 for every downloaded map. All files were checked against the official MD5 after download.

## Decrepit Wallpaper — aged fusuma paper substitute

- Asset ID: `decrepit_wallpaper`
- Official page: https://polyhaven.com/a/decrepit_wallpaper
- Author: Rob Tuytel
- License: CC0 1.0
- Material category: Paper & Card / Wallpaper / Peeling & Distressed Wallpaper
- Source coverage: 2.5 x 2.5 m; original maximum resolution 8192 x 8192
- Important fit note: this is real photographed distressed wallpaper, not Japanese washi. It is the closest unprinted paper material in Poly Haven's current texture catalog and works as aged fusuma paper when mapped without the frame.
- Diffuse 1K JPEG: 814,172 bytes — https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/decrepit_wallpaper/decrepit_wallpaper_diff_1k.jpg
- OpenGL normal 1K JPEG: 691,701 bytes — https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/decrepit_wallpaper/decrepit_wallpaper_nor_gl_1k.jpg
- Roughness 1K JPEG: 402,582 bytes — https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/decrepit_wallpaper/decrepit_wallpaper_rough_1k.jpg
- Total runtime transfer: 1,908,455 bytes (1.82 MiB)
- Diffuse inspection: neutral grey-brown paper, vertical abrasion, grime and peeling; no text, symbols, or logos

## Tatami Mat — exact woven straw/tatami material

- Asset ID: `tatami_mat`
- Official page: https://polyhaven.com/a/tatami_mat
- Author: Charlotte Baglioni
- License: CC0 1.0
- Material category: Textiles & Leather / Carpet & Matting / Woven Mats & Tatami
- Source coverage: 1.8 x 1.8 m; original maximum resolution 16384 x 16384
- Diffuse 1K JPEG: 620,119 bytes — https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/tatami_mat/tatami_mat_diff_1k.jpg
- OpenGL normal 1K JPEG: 441,133 bytes — https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/tatami_mat/tatami_mat_nor_gl_1k.jpg
- Roughness 1K JPEG: 276,540 bytes — https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/tatami_mat/tatami_mat_rough_1k.jpg
- Total runtime transfer: 1,337,792 bytes (1.28 MiB)
- Diffuse inspection: natural straw weave with green decorative mat borders; no text, symbols, or logos

## Combined runtime budget

- Six 1K JPEG maps: 3,246,247 bytes (3.10 MiB) before HTTP compression
- Approximate expanded GPU texture memory: 24 MiB if all six maps upload as RGBA8
- Recommended use: load both once and repeat via UVs. The tatami image includes its green mat borders, so use calibrated UV placement on the floor rather than treating it as a borderless uniform weave.
