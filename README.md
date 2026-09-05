# Petit Quartier

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

http://127.0.0.1:5188 を開くと、Three.jsで町を表示します。

- ドラッグで回転、ホイール／ピンチでズーム、右ドラッグ／2本指で移動。
- 斜め・正面・上面の視点切り替え、全体表示（キャンバスにフォーカスしてFキー）。
- 建物や部品をダブルクリックしてフォーカス。選択したオブジェクト名も表示。
- ワイヤーフレーム、グリッド、自動回転、明るさの調整。
- 「GLBを開く」またはドラッグ＆ドロップでローカルGLBを表示。ファイルをサーバーへアップロードする処理はありません。
- `just build`で町を再生成した後、「町を再読み込み」で更新したGLBを表示。

外部ファイルに依存しないGLB 2.0を想定しています。Draco・KTX2等の追加デコーダーが必要な圧縮形式やアニメーション再生は未対応です。表示寸法はglTFのメートル単位に従います。

`just viewer-build`でGLBを含む静的配信用の`dist/`を生成し、`pnpm preview`で確認できます。静的ビルドにはビルド時点の町が含まれるため、町を更新したらビューアも再ビルドしてください。

画面と入力処理は`viewer/main.mjs`、モデルの計測・カメラ距離計算・解放処理は`viewer/model.mjs`に分離しています。

`just test`でGLB形式とカメラ・計測ロジック、`just test-e2e`でPlaywrightによる表示・視点切り替え・ファイル選択・エラーからの復帰・モバイル表示を検証します。初回にテスト用ブラウザがない場合は`pnpm exec playwright install chromium`を実行してください。

## 再生成

Blender 5.0.1、Node.js 24、pnpm、justで動作確認しています。

```sh
pnpm install
just all
```

`just build`でGLBとblendを生成し、GLBの再読み込みと寸法を検証します。`just test`でKhronosのglTF Validatorによる形式検証、外部ファイルに依存しないこと、主要な構成要素の存在を確認します。`just render`でPNGを生成します。

macOSでは `/Applications/Blender.app/Contents/MacOS/Blender`、それ以外ではPATH上の`blender`を使用します。別の場所にある場合は`BLENDER`環境変数を指定してください。

生成元は[scripts/build_town.py](scripts/build_town.py)です。`PALETTE`で配色、`create_town()`で建物・小物の配置、`stage()`で撮影条件を変更できます。乱数シードは固定しています。
