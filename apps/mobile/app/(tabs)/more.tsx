import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/auth";
import { SignInScreen } from "@/components/sign-in-screen";
import { COLORS } from "@/constants";

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  destructive,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={{ fontSize: 18, width: 28 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.rowLabel,
            destructive && { color: COLORS.live },
          ]}
        >
          {label}
        </Text>
        {value ? (
          <Text style={styles.rowValue}>{value}</Text>
        ) : null}
      </View>
      {onPress && (
        <Text style={{ color: COLORS.text4, fontSize: 16 }}>›</Text>
      )}
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signOut = useAuthStore((s) => s.signOut);

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
    return <SignInScreen message="Sign in to manage your profile and settings." />;
  }

  const email = user.email ?? "No email";
  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    email.split("@")[0];
  const avatarLetter = (displayName?.[0] ?? "?").toUpperCase();
  const provider = user.app_metadata?.provider ?? "email";
  const createdAt = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: signOut,
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ padding: 20, paddingBottom: 0 }}>
          <Text style={styles.screenTitle}>Settings</Text>
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.email}>{email}</Text>
          </View>
        </View>

        {/* Account section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionCard}>
            <SettingsRow
              icon="👤"
              label="Display Name"
              value={displayName}
            />
            <SettingsRow
              icon="✉️"
              label="Email"
              value={email}
            />
            <SettingsRow
              icon="🔑"
              label="Sign-in Method"
              value={provider === "google" ? "Google" : "Magic Link"}
            />
            <SettingsRow
              icon="📅"
              label="Member Since"
              value={createdAt}
            />
          </View>
        </View>

        {/* App section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.sectionCard}>
            <SettingsRow icon="📍" label="Location" value="Utah Valley" />
            <SettingsRow icon="📏" label="Search Radius" value="15 miles" />
            <SettingsRow icon="📱" label="Version" value="0.1.0" />
          </View>
        </View>

        {/* About section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.sectionCard}>
            <SettingsRow icon="💡" label="About Hapn" onPress={() => {}} />
            <SettingsRow icon="📝" label="Send Feedback" onPress={() => {}} />
            <SettingsRow icon="📜" label="Privacy Policy" onPress={() => {}} />
            <SettingsRow icon="📄" label="Terms of Service" onPress={() => {}} />
          </View>
        </View>

        {/* Sign out */}
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <SettingsRow
              icon="🚪"
              label="Sign Out"
              onPress={handleSignOut}
              destructive
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text1,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    margin: 20,
    padding: 16,
    backgroundColor: COLORS.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  displayName: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text1,
  },
  email: {
    fontSize: 13,
    color: COLORS.text3,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: COLORS.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text1,
  },
  rowValue: {
    fontSize: 13,
    color: COLORS.text3,
    marginTop: 1,
  },
});
