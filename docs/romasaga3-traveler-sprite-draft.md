# ロマサガ3風・歩行スプライト試作

## 状態

- 画像: `../output/romasaga3-traveler-draft.png`
- built-in image_gen で生成。CLI/API フォールバックは使用していない。
- 1024 × 1536 PNG、4列 × 8行の試作。32セルの想定。
- **未完成: ゲーム用の検証済みスプライトアトラスではない。** 背景の市松模様は描画されており、アルファチャンネルなし。
- 右向き・右奥・右手前の描き分けが不十分。コマの足位置と歩行ループ、均一な論理ピクセルグリッドも未検証。
- 3回目の修正では方向の整合性が悪化したため、2回目の版を採用した。
- 試作画像は参考資料として保存し、再生ページには組み込まない。実際の再生・書き出しは[3D素体からの決定的な生成方式](sprite-walk-study.md)へ移行した。

## 目標仕様

ロマサガ3のSFC版フィールドキャラクター風の小さなドット絵。茶髪・青緑のマント・革装備のオリジナル冒険者。
上から下・左下・左・左上・上・右上・右・右下の8方向。横方向は左足接地・通過・右足接地・通過の4コマ。
実用化時は透過、各コマの共通足元アンカー、向きの正確さ、左右交互の足運びを検証する。

## 生成プロンプト

### 初稿

```text
Use case: stylized-concept
Asset type: 2D game walking animation sprite sheet.
Primary request: Create an original fantasy adventurer in the pixel-art visual style of Romancing SaGa 3 on the Super Famicom, specifically the small in-game walking character sprites, NOT a modern high-resolution illustration and NOT a remake. One consistent character, exactly 32 full-body frames arranged as 4 columns by 8 rows.
Subject: A youthful male traveler with swept chestnut hair, a short muted teal cape, ivory shirt, fitted brown leather vest and belt, dark trousers and brown boots. No held weapon. Readable handsome face, confident posture. Approximately 2.5 heads tall. Subtle jewel-toned, warm pixel highlights and purple-brown shadow clusters.
Style: authentic finely placed 16-bit pixel clusters, compact 24-by-30-logical-pixel character silhouette within a 32-by-32 logical-pixel cell. Sharp square pixels, no antialiasing, no blurred shading, no outlines thinner than one logical pixel, restrained shared palette. Show the sheet enlarged using exact nearest-neighbor-style square pixel blocks. NOT voxel, NOT 3D, NOT painterly.
Layout: portrait canvas 1024 by 2048, an invisible exact uniform 4-column by 8-row grid of 256-by-256 cells, each corresponding to a 32-by-32 low-resolution tile enlarged 8x. No outer margin, no gaps between cells; each sprite has generous transparent padding inside its own cell. Each sprite's center and foot anchor have the same position within its cell. Never crop feet, hair, arms or cape.
ROW DIRECTION ORDER, top to bottom, viewed by the player:
1: south / facing directly toward viewer.
2: southwest / facing lower-left at 45 degrees.
3: west / exact left profile.
4: northwest / facing upper-left away from viewer at 45 degrees.
5: north / full back view, face invisible.
6: northeast / facing upper-right away from viewer at 45 degrees.
7: east / exact right profile.
8: southeast / facing lower-right toward viewer at 45 degrees.
ALL FOUR frames in each row must face that row's SAME direction. Only the walking pose changes horizontally. Diagonal rows must rotate both torso and head, not merely turn eyes.
COLUMN WALK PHASES, left to right: left foot forward and right arm forward; passing pose feet close with body one logical pixel higher; right foot forward and left arm forward; opposite passing pose feet close with body one logical pixel higher. A clear repeating 1-2-3-4 gait, grounded contact poses and subtly moving cape. No duplicate contact frames. Character must not translate through a cell or change size. Consistent outfit details and lighting across every direction.
Background: genuinely transparent RGBA alpha, no painted checkerboard, no solid matte. No ground plane or cast shadows.
No text, labels, row numbers, arrows, grid lines, border, logos, watermark, scenery or extra sprites. This is a clean sliceable production sprite sheet, not a presentation poster.
```

### 保存版への編集プロンプト

```text
Edit the attached sprite sheet into an authentic low-resolution Romancing SaGa 3 Super Famicom walking sprite sheet. Preserve the same brown-haired teal-caped character and the exact layout of 4 columns and 8 rows, 32 sprites total. This is NOT a high-resolution pixel illustration: reduce each character to a tiny approximately 20 pixels wide by 28 pixels tall silhouette with about 16 shared solid colors, coarse deliberate single-pixel facial features, 2.5-head-tall proportions, extremely simple clustered hair highlights and clothing shading. Display these actual low-resolution shapes at nearest-neighbor magnification with a perfectly consistent square pixel grid. Eliminate all gradients, glow and subpixel edge antialiasing. Background must be completely transparent alpha, absolutely no brown/teal/black background, no checkerboard drawn in, no floor shadows. Uniform 4 columns x 8 rows edge-to-edge invisible cell grid, each sprite centered horizontally and foot-anchored consistently within its cell. Keep all sprite bodies fully inside their cells with transparent margins. Each column is a walking phase left-contact/passing/right-contact/passing, distinct alternating legs and opposite arms, seamless loop. All 4 sprites in each row face one direction: row1 south/front, row2 southwest/front-left, row3 west/left profile, row4 northwest/back-left, row5 north/back, row6 northeast/BACK-RIGHT with back of head and cape dominant and almost no visible face (NOT another right profile), row7 east/right profile, row8 southeast/front-right. No text labels, no borders, no grid lines. Character details and scale consistent in all 32 frames. Output PNG sprite atlas with actual transparent background.
```
