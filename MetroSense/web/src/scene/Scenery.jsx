// Cosmetic surroundings: grass, roads with lane markings, pavements, lawns,
// trees, a car park and neighbouring buildings. Illustrative only (not the real
// Ara Damansara layout), not clickable, and deliberately muted so the monitored
// buildings and risk colours stay the focus. Repeated objects are instanced.

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const COLORS = {
  light: {
    grass: '#c7d1c2', lawn: '#bccab6', asphalt: '#9ea5ae', lane: '#eef0f2', pavement: '#d7dce3',
    canopy: '#97ac93', trunk: '#8a7d70', context: '#c6ccd5', contextTop: '#b5bcc7', stall: '#e9ecf0',
    cars: ['#b7bec8', '#9aa3b0', '#d6dae0', '#8f98a6', '#c4b8ab'],
  },
  dark: {
    grass: '#18201c', lawn: '#1d2822', asphalt: '#2a3039', lane: '#4b525d', pavement: '#252b35',
    canopy: '#30433a', trunk: '#4a4038', context: '#2c3340', contextTop: '#353d4b', stall: '#3a414c',
    cars: ['#3a4250', '#2f3642', '#4a5260', '#343b47', '#463f39'],
  },
};

// Deterministic jitter so the scenery is the same every run.
const jitter = (i, k = 1) => (Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;

// Ring road around the campus pad, plus roads leading out. [x, z, w, d]
const ROADS = [
  [0, -66, 180, 10], [0, 74, 180, 10], [-80, 4, 10, 150], [80, 4, 10, 150],
  [150, 10, 130, 10], [-20, 150, 10, 142], [30, -140, 10, 138], [-150, -20, 130, 10],
];
// Pavements alongside the ring road. [x, z, w, d]
const PAVEMENTS = [
  [0, -59.5, 166, 3], [0, 67.5, 166, 3], [-73.5, 4, 3, 130], [73.5, 4, 3, 130],
];
// Lawns on the pad, clear of buildings and street assets. [x, z, w, d]
const LAWNS = [[-55, -42, 22, 20], [55, -45, 24, 20], [56, 50, 20, 16], [-50, 55, 30, 12]];
// Neighbouring buildings, low on the camera side so they never hide the campus. [x, z, w, d, h]
const CONTEXT = [
  [-122, -42, 30, 24, 36], [-126, 12, 26, 30, 22], [-118, 58, 28, 22, 16], [-62, -112, 34, 24, 44],
  [2, -114, 28, 26, 28], [58, -110, 30, 24, 18], [122, -52, 26, 26, 30], [-118, -100, 24, 24, 26],
  [124, 62, 30, 24, 12], [72, 124, 30, 26, 10], [-70, 122, 34, 22, 14], [118, -110, 22, 22, 20],
];
const CAR_PARK = { x: 40, z: 100, w: 54, d: 26 };

function Instances({ items, geometry, color, castShadow = false }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((it, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.ry ?? 0);
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1));
      ref.current.setMatrixAt(i, m);
      if (it.color) ref.current.setColorAt(i, new THREE.Color(it.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={castShadow} receiveShadow>
      {geometry}
      <meshStandardMaterial color={color} roughness={0.95} />
    </instancedMesh>
  );
}

function Flat({ x, z, w, d, y = 0.01, color }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, y, z]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

export function Scenery({ theme }) {
  const c = COLORS[theme];

  // Trees along the ring-road verges and on the lawns.
  const trees = useMemo(() => {
    const out = [];
    let i = 0;
    for (let x = -84; x <= 84; x += 12) {
      out.push({ x, z: -76 + jitter(i++) * 2 }, { x, z: 84 + jitter(i++) * 2 });
    }
    for (let z = -60; z <= 70; z += 13) {
      out.push({ x: -90 + jitter(i++) * 2, z }, { x: 90 + jitter(i++) * 2, z });
    }
    // Lawn corners only, so the playground in the north-east lawn stays clear.
    for (const [lx, lz, lw, ld] of LAWNS) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        out.push({ x: lx + sx * (lw / 2 - 2.5), z: lz + sz * (ld / 2 - 2.5) });
      }
    }
    return out.map((t, n) => ({ ...t, s: 0.8 + Math.abs(jitter(n, 3)) * 0.5 }));
  }, []);
  const trunks = useMemo(() => trees.map((t) => ({ x: t.x, y: 1.4 * t.s, z: t.z, sy: t.s })), [trees]);
  const canopies = useMemo(() => trees.map((t) => ({ x: t.x, y: 4 * t.s, z: t.z, sx: t.s, sy: t.s * 1.15, sz: t.s })), [trees]);

  // Dashed centre lines on the roads.
  const dashes = useMemo(() => {
    const out = [];
    for (const [x, z, w, d] of ROADS) {
      const along = w > d;
      const len = along ? w : d;
      for (let s = -len / 2 + 4; s < len / 2 - 4; s += 8) {
        out.push(along ? { x: x + s, y: 0.06, z, sx: 1, sz: 1 } : { x, y: 0.06, z: z + s, ry: Math.PI / 2 });
      }
    }
    return out;
  }, []);

  // Car park: stall lines and a few parked cars.
  const stalls = useMemo(() => {
    const out = [];
    for (let k = 0; k < 10; k++) {
      const x = CAR_PARK.x - CAR_PARK.w / 2 + 4 + k * 5;
      out.push({ x, y: 0.07, z: CAR_PARK.z - 6, ry: Math.PI / 2 }, { x, y: 0.07, z: CAR_PARK.z + 6, ry: Math.PI / 2 });
    }
    return out;
  }, []);
  const cars = useMemo(() => {
    const out = [];
    for (let k = 0; k < 10; k++) {
      for (const row of [-6, 6]) {
        if (Math.abs(jitter(k, row)) < 0.35) continue; // some empty bays
        out.push({
          x: CAR_PARK.x - CAR_PARK.w / 2 + 6.5 + k * 5, y: 0.8, z: CAR_PARK.z + row,
          color: c.cars[(k + (row > 0 ? 2 : 0)) % c.cars.length],
        });
      }
    }
    return out;
  }, [c]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color={c.grass} roughness={1} />
      </mesh>
      {ROADS.map(([x, z, w, d]) => <Flat key={`r${x},${z}`} x={x} z={z} w={w} d={d} y={0.02} color={c.asphalt} />)}
      {PAVEMENTS.map(([x, z, w, d]) => <Flat key={`p${x},${z}`} x={x} z={z} w={w} d={d} y={0.03} color={c.pavement} />)}
      {LAWNS.map(([x, z, w, d]) => <Flat key={`l${x},${z}`} x={x} z={z} w={w} d={d} y={0.015} color={c.lawn} />)}
      <Flat x={CAR_PARK.x} z={CAR_PARK.z} w={CAR_PARK.w} d={CAR_PARK.d} y={0.025} color={c.asphalt} />
      <Instances items={dashes} geometry={<boxGeometry args={[4, 0.05, 0.4]} />} color={c.lane} />
      <Instances items={stalls} geometry={<boxGeometry args={[5, 0.05, 0.25]} />} color={c.stall} />
      <Instances items={cars} geometry={<boxGeometry args={[2.2, 1.4, 4.2]} />} color="#ffffff" castShadow />
      <Instances items={trunks} geometry={<cylinderGeometry args={[0.35, 0.45, 2.8, 6]} />} color={c.trunk} />
      <Instances items={canopies} geometry={<icosahedronGeometry args={[2.4, 0]} />} color={c.canopy} castShadow />
      {CONTEXT.map(([x, z, w, d, h]) => (
        <group key={`b${x},${z}`} position={[x, 0, z]}>
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={c.context} roughness={0.9} />
          </mesh>
          <mesh position={[0, h + 0.4, 0]}>
            <boxGeometry args={[w * 0.6, 0.8, d * 0.6]} />
            <meshStandardMaterial color={c.contextTop} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
