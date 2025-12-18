import { create } from 'zustand';

interface AppState {
  isOnline: boolean;
  isAppReady: boolean;
  lastSyncTime: Date | null;
  setOnline: (isOnline: boolean) => void;
  setAppReady: (isReady: boolean) => void;
  setLastSyncTime: (time: Date) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isOnline: true,
  isAppReady: false,
  lastSyncTime: null,

  setOnline: (isOnline) => set({ isOnline }),

  setAppReady: (isAppReady) => set({ isAppReady }),

  setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
}));
