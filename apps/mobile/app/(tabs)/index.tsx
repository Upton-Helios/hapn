import { View, Text, FlatList, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNearbyEvents } from "@/hooks/use-nearby-events";
import { useFiltersStore, useLocationStore } from "@/store/filters";
import { CATEGORIES, TIME_FILTERS, COLORS } from "@/constants";
import type { Category, TimeFilter } from "@/store/filters";

export default function DiscoverScreen() {
  const { data: events, isLoading } = useNearbyEvents();
  const { timeFilter, category, searchQuery, setTimeFilter, setCategory, setSearchQuery } = useFiltersStore();
  const { city } = useLocationStore();

  const happeningNow = events?.filter((e) => e.is_happening_now) ?? [];

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
        <Text style={{ fontSize: 28, fontWeight: "800", color: COLORS.text1, letterSpacing: -0.5 }}>
          hapn
        </Text>
        <Text style={{ fontSize: 12, color: COLORS.text3, marginTop: -2 }}>
          Utah Valley · {city}
        </Text>

        {/* Search */}
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search events, venues, cities..."
          placeholderTextColor={COLORS.text4}
          style={{
            marginTop: 14,
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
              }}
            >
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginBottom: 14 }}>
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
          happeningNow.length > 0 && timeFilter !== "now" ? (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.text1, marginBottom: 8 }}>
                🔴 Happening Now
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {happeningNow.map((e) => (
                  <TouchableOpacity
                    key={e.id}
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
                    <View style={{ padding: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.text1 }} numberOfLines={1}>
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
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <Text style={{ fontSize: 40 }}>🔍</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: COLORS.text3, marginTop: 8 }}>
              {isLoading ? "Loading events..." : "No events found"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: COLORS.surface1,
              borderWidth: 1,
              borderColor: COLORS.border,
              marginBottom: 16,
            }}
          >
            <View style={{ padding: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: COLORS.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {new Date(item.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {" · "}
                {new Date(item.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text1, marginTop: 4 }}>
                {item.title}
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.text3, marginTop: 4 }}>
                {item.venue_name} · {item.city} · {item.distance_miles} mi
              </Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                {item.price && (
                  <View style={{ backgroundColor: COLORS.surface2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: COLORS.text2 }}>{item.price}</Text>
                  </View>
                )}
                {item.is_happening_now && (
                  <View style={{ backgroundColor: COLORS.live, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>LIVE</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
