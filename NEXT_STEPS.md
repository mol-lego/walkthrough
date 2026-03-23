# Next Steps

## Current Status

- Three.js ベースの PC 向けウォークスルー試作は起動可能
- `venice.glb` の表示、WASD 移動、視点変更、ジャンプは実装済み
- 見た目の調整はある程度進んだ
- ただし床判定はまだ不安定で、運河や低い面へ吸われる箇所が残る

## Tomorrow's Priorities

1. 表示モデルと当たり判定モデルを分離する
2. `public/models/venice_collision.glb` を追加する前提で読み込み構造を作る
3. collision モデル内のメッシュを用途別に分ける
4. 既存の色・法線ベース床判定を廃止する
5. 接地判定と壁衝突を collision モデル基準へ置き換える

## Recommended Collision Model Rules

- `walk_*`: 歩ける面
- `wall_*`: 通れない面
- `climb_*`: 将来の登攀面
- `water_*`: 水面や落下領域

## Notes

- collision モデルは見た目ではなくゲームプレイ優先で単純な箱形状にする
- 路面、橋、運河、外周底面は明示的に作る
- 屋根には `walk_*` を置かない
- 将来の LEGO ゲーム寄り挙動を考えると、2D マップより 3D collision モデルの方が拡張しやすい
