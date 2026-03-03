import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { SUPPORTED_LANGUAGES } from "@shared/languages";
import * as Haptics from "expo-haptics";

interface TranslateModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: string;
  contentId?: string;
  rawText: string;
  onTranslated: (translatedText: string, languageCode: string) => void;
  defaultLanguage?: string;
}

export default function TranslateModal({
  visible,
  onClose,
  contentType,
  contentId,
  rawText,
  onTranslated,
  defaultLanguage = "en",
}: TranslateModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedLang, setSelectedLang] = useState(
    defaultLanguage !== "en" ? defaultLanguage : ""
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState("");

  async function handleTranslate() {
    if (!selectedLang) {
      setError("Select a language");
      return;
    }
    setError("");
    setIsTranslating(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await apiRequest("POST", "/api/translate", {
        contentType,
        contentId: contentId || undefined,
        targetLanguageCode: selectedLang,
        rawText,
      });
      const data = await result.json();
      onTranslated(data.translatedText, selectedLang);
      onClose();
    } catch (e: any) {
      setError(e.message || "Translation failed");
    } finally {
      setIsTranslating(false);
    }
  }

  const filteredLangs = SUPPORTED_LANGUAGES.filter((l) => l.code !== "en");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Translate</Text>
          <Text style={styles.subtitle}>Select a language to translate into</Text>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <ScrollView
            style={styles.langList}
            showsVerticalScrollIndicator={false}
          >
            {filteredLangs.map((lang) => (
              <Pressable
                key={lang.code}
                style={[
                  styles.langItem,
                  selectedLang === lang.code && styles.langItemActive,
                ]}
                onPress={() => setSelectedLang(lang.code)}
              >
                <Text
                  style={[
                    styles.langText,
                    selectedLang === lang.code && styles.langTextActive,
                  ]}
                >
                  {lang.name}
                </Text>
                {selectedLang === lang.code && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={Colors.primary}
                  />
                )}
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            style={[styles.translateBtn, isTranslating && { opacity: 0.6 }]}
            onPress={handleTranslate}
            disabled={isTranslating}
          >
            {isTranslating ? (
              <ActivityIndicator size="small" color={Colors.background} />
            ) : (
              <>
                <Ionicons name="language" size={18} color={Colors.background} />
                <Text style={styles.translateBtnText}>Translate</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "70%",
    gap: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
    alignSelf: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.error,
    flex: 1,
  },
  langList: {
    maxHeight: 300,
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
  translateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  translateBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.background,
  },
});
