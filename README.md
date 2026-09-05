# Modeling Playground

生成コードで作る3Dモデルと、共通のThree.js GLB Viewer。

**[公開Playground](https://mizchi.github.io/modeling-playground/)** — インストール不要で全モデルを表示・操作できます。

## GitHub Pages

`main`へのpushで、テスト・Viewerのビルド・GitHub Pagesへの公開を自動実行します。PRではテストのみ実行し、公開しません。生成済みのGLBを使うため、公開処理にBlenderは不要です。

`just test-pages`で本番ビルドを`/modeling-playground/`配下に置いた状態を検証します。公開後の確認は`PLAYGROUND_URL=https://mizchi.github.io/modeling-playground/ pnpm test:pages`。モデルを編集した場合は再生成したGLBもコミットしてください。

## RAVEN-03 — 飛行型ロボット

鋭角のセラミック装甲、青黒い内部フレーム、背面の双発ブースター、脚底ノズル、右腕のブレード、左腕の小型シールドを持つ人型ロボット。Three.jsで生成した26ボーンのリグ付きGLBです。

- [ローカルViewer](http://127.0.0.1:5188/?model=raven) / [GLB](output/raven.glb) / [浮遊姿勢](output/raven-hover.png) / [側面](output/raven-side.png) / [構え](output/raven-windup.png) / [振り抜き](output/raven-followthrough.png)
- `Hover`：2.0秒のループ。床から浮いた姿勢で上下動し、ブースターの噴射長が脈動します。
- `Boost`：2.4秒。前傾・噴射増大・加速・減速を伴い、+Z方向へ4.8 m移動するルートモーションです。
- `BladeSlash`：2.1秒・60 fps。低い溜めから噴射を強め、左右の脚を開いて約3.55 m前方へ飛び込み、右外側から前方を大きく横薙ぎします。腰と胴体を斬撃方向へひねり、肩装甲を開いて肘を下げ、刃と切断面は水平に保ちます。振り抜き後は移動先で減速して浮遊姿勢に戻り、開始位置へは巻き戻しません。
- 装甲は各頂点を1本のボーンへ100%ウェイト付けした実際のSkinnedMeshです。関節は動きますが金属は曲がりません。噴射はボーンのスケールで変化する形状で、流体・粒子シミュレーションや攻撃の当たり判定はありません。IK操作は未実装です。
- `models/raven.mjs`が形状・骨格、`models/raven-motion.mjs`が時間に対する姿勢、`scripts/build_raven.mjs`がGLB生成を担当。`just raven`で再生成できます。
- `extras.groundLevel`を共通Viewerが読み、浮いたモデルとは独立した床を配置します。`extras.animationModes`により加速と斬撃は1回再生して停止し、「再生」で最初からやり直せます。他のGLB Viewerではループ設定を別途指定してください。
- GLB検証、ウェイト、全フレームの有限な頂点・床との隙間、ホバリングのループ接続、加速距離、実際のブレード頂点の移動と剛性を自動テストしています。横薙ぎは生成前のモデルと再読込したGLBの両方を120 Hzでサンプルし、刃の水平と大きな弧、右前腕・ブレードと他の装甲の非交差を各部品の有向境界ボックスで検査します（接続する右上腕・右手は除外）。

## Suzu — アニメ調キャラクター

濃紺のボブヘア、紫の瞳、藤色のワンピース、アイボリーの襟と靴下、星の髪飾り。高さ約1.66 mの静止モデルです。Miloとは別のキャラクターで、**Blender・Pythonを使わずThree.jsだけで生成**しています。

- [Viewerで開く](http://127.0.0.1:5188/?model=suzu) / [GLB](output/suzu.glb) / [全身](output/suzu-front.png) / [顔アップ](output/suzu-face.png) / [側面](output/suzu-side.png)
- 目は球体ではなく顔の曲面に沿うアーモンド形の面。縦長の虹彩・瞳孔、上まぶたの輪郭、少数のハイライトでアニメ調にしています。虹彩のグラデーションは頂点色で、画像テクスチャへの依存はありません。
- `models/suzu.mjs`に顔の輪郭、目、髪束、服、配色を定義。`models/geometry.mjs`は輪郭の立体化、髪束、曲面に沿う薄い面などの共通部品です。生成処理はDOMに依存せず、Nodeとブラウザから同じ`createSuzu()`を呼べます。
- 側面から薄く見えた初稿を修正し、頭部の前後幅を左右幅とほぼ同じに、胴体の奥行きを初稿の1.45倍にしました。頭は顔を単純に引き伸ばさず、後頭部側にボリュームを追加。`SUZU.torsoDepthScale`で服の奥行きを調整できます。
- `just suzu`でThree.jsのGLTFExporterから`output/suzu.glb`を再生成し、Viewerの「再読み込み」で反映します。[GLTFExporter公式仕様](https://threejs.org/docs/pages/GLTFExporter.html)
- リグ・アニメーション・表情モーフは未実装。目の発色を保つため一部にunlitマテリアルを使い、髪・肌・服は通常のPBRマテリアルです。輪郭線付きのフル・トゥーンシェーダーではありません。
- テストではGLBの妥当性、部品名、有限な頂点と単位法線、目が顔の中に埋まらないことを検査。E2Eで既存Viewerによる表示、顔へのフォーカス、モバイル表示を確認します。

## Milo the Traveler

青緑の上着、黄色いスカーフ、革のブーツ、リュックを持つ人型キャラクター。高さ約2.11 mのデフォルメモデルです。

### リグ・歩行版

- [歩行をViewerで見る](http://127.0.0.1:5188/?model=traveler-walk)
- [アニメーション付きGLB](output/traveler-walk.glb) / [Blender](output/traveler-walk.blend) / [歩行姿勢](output/traveler-walk.png)
- 18ボーンと正規化した頂点ウェイト。腰・背骨・首・頭・左右の腕、手、脚、足を制御します。指や表情の個別ボーンはありません。
- `Walk`は30 fps、36フレーム区間＝1.2秒のその場歩行です。前進するルートモーションは含みません。
- 歩行の数値パラメータは`scripts/gait.py`、骨格・スキニング・キーフレーム生成は`scripts/rig_character.py`。`just walk`でGLB・blend・PNGを再生成します。
- 足の接地期間と遊脚期間を分け、足の目標位置から2本の脚ボーンの姿勢を計算してキーフレームに焼き込みます。足首は水平に保つ簡単な歩行で、つま先の蹴り出しや衣服の物理シミュレーションは含みません。
- Blenderファイルには編集可能な骨格と`Walk`アクションを保存しています。静止版は別ファイルとして維持します。

### IK編集版

- [IKをViewerで試す](http://127.0.0.1:5188/?model=traveler-ik)
- [GLB](output/traveler-ik.glb) / [Blender](output/traveler-ik.blend) / [Viewerでの屈伸](output/ik-crouch.png)
- 手足・腰の目印をドラッグすると姿勢が追従します。青い膝・肘のポールは曲がる方向を指定します。ドラッグはカメラに平行な面内の移動で、奥行きは視点変更またはX/Y/Zスライダーで調整できます。
- 「しゃがむ」で腰を12 cm下げ、足先を固定した屈伸を確認できます。「FK」で各関節を直接回転。「ポーズをリセット」で初期状態に戻ります。
- Blenderでは`CTRL_Hips`、`CTRL_LeftFoot`等を移動し、`POLE_*`で曲がる方向を調整。リグのカスタムプロパティ`IK`を1でIK、0でFKに切り替えます。手足ターゲットの回転にも追従します。
- **GLB標準にはBlenderのIK制約は保存されません。** このGLBはスキンと`extras.ikRig`の独自定義を持ち、共通ViewerがリアルタイムにIKを解きます。他のViewerでは通常のスキン付きモデルとして表示されます。編集可能なネイティブ制約はblend側に保存しています。
- `scripts/ik_contract.json`にバージョン、腰・腕・脚のボーン名、モデル座標系（glTF Y-up）のポール位置を定義。今後も同じ定義形式を持つGLBでViewerを使い回せます。IK定義がないモデルでは編集UIを表示しません。
- Viewerのポーズ変更はメモリ上のみで、保存・アニメーションへの焼き込みは未実装。IK/FK切り替え時の姿勢自動マッチング、関節の可動域制限、衝突回避も未実装です。届かない目標は骨を伸ばさず到達可能な距離に制限します。
- `just ik`で生成・Blender制約検証・GLB出力・レンダリング。生成は`scripts/build_ik.py`、IK計算は`viewer/ik.mjs`、ドラッグ操作は`viewer/ik-editor.mjs`に分離しています。静止版・歩行版は別ファイルとして維持します。

### 静止版

- [GLB](output/traveler.glb) / [プレビュー](output/traveler.png) / [Blender](output/traveler.blend)
- [キャラクターをViewerで開く](http://127.0.0.1:5188/?model=traveler)
- `just character`で生成・GLB再読み込み検証・レンダリング。
- 生成元は`scripts/build_character.py`。頭、胴体、左右の腕・脚、リュックを名前付きグループに分割。
- 静止モデルです。リグ、スキニング、アニメーションは含みません。各パーツは個別のメッシュで、3Dプリント用の一体形状ではありません。

## Petit Quartier

噴水広場を囲む小さなローポリの町並み。10棟の家・商店と時計塔、カフェのテラス、街路樹、ベンチ、街灯、花売りのカートを配置しています。

## 成果物

- [GLBモデル](output/little-town.glb)：外部テクスチャ不要の単体ファイル。glTF標準のY-up、単位はメートル。
- [プレビュー画像](output/little-town.png)：GLBをBlenderに再読み込みしてレンダリングした画像。
- [Blenderファイル](output/little-town.blend)：モデルに撮影用カメラ・照明・背景を追加した編集用ファイル。

台座は約28 × 24 m。建物の室内は作っていません。マテリアルは単色のPBR設定で、GLBの見え方は読み込み先の照明によって変わります。撮影用の床・照明・カメラはGLBには含めていません。

## GLB Viewer

```sh
pnpm install
just dev
```

http://127.0.0.1:5188 を開くと、共通のThree.js Viewerを表示します。初期表示はRAVEN-03で、モデル一覧からSuzu、MiloのIK版・歩行版・静止版や町にも切り替えられます。

- ドラッグで回転、ホイール／ピンチでズーム、右ドラッグ／2本指で移動。
- 斜め・正面・側面・上面の視点切り替え、全体表示（キャンバスにフォーカスしてFキー）。
- 部品をダブルクリックしてフォーカス。選択したオブジェクト名も表示。
- ワイヤーフレーム、グリッド、自動回転、明るさの調整。
- アニメーションがあるGLBでは、クリップ選択・再生／一時停止・速度変更・タイムラインの時間送り・骨格表示が使えます。時間送りや部品へのフォーカスは再生を一時停止します。
- 「GLBを開く」またはドラッグ＆ドロップでローカルGLBを表示。ファイルをサーバーへアップロードする処理はありません。
- 生成コードを実行した後、「再読み込み」で選択中のモデルを更新。ローカルで選んだファイルを外部アプリで編集した場合は「GLBを開く」で再選択してください。
- `output/`へGLBを追加するとモデル一覧に自動追加。表示名と推奨カメラ方向は`viewer/catalog.mjs`で任意に指定できます。
- `?model=traveler`や`?model=little-town`でモデルを指定して直接開けます。

外部ファイルに依存しないGLB 2.0を想定しています。Draco・KTX2等の追加デコーダーが必要な圧縮形式は未対応です。表示寸法はglTFのメートル単位に従い、アニメーションでは選択中のクリップを36分割でサンプルした移動範囲を表示します。

`just viewer-build`で一覧の全GLBを含む静的配信用の`dist/`を生成し、`pnpm preview`で確認できます。静的ビルドにはビルド時点のモデルが含まれるため、モデルを更新したらビューアも再ビルドしてください。

画面と入力処理は`viewer/main.mjs`、計測・カメラ距離計算・解放処理は`viewer/model.mjs`、再生状態とクリップ管理は`viewer/animation.mjs`に分離しています。

`just test`でGLB形式とカメラ・計測ロジック、`just test-e2e`でPlaywrightによる表示・視点切り替え・ファイル選択・エラーからの復帰・モバイル表示を検証します。初回にテスト用ブラウザがない場合は`pnpm exec playwright install chromium`を実行してください。

歩行については、Pythonで接地・左右交互の足運び・ループ接続を検証し、Node上でGLBをThree.jsに読み込んで実際のスキン変形、ループ端のボーン行列、全36フレームの全頂点の地面へのめり込みを検査します。E2Eでは一時停止・時間送り・速度選択・骨格表示・静止モデルへの切り替えを確認します。

## 再生成

Blender 5.0.1、Node.js 24、pnpm、justで動作確認しています。

```sh
pnpm install
just all
```

`just build`で町のGLBとblendを生成し、GLBの再読み込みと寸法を検証します。`just character`で静止版の旅人、`just walk`で歩行版、`just ik`でIK版を生成します。`just test`でGLBと歩行・再生・IKロジックを検証します。`just render`で町のPNGを生成し、`just all`で全モデルを再生成します。

macOSでは `/Applications/Blender.app/Contents/MacOS/Blender`、それ以外ではPATH上の`blender`を使用します。別の場所にある場合は`BLENDER`環境変数を指定してください。

生成元は[scripts/build_town.py](scripts/build_town.py)です。`PALETTE`で配色、`create_town()`で建物・小物の配置、`stage()`で撮影条件を変更できます。乱数シードは固定しています。
