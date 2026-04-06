"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Group } from "three";

type Props = {
  /** Alturas normalizadas 0–1 para barras 3D (ex.: impacto por ativo). */
  barHeights: number[];
};

function FloatingBars({ heights }: { heights: number[] }) {
  const group = useRef<Group>(null);
  const n = Math.max(1, heights.length);
  const cols = useMemo(() => {
    const h = heights.length > 0 ? heights : [0.15, 0.25, 0.2];
    return h.map((v, i) => ({
      h: Math.max(0.08, Math.min(1, v)),
      hue: 0.52 + (i / Math.max(n, 4)) * 0.12,
    }));
  }, [heights, n]);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.12;
    group.current.rotation.x += (state.pointer.y * 0.18 - group.current.rotation.x) * 0.06;
    group.current.position.x += (state.pointer.x * 0.2 - group.current.position.x) * 0.05;
  });

  const spread = 1.1;
  const start = (-(cols.length - 1) * spread) / 2;

  return (
    <group ref={group} position={[0, -0.35, 0]}>
      {cols.map((col, i) => {
        const x = start + i * spread;
        const y = col.h / 2;
        const color = new THREE.Color().setHSL(col.hue, 0.65, 0.55);
        return (
          <mesh key={i} position={[x, y, 0]} castShadow>
            <boxGeometry args={[0.38, col.h, 0.38]} />
            <meshStandardMaterial
              color={color}
              metalness={0.35}
              roughness={0.45}
              emissive={color}
              emissiveIntensity={0.15}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function AmbientDrift() {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (mesh.current) {
      mesh.current.rotation.x += delta * 0.03;
      mesh.current.rotation.z += delta * 0.02;
    }
  });
  return (
    <mesh ref={mesh} scale={2.4}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#312e81"
        wireframe
        transparent
        opacity={0.12}
        depthWrite={false}
      />
    </mesh>
  );
}

function EnergyRing() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (!ring.current) return;
    ring.current.rotation.z += delta * 0.12;
    ring.current.rotation.y += delta * 0.06;
    ring.current.position.y = 0.9 + Math.sin(state.clock.elapsedTime * 0.8) * 0.06;
  });
  return (
    <mesh ref={ring} position={[0, 0.9, -0.8]}>
      <torusGeometry args={[1.15, 0.02, 18, 120]} />
      <meshBasicMaterial color="#22d3ee" transparent opacity={0.42} depthWrite={false} />
    </mesh>
  );
}

/**
 * Fundo 3D discreto (Three.js + R3F) — barras reagem ao cenário quantificado.
 */
export function SimulatorAtmosphere({ barHeights }: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_4%,rgba(34,211,238,0.2),transparent_36%),radial-gradient(circle_at_78%_20%,rgba(167,139,250,0.18),transparent_44%),linear-gradient(to_bottom,#020617_0%,#030712_45%,#01030a_100%)]" />
      <Canvas
        camera={{ position: [0, 1.2, 4.2], fov: 42 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.75]}
        className="opacity-85"
      >
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.3} />
        <directionalLight position={[4, 6, 4]} intensity={0.7} />
        <pointLight position={[-3, 2, 2]} intensity={0.5} color="#22d3ee" />
        <pointLight position={[2.8, 1.4, -1]} intensity={0.35} color="#a78bfa" />
        <Suspense fallback={null}>
          <AmbientDrift />
          <EnergyRing />
          <FloatingBars heights={barHeights} />
        </Suspense>
      </Canvas>
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent" />
    </div>
  );
}
