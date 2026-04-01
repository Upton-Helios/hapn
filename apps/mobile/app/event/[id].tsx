import { useRef, useState } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Linking, Share, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useEvent } from "@/hooks/use-event";
import { useSavedEventIds, useToggleSave } from "@/hooks/use-saved-events";
import { useAuthStore } from "@/store/auth";
import { COLORS, CATEGORIES } from "@/constants";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function getRelativeDate(iso: string) {
  const eventDate = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 6) {
    return eventDate.toLocaleDateString("en-US", { weekday: "long" });
  }
  return eventDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function staticMapUrl(lat: number, lng: number) {
  const z = 15;
  const x = Math.floor(((lng + 180) / 360) * Math.pow(2, z));
  const yRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(yRad) + 1 / Math.cos(yRad)) / Math.PI) / 2) * Math.pow(2, z)
  );
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

const DESC_LINE_LIMIT = 4;

function ExpandableDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const fullHeight = useRef(0);
  const limitedHeight = useRef(0);

  const checkOverflow = () => {
    if (fullHeight.current > 0 && limitedHeight.current > 0) {
      setOverflows(fullHeight.current > limitedHeight.current + 1);
    }
  };

  return (
    <View>
      {/* Hidden copy to measure full height */}
      <Text
        style={[styles.description, { position: "absolute", opacity: 0, zIndex: -1 }]}
        onLayout={(e) => { fullHeight.current = e.nativeEvent.layout.height; checkOverflow(); }}
      >
        {text}
      </Text>
      <Text
        style={styles.description}
        numberOfLines={expanded ? undefined : DESC_LINE_LIMIT}
        onLayout={(e) => { limitedHeight.current = e.nativeEvent.layout.height; checkOverflow(); }}
      >
        {text}
      </Text>
      {overflows && (
        <TouchableOpacity onPress={() => setExpanded(!expanded)} style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.accent }}>
            {expanded ? "Show less" : "Show more"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, isLoading } = useEvent(id);
  const { data: savedIds } = useSavedEventIds();
  const toggleSave = useToggleSave();
  const user = useAuthStore((s) => s.user);

  const isSaved = savedIds?.has(id!) ?? false;

  const handleSave = () => {
    if (!user) {
      Alert.alert("Sign in required", "Sign in to save events.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign In", onPress: () => { router.back(); router.push("/(tabs)/saved"); } },
      ]);
      return;
    }
    toggleSave.mutate({ eventId: id!, isSaved });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 15, color: COLORS.text3 }}>Loading event...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 40 }}>😕</Text>
          <Text style={{ fontSize: 15, color: COLORS.text3, marginTop: 8 }}>Event not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: COLORS.accent }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const categoryIcon = CATEGORIES.find((c) => c.id === event.category)?.icon ?? "📅";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView>
        {/* Hero image */}
        <View style={{ height: 260, backgroundColor: COLORS.surface2 }}>
          {event.image_url ? (
            <Image
              source={{ uri: event.image_url }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 56 }}>{categoryIcon}</Text>
            </View>
          )}
          {/* Back button */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>‹</Text>
          </TouchableOpacity>
          {/* Close button */}
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>✕</Text>
          </TouchableOpacity>
          {/* Badges */}
          {event.is_happening_now && (
            <View style={styles.liveBadge}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" }} />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Happening Now</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={{ padding: 20 }}>
          {/* Date & time */}
          <Text style={styles.dateLabel}>
            {getRelativeDate(event.start_time)} · {formatTime(event.start_time)}
            {event.end_time ? ` – ${formatTime(event.end_time)}` : ""}
          </Text>

          {/* Title */}
          <Text style={styles.title}>{event.title}</Text>

          {/* Venue & distance */}
          <View style={styles.venueRow}>
            <Text style={{ fontSize: 15, color: COLORS.text2, flex: 1 }}>
              📍 {event.venue_name ?? "TBA"} · {event.city}
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.text3 }}>
              {event.distance_miles} mi
            </Text>
          </View>

          {/* Tags row */}
          <View style={styles.tagsRow}>
            {event.price && (
              <View style={styles.tag}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.text1 }}>
                  {event.price}
                </Text>
              </View>
            )}
            <View style={[styles.tag, { backgroundColor: COLORS.accentSoft }]}>
              <Text style={{ fontSize: 13, color: COLORS.accent }}>
                {categoryIcon} {event.category}
              </Text>
            </View>
            {event.tags
              ?.filter((t) => t !== event.category)
              .map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={{ fontSize: 12, color: COLORS.text3 }}>
                    {CATEGORIES.find((c) => c.id === t)?.icon} {t}
                  </Text>
                </View>
              ))}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Description */}
          {event.description && (
            <ExpandableDescription text={event.description} />
          )}
          {event.source_url && (
            <TouchableOpacity onPress={() => Linking.openURL(event.source_url!)} style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.accent, textDecorationLine: "underline" }}>
                View on {sourceDomain(event.source_url)}
              </Text>
            </TouchableOpacity>
          )}

          {/* Location */}
          {event.lat !== 0 && (
            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>Location</Text>
              <TouchableOpacity
                onPress={() => {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`;
                  Linking.openURL(url);
                }}
                style={styles.locationCard}
                activeOpacity={0.8}
              >
                <Image
                  source={{
                    uri: staticMapUrl(event.lat, event.lng),
                    headers: { "User-Agent": "Hapn/1.0 (hapn.app)" },
                  }}
                  style={styles.mapTile}
                  resizeMode="cover"
                />
                <View style={styles.mapPin}>
                  <Text style={{ fontSize: 24 }}>📍</Text>
                </View>
                <View style={{ padding: 14 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: COLORS.text1 }}>
                    {event.venue_name ?? "Venue TBA"}
                  </Text>
                  {event.address ? (
                    <Text style={{ fontSize: 13, color: COLORS.text3, marginTop: 3 }}>
                      {event.address}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 13, color: COLORS.text3, marginTop: 3 }}>
                      {event.city}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Get Directions button */}
              <TouchableOpacity
                onPress={() => {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`;
                  Linking.openURL(url);
                }}
                style={styles.directionsBtn}
              >
                <Text style={{ fontSize: 16 }}>🧭</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.accent }}>
                  Get Directions
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Source */}
          <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 11, color: COLORS.text4 }}>Source: {event.source}</Text>
            {event.source_url && (
              <TouchableOpacity onPress={() => Linking.openURL(event.source_url!)}>
                <Text style={{ fontSize: 11, color: COLORS.accent, fontWeight: "600" }}>
                  View original
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.saveBtn, isSaved && { backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.accent }]}
          onPress={handleSave}
        >
          <Text style={{ color: isSaved ? COLORS.accent : "#fff", fontSize: 16, fontWeight: "700" }}>
            {isSaved ? "♥ Saved" : "♡ Save Event"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={async () => {
            try {
              await Share.share({
                message: `Check out "${event.title}" on Hapn!\n${event.venue_name ?? ""} · ${event.city}\n${getRelativeDate(event.start_time)} at ${formatTime(event.start_time)}`,
                ...(event.source_url ? { url: event.source_url } : {}),
              });
            } catch (_) {}
          }}
        >
          <Text style={{ color: COLORS.text2, fontSize: 16, fontWeight: "600" }}>Share</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  liveBadge: {
    position: "absolute",
    top: 12,
    left: 56,
    backgroundColor: COLORS.live,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text1,
    marginTop: 12,
    lineHeight: 32,
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  tag: {
    backgroundColor: COLORS.surface2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 20,
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: COLORS.text2,
    lineHeight: 26,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text1,
    marginBottom: 10,
  },
  locationCard: {
    backgroundColor: COLORS.surface2,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mapTile: {
    width: "100%",
    height: 140,
    backgroundColor: COLORS.surface2,
  },
  mapPin: {
    position: "absolute",
    top: 52,
    left: "50%",
    marginLeft: -12,
  },
  bottomBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface1,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: "center",
  },
  shareBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface1,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
});
