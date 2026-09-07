# Game typography

The locally hosted Yukyo UI and Yukyo Mincho font subsets derive from Google's Noto Sans JP and Noto Serif JP. Noto UI weights 400–700 are retained; the Mincho heading face uses weight 600. Glyphs cover current game copy plus Latin, kana and Japanese punctuation. Unsupported future characters fall back to the platform's Japanese font.

- [Noto Sans JP source](https://github.com/google/fonts/tree/main/ofl/notosansjp)
- [Noto Serif JP source](https://github.com/google/fonts/tree/main/ofl/notoserifjp)
- Both are distributed under SIL Open Font License 1.1; original notices are retained in OFL-NotoSansJP.txt and OFL-NotoSerifJP.txt.

Downloaded 2026-09-08 from the official `google/fonts` repository. TTF sources: `https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf` and `https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifjp/NotoSerifJP%5Bwght%5D.ttf`. Exact source hashes and output sizes are recorded in font-build.json.

To rebuild after adding game copy, place those two TTF files as `work/font-sources/NotoSansJP.ttf` and `work/font-sources/NotoSerifJP.ttf`, install fonttools[woff] 4.64.0 and brotli 1.2.0 into `work/font-tools`, then run `python scripts/build-game-fonts.py`. No third-party font requests are made by the game at runtime.
