import { View, Text, Image, ScrollView, TouchableOpacity, Pressable, StyleSheet } from "react-native";
import { COLORS, CATEGORIES } from "@/constants";
import type { NearbyEvent } from "@/hooks/use-nearby-events";

interface Props {
  event: NearbyEvent | null;
  onClose: () => void;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function EventDetail({ event, onClose }: Props) {
  if (!event) return null;

  return (
    <Pressable onPress={onClose} style={StyleSheet.absoluteFill}>
      <View style={styles.backdrop}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.sheet}>
          <ScrollView bounces={false}>
            {/* Image */}
            <View style={{ height: 220, backgroundColor: COLORS.surface2 }}>
              {event.image_url ? (
                <Image
                  source={{ uri: event.image_url }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ fontSize: 48 }}>
                    {CATEGORIES.find((c) => c.id === event.category)?.icon ?? "📅"}
                  </Text>
                </View>
              )}
              {/* Close button */}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={{ color: "#fff", fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
              {/* Happening Now badge */}
              {event.is_happening_now && (
                <View style={styles.liveBadge}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }} />
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                    Happening Now
                  </Text>
                </View>
              )}
            </View>

            {/* Content */}
            <View style={{ padding: 20, paddingBottom: 32 }}>
              <Text style={styles.dateText}>
                {formatDate(event.start_time)} · {formatTime(event.start_time)}
                {event.end_time ? ` – ${formatTime(event.end_time)}` : ""}
              </Text>
              <Text style={styles.title}>{event.title}</Text>
              <Text style={{ fontSize: 14, color: COLORS.text3, marginTop: 6 }}>
                {event.venue_name} · {event.city} · {event.distance_miles} mi away
              </Text>

              {/* Tags */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                {event.price && (
                  <View style={styles.tag}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.text2 }}>
                      {event.price}
                    </Text>
                  </View>
                )}
                {event.tags?.map((t) => (
                  <View key={t} style={styles.tag}>
                    <Text style={{ fontSize: 12, color: COLORS.text3 }}>
                      {CATEGORIES.find((c) => c.id === t)?.icon} {t}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Description */}
              {event.description && (
                <Text style={{ fontSize: 15, color: COLORS.text2, lineHeight: 24, marginTop: 16 }}>
                  {event.description}
                </Text>
              )}

              {/* Source */}
              <Text style={{ fontSize: 11, color: COLORS.text4, marginTop: 14 }}>
                Source: {event.source}
              </Text>

              {/* Action buttons */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
                <TouchableOpacity style={styles.saveBtn}>
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Save Event</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareBtn}>
                  <Text style={{ color: COLORS.text2, fontSize: 15, fontWeight: "600" }}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    overflow: "hidden",
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
    left: 12,
    backgroundColor: COLORS.live,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dateText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text1,
    marginTop: 6,
    lineHeight: 30,
  },
  tag: {
    backgroundColor: COLORS.surface2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
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
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: COLORS.surface1,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
});
