// o termo "set" refere-se a uma função que atualiza o estado do store

import { create } from "zustand";

type VoiceState = {
  micPermissionGranted: boolean;
  isWakeArmed: boolean;
  isListening: boolean;
  lastTranscript: string;
  setMicPermissionGranted: (v: boolean) => void;
  setIsWakeArmed: (v: boolean) => void;
  setIsListening: (v: boolean) => void;
  setLastTranscript: (v: string) => void;
};

export const useVoiceStore = create<VoiceState>((set) => ({
  micPermissionGranted: false,
  isWakeArmed: false,
  isListening: false,
  lastTranscript: "",
  setMicPermissionGranted: (v) => set({ micPermissionGranted: v }),
  setIsWakeArmed: (v) => set({ isWakeArmed: v }),
  setIsListening: (v) => set({ isListening: v }),
  setLastTranscript: (v) => set({ lastTranscript: v }),
}));
