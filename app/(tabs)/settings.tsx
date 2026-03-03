import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, getQueryFn, queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";
import { SUPPORTED_LANGUAGES, getLanguageName } from "@shared/languages";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [langModal, setLangModal] = useState(false);

  const { data: langData } = useQuery({
    queryKey: ["/api/settings/preferred-language"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const currentLang = (langData as any)?.preferredLanguage || "en";

  const langMutation = useMutation({
    mutationFn: async (languageCode: string) => {
      const res = await apiRequest("PUT", "/api/settings/preferred-language", { languageCode });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/preferred-language"] });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLangModal(false);
    },
  });

  async function handleLogout() {
    const doLogout = async () => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      queryClient.clear();
      await logout();
      router.replace("/(auth)/login");
    };

    if (Platform.OS === "web") {
      if (confirm("Are you sure you want to log out?")) {
        await doLogout();
      }
    } else {
      Alert.alert("Log Out", "Are you sure you want to log out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: doLogout },
      ]);
    }
  }

  return (
    <View style={[styles.container]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 16 }]}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="people" size={28} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.teamNumber}>Team {user?.teamNumber}</Text>
            <Text style={styles.teamLabel}>FTC Team</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Preferences</Text>
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}
          onPress={() => setLangModal(true)}
        >
          <View style={[styles.menuIcon, { backgroundColor: Colors.primary + "15" }]}>
            <Ionicons name="language" size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuText}>Preferred Language</Text>
            <Text style={styles.menuSubtext}>{getLanguageName(currentLang)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}
          onPress={handleLogout}
        >
          <View style={[styles.menuIcon, { backgroundColor: Colors.error + "15" }]}>
            <Ionicons name="log-out" size={20} color={Colors.error} />
          </View>
          <Text style={[styles.menuText, { color: Colors.error, flex: 1 }]}>Log Out</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>The Scout App v1.0.0</Text>
      </View>

      <Modal
        visible={langModal}
        animationType="slide"
        transparent
        onRequestClose={() => setLangModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLangModal(false)} />
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Preferred Language</Text>
            <Text style={styles.modalSub}>
              Translations will default to this language
            </Text>
            <ScrollView style={styles.langList} showsVerticalScrollIndicator={false}>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  style={[
                    styles.langItem,
                    currentLang === lang.code && styles.langItemActive,
                  ]}
                  onPress={() => langMutation.mutate(lang.code)}
                >
                  <Text
                    style={[
                      styles.langText,
                      currentLang === lang.code && styles.langTextActive,
                    ]}
                  >
                    {lang.name}
                  </Text>
                  {currentLang === lang.code && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.text,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  teamNumber: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
  },
  teamLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  menuText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  menuSubtext: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  versionContainer: {
    alignItems: "center",
    marginTop: "auto",
    paddingBottom: 120,
  },
  versionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "70%",
    gap: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
    alignSelf: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
  },
  modalSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  langList: {
    maxHeight: 350,
  },
  langItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  langItemActive: {
    backgroundColor: Colors.primary + "15",
  },
  langText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  langTextActive: {
    color: Colors.primary,
  },
});
