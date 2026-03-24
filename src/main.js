import "./style.css";

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { POI_DEFS, WARP_SPOT_DEFS } from "./exhibit-points.js";
import { WALKABLE_SURFACE_DEFS } from "./walkable-surfaces.js";

const CAMERA_HEIGHT = 2;
const WALK_SPEED = 4;
const DRAG_SENSITIVITY = 0.0018;
const MAX_PITCH = Math.PI / 2 - 0.08;
const TARGET_WORLD_HEIGHT = 18;
const SURFACE_RAY_HEIGHT = 40;
const SURFACE_MAX_DROP = 80;
const MAX_STEP_UP = 0.45;
const MAX_STEP_DOWN = 1.4;
const JUMP_VELOCITY = 4.2;
const GRAVITY = 12;
const MIN_WALKABLE_HEIGHT = 0.55;
const START_POSITION = new THREE.Vector3(0, CAMERA_HEIGHT, 8);

const app = document.querySelector("#app");

app.innerHTML = `
  <canvas class="stage" aria-label="Venice walkthrough"></canvas>
  <div class="hud">
    <div class="hud__title">Venice Walkthrough</div>
    <div class="hud__hint">Click to enter. WASD to move. Drag to look. Space to jump. F to move to scenic spots.</div>
  </div>
  <div class="reticle" aria-hidden="true"></div>
  <div class="focus-hint" data-focus-hint></div>
  <div class="info-panel" data-info-panel aria-live="polite">
    <div class="info-panel__eyebrow" data-info-context></div>
    <h2 class="info-panel__title" data-info-title></h2>
    <p class="info-panel__body" data-info-body></p>
  </div>
  <div class="overlay overlay--active" data-overlay>
    <button class="overlay__button" type="button" data-enter>Enter walkthrough</button>
    <p class="overlay__note">PC only prototype. Move at minifigure scale and find a few quiet viewpoints.</p>
  </div>
  <div class="status" data-status>Loading Venice model...</div>
`;

const canvas = document.querySelector(".stage");
const overlay = document.querySelector("[data-overlay]");
const enterButton = document.querySelector("[data-enter]");
const status = document.querySelector("[data-status]");
const focusHint = document.querySelector("[data-focus-hint]");
const infoPanel = document.querySelector("[data-info-panel]");
const infoContext = document.querySelector("[data-info-context]");
const infoTitle = document.querySelector("[data-info-title]");
const infoBody = document.querySelector("[data-info-body]");

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc8dced);
scene.fog = new THREE.Fog(0xc8dced, 22, 78);

const pmremGenerator = new THREE.PMREMGenerator(renderer);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 250);
camera.position.copy(START_POSITION);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 14;
ssaoPass.minDistance = 0.0008;
ssaoPass.maxDistance = 0.03;
ssaoPass.output = SSAOPass.OUTPUT.Default;
composer.addPass(ssaoPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.08,
  0.35,
  1.0,
);
composer.addPass(bloomPass);

const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);

const sunDirection = new THREE.Vector3();
const elevation = THREE.MathUtils.degToRad(24);
const azimuth = THREE.MathUtils.degToRad(205);
sunDirection.setFromSphericalCoords(1, Math.PI / 2 - elevation, azimuth);

sky.material.uniforms.turbidity.value = 3.2;
sky.material.uniforms.rayleigh.value = 1.45;
sky.material.uniforms.mieCoefficient.value = 0.008;
sky.material.uniforms.mieDirectionalG.value = 0.92;
sky.material.uniforms.sunPosition.value.copy(sunDirection);

const skyScene = new THREE.Scene();
const envSky = sky.clone();
envSky.material = sky.material.clone();
envSky.scale.setScalar(450000);
envSky.material.uniforms.sunPosition.value.copy(sunDirection);
skyScene.add(envSky);
scene.environment = pmremGenerator.fromScene(skyScene).texture;

const hemiLight = new THREE.HemisphereLight(0xf5f2ea, 0x596674, 1.15);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff0d2, 2.6);
sunLight.position.copy(sunDirection).multiplyScalar(40);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.bias = -0.00015;
sunLight.shadow.normalBias = 0.06;
sunLight.shadow.camera.near = 1;
 sunLight.shadow.camera.far = 80;
sunLight.shadow.camera.left = -24;
sunLight.shadow.camera.right = 24;
sunLight.shadow.camera.top = 24;
sunLight.shadow.camera.bottom = -24;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x9cc4ff, 0.35);
fillLight.position.set(-12, 10, -24);
scene.add(fillLight);

const bounceLight = new THREE.PointLight(0xffd8c4, 0.45, 24, 2);
bounceLight.position.set(0, 4, 0);
scene.add(bounceLight);

const clock = new THREE.Clock();
const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

const cameraAnchor = new THREE.Vector3().copy(START_POSITION);
const movement = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);
const surfaceProbe = new THREE.Vector3();
const materialHsl = { h: 0, s: 0, l: 0 };
let modelRoot;
let walkableMeshes = [];
let authoredSurfaces = [];
let runtimePois = [];
let runtimeWarpSpots = [];
let activeWarpSpot = null;
let focusedPoi = null;
const warpSpotMarkers = [];

let groundLevel = 0;
let yaw = 0;
let pitch = 0;
let isPointerLocked = false;
let verticalVelocity = 0;
let isGrounded = true;

function setStatus(message, hidden = false) {
  status.textContent = message;
  status.classList.toggle("status--hidden", hidden);
}

function updateOverlayState(locked) {
  overlay.classList.toggle("overlay--active", !locked);
}

function setFocusHint(message = "", visible = false) {
  focusHint.textContent = message;
  focusHint.classList.toggle("focus-hint--visible", visible);
}

function renderInfoPanel() {
  const sourcePoi = focusedPoi;
  infoPanel.classList.toggle("info-panel--visible", Boolean(sourcePoi));

  if (!sourcePoi) {
    infoContext.textContent = "";
    infoTitle.textContent = "";
    infoBody.textContent = "";
    return;
  }

  infoContext.textContent = "Point of interest";
  infoTitle.textContent = sourcePoi.title;
  infoBody.textContent = sourcePoi.description;
}

function syncCameraTransform() {
  camera.position.copy(cameraAnchor);
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

function isWaterLikeMaterial(material) {
  if (!material || !material.color) {
    return false;
  }

  const { r, g, b } = material.color;
  return b > r * 1.05 && g > r * 1.02;
}

function isRoofLikeMaterial(material) {
  if (!material || !material.color) {
    return false;
  }

  material.color.getHSL(materialHsl);
  const isWarmRoof =
    (materialHsl.h > 0.04 && materialHsl.h < 0.13 && materialHsl.s > 0.45 && materialHsl.l < 0.5) ||
    (materialHsl.h > 0.01 && materialHsl.h < 0.08 && materialHsl.s > 0.35 && materialHsl.l < 0.42);
  const isDarkGreenRoof =
    materialHsl.h > 0.22 && materialHsl.h < 0.42 && materialHsl.s > 0.3 && materialHsl.l < 0.38;

  return isWarmRoof || isDarkGreenRoof;
}

function isWalkableHit(hit) {
  const material = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
  return (
    hit.point.y >= MIN_WALKABLE_HEIGHT &&
    hit.face.normal.y > 0.78 &&
    !isWaterLikeMaterial(material) &&
    !isRoofLikeMaterial(material)
  );
}

function buildAuthoredSurfaces(size) {
  authoredSurfaces = WALKABLE_SURFACE_DEFS
    .filter((surface) => surface.type === "rect")
    .map((surface) => ({
      ...surface,
      minX: surface.x * size.x - (surface.width * size.x) / 2,
      maxX: surface.x * size.x + (surface.width * size.x) / 2,
      minZ: surface.z * size.z - (surface.depth * size.z) / 2,
      maxZ: surface.z * size.z + (surface.depth * size.z) / 2,
    }));
}

function buildRuntimeExhibitPoints(size) {
  for (const marker of warpSpotMarkers) {
    scene.remove(marker);
  }
  warpSpotMarkers.length = 0;

  runtimeWarpSpots = WARP_SPOT_DEFS.map((spot) => ({
    ...spot,
    position: new THREE.Vector3(spot.x * size.x, spot.y, spot.z * size.z),
  }));

  runtimePois = POI_DEFS.map((poi) => ({
    ...poi,
    position: new THREE.Vector3(poi.x * size.x, poi.y, poi.z * size.z),
  }));

  for (const spot of runtimeWarpSpots) {
    const marker = createWarpSpotMarker(spot);
    warpSpotMarkers.push(marker);
    scene.add(marker);
  }
}

function getPoiById(id) {
  return runtimePois.find((poi) => poi.id === id) ?? null;
}

function createWarpSpotMarker(spot) {
  const marker = new THREE.Group();
  marker.position.copy(spot.position);

  const ringGeometry = new THREE.TorusGeometry(0.9, 0.08, 12, 32);
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0xff7a18,
    emissive: 0xff4d00,
    emissiveIntensity: 1.4,
    roughness: 0.35,
    metalness: 0.05,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.18;
  marker.add(ring);

  const pillarGeometry = new THREE.CylinderGeometry(0.12, 0.18, 1.6, 6);
  const pillarMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd166,
    emissive: 0xff9f1c,
    emissiveIntensity: 0.8,
    roughness: 0.45,
    metalness: 0.02,
  });
  const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
  pillar.position.y = 0.8;
  marker.add(pillar);

  const beaconGeometry = new THREE.SphereGeometry(0.22, 16, 16);
  const beaconMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff3c4,
    emissive: 0xffb703,
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.02,
  });
  const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
  beacon.position.y = 1.7;
  marker.add(beacon);

  marker.userData.baseY = spot.position.y;
  return marker;
}

function updateExhibitState() {
  if (!isPointerLocked) {
    activeWarpSpot = null;
    focusedPoi = null;
    setFocusHint();
    renderInfoPanel();
    return;
  }

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);

  let nextFocusedPoi = null;
  let bestPoiScore = 0.86;
  for (const poi of runtimePois) {
    const offset = poi.position.clone().sub(camera.position);
    const distance = offset.length();
    if (distance > 34) {
      continue;
    }

    const directionToPoi = offset.normalize();
    const score = forward.dot(directionToPoi);
    if (score > bestPoiScore) {
      nextFocusedPoi = poi;
      bestPoiScore = score;
    }
  }
  focusedPoi = nextFocusedPoi;
  renderInfoPanel();

  let nextWarpSpot = null;
  let bestWarpScore = 0.93;
  for (const spot of runtimeWarpSpots) {
    const offset = spot.position.clone().sub(camera.position);
    const distance = offset.length();
    if (distance > 48) {
      continue;
    }

    const directionToSpot = offset.normalize();
    const score = forward.dot(directionToSpot);
    if (score > bestWarpScore) {
      nextWarpSpot = spot;
      bestWarpScore = score;
    }
  }
  activeWarpSpot = nextWarpSpot;

  if (activeWarpSpot) {
    setFocusHint(activeWarpSpot.hint, true);
  } else {
    setFocusHint();
  }
}

function warpToSpot(spot) {
  const landingHeight = sampleSurfaceHeight(
    spot.position.x,
    spot.position.z,
    spot.position.y,
    null,
  );
  groundLevel = landingHeight;
  cameraAnchor.set(
    spot.position.x,
    groundLevel + CAMERA_HEIGHT,
    spot.position.z,
  );
  yaw = spot.yaw;
  pitch = spot.pitch;
  verticalVelocity = 0;
  isGrounded = true;
  syncCameraTransform();
}

function sampleAuthoredSurfaceHeight(x, z, fallback = Number.NaN, currentHeight = null) {
  let matchedHeight = Number.NaN;

  for (const surface of authoredSurfaces) {
    const containsPoint = x >= surface.minX && x <= surface.maxX && z >= surface.minZ && z <= surface.maxZ;
    if (!containsPoint) {
      continue;
    }

    if (currentHeight !== null) {
      const step = surface.y - currentHeight;
      if (step > MAX_STEP_UP || step < -MAX_STEP_DOWN) {
        continue;
      }
    }

    if (!Number.isFinite(matchedHeight) || surface.y > matchedHeight) {
      matchedHeight = surface.y;
    }
  }

  return Number.isFinite(matchedHeight) ? matchedHeight : fallback;
}

function sampleSurfaceHeight(x, z, fallback = groundLevel, currentHeight = null) {
  const authoredHeight = sampleAuthoredSurfaceHeight(x, z, Number.NaN, currentHeight);
  if (Number.isFinite(authoredHeight)) {
    return authoredHeight;
  }

  if (walkableMeshes.length === 0) {
    return fallback;
  }

  surfaceProbe.set(x, SURFACE_RAY_HEIGHT, z);
  raycaster.set(surfaceProbe, down);
  raycaster.far = SURFACE_MAX_DROP;

  const hits = raycaster.intersectObjects(walkableMeshes, false);
  const surfaceHit = hits.find((hit) => {
    if (!isWalkableHit(hit)) {
      return false;
    }

    if (currentHeight === null) {
      return true;
    }

    const step = hit.point.y - currentHeight;
    return step <= MAX_STEP_UP && step >= -MAX_STEP_DOWN;
  });

  return surfaceHit ? surfaceHit.point.y : fallback;
}

function lockPointer() {
  canvas.requestPointerLock();
}

document.addEventListener("pointerlockchange", () => {
  isPointerLocked = document.pointerLockElement === canvas;
  updateOverlayState(isPointerLocked);
  if (!isPointerLocked) {
    resetMovement();
  }
  setStatus(isPointerLocked ? "Walkthrough active" : "Paused. Click enter to continue.", isPointerLocked);
});

document.addEventListener("pointerlockerror", () => {
  setStatus("Pointer lock failed. Click again in the canvas.");
});

function handleKey(event, pressed) {
  switch (event.code) {
    case "KeyW":
      moveState.forward = pressed;
      break;
    case "KeyS":
      moveState.backward = pressed;
      break;
    case "KeyA":
      moveState.left = pressed;
      break;
    case "KeyD":
      moveState.right = pressed;
      break;
    case "Space":
      if (pressed && isGrounded) {
        verticalVelocity = JUMP_VELOCITY;
        isGrounded = false;
      }
      event.preventDefault();
      break;
    case "KeyF":
      if (pressed && !event.repeat && activeWarpSpot) {
        warpToSpot(activeWarpSpot);
      }
      break;
    default:
      break;
  }
}

function resetMovement() {
  moveState.forward = false;
  moveState.backward = false;
  moveState.left = false;
  moveState.right = false;
  verticalVelocity = 0;
}

document.addEventListener("keydown", (event) => handleKey(event, true));
document.addEventListener("keyup", (event) => handleKey(event, false));
window.addEventListener("blur", resetMovement);

enterButton.addEventListener("click", () => {
  lockPointer();
});

overlay.addEventListener("click", (event) => {
  if (event.target === overlay) {
    lockPointer();
  }
});

canvas.addEventListener("click", () => {
  if (!isPointerLocked) {
    lockPointer();
  }
});

document.addEventListener("mousemove", (event) => {
  if (!isPointerLocked) {
    return;
  }

  yaw -= event.movementX * DRAG_SENSITIVITY;
  pitch -= event.movementY * DRAG_SENSITIVITY;
  pitch = THREE.MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH);
  syncCameraTransform();
});

function fitModel(root) {
  const initialBox = new THREE.Box3().setFromObject(root);
  if (initialBox.isEmpty()) {
    return;
  }

  const initialSize = initialBox.getSize(new THREE.Vector3());
  const scale = TARGET_WORLD_HEIGHT / Math.max(initialSize.y, 0.01);
  root.scale.setScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(root);
  const scaledSize = scaledBox.getSize(new THREE.Vector3());
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

  root.position.x -= scaledCenter.x;
  root.position.z -= scaledCenter.z;
  root.position.y -= scaledBox.min.y;

  const finalBox = new THREE.Box3().setFromObject(root);
  const finalSize = finalBox.getSize(new THREE.Vector3());
  buildAuthoredSurfaces(finalSize);
  buildRuntimeExhibitPoints(finalSize);
  const spawnCandidates = [
    new THREE.Vector2(finalSize.x * 0.08, finalSize.z * 0.24),
    new THREE.Vector2(finalSize.x * 0.16, finalSize.z * 0.18),
    new THREE.Vector2(0, finalSize.z * 0.12),
    new THREE.Vector2(-finalSize.x * 0.12, finalSize.z * 0.08),
    new THREE.Vector2(0, 0),
    new THREE.Vector2(finalSize.x * 0.18, -finalSize.z * 0.08),
    new THREE.Vector2(-finalSize.x * 0.18, -finalSize.z * 0.12),
    new THREE.Vector2(0, -finalSize.z * 0.18),
  ];

  let spawnPoint = null;
  for (const candidate of spawnCandidates) {
    const surfaceY = sampleSurfaceHeight(candidate.x, candidate.y, Number.NaN, null);
    if (!Number.isFinite(surfaceY)) {
      continue;
    }

    if (!spawnPoint || surfaceY < spawnPoint.surfaceY) {
      spawnPoint = { x: candidate.x, y: candidate.y, surfaceY };
    }
  }

  if (!spawnPoint) {
    spawnPoint = { x: 0, y: 0, surfaceY: 0 };
  }

  groundLevel = spawnPoint.surfaceY;
  cameraAnchor.set(spawnPoint.x, groundLevel + CAMERA_HEIGHT, spawnPoint.y);
  yaw = Math.PI;
  pitch = -0.06;
  verticalVelocity = 0;
  isGrounded = true;
  syncCameraTransform();
}

function loadModel() {
  const loader = new GLTFLoader();

  loader.load(
    "/models/venice.glb",
    (gltf) => {
      modelRoot = gltf.scene;
      walkableMeshes = [];
      modelRoot.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = true;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) {
            if (!material) {
              continue;
            }
            material.envMapIntensity = isWaterLikeMaterial(material) ? 2.1 : 0.95;
            if (isWaterLikeMaterial(material)) {
              material.roughness = Math.min(material.roughness ?? 1, 0.08);
              material.metalness = Math.max(material.metalness ?? 0, 0.12);
            } else {
              material.roughness = Math.min(Math.max(material.roughness ?? 0.85, 0.42), 0.92);
              material.metalness = Math.max(material.metalness ?? 0, 0.02);
            }
            material.needsUpdate = true;
          }
          walkableMeshes.push(child);
        }
      });

      fitModel(modelRoot);
      scene.add(modelRoot);
      setStatus("Click enter to begin.");
    },
    (event) => {
      if (event.total > 0) {
        const progress = Math.round((event.loaded / event.total) * 100);
        setStatus(`Loading Venice model... ${progress}%`);
      }
    },
    (error) => {
      console.error(error);
      setStatus("Failed to load model.");
    },
  );
}

function updateMovement(delta) {
  if (!isPointerLocked) {
    return;
  }

  movement.set(
    Number(moveState.right) - Number(moveState.left),
    0,
    Number(moveState.backward) - Number(moveState.forward),
  );

  if (movement.lengthSq() > 0) {
    movement.normalize();
    movement.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    const nextPosition = cameraAnchor.clone().addScaledVector(movement, WALK_SPEED * delta);
    const nextGroundLevel = sampleSurfaceHeight(
      nextPosition.x,
      nextPosition.z,
      Number.NaN,
      isGrounded ? groundLevel : null,
    );

    if (Number.isFinite(nextGroundLevel)) {
      cameraAnchor.copy(nextPosition);
      if (isGrounded) {
        groundLevel = nextGroundLevel;
      }
    }
  }

  if (!isGrounded) {
    verticalVelocity -= GRAVITY * delta;
    cameraAnchor.y += verticalVelocity * delta;

    const landingHeight = sampleSurfaceHeight(cameraAnchor.x, cameraAnchor.z, Number.NaN, null);
    const minCameraHeight = landingHeight + CAMERA_HEIGHT;

    if (Number.isFinite(landingHeight) && cameraAnchor.y <= minCameraHeight) {
      groundLevel = landingHeight;
      cameraAnchor.y = minCameraHeight;
      verticalVelocity = 0;
      isGrounded = true;
    }
  } else {
    cameraAnchor.y = groundLevel + CAMERA_HEIGHT;
  }

  syncCameraTransform();
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsedTime = clock.elapsedTime;
  updateMovement(delta);
  updateExhibitState();

  for (const marker of warpSpotMarkers) {
    marker.rotation.y += delta * 0.7;
    marker.position.y = marker.userData.baseY + 0.14 + Math.sin(elapsedTime * 2.4) * 0.08;
  }

  composer.render();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  ssaoPass.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});

loadModel();
syncCameraTransform();
animate();
