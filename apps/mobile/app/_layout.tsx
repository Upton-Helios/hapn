import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "@/store/auth";
import { useDeviceLocation } from "@/hooks/use-location";

const queryClient = new QueryClient();

function AppInitializer() {
  const initialize = useAuthStore((s) => s.initialize);
  useDeviceLocation();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInitializer />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="auth/callback" />
      </Stack>
    </QueryClientProvider>
  );
}
