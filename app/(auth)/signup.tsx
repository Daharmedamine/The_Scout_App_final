import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { signup } = useAuth();
  const [teamNumber, setTeamNumber] = useState("");
  const [teamName, setTeamName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  async function handleSignup() {
    setError("");
    const num = parseInt(teamNumber);
    if (!num || num <= 0) {
      setError("Please enter a valid team number");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await signup(num, password, teamName || undefined);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message?.includes("409") ? "This team number is already registered" : "Something went wrong. Please try again.");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + webTopInset + 40,
          paddingBottom: insets.bottom + 40,
        },
      ]}
      bottomOffset={20}
    >
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </Pressable>

      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Register your FTC team to start scouting</Text>

      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Team Number *</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="people" size={20} color={Colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="e.g. 12345"
            placeholderTextColor={Colors.inputPlaceholder}
            value={teamNumber}
            onChangeText={setTeamNumber}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Team Name (optional)</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="flag" size={20} color={Colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="e.g. RoboWarriors"
            placeholderTextColor={Colors.inputPlaceholder}
            value={teamName}
            onChangeText={setTeamName}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password *</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed" size={20} color={Colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Min 4 characters"
            placeholderTextColor={Colors.inputPlaceholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={Colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Confirm Password *</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed" size={20} color={Colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Re-enter password"
            placeholderTextColor={Colors.inputPlaceholder}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
          />
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          loading && styles.buttonDisabled,
        ]}
        onPress={handleSignup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.buttonText}>Create Account</Text>
        )}
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.linkText}>Log In</Text>
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 24,
    gap: 14,
  },
  backBtn: {
    marginBottom: 8,
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.error,
    flex: 1,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  inputIcon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.inputText,
    padding: 14,
  },
  eyeBtn: {
    padding: 14,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.background,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  linkText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.primary,
  },
});
