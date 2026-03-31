import { View, Text, Image, FlatList, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useNearbyEvents, useHappeningNow } from "@/hooks/use-nearby-events";
import { useSavedEventIds, useToggleSave } from "@/hooks/use-saved-events";
import { useAuthStore } from "@/store/auth";
import { useFiltersStore, useLocationStore } from "@/store/filters";
import { CATEGORIES, TIME_FILTERS, COLORS } from "@/constants";
import type { Category, TimeFilter } from "@/store/filters";

function PulsingDot() {
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.live,
      }}
    />
  );
}

export default function DiscoverScreen() {
  const { data: events, isLoading } = useNearbyEvents();
  const { data: happeningNow } = useHappeningNow();
  const { data: savedIds } = useSavedEventIds();
  const toggleSave = useToggleSave();
  const user = useAuthStore((s) => s.user);
  const { timeFilter, category, searchQuery, setTimeFilter, setCategory, setSearchQuery } =
    useFiltersStore();
  const { city } = useLocationStore();

  const handleSave = (eventId: string) => {
    if (!user) {
      Alert.alert("Sign in required", "Sign in to save events.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign In", onPress: () => router.push("/(tabs)/saved") },
      ]);
      return;
    }
    const isSaved = savedIds?.has(eventId) ?? false;
    toggleSave.mutate({ eventId, isSaved });
  };

  // Client-side search filter (PostGIS handles geo + time + category)
  const filtered = searchQuery
    ? events?.filter((e) => {
        const q = searchQuery.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.city.toLowerCase().includes(q) ||
          (e.venue_name?.toLowerCase().includes(q) ?? false)
        );
      })
    : events;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: COLORS.text1,
                letterSpacing: -0.5,
              }}
            >
              hapn
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.text3, marginTop: -2 }}>
              Utah Valley · {city}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={{ position: "relative", marginTop: 14 }}>
          <Text
            style={{
              position: "absolute",
              left: 12,
              top: 11,
              fontSize: 16,
              color: COLORS.text4,
              zIndex: 1,
            }}
          >
            ⌕
          </Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search events, venues, cities..."
            placeholderTextColor={COLORS.text4}
            style={{
              padding: 12,
              paddingLeft: 36,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.surface1,
              fontSize: 14,
              color: COLORS.text1,
            }}
          />
        </View>

        {/* Time filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {TIME_FILTERS.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setTimeFilter(t.id as TimeFilter)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: timeFilter === t.id ? COLORS.text1 : COLORS.surface2,
                marginRight: 6,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              {t.id === "now" && <PulsingDot />}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: timeFilter === t.id ? "#fff" : COLORS.text3,
                }}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10, marginBottom: 14 }}
        >
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setCategory(c.id as Category)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: category === c.id ? COLORS.accent : COLORS.border,
                backgroundColor: category === c.id ? COLORS.accentSoft : "transparent",
                marginRight: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "500",
                  color: category === c.id ? COLORS.accent : COLORS.text3,
                }}
              >
                {c.icon} {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Event feed */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            {/* Happening Now carousel — independent of filters */}
            {(happeningNow?.length ?? 0) > 0 && timeFilter !== "now" ? (
              <View style={{ marginBottom: 20 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <PulsingDot />
                  <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.text1 }}>
                    Happening Now
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {happeningNow?.map((e) => (
                    <TouchableOpacity
                      key={e.id}
                      onPress={() => router.push(`/event/${e.id}`)}
                      style={{
                        width: 200,
                        borderRadius: 14,
                        overflow: "hidden",
                        backgroundColor: COLORS.surface1,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        marginRight: 12,
                      }}
                    >
                      {/* Carousel card image */}
                      <View style={{ height: 100, backgroundColor: COLORS.surface2 }}>
                        {e.image_url ? (
                          <Image
                            source={{ uri: e.image_url }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={{
                              flex: 1,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Text style={{ fontSize: 28 }}>
                              {CATEGORIES.find((c) => c.id === e.category)?.icon ?? "📅"}
                            </Text>
                          </View>
                        )}
                        {/* Price overlay */}
                        <View
                          style={{
                            position: "absolute",
                            bottom: 6,
                            left: 6,
                            backgroundColor: "rgba(0,0,0,0.6)",
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                          }}
                        >
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>
                            {e.price ?? "Free"}
                          </Text>
                        </View>
                      </View>
                      <View style={{ padding: 10 }}>
                        <Text
                          style={{ fontSize: 13, fontWeight: "700", color: COLORS.text1 }}
                          numberOfLines={1}
                        >
                          {e.title}
                        </Text>
                        <Text style={{ fontSize: 11, color: COLORS.text3, marginTop: 2 }}>
                          {e.venue_name} · {e.city}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Results count */}
            <Text style={{ fontSize: 12, color: COLORS.text4, marginBottom: 12 }}>
              {isLoading
                ? "Loading..."
                : `${filtered?.length ?? 0} event${(filtered?.length ?? 0) !== 1 ? "s" : ""} found`}
            </Text>
          </>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: "center", paddingTop: 40 }}>
              <Text style={{ fontSize: 40 }}>🔍</Text>
              <Text
                style={{ fontSize: 15, fontWeight: "600", color: COLORS.text3, marginTop: 8 }}
              >
                No events found
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.text4, marginTop: 4 }}>
                Try a different filter or time range
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/event/${item.id}`)}
            style={{
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: COLORS.surface1,
              borderWidth: 1,
              borderColor: COLORS.border,
              marginBottom: 16,
            }}
          >
            {/* Card image */}
            <View style={{ height: 180, backgroundColor: COLORS.surface2 }}>
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ fontSize: 40 }}>
                    {CATEGORIES.find((c) => c.id === item.category)?.icon ?? "📅"}
                  </Text>
                </View>
              )}
              {/* Overlaid badges */}
              <View style={{ position: "absolute", top: 10, left: 10, flexDirection: "row", gap: 6 }}>
                {item.is_happening_now && (
                  <View
                    style={{
                      backgroundColor: COLORS.live,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: "#fff",
                      }}
                    />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>LIVE</Text>
                  </View>
                )}
                {item.price && (
                  <View
                    style={{
                      backgroundColor: "rgba(0,0,0,0.6)",
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>
                      {item.price}
                    </Text>
                  </View>
                )}
              </View>
              {/* Save heart button */}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  handleSave(item.id);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 16, color: "#fff" }}>
                  {savedIds?.has(item.id) ? "♥" : "♡"}
                </Text>
              </TouchableOpacity>
              {/* Distance badge */}
              <View
                style={{
                  position: "absolute",
                  bottom: 10,
                  right: 10,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>
                  {item.distance_miles} mi
                </Text>
              </View>
            </View>

            {/* Card text */}
            <View style={{ padding: 14 }}>
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
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: COLORS.text1,
                  marginTop: 4,
                  lineHeight: 22,
                }}
              >
                {item.title}
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.text3, marginTop: 4 }}>
                {item.venue_name} · {item.city}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

    </SafeAreaView>
  );
}
