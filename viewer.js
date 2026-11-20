import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PART_BY_ID, REMOVABLE_PARTS } from './parts.js';
import { createSilviaModel } from './silvia-model.js';

const cameraHome = new THREE.Vector3(4.3, 3.7, 7.3);
const targetHome = new THREE.Vector3(0, 1.79, 0.25);
const cameraCutaway = new THREE.Vector3(-7.1, 4.9, 4.75);
const targetCutaway = new THREE.Vector3(-0.18, 1.73, -0.14);

function makeFloorShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const surface = canvas.getContext('2d');
  const gradient = surface.createRadialGradient(64, 64, 1, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(43, 29, 20, 0.45)');
  gradient.addColorStop(0.52, 'rgba(43, 29, 20, 0.19)');
  gradient.addColorStop(1, 'rgba(43, 29, 20, 0)');
  surface.fillStyle = gradient;
  surface.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 4.8),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.003, 0.09);
  return floor;
}

export function mountViewer(container, { onSelect, onAvailability } = {}) {
  let active = null;
  let expanded = false;
  let opened = false;
  let exteriorView;
  let cameraTransition;
  container.dataset.machineOpen = 'false';
  const pickMeshes = [];
  const highlights = [];
  const selectionMaterial = new THREE.MeshBasicMaterial({
    color: 0x60e9ab,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: false,
  });
  const faultMaterials = {
    primary: selectionMaterial.clone(),
    secondary: selectionMaterial.clone(),
  };
  faultMaterials.primary.color.set(0xff3b30);
  faultMaterials.primary.opacity = 0.55;
  faultMaterials.secondary.color.set(0xffb020);
  faultMaterials.secondary.opacity = 0.4;
  let faults = new Map();
  let hotspot;

  function clearHighlights() {
    for (const tint of highlights) tint.removeFromParent();
    highlights.length = 0;
  }

  function showSelection() {
    hotspot?.setAttribute('aria-pressed', String(active === 'seal'));
    container.dataset.selectedPart = active ?? '';
    for (const mesh of pickMeshes) {
      const partId = mesh.userData.partId;
      const material = partId === active ? selectionMaterial : faultMaterials[faults.get(partId)];
      if (!material) continue;
      const tint = new THREE.Mesh(mesh.geometry, material);
      tint.renderOrder = 2;
      mesh.add(tint);
      highlights.push(tint);
    }
  }

  function select(part) {
    if (active === part) return;
    active = part;
    clearHighlights();
    showSelection();
  }

  // Tints suspected parts: red for the most likely cause, amber for the others.
  function setFaults({ primary = [], secondary = [] } = {}) {
    faults = new Map([...secondary.map((id) => [id, 'secondary']), ...primary.map((id) => [id, 'primary'])]);
    container.dataset.faultParts = primary.join(' ');
    clearHighlights();
    showSelection();
  }

  function activate(part) {
    select(part);
    onSelect?.(part);
  }

  function setExpanded(value) {
    expanded = value;
  }

  function refreshVisibleComponents() {
    clearHighlights();
    assembly.internals.visible = opened;
    for (const id of REMOVABLE_PARTS) assembly.components.get(id).visible = !opened;
    pickMeshes.length = 0;
    assembly.group.traverseVisible((object) => {
      if (object.isMesh) pickMeshes.push(object);
    });
    showSelection();
  }

  function setOpen(value) {
    const next = Boolean(value);
    if (next === opened) return;
    opened = next;
    container.dataset.machineOpen = String(opened);

    if (opened && !cameraTransition) {
      exteriorView = { position: camera.position.clone(), target: controls.target.clone() };
    }
    refreshVisibleComponents();
    transitionView(
      opened ? cameraCutaway : exteriorView?.position ?? cameraHome,
      opened ? targetCutaway : exteriorView?.target ?? targetHome,
    );
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    onAvailability?.(false);
    return { reset() {}, select, setExpanded, setOpen, setFaults };
  }

  renderer.domElement.className = 'viewer-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  container.prepend(renderer.domElement);

  hotspot = document.createElement('button');
  hotspot.type = 'button';
  hotspot.className = 'viewer-hotspot';
  hotspot.dataset.part = 'seal';
  hotspot.setAttribute('aria-label', 'Group head gasket');
  hotspot.setAttribute('aria-pressed', 'false');
  hotspot.style.position = 'absolute';
  hotspot.innerHTML = '<span class="viewer-hotspot__dot"></span><span class="viewer-hotspot__label">Group head gasket</span>';
  hotspot.addEventListener('click', () => activate('seal'));
  container.append(hotspot);

  const scene = new THREE.Scene();
  const assembly = createSilviaModel();
  scene.add(assembly.group);
  container.dataset.asset = 'silvia-m';
  const studio = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio, 0.04).texture;
  scene.environmentIntensity = 0.86;
  studio.dispose();
  pmrem.dispose();

  const fill = new THREE.HemisphereLight(0xfff4e3, 0xaaa7a0, 1.38);
  const key = new THREE.DirectionalLight(0xfff7ec, 2.26);
  key.position.set(-2, 5, 4);
  const rim = new THREE.DirectionalLight(0xf2f4ff, 1.6);
  rim.position.set(3, 3, -4);
  scene.add(key, fill, rim, makeFloorShadow());

  const camera = new THREE.PerspectiveCamera(33, 1, 0.07, 65);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4.1;
  controls.maxDistance = 15;
  controls.minPolarAngle = Math.PI * 0.11;
  controls.maxPolarAngle = Math.PI * 0.68;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.75;
  controls.addEventListener('start', () => {
    cameraTransition = null;
  });

  function reset() {
    cameraTransition = null;
    controls.target.copy(opened ? targetCutaway : targetHome);
    camera.position.copy(opened ? cameraCutaway : cameraHome);
    controls.update();
  }

  function transitionView(position, target) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      camera.position.copy(position);
      controls.target.copy(target);
      controls.update();
      return;
    }
    cameraTransition = {
      start: performance.now(),
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      position,
      target,
    };
  }

  let width;
  let height;
  function resize() {
    const nextWidth = container.clientWidth;
    const nextHeight = container.clientHeight;
    if (nextWidth === width && nextHeight === height) return;
    const firstSize = !width || !height;
    width = nextWidth;
    height = nextHeight;
    camera.aspect = width / Math.max(height, 1);
    camera.zoom = Math.min(1, Math.max(camera.aspect, 0.5) / 1.16);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (firstSize) reset();
  }

  resize();
  new ResizeObserver(resize).observe(container);
  refreshVisibleComponents();
  onAvailability?.(true);

  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  function underPointer(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    mouse.set(
      (event.clientX - bounds.left) / bounds.width * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(pickMeshes, false)[0];
    return hit?.object.userData.partId ?? null;
  }

  let pointerStart;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.isPrimary && event.button === 0) pointerStart = [event.clientX, event.clientY];
  });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!event.isPrimary) return;
    const start = pointerStart;
    pointerStart = null;
    if (!start || Math.hypot(start[0] - event.clientX, start[1] - event.clientY) > 5) return;
    const part = underPointer(event);
    if (part) activate(part);
  });
  renderer.domElement.addEventListener('pointercancel', () => { pointerStart = null; });
  renderer.domElement.addEventListener('pointermove', (event) => {
    const part = pointerStart ? null : underPointer(event);
    renderer.domElement.style.cursor = pointerStart ? 'grabbing' : part ? 'pointer' : 'grab';
    renderer.domElement.title = PART_BY_ID[part]?.name ?? '';
  });

  const projected = new THREE.Vector3();
  function animate(time) {
    if (!width || !height) return;
    if (cameraTransition) {
      const { start, fromPosition, fromTarget, position, target } = cameraTransition;
      const progress = THREE.MathUtils.clamp((time - start) / 370, 0, 1);
      const ease = progress * progress * (3 - 2 * progress);
      camera.position.lerpVectors(fromPosition, position, ease);
      controls.target.lerpVectors(fromTarget, target, ease);
      if (progress === 1) cameraTransition = null;
    }
    controls.update();
    for (const { object, normal, offset } of assembly.exploded) {
      const amount = expanded ? 1 : 0;
      object.position.x = THREE.MathUtils.lerp(object.position.x, normal.x + offset.x * amount, 0.16);
      object.position.y = THREE.MathUtils.lerp(object.position.y, normal.y + offset.y * amount, 0.16);
      object.position.z = THREE.MathUtils.lerp(object.position.z, normal.z + offset.z * amount, 0.16);
    }
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    assembly.sealAnchor.getWorldPosition(projected).project(camera);
    const frontFacing = camera.position.z >= -0.65;
    const onScreen = Math.abs(projected.x) < 0.94 && Math.abs(projected.y) < 0.87 && projected.z < 1;
    hotspot.style.visibility = !opened && frontFacing && onScreen ? 'visible' : 'hidden';
    hotspot.style.left = `${(projected.x + 1) * width / 2}px`;
    hotspot.style.top = `${(1 - projected.y) * height / 2}px`;
  }

  renderer.setAnimationLoop(animate);
  return { reset, select, setExpanded, setOpen, setFaults };
}
