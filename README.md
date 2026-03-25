# walkthrough

Three.js ベースの PC 向け最小ウォークスルー試作です。`public/models/venice.glb` を読み込み、一人称視点で静かに街を歩く感覚の確認を目的にしています。

## 起動方法

```bash
npm install
npm run dev
```

ブラウザで表示された画面を開き、`Enter walkthrough` を押すかキャンバスをクリックすると操作を開始できます。

## 操作

- `W` `A` `S` `D`: 前後左右移動
- マウス移動: 視線変更
- `Space`: ジャンプ
- `F`: 視界に入った高所マーカーの場所へ移動
- `Esc`: ポインタロック解除

## 現在の仕様

- カメラ高さは固定です
- 移動速度は遅めに設定しています
- 床判定は簡易実装で、将来的に collision モデルへ置き換える前提です
- 視界に入った建物情報を自動表示します
- ベランダやテラスなどの高所には開発用の発光マーカーを表示しています
- 高所マーカーを見上げた状態で `F` を押すと、その場所へ移動できます
- PC での成立確認を優先しており、モバイル対応はしていません

## 補足

- `venice.glb` は約 24MB あり、初回読み込みに少し時間がかかる可能性があります
- まずは自由移動の試作で、将来的にレール型ウォークスルーへ切り替えやすいよう、移動処理は `src/main.js` に分離しています
- 歩ける面は [`src/walkable-surfaces.js`](/Users/mamoru/github/walkthrough/src/walkable-surfaces.js) で追加できます
- 注目対象と眺望スポットは [`src/exhibit-points.js`](/Users/mamoru/github/walkthrough/src/exhibit-points.js) で調整できます

## 歩行面の定義

`src/walkable-surfaces.js` では、モデル全体の幅・奥行きに対する相対値で矩形の歩行面を定義できます。

```js
{
  id: "canal-main",
  type: "rect",
  x: 0.1,     // 中心からの相対位置
  z: -0.05,   // 中心からの相対位置
  width: 0.3, // モデル幅に対する比率
  depth: 0.12,// モデル奥行きに対する比率
  y: 0.8      // ワールド座標の高さ
}
```

まずは `perimeter-base` のような大きな底面を置き、その上で「運河」「路地」「広場」を矩形で足していく運用を想定しています。
