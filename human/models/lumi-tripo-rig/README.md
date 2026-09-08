# LUMI Tripo → Meshy rig → HY jump

Tripoモデルにfal経由のMeshyリグを付け、既存HY-Motionジャンプをローカルで対応付ける検証。
元のTripoモデルとHY入力は変更しない。ソースと生成出力を分離する。

- `src/generate.ts`: 1回だけの有料リグ送信／既存ジョブ取得。入力GLBのhashとジョブを記録。
- `src/build-jump.ts`: ブラウザでFBXを読み、身体ボーンの静止姿勢差と単位を補正してGLBへ焼く。
- `src/input/rig/`: 入力記録、ジョブ、結果。gitignore対象。公開CDN URLを含むため非公開で保持。
- `output/lumi-tripo-rig.glb`: Meshyのリグ結果。
- `output/lumi-tripo-rig-walking.glb`: Meshy同梱歩行、比較用。
- `output/lumi-tripo-jump.glb`: 補正済HYジャンプ、無補正HY、Meshy元クリップの順。
- `output/jump-report.json`: 接地補正前後の測定値。`jump-clips.json` は焼き込みトラック。

```sh
just dev
# 別ターミナル、API呼び出しなし。ローカルChromeが必要。
just human-tripo-jump
```

Viewer: http://127.0.0.1:5188/?model=lumi-tripo-jump

## 有料処理について

今回のMeshyリグは実行済み。`just human-tripo-rig fetch` は同じジョブの取得のみ。
`submit --execute --geometry-reviewed` は新規の有料送信であり、再実行しない。
保存済みディレクトリの存在で再送を拒否する。通信結果が不明でも自動再送はしない。
料金API取得値は2026-09-09時点で1回$0.80。HYジャンプの再生成は0回。

## 検証範囲

24身体ジョイント、22ボーンをHYと対応付け。指リグなし。
足裏補正は接地から始まる短いジャンプ専用の仮定を持つ。足の水平IKや物理同期は未実装。
Meshyの処理では三角形数と画像形式が変わる。一方、HY追加処理は既存メッシュ／画像／スキンのBINを保持する。

成功・失敗・修正の詳細は [検証記録](../../../docs/tripo-hy-motion-validation.md) を参照。
