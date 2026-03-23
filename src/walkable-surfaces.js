// Walkable surfaces are authored against the normalized model bounds after centering.
// x/z are center positions in model-width/model-depth units where 0 is the center.
// width/depth are also in model-width/model-depth units.
// y is the world-space height after model scaling.
export const WALKABLE_SURFACE_DEFS = [
  {
    id: "perimeter-base",
    type: "rect",
    x: 0,
    z: 0,
    width: 1.45,
    depth: 1.45,
    y: 0.55,
  },
];
