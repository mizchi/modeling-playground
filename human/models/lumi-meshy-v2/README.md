# LUMI Meshy v2 — 軽く握った手

モデル一覧には、軽く握った標準形状の静止・歩行・走行だけを公開する。旧テキスト生成モデルと骨回転補正版は廃止。

## 構成

- `src/reference.png` / `src/reference-prompt.txt`: 内蔵image_genで生成した正面参照と完全なプロンプト。
- `src/client.ts` / `src/queue-client.ts`: 画像から3D・リグ付けの型とAPI処理。秘密鍵はNodeのみが扱う。
- `src/input/`: 未調整GLB、FBX、生成ジョブの記録。加工用入力としてGit除外し、モデル一覧には出さない。
- `src/relax-hands.ts`: このv2モデルの手首座標に合わせた指形状の調整。
- `src/finger-profile.ts` / `src/finger-rig.ts`: 各指の関節位置・ウェイト付けとGLBへの指リグ追加。
- `output/`: `lumi-meshy-v2-relaxed.glb`、`lumi-meshy-v2-walking-relaxed.glb`、`lumi-meshy-v2-running-relaxed.glb` と確認画像。Git除外。

## 再加工

```sh
just human-meshy-v2-hands
```

`src/input/` の静止・歩行・走行GLBから、指先を掌側へ緩く曲げ、親指を少し寄せ、指リグを追加した出力を作る。API呼び出しはない。元データは変更せず、既存出力への上書きも拒否する。

手首と掌の中心を保ち、指の頂点座標と変形に対応する法線を更新する。各手の親指・人差し指・中指・薬指・小指に3関節ずつ、計30の変形ボーンを追加する。指部分の手ボーンのウェイトを新しい関節へ分配し、UV・三角形数・既存の身体ボーン・モーションは保持する。追加の逆バインド行列により、指の標準姿勢と手首への追従を保つ。

関節名は `LeftHandIndex1`〜`LeftHandIndex3` など。各指に非変形の `Tip` ノードも付ける。局所-Z回転が曲げ方向で、左右とも同じ規約。`contracts/fingers.ts` が付随メタデータの型を定義する。

通常ビューアーの「指のポーズ」で左右5本ずつを調整できる。0が軽く握った標準姿勢、負値が緩める方向、正値が曲げる方向。歩行・走行中も調整可能。「指を標準に戻す」で全指をリセットする。これは表示中だけの操作であり、変更したポーズの保存・指のキーフレーム編集は未対応。

元メッシュは低密度で指の間にも接続面が残るため、大きな開閉・指の開きでは引きつれが出る。スライダーは控えめな可動範囲に限定している。大きなジェスチャーには指の間の形状と関節付近のトポロジーの調整が必要。

## 生成パイプライン

```sh
just human-meshy-v2 image-submit --execute
just human-meshy-v2 image-fetch
# src/input/lumi-meshy-v2-unrigged.glb を「GLBを開く」で確認する。
just human-meshy-v2 rig-submit --execute --geometry-reviewed
just human-meshy-v2 rig-fetch
just human-meshy-v2-hands
```

新規送信は有料。各段階で1回だけ送信し、`src/input/image/` と `src/input/rig/` にジョブIDと結果を保持する。既存ディレクトリがある場合は再送しない。取得は同じfetchを再実行する。形状確認フラグは手動確認を表し、自動品質判定ではない。

`.env` の `FAL_KEY` はNodeだけが読む。画像はPNG data URIとしてfalへ送信する。画像から3D生成ではリグを無効にし、形状確認後に別工程でリグを付ける。BASE45専用骨格には変換しない。

仕様: [画像から3D](https://fal.ai/models/meshy/v7/image-to-3d/api)、[人型リグ付け](https://fal.ai/models/fal-ai/meshy/rigging/api)。

## 確認結果

6,251三角形・54の変形ボーン（身体24＋指30）。リグ付きGLBのValidatorはエラー0、各警告1（元出力と同じ `NODE_SKINNED_MESH_NON_ROOT`）。指形状・リグの追加でポリゴンは増えていない。

```sh
MESHY_OUTPUT_DIR="$PWD/human/models/lumi-meshy-v2/output" pnpm exec playwright test tests/e2e/meshy.spec.ts
```

確認URL: `/?model=lumi-meshy-v2-relaxed`、`/?model=lumi-meshy-v2-walking-relaxed`、`/?model=lumi-meshy-v2-running-relaxed`。
