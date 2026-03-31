import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "@/constants";

export default function MapScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 48 }}>🗺</Text>
        <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.text1, marginTop: 16 }}>
          Map View
        </Text>
        <Text style={{ fontSize: 15, color: COLORS.text3, marginTop: 8, textAlign: "center", lineHeight: 22 }}>
          An interactive map with event pins is coming soon. Stay tuned!
        </Text>
      </View>
    </SafeAreaView>
  );
}
