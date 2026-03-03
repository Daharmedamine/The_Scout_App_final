import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { getQueryFn, getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import TranslateModal from "@/components/TranslateModal";
import { getLanguageName } from "@shared/languages";

const TOKEN_KEY = "auth_token";

async function getToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch { return null; }
}

type AnalysisMode = "team" | "alliance" | "competition";

export default function AIScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [mode, setMode] = useState<AnalysisMode>("team");
  const [teamNumber, setTeamNumber] = useState("");
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [translateModal, setTranslateModal] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translatedLang, setTranslatedLang] = useState<string | null>(null);

  const { data: competitions } = useQuery({
    queryKey: ["/api/competitions"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: langData } = useQuery({
    queryKey: ["/api/settings/preferred-language"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const preferredLang = (langData as any)?.preferredLanguage || "en";

  const compList = (competitions as any[]) || [];

  const runAnalysis = useCallback(async () => {
    setResult("");
    setError("");
    setIsAnalyzing(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const token = await getToken();
      const baseUrl = getApiUrl();
      let endpoint = "";
      let body: any = {};

      if (mode === "team") {
        const num = parseInt(teamNumber);
        if (!num) { setError("Enter a valid team number"); setIsAnalyzing(false); return; }
        endpoint = "api/ai/analyze-team";
        body = { teamNumber: num };
      } else if (mode === "alliance") {
        endpoint = "api/ai/alliance-suggestion";
        body = selectedCompId ? { competitionId: selectedCompId } : {};
      } else {
        if (!selectedCompId) { setError("Select a competition first"); setIsAnalyzing(false); return; }
        endpoint = "api/ai/competition-analysis";
        body = { competitionId: selectedCompId };
      }

      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Analysis failed" }));
        setError(data.message || "Analysis failed");
        setIsAnalyzing(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setError("Streaming not supported"); setIsAnalyzing(false); return; }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) break;
              if (data.error) { setError(data.error); break; }
              if (data.content) {
                setResult((prev) => prev + data.content);
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }, [mode, teamNumber, selectedCompId]);

  const modeOptions: { key: AnalysisMode; icon: string; label: string }[] = [
    { key: "team", icon: "hardware-chip", label: "Team" },
    { key: "alliance", icon: "people", label: "Alliance" },
    { key: "competition", icon: "trophy", label: "Event" },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + webTopInset + 16,
            paddingBottom: insets.bottom + 100,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Ionicons name="sparkles" size={24} color={Colors.primary} />
          <Text style={styles.title}>AI Analysis</Text>
        </View>

        <View style={styles.modeRow}>
          {modeOptions.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.modeBtn, mode === opt.key && styles.modeBtnActive]}
              onPress={() => {
                setMode(opt.key);
                setResult("");
                setError("");
              }}
            >
              <Ionicons
                name={opt.icon as any}
                size={18}
                color={mode === opt.key ? Colors.background : Colors.textSecondary}
              />
              <Text style={[styles.modeBtnText, mode === opt.key && styles.modeBtnTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          {mode === "team" && (
            <>
              <Text style={styles.cardLabel}>Team Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 12345"
                placeholderTextColor={Colors.inputPlaceholder}
                value={teamNumber}
                onChangeText={setTeamNumber}
                keyboardType="number-pad"
              />
              <Text style={styles.cardDesc}>
                Get AI-powered analysis of a team based on your scouting reports and their robot profile.
              </Text>
            </>
          )}

          {mode === "alliance" && (
            <>
              <Text style={styles.cardLabel}>Competition (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.compScroll}>
                <Pressable
                  style={[styles.compChip, !selectedCompId && styles.compChipActive]}
                  onPress={() => setSelectedCompId(null)}
                >
                  <Text style={[styles.compChipText, !selectedCompId && styles.compChipTextActive]}>All Teams</Text>
                </Pressable>
                {compList.map((c: any) => (
                  <Pressable
                    key={c.id}
                    style={[styles.compChip, selectedCompId === c.id && styles.compChipActive]}
                    onPress={() => setSelectedCompId(c.id)}
                  >
                    <Text style={[styles.compChipText, selectedCompId === c.id && styles.compChipTextActive]}>{c.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.cardDesc}>
                Get AI suggestions for the best alliance partners based on scouting data.
              </Text>
            </>
          )}

          {mode === "competition" && (
            <>
              <Text style={styles.cardLabel}>Select Competition</Text>
              {compList.length === 0 ? (
                <Text style={styles.cardDesc}>Create a competition first in the Competitions tab.</Text>
              ) : (
                <View style={styles.compList}>
                  {compList.map((c: any) => (
                    <Pressable
                      key={c.id}
                      style={[styles.compOption, selectedCompId === c.id && styles.compOptionActive]}
                      onPress={() => setSelectedCompId(c.id)}
                    >
                      <Ionicons
                        name={selectedCompId === c.id ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={selectedCompId === c.id ? Colors.primary : Colors.textMuted}
                      />
                      <Text style={[styles.compOptionText, selectedCompId === c.id && { color: Colors.text }]}>{c.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Text style={styles.cardDesc}>
                Full competition breakdown with power rankings, threats, and strategy.
              </Text>
            </>
          )}

          <Pressable
            style={[styles.analyzeBtn, isAnalyzing && { opacity: 0.6 }]}
            onPress={runAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <ActivityIndicator size="small" color={Colors.background} />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color={Colors.background} />
                <Text style={styles.analyzeBtnText}>Analyze</Text>
              </>
            )}
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {result ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Ionicons name="sparkles" size={16} color={Colors.primary} />
                <Text style={styles.resultTitle}>Analysis Result</Text>
              </View>
              <Pressable
                style={styles.translateChip}
                onPress={() => setTranslateModal(true)}
              >
                <Ionicons name="language" size={14} color={Colors.primary} />
                <Text style={styles.translateChipText}>Translate</Text>
              </Pressable>
            </View>
            <Text style={styles.resultText}>{result}</Text>

            {translatedText && translatedLang && (
              <View style={styles.translatedSection}>
                <View style={styles.translatedHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                    <Ionicons name="language" size={14} color={Colors.primary} />
                    <Text style={styles.translatedLabel}>
                      {getLanguageName(translatedLang)}
                    </Text>
                  </View>
                  <Pressable onPress={() => { setTranslatedText(null); setTranslatedLang(null); }}>
                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                  </Pressable>
                </View>
                <Text style={styles.resultText}>{translatedText}</Text>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <TranslateModal
        visible={translateModal}
        onClose={() => setTranslateModal(false)}
        contentType="ai_result"
        rawText={result}
        onTranslated={(text, lang) => {
          setTranslatedText(text);
          setTranslatedLang(lang);
        }}
        defaultLanguage={preferredLang}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 20, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.text },
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.textSecondary },
  modeBtnTextActive: { color: Colors.background },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  cardDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textMuted },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    padding: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.inputText,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  compScroll: { maxHeight: 44 },
  compChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    marginRight: 8,
  },
  compChipActive: { backgroundColor: Colors.primary },
  compChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  compChipTextActive: { color: Colors.background },
  compList: { gap: 4 },
  compOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  compOptionActive: {},
  compOptionText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textMuted },
  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  analyzeBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.background },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.error + "15",
    borderRadius: 12,
    padding: 14,
  },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.error, flex: 1 },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.primary },
  resultText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.text, lineHeight: 22 },
  translateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.primary + "15",
  },
  translateChipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.primary },
  translatedSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.primary + "20",
    paddingTop: 12,
    marginTop: 4,
    gap: 8,
  },
  translatedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  translatedLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.primary },
});
