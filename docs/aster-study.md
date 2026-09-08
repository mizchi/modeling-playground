# ASTER — 長い手足の独立したローポリ試作

LILA / `fes256` のソース・GLB・表情を変更せず、別モデル `aster` として制作。約4等身、金髪ロング＋アホ毛、大きい袖、短い上着と長い脚を持つ配達人。提示された作例の配分と面構成を参考にした独自デザインであり、特定の作例の復元ではない。

## 前回から変えたこと

- **短い首を残す**。マフラーは削除したまま、首の完全省略は取り消した。顎と肩の間を0.06離し、細い六角断面の首を置く。首メッシュはChestへ接続し、頭は既存のHeadボーンで回転する。手足の長さ・関節は維持。
- **小さい顔と大きい髪の対比**。顔と頭皮の幅を22%、高さを14%、奥行きを10%縮小。UVと顎の取付基準を固定し、髪全体は縮小しない。前髪と横髪の間は小さい頭に合わせて閉じる。髪が頭全体のおよそ半分以上を占める見た目を目指す。体積の厳密な半分を意味するものではない。
- **顔のメッシュそのものへテクスチャを貼る**。前回のように顔面の上へ別の表情面を重ねない。側頭部・後頭部は正面の境界を共有し、髪は独立メッシュ。
- **目元は広く浅い面**。鼻の中心だけ控えめに前へ出し、頬から顎を後ろへ収束させる。XYの表情配置と、Zの横顔調整を分離する。
- **手足を長くし、関節を増やす**。肩→肘→手、股→膝→足の連鎖。肘と膝の近くに中間ウェイトを置く。単に旧モデル全体を引き伸ばしたものではない。
- **頭へ沿う金髪ロング**。浮いた前髪の板を重ねる構造をやめ、頭頂・前髪・こめかみを連続した面にする。裏側は頭皮へ折り返す。髪は光を受ける材質、顔と身体はunlitを維持し、表情は256×256アトラスと線形フィルタを使用。
- **半球寄りの頭頂**。円筒状の側面＋平たい天面が斜め見下ろしでバケツに見えた。最大幅を眉寄りの高さへ下げ、上へ段階的に絞る断面を追加。頭頂の平面を小さくし、共有頂点の法線と色をつなげて水平な帯を弱めた。
- **球形よりも束の流れを優先**。丸い外形だけではヘルメットの印象が残る。前髪は偏った分け目から横へ流れる列と不揃いの毛先、横髪は稜線を持つ五角断面、後ろ髪は頭頂から続く5本の稜線と谷をメッシュに作り込んだ。色は毛流れに沿う弱い補助にとどめる。細かい毛筋や多数のヘアカードは追加していない。
- **後ろ髪を頭頂につなげる**。独立した2枚の平板を廃止し、後頭部を包む連続した断面へ変更。頭頂と後ろ髪の根元を同じ座標で接続し、中央は左右のボーンのウェイトを混ぜる。束ごとの細かな独立挙動より、根元と中央が裂けない構造を優先した。

参考：[TECH-COYOTEの顔制作手順図](https://3d.crdg.jp/tech/wp-content/uploads/2020/11/model_ss06.png)。正面の仮テクスチャを基準に横顔のZを調整し、目・口の面の傾斜を抑えるという考え方を採用した。画像そのものをテクスチャへ転用してはいない。

## 仕様と再生成

888三角形、約39.6 KiB、5メッシュ、32ボーン（身体16＋髪16）。ロングヘアの可動部と束の立体形状のため、開発上限を896三角形／64 KiBへ変更した。厳密な256三角形以内の作品ではない。

```sh
just aster
node --test tests/aster.test.ts tests/aster-hair.test.ts
pnpm exec playwright test tests/e2e/aster.spec.ts
```

- `human/models/aster/src/definition.ts`：配色・予算・ボーンと取付点。
- `human/models/aster/src/head.ts`：固定されたXY配置と、額・鼻・頬・顎のZ断面。
- `human/models/aster/src/texture.ts`：通常・笑顔・怒り・驚き・瞬き・ウインクの描画。
- `human/models/aster/src/hair.ts`：髪の形状、ボーン階層、ウェイト、物理接続用ヒント。
- `contracts/hair.ts` / `contracts/hair.types.ts`：髪の制御データの実行時検査・型。
- `runtime/hair-rig.ts`：物理エンジン非依存の関節制御・リセット。
- `human/models/aster/src/model.ts`：身体、スキニング、各メッシュの接続。

`just aster`は[頭単体](../human/models/aster/output/parts/aster-head.glb)・[髪単体](../human/models/aster/output/parts/aster-hair.glb)も出力する。両者は同じHeadローカル原点で、移動せず重ねて組み立てられる。これらは全身モデルとは別の編集用GLBで、Viewerの一覧には追加していない。[髪を外した頭](../human/models/aster/output/aster-head-only.png)も確認できる。

表情は既存の `ExpressionAtlas` によるUV切替。表情を変えても顔の頂点は動かない。他のアプリで切り替えるにはこの契約を読む処理が必要。GLB単体でも保存時の表情を表示できる。

## 物理演算を接続するための髪リグ

`Hair`はSkinnedMesh。`HairAnchor`と、左右の横髪・左右の後ろ髪・アホ毛の5系統×3ボーンを持つ。根元は固定し、中間と毛先を回転させる。頭頂と前髪はAnchorへの100%ウェイト、長い部分は各関節の断面へウェイトを割り当てる。

GLBではスキンのメッシュをScene直下に置き、ボーンのAnchorだけをHeadへ接続する。メッシュをHeadの子へ置くとglTF Validatorの`NODE_SKINNED_MESH_NON_ROOT`警告が出るため、この構造を守る。Viewerは`focusTargetName: Head`を参照し、髪をクリックしても頭へフォーカスする。

```js
import { Quaternion, Vector3 } from 'three';
import { HairRig } from './runtime/hair-rig.ts';
const hair = new HairRig(gltf.scene.getObjectByName('Hair'));
hair.setJoint('side-left', 1, new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.3));
hair.reset();
```

チェーンIDは`side-left` / `side-right` / `back-left` / `back-right` / `ahoge`。関節0は固定で操作を拒否、1と2をバインド姿勢からのローカル回転差分で制御する。未知ID・不正なQuaternion・上限角度を超える操作は拒否する。

`Hair.userData.hairDynamics`にチェーン、固定根元、半径、硬さ、減衰、上限角度と、頭・胸・肩の球コライダー案を保存。ボーン位置から節の長さを取得できる。コライダーはキャラクター側のボーンローカル座標なので、髪単体を別モデルへ取り付ける際は対応付けが必要。

**まだ物理ソルバーではない。** 硬さ・減衰・コライダーの値は将来のソルバー向けヒントで、現在は重力、慣性、衝突応答、自動の揺れを実行しない。エンジンは未選定。曲げ確認は関節を手動指定したテスト用ポーズであり、物理シミュレーションの結果ではない。

## 確認と残る制約

[ローカルViewer](http://127.0.0.1:5188/?model=aster) / [GLB](../human/models/aster/output/aster.glb) / [斜め](../human/models/aster/output/aster-quarter.png) / [正面](../human/models/aster/output/aster-front.png) / [側面](../human/models/aster/output/aster-side.png) / [背面](../human/models/aster/output/aster-back.png) / [顔](../human/models/aster/output/aster-face.png) / [ワイヤー](../human/models/aster/output/aster-face-wire.png) / [曲げ確認](../human/models/aster/output/aster-pose.png) / [曲げ側面](../human/models/aster/output/aster-pose-side.png)。

正面偏重を避け、[左斜め見下ろし](../human/models/aster/output/aster-high-left.png) / [右斜め見下ろし](../human/models/aster/output/aster-high-right.png) / [斜め後ろ見下ろし](../human/models/aster/output/aster-high-back.png) / [見上げ](../human/models/aster/output/aster-low-angle.png) / [髪の曲げ](../human/models/aster/output/aster-hair-bend.png) / [髪の曲げ・側面](../human/models/aster/output/aster-hair-bend-side.png)をE2Eで生成。ASTERの初期カメラも見下ろし寄りへ変更した。

[髪の曲げ・背面](../human/models/aster/output/aster-hair-bend-back.png)も追加。画像を生成したことと、実際に見て検査したことを区別する。今回の背面リテイクは、最初に生成済みの背面を十分に目視していなかったのが原因。[修正前の背面](../human/models/aster/output/aster-before-back-fix.png) / [修正前の後ろ斜め](../human/models/aster/output/aster-before-back-fix-quarter.png)を残し、後頭部から毛先の連続性、中央の割れ、平板の貼り付け感を比較する。

単体テストは比率、短い首の幅と接続位置、顔と髪の外接矩形の比率、髪と頭の厚みの差、部品の独立性、顔の突出量、表情切替時の形状不変、関節の頂点追従、三角形の面積、全身／部品GLBの再生成一致とValidatorを検査する。外接矩形は見た目を守る近似指標であり、髪の画面占有面積の実測ではない。E2Eでは再読込・表情切替・各方向・モバイル・旧モデルへの切替・髪を取り外した表示を検査する。

曲げ確認はテスト用の一時的なポーズをGLBとして再読込して撮影したもの。通常の `aster.glb` にアニメーションクリップはまだ付けていない。歩行・IK・足の接地制御は次の工程。簡易ウェイトのため、肩を大きく上げる、膝を深く畳むなど全可動域の非交差を保証するものではない。

少ない面では、隣接する三角形を別々の位置判定で塗るとブーツや服の境目が斜めに割れる。今回は四角面単位で色を決めた。横髪を尖った板として重ねると外殻との間に隙間が残ったため、厚みのある束へ変更し、その上端を頭頂内へ差し込む。髪の谷のような凹形状では、全体の重心から面の表裏を推定せず、接続順で表裏を定義する。数値テストの通過と、自然に見えるという評価は分けて扱う。

次のリテイクでは「別メッシュにしてある」だけで分離できたと考えず、頭を単体で確認し、髪の厚みを頭蓋との距離として設計する。また、首の違和感を大きなマフラーで隠すことは、首の省略とは違う。今回の[変更前・斜め](../human/models/aster/output/aster-before-volume-quarter.png)／[変更前・側面](../human/models/aster/output/aster-before-volume-side.png)を比較用に残した。

その後、首を完全に省くのも極端との指摘で短い首へ戻した。小顔化する前の[全身](../human/models/aster/output/aster-before-small-face-quarter.png)／[顔](../human/models/aster/output/aster-before-small-face.png)も比較用に保存。顔を縮めると髪の内側に隙間ができるため、外側の量感だけでなく、内側とこめかみ側の接続も再調整する。

金髪への変更前の[顔](../human/models/aster/output/aster-before-long-hair-face.png)／[側面](../human/models/aster/output/aster-before-long-hair-side.png)、丸める前の[頭頂](../human/models/aster/output/aster-before-rounded-crown.png)も保存。今回追加した確認は髪リグの再読込・固定根元・頂点変形・リセット・不正設定拒否・頭回転への追従・頭頂断面の絞り。顔が見えることだけで髪の取付や頭頂の形を合格にしない。
