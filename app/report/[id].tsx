import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, getQueryFn, queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";
import TranslateModal from "@/components/TranslateModal";
import { getLanguageName } from "@shared/languages";

interface SectionData {
  [key: string]: string | undefined;
}

function DetailSection({
  title,
  icon,
  color,
  data,
  labels,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  data: SectionData | null | undefined;
  labels: Record<string, string>;
}) {
  if (!data) return null;
  const entries = Object.entries(labels).filter(([key]) => data[key]);
  if (entries.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: color + "20" }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {entries.map(([key, label]) => (
        <View key={key} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{label}</Text>
          <Text style={styles.detailValue}>{data[key]}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [shareModal, setShareModal] = useState(false);
  const [shareTeamNumber, setShareTeamNumber] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [translateModal, setTranslateModal] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translatedLang, setTranslatedLang] = useState<string | null>(null);

  const { data: langData } = useQuery({
    queryKey: ["/api/settings/preferred-language"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const preferredLang = (langData as any)?.preferredLanguage || "en";

  const { data: report, isLoading } = useQuery({
    queryKey: [`/api/reports/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const r = report as any;

  async function handleDelete() {
    const doDelete = async () => {
      setDeleteLoading(true);
      try {
        await apiRequest("DELETE", `/api/reports/${id}`);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
        router.back();
      } catch (e) {
        if (Platform.OS === "web") {
          alert("Failed to delete report");
        } else {
          Alert.alert("Error", "Failed to delete report");
        }
      } finally {
        setDeleteLoading(false);
      }
    };

    if (Platform.OS === "web") {
      if (confirm("Are you sure you want to delete this report?")) {
        await doDelete();
      }
    } else {
      Alert.alert("Delete Report", "Are you sure? This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  }

  async function handleShare() {
    setShareError("");
    const num = parseInt(shareTeamNumber);
    if (!num || num <= 0) {
      setShareError("Enter a valid team number");
      return;
    }

    setShareLoading(true);
    try {
      await apiRequest("POST", `/api/reports/${id}/share`, { teamNumber: num });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: [`/api/reports/${id}`] });
      setShareTeamNumber("");
      setShareModal(false);
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("404")) {
        setShareError("Team not found. They need to sign up first.");
      } else if (msg.includes("400")) {
        setShareError("Cannot share with yourself");
      } else {
        setShareError("Failed to share report");
      }
    } finally {
      setShareLoading(false);
    }
  }

  async function handleRemoveShare(teamNum: number) {
    try {
      await apiRequest("DELETE", `/api/reports/${id}/share/${teamNum}`);
      queryClient.invalidateQueries({ queryKey: [`/api/reports/${id}`] });
    } catch (e) {}
  }

  function buildReportText(report: any): string {
    let text = `Scouting Report - Team ${report.scoutedTeamNumber}\nScouted by Team ${report.ownerTeamNumber}\n\n`;
    if (report.autonomous) {
      text += "Autonomous:\n";
      if (report.autonomous.startingPosition) text += `- Starting Position: ${report.autonomous.startingPosition}\n`;
      if (report.autonomous.preloadAction) text += `- Preload Action: ${report.autonomous.preloadAction}\n`;
      if (report.autonomous.autoScoring) text += `- Auto Scoring: ${report.autonomous.autoScoring}\n`;
      if (report.autonomous.navigationAccuracy) text += `- Navigation Accuracy: ${report.autonomous.navigationAccuracy}\n`;
      text += "\n";
    }
    if (report.teleop) {
      text += "Tele-Op:\n";
      if (report.teleop.cyclesPerMinute) text += `- Cycles/Minute: ${report.teleop.cyclesPerMinute}\n`;
      if (report.teleop.scoringAccuracy) text += `- Scoring Accuracy: ${report.teleop.scoringAccuracy}\n`;
      if (report.teleop.consistency) text += `- Consistency: ${report.teleop.consistency}\n`;
      if (report.teleop.mechanismPerformance) text += `- Mechanism Performance: ${report.teleop.mechanismPerformance}\n`;
      text += "\n";
    }
    if (report.endgame) {
      text += "Endgame:\n";
      if (report.endgame.taskCompletion) text += `- Task Completion: ${report.endgame.taskCompletion}\n`;
      if (report.endgame.reliability) text += `- Reliability: ${report.endgame.reliability}\n`;
      if (report.endgame.timeToComplete) text += `- Time to Complete: ${report.endgame.timeToComplete}\n`;
      if (report.endgame.penaltiesTaken) text += `- Penalties Taken: ${report.endgame.penaltiesTaken}\n`;
      text += "\n";
    }
    if (report.robotPerformance) {
      text += "Robot Performance:\n";
      if (report.robotPerformance.speed) text += `- Speed: ${report.robotPerformance.speed}\n`;
      if (report.robotPerformance.reliability) text += `- Reliability: ${report.robotPerformance.reliability}\n`;
      if (report.robotPerformance.defenseAbility) text += `- Defense Ability: ${report.robotPerformance.defenseAbility}\n`;
      if (report.robotPerformance.driverSkill) text += `- Driver Skill: ${report.robotPerformance.driverSkill}\n`;
      text += "\n";
    }
    if (report.weight) text += `Weight: ${report.weight}\n`;
    if (report.strongSuits) text += `Strong Suits: ${report.strongSuits}\n`;
    if (report.weakSuits) text += `Weak Suits: ${report.weakSuits}\n`;
    if (report.betterAt) text += `Better At: ${report.betterAt}\n`;
    return text;
  }

  function handleEdit() {
    router.push({
      pathname: "/scout",
      params: {
        editId: r.id,
        editData: JSON.stringify(r),
      },
    });
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!r) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="alert-circle-outline" size={40} color={Colors.textMuted} />
        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Report not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.primary, fontFamily: "Inter_500Medium", fontSize: 15 }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Report Detail</Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <Pressable onPress={() => setTranslateModal(true)} style={styles.backBtn}>
            <Ionicons name="language" size={22} color={Colors.primary} />
          </Pressable>
          {r.isOwner ? (
            <Pressable onPress={() => setShareModal(true)} style={styles.backBtn}>
              <Ionicons name="share-outline" size={22} color={Colors.primary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.teamHeader}>
          <View style={styles.teamBadgeLarge}>
            <Text style={styles.teamBadgeLargeText}>{r.scoutedTeamNumber}</Text>
          </View>
          <View>
            <Text style={styles.teamHeaderTitle}>Team {r.scoutedTeamNumber}</Text>
            <Text style={styles.teamHeaderSub}>
              Scouted by Team {r.ownerTeamNumber}
            </Text>
            <Text style={styles.teamHeaderDate}>
              {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
            </Text>
          </View>
        </View>

        {!r.isOwner && (
          <View style={styles.readOnlyBadge}>
            <Ionicons name="eye" size={16} color={Colors.accent} />
            <Text style={styles.readOnlyText}>Shared with you (read-only)</Text>
          </View>
        )}

        <DetailSection
          title="Autonomous"
          icon="rocket"
          color="#8B5CF6"
          data={r.autonomous}
          labels={{
            startingPosition: "Starting Position",
            preloadAction: "Preload Action",
            autoScoring: "Auto Scoring",
            navigationAccuracy: "Navigation Accuracy",
          }}
        />

        <DetailSection
          title="Tele-Op"
          icon="game-controller"
          color="#0EA5E9"
          data={r.teleop}
          labels={{
            cyclesPerMinute: "Cycles / Minute",
            scoringAccuracy: "Scoring Accuracy",
            consistency: "Consistency",
            mechanismPerformance: "Mechanism Performance",
          }}
        />

        <DetailSection
          title="Endgame"
          icon="flag"
          color="#F97316"
          data={r.endgame}
          labels={{
            taskCompletion: "Task Completion",
            reliability: "Reliability",
            timeToComplete: "Time to Complete",
            penaltiesTaken: "Penalties Taken",
          }}
        />

        <DetailSection
          title="Robot Performance"
          icon="hardware-chip"
          color="#22C55E"
          data={r.robotPerformance}
          labels={{
            speed: "Speed",
            reliability: "Reliability",
            defenseAbility: "Defense Ability",
            driverSkill: "Driver Skill",
          }}
        />

        {r.weight && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: "#EC489920" }]}>
                <Ionicons name="scale" size={16} color="#EC4899" />
              </View>
              <Text style={styles.sectionTitle}>Optional</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Weight</Text>
              <Text style={styles.detailValue}>{r.weight}</Text>
            </View>
          </View>
        )}

        {(r.strongSuits || r.weakSuits || r.betterAt) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: "#6366F120" }]}>
                <Ionicons name="chatbubble-ellipses" size={16} color="#6366F1" />
              </View>
              <Text style={styles.sectionTitle}>Notes</Text>
            </View>
            {r.strongSuits && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Strong Suits</Text>
                <Text style={styles.detailValue}>{r.strongSuits}</Text>
              </View>
            )}
            {r.weakSuits && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Weak Suits</Text>
                <Text style={styles.detailValue}>{r.weakSuits}</Text>
              </View>
            )}
            {r.betterAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Better At</Text>
                <Text style={styles.detailValue}>{r.betterAt}</Text>
              </View>
            )}
          </View>
        )}

        {r.isOwner && r.sharedWith && r.sharedWith.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: Colors.accent + "20" }]}>
                <Ionicons name="share-social" size={16} color={Colors.accent} />
              </View>
              <Text style={styles.sectionTitle}>Shared With</Text>
            </View>
            {r.sharedWith.map((tn: number) => (
              <View key={tn} style={styles.shareRow}>
                <View style={styles.shareTeamBadge}>
                  <Text style={styles.shareTeamText}>{tn}</Text>
                </View>
                <Text style={styles.shareTeamLabel}>Team {tn}</Text>
                <Pressable onPress={() => handleRemoveShare(tn)}>
                  <Ionicons name="close-circle" size={22} color={Colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {translatedText && translatedLang && (
          <View style={styles.translatedCard}>
            <View style={styles.translatedHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Ionicons name="language" size={16} color={Colors.primary} />
                <Text style={styles.translatedTitle}>
                  Translated to {getLanguageName(translatedLang)}
                </Text>
              </View>
              <Pressable onPress={() => { setTranslatedText(null); setTranslatedLang(null); }}>
                <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.translatedContent}>{translatedText}</Text>
          </View>
        )}

        {r.isOwner && (
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.85 }]}
              onPress={handleEdit}
            >
              <Ionicons name="create" size={18} color={Colors.primary} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
              onPress={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <ActivityIndicator size="small" color={Colors.error} />
              ) : (
                <>
                  <Ionicons name="trash" size={18} color={Colors.error} />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={shareModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShareModal(false)} />
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Share Report</Text>
            <Text style={styles.modalSub}>
              Enter the team number to share this report with
            </Text>

            {!!shareError && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{shareError}</Text>
              </View>
            )}

            <View style={styles.modalInputWrapper}>
              <Ionicons name="people" size={20} color={Colors.textMuted} style={{ marginLeft: 14 }} />
              <TextInput
                style={styles.modalInput}
                placeholder="Team number"
                placeholderTextColor={Colors.inputPlaceholder}
                value={shareTeamNumber}
                onChangeText={setShareTeamNumber}
                keyboardType="number-pad"
                autoFocus
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.shareBtn,
                pressed && { opacity: 0.85 },
                shareLoading && { opacity: 0.6 },
              ]}
              onPress={handleShare}
              disabled={shareLoading}
            >
              {shareLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="share" size={18} color={Colors.background} />
                  <Text style={styles.shareBtnText}>Share</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <TranslateModal
        visible={translateModal}
        onClose={() => setTranslateModal(false)}
        contentType="report"
        contentId={r.id}
        rawText={buildReportText(r)}
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  topTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  teamBadgeLarge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  teamBadgeLargeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.primary,
  },
  teamHeaderTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
  },
  teamHeaderSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  teamHeaderDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  readOnlyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent + "15",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  readOnlyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.accent,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  detailRow: {
    gap: 2,
  },
  detailLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  detailValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shareTeamBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.accent + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  shareTeamText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.accent,
  },
  shareTeamLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary + "15",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  editBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.primary,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.error + "10",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.error + "25",
  },
  deleteBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.error,
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
    gap: 14,
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
  modalInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  modalInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.inputText,
    padding: 14,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  shareBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.background,
  },
  translatedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  translatedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  translatedTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.primary,
  },
  translatedContent: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
});
