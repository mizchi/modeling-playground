# Audio Studio — BGM・効果音の試作

media-studio の機能を modeling-playground の `audio/` に移動しました。モデル・音声・ゲーム内プレビューを横断した知見は [試作記録](../docs/prototyping-notes.md) を参照してください。今は試行を優先し、本格設計はkagura接続時に行います。

以下のコマンドは modeling-playground のルートで実行します。WAV・MP3はGitに含めず、`just audio-generate` で生成します。このページの試聴リンクは生成後のローカルファイルを指します。

## 効果音

[5種類を続けて試聴](output/sfx/00-demo.mp3)（約6.34秒、爆発 → 決定 → キャンセル → 剣ヒット → 打撲）

| 効果音 | 長さ | 試聴 | ゲーム用 |
| --- | --- | --- | --- |
| 爆発 | 1.90秒 | [MP3](output/sfx/01-explosion.mp3) | [WAV](output/sfx/01-explosion.wav) |
| 決定 | 0.28秒 | [MP3](output/sfx/02-confirm.mp3) | [WAV](output/sfx/02-confirm.wav) |
| キャンセル | 0.24秒 | [MP3](output/sfx/03-cancel.mp3) | [WAV](output/sfx/03-cancel.wav) |
| 剣のヒット | 0.48秒 | [MP3](output/sfx/04-sword-hit.mp3) | [WAV](output/sfx/04-sword-hit.wav) |
| 打撲 | 0.34秒 | [MP3](output/sfx/05-blunt-hit.mp3) | [WAV](output/sfx/05-blunt-hit.wav) |

効果音は 48 kHz / 16-bit / stereo WAV。ワンショット再生用で、残響を先頭に折り返す処理は使っていません。
決定音は上行、キャンセル音は下行。剣ヒットには金属の短い響き、打撲には低い衝撃、爆発には低音とノイズの余韻を重ねています。
すべて波形合成で作成し、録音サンプルや外部の音声生成サービスは使用していません。
ゲーム内の最終音量はミキサーで調整してください。UI 音のピークは衝撃音より控えめに設定しています。

```sh
just audio-sfx
```

`src/sfx-presets.mjs` に各音のレイヤーとパラメーター、`src/sfx.mjs` に合成処理を分離しています。
各音の `.preset.json`、試聴順と開始時間を記載した `output/sfx/manifest.json` も保存します。
`output/sfx/verification.json` に WAV 形式・音量・末尾・MP3 デコードの検証結果を保存します。
自動検証は聴感による品質評価を含みません。

## 戦闘曲「閃光の誓い / Oath of the Lightning」

ヒロイックで緊張感のあるチップチューン。184 BPM、E minor を中心とする40小節、約52.174秒のループです。

- [試聴 MP3](output/03-oath-of-the-lightning-battle.mp3)
- [ゲーム組み込み用 WAV](output/03-oath-of-the-lightning-battle.wav)
- [編集用 MIDI](output/03-oath-of-the-lightning-battle.mid)
- [譜面 JSON](output/03-oath-of-the-lightning-battle.score.json)

| 時間 | 展開 |
| --- | --- |
| 0:00 | 低めのリフとドラムで開始 |
| 0:05 | 跳躍する主題 |
| 0:16 | 半音の動きと高音への展開で緊張を強める |
| 0:26 | G major 側へ開き、長い音価のヒロイックな旋律 |
| 0:37 | 主題の再現とクライマックス |
| 0:47 | F → B7 の緊張を経て、冒頭の Em に戻る |

パルス波の主旋律と対旋律、16分音符のアルペジオ、三角波ベース、合成キックとノイズ打楽器を使用。
外部サンプルを使わず生成しています。実機の同時発音数制約を再現した曲ではありません。
約 -16 LUFS。前の比較用2曲より音量が大きめです。
MP3 は試聴用、正確な長さでのループには WAV を使用してください。
MIDI の音色とエコーは WAV と異なります。

再生成と検証: `just audio-battle`。作曲は `src/battle-score.mjs`、音色合成は `src/battle-synth.mjs`。
検証結果は `output/battle-verification.json` に保存します。音楽的な品質の聴感評価は別途必要です。

## 音色比較「風の道」

オリジナル曲「風の道 / Windward Trail」を2種類の音色で比較する試聴用プロトタイプ。

| ファイル | 内容 |
| --- | --- |
| [チップチューン版](output/01-windward-trail-chip.mp3) | 矩形波風リード、短いアルペジオ、電子音ベース |
| [生楽器音色版](output/02-windward-trail-acoustic.mp3) | フルート、ナイロンギター、アコースティックベース、弦、ピアノ |

共通仕様: D major、104 BPM、4/4、16小節、約36.923秒。明るい探索・冒険フィールド向け。
旋律・和声・音符の配置を共通にし、音色・音の長さ・バランス・残響を変えています。
生楽器版はサンプル音源による打ち込みです。生演奏や音楽生成モデルによる録音ではありません。

## 試聴

`output/` の MP3 を通常の音楽プレイヤーで再生してください。ゲームへのループ組み込みには同名の WAV を使用します。
WAV は 44.1 kHz / 16-bit / stereo、末尾の残響を先頭へ折り返したループ素材です。
MP3 は試聴用で、プレイヤーによってループ時に隙間が入ります。
両方を約 -20 LUFS に揃えています。

評価したい点:

- メロディが印象に残るか、繰り返しても疲れないか
- 想定するゲーム画面に合うか
- 電子音の心地よさ／楽器音色の自然さ
- メロディと伴奏のバランス、ループのつながり

MIDI と `.score.json` も同梱しています。MIDI の再生音色・音量・残響は再生側の音源に依存し、WAV と同じ音にはなりません。
JSON の `start` / `duration` は拍単位、`pitch` / `velocity` は MIDI 値です。

## 再生成

Node.js 24+、pnpm、just、FFmpeg が必要です。音声の生成処理にはnpmの追加依存はありません。

```sh
just audio-generate   # 比較用2曲、戦闘曲、5種のSEをすべて再生成・検証
just audio-test       # 合成・譜面・生成した素材のテスト
just audio-check      # テストと全音源の検証（再生成しない）
```

個別には `just audio-bgm`（比較用2曲）、`just audio-battle`、`just audio-sfx`。検証のみは `just audio-verify`。

新しいチェックアウトでは、`pnpm test`・`pnpm dev`・`pnpm build` の前に `just audio-generate` を実行してください。
CIもFFmpegをインストールしてから生成し、テスト・ビルドへ進みます。生成した音源は配布ビルドには含まれますが、Gitには追加しません。
作曲・合成コード、譜面JSON・MIDI、プリセット、マニフェスト、ライセンスをGitで管理します。既存のGit履歴の書き換えは行いません。

初回の比較用2曲の生成は楽器サンプルをダウンロードします。以後は `audio/.cache/samples/` を再利用します。このキャッシュはGit管理外です。戦闘曲とSEは外部サンプルを必要としません。
`src/score.mjs` が作曲・編曲、`src/audio.mjs` が合成と出力、`src/samples.mjs` が音源読み込みです。
`output/verification.json` に波形の長さ・ピーク・ループ境界・MIDI 検証結果を保存します。
自動検証は音楽的な良し悪しや自然な演奏感を判定するものではありません。

## ゲームへの接続

ゲームと攻撃プレビューは `audio/output/` のWAVを直接参照します。`game/assets/audio/` へのコピーは不要です。
再生成後はViteの開発画面の再読込、または `pnpm build` で取り込みます。参照元は `game/studio/audio.ts`。
[game-assets.json](game-assets.json) に、ゲーム用の安定ID、`audio/` 基準のパス、元のmedia-studioコミット `035fe2c` と出典、採用音源のSHA-256を記録しています。
意図的に採用音源を差し替えるときは、試聴・検証後にこのチェックサムも更新します。

元のmedia-studioリポジトリの実行コード・出力はこのディレクトリへ移し、元側には移動案内とGit履歴を残します。
移行時に全51ファイルの内容を照合しています。再生成した戦闘MP3はタイトルタグだけが元ファイルと異なり、デコードした音声は一致しました。元のタグを含む採用済みMP3は移行作業時のローカルファイルとして保持しており、コミットには含めません。

## 音源の出典

生楽器音色は [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) の
FluidR3_GM プリレンダリング音源を使用しています。
同プロジェクトの README は Fluid 音源を [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) と表記しています。
音源作者: Frank Wen / Fluid SoundFont、プリレンダリング: Benjamin Gleitzman。
本試作では音量・エンベロープを調整し、オリジナルの譜面に配置、ミックス・残響を加えています。
配布元のソフトウェアライセンスは `THIRD_PARTY_LICENSES/midi-js-soundfonts.txt` に保存しています。
