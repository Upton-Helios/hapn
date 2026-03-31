import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/constants";

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    async function handleCallback() {
      // Extract tokens from the URL fragment/params
      const accessToken = params.access_token as string | undefined;
      const refreshToken = params.refresh_token as string | undefined;

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }

      // Navigate back to the main app
      router.replace("/(tabs)");
    }

    handleCallback();
  }, [params]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg }}>
      <ActivityIndicator size="large" color={COLORS.accent} />
      <Text style={{ marginTop: 16, fontSize: 15, color: COLORS.text3 }}>
        Signing you in...
      </Text>
    </View>
  );
}
