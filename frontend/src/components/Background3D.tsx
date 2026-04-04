"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import {
  useEffect,
  useMemo,
  useRef,
  Suspense,
  type MutableRefObject,
} from "react";
import type { Group } from "three";
import * as THREE from "three";

const shell = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 0,
  pointerEvents: "none" as const,
};

type MouseRef = MutableRefObject<{ x: number; y: number }>;

function ParticleShell({ count = 900 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 2.2 + Math.random() * 2.8;
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const sinPhi = Math.sin(phi);
      arr[i * 3] = radius * sinPhi * Math.cos(theta);
      arr[i * 3 + 1] = radius * sinPhi * Math.sin(theta);
      arr[i * 3 + 2] = radius * Math.cos(phi);
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (points.current) {
      points.current.rotation.y += delta * 0.04;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#a78bfa"
        size={0.028}
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function WireGlobe() {
  const group = useRef<Group>(null);

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.14;
      group.current.rotation.x += delta * 0.035;
    }
  });

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[1.55, 1]} />
        <meshBasicMaterial
          color="#22d3ee"
          wireframe
          transparent
          opacity={0.38}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.08}>
        <icosahedronGeometry args={[1.55, 1]} />
        <meshBasicMaterial
          color="#c084fc"
          wireframe
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Scene({ mouse }: { mouse: MouseRef }) {
  const parallax = useRef<Group>(null);

  useFrame((_, delta) => {
    const g = parallax.current;
    if (!g) return;
    const targetY = mouse.current.x * 0.42;
    const targetX = mouse.current.y * -0.28;
    g.rotation.y += (targetY - g.rotation.y) * delta * 1.8;
    g.rotation.x += (targetX - g.rotation.x) * delta * 1.8;
  });

  return (
    <group ref={parallax}>
      <WireGlobe />
      <ParticleShell count={800} />
      <Stars
        radius={90}
        depth={36}
        count={900}
        factor={2.2}
        saturation={0.25}
        fade
        speed={0.25}
      />
    </group>
  );
}

export default function Background3D() {
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div style={shell} aria-hidden>
      <Canvas
        style={{ width: "100%", height: "100%", display: "block" }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5.4], fov: 48 }}
      >
        <Suspense fallback={null}>
          <Scene mouse={mouse} />
        </Suspense>
      </Canvas>
    </div>
  );
}
