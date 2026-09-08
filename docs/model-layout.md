# モデル単位の構成

```text
human/
  models/base45/{src,output}/
  models/lumi/{src,output}/
  models/{suzu,ashley,aster,fes256,traveler}/{src,output}/
  output/                  # 人体エディタ全体の検証画像
  *.ts                     # 人体編集・設定・モーション・専用Viewer
robot/
  models/{raven,bastion,strix}/{src,output}/
  output/                  # ロボットゲームの検証画像
models/
  {dog,wyvern,little-town,sprite-walk}/{src,output}/
modeling/                  # モデル非依存の生成・書き出しヘルパ
runtime/                   # モデル非依存の再生・IK・アセット契約実行
viewer/                    # 共通GLB Viewer
tests/                     # 横断テスト・モデル回帰テスト・E2E
```

## モデルを編集する

Three.jsモデルの入口は `src/model.ts`、仕様は `src/definition.ts`、生成は `src/build.ts`。既存の `just base45`、`just lumi`、`just raven` などはそのまま使えます。町と旅人は `src/` 内の既存Python名を保持しています。

生成器は `prepareOutput(import.meta.url)` で自身の `src/` の隣にある `output/` を作成します。シェルのカレントディレクトリには依存しません。GLB・PNGエンコーダーは `modeling/export-glb.ts` と `modeling/png.ts`、GLBと設定JSONの同時出力は `modeling/export-asset.ts` です。

## TypeScriptの実行と型検査

モデル生成器・共通処理・Viewer・テストは `.ts` です。Node.js 24で生成器を直接実行します。`tsx` や `ts-node`、事前のJavaScript書き出しは不要です。

```sh
node human/models/base45/src/build.ts
just lumi
pnpm typecheck
just test
```

Nodeの実行時処理は型の除去のみで、型検査はしません。ルートの `tsconfig.json` は `strict`・`erasableSyntaxOnly` を有効にし、`pnpm typecheck` でモデル・共通処理・Viewer・ゲームと型契約のテストを検査します。`just test` は型検査、Nodeの回帰テスト、Pythonテストを順に実行します。

相対importには `.ts` を明記し、型だけの依存は `import type` / `export type` を使います。enumやコンストラクタのパラメータプロパティは使わず、Nodeが除去できる型構文に限定します。ブラウザ用の配信・ビルド、およびゲームの `.tsx` は従来どおりViteが担当します。詳細は [Node.js 24のTypeScript対応](https://nodejs.org/docs/latest-v24.x/api/typescript.html) を参照してください。

公開型は `contracts/*.types.ts`、`human/contract.types.ts`、共有の幾何・描画型は `modeling/types.ts` にあります。実装側から型を再exportするため、利用側は通常 `contracts/asset.ts` や `human/contract.ts` から型と関数をimportできます。

## 派生を作る

1. 対象領域に `<新モデル>/src/` を作り、近いモデルのソースをコピーするか既存の生成器をimportします。
2. 固有ID・仕様を設定し、`src/build.ts` から隣の `output/` へ出力します。共有してよい形状処理だけを必要に応じて `modeling/` に抽出します。
3. `justfile` に生成コマンドを追加します。テストや動的ファイル名の解決が必要な場合は `modeling/asset-paths.ts` に所有モデルを登録します。
4. 新しいGLB名を既存モデルと重複させないでください。共通Viewerは3領域のモデル出力を自動検出し、同じディレクトリの `.asset.json` を関連付けます。
5. ソースと再生成した成果物を一緒に管理し、`just test`・`just test-e2e`・`just test-pages` を実行します。

同じ生成器のプリセットは重複コピーしません。`dog` は犬・コーギー・ちびコーギー、`traveler` は静止・歩行・IK版を所有します。女性素体は `base45/src/build-female.ts`、サイドテール付き人体は `lumi/src/build-side-tail.ts` から生成します。人体エディタのプリセット範囲は変更していません。

## 互換性

公開エントリポイント（`index.html`、`human-viewer.html`、`game.html`、`sprite-lab.html`）とモデルID・ダウンロード名は維持します。リポジトリ内の旧 `models/*.mjs`、`scripts/build_*`、`output/*` パスは廃止し、各モジュールも `.mjs` から `.ts` に移行しています。直接importしていた外部コードは新パスへ移行してください。

移行時は全512生成物のハッシュを照合し、内容を変更せず配置を変更しました。Blenderのバックアップも各モデルの `output/` に保持しています。既存blend内に保存された絶対レンダーパスは `just render` で現在の出力先に再設定します。
