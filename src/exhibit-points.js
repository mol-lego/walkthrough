// Exhibition viewpoints and points of interest are authored against the
// normalized model bounds after centering.
// x/z values are relative to model width/depth where 0 is the center.
// y values are world-space heights after model scaling.

export const WARP_SPOT_DEFS = [
  {
    id: "balcony-01",
    title: "Balcony View",
    hint: "2階の眺望へ移動 [F]",
    x: 0.12,
    z: -0.1,
    y: 5.3,
    yaw: Math.PI * 0.9,
    pitch: -0.1,
  },
  {
    id: "upper-canal-01",
    title: "Upper Canal View",
    hint: "3階相当の眺望へ移動 [F]",
    x: -0.15,
    z: -0.14,
    y: 8.1,
    yaw: Math.PI * 0.18,
    pitch: -0.16,
  },
  {
    id: "bridge-01",
    title: "Bridge Outlook",
    hint: "橋上の見晴らしへ移動 [F]",
    x: 0.02,
    z: 0.04,
    y: 2.4,
    yaw: Math.PI,
    pitch: -0.06,
  },
];

export const POI_DEFS = [
  {
    id: "bridge-01",
    number: "bridge-01",
    name: "Stone Bridge",
    owner: "未設定",
    hint: "橋の構成を見る",
    description:
      "橋のアーチ、手すり、両岸との接続がこの作品の空間の芯になっています。将来的にはここに実物写真や制作メモを表示できます。",
    x: 0.03,
    z: 0.01,
    y: 3.2,
  },
  {
    id: "canal-house-01",
    number: "canal-house-01",
    name: "Canal House",
    owner: "未設定",
    hint: "建物の立面を見る",
    description:
      "運河沿いの建物ファサードを観察するための対象です。窓やベランダの情報を追加すれば、上階ビューポイントと強く連携できます。",
    x: 0.12,
    z: -0.16,
    y: 5.6,
  },
  {
    id: "tower-01",
    number: "tower-01",
    name: "Bell Tower",
    owner: "未設定",
    hint: "塔を見る",
    description:
      "遠景で世界観を締めるランドマーク想定です。作品元ネタの建物情報や実在写真を重ねるなら、ここが代表的な POI になります。",
    x: -0.1,
    z: -0.22,
    y: 9.8,
  },
];
