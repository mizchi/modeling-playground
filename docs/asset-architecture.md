# Three.js の生成・ランタイム分離

新規のプロシージャルモデルは Three.js を基本にする。Node で生成し、ブラウザでも同じ骨格・座標・ソルバーを使う。Blender/Python は既存の町と Milo、および必要になった造形・ベイク作業用に維持する。既存資産の全面移植は行わない。

## 境界

```text
contracts/asset.{mjs,d.mts}       JSON の検証と型定義
models/raven-definition.mjs      骨格・ソケット・判定形状・噴射・クリップ設定
models/raven.mjs                 キャラクター固有の造形・材質
models/raven-motion.mjs          キャラクター固有の演出と姿勢関数
           ↓ 利用
modeling/                       形状部品・骨格生成・剛体ウェイト・動作の焼き込み
runtime/                        共通の再生・IK・横薙ぎソルバー・設定の解決
           ↓ Node で出力
output/raven.glb                 見た目・26 ボーン・モーション・6 ソケット
output/raven.asset.json          付随するゲーム用設定
           ↓ 読み込み
viewer/                         入力・カメラ・表示（将来のゲームも runtime を利用）
```

`modeling/` と `runtime/` は DOM・ファイル I/O・特定のキャラクター名に依存しない。ファイル出力は `scripts/`、操作ハンドルは `viewer/ik-editor.mjs` に残す。旧 `viewer/ik.mjs` と `viewer/animation.mjs` の公開 API は互換エントリーポイントとして維持する。

## 設定の意味

- `rig.bones`：親が先に現れる骨格定義。V1 のレスト姿勢では回転は単位クォータニオン、スケールは 1。単位はメートル、Y-up、+Z-forward。
- `sockets`：骨に追従する名前付きの通常ノード。骨の本数やウェイトには影響しない。刃の根元・先端と、背面・足裏の計 4 ノズル。
- `colliders`：被弾用の簡略ボックス。各骨のローカル座標で中心と半寸法を指定する。造形検証用の装甲境界ボックスとは別物。
- `attacks`：攻撃に使うソケットの組と判定半径。ダメージ量や敵味方のルールは持たない。
- `emitters`：ソケット、噴射方向、プリセット名、毎秒の生成数・寿命・速度。方向はソケットローカル。粒子の生成・描画はランタイム利用側の責任。
- `clips.windows`：クリップ時間の半開区間 `[start,end)`。RAVEN の横薙ぎは `0.60 ≤ t < 0.94` 秒を攻撃有効期間にする。

ノズルのソケットは、伸縮する炎メッシュの骨ではなく本体側の骨に付ける。現在の青い噴射は引き続き既存メッシュであり、パーティクルへの置き換えはまだ行っていない。

`validateAssetSpec()` は未知のフィールド、重複名、循環・欠損参照、不正な数値・方向・時間窓を拒否する。`bindAsset()` は GLB と定義の識別子・バージョン・骨階層・レスト姿勢・ソケット・クリップ時間を照合する。**レスト姿勢でバインドしてから**再生や IK を始める。

## ゲーム側への接続

```js
const binding = bindAsset(gltf.scene, gltf.animations, definition);
const player = new AnimationPlayer(gltf.scene, gltf.animations, {modes: binding.modes});
player.select(gltf.animations.findIndex(c => c.name === 'BladeSlash'));

// 毎フレーム、アニメーションや IK によるボーン更新の後で取得する。
player.update(deltaSeconds);
const signals = binding.sample('BladeSlash', player.time);
// signals.colliders: ボックスのローカル半寸法とワールド行列
// signals.attacks: 有効状態、刃の両端のワールド位置、スケールを考慮した半径
// signals.emitters: 有効状態、噴射口のワールド位置、正規化した噴射方向と設定
```

`sample()` は状態を返すだけで、衝突・ダメージ・粒子生成を実行しない。返されたベクトルと行列は呼び出し側が所有する。シーク時にも状態の照会だけなら攻撃が勝手に発火しない。

`crossedEvents(clip, from, to)` は `(from,to]` に通過した開始・終了イベントを返す。低 FPS で攻撃期間を丸ごと飛び越しても両方のイベントを取得できる。繰り返しクリップでは、利用側が保持する巻き戻していないアニメーション時刻を渡す。時刻は再生速度を反映した秒数で管理し、クリップ変更・シーク時にはカーソルをリセットする。初期時刻の状態は `activeWindows()` で取得する。

これは**衝突の連続判定ではない**。高速の刃は別途、攻撃有効期間を細分化して軌道をサンプルし、移動中の範囲と相手の判定形状を検査する必要がある。残像・火花・ヒット処理も別アダプターとして追加する。

## 生成と検証

- `just raven`：同じ定義から GLB と JSON を生成する。
- `just models-js`：Suzu と RAVEN を Node/Three.js だけで再生成する。
- `just test`：契約、ソケット追従、イベントの境界と飛び越し、GLB 再読込、既存 IK・横薙ぎを検証する。
- `just test-e2e` / `just test-pages`：設定の読込、破損時の復帰、従来 GLB と Pages 配下での互換性を確認する。

Viewer は同名の `.asset.json` があるカタログモデルだけ設定を読み込む。設定のない従来モデルや、単独で開いた GLB も表示・再生できる。GLB の `extras.animationModes` と `extras.groundLevel` は互換用に同じ定義から生成する。

`tests/raven-regression.test.mjs` はリファクタ前 `27aaf9a` の全メッシュ属性・材質・モーションサンプルのハッシュを保持する。意図的な造形変更では確認後に更新するが、構造整理では変更しない。生成された GLB/JSON は手で編集せず、公開時には両方をコミットする。
