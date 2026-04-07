"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import gsap from "gsap";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
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
type VisualScene = {
  id?: "default" | "apocalypse" | "oil-collapse" | "geopolitical-shock";
  intensity?: number;
  palette?: "default" | "danger" | "amber" | "cold";
  motion?: "calm" | "pulse" | "shake" | "collapse";
  durationMs?: number;
};
const VISUAL_SCENE_EVENT = "codechroma:visual-scene";
const VISUAL_BEAT_EVENT = "codechroma:visual-beat";
type VisualBeat = { kind?: string; strength?: number };

function ParticleShell({ count = 900 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);
  const basePositions = useMemo(() => {
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
  const positions = useMemo(() => new Float32Array(basePositions), [basePositions]);
  const cursor = useRef({ x: 100, y: 100 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      cursor.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      cursor.current.y = ((e.clientY / window.innerHeight) * 2 - 1) * -1;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame((_, delta) => {
    if (points.current) {
      points.current.rotation.y += delta * 0.04;
      const attr = points.current.geometry.getAttribute("position");
      const repelX = cursor.current.x * 3;
      const repelY = cursor.current.y * 2;
      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const bx = basePositions[ix];
        const by = basePositions[ix + 1];
        const bz = basePositions[ix + 2];
        const dx = bx - repelX;
        const dy = by - repelY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = Math.max(0, 1 - dist / 2.1);
        const repel = force * force * 0.28;
        positions[ix] += ((bx + (dx || 0.001) * repel) - positions[ix]) * 0.12;
        positions[ix + 1] += ((by + (dy || 0.001) * repel) - positions[ix + 1]) * 0.12;
        positions[ix + 2] += (bz - positions[ix + 2]) * 0.12;
      }
      attr.needsUpdate = true;
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

function Scene({
  mouse,
  scene,
  lowPerf,
  reduceMotion,
}: {
  mouse: MouseRef;
  scene: VisualScene;
  lowPerf: boolean;
  reduceMotion: boolean;
}) {
  const parallax = useRef<Group>(null);

  useFrame((_, delta) => {
    const g = parallax.current;
    if (!g) return;
    const intensity = Math.max(0, Math.min(1, scene.intensity ?? 0.2));
    const motionMul =
      scene.motion === "collapse" ? 1.8 : scene.motion === "shake" ? 1.35 : scene.motion === "pulse" ? 1.15 : 1;
    const targetY = mouse.current.x * 0.42;
    const targetX = mouse.current.y * -0.28;
    const slow = reduceMotion ? 0.45 : 1;
    g.rotation.y += (targetY - g.rotation.y) * delta * 1.8 * motionMul * slow;
    g.rotation.x += (targetX - g.rotation.x) * delta * 1.8 * motionMul * slow;
    g.position.z = -intensity * 0.18;
  });

  return (
    <group ref={parallax}>
      <WireGlobe />
      <ParticleShell count={lowPerf ? 420 : 800} />
      <Stars
        radius={90}
        depth={36}
        count={lowPerf ? 420 : 900}
        factor={2.2 + (scene.intensity ?? 0) * 0.9}
        saturation={0.25}
        fade
        speed={(0.25 + (scene.intensity ?? 0) * 0.4) * (reduceMotion ? 0.4 : 1)}
      />
    </group>
  );
}

export default function Background3D() {
  const mouse = useRef({ x: 0, y: 0 });
  const smooth = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<VisualScene>({ id: "default", intensity: 0.2, palette: "default", motion: "calm" });
  const [reduceMotion, setReduceMotion] = useState(false);
  const [lowPerf, setLowPerf] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const smallViewport = window.innerWidth < 820;
    const lowCpu = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 6;
    setLowPerf(smallViewport || lowCpu);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const nextX = (e.clientX / window.innerWidth) * 2 - 1;
      const nextY = (e.clientY / window.innerHeight) * 2 - 1;
      gsap.to(smooth.current, {
        x: nextX,
        y: nextY,
        duration: 0.35,
        ease: "power3.out",
        overwrite: true,
        onUpdate: () => {
          mouse.current.x = smooth.current.x;
          mouse.current.y = smooth.current.y;
        },
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    const onScene = (ev: Event) => {
      const detail = (ev as CustomEvent<VisualScene>).detail;
      setScene(detail ?? { id: "default", intensity: 0.2, palette: "default", motion: "calm" });
    };
    window.addEventListener(VISUAL_SCENE_EVENT, onScene as EventListener);
    return () => window.removeEventListener(VISUAL_SCENE_EVENT, onScene as EventListener);
  }, []);

  useEffect(() => {
    const flash = flashRef.current;
    if (!flash) return;
    const onBeat = (ev: Event) => {
      if (reduceMotion) return;
      const detail = (ev as CustomEvent<VisualBeat>).detail ?? {};
      const strength = Math.max(0, Math.min(1, detail.strength ?? 0.4));
      gsap.fromTo(
        flash,
        { opacity: 0.04 },
        { opacity: 0.08 + strength * 0.26, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.inOut" },
      );
    };
    window.addEventListener(VISUAL_BEAT_EVENT, onBeat as EventListener);
    return () => window.removeEventListener(VISUAL_BEAT_EVENT, onBeat as EventListener);
  }, [reduceMotion]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const flash = flashRef.current;
    if (!overlay || !flash) return;
    const intensity = Math.max(0, Math.min(1, scene.intensity ?? 0.2));
    const danger = scene.id === "apocalypse";
    const oil = scene.id === "oil-collapse";
    const geo = scene.id === "geopolitical-shock";
    const gradient = danger
      ? "radial-gradient(circle at 50% 30%, rgba(239,68,68,0.22), rgba(2,6,23,0.65) 70%)"
      : oil
        ? "radial-gradient(circle at 50% 20%, rgba(251,146,60,0.2), rgba(2,6,23,0.58) 72%)"
        : geo
          ? "radial-gradient(circle at 60% 35%, rgba(56,189,248,0.16), rgba(2,6,23,0.6) 72%)"
          : "radial-gradient(circle at 50% 30%, rgba(56,189,248,0.08), rgba(2,6,23,0.42) 72%)";
    gsap.killTweensOf([overlay, flash]);
    gsap.to(overlay, {
      backgroundImage: gradient,
      opacity: reduceMotion ? 0.16 : 0.26 + intensity * 0.42,
      duration: 0.55,
      ease: "power2.out",
    });
    if (reduceMotion) {
      gsap.to(flash, { opacity: 0.02, duration: 0.35, ease: "power1.out" });
      return;
    }
    if (danger || geo) {
      gsap.fromTo(
        flash,
        { opacity: 0 },
        { opacity: 0.12 + intensity * 0.3, duration: 0.08, repeat: 1, yoyo: true, ease: "power1.inOut" },
      );
    } else if (oil) {
      gsap.fromTo(
        flash,
        { opacity: 0.05 },
        { opacity: 0.14 + intensity * 0.2, duration: 0.6, repeat: 1, yoyo: true, ease: "sine.inOut" },
      );
    } else {
      gsap.to(flash, { opacity: 0.02, duration: 0.4, ease: "power1.out" });
    }
  }, [scene, reduceMotion]);

  return (
    <div style={shell} aria-hidden>
      <Canvas
        style={{ width: "100%", height: "100%", display: "block" }}
        gl={{
          alpha: true,
          antialias: !lowPerf,
          powerPreference: lowPerf ? "default" : "high-performance",
        }}
        dpr={lowPerf ? [1, 1.2] : [1, 2]}
        camera={{ position: [0, 0, 5.4], fov: 48 }}
      >
        <Suspense fallback={null}>
          <Scene mouse={mouse} scene={scene} lowPerf={lowPerf} reduceMotion={reduceMotion} />
        </Suspense>
      </Canvas>
      <div
        ref={overlayRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.24,
          mixBlendMode: "screen",
          backgroundImage: "radial-gradient(circle at 50% 30%, rgba(56,189,248,0.08), rgba(2,6,23,0.42) 72%)",
        }}
      />
      <div
        ref={flashRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.02,
          mixBlendMode: "soft-light",
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 2px, transparent 4px)",
        }}
      />
    </div>
  );
}
