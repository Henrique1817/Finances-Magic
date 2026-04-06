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

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.12;
    }
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

/**
 * Fundo 3D discreto (Three.js + R3F) — barras reagem ao cenário quantificado.
 */
export function SimulatorAtmosphere({ barHeights }: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 opacity-90"
      aria-hidden
    >
      <Canvas
        camera={{ position: [0, 1.2, 4.2], fov: 42 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.75]}
      >
        <color attach="background" args={["transparent"]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 6, 4]} intensity={0.8} />
        <pointLight position={[-3, 2, 2]} intensity={0.4} color="#22d3ee" />
        <Suspense fallback={null}>
          <AmbientDrift />
          <FloatingBars heights={barHeights} />
        </Suspense>
      </Canvas>
    </div>
  );
}
