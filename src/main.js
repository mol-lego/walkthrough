import "./style.css";

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";

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
const START_POSITION = new THREE.Vector3(0, CAMERA_HEIGHT, 8);

const app = document.querySelector("#app");

app.innerHTML = `
  <canvas class="stage" aria-label="Venice walkthrough"></canvas>
  <div class="hud">
    <div class="hud__title">Venice Walkthrough</div>
    <div class="hud__hint">Click to enter. WASD to move. Drag to look. Esc to release.</div>
  </div>
  <div class="overlay overlay--active" data-overlay>
    <button class="overlay__button" type="button" data-enter>Enter walkthrough</button>
    <p class="overlay__note">PC only prototype. Slow movement for quiet viewing.</p>
  </div>
  <div class="status" data-status>Loading Venice model...</div>
`;

const canvas = document.querySelector(".stage");
const overlay = document.querySelector("[data-overlay]");
const enterButton = document.querySelector("[data-enter]");
const status = document.querySelector("[data-status]");

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
let modelRoot;
let walkableMeshes = [];

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

function isWalkableHit(hit) {
  const material = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
  return hit.face.normal.y > 0.45 && !isWaterLikeMaterial(material);
}

function sampleSurfaceHeight(x, z, fallback = groundLevel, currentHeight = null) {
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
  updateMovement(delta);

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
