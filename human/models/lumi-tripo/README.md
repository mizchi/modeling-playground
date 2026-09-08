# LUMI Tripo H3.1

fal.ai の `tripo3d/h3.1/image-to-3d` による比較用モデル。Meshy v2 と同じ
`../lumi-meshy-v2/src/reference.png` を入力し、既存モデルは変更しない。

- 三角形 6,000 面を目標（実際の出力面数は生成側に依存）
- 標準形状・標準テクスチャ、PBR なし、geometry/texture seed 42
- リグ・モーションなし。指の可動や軽く握った手は保証しない
- 掲載生成料金 $0.30 / 体（2026-09-09 確認、実請求は fal 履歴で確認）
- API: https://fal.ai/models/tripo3d/h3.1/image-to-3d/api
- 料金: https://fal.ai/models/tripo3d/h3.1/image-to-3d

## 実行

Node 24 の TypeScript 直接実行。秘密鍵は gitignore 対象の `.env` の `FAL_KEY`。
Tripo 直結用の `TRIPO_API_KEY` は使わない。

```sh
just human-tripo submit --execute # 有料。1 回だけ実行
just human-tripo fetch            # 状態確認。完了していれば取得
```

`src/input/` に設定・参照画像 SHA-256・リクエスト ID・API 結果を保存し、
`output/lumi-tripo.glb` を viewer に公開する。いずれも gitignore 対象。
既存ジョブディレクトリがある場合は再送信を拒否する。通信結果が不明な場合も
再送せず fal ダッシュボードで確認する。取得は再開可能で、既存 GLB は上書きしない。

Viewer: http://127.0.0.1:5188/?model=lumi-tripo

今回の結果: 5,721 三角形、テクスチャ埋め込み、約 439 KB。GLB 検証はエラー・警告ゼロ。
元出力は +X が正面だったため、`src/input/lumi-tripo-raw.glb` を保持して
表示用 GLB に Y 軸 -90° の親ノードを追加する。形状・テクスチャのバイナリは変更しない。
向き補正はこの比較モデル固有の設定で、将来の別出力でも必ず同じ向きとは限らない。

```sh
node --test tests/tripo.test.ts tests/meshy-image.test.ts
pnpm typecheck:native
just test-e2e tests/e2e/tripo.spec.ts
```
