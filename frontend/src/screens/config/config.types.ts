// Which sub-screen the Config router is showing. 'menu' is the list of entries; the rest map to
// a folder under screens/config/. 'setup' is intentionally NOT here — the onboarding screen is
// reached only by the splash redirect (no server/auth) or a data wipe, never by navigating the
// Config menu.
export type ConfigSubScreen = 'menu' | 'server' | 'reader' | 'serials' | 'home' | 'notifications' | 'adult' | 'debug';

export interface ConfigScreenProps {
  // Config lives inside a tab; the tab host needs to know when a hardware-back should pop the
  // sub-screen back to the menu instead of leaving the tab. null = "menu is showing, handle back
  // normally".
  onRegisterBackHandler?: (fn: (() => boolean) | null) => void;
  // Fired when the user deletes their last server (and the app should bounce to onboarding).
  onServerCleared?: () => void;
  // Whether the tab is on screen. After it stays off screen for CONFIG_RESET_DELAY_MS the router
  // returns to the menu, so coming back later doesn't land on a stale sub-level. Default true.
  focused?: boolean;
}
