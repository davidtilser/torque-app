import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import basisScript from 'three/addons/libs/basis/basis_transcoder.js?url';
import basisWasm from 'three/addons/libs/basis/basis_transcoder.wasm?url';
import { PART_BY_ID } from './parts.js';
import { bodyFaceParts, gaugeFaceParts } from './prepared-mesh-parts.js';
import { createInternals } from './internals.js';

const modelUrl = '/models/espresso-machine.glb';

const cameraHome = new THREE.Vector3(-4.3, 3.1, 7.1);
const targetHome = new THREE.Vector3(0, 1.23, 0.17);
const cameraCutaway = new THREE.Vector3(-6.23, 5.80, 2.98);
const targetCutaway = new THREE.Vector3(-0.12, 1.23, -0.50);
const up = new THREE.Vector3(0, 1, 0);
const removableCovers = new Set(['side-panel-left', 'top-panel', 'cup-rail']);

function createSeal(accent) {
  const seal = new THREE.Mesh(
    new THREE.TorusGeometry(0.223, 0.026, 12, 56),
    new THREE.MeshStandardMaterial({
      color: accent ? 0xff633e : 0x8a5648,
      emissive: 0xb82005,
      emissiveIntensity: accent ? 0.38 : 0.08,
      roughness: 0.52,
    }),
  );
  seal.rotation.x = Math.PI / 2;
  return seal;
}

function tagPart(object, id) {
  object.traverse((child) => {
    if (child.isMesh) child.userData.partId = id;
  });
  return object;
}

function makeAssembly(machine, leftFilter, rightFilter, cutaway = null) {
  const group = new THREE.Group();
  group.add(machine);
  const box = new THREE.Box3().setFromObject(machine);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 4.07 / Math.max(size.x, size.z);

  machine.position.x -= center.x;
  machine.position.y += -box.min.y + 0.035 / scale;
  machine.position.z -= center.z;
  group.scale.setScalar(scale);
  group.updateMatrixWorld(true);

  const overlay = new THREE.Group();
  const internals = createInternals();
  internals.visible = false;
  overlay.add(group, internals);

  const filters = [leftFilter, rightFilter];
  const seals = filters.map((filter, index) => {
    const id = index === 0 ? 'seal' : 'seal-right';
    const ring = tagPart(createSeal(index === 0), id);
    filter.getWorldPosition(ring.position);
    ring.position.y += 0.01;
    overlay.add(ring);
    return ring;
  });
  const sealAnchor = new THREE.Object3D();
  sealAnchor.position.copy(seals[0].position).add(new THREE.Vector3(-0.06, 0.025, 0.24));
  overlay.add(sealAnchor);

  return {
    group: overlay,
    machine: group,
    internals,
    cutaway,
    seals,
    filters: filters.map((filter) => ({ filter, home: filter.position.clone() })),
    sealAnchor,
  };
}

function createFallback() {
  const machine = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xc7c6bc, metalness: 0.88, roughness: 0.31 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x343432, roughness: 0.64 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe4e3da, metalness: 0.97, roughness: 0.19 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x272722, roughness: 0.88 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x493024, roughness: 0.53 });
  const face = new THREE.MeshStandardMaterial({ color: 0xeae0ce, roughness: 0.47 });

  function component(id) {
    const group = new THREE.Group();
    group.userData.partId = id;
    machine.add(group);
    return group;
  }

  function box(parent, dims, position, material, radius = 0.015) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(...dims, 2, radius), material);
    mesh.position.set(...position);
    parent.add(tagPart(mesh, parent.userData.partId));
    return mesh;
  }

  function cylinder(parent, top, bottom, height, position, material, direction = up) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 32), material);
    mesh.position.set(...position);
    mesh.quaternion.setFromUnitVectors(up, direction);
    parent.add(tagPart(mesh, parent.userData.partId));
    return mesh;
  }

  const front = new THREE.Vector3(0, 0, 1);
  box(component('chassis'), [0.75, 0.078, 0.63], [0, 0.072, 0.005], steel);
  box(component('rear-panel'), [0.65, 0.32, 0.2], [0, 0.245, -0.175], dark);
  box(component('front-panel'), [0.748, 0.17, 0.07], [0, 0.374, 0.222], steel, 0.025);
  box(component('top-panel'), [0.704, 0.025, 0.515], [0, 0.463, -0.02], chrome, 0.007);
  box(component('drip-tray'), [0.64, 0.023, 0.265], [0, 0.117, 0.166], dark, 0.006);

  const rail = component('cup-rail');
  box(rail, [0.66, 0.014, 0.014], [0, 0.497, -0.247], chrome, 0.004);
  for (const x of [-0.331, 0.331]) {
    const side = x < 0 ? 'left' : 'right';
    box(rail, [0.014, 0.014, 0.445], [x, 0.497, -0.027], chrome, 0.004);
    box(component(`side-panel-${side}`), [0.079, 0.323, 0.505], [x, 0.25, -0.011], steel);
    for (const z of [-0.223, 0.203]) {
      const end = z < 0 ? 'rear' : 'front';
      cylinder(component(`foot-${end}-${side}`), 0.037, 0.03, 0.041, [x, 0.025, z], rubber);
    }
  }

  const grate = component('drip-grate');
  for (let i = -10; i <= 10; i += 1) {
    box(grate, [0.009, 0.009, 0.24], [i * 0.029, 0.134, 0.163], chrome, 0.004);
  }

  const filters = [];
  for (const x of [-0.163, 0.163]) {
    const side = x < 0 ? 'left' : 'right';
    const head = component(`brew-head-${side}`);
    cylinder(head, 0.062, 0.055, 0.047, [x, 0.287, 0.222], chrome);
    cylinder(component(`shower-screen-${side}`), 0.04, 0.04, 0.01, [x, 0.257, 0.222], dark);
    const controlPanel = component(`control-panel-${side}`);
    box(controlPanel, [0.13, 0.045, 0.013], [x, 0.387, 0.267], dark, 0.007);
    for (let number = 1; number <= 4; number += 1) {
      cylinder(component(`brew-button-${side}-${number}`), 0.008, 0.008, 0.007, [x + (number - 2.5) * 0.026, 0.387, 0.277], chrome, front);
    }
    const filter = component(`portafilter-${side}`);
    filter.position.set(x, 0.259, 0.222);
    filters.push(filter);
    cylinder(filter, 0.054, 0.045, 0.028, [0, -0.025, 0.004], chrome);
    cylinder(filter, 0.016, 0.014, 0.15, [0, -0.021, 0.12], wood, front);
    cylinder(filter, 0.019, 0.019, 0.018, [0, -0.021, 0.047], chrome, front);
    cylinder(filter, 0.019, 0.019, 0.022, [0, -0.055, 0.005], chrome);
  }

  for (const x of [-0.04, 0.04]) {
    const gauge = component(x < 0 ? 'pressure-gauge-left' : 'pressure-gauge-right');
    cylinder(gauge, 0.031, 0.032, 0.019, [x, 0.394, 0.264], chrome, front);
    cylinder(gauge, 0.026, 0.026, 0.002, [x, 0.394, 0.275], face, front);
    const needle = box(gauge, [0.003, 0.023, 0.002], [x, 0.398, 0.277], rubber, 0.001);
    needle.rotation.z = x < 0 ? -0.75 : 0.58;
  }

  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'left' : 'right';
    const wand = component(`steam-wand-${side}`);
    wand.position.set(sign * 0.29, 0.294, 0.254);
    cylinder(component(`steam-knob-${side}`), 0.027, 0.028, 0.035, [sign * 0.31, 0.364, 0.267], rubber, front);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(sign * 0.023, -0.04, 0.018),
      new THREE.Vector3(sign * 0.033, -0.095, 0.018),
      new THREE.Vector3(sign * 0.04, -0.137, 0.052),
    ]);
    wand.add(tagPart(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.009, 10), chrome), wand.userData.partId));
  }

  cylinder(component('water-knob'), 0.014, 0.015, 0.019, [0, 0.329, 0.269], rubber, front);
  cylinder(component('hot-water-spout'), 0.008, 0.011, 0.061, [0, 0.265, 0.225], chrome);
  return makeAssembly(machine, filters[0], filters[1]);
}

async function loadPreparedModel(renderer) {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (url.endsWith('/basis_transcoder.js')) return basisScript;
    if (url.endsWith('/basis_transcoder.wasm')) return basisWasm;
    return url;
  });

  const textureLoader = new KTX2Loader(manager).setTranscoderPath('/basis/').detectSupport(renderer);
  try {
    const { scene, parser } = await new GLTFLoader(manager)
      .setKTX2Loader(textureLoader)
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync(modelUrl);
    const leftFilter = scene.getObjectByName('portafilter_R');
    const rightFilter = scene.getObjectByName('portafilter_L');
    const leftWand = scene.getObjectByName('steam_wand_R');
    const rightWand = scene.getObjectByName('steam_wand_L');
    const gauges = scene.getObjectByName('gauge_lenses');
    let body;
    scene.traverse((object) => {
      if (object.isMesh && parser.associations.get(object)?.meshes === 4) body = object;
    });
    if (!leftFilter || !rightFilter || !leftWand || !rightWand || !body || !gauges) {
      throw new Error('The prepared model is missing component geometry.');
    }
    tagPart(leftFilter, 'portafilter-left');
    tagPart(rightFilter, 'portafilter-right');
    tagPart(leftWand, 'steam-wand-left');
    tagPart(rightWand, 'steam-wand-right');
    gauges.userData.faceParts = gaugeFaceParts;
    return makeAssembly(scene, leftFilter, rightFilter, prepareCutaway(body));
  } finally {
    textureLoader.dispose();
  }
}

function prepareCutaway(body) {
  const closedGeometry = body.geometry;
  const closedIndex = closedGeometry.getIndex();
  if (closedIndex.count !== bodyFaceParts.length * 3) {
    throw new Error('The prepared body does not match its component map.');
  }

  const openIndex = [];
  const openFaceParts = [];
  bodyFaceParts.forEach((part, triangle) => {
    if (removableCovers.has(part)) return;
    openFaceParts.push(part);
    for (let corner = 0; corner < 3; corner += 1) {
      openIndex.push(closedIndex.getX(triangle * 3 + corner));
    }
  });
  const openGeometry = new THREE.BufferGeometry().setIndex(openIndex);
  for (const [name, attribute] of Object.entries(closedGeometry.attributes)) {
    openGeometry.setAttribute(name, attribute);
  }
  openGeometry.boundingBox = closedGeometry.boundingBox;
  openGeometry.boundingSphere = closedGeometry.boundingSphere;
  body.userData.faceParts = bodyFaceParts;
  return { body, closedGeometry, openGeometry, openFaceParts };
}

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

function disposeAssembly({ group, cutaway }) {
  const materials = new Set();
  const geometries = new Set();
  group.traverse((object) => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    for (const material of [object.material].flat()) materials.add(material);
  });
  if (cutaway) {
    geometries.add(cutaway.openGeometry);
    geometries.add(cutaway.closedGeometry);
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function componentGeometry(mesh, part) {
  const { geometry, userData } = mesh;
  if (!userData.faceParts) return userData.partId === part ? geometry : null;

  const indices = [];
  const original = geometry.getIndex();
  userData.faceParts.forEach((id, triangle) => {
    if (id !== part) return;
    for (let corner = 0; corner < 3; corner += 1) {
      const index = triangle * 3 + corner;
      indices.push(original ? original.getX(index) : index);
    }
  });
  if (indices.length === 0) return null;
  return new THREE.BufferGeometry()
    .setAttribute('position', geometry.getAttribute('position'))
    .setIndex(indices);
}

export function mountViewer(container, { onSelect, onAvailability } = {}) {
  let active = null;
  let expanded = false;
  let opened = false;
  let assembly;
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
  let hotspot;

  function clearHighlights() {
    for (const { tint, ownsGeometry } of highlights) {
      tint.removeFromParent();
      if (ownsGeometry) tint.geometry.dispose();
    }
    highlights.length = 0;
  }

  function showSelection() {
    hotspot?.setAttribute('aria-pressed', String(active === 'seal'));
    container.dataset.selectedPart = active ?? '';
    if (!assembly) return;

    assembly.seals.forEach((seal, index) => {
      const base = index === 0 ? 0.38 : 0.08;
      seal.material.emissiveIntensity = seal.userData.partId === active ? 0.95 : base;
    });
    if (!active || active === 'seal' || active === 'seal-right') return;

    for (const mesh of pickMeshes) {
      const geometry = componentGeometry(mesh, active);
      if (!geometry) continue;
      const tint = new THREE.Mesh(geometry, selectionMaterial);
      tint.renderOrder = 2;
      mesh.add(tint);
      highlights.push({ tint, ownsGeometry: geometry !== mesh.geometry });
    }
  }

  function select(part) {
    if (active === part) return;
    active = part;
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
    if (assembly.cutaway) {
      const { body, openGeometry, closedGeometry, openFaceParts } = assembly.cutaway;
      body.geometry = opened ? openGeometry : closedGeometry;
      body.userData.faceParts = opened ? openFaceParts : bodyFaceParts;
    } else {
      assembly.machine.traverse((object) => {
        if (removableCovers.has(object.userData.partId)) object.visible = !opened;
      });
    }
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
    if (!assembly) return;

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
    return { reset() {}, select, setExpanded, setOpen };
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
  hotspot.setAttribute('aria-label', 'Group head seal');
  hotspot.setAttribute('aria-pressed', 'false');
  hotspot.style.position = 'absolute';
  hotspot.innerHTML = '<span class="viewer-hotspot__dot"></span><span class="viewer-hotspot__label">Group head seal</span>';
  hotspot.addEventListener('click', () => activate('seal'));
  container.append(hotspot);

  const scene = new THREE.Scene();
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

  function replace(next, source) {
    clearHighlights();
    if (assembly) {
      scene.remove(assembly.group);
      disposeAssembly(assembly);
    }
    assembly = next;
    scene.add(next.group);
    container.dataset.asset = source;
    refreshVisibleComponents();
  }

  resize();
  new ResizeObserver(resize).observe(container);
  replace(createFallback(), 'illustrative');
  onAvailability?.(true);

  loadPreparedModel(renderer)
    .then((next) => replace(next, 'prepared'))
    .catch((error) => console.warn('Showing the illustrative machine instead of the prepared model.', error));

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
    if (!hit) return null;
    const { faceParts, partId } = hit.object.userData;
    return faceParts?.[hit.faceIndex] ?? partId;
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
    for (const { filter, home } of assembly.filters) {
      filter.position.y = THREE.MathUtils.lerp(filter.position.y, home.y - (expanded ? 0.079 : 0), 0.15);
      filter.position.z = THREE.MathUtils.lerp(filter.position.z, home.z + (expanded ? 0.098 : 0), 0.15);
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
  return { reset, select, setExpanded, setOpen };
}
