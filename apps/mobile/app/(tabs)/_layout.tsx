import { Tabs } from "expo-router";
import { COLORS } from "@/constants";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.text4,
        tabBarStyle: {
          backgroundColor: COLORS.surface1,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) => <TabIcon icon="⌂" color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color }) => <TabIcon icon="🗺" color={color} />,
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: "Post",
          tabBarIcon: ({ color }) => <TabIcon icon="+" color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color }) => <TabIcon icon="♡" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <span style={{ fontSize: 20, color }}>{icon}</span>
  );
}
