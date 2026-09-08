# MOTION — 動画参照・キーフレームエディタ

`just motion-editor` → <http://127.0.0.1:5188/motion-editor.html>

公開ビルドにも `motion-editor.html` を含める。Pagesへデプロイした場合は `/modeling-playground/motion-editor.html`。既存のモデル一覧とhuman-viewerからリンクする。

## 制作手順

1. BASE-45 / 女性素体 / LUMIを選ぶ。human-viewerで保存した設定JSONも読み込める。
2. 任意でローカル動画を選ぶ。IN / OUTを秒で指定して「この区間を使う」。区間は参照動画のオフセットとして保持し、元動画のファイル自体は切断・変更しない。
3. タイムラインと±1fで移動。動画は `IN + フレーム / FPS` に同期する。
4. 手足・腰のIKターゲットや肘・膝のポールを操作する。FKはボーンのローカルXYZ回転を度数で設定する。
5. 「現在のポーズをキー登録」。同じフレームなら上書き。未登録ポーズがある間はシーク・読み込みなどを禁止し、登録か破棄を求める。
6. ◆でキーを選択し、移動先フレームを入力して移動・削除する。開始・終了キーは保護する。密なクリップではマーカーだけ間引いて表示し、キー自体は残す。スライダーとコマ送りで全フレームを選択できる。
7. 速度・ループを確認し、編集JSONと再生用GLBを書き出す。GLBにはプレビュー用のキャラクターと1本のアニメーションを含める。

クリップの長さ・動画の区間を縮めると、区間外のキーを除去して補間した終了キーを作る。Undoで戻せる。キーの変更・モデル設定はブラウザにも自動保存する。動画はファイル名・長さ・IN/OUTのみ保存し、ページ再読み込み後は同じ動画を再選択する。

## Hunyuan FBXの取り込み（実験対応）

1. [fal.ai Hunyuan Motion](https://fal.ai/models/fal-ai/hunyuan-motion/api)などから、Hunyuan SMPL-H骨格のFBXを手元に保存する。
2. エディタの「Hunyuan Motion / FBX」で選択し、クリップを選ぶ。
3. 「骨格変換して取り込む」で現在のキーを置き換える（Undo可）。既定ではその場モーションとしてXZ移動を除く。チェックを外すと元の移動量を脚の長さに合わせて変換する。
4. 通常のIK/FK・キー操作で調整する。変換前のFBXは別途保管する。

このエディタはAPIキーを要求せず、課金APIを実行しない。FBX・参照動画・JSONはブラウザ内で処理する。外部FBXのテクスチャは読み込まず、外部URLにもアクセスしない。

## テキストからモーションを生成する（ローカルCLI）

Node 24の標準fetchでfalの[非同期Queue API](https://fal.ai/docs/documentation/model-apis/inference/queue)を呼ぶ。ブラウザ用コードとは分離し、追加SDKは不要。

まず `motion/prompts/walk.json` をコピーして、prompt・duration・seed・guidanceScaleを編集する。durationは0.5〜12秒、guidanceScaleはこのCLIでは0〜20、seedは0〜2147483647に制限する。長い文章より、人物の動作を具体的に書いた英語の短文を推奨。

```sh
# オフラインで送信予定の内容を確認。APIキー不要・通信なし。
just motion-generate plan --input motion/prompts/walk.json

# FAL_KEYをローカル環境変数に設定してから実行。ここだけが新規生成の課金操作。
just motion-generate submit --input motion/prompts/walk.json --out motion/output/walk-001 --execute

# 同じジョブの状態・結果を取得。IN_QUEUE / IN_PROGRESSなら後で繰り返す。
just motion-generate fetch --job motion/output/walk-001
```

`SAVED`と表示されたら、`motion/output/walk-001/motion.fbx` をエディタの「FBXを選択」から取り込む。既定でその場モーションになり、その後は手動のキー編集と同じ操作ができる。

ジャンプは `motion/prompts/jump.json`、斜めの構えから右足を顔の高さまで蹴り上げる動作は `motion/prompts/right-high-kick.json` を使用できる。どちらも3秒の設定。

Git除外済みの `.env` に `FAL_KEY` を保存した場合は、`node --env-file=.env motion/generation/cli.ts fetch --job motion/output/jump-001` のようにNodeから明示的に読み込む。`just motion-generate` は `.env` を自動では読み込まない。

### 安全性と再開

- `plan`はネットワークにも環境変数のAPIキーにもアクセスしない。
- `submit`は `--execute` 必須。出力ディレクトリは新規に限り、既存ディレクトリには送信しない。
- 送信前に `request.json`、受付後に `job.json` を保存する。POSTは自動再試行しない。受付後の再開は必ず `fetch` を使う。
- `request.json`しか残っていない場合、受付が成功したか不明。別名で安易に再送せず、fal管理画面でrequest IDと課金状況を確認する。必要なら、確認できたID・MODEL・request.jsonの内容を用いてjob.jsonを復旧する。受付IDを取得できたのに保存に失敗した場合はCLIがIDを表示する。
- `fetch`は新規生成しない。1回状態を確認し、完了していればFBXと `result.json`（seed・SHA-256・サイズ）を保存する。繰り返しても保存済みFBXは上書きしない。改変・破損を検出した場合は停止する。
- 書き込みは一時ファイルと排他的な公開処理で行う。既存の異なるファイルは保持する。
- APIキーは `FAL_KEY` のみ。JSON・CLI引数・フロントの `VITE_*` に入れない。ログにはAPI応答本文・キーを出さない。CDNへのリクエストにAuthorizationを付けず、リダイレクトも拒否する。
- 成果物のダウンロード先はHTTPSの `fal.media` とサブドメインに限定。32MB超またはFBXヘッダでない応答を拒否する。fal側のCDN仕様が変わった場合は検証付きでアダプタを更新する。
- `motion/output/` はGit管理対象外。入力プロンプトを含む出力を公開したい場合は、内容・利用条件を確認してから別途扱う。
- CLIを終了しても受け付け済みのジョブは継続する。キャンセルはfal管理画面で行う。実際の生成費用や生成結果の利用条件はfalの契約・モデル条件に従う。

HTTPモックで送信・取得・失敗・再開・認証情報の分離を検証している。実アカウントでもジャンプ・右ハイキックを各1回生成し、FBX取得、90キーへの変換、男女素体への適用、GLB出力を確認した。右ハイキックは蹴りの頂点を斜め・側面から確認した。生成FBXと認証情報はGitに含めない。

### 変換の範囲

- `Pelvis`、`Spine1/2/3`、`L_/R_Hip`、`L_/R_Shoulder`など、Hunyuan SMPL-Hの名前と階層に限定。
- 背骨はワールド回転から再構成し、`Spine2`の回転も胸へ合成する。基準姿勢の手足の向きを補正する。
- スケールは左右のうち左脚の実長比から求める。移動は開始位置にリベースし、最初のつま先高さを素体の基準に合わせる。連続的な接地固定ではない。
- 指ボーンは素体に存在しないため省き、トラック数を画面に表示する。不明なトラック・欠落ボーン・矛盾するキーは拒否する。
- FBX読み込み時のEuler補間に起因する同時刻・同回転のキーは統合する。同時刻で異なる姿勢は拒否する。元のクリップは変更しない。
- 出力はプロジェクトのFPSに合わせた全身ポーズキー。自動キー削減はまだ行わない。

fal公式APIページに掲載された公開FBX（約3秒）で、90キーへの変換、正面・側面・背面での表示、キー編集、女性素体への切替、GLB出力を確認した。第三者のFBXはリポジトリに同梱しない。

## コード構成とコントラクト

- `motion/contract.ts`：version 1の編集用JSON、22ボーンの厳密な型・実行時検証。
- `motion/project.ts`：純粋なキー操作・補間・履歴・参照動画時刻の変換。
- `motion/rig.ts`：共通人体リグとの接続、IK構成、ポーズ読書き、AnimationClip生成。
- `motion/viewport.ts`：Three.js表示と既存IKハンドルの接続。
- `motion/video.ts`：ローカル動画の検査、Object URLの寿命管理。
- `motion/import/`：ファイル形式・外部骨格ごとの変換境界。
- `motion/generation/`：Node専用の生成設定、fal HTTPアダプタ、ローカルジョブ管理、CLI。
- `motion/editor.ts`：DOMイベントと編集状態の接続。

姿勢は各ボーンのローカルクォータニオンと、Root/Hipsのレスト位置からのメートル単位オフセット。ポーズキーは全22ボーンを持ち、回転SLERP・位置線形で補間する。対応FPSは24/30/60、UIでの新規作成は30。クリップは最大600秒、最大6000キー、JSONは16MB、FBXは32MB、動画は256MB。

human-viewerの既存GLBモーション注入は最初のRoot/Hips位置を再基準化する。開始位置を含めた完全な編集内容の再現には、本エディタのJSONまたはGLB対応の汎用Viewerを使う。

## 未対応・次の段階

- 動画からの自動姿勢推定（現在は手動ポーズ制作の参照のみ）。
- DeepMotion連携、認証付きの生成サーバー、エディタ上のプロンプト入力。現在はfal用ローカルCLIのみ。
- 自動接地補正、関節制限、身体の衝突回避、指・表情・髪の物理、シームレスなループ生成。
- 曲線エディタ、複数クリップのブレンド、非破壊のキー削減、任意骨格のマッピングUI。
- 接地を維持した体格間リターゲット。モデル切替では回転とメートル単位の位置オフセットを再利用するため、体型を大きく変えた場合は足位置を調整する。

実写相当の動きを4.5等身素体に移した際の関節変形は、モーションとウェイト双方の調整が必要になる場合がある。正面だけで完成扱いにしない。

## 検証

```sh
just motion-check
just test
just test-pages
# 任意の実FBXを使う追加確認。ネットワーク・生成APIは呼ばない。
HUNYUAN_SAMPLE_FBX=/absolute/path/motion.fbx just motion-check
```

通常のPlaywrightテストは同梱の人工テスト動画で実行し、FFmpegや外部サービスをCIの依存にしない。FBXの骨格変換は合成骨格のユニットテストでも検証する。
