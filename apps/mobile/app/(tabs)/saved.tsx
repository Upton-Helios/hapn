import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "@/constants";

export default function SavedScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 40 }}>♡</Text>
        <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text1, marginTop: 12 }}>
          Saved Events
        </Text>
        <Text style={{ fontSize: 13, color: COLORS.text3, marginTop: 4 }}>
          Sign in to save events and get reminders
        </Text>
      </View>
    </SafeAreaView>
  );
}
