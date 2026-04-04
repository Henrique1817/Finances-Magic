"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AddAssetModal } from "@/components/wallet/AddAssetModal";

type Ctx = {
  openAddAsset: () => void;
};

const AddAssetContext = createContext<Ctx | null>(null);

export function AddAssetModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openAddAsset = useCallback(() => setOpen(true), []);

  const value = useMemo(() => ({ openAddAsset }), [openAddAsset]);

  return (
    <AddAssetContext.Provider value={value}>
      {children}
      <AddAssetModal open={open} onOpenChange={setOpen} />
    </AddAssetContext.Provider>
  );
}

export function useAddAssetModal() {
  const ctx = useContext(AddAssetContext);
  if (!ctx) {
    throw new Error(
      "useAddAssetModal must be used within AddAssetModalProvider",
    );
  }
  return ctx;
}
