"use client";

import dynamic from "next/dynamic";

const Background3D = dynamic(() => import("./Background3D"), {
  ssr: false,
  loading: () => null,
});

export function Background3DLayer() {
  return <Background3D />;
}
