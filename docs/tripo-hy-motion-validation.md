# Tripo × HY-Motion 検証・修正ループ

更新: 2026-09-09。状態: **Tripo → Meshyリグ（fal）→ 既存HYジャンプの連携を確認。品質調整は継続。**

## 検証する仮説

Tripo生成モデル → Meshy自動リグ（fal経由）→ 既存HY-Motionジャンプの骨格対応付け →
動作・接地・変形を確認し、問題をローカルで修正する。
まず元の男の子モデルで基準を確認し、頭部交換版は次の比較対象にする。
結果は「実験 → 観測 → 原因 → 修正 → 再試験」で追記し、成功と未検証を混同しない。

## 記録

| 実験 | 観測 | 原因・判断 | 修正／次の行動 |
| --- | --- | --- | --- |
| falでTripoリグを探す | 公開モデルAPIの `q=tripo` は11件、ページ続きなし。自動リグは見つからなかった | 3D生成をfalで呼べても、後処理まで同じ経路で提供されるとは限らない | Tripo直結経路を確認。架空のfal endpointを推測してPOSTしない |
| Tripo直結の認証確認 | `GET /v3/account/balance` がHTTP 401 | 保存済み `TRIPO_API_KEY` は現在認証されない。モデル品質の失敗ではない | 有効なTripo直結キーが必要。キーの中身は記録しない |
| falで別のリグ経路を探す | `fal-ai/meshy/rigging` を確認 | 利用可能な代替候補。ただし「Tripoのリグ品質」の検証にはならない | ユーザー承認後にこの経路を採用 |
| HYジャンプFBXをNodeで読む | `window is not defined` | FBXに埋め込み画像があり、Three.jsの読込処理がDOMを使う | 実ブラウザのPlaywrightへ切り替え。モーションを再生成しない |
| 同じFBXをブラウザで読む | 成功。約2.967秒、53トラック、52ユニーク骨名、数値は有限、Pelvis移動あり | 入力モーションは読める。832個のBoneオブジェクトには重複名がある | 既存SMPL-Hインポータの重複ヘルパー処理を参照。単純な名前Mapの上書きを避ける |
| 元Tripo GLB | 形状あり、skinsなし | 現時点は静的モデル | リグ付与結果を別ファイルで保存後、対応付けを実装する |
| Meshyリグを1回実行 | 24ジョイント、GLB検証エラー0・警告1。全頂点のウェイトが有限・非負・合計1、joint参照も範囲内 | 身体の自動リグは成立。指ボーンはない | 元モデルを保持し、リグ付き派生を別保存 |
| リグ前後のデータ比較 | 5,721→5,643三角形、4,238→4,220頂点。JPEG→PNG、439,392→3,662,296 bytes | リグAPIは形状・画像を完全保存する処理ではない。見た目の大枠は保持 | パーツ差し替え・頂点IDに依存した編集は、最終リグ前に済ませる。サイズ増も測定する |
| HY→Meshy対応付け | HYはcm相当、Meshy Armatureはscale 0.01。脚長比0.00805774。Meshyの背骨は下からSpine02→Spine01→Spine | 名前だけのコピーやlocal quaternionの直接コピーでは合わない | 22身体ボーンを明示対応、静止姿勢のworld回転差・骨方向を補正。30指トラックは未適用と明記 |
| 無補正ジャンプ | 足裏が最大約3.33cm沈む | モデルの脚比率・足形状の差 | スキニング後の靴底を測定し、Hipsの上下移動だけをローカル補正 |
| 最初の接地補正 | めり込みは消えたが開始時に約2.5cm浮く | 全期間の足先最低点には、しゃがみ時の足先回転が混ざる | 目視で発見→開始／終了接地のRedテスト追加→接地している開始フレームを床基準に変更 |
| 接地補正の再試験 | 開始・終了の足裏ほぼ0、最大補正3.33cm、最高点の足裏約26.57cm | 地面固定ではなく、滞空を維持できた | 正面・側面で開始／しゃがみ／離陸／最高点／着地／終了を確認。GLB再読込後120Hzで全変形頂点を検査し、床貫通3mm以内・有限値を確認 |
| 出力クリップの選択 | Meshyのrigged GLBにも既存クリップが1本あった | 新規クリップの末尾追加だけではHYが初期選択されない | 元クリップを残したまま、補正済HY→無補正HY→Meshy元クリップの順に並べ替え |

最初の経路調査は有料呼び出し0回。その後の承認済検証で、**アップロード1回・Meshyリグ1回・HY再生成0回**。
リグrequest ID: `01a081b4-416c-72b3-a8eb-81e1faa11bdc`。
実行前のfal料金APIは **$0.80 / generation**。以前の$0.20情報とは異なるため更新した。
これは取得時点の単価で、請求明細の確定額ではない。ローカル修正ループでは追加APIを呼んでいない。
既存TripoのSHA-256が入力記録と一致することをテスト。既存ジャンプ、秘密鍵も変更していない。
HY付与時はMeshy出力の既存BINを保持し、形状・テクスチャ・ウェイト・inverse bindを再出力しない。

以前の「fal上のTripo分割APIは未確認」は更新する。
公開一覧には **`tripo3d/tripo/segment`** があった。ただし入力仕様、H3.1との互換性、
実際の分割品質・料金は今回未検証。リグAPIがあることは意味しない。

## 再実行

`justfile` スキルに沿って、API呼び出しを含まない入力確認タスクを追加。

```sh
just tripo-jump-preflight
# 初回のみ課金。今回すでに実行済みなので再送しない。
# just human-tripo-rig submit --execute --geometry-reviewed
just human-tripo-rig fetch
# 別ターミナルで just dev を起動。Chromeを使用、ローカル処理のみ。
just human-tripo-jump
just test
pnpm typecheck:native
pnpm exec playwright test tests/e2e/tripo-jump.spec.ts
```

Playwrightの既定Chromiumがないこの環境ではChrome channelを設定して実行した。
テストは既存ローカル成果物がない環境ではスキップする。
preflight単体は入力検査。リグ・リターゲットは追加のunit/E2Eテストで検査する。
ローカル確認URL: http://127.0.0.1:5188/?model=lumi-tripo-jump

最終確認: `just test` はNode 292件・Python 4件成功、`pnpm typecheck:native` 成功、
ChromeでpreflightとジャンプE2Eの2件成功、`pnpm build` 成功（500kB超chunk警告あり）。
生成GLBは3,761,816 bytes。生成物とジョブ記録はgitignore対象で、commit/pushは今回行っていない。

## 残る制約・次の比較

- 今回は元の男の子のみ。頭部交換版へのリグ付与／ウェイト移植は未実施。
- 開いた手の形状を保持しており、指の握り・指ごとの動作はない。指リグは別途必要。
- 足裏補正は「接地姿勢から開始する、Y-upの短いジャンプ」向け。空中開始や階段にそのまま適用しない。
- 接地中の水平足滑りを止めるIK、両足を別々に床へ合わせる処理、物理エンジンとの同期は未実装。
- 大きな手首反転・首の脱落は選定フレームで見られなかったが、肩や股関節の品質は他の動作でも確認が必要。
- Meshy由来の `NODE_SKINNED_MESH_NON_ROOT` 警告は残る。今回のviewerで再生確認済みだが、全ランタイムの互換性を保証しない。
- モデルを分解・交換してから最終リグ、という順序を基本にする。Meshyを挟むと頂点IDの保持を前提にできない。
- 2D三面図→3D、別キャラクターでの再現性、実ゲームの物理統合は、この検証だけではまだ合格としない。

## 継続時のチェックリスト

1. 元GLBを保護し、リグ付き派生GLBを生成。ジョブIDを即保存して再送信を防止。
2. ボーン階層・静止姿勢・座標軸・単位を記録。全頂点のウェイトを検査。
3. HYの既存ジャンプを対応付け。名前が同じでも静止姿勢の回転差を補正する。
4. 正面・側面から、開始／しゃがみ／離陸／最高点／着地／終了を確認。
5. 足のめり込み・浮き・滑り、手首の反転、首／肩／股関節の破綻を検査。
6. 座標・リターゲット・接地処理の問題はローカル修正。形状や重み自体が原因の場合だけ再リグ等を検討。
7. 元モデルで合格してから頭部交換版を試し、首の接続・ウェイトの再利用を別項目として評価。

新しい認証や別サービスが必要な場合は止めて確認し、無断で課金先を変えない。
失敗した有料リクエストを自動で再投入しない。

## 根拠・関連コード

- fal公開モデル検索: https://fal.ai/docs/platform-apis/v1/models
- Meshyリグの他社生成GLB入力: https://fal.ai/models/fal-ai/meshy/rigging/api
- fal単価API: https://fal.ai/docs/platform-apis/v1/models/pricing
- Tripo自動リグ: https://developers.tripo3d.ai/en/docs/animations-rig
- Tripoの分割・補完・リメッシュは既存スキン／アニメーションを保持しない場合がある。
  編集後にリグを付ける順序が必要: https://docs.tripo3d.ai/animation/rig-v2-0-20250506.html
- 既存HY→BASE-45インポータ: `motion/import/hunyuan.ts`
- 既存ジャンプ: `motion/output/jump-001/motion.fbx`（gitignore対象）
- 入力テスト: `tests/e2e/tripo-jump-preflight.spec.ts`
- リターゲット: `motion/retarget/meshy.ts`
- GLBクリップ追加: `modeling/animation-glb.ts`
- 回帰テスト: `tests/meshy-retarget.test.ts`, `tests/tripo-rig.test.ts`, `tests/e2e/tripo-jump.spec.ts`

`mnemo-retrospective` の方針で知見を記録。既知の hosted memory 書込権限不足のため、
今回はリポジトリ内のこの文書を正本にする。
