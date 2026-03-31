import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/auth";
import { SignInScreen } from "@/components/sign-in-screen";
import { COLORS } from "@/constants";

export default function SavedScreen() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 15, color: COLORS.text3 }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return <SignInScreen message="Sign in to save events and get reminders." />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: COLORS.text1 }}>
          Saved Events
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.text3, marginTop: 4 }}>
          Events you've saved will appear here.
        </Text>
      </View>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 48 }}>♡</Text>
        <Text style={{ fontSize: 15, color: COLORS.text3, marginTop: 12, textAlign: "center", lineHeight: 22 }}>
          You haven't saved any events yet. Tap the heart on an event to save it for later.
        </Text>
      </View>
    </SafeAreaView>
  );
}
