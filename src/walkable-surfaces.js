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
  {
    id: "balcony-upper-01",
    type: "rect",
    x: 0.12,
    z: -0.1,
    width: 0.12,
    depth: 0.08,
    y: 5.3,
  },
  {
    id: "balcony-upper-02",
    type: "rect",
    x: -0.15,
    z: -0.14,
    width: 0.1,
    depth: 0.08,
    y: 8.1,
  },
  {
    id: "bridge-upper-01",
    type: "rect",
    x: 0.02,
    z: 0.02,
    width: 0.1,
    depth: 0.08,
    y: 2.4,
  },
];
