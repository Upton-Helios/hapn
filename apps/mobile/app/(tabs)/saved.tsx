import { View, Text, Image, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { useSavedEvents, useSavedEventIds, useToggleSave } from "@/hooks/use-saved-events";
import { SignInScreen } from "@/components/sign-in-screen";
import { COLORS, CATEGORIES } from "@/constants";

export default function SavedScreen() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const { data: savedEvents, isLoading } = useSavedEvents();
  const { data: savedIds } = useSavedEventIds();
  const toggleSave = useToggleSave();

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
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: COLORS.text1 }}>
          Saved Events
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.text3, marginTop: 4 }}>
          {isLoading
            ? "Loading..."
            : `${savedEvents?.length ?? 0} saved event${(savedEvents?.length ?? 0) !== 1 ? "s" : ""}`}
        </Text>
      </View>

      <FlatList
        data={savedEvents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80, paddingHorizontal: 32 }}>
              <Text style={{ fontSize: 48 }}>♡</Text>
              <Text style={{ fontSize: 15, color: COLORS.text3, marginTop: 12, textAlign: "center", lineHeight: 22 }}>
                You haven't saved any events yet. Tap the heart on an event to save it for later.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/")}
                style={{ marginTop: 20, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: COLORS.accent }}
              >
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Discover Events</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/event/${item.id}`)}
            style={{
              flexDirection: "row",
              backgroundColor: COLORS.surface1,
              borderRadius: 14,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: COLORS.border,
              marginBottom: 12,
            }}
          >
            {/* Thumbnail */}
            <View style={{ width: 100, backgroundColor: COLORS.surface2 }}>
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ fontSize: 28 }}>
                    {CATEGORIES.find((c) => c.id === item.category)?.icon ?? "📅"}
                  </Text>
                </View>
              )}
            </View>

            {/* Info */}
            <View style={{ flex: 1, padding: 12, justifyContent: "center" }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: COLORS.accent,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {new Date(item.start_time).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                {" · "}
                {new Date(item.start_time).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
              <Text
                style={{ fontSize: 15, fontWeight: "700", color: COLORS.text1, marginTop: 3 }}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.text3, marginTop: 3 }} numberOfLines={1}>
                {item.venue_name} · {item.city}
              </Text>
            </View>

            {/* Unsave button */}
            <TouchableOpacity
              onPress={() => toggleSave.mutate({ eventId: item.id, isSaved: true })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ justifyContent: "center", paddingRight: 14 }}
            >
              <Text style={{ fontSize: 20, color: COLORS.accent }}>♥</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
