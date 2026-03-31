import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useLocationStore } from "@/store/filters";
import { COLORS, CATEGORIES, UV_CITIES } from "@/constants";
import { SignInScreen } from "@/components/sign-in-screen";

// Categories valid for submission (exclude "all" and "free" — "free" is derived from price)
const SUBMIT_CATEGORIES = CATEGORIES.filter(
  (c) => c.id !== "all" && c.id !== "free"
);

type FormState = {
  title: string;
  description: string;
  venueName: string;
  city: string;
  category: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  price: string;
  lat: number;
  lng: number;
  locationLabel: string;
};

function initialForm(lat: number, lng: number): FormState {
  const now = new Date();
  const startTime = new Date(now);
  startTime.setHours(now.getHours() + 1, 0, 0, 0);
  const endTime = new Date(startTime);
  endTime.setHours(startTime.getHours() + 2);

  return {
    title: "",
    description: "",
    venueName: "",
    city: "Provo",
    category: "",
    date: now,
    startTime,
    endTime,
    price: "",
    lat,
    lng,
    locationLabel: "",
  };
}

// ─── Auth Gate ──────────────────────────────────────────────

// Auth gate is now handled by the shared SignInScreen component

// ─── Success Screen ─────────────────────────────────────────

function SuccessScreen({ onReset }: { onReset: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 56 }}>🎉</Text>
        <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.text1, marginTop: 16, textAlign: "center" }}>
          Event submitted!
        </Text>
        <Text style={{ fontSize: 15, color: COLORS.text3, marginTop: 8, textAlign: "center", lineHeight: 22 }}>
          Your event is now under review. Our team will check it and, once approved, it'll appear in the Hapn feed.
        </Text>
        <TouchableOpacity style={styles.submitAnother} onPress={onReset}>
          <Text style={{ color: COLORS.accent, fontSize: 15, fontWeight: "700" }}>
            Submit another event
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Picker Modals (date/time) ──────────────────────────────

type PickerTarget = "date" | "startTime" | "endTime" | null;

// ─── Dropdown ───────────────────────────────────────────────

function Dropdown({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: { id: string; label: string; icon?: string }[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdownBtn}
        onPress={() => setOpen(!open)}
      >
        <Text
          style={{
            fontSize: 15,
            color: value ? COLORS.text1 : COLORS.text4,
            flex: 1,
          }}
        >
          {value
            ? options.find((o) => o.id === value)?.label ??
              options.find((o) => o.id === value)?.id ??
              value
            : `Select ${label.toLowerCase()}`}
        </Text>
        <Text style={{ color: COLORS.text4 }}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdownList}>
          {options.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={[
                styles.dropdownItem,
                value === o.id && { backgroundColor: COLORS.accentSoft },
              ]}
              onPress={() => {
                onSelect(o.id);
                setOpen(false);
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  color: value === o.id ? COLORS.accent : COLORS.text1,
                  fontWeight: value === o.id ? "600" : "400",
                }}
              >
                {o.icon ? `${o.icon} ` : ""}
                {o.label ?? o.id}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Form ──────────────────────────────────────────────

export default function SubmitScreen() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const { latitude, longitude } = useLocationStore();

  const [form, setForm] = useState<FormState>(() =>
    initialForm(latitude, longitude)
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // Auth gate
  if (!user) {
    return <SignInScreen message="Sign in to post events to the community." />;
  }

  // Success state
  if (submitted) {
    return (
      <SuccessScreen
        onReset={() => {
          setForm(initialForm(latitude, longitude));
          setSubmitted(false);
        }}
      />
    );
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleDateChange = (
    _event: DateTimePickerEvent,
    selectedDate: Date | undefined
  ) => {
    if (Platform.OS === "android") setPickerTarget(null);
    if (!selectedDate || !pickerTarget) return;
    update(pickerTarget, selectedDate);
  };

  const confirmPicker = () => setPickerTarget(null);

  const formatDisplayDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const formatDisplayTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const combineDateAndTime = (date: Date, time: Date) => {
    const combined = new Date(date);
    combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return combined;
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.title.trim()) {
      Alert.alert("Title required", "Give your event a name.");
      return;
    }
    if (!form.category) {
      Alert.alert("Category required", "Pick a category for your event.");
      return;
    }
    if (!form.city) {
      Alert.alert("City required", "Select the city where this event takes place.");
      return;
    }

    setSubmitting(true);

    const startTime = combineDateAndTime(form.date, form.startTime);
    const endTime = combineDateAndTime(form.date, form.endTime);

    const { error } = await supabase.from("community_submissions").insert({
      submitted_by: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      venue_name: form.venueName.trim() || null,
      city: form.city,
      category: form.category,
      price: form.price.trim() || "Free",
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      lat: form.lat,
      lng: form.lng,
      status: "pending",
    });

    setSubmitting(false);

    if (error) {
      Alert.alert("Submission failed", error.message);
      return;
    }

    setSubmitted(true);
  };

  const cityOptions = UV_CITIES.map((c) => ({ id: c, label: c }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Text style={styles.screenTitle}>Post an Event</Text>
          <Text style={styles.screenSubtitle}>
            Share a local event with the Utah Valley community.
          </Text>

          {/* Title */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.fieldLabel}>
              Event Title <Text style={{ color: COLORS.live }}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Friday Night Trivia"
              placeholderTextColor={COLORS.text4}
              value={form.title}
              onChangeText={(v) => update("title", v)}
              maxLength={120}
            />
          </View>

          {/* Description */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: "top" }]}
              placeholder="What's it about? Include any details people should know."
              placeholderTextColor={COLORS.text4}
              value={form.description}
              onChangeText={(v) => update("description", v)}
              multiline
              maxLength={1000}
            />
          </View>

          {/* Venue */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.fieldLabel}>Venue Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Provo Town Square, Velour, etc."
              placeholderTextColor={COLORS.text4}
              value={form.venueName}
              onChangeText={(v) => update("venueName", v)}
            />
          </View>

          {/* City */}
          <Dropdown
            label="City *"
            value={form.city}
            options={cityOptions}
            onSelect={(v) => update("city", v)}
          />

          {/* Category */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.fieldLabel}>
              Category <Text style={{ color: COLORS.live }}>*</Text>
            </Text>
            <View style={styles.categoryGrid}>
              {SUBMIT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    form.category === cat.id && styles.categoryChipActive,
                  ]}
                  onPress={() => update("category", cat.id)}
                >
                  <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.categoryChipLabel,
                      form.category === cat.id && { color: COLORS.accent },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.fieldLabel}>Date</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setPickerTarget("date")}
            >
              <Text style={{ fontSize: 16 }}>📅</Text>
              <Text style={{ fontSize: 15, color: COLORS.text1 }}>
                {formatDisplayDate(form.date)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Start / End Time */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Start Time</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setPickerTarget("startTime")}
              >
                <Text style={{ fontSize: 16 }}>🕐</Text>
                <Text style={{ fontSize: 15, color: COLORS.text1 }}>
                  {formatDisplayTime(form.startTime)}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>End Time</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setPickerTarget("endTime")}
              >
                <Text style={{ fontSize: 16 }}>🕐</Text>
                <Text style={{ fontSize: 15, color: COLORS.text1 }}>
                  {formatDisplayTime(form.endTime)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Price */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.fieldLabel}>Price</Text>
            <TextInput
              style={styles.input}
              placeholder='e.g. "$10" or "Free"'
              placeholderTextColor={COLORS.text4}
              value={form.price}
              onChangeText={(v) => update("price", v)}
            />
          </View>

          {/* Location */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.fieldLabel}>Location Coordinates</Text>
            <Text style={{ fontSize: 12, color: COLORS.text3, marginBottom: 8 }}>
              Enter the address or coordinates of the event venue.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Address or place name"
              placeholderTextColor={COLORS.text4}
              value={form.locationLabel}
              onChangeText={(v) => update("locationLabel", v)}
              onEndEditing={() => geocodeAddress(form.locationLabel, update)}
            />
            <View style={styles.coordRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.coordLabel}>Lat</Text>
                <TextInput
                  style={[styles.input, { fontSize: 13 }]}
                  placeholder="40.2338"
                  placeholderTextColor={COLORS.text4}
                  value={form.lat ? String(form.lat) : ""}
                  onChangeText={(v) => {
                    const n = parseFloat(v);
                    if (!isNaN(n)) update("lat", n);
                    else if (v === "" || v === "-") update("lat", 0);
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.coordLabel}>Lng</Text>
                <TextInput
                  style={[styles.input, { fontSize: 13 }]}
                  placeholder="-111.6585"
                  placeholderTextColor={COLORS.text4}
                  value={form.lng ? String(form.lng) : ""}
                  onChangeText={(v) => {
                    const n = parseFloat(v);
                    if (!isNaN(n)) update("lng", n);
                    else if (v === "" || v === "-") update("lng", 0);
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <TouchableOpacity
              style={styles.useMyLocationBtn}
              onPress={() => {
                update("lat", latitude);
                update("lng", longitude);
              }}
            >
              <Text style={{ fontSize: 14 }}>📍</Text>
              <Text style={{ fontSize: 13, color: COLORS.accent, fontWeight: "600" }}>
                Use my current location
              </Text>
            </TouchableOpacity>
          </View>

          {/* Date/Time picker (rendered inline at bottom) */}
          {pickerTarget && (
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerCard}>
                <DateTimePicker
                  value={form[pickerTarget] as Date}
                  mode={pickerTarget === "date" ? "date" : "time"}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleDateChange}
                  minimumDate={
                    pickerTarget === "date" ? new Date() : undefined
                  }
                />
                {Platform.OS === "ios" && (
                  <TouchableOpacity
                    style={styles.pickerDoneBtn}
                    onPress={confirmPicker}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: "700",
                      }}
                    >
                      Done
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Submit button — fixed at bottom */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                Submit for Review
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Geocoding helper (Nominatim / OpenStreetMap, free) ─────

async function geocodeAddress(
  query: string,
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void
) {
  if (!query.trim()) return;
  try {
    const encoded = encodeURIComponent(query.trim() + ", Utah");
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`,
      { headers: { "User-Agent": "HapnApp/1.0" } }
    );
    const data = await res.json();
    if (data?.[0]) {
      update("lat", parseFloat(data[0].lat));
      update("lng", parseFloat(data[0].lon));
    }
  } catch {
    // Geocoding failed silently — user can still enter coords manually
  }
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text1,
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 14,
    color: COLORS.text3,
    marginBottom: 28,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text2,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: COLORS.surface1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text1,
  },
  dropdownBtn: {
    backgroundColor: COLORS.surface1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  dropdownList: {
    backgroundColor: COLORS.surface1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 200,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.surface1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
  },
  categoryChipLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text2,
  },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.surface1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerOverlay: {
    marginTop: 8,
    marginBottom: 16,
  },
  pickerCard: {
    backgroundColor: COLORS.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    alignItems: "center",
  },
  pickerDoneBtn: {
    marginTop: 12,
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  coordRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  coordLabel: {
    fontSize: 11,
    color: COLORS.text3,
    marginBottom: 4,
  },
  useMyLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface1,
  },
  submitBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  submitAnother: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
});
