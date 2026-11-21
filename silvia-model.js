import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PART_BY_ID } from './parts.js';

const up = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3(0, 0, 1);
const across = new THREE.Vector3(1, 0, 0);

// Geometry is authored in millimetres. Housing envelope 235 × 290 × 340.
// The exploded catalog supplies shapes and part identities. Internal placement is illustrative.
export function createSilviaModel() {
  const group = new THREE.Group();
  group.scale.setScalar(0.0105);
  const internals = new THREE.Group();
  group.add(internals);

  const steel = new THREE.MeshPhysicalMaterial({ color: 0xbabec0, metalness: 0.86, roughness: 0.34, anisotropy: 0.53 });
  const polished = new THREE.MeshStandardMaterial({ color: 0xcad0d3, metalness: 0.94, roughness: 0.21 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x202529, roughness: 0.38 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x151719, roughness: 0.77 });
  const ivory = new THREE.MeshPhysicalMaterial({ color: 0xe0dcce, roughness: 0.37, clearcoat: 0.16 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xba8b40, metalness: 0.76, roughness: 0.36 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xaf684b, metalness: 0.7, roughness: 0.28 });
  const red = new THREE.MeshStandardMaterial({ color: 0x9d312b, roughness: 0.42 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xf4a64f, emissive: 0xbc4805, emissiveIntensity: 0.35 });
  const gasket = new THREE.MeshStandardMaterial({ color: 0x4a2922, roughness: 0.88 });

  const components = new Map();
  function part(id, x = 0, y = 0, z = 0) {
    const component = new THREE.Group();
    component.name = id;
    component.position.set(x, y, z);
    const parent = PART_BY_ID[id].inside ? internals : group;
    parent.add(component);
    components.set(id, component);
    return component;
  }

  function add(parent, geometry, material, placement = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...placement);
    mesh.userData.partId = parent.name;
    parent.add(mesh);
    return mesh;
  }

  function box(parent, size, placement, material, radius = 2) {
    return add(parent, new RoundedBoxGeometry(...size, 2, radius), material, placement);
  }

  function cylinder(parent, top, bottom, height, placement, material, direction = up, segments = 32) {
    const mesh = add(parent, new THREE.CylinderGeometry(top, bottom, height, segments), material, placement);
    mesh.quaternion.setFromUnitVectors(up, direction);
    return mesh;
  }

  function tube(parent, positions, radius, material) {
    const curve = new THREE.CatmullRomCurve3(positions.map((position) => new THREE.Vector3(...position)));
    return add(parent, new THREE.TubeGeometry(curve, 36, radius, 10), material);
  }

  const base = part('chassis');
  box(base, [235, 21, 290], [0, 22, 0], dark, 3);
  box(base, [210, 13, 208], [0, 38, -36], steel);
  for (const x of [-98, 98]) {
    for (const z of [-118, 115]) {
      const side = x < 0 ? 'left' : 'right';
      const end = z < 0 ? 'rear' : 'front';
      cylinder(part(`foot-${end}-${side}`), 11, 9, 12, [x, 6, z], rubber);
    }
  }

  // Thin panels leave the front brew bay recessed under the controls.
  for (const [id, x] of [['side-panel-left', -114], ['side-panel-right', 114]]) {
    const side = part(id);
    box(side, [7, 300, 198], [x, 183, -46], steel, 2);
    box(side, [8, 300, 16], [x, 183, 56], dark, 1);
    box(side, [7, 112, 25], [x, 277, 73], steel, 1);
  }
  box(part('rear-panel'), [222, 300, 5], [0, 183, -142], steel);
  box(part('lower-panel'), [215, 188, 6], [0, 127, 51], steel);
  const fascia = part('front-panel');
  box(fascia, [221, 104, 9], [0, 283, 83], steel, 3);
  box(fascia, [218, 5, 31], [0, 233, 67], steel, 1);
  box(fascia, [67, 15, 2], [66, 308, 88], dark, 2);
  for (const x of [-96, 96]) cylinder(fascia, 2.4, 2.4, 1.5, [x, 238, 88], polished, forward);

  const top = part('top-panel');
  box(top, [235, 6, 140], [0, 334, 13], steel);
  box(top, [235, 6, 8], [0, 334, -141], steel, 1);
  for (const x of [-112, 112]) box(top, [10, 6, 82], [x, 334, -96], steel, 1);
  const lid = part('tank-lid');
  box(lid, [212, 6, 81], [0, 336, -96], dark);
  box(lid, [47, 2, 12], [0, 339, -96], rubber, 1);

  const grate = part('drip-grate', 0, 50, 101);
  box(grate, [215, 4, 88], [0, 0, 0], dark, 2);
  for (let index = 0; index < 18; index += 1) {
    box(grate, [8.6, 3, 77], [-99 + index * 11.7, 2.2, 0], polished, 1);
  }
  const tray = part('drip-tray', 0, 42, 100);
  box(tray, [224, 16, 90], [0, 0, 0], steel, 2);
  box(tray, [216, 3, 80], [0, 7, 0], dark, 1);

  for (const [id, x, y, color] of [
    ['brew-switch', -83, 310, ivory], ['water-switch', -83, 282, ivory],
    ['steam-switch', -83, 254, ivory], ['power-switch', -36, 310, amber],
  ]) {
    const control = part(id, x, y, 89);
    box(control, [21, 23, 3], [0, 0, 0], rubber);
    box(control, [15, 18, 5], [0, 0, 3], dark, 2).rotation.x = 0.18;
    box(control, [8, 2, 1], [0, 4, 6], color, 0.4);
    box(control, [5, 2.5, 1], [0, -5, 6], amber, 0.5);
  }
  const knob = part('steam-knob', 79, 260, 103);
  cylinder(knob, 17, 17, 24, [0, 0, 0], rubber, forward, 20);
  cylinder(knob, 12, 12, 2, [0, 0, 12], polished, forward);
  const wand = part('steam-wand', 80, 225, 80);
  cylinder(wand, 8, 8, 12, [0, 0, 0], polished);
  tube(wand, [[0, 0, 0], [0, -25, 8], [-19, -44, 27], [-21, -96, 48], [-25, -145, 54]], 4.2, polished);
  tube(wand, [[-16, -41, 24], [-20, -50, 29], [-21, -61, 33]], 6.2, rubber);
  cylinder(wand, 4.3, 5.1, 11, [-25, -144, 54], polished);

  const head = part('brew-head', -15, 218, 79);
  cylinder(head, 38, 34, 25, [0, 0, 0], polished);
  cylinder(head, 36, 36, 5, [0, -11, 0], steel);
  const seal = part('seal', -15, 203, 79);
  add(seal, new THREE.TorusGeometry(29, 3.4, 12, 64), gasket).rotation.x = Math.PI / 2;
  const screen = part('shower-screen', -15, 200, 79);
  cylinder(screen, 26, 26, 3.4, [0, 0, 0], polished);
  cylinder(screen, 3.2, 3.2, 1.6, [0, -2.2, 0], steel, up, 8);
  const filter = part('portafilter', -15, 194, 79);
  cylinder(filter, 32.8, 26, 15, [0, -5, 0], polished);
  const handle = new THREE.Group();
  handle.name = filter.name;
  handle.rotation.y = -0.33;
  filter.add(handle);
  cylinder(handle, 8, 9, 30, [0, -5, 40], polished, forward);
  cylinder(handle, 14, 10, 95, [0, -5, 98], rubber, forward);
  cylinder(handle, 13.8, 13.8, 3, [0, -5, 146], dark, forward);
  tube(filter, [[0, -11, 0], [0, -23, 0], [-14, -27, 1]], 4.5, polished);
  tube(filter, [[0, -13, 0], [0, -23, 0], [14, -27, 1]], 4.5, polished);

  const tank = part('water-tank', 0, 245, -99);
  box(tank, [186, 6, 67], [0, -67, 0], ivory);
  for (const x of [-91, 91]) box(tank, [5, 134, 68], [x, 0, 0], ivory);
  for (const z of [-32, 32]) box(tank, [180, 134, 5], [0, 0, z], ivory);
  box(tank, [195, 6, 76], [0, 67, 0], ivory, 2);

  const boiler = part('boiler', 13, 254, 9);
  cylinder(boiler, 47, 49, 71, [0, 0, 0], brass);
  cylinder(boiler, 45, 45, 51, [0, 0, 0], rubber);
  cylinder(boiler, 49, 49, 8, [0, 35, 0], brass);
  cylinder(boiler, 47, 51, 9, [0, -35, 0], brass);
  for (const x of [-30, 30]) cylinder(boiler, 4, 4, 5, [x, 40, 5], steel, up, 6);

  const pump = part('water-pump', -63, 125, 2);
  box(pump, [44, 39, 65], [0, 0, 0], red, 5);
  cylinder(pump, 17, 16, 29, [0, 0, 40], steel, forward);
  cylinder(pump, 7, 7, 14, [0, 0, 60], brass, forward, 8);
  cylinder(pump, 9, 9, 16, [0, 0, -38], ivory, forward);
  box(pump, [26, 15, 27], [0, 23, -4], dark);

  const valve = part('solenoid-valve', -49, 196, 23);
  box(valve, [28, 30, 28], [0, 2, 0], dark, 3);
  cylinder(valve, 13, 13, 11, [0, -17, 0], brass, up, 6);
  cylinder(valve, 6, 6, 13, [-13, -16, 0], brass, across, 6);
  const expansionValve = part('expansion-valve', -33, 168, 44);
  cylinder(expansionValve, 9, 11, 24, [0, 0, 0], brass, up, 6);
  cylinder(expansionValve, 5, 5, 15, [0, 0, 0], polished, across);
  const steamValve = part('steam-valve', 71, 258, 52);
  cylinder(steamValve, 12, 12, 28, [0, 0, 0], brass, forward, 6);
  tube(steamValve, [[0, 0, -8], [-5, 21, -12], [-24, 34, -22], [-41, 40, -26]], 3.5, copper);

  for (const [id, x, color] of [['brew-thermostat', -4, dark], ['steam-thermostat', 31, red]]) {
    const thermostat = part(id, x, 298, 8);
    cylinder(thermostat, 9, 11, 7, [0, 0, 0], color);
    box(thermostat, [12, 2.5, 4], [0, 5, 0], brass, 0.8);
  }
  const heater = part('heating-element', 18, 211, 10);
  cylinder(heater, 17, 17, 5, [0, 0, 0], copper);
  tube(heater, [[-11, 0, 0], [-11, -13, 0], [0, -21, 3], [11, -13, 0], [11, 0, 0]], 2.6, copper);
  const hose = part('inlet-hose');
  tube(hose, [[-49, 303, -89], [-75, 314, -68], [-87, 269, -57], [-88, 193, -63], [-80, 136, -58], [-64, 125, -40]], 4, ivory);

  const sealAnchor = new THREE.Object3D();
  sealAnchor.position.set(-26, 195, 116);
  group.add(sealAnchor);

  return {
    group, internals, components, sealAnchor,
    exploded: [
      ['portafilter', [0, -70, 90]], ['seal', [0, -28, 30]], ['shower-screen', [0, -50, 55]],
      ['drip-grate', [0, 22, 60]], ['drip-tray', [0, 0, 95]],
      ['water-tank', [0, 120, -20]], ['tank-lid', [0, 170, -20]], ['boiler', [25, 70, 0]],
      ['water-pump', [-90, -15, 45]], ['heating-element', [25, -60, 0]],
      ['brew-thermostat', [-45, 95, 10]], ['steam-thermostat', [50, 95, 10]],
      ['solenoid-valve', [-60, 30, 50]], ['expansion-valve', [-75, 40, -20]],
      ['steam-valve', [70, 40, 40]], ['steam-wand', [90, -20, 60]], ['inlet-hose', [-70, 40, -60]],
    ].filter(([id]) => components.has(id)).map(([id, offset]) => {
      const object = components.get(id);
      return { id, object, normal: object.position.clone(), offset: new THREE.Vector3(...offset) };
    }),
  };
}
