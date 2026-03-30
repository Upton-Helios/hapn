import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "@/constants";

export default function MapScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 40 }}>🗺</Text>
        <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text1, marginTop: 12 }}>
          Map View
        </Text>
        <Text style={{ fontSize: 13, color: COLORS.text3, marginTop: 4 }}>
          Mapbox integration coming soon
        </Text>
      </View>
    </SafeAreaView>
  );
}
