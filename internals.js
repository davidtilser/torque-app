import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const up = new THREE.Vector3(0, 1, 0);
const axisX = new THREE.Vector3(1, 0, 0);
const axisZ = new THREE.Vector3(0, 0, 1);

export function createInternals() {
  const root = new THREE.Group();
  root.name = 'Internal components';

  const copper = new THREE.MeshStandardMaterial({ color: 0xb5734c, metalness: 0.84, roughness: 0.36 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x9a5738, metalness: 0.78, roughness: 0.43 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc4a164, metalness: 0.8, roughness: 0.34 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9cbcb, metalness: 0.82, roughness: 0.32 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x364146, metalness: 0.42, roughness: 0.54 });
  const resin = new THREE.MeshStandardMaterial({ color: 0x1f2630, roughness: 0.68 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x406e92, roughness: 0.51 });
  const hose = new THREE.MeshStandardMaterial({ color: 0x86c9cb, roughness: 0.45 });
  const fiberglass = new THREE.MeshStandardMaterial({ color: 0x1b7263, roughness: 0.69 });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xd6cfb6, roughness: 0.61 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb14e41, roughness: 0.57 });
  const heatSheath = new THREE.MeshStandardMaterial({ color: 0xe0ad74, metalness: 0.73, roughness: 0.34 });

  function groupFor(id, position = [0, 0, 0]) {
    const group = new THREE.Group();
    group.position.fromArray(position);
    group.userData.partId = id;
    root.add(group);
    return group;
  }

  function mesh(group, geometry, material, position = [0, 0, 0]) {
    const part = new THREE.Mesh(geometry, material);
    part.position.fromArray(position);
    part.userData.partId = group.userData.partId;
    group.add(part);
    return part;
  }

  function block(group, position, dimensions, material) {
    return mesh(group, new RoundedBoxGeometry(...dimensions, 2, 0.025), material, position);
  }

  function cylinder(group, position, radius, length, material, axis = up, sides = 24) {
    const part = mesh(group, new THREE.CylinderGeometry(radius, radius, length, sides), material, position);
    part.quaternion.setFromUnitVectors(up, axis);
    return part;
  }

  function pipe(group, coordinates, radius, material, segments = 36) {
    const curve = new THREE.CatmullRomCurve3(coordinates.map((point) => new THREE.Vector3().fromArray(point)));
    return mesh(group, new THREE.TubeGeometry(curve, segments, radius, 9), material);
  }

  function flangeBolts(group, flangeX, radius, count, material = brass) {
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2 * Math.PI / count;
      cylinder(group, [flangeX, Math.cos(angle) * radius, Math.sin(angle) * radius], 0.029, 0.045, material, axisX, 6);
    }
  }

  const steamBoiler = groupFor('steam-boiler', [0.14, 1.42, -1.30]);
  cylinder(steamBoiler, [0, 0, 0], 0.43, 2.58, copper, axisX, 40);
  for (const x of [-1.30, 1.30]) {
    cylinder(steamBoiler, [x, 0, 0], 0.445, 0.06, bronze, axisX, 40);
    cylinder(steamBoiler, [x * 1.035, 0, 0], 0.37, 0.074, copper, axisX, 36);
    cylinder(steamBoiler, [x * 1.075, 0, 0], 0.123, 0.075, brass, axisX, 8);
    flangeBolts(steamBoiler, x * 1.065, 0.324, 8);
    cylinder(steamBoiler, [x * 0.78, 0, 0], 0.446, 0.069, brass, axisX, 40);
  }
  cylinder(steamBoiler, [-0.64, 0.441, -0.03], 0.072, 0.115, brass, up, 6);
  pipe(steamBoiler, [
    [-0.64, 0.49, -0.03], [-0.64, 0.62, -0.03], [-0.73, 0.66, 0.06],
    [-1.23, 0.65, 0.2], [-1.55, 0.49, 0.38], [-1.64, 0.13, 0.44],
  ], 0.033, copper);

  const brewBoiler = groupFor('brew-boiler', [0.49, 1.59, -0.35]);
  cylinder(brewBoiler, [0, 0, 0], 0.328, 1.13, steel, axisX, 36);
  for (const x of [-0.56, 0.56]) {
    cylinder(brewBoiler, [x, 0, 0], 0.346, 0.071, brass, axisX, 36);
    cylinder(brewBoiler, [x * 1.08, 0, 0], 0.27, 0.064, steel, axisX, 32);
    flangeBolts(brewBoiler, x * 1.15, 0.258, 6, graphite);
  }
  cylinder(brewBoiler, [0.32, 0.351, 0.09], 0.058, 0.103, brass, up, 6);
  pipe(brewBoiler, [
    [0.32, 0.386, 0.09], [0.32, 0.52, 0.09],
    [0.45, 0.59, 0.20], [0.61, 0.60, 0.62],
  ], 0.033, brass);

  const pump = groupFor('water-pump', [-1.29, 0.72, -0.36]);
  block(pump, [0, -0.245, -0.04], [0.57, 0.08, 0.78], graphite);
  cylinder(pump, [0, 0, -0.035], 0.217, 0.63, graphite, axisZ, 28);
  cylinder(pump, [0, 0, -0.37], 0.197, 0.079, resin, axisZ);
  for (let i = 0; i < 12; i += 1) {
    const angle = i * 2 * Math.PI / 12;
    const fin = block(pump, [Math.cos(angle) * 0.22, Math.sin(angle) * 0.22, -0.046], [0.045, 0.034, 0.52], blue);
    fin.rotation.z = angle;
  }
  cylinder(pump, [0, 0, 0.313], 0.189, 0.13, brass, axisZ, 16);
  cylinder(pump, [0, 0, 0.412], 0.121, 0.107, brass, axisZ, 8);
  cylinder(pump, [-0.013, 0, 0.494], 0.064, 0.073, steel, axisZ, 6);
  block(pump, [0.13, 0.197, -0.095], [0.22, 0.10, 0.22], resin);

  const valve = groupFor('solenoid-valve', [-1.42, 1.30, -0.03]);
  block(valve, [0, -0.086, 0], [0.25, 0.155, 0.25], brass);
  cylinder(valve, [0, 0.052, 0], 0.111, 0.185, graphite, up, 18);
  block(valve, [0, 0.065, 0.024], [0.216, 0.175, 0.193], blue);
  cylinder(valve, [0, 0.164, 0], 0.054, 0.049, steel, up, 6);
  cylinder(valve, [-0.148, -0.072, 0], 0.063, 0.102, brass, axisX, 6);
  cylinder(valve, [0.148, -0.072, 0], 0.063, 0.102, brass, axisX, 6);
  block(valve, [-0.016, 0.061, 0.136], [0.102, 0.125, 0.076], resin);
  pipe(valve, [
    [-0.165, -0.065, 0], [-0.24, -0.08, 0], [-0.233, -0.19, 0.095],
    [-0.18, -0.34, 0.17], [0.13, -0.48, 0.16],
  ], 0.027, copper);

  const board = groupFor('control-board', [1.43, 1.87, -0.40]);
  board.rotation.y = -0.43 * Math.PI;
  block(board, [0, 0, 0], [0.87, 0.92, 0.047], fiberglass);
  for (const x of [-0.36, 0.36]) {
    for (const y of [-0.38, 0.38]) {
      cylinder(board, [x, y, 0.038], 0.026, 0.022, brass, axisZ, 12);
    }
  }
  for (let i = 0; i < 9; i += 1) {
    const y = -0.30 + 0.077 * i;
    const trace = block(board, [-0.10, y, 0.022], [0.46, 0.010, 0.008], brass);
    trace.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.18;
  }
  block(board, [-0.10, 0.01, 0.046], [0.25, 0.22, 0.065], resin);
  for (let i = 0; i < 6; i += 1) {
    const y = -0.077 + 0.034 * i;
    for (const x of [-0.243, 0.043]) block(board, [x, y, 0.056], [0.061, 0.011, 0.012], steel);
  }
  for (const x of [-0.28, -0.08, 0.11]) cylinder(board, [x, 0.272, 0.079], 0.055, 0.113, graphite, axisZ, 14);
  for (const y of [-0.24, -0.06, 0.12]) block(board, [0.291, y, 0.074], [0.153, 0.092, 0.112], ceramic);
  block(board, [-0.13, -0.29, 0.057], [0.26, 0.102, 0.073], blue);
  block(board, [0.224, 0.307, 0.064], [0.15, 0.085, 0.086], resin);

  const pressureSwitch = groupFor('pressure-switch', [0.34, 2.025, -1.29]);
  cylinder(pressureSwitch, [0, -0.101, 0], 0.077, 0.113, brass, up, 6);
  cylinder(pressureSwitch, [0, -0.024, 0], 0.132, 0.068, brass, up, 12);
  block(pressureSwitch, [0, 0.053, 0], [0.27, 0.12, 0.24], resin);
  cylinder(pressureSwitch, [0, 0.132, 0], 0.043, 0.063, bronze, up, 10);
  block(pressureSwitch, [-0.105, 0.078, 0.144], [0.096, 0.076, 0.102], ceramic);
  pipe(pressureSwitch, [
    [-0.11, 0.08, 0.168], [-0.26, 0.13, 0.24], [-0.40, 0.13, 0.24],
    [-0.58, 0.06, 0.19],
  ], 0.015, red, 18);

  const inlet = groupFor('inlet-hose');
  pipe(inlet, [
    [-1.52, 0.49, -1.79], [-1.63, 0.45, -1.54], [-1.62, 0.43, -1.16],
    [-1.56, 0.44, -0.88], [-1.39, 0.52, -0.80], [-1.30, 0.68, -0.77],
  ], 0.055, hose);
  cylinder(inlet, [-1.53, 0.49, -1.79], 0.078, 0.13, steel, axisZ, 8);
  cylinder(inlet, [-1.29, 0.68, -0.769], 0.073, 0.13, brass, axisZ, 8);

  const heating = groupFor('heating-element', [-0.12, 1.63, -0.37]);
  const elements = [-0.10, 0.10];
  for (const z of elements) {
    cylinder(heating, [0.02, 0, z], 0.058, 0.12, red, axisX, 16);
    cylinder(heating, [0.085, 0, z], 0.046, 0.045, ceramic, axisX, 12);
    cylinder(heating, [0.124, 0, z], 0.026, 0.069, brass, axisX, 6);
  }
  pipe(heating, [
    [-0.025, 0, elements[0]], [-0.56, 0, elements[0]], [-0.79, 0, -0.17],
    [-0.97, -0.05, -0.105], [-1.04, -0.06, 0], [-0.97, -0.05, 0.105],
    [-0.79, 0, 0.17], [-0.56, 0, elements[1]], [-0.025, 0, elements[1]],
  ], 0.034, heatSheath);

  return root;
}
