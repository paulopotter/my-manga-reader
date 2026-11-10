import React, { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Bell, House, Library, Search, Settings, Star } from 'lucide-react-native';
import { Routes } from './routes';
import { DashboardScreen } from '../screens/dashboard';
import { LibraryScreen } from '../screens/library';
import { ConfigScreen } from '../screens/config';
import { NotificationsScreen, useUnreadNotificationsCount } from '../screens/notifications';
import { SearchScreen } from '../screens/search';
import { useStartup } from '../shared/context/startup';
import { useStrings } from '../shared/i18n';
import { NotificationsService } from '../shared/services/notifications';
import { ColorTool, border, icon } from '../shared/theme';
import { useTheme } from '../shared/context';

// Whether notifications are enabled right now (the real Android channel's own state — see Plan
// 008 README Decision 10) — read straight from the shared Service, re-checked whenever the app
// returns to foreground (the user may have just come back from the system settings screen). Only
// used here to decide whether the Notifications tab shows at all; the full read/write surface
// (open settings, etc.) belongs to config/notifications' own hook, not duplicated here.
function useNotificationsEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reload = () => {
      NotificationsService.channel.isEnabled().then(setEnabled).catch(() => setEnabled(false));
    };
    reload();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {reload();}
    });
    return () => sub.remove();
  }, []);

  return enabled;
}

const Tab = createBottomTabNavigator();

const INITIAL_ROUTE = {
  dashboard: Routes.DASHBOARD,
  following: Routes.FOLLOWING,
  library: Routes.LIBRARY,
} as const;

// Extracted to avoid react/no-unstable-nested-components lint warning.
function ConfigTab({
  onRegisterBackHandler,
  onServerCleared,
}: {
  onRegisterBackHandler: (fn: (() => boolean) | null) => void;
  onServerCleared: () => void;
}) {
  // Also false while a screen opened above the tabs (reader, series) covers this one.
  const focused = useIsFocused();
  return (
    <ConfigScreen
      focused={focused}
      onRegisterBackHandler={onRegisterBackHandler}
      onServerCleared={onServerCleared}
    />
  );
}

export function MainNavigator() {
  const { colors, text } = useTheme();
  const BG = colors.surface.secondary;
  const BORDER = colors.border.primary;
  const ACTIVE = colors.icon.button.secondary;
  const INACTIVE = ColorTool.add.alpha(colors.text.secondary, 0.45);
  const { refresh, hasFollowedSeries, startTab, dashboardUnlocked } = useStartup();
  const strings = useStrings();
  const navigation = useNavigation<any>();
  const isConfigSubScreenRef = useRef(false);
  const unreadNotificationsCount = useUnreadNotificationsCount();
  const notificationsEnabled = useNotificationsEnabled();

  const handleRegisterBackHandler = (fn: (() => boolean) | null) => {
    isConfigSubScreenRef.current = fn !== null;
  };

  const handleServerCleared = () => {
    refresh();
    navigation.reset({ index: 0, routes: [{ name: Routes.SETUP }] });
  };

  const initialTab = INITIAL_ROUTE[startTab];

  return (
    <Tab.Navigator
      key={initialTab}
      initialRouteName={initialTab}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: BG,
          borderTopColor: BORDER,
          borderTopWidth: border.medium,
          height: 60,
        },
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { fontSize: text.size[2] },
      }}
    >
      {/* The Dashboard tab is absent on a brand-new install; once unlocked it stays. */}
      {dashboardUnlocked && (
        <Tab.Screen
          name={Routes.DASHBOARD}
          component={DashboardScreen}
          options={{
            tabBarLabel: strings.navDashboard,
            tabBarIcon: ({ focused }) => <House size={icon.size[5]} color={focused ? ACTIVE : INACTIVE} />,
          }}
        />
      )}
      {/* Following and Library are the same component; the `mode` route param is the only
          difference (followed-only filter + its own prefs scope + nav origin). */}
      {hasFollowedSeries && (
        <Tab.Screen
          name={Routes.FOLLOWING}
          component={LibraryScreen}
          initialParams={{ mode: 'following' }}
          options={{
            tabBarLabel: strings.navFollowing,
            tabBarIcon: ({ focused }) => <Star size={icon.size[5]} color={focused ? ACTIVE : INACTIVE} />,
          }}
        />
      )}
      <Tab.Screen
        name={Routes.LIBRARY}
        component={LibraryScreen}
        initialParams={{ mode: 'library' }}
        options={{
          tabBarLabel: strings.navLibrary,
          tabBarIcon: ({ focused }) => <Library size={icon.size[5]} color={focused ? ACTIVE : INACTIVE} />,
        }}
      />
      <Tab.Screen
        name={Routes.SEARCH}
        component={SearchScreen}
        options={{
          tabBarLabel: strings.navSearch,
          tabBarIcon: ({ focused }) => <Search size={icon.size[5]} color={focused ? ACTIVE : INACTIVE} />,
        }}
      />
      {notificationsEnabled && (
        <Tab.Screen
          name={Routes.NOTIFICATIONS}
          component={NotificationsScreen}
          options={{
            tabBarLabel: strings.navNotifications,
            tabBarBadge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
            tabBarIcon: ({ focused }) => <Bell size={icon.size[5]} color={focused ? ACTIVE : INACTIVE} />,
          }}
        />
      )}
      <Tab.Screen
        name={Routes.CONFIG}
        options={{
          tabBarLabel: strings.navConfig,
          tabBarIcon: ({ focused }) => <Settings size={icon.size[5]} color={focused ? ACTIVE : INACTIVE} />,
        }}
      >
        {() => (
          <ConfigTab
            onRegisterBackHandler={handleRegisterBackHandler}
            onServerCleared={handleServerCleared}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
