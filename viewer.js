import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PART_BY_ID, REMOVABLE_PARTS } from './parts.js';
import { createSilviaModel } from './silvia-model.js';

// Catalog position numbers (Rancilio RLCSILVIAM v.22, pages 6–9) shown as callouts in the exploded view.
const CALLOUTS = {
  'inlet-hose': '1', 'brew-thermostat': '3', 'steam-thermostat': '4', 'steam-valve': '8', 'steam-wand': '14',
  'expansion-valve': '17', 'heating-element': '26', 'water-pump': '23', boiler: '28',
};
const PAPER = 0xfbfaf6;
const INK = 0x1d1d1b;

// Turns the model into a catalog-style line drawing: flat light surfaces with black edge lines.
function applyDrawingStyle(root) {
  const fills = new Map();
  const ink = new THREE.LineBasicMaterial({ color: INK });
  const meshes = [];
  root.traverse((object) => { if (object.isMesh) meshes.push(object); });
  for (const mesh of meshes) {
    const old = mesh.material;
    const tone = old.color ? old.color.getHSL({}).l : 0.8;
    const shade = tone < 0.2 ? 0xd9d8d4 : tone < 0.5 ? 0xeceae5 : 0xffffff;
    if (!fills.has(shade)) fills.set(shade, new THREE.MeshLambertMaterial({ color: shade, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    mesh.material = fills.get(shade);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 28), ink);
    edges.raycast = () => {};
    mesh.add(edges);
  }
}

const cameraHome = new THREE.Vector3(4.3, 3.7, 7.3);
const targetHome = new THREE.Vector3(0, 1.79, 0.25);
const cameraCutaway = new THREE.Vector3(-7.1, 4.9, 4.75);
const targetCutaway = new THREE.Vector3(-0.18, 1.73, -0.14);

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
    if (!opened) return;
    const position = expanded ? cameraCutaway.clone().sub(targetCutaway).multiplyScalar(1.35).add(targetCutaway).add(new THREE.Vector3(0, 0.5, 0)) : cameraCutaway;
    transitionView(position, expanded ? targetCutaway.clone().add(new THREE.Vector3(0, 0.45, 0)) : targetCutaway);
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
  renderer.toneMapping = THREE.NoToneMapping;
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
  scene.background = new THREE.Color(PAPER);
  applyDrawingStyle(assembly.group);

  const fill = new THREE.HemisphereLight(0xffffff, 0xdedcd6, 2.2);
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(-2, 5, 4);
  scene.add(key, fill);

  // Dash-dot assembly lines from each exploded part back to where it fits, as in the catalog.
  const assemblyInk = new THREE.LineDashedMaterial({ color: INK, dashSize: 9, gapSize: 4, transparent: true, opacity: 0.7 });
  const assemblyLines = assembly.exploded.map(({ object, normal }) => {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([normal.clone(), normal.clone()]), assemblyInk);
    line.raycast = () => {};
    line.visible = false;
    object.parent.add(line);
    return { line, object, normal };
  });

  // Numbered callouts with leader lines, drawn in an SVG layer over the canvas.
  const calloutLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  calloutLayer.classList.add('viewer-callouts');
  calloutLayer.setAttribute('aria-hidden', 'true');
  container.append(calloutLayer);
  const callouts = assembly.exploded.filter(({ id }) => CALLOUTS[id]).map(({ id, object }) => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.innerHTML = `<line></line><text>${CALLOUTS[id]}</text>`;
    calloutLayer.append(group);
    return { id, object, group, leader: group.querySelector('line'), label: group.querySelector('text') };
  });
  const box = new THREE.Box3();
  const center = new THREE.Vector3();

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
    for (const { line, object, normal } of assemblyLines) {
      const points = line.geometry.attributes.position;
      points.setXYZ(1, object.position.x, object.position.y, object.position.z);
      points.needsUpdate = true;
      line.computeLineDistances();
      line.visible = expanded && object.visible && object.position.distanceTo(normal) > 4;
    }
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    for (const { object, group, leader, label } of callouts) {
      const show = expanded && opened && object.visible;
      group.style.display = show ? '' : 'none';
      if (!show) continue;
      box.setFromObject(object).getCenter(center).project(camera);
      const x = (center.x + 1) * width / 2;
      const y = (1 - center.y) * height / 2;
      const dx = x - width / 2;
      const dy = y - height / 2;
      const length = Math.hypot(dx, dy) || 1;
      const lx = x + dx / length * 46;
      const ly = y + dy / length * 46;
      leader.setAttribute('x1', x); leader.setAttribute('y1', y);
      leader.setAttribute('x2', lx); leader.setAttribute('y2', ly);
      label.setAttribute('x', lx + (dx < 0 ? -4 : 4));
      label.setAttribute('y', ly + 4);
      label.setAttribute('text-anchor', dx < 0 ? 'end' : 'start');
    }
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
