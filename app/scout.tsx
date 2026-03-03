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
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { apiRequest, queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

type FieldType = "text" | "select" | "multiline" | "rating";

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type: FieldType;
  options?: string[];
  ratingMax?: number;
}

interface FormSection {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  fields: FieldDef[];
}

const sections: FormSection[] = [
  {
    title: "Autonomous",
    icon: "rocket",
    color: "#8B5CF6",
    fields: [
      { key: "startingPosition", label: "Starting Position", type: "select", options: ["Far", "Close"] },
      { key: "preloadAction", label: "Preload Action", type: "text", placeholder: "What do they do with preloaded element?" },
      { key: "autoScoring", label: "Auto Scoring", type: "text", placeholder: "Points, accuracy, cycles..." },
      { key: "navigationAccuracy", label: "Navigation Accuracy", type: "select", options: ["Low", "Medium", "High"] },
    ],
  },
  {
    title: "Tele-Op",
    icon: "game-controller",
    color: "#0EA5E9",
    fields: [
      { key: "cyclesPerMinute", label: "Cycles / Minute", type: "text", placeholder: "How many cycles per minute?" },
      { key: "scoringAccuracy", label: "Scoring Accuracy", type: "select", options: ["Low", "Medium", "High"] },
      { key: "consistency", label: "Consistency", type: "select", options: ["Inconsistent", "Average", "Consistent"] },
      { key: "mechanismPerformance", label: "Mechanism Performance", type: "text", placeholder: "Intake, shooter, arm, etc." },
    ],
  },
  {
    title: "Endgame",
    icon: "flag",
    color: "#F97316",
    fields: [
      { key: "taskCompletion", label: "Task Completion", type: "select", options: ["Yes", "Partial", "No"] },
      { key: "reliability", label: "Reliability", type: "select", options: ["Low", "Medium", "High"] },
      { key: "timeToComplete", label: "Time to Complete", type: "select", options: ["< 10s", "10-20s", "20-30s", "> 30s"] },
      { key: "penaltiesTaken", label: "Penalties Taken", type: "select", options: ["None", "Minor", "Major"] },
    ],
  },
  {
    title: "Robot Performance",
    icon: "hardware-chip",
    color: "#22C55E",
    fields: [
      { key: "speed", label: "Speed", type: "rating", ratingMax: 10 },
      { key: "reliability", label: "Reliability", type: "select", options: ["Low", "Medium", "High"] },
      { key: "defenseAbility", label: "Defense Ability", type: "select", options: ["None", "Average", "Strong"] },
      { key: "driverSkill", label: "Driver Skill", type: "rating", ratingMax: 10 },
    ],
  },
];

function SelectButtons({ options, value, onSelect, color }: { options: string[]; value: string; onSelect: (v: string) => void; color: string }) {
  return (
    <View style={selectStyles.row}>
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <Pressable
            key={opt}
            style={[
              selectStyles.btn,
              selected && { backgroundColor: color, borderColor: color },
            ]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(selected ? "" : opt);
            }}
          >
            <Text style={[selectStyles.btnText, selected && { color: "#fff" }]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RatingSelector({ max, value, onSelect, color }: { max: number; value: string; onSelect: (v: string) => void; color: string }) {
  const current = parseInt(value) || 0;
  return (
    <View style={selectStyles.ratingRow}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const selected = current === n;
        return (
          <Pressable
            key={n}
            style={[
              selectStyles.ratingBtn,
              selected && { backgroundColor: color, borderColor: color },
            ]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(selected ? "" : n.toString());
            }}
          >
            <Text style={[selectStyles.ratingText, selected && { color: "#fff" }]}>{n}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ScoutScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const editMode = !!params.editId;
  const editData = params.editData ? JSON.parse(params.editData as string) : null;

  const [teamNumber, setTeamNumber] = useState(editData?.scoutedTeamNumber?.toString() || "");
  const [autonomous, setAutonomous] = useState(editData?.autonomous || {});
  const [teleop, setTeleop] = useState(editData?.teleop || {});
  const [endgame, setEndgame] = useState(editData?.endgame || {});
  const [robotPerformance, setRobotPerformance] = useState(editData?.robotPerformance || {});
  const [weight, setWeight] = useState(editData?.weight || "");
  const [strongSuits, setStrongSuits] = useState(editData?.strongSuits || "");
  const [weakSuits, setWeakSuits] = useState(editData?.weakSuits || "");
  const [betterAt, setBetterAt] = useState(editData?.betterAt || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sectionStates: Record<string, any>[] = [autonomous, teleop, endgame, robotPerformance];
  const sectionSetters = [setAutonomous, setTeleop, setEndgame, setRobotPerformance];

  function updateSection(sectionIndex: number, key: string, value: string) {
    sectionSetters[sectionIndex]((prev: any) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setError("");
    const num = parseInt(teamNumber);
    if (!num || num <= 0) {
      setError("Please enter a valid team number to scout");
      return;
    }

    const body = {
      scoutedTeamNumber: num,
      autonomous,
      teleop,
      endgame,
      robotPerformance,
      weight: weight || undefined,
      strongSuits: strongSuits || undefined,
      weakSuits: weakSuits || undefined,
      betterAt: betterAt || undefined,
    };

    setLoading(true);
    try {
      if (editMode) {
        await apiRequest("PUT", `/api/reports/${params.editId}`, body);
      } else {
        await apiRequest("POST", "/api/reports", body);
      }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      if (editMode) {
        queryClient.invalidateQueries({ queryKey: [`/api/reports/${params.editId}`] });
      }
      router.back();
    } catch (e: any) {
      setError("Failed to save report. Please try again.");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  function renderField(field: FieldDef, sIdx: number, sectionColor: string) {
    const val = sectionStates[sIdx]?.[field.key] || "";

    if (field.type === "select" && field.options) {
      return (
        <View key={field.key} style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <SelectButtons options={field.options} value={val} onSelect={(v) => updateSection(sIdx, field.key, v)} color={sectionColor} />
        </View>
      );
    }

    if (field.type === "rating") {
      return (
        <View key={field.key} style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{field.label} {val ? `(${val}/${field.ratingMax})` : ""}</Text>
          <RatingSelector max={field.ratingMax || 10} value={val} onSelect={(v) => updateSection(sIdx, field.key, v)} color={sectionColor} />
        </View>
      );
    }

    return (
      <View key={field.key} style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        <TextInput
          style={[styles.fieldInput, field.type === "multiline" && { minHeight: 80, textAlignVertical: "top" }]}
          placeholder={field.placeholder}
          placeholderTextColor={Colors.inputPlaceholder}
          value={val}
          onChangeText={(v) => updateSection(sIdx, field.key, v)}
          multiline={field.type === "multiline"}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>{editMode ? "Edit Report" : "New Scout"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        bottomOffset={20}
      >
        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.sectionTitle}>Scouted Team Number *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="people" size={20} color={Colors.textMuted} style={{ marginLeft: 14 }} />
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

        {sections.map((section, sIdx) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: section.color + "20" }]}>
                <Ionicons name={section.icon} size={18} color={section.color} />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            {section.fields.map((field) => renderField(field, sIdx, section.color))}
          </View>
        ))}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "#EC489920" }]}>
              <Ionicons name="scale" size={18} color="#EC4899" />
            </View>
            <Text style={styles.sectionTitle}>Optional</Text>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Weight</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="Robot weight (lbs)"
              placeholderTextColor={Colors.inputPlaceholder}
              value={weight}
              onChangeText={setWeight}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "#6366F120" }]}>
              <Ionicons name="chatbubble-ellipses" size={18} color="#6366F1" />
            </View>
            <Text style={styles.sectionTitle}>Notes</Text>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Strong Suits</Text>
            <TextInput
              style={[styles.fieldInput, { minHeight: 70, textAlignVertical: "top" }]}
              placeholder="What are they good at?"
              placeholderTextColor={Colors.inputPlaceholder}
              value={strongSuits}
              onChangeText={setStrongSuits}
              multiline
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Weak Suits</Text>
            <TextInput
              style={[styles.fieldInput, { minHeight: 70, textAlignVertical: "top" }]}
              placeholder="What do they struggle with?"
              placeholderTextColor={Colors.inputPlaceholder}
              value={weakSuits}
              onChangeText={setWeakSuits}
              multiline
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Better at Defence or Shooting?</Text>
            <SelectButtons
              options={["Defence", "Shooting", "Balanced"]}
              value={betterAt}
              onSelect={setBetterAt}
              color="#6366F1"
            />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            loading && { opacity: 0.6 },
          ]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={Colors.background} />
              <Text style={styles.saveBtnText}>{editMode ? "Update Report" : "Save Report"}</Text>
            </>
          )}
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const selectStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
  },
  btnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  ratingRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  ratingBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  ratingText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
  },
});

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
  },
  topTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 20,
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
    gap: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.inputText,
    padding: 14,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  fieldInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.inputText,
    padding: 12,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  saveBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.background,
  },
});
