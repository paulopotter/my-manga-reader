import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Immersive mode = the app is drawing edge-to-edge, behind the status bar and the display cutout
// (notch/camera). Only the Reader turns it on today, and only when its immersive-mode preference
// is set. App.tsx consumes `immersive` to drop the root paddingTop (statusBarHeight) that every
// other screen wants — with it, the reader content fills the whole screen; without immersive on,
// the reader still respects the status-bar area so notifications stay visible.
//
// This is a tiny UI-shell flag, deliberately its own context (not folded into StartupContext,
// which is about boot state). A future full-bleed screen (a video player, say) can set it too.
//
// `topInset` is the real height of the status bar / cutout area, measured by App.tsx while NOT
// immersive. Immersive zeroes the system insets natively, so a screen that draws behind the cutout
// (the Reader's header) reads the last real value from here to keep its content below the camera.

interface ImmersiveState {
  immersive: boolean;
  setImmersive: (value: boolean) => void;
  topInset: number;
  setTopInset: (value: number) => void;
}

const ImmersiveContext = createContext<ImmersiveState>({
  immersive: false,
  setImmersive: () => {},
  topInset: 0,
  setTopInset: () => {},
});

export function ImmersiveProvider({ children }: { children: React.ReactNode }) {
  const [immersive, setImmersiveState] = useState(false);
  const setImmersive = useCallback((value: boolean) => setImmersiveState(value), []);
  const [topInset, setTopInsetState] = useState(0);
  const setTopInset = useCallback((value: number) => setTopInsetState(value), []);
  const value = useMemo(
    () => ({ immersive, setImmersive, topInset, setTopInset }),
    [immersive, setImmersive, topInset, setTopInset],
  );
  return <ImmersiveContext.Provider value={value}>{children}</ImmersiveContext.Provider>;
}

export function useImmersive(): ImmersiveState {
  return useContext(ImmersiveContext);
}
