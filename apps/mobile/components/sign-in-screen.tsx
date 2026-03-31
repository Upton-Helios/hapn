import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/constants";
import * as Linking from "expo-linking";

// Google OAuth sign-in via Supabase
async function signInWithGoogle() {
  const redirectUrl = Linking.createURL("auth/callback");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    Alert.alert("Sign in failed", error.message);
    return;
  }

  if (data?.url) {
    await Linking.openURL(data.url);
  }
}

type Mode = "sign-in" | "sign-up";

export function SignInScreen({
  message,
}: {
  message?: string;
}) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentMagicLink, setSentMagicLink] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim()) {
      Alert.alert("Email required", "Please enter your email address.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Password too short", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: displayName.trim() || email.split("@")[0],
        },
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert("Sign up failed", error.message);
    } else {
      Alert.alert(
        "Check your email",
        "We sent a confirmation link to " + email.trim() + ". Please verify your email to complete sign up.",
        [{ text: "OK", onPress: () => setMode("sign-in") }]
      );
    }
  };

  const handleSignIn = async () => {
    if (!email.trim()) {
      Alert.alert("Email required", "Please enter your email address.");
      return;
    }
    if (!password) {
      Alert.alert("Password required", "Please enter your password.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert("Sign in failed", error.message);
    }
    // On success, the auth listener in the Zustand store handles the rest
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert("Email required", "Please enter your email address.");
      return;
    }
    setLoading(true);
    const redirectUrl = Linking.createURL("auth/callback");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectUrl },
    });
    setLoading(false);
    if (error) {
      Alert.alert("Failed", error.message);
    } else {
      setSentMagicLink(true);
    }
  };

  const isSignUp = mode === "sign-up";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={styles.container}>
        {/* Branding */}
        <Text style={styles.logo}>hapn</Text>
        <Text style={styles.tagline}>
          {message ?? (isSignUp
            ? "Create an account to join the Utah Valley community."
            : "Sign in to join the Utah Valley community."
          )}
        </Text>

        {/* Google sign-in button */}
        <TouchableOpacity style={styles.googleBtn} onPress={signInWithGoogle}>
          <Text style={{ fontSize: 20 }}>G</Text>
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Magic link sent state */}
        {sentMagicLink ? (
          <View style={styles.sentBox}>
            <Text style={{ fontSize: 32, textAlign: "center" }}>📬</Text>
            <Text style={styles.sentText}>
              Check your email! We sent a magic link to{" "}
              <Text style={{ fontWeight: "700" }}>{email}</Text>.
            </Text>
            <TouchableOpacity
              onPress={() => setSentMagicLink(false)}
              style={{ marginTop: 12 }}
            >
              <Text style={{ color: COLORS.accent, fontWeight: "600", fontSize: 14 }}>
                Use a different email
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Display name (sign-up only) */}
            {isSignUp && (
              <TextInput
                style={styles.input}
                placeholder="Display name"
                placeholderTextColor={COLORS.text4}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
            )}

            {/* Email */}
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={COLORS.text4}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            {/* Password */}
            <TextInput
              style={styles.input}
              placeholder={isSignUp ? "Create a password (6+ characters)" : "Password"}
              placeholderTextColor={COLORS.text4}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {/* Primary action */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
              onPress={isSignUp ? handleSignUp : handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {isSignUp ? "Create Account" : "Sign In"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Magic link option (sign-in only) */}
            {!isSignUp && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleMagicLink}
              >
                <Text style={{ color: COLORS.accent, fontSize: 14, fontWeight: "600" }}>
                  Send me a magic link instead
                </Text>
              </TouchableOpacity>
            )}

            {/* Toggle sign-in / sign-up */}
            <View style={styles.toggleRow}>
              <Text style={{ fontSize: 14, color: COLORS.text3 }}>
                {isSignUp ? "Already have an account?" : "Don't have an account?"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setMode(isSignUp ? "sign-in" : "sign-up");
                  setPassword("");
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.accent, marginLeft: 4 }}>
                  {isSignUp ? "Sign In" : "Sign Up"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Footer */}
        <Text style={styles.footerText}>
          By continuing, you agree to Hapn's Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 36,
    fontWeight: "900",
    color: COLORS.accent,
    textAlign: "center",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: COLORS.text3,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 32,
    lineHeight: 22,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.surface1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text1,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 13,
    color: COLORS.text4,
  },
  input: {
    backgroundColor: COLORS.surface1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text1,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  sentBox: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  sentText: {
    fontSize: 15,
    color: COLORS.text2,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.text4,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 16,
  },
});
