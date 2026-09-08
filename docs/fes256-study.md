# LILA — 256FESを出発点にした表情付きデフォルメ

約3等身、丸い頬、尖った前髪、左右の髪束、濃い上着と細い脚。ユーザーの参考画像を手がかりにした造形であり、画像そのもののモデル復元ではない。

## 現在の仕様

**426三角形・約17.5 KiB、4メッシュ・3材質・11ボーン。** 目・虹彩・眉・口は256×256のPNGアトラスに描画し、GLBへ内包する。表情を変えても頂点位置・面接続は変えない。初期指示のメッシュ表情は、後続の「目と口はテクスチャ」という指示により置き換えた。

| メッシュ | 三角形 | 役割 |
| --- | ---: | --- |
| `Lila` | 136 | 服・首・四肢、スキニング |
| `HeadSkin` | 134 | 独立した顔素体・耳、滑らかな法線 |
| `Hair` | 108 | 頭髪・厚み付き前髪・左右の髪束・留め具 |
| `Face` | 48 | 肌の三角面と一致する静的なテクスチャ貼付面 |
| 合計 | 426 | 内部・非表示の面も含める |

ユーザーが厳密な面数制限を緩和したため、256は目安とした。`triangleBudget: 512`は今回の軽量性を保つ開発上限であり、256FESの規定ではない。32 KiBのファイル予算とともに生成時・テストで検査する。追加の画像・圧縮デコーダーは不要。PNGは人が確認・編集するため外部にも出力するが、GLBの表示は外部PNGに依存しない。

## 顔・髪の構造

```text
Root → Body → Head（共通の取付ボーン・Viewerの拡大対象）
                ├─ HeadSkin
                ├─ Hair
                └─ Face
```

頭と髪を独立メッシュにすることで、髪の拡縮・非表示・差し替えが顔素体を変更しない。顔と髪を別GLBファイルに分割したという意味ではない。頭の回転には3メッシュとも追従する。

`human/models/fes256/src/head.ts`が頬・目元・鼻筋・顎の列と断面を定義する。眼窩を深く掘らず、幅広い目元と小さな鼻の突出を保つ。肌だけは滑らかな法線、髪と服は面の角を残す。テクスチャ貼付面は肌の実際の三角形を使用し、頬や口元に別の平板を浮かせない。

## 参考記事から採用したこと

[TECH-COYOTE「ローポリキャラモデリングのコツ」](https://3d.crdg.jp/tech/archives/844)では、表情用テクスチャを確認しながら輪郭と側面を整え、目・口の強すぎる立体化による歪みを避け、斜めの印象も確認している。

今回はこれを、UVの正面配置を固定したまま鼻・頬・顎の奥行きを調整する構成へ適用した。目元は浅く、頬・後頭部は立体を維持する。髪は大きな束と厚みで輪郭を作る。リポジトリの既存リテイクガイドに従い、正面だけで完了とはしない。

企画の背景：[256Fes、それはExtreme LowPolyの祭典](https://note.com/thesaurus/n/nf3af49670ce8)。今回は厳密な256三角形以内の提出物ではない。

## テクスチャ表情の使い方

Viewerの「表情」で通常・笑顔・怒り・驚き・まばたき・ウインクを選択する。「表情を自動再生」は1秒ごとに切り替える。モーフ補間・標準glTFアニメーションクリップではなく、明示的なUV切り替えである。

```js
import { ExpressionAtlas } from './runtime/expression-atlas.ts';
const expressions = new ExpressionAtlas(gltf.scene.getObjectByName('Face'));
expressions.set('Wink');
expressions.set('Neutral');
```

`Face.userData.expressionAtlas`にバージョン、画像サイズ、各表情名と整数タイル矩形、現在の表情を格納する。ランタイムはこれを検証してUVだけを変更する。未知の表情名や範囲外タイルは拒否。半テクセルの余白を取り、隣の表情が混ざるのを防ぐ。通常のGLB Viewerでも保存時の表情を表示できるが、他のアプリで表情を選ぶにはこの切り替え処理に相当する実装が必要。

アトラスは既存の`pixelPainter`で再生成可能な描画コードとして制作。参考画像の切り抜きや画像生成サービスの出力ではない。各タイルは80×80、6表情を3列×2行で256×256内に配置する。小さな虹彩・ハイライト・まつ毛はピクセルとして保持する。

## 生成と検証

```sh
just fes256
node --test tests/fes256.test.ts
pnpm exec playwright test tests/e2e/fes256.spec.ts
```

[Viewer](http://127.0.0.1:5188/?model=fes256) / [GLB](../human/models/fes256/output/fes256.glb) / [アトラス](../human/models/fes256/output/fes256-expressions.png) / [顔](../human/models/fes256/output/fes256-face.png) / [ワイヤー](../human/models/fes256/output/fes256-face-wire.png) / [斜め](../human/models/fes256/output/fes256-quarter.png) / [側面](../human/models/fes256/output/fes256-side.png) / [ウインク](../human/models/fes256/output/fes256-wink.png)。初稿の[斜め](../human/models/fes256/output/fes256-blockout-quarter.png)・[側面](../human/models/fes256/output/fes256-blockout-side.png)も比較用に保存。

単体テストは面数・側面の厚み・鼻と目元の対比・頭と髪の独立性・頭回転への追従・切替時の頂点不変・UV復帰・6タイルの画像差・PNG/GLBの再生成一致・GLB Validatorを検査する。実際の画像読込と表情切り替え、各方向・拡大・ワイヤー・モバイル・旧モデルへの切り替えはPlaywrightで確認する。

簡易骨格付きだが歩行・IKは未実装。衣服と四肢・髪束は重なりで接続しており、3Dプリント向けの一体メッシュや大きな関節変形の非交差は保証しない。
