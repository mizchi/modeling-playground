# Scene Studio / IRON YARD

モデル、攻撃演出、音声、配置、ミッション進行を1つの試遊に接続するプリプロ用の試作。
開発場所は modeling-playground。kagura はリファクタリング後に統合するため、依存も変更も加えていない。

現在は試行を優先し、本格的な設計はkagura接続時に行う。[試作で得た知見・次に試す仮説](prototyping-notes.md) に、引き継ぎたいことと未検証のことを記録する。

## 起動と操作

Node.js 24+ / pnpm / just / FFmpeg を使用する。WAV・MP3はGit管理外のため、初回は音源を生成する。

```sh
pnpm install
just audio-generate
just scene-editor
```

`http://127.0.0.1:5188/scene-editor.html` を開く。

1. 階層リストまたは3D上で機体・建物を選択。Inspectorで位置、建物サイズ・色、敵の向き、出撃地点を編集する。
2. 「表示する波」でプレビューを切り替える。「＋ 敵機」はその波に追加。「＋ コンテナ」は空き領域に追加する。
3. 「攻撃・エフェクト」で反動、閃光、ダメージ、連射間隔、発射音・命中音を編集。「攻撃を再生」は1発の実判定、時間スライダーは無音のシーク。
4. 「保存」はこのブラウザの localStorage に保存。「JSON書出」で持ち出し、「読込」で戻す。不正なバージョン、非有限数、欠落した参照、障害物内の出撃地点などは拒否する。
5. 「試遊」で現在のドキュメントのコピーを起動する。Esc →「編集に戻る」で編集状態を維持したまま停止。Undo/Redoは最大50件、入力欄以外では Cmd/Ctrl+Z / Shift+Z も使える。

ゲーム単体は `/game.html`。初期シーンは180秒以内・3波・合計9機の防衛戦。
全機撃破で勝利、APゼロまたは時間切れで敗北。波を突破するとAPを200回復する。
再出撃はHP、敵、弾、ロック、時計、音声をリセットする。
静止標的の演習モードでは最初の波のみを使用し、敵AIと時間制限は停止する。

WASDで移動、右ドラッグまたはマウス固定で視点、左クリックで連射、E長押し→離すとミサイル。
Shiftでブースト、Space短押しでジャンプ、長押しで上昇。Esc、フォーカス喪失、タブ非表示で停止。
BGM・効果音の音量は出撃メニューで独立して調整できる。

## データと実装の境界

| 層 | ファイル | 内容 |
| --- | --- | --- |
| コントラクト | `game/studio/contracts.ts` | バージョン1のScene / Action / GameEventと入力検証 |
| 純粋な状態遷移 | `game/combat.ts`, `game/studio/mission.ts` | 発射・衝突・撃破・波・勝敗。DOMや音声ノードを含まない |
| 編集 | `history.ts`, `operations.ts`, `editor.tsx` | スナップショット、配置、Undo/Redo、読込／書出 |
| 演出 | `action.ts`, `effects.ts`, `preview-simulation.ts` | 時刻による反動・閃光・火花、同じ戦闘処理による再現 |
| ブラウザ実装 | `Game.tsx`, `CombatScene.tsx`, `Robot.tsx`, `audio.ts` | R3F/three.js描画とWeb Audio。後で差し替える層 |
| 移植検証 | `integration/moonbit` | 同じJSONをMoonBitで読み、mizchi/threeのGroup/Meshへ変換 |

座標はメートル、Y-up、機体前方+Z、角度はラジアン、時間は秒。SceneにはThree.jsオブジェクト、関数、DOM、URLを保存しない。
`assets` は `model.strix` / `model.bastion` / `bgm.battle` という安定ID。
`stage.targets` は全波の配置を持ち、`mission.waves[].targets` が敵IDを参照する。
各敵はちょうど1波に所属する。別の波では同じ場所に配置できる。
建物は軸に沿った直方体のコライダーであり、現段階では回転しない。

Actionはライフル1種。`cooldown`, `damage`, `flashDuration`, `flashColor`, `recoilDuration`, `recoilStrength`, `shotSound`, `hitSound` を持つ。
プレビューの射撃とゲームの射撃は `advanceCombat` を共有し、空間内で弾が衝突した時点で命中する。
タイムラインを戻すとゼロ時刻から純粋に再計算する。シークは音声やゲーム状態を変更しない。

GameEventは `shot`, `impact`, `destroyed`, `player_hit`, `lock_ready`。
`id` は1回のプレイ内で単調増加する。`time` は戦闘のシミュレーション時刻、`position` はワールド座標。
`entityId` は対象がない場合null、`weapon` はrifle / missile / enemy / null。
描画中の弾の有無からSEを推測せず、実際のイベントを消費する。これにより同一フレームに生まれて消える弾も音になる。
音声アダプターはIDで重複再生を防ぎ、SEを最大12声に制限。撃破と同時の命中音は爆発にまとめる。
将来フレーム転送する場合は `FramePacket` のrunId/tickを使い、再出撃時に受信側の消費済みIDもリセットする。
現在は同じJSプロセス内で関数を直接呼んでおり、転送プロトコル自体は未実装。

## MoonBit / mizchi/three

```sh
just moonbit-bridge-check
```

独立した `mizchi/scene-bridge` パッケージが `mizchi/three@0.1.3` を参照する。
MoonBitコンパイラーでJSを生成し、Node上で実際のThree.jsオブジェクトを検査する。
初期シーンの23ノード（13建物、9敵マーカー、1出撃地点）、座標、建物サイズ、未知バージョンの拒否を確認する。
これは配置データの互換性検証。GLB読込、アニメーション、戦闘、音声のMoonBit移植はまだ行っていない。
MoonBit側の簡易デコーダーは描画に必要なフィールドのみを読むため、実運用の入口ではScene全体の検証を先に通す。

kaguraのAPIが落ち着いたら、入力・時刻・アセット解決をアダプターに接続し、まずScene読込、次にGameEventの演出消費、最後に純粋な状態遷移の移植を進める。
現在のJSONにkagura内部型を埋め込まないことで、その時点のAPIに合わせられる。

## 音声の由来・配布

media-studioの作曲・合成・検証機能と全音源は `audio/` に統合した。[音源と再生成の手順](../audio/README.md)。
`audio/game-assets.json` に、ゲーム用ID、現在のパス、media-studioの元ファイル・コミット `035fe2c`・SHA-256を記録。
ゲームと攻撃プレビューは `audio/output/` のWAVを直接参照する。WAV・MP3はローカルまたはCIで生成し、Gitにコミットしない。生成・ビルドとも隣のリポジトリへの依存やゲーム用コピーは不要。
発射音は打撲音を短く高めに再生し、命中音に剣ヒット、撃破に爆発、メニューに決定／キャンセルを使う。
今回の試作では専用の銃声や新しい音源は生成していない。

```sh
just game-check
pnpm build
pnpm preview
```

`dist/` が静的配布物。ゲームとScene Editorを含み、相対パスでGLB・音声を読み込む。
HTTPサーバーで配信する。公開・デプロイはこの作業では行わない。

現段階は固定の2機体・1種類の攻撃・直方体の環境編集が対象。
汎用パーティクルグラフ、Transformギズモ、任意の外部アセットの取り込み、Prefab継承、Undoの永続化は未実装。
180秒の制限時間は実装済みだが、難易度や平均クリア時間の調整には実際のプレイ評価が必要。
