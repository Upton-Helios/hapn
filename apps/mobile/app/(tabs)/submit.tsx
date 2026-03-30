import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "@/constants";

export default function SubmitScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
        <Text style={{ fontSize: 40 }}>📝</Text>
        <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text1, marginTop: 12 }}>
          Post an Event
        </Text>
        <Text style={{ fontSize: 13, color: COLORS.text3, marginTop: 4, textAlign: "center" }}>
          Know about a local event? Farmers market, pickup game, trivia night — share it with Utah Valley.
        </Text>
      </View>
    </SafeAreaView>
  );
}
