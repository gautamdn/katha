import { Tabs } from 'expo-router';
import { semantic, colors } from '@/theme';

/**
 * Main tab navigator.
 * 
 * TODO:
 * - Replace text labels with custom icons (warm, hand-drawn style)
 * - Add recording button as center floating action button
 * - Animate tab transitions
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.amber[600],
        tabBarInactiveTintColor: colors.warm[400],
        tabBarStyle: {
          backgroundColor: semantic.surface,
          borderTopColor: semantic.borderLight,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          // tabBarIcon: ...
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Write',
          // tabBarIcon: ...
        }}
      />
      <Tabs.Screen
        name="capsules"
        options={{
          title: 'My Stories',
          // tabBarIcon: ...
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Family',
          // tabBarIcon: ...
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          // tabBarIcon: ...
        }}
      />
    </Tabs>
  );
}
