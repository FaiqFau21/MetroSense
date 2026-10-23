import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { RISK_COLORS, OPEN_PROBLEM_MIN, summarize, riskLevel, pct } from '../risk.js';
import { RiskIcon } from '../components/RiskIcon.jsx';
import { ZONES, CORE } from '../data/layout.js';
import { Scenery } from './Scenery.jsx';

// SDP-inspired: cool greys with a navy accent (styles.css uses the same tokens).
const SCENE_COLORS = {
  light: { sky: '#e8ecf2', ground: '#d2d8e0', pad: '#e0e5ec', path: '#c6cdd7', body: '#cfd5dd', glass: '#8a929e', accent: '#1f3566', zone: '#f3f5f8', zoneEdge: '#97a0ae', core: '#b9c0ca', pole: '#6b7482' },
  dark: { sky: '#10141c', ground: '#1b2130', pad: '#222938', path: '#2b3343', body: '#5d6676', glass: '#313948', accent: '#8fa9e6', zone: '#2a3141', zoneEdge: '#76809a', core: '#3b4354', pole: '#8a93a3' },
};

// Tint strength per risk band; stronger tint for worse bands.
const TINT = { healthy: 0.12, watch: 0.35, serious: 0.6, critical: 0.75, none: 0 };
// Vertical distance between slabs in the exploded floor stack.
const EXPLODE_GAP = 6;
const SLAB = 0.6;
const SLAB_EXPLODED = 1.4;

const HOME = { pos: [95, 92, 105], target: [0, 22, 0] };

const v3 = (a) => new THREE.Vector3(...a);

// 3D labels sit in wrapper boxes that can overlap their neighbours' tags (floor
// tags are packed tightly). Make the wrappers click-through; the tags themselves
// re-enable clicks in styles.css.
const CLICK_THROUGH = { pointerEvents: 'none' };

// Camera goal for the current view: where to look and where to stand.
function cameraGoal({ building, floorLevel, planView, fit, focus }) {
  if (!building) {
    const target = v3(HOME.target);
    const offset = planView ? v3([0, 190, 0.5]) : v3(HOME.pos).sub(target);
    return { target, pos: target.clone().add(offset.multiplyScalar(fit)) };
  }
  const b = building;
  // Public realm: overview of the streets, or close in on one street asset.
  if (b.kind === 'site') {
    const target = focus ? v3([focus.wx, 2, focus.wz]) : v3([0, 0, 4]);
    const dir = planView ? v3([0, 1, 0.01]) : focus ? v3([0.6, 0.9, 1]) : v3([0.3, 1, 0.9]);
    const dist = focus ? 55 * Math.sqrt(fit) : 170 * fit;
    return { target, pos: target.clone().add(dir.normalize().multiplyScalar(dist)) };
  }
  const size = Math.max(b.footprintW, b.footprintD);
  if (floorLevel) {
    const target = v3([b.x, (floorLevel - 1) * EXPLODE_GAP, b.z]);
    const dir = planView ? v3([0, 1, 0.01]) : v3([0.1, 1, 0.65]);
    return { target, pos: target.clone().add(dir.normalize().multiplyScalar(size * 1.45 * Math.sqrt(fit))) };
  }
  const h = (b.floorCount - 1) * EXPLODE_GAP;
  const target = v3([b.x, h / 2, b.z]);
  const dir = planView ? v3([0, 1, 0.01]) : v3([0.9, 0.35, 1]);
  const dist = planView ? size * 3 : Math.max(h * 1.25, 90);
  return { target, pos: target.clone().add(dir.normalize().multiplyScalar(dist * fit)) };
}

function CameraRig({ building, floorLevel, planView, reducedMotion, controlsRef, focus }) {
  const { camera, size } = useThree();
  const goal = useRef(null);
  // Pull the camera back on narrow viewports so the subject stays in frame, and a
  // little on every viewport since the forecast bar covers its lower edge.
  const fit = Math.max(1.3, 1.85 / (size.width / size.height));

  useEffect(() => {
    goal.current = cameraGoal({ building, floorLevel, planView, fit, focus });
    const c = controlsRef.current;
    if (c) c.enableRotate = !planView;
    if (reducedMotion && c) {
      camera.position.copy(goal.current.pos);
      c.target.copy(goal.current.target);
      c.update();
      goal.current = null;
    }
    // Keyed on the building id: a forecast update creates new building objects
    // but must not re-fly the camera.
  }, [building?.id, floorLevel, planView, reducedMotion, camera, controlsRef, fit, focus?.id]);

  // Cancel a camera flight as soon as the user grabs the controls.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const stop = () => { goal.current = null; };
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, [controlsRef]);

  useFrame((_, dt) => {
    const g = goal.current;
    const c = controlsRef.current;
    if (!g || !c) return;
    const k = 1 - Math.exp(-dt * 4);
    camera.position.lerp(g.pos, k);
    c.target.lerp(g.target, k);
    if (camera.position.distanceTo(g.pos) < 0.2) {
      // Snap exactly: near top-down, a tiny leftover offset would rotate the plan.
      camera.position.copy(g.pos);
      c.target.copy(g.target);
      goal.current = null;
    }
    c.update();
  });
  return null;
}

function useHoverCursor() {
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
    return () => { document.body.style.cursor = ''; };
  }, [hovered]);
  return [hovered, setHovered];
}

const tinted = (base, riskHex, key) => new THREE.Color(base).lerp(new THREE.Color(riskHex), TINT[key]);

// Critical items beam: their glow pulses, a ring pings outward and buildings send
// up a light beam. Other bands stay still. 0.8 pulses a second is a slow throb,
// well under the 3-flashes-a-second limit (WCAG 2.3.1). With reduced motion the
// glow is held steady instead.
const PULSE_HZ = 0.8;
const pulseAt = (t, reducedMotion) => (reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * PULSE_HZ));
const isCritical = (level) => level.key === 'critical';

// Sets the emissive glow of the given materials every frame: pulsing between
// min and max while `on`, otherwise held at their normal glow (`userData.base`
// on the material, or `base`).
function useBeam(mats, on, reducedMotion, { min = 0.15, max = 0.85, base = 0 } = {}) {
  useFrame(({ clock }) => {
    const v = min + (max - min) * pulseAt(clock.elapsedTime, reducedMotion);
    for (const m of mats()) if (m) m.emissiveIntensity = on ? v : m.userData.base ?? base;
  });
}

// A ring that expands and fades on the ground under a critical item.
function PingRing({ color, inner, outer, y = 0.3, reducedMotion }) {
  const mesh = useRef();
  const mat = useRef();
  useFrame(({ clock }) => {
    if (!mesh.current || !mat.current) return;
    if (reducedMotion) { mesh.current.scale.setScalar(1.25); mat.current.opacity = 0.45; return; }
    const phase = (clock.elapsedTime * PULSE_HZ) % 1;
    mesh.current.scale.setScalar(1 + phase * 1.5);
    mat.current.opacity = 0.75 * (1 - phase);
  });
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} position={[0, y, 0]} raycast={() => null}>
      <ringGeometry args={[inner, outer, 48]} />
      <meshBasicMaterial ref={mat} color={color} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// A soft vertical light beam rising from a critical building or street asset.
function Beacon({ color, y, height, radius, reducedMotion }) {
  const mat = useRef();
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = 0.1 + 0.28 * pulseAt(clock.elapsedTime, reducedMotion);
  });
  return (
    <mesh position={[0, y + height / 2, 0]} raycast={() => null}>
      <cylinderGeometry args={[radius * 0.35, radius, height, 24, 1, true]} />
      <meshBasicMaterial ref={mat} color={color} transparent opacity={0.25} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// One floor slab. Animates between its stacked and exploded position.
function Slab({ b, floor, mode, theme, buildingColor, opacity, interactive, selected, reducedMotion, onClick, label }) {
  const ref = useRef();
  const [hovered, setHovered] = useHoverCursor();
  const exploded = mode !== 'stacked';
  const targetY = exploded ? (floor.level - 1) * EXPLODE_GAP : (floor.level - 1) * b.floorHeight + SLAB / 2 - 0.1;
  const targetH = exploded ? SLAB_EXPLODED : SLAB;
  const s = useMemo(() => summarize(floor.equipment), [floor]);
  const riskHex = RISK_COLORS[theme][s.level.key];
  // The open floor gets a lighter tint so its equipment points carry the colour.
  const color = useMemo(() => {
    if (!exploded) return buildingColor;
    const c = tinted(SCENE_COLORS[theme].body, riskHex, s.level.key);
    return selected ? new THREE.Color(SCENE_COLORS[theme].body).lerp(c, 0.4) : c;
  }, [exploded, selected, theme, riskHex, s.level.key, buildingColor]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 6);
    g.position.y += (targetY - g.position.y) * k;
    g.scale.y += (targetH / SLAB - g.scale.y) * k;
  });
  // A critical floor in the exploded stack beams (not the open floor: its
  // equipment points carry the colour).
  const mat = useRef();
  const beaming = exploded && !selected && opacity > 0.5 && isCritical(s.level);
  useBeam(() => [mat.current], beaming, reducedMotion, { min: 0.1, max: 0.7, base: hovered ? 0.25 : 0 });

  const handlers = interactive
    ? {
        onClick: (e) => { e.stopPropagation(); onClick(); },
        onPointerOver: (e) => { e.stopPropagation(); setHovered(true); },
        onPointerOut: () => setHovered(false),
      }
    : {};

  return (
    <group>
      <group ref={ref} position={[0, targetY, 0]}>
        <mesh castShadow={opacity > 0.5} receiveShadow {...handlers}>
          <boxGeometry args={[b.footprintW, SLAB, b.footprintD]} />
          <meshStandardMaterial
            ref={mat}
            color={color} roughness={0.8} transparent opacity={opacity} depthWrite={opacity > 0.5}
            emissive={beaming ? riskHex : hovered ? color : '#000'} emissiveIntensity={hovered ? 0.25 : 0}
          />
          {selected && <Edges color={SCENE_COLORS[theme].accent} lineWidth={2} />}
        </mesh>
      </group>
      {label && opacity > 0.5 && (exploded) && (
        <Html position={[b.footprintW / 2 + 2, targetY, b.footprintD / 2]} zIndexRange={[20, 0]} style={CLICK_THROUGH}>
          <button
            className={`floor-tag ${hovered ? 'is-hovered' : ''} ${isCritical(s.level) ? 'is-critical' : ''}`}
            style={{ '--risk': riskHex }}
            onClick={onClick}
            aria-label={`${floor.label}: ${s.level.label}, ${s.openProblems} open problems`}
          >
            <RiskIcon level={s.level} color={riskHex} size={11} />
            {floor.level === 1 ? 'G' : `L${floor.level}`}
            {s.openProblems > 0 && <span className="floor-tag-n">{s.openProblems}</span>}
          </button>
        </Html>
      )}
    </group>
  );
}

// The 2D layout drawn on top of the selected slab: rooms plus equipment points.
function FloorLayout({ b, floor, theme, selectedEquipmentId, reducedMotion, onSelectEquipment }) {
  const sc = SCENE_COLORS[theme];
  const top = (floor.level - 1) * EXPLODE_GAP + SLAB_EXPLODED / 2;
  const toLocal = (fx, fy) => [(fx - 0.5) * b.footprintW, (fy - 0.5) * b.footprintD];
  const zoneNames = [...new Set(floor.equipment.map((e) => e.zone))];
  const isRoof = floor.level === b.floorCount;
  const rooms = [
    ...(isRoof ? [] : [{ name: CORE.name, ...CORE, core: true }]),
    ...zoneNames.map((n) => ({ name: n, ...ZONES[n] })),
  ];

  return (
    <group position={[0, top, 0]}>
      {rooms.map((r) => {
        const [cx, cz] = toLocal(r.x + r.w / 2, r.y + r.h / 2);
        const w = r.w * b.footprintW;
        const d = r.h * b.footprintD;
        return (
          <group key={r.name} position={[cx, 0.08, cz]}>
            <mesh receiveShadow>
              <boxGeometry args={[w, 0.16, d]} />
              <meshStandardMaterial color={r.core ? sc.core : sc.zone} roughness={0.9} />
              <Edges color={sc.zoneEdge} />
            </mesh>
            <Html position={[-w / 2 + 0.6, 0.2, -d / 2 + 0.6]} zIndexRange={[15, 0]} style={CLICK_THROUGH}>
              <span className="room-label">{r.name}</span>
            </Html>
          </group>
        );
      })}
      {floor.equipment.map((e) => (
        <EquipmentPoint
          key={e.id} e={e} theme={theme} position={toLocal(e.x, e.y)}
          selected={e.id === selectedEquipmentId} reducedMotion={reducedMotion} onSelect={() => onSelectEquipment(e.id)}
        />
      ))}
    </group>
  );
}

function EquipmentPoint({ e, theme, position, selected, reducedMotion, onSelect }) {
  const [hovered, setHovered] = useHoverCursor();
  const level = riskLevel(e.risk);
  const hex = RISK_COLORS[theme][level.key];
  const out = e.risk == null;
  const critical = isCritical(level);
  // Live-sensor assets are round cylinders; assets read by a technician or at
  // inspection (no live data) are square blocks, tall enough to spot.
  const inspection = e.dataSource !== 'sensor';
  const mat = useRef();
  useBeam(() => [mat.current], critical, reducedMotion, {
    min: 0.2, max: 1.1, base: out ? 0 : hovered || selected ? 0.45 : 0.15,
  });
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh
        position={[0, inspection ? 0.95 : 1.1, 0]} castShadow={!out}
        onClick={(ev) => { ev.stopPropagation(); onSelect(); }}
        onPointerOver={(ev) => { ev.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        {inspection ? <boxGeometry args={[2.2, 1.7, 2.2]} /> : <cylinderGeometry args={[1, 1, 2, 20]} />}
        <meshStandardMaterial
          ref={mat}
          color={hex} emissive={hex} emissiveIntensity={out ? 0 : hovered || selected ? 0.45 : 0.15}
          transparent opacity={out ? 0.45 : 1}
        />
      </mesh>
      {critical && <PingRing color={hex} inner={1.4} outer={1.9} y={0.22} reducedMotion={reducedMotion} />}
      {selected && (
        <mesh position={[0, 0.25, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.6, 2.1, 32]} />
          <meshBasicMaterial color={SCENE_COLORS[theme].accent} />
        </mesh>
      )}
      <Html position={[0, 3.4, 0]} center zIndexRange={[25, 0]} style={CLICK_THROUGH}>
        <button
          className={`equip-tag ${selected ? 'is-selected' : ''} ${out ? 'is-out' : ''} ${critical ? 'is-critical' : ''}`}
          style={{ '--risk': hex }}
          onClick={onSelect}
          aria-label={`${e.name}: ${level.label}${out ? '' : `, ${pct(e.risk)}`}`}
        >
          <RiskIcon level={level} color={hex} size={11} />
          {e.name}
          {e.openReports > 0 && <ReportsChip n={e.openReports} />}
          {e.work && <WorkChip status={e.work} />}
        </button>
      </Html>
    </group>
  );
}

// Repair dispatched or under way. The risk colour stays until it is resolved.
const WorkChip = ({ status }) => <span className="tag-work">{status === 'In progress' ? 'In progress' : 'Dispatched'}</span>;

const ReportsChip = ({ n }) => (
  <span className="tag-reports" title={`${n} open resident report${n > 1 ? 's' : ''}`}>{n} report{n > 1 ? 's' : ''}</span>
);

// One piece of street furniture in the public realm, at ground level and
// coloured by risk. Dimmed (and not clickable) while a building is open.
function StreetAsset({ e, theme, dim, selected, reducedMotion, onSelect }) {
  const [hovered, setHovered] = useHoverCursor();
  const sc = SCENE_COLORS[theme];
  const level = riskLevel(e.risk);
  const hex = RISK_COLORS[theme][level.key];
  const opacity = dim ? 0.3 : 1;
  const glow = hovered || selected ? 0.5 : 0.18;
  const handlers = dim
    ? {}
    : {
        onClick: (ev) => { ev.stopPropagation(); onSelect(); },
        onPointerOver: (ev) => { ev.stopPropagation(); setHovered(true); },
        onPointerOut: () => setHovered(false),
      };
  // Risk-coloured parts are collected so a critical asset can beam.
  const riskMats = useRef(new Set());
  const critical = isCritical(level) && !dim;
  useBeam(() => riskMats.current, critical, reducedMotion, { min: 0.25, max: 1.2 });
  const mat = (color, g = 0) => (
    <meshStandardMaterial
      ref={color === hex ? (m) => { if (m) { m.userData.base = g; riskMats.current.add(m); } } : undefined}
      color={color} emissive={g ? color : '#000'} emissiveIntensity={g} transparent opacity={opacity} depthWrite={!dim}
    />
  );

  let body;
  let tagY = 4.5;
  if (e.type === 'streetlight') {
    tagY = 10.5;
    body = (
      <>
        <mesh position={[0, 4, 0]} castShadow={!dim} {...handlers}><cylinderGeometry args={[0.2, 0.28, 8, 8]} />{mat(sc.pole)}</mesh>
        <mesh position={[0.8, 8.1, 0]} {...handlers}><boxGeometry args={[2.2, 0.45, 0.9]} />{mat(hex, glow + 0.3)}</mesh>
      </>
    );
  } else if (e.type === 'waste_point') {
    body = <mesh position={[0, 0.9, 0]} castShadow={!dim} {...handlers}><boxGeometry args={[4, 1.8, 2.4]} />{mat(hex, glow)}</mesh>;
  } else if (e.type === 'drain') {
    tagY = 2.5;
    body = (
      <mesh position={[0, 0.12, 0]} {...handlers}>
        <boxGeometry args={e.axis === 'x' ? [e.length, 0.24, 1.8] : [1.8, 0.24, e.length]} />{mat(hex, glow)}
      </mesh>
    );
  } else {
    tagY = 6;
    body = (
      <>
        <mesh position={[0, 0.15, 0]} receiveShadow {...handlers}><boxGeometry args={[8, 0.3, 8]} />{mat(hex, glow)}</mesh>
        <mesh position={[-2.5, 2, 0]} castShadow={!dim} {...handlers}><boxGeometry args={[0.3, 4, 0.3]} />{mat(sc.pole)}</mesh>
        <mesh position={[2.5, 2, 0]} castShadow={!dim} {...handlers}><boxGeometry args={[0.3, 4, 0.3]} />{mat(sc.pole)}</mesh>
        <mesh position={[0, 4, 0]} {...handlers}><boxGeometry args={[5.3, 0.3, 0.3]} />{mat(sc.pole)}</mesh>
      </>
    );
  }
  // Tags only where there is something to say, to keep the street view readable.
  const showTag = !dim && (selected || hovered || (e.risk ?? 0) >= OPEN_PROBLEM_MIN || e.openReports > 0 || !!e.work);
  return (
    <group position={[e.wx, 0, e.wz]}>
      {body}
      {selected && (
        <mesh position={[0, 0.3, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[3, 3.6, 32]} />
          <meshBasicMaterial color={sc.accent} />
        </mesh>
      )}
      {critical && (
        <>
          <PingRing color={hex} inner={2.4} outer={3} y={0.35} reducedMotion={reducedMotion} />
          <Beacon color={hex} y={tagY - 1} height={16} radius={1.2} reducedMotion={reducedMotion} />
        </>
      )}
      {showTag && (
        <Html position={[0, tagY, 0]} center zIndexRange={[22, 0]} style={CLICK_THROUGH}>
          <button
            className={`equip-tag ${selected ? 'is-selected' : ''} ${critical ? 'is-critical' : ''}`}
            style={{ '--risk': hex }}
            onClick={onSelect}
            aria-label={`${e.name}, ${e.zone}: ${level.label}${e.risk == null ? '' : `, ${pct(e.risk)}`}${e.openReports ? `, ${e.openReports} reports` : ''}`}
          >
            <RiskIcon level={level} color={hex} size={11} />
            {e.name}
            {e.openReports > 0 && <ReportsChip n={e.openReports} />}
            {e.work && <WorkChip status={e.work} />}
          </button>
        </Html>
      )}
    </group>
  );
}

function Building({ b, theme, view, floorLevel, selectedEquipmentId, reducedMotion, onSelect, onSelectFloor, onSelectEquipment }) {
  const [hovered, setHovered] = useHoverCursor();
  const sc = SCENE_COLORS[theme];
  const s = useMemo(() => summarize(b.equipment), [b]);
  const riskHex = RISK_COLORS[theme][s.level.key];
  const body = useMemo(() => tinted(sc.body, riskHex, s.level.key), [sc.body, riskHex, s.level.key]);
  const glass = useMemo(
    () => new THREE.Color(sc.glass).lerp(new THREE.Color(riskHex), TINT[s.level.key] * 0.45),
    [sc.glass, riskHex, s.level.key],
  );
  const height = b.floorCount * b.floorHeight;
  const reports = b.equipment.reduce((n, e) => n + (e.openReports || 0), 0);
  const working = b.equipment.filter((e) => e.work).length;

  // view: 'campus' (normal), 'faded' (another building is open), 'open' (this one is open)
  const isOpen = view === 'open';
  const faded = view === 'faded';
  // A critical building beams in the campus view: glass and roof glow, a ring
  // pings around its base and a light beam rises from the roof.
  const beaming = view === 'campus' && isCritical(s.level);
  const glassMat = useRef();
  const roofMat = useRef();
  useBeam(() => [glassMat.current], beaming, reducedMotion, { min: 0.12, max: 0.6, base: hovered ? 0.12 : 0 });
  useBeam(() => [roofMat.current], beaming, reducedMotion, { min: 0.2, max: 0.9, base: 0 });
  const handlers = view === 'campus'
    ? {
        onClick: (e) => { e.stopPropagation(); onSelect(b.id); },
        onPointerOver: (e) => { e.stopPropagation(); setHovered(true); },
        onPointerOut: () => setHovered(false),
      }
    : {};

  return (
    <group position={[b.x, 0, b.z]}>
      {!isOpen && (
        <mesh position={[0, height / 2, 0]} castShadow={!faded} receiveShadow {...handlers}>
          <boxGeometry args={[b.footprintW - 0.8, height, b.footprintD - 0.8]} />
          <meshStandardMaterial
            ref={glassMat}
            color={glass} roughness={0.35} metalness={0.2}
            transparent opacity={faded ? 0.12 : 1} depthWrite={!faded}
            emissive={beaming ? riskHex : hovered ? body : '#000'} emissiveIntensity={hovered ? 0.12 : 0}
          />
        </mesh>
      )}
      {beaming && (
        <>
          <PingRing
            color={riskHex} inner={Math.max(b.footprintW, b.footprintD) * 0.6} outer={Math.max(b.footprintW, b.footprintD) * 0.6 + 1.6}
            y={0.25} reducedMotion={reducedMotion}
          />
          <Beacon color={riskHex} y={height + 0.6} height={34} radius={Math.min(b.footprintW, b.footprintD) * 0.22} reducedMotion={reducedMotion} />
        </>
      )}
      {b.floors.map((f) => {
        const isSelectedFloor = f.level === floorLevel;
        const opacity = faded ? 0.12 : isOpen && floorLevel && !isSelectedFloor ? (f.level > floorLevel ? 0.03 : 0.08) : 1;
        return (
          <Slab
            key={f.id} b={b} floor={f} theme={theme}
            mode={isOpen ? 'exploded' : 'stacked'}
            buildingColor={body} opacity={opacity}
            interactive={view === 'campus' || (isOpen && !floorLevel)}
            selected={isOpen && isSelectedFloor}
            label={isOpen && !floorLevel}
            reducedMotion={reducedMotion}
            onClick={() => (view === 'campus' ? onSelect(b.id) : onSelectFloor(f.level))}
          />
        );
      })}
      {!isOpen && (
        <mesh position={[0, height + 0.3, 0]} castShadow={!faded} {...handlers}>
          <boxGeometry args={[b.footprintW, 0.6, b.footprintD]} />
          <meshStandardMaterial
            ref={roofMat} color={body} roughness={0.8} transparent opacity={faded ? 0.12 : 1} depthWrite={!faded}
            emissive={beaming ? riskHex : '#000'} emissiveIntensity={0}
          />
        </mesh>
      )}
      {isOpen && floorLevel && (
        <FloorLayout
          b={b} floor={b.floors[floorLevel - 1]} theme={theme} reducedMotion={reducedMotion}
          selectedEquipmentId={selectedEquipmentId} onSelectEquipment={onSelectEquipment}
        />
      )}
      {view === 'campus' && (
        <Html position={[0, height + 7, 0]} center zIndexRange={[20, 0]} style={CLICK_THROUGH}>
          <button
            className={`marker ${isCritical(s.level) ? 'is-critical' : ''}`}
            style={{ '--risk': riskHex }}
            onClick={() => onSelect(b.id)}
            aria-label={`${b.name}: ${s.level.label}, worst ${pct(s.worst?.risk)}`}
          >
            <RiskIcon level={s.level} color={riskHex} size={14} />
            <span className="marker-name">{b.name}</span>
            <span className="marker-level">{s.level.label}</span>
            {reports > 0 && <ReportsChip n={reports} />}
            {working > 0 && <span className="tag-work">{working} being fixed</span>}
          </button>
        </Html>
      )}
    </group>
  );
}

function Ground({ theme }) {
  const sc = SCENE_COLORS[theme];
  return (
    <group>
      <Scenery theme={theme} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 4]} receiveShadow>
        <planeGeometry args={[140, 120]} />
        <meshStandardMaterial color={sc.pad} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 4]} receiveShadow>
        <planeGeometry args={[6, 120]} />
        <meshStandardMaterial color={sc.path} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 6]} receiveShadow>
        <planeGeometry args={[140, 6]} />
        <meshStandardMaterial color={sc.path} roughness={1} />
      </mesh>
    </group>
  );
}

export function CampusScene({
  campus, theme, planView, reducedMotion,
  buildingId, floorLevel, equipmentId,
  onSelectBuilding, onSelectFloor, onSelectEquipment, onSelectStreetAsset, onReady,
}) {
  const controlsRef = useRef();
  const sc = SCENE_COLORS[theme];
  const building = campus.buildings.find((b) => b.id === buildingId) || null;
  const site = campus.buildings.find((b) => b.kind === 'site');
  const focus = building?.kind === 'site' && equipmentId ? building.equipment.find((e) => e.id === equipmentId) : null;
  // Street assets dim while one of the buildings is open.
  const dimStreets = !!building && building.kind !== 'site';
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: HOME.pos, fov: 38, near: 1, far: 2000 }}
      onCreated={() => onReady?.()}
      onPointerMissed={() => { if (!buildingId) onSelectBuilding(null); }}
    >
      <color attach="background" args={[sc.sky]} />
      <fog attach="fog" args={[sc.sky, 450, 1000]} />
      <hemisphereLight args={[theme === 'dark' ? '#9aa3b6' : '#ffffff', sc.ground, 0.9]} />
      <directionalLight
        position={[70, 160, 50]}
        intensity={theme === 'dark' ? 1.3 : 1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-120} shadow-camera-right={120}
        shadow-camera-top={120} shadow-camera-bottom={-120}
        shadow-camera-far={400}
      />
      <Ground theme={theme} />
      {site?.equipment.map((e) => (
        <StreetAsset
          key={e.id} e={e} theme={theme} dim={dimStreets} reducedMotion={reducedMotion}
          selected={e.id === equipmentId} onSelect={() => onSelectStreetAsset(e)}
        />
      ))}
      {campus.buildings.filter((b) => b.kind !== 'site').map((b) => (
        <Building
          key={b.id} b={b} theme={theme}
          view={!buildingId ? 'campus' : b.id === buildingId ? 'open' : 'faded'}
          floorLevel={b.id === buildingId ? floorLevel : null}
          selectedEquipmentId={equipmentId}
          reducedMotion={reducedMotion}
          onSelect={onSelectBuilding}
          onSelectFloor={onSelectFloor}
          onSelectEquipment={onSelectEquipment}
        />
      ))}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        target={HOME.target}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={15}
        maxDistance={420}
      />
      <CameraRig
        building={building} floorLevel={floorLevel} planView={planView}
        reducedMotion={reducedMotion} controlsRef={controlsRef} focus={focus}
      />
    </Canvas>
  );
}
