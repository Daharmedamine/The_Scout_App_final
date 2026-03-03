import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getQueryFn, apiRequest, queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

function ImportTeamsButton({ competitionId, hasLink }: { competitionId: string; hasLink: boolean }) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; message?: string } | null>(null);

  async function handleImport() {
    if (!hasLink) {
      if (Platform.OS === "web") {
        alert("Add an event link to this competition first");
      } else {
        Alert.alert("No Event Link", "Add an event link to this competition first");
      }
      return;
    }
    setImporting(true);
    setResult(null);
    try {
      const res = await apiRequest("POST", `/api/competitions/${competitionId}/import-teams`);
      const data = await res.json();
      setResult({ imported: data.imported, message: data.message });
      queryClient.invalidateQueries({ queryKey: [`/api/competitions/${competitionId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
    } catch (err: any) {
      setResult({ imported: 0, message: err.message || "Import failed" });
    } finally {
      setImporting(false);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        style={[styles.importBtn, importing && { opacity: 0.5 }]}
        onPress={handleImport}
        disabled={importing}
      >
        {importing ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Ionicons name="cloud-download-outline" size={16} color={Colors.primary} />
        )}
        <Text style={styles.importBtnText}>
          {importing ? "Importing teams..." : "Import Teams from Link"}
        </Text>
      </Pressable>
      {result && (
        <Text style={styles.importResult}>
          {result.imported > 0
            ? `Imported ${result.imported} teams`
            : result.message || "No teams found"}
        </Text>
      )}
    </View>
  );
}

export default function CompetitionsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLink, setNewLink] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addTeamNumber, setAddTeamNumber] = useState("");
  const [addTeamName, setAddTeamName] = useState("");

  const { data: competitions, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["/api/competitions"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const compList = (competitions as any[]) || [];

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; eventLink?: string }) => {
      const res = await apiRequest("POST", "/api/competitions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      setShowCreate(false);
      setNewName("");
      setNewLink("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/competitions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
    },
  });

  const addTeamMutation = useMutation({
    mutationFn: async ({ compId, teamNumber, teamName }: { compId: string; teamNumber: number; teamName?: string }) => {
      const res = await apiRequest("POST", `/api/competitions/${compId}/teams`, { teamNumber, teamName });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      setAddTeamNumber("");
      setAddTeamName("");
    },
  });

  const removeTeamMutation = useMutation({
    mutationFn: async ({ compId, teamNumber }: { compId: string; teamNumber: number }) => {
      await apiRequest("DELETE", `/api/competitions/${compId}/teams/${teamNumber}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
    },
  });

  function handleDelete(id: string) {
    if (Platform.OS === "web") {
      if (confirm("Delete this competition?")) {
        deleteMutation.mutate(id);
      }
    } else {
      Alert.alert("Delete Competition", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) },
      ]);
    }
  }

  function handleAddTeam(compId: string) {
    const num = parseInt(addTeamNumber);
    if (!num || num <= 0) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addTeamMutation.mutate({ compId, teamNumber: num, teamName: addTeamName || undefined });
  }

  function renderCompetition({ item }: { item: any }) {
    const isExpanded = expandedId === item.id;
    return (
      <View style={styles.compCard}>
        <Pressable
          style={styles.compHeader}
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setExpandedId(isExpanded ? null : item.id);
          }}
        >
          <View style={styles.compIcon}>
            <Ionicons name="trophy" size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.compName}>{item.name}</Text>
            <Text style={styles.compDate}>
              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
            </Text>
          </View>
          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.textMuted} />
        </Pressable>

        {isExpanded && (
          <CompetitionDetail
            competition={item}
            onDelete={() => handleDelete(item.id)}
            addTeamNumber={addTeamNumber}
            setAddTeamNumber={setAddTeamNumber}
            addTeamName={addTeamName}
            setAddTeamName={setAddTeamName}
            onAddTeam={() => handleAddTeam(item.id)}
            onRemoveTeam={(tn: number) => removeTeamMutation.mutate({ compId: item.id, teamNumber: tn })}
            addTeamLoading={addTeamMutation.isPending}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 16 }]}>
        <Text style={styles.title}>Competitions</Text>
        <Pressable
          onPress={() => setShowCreate(true)}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={compList}
          keyExtractor={(item) => item.id}
          renderItem={renderCompetition}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
          scrollEnabled={!!compList.length}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="trophy-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No competitions yet</Text>
              <Text style={styles.emptyText}>Create a competition to organize your scouting</Text>
            </View>
          }
        />
      )}

      <Modal visible={showCreate} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreate(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>New Competition</Text>

              <Text style={styles.label}>Competition Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., State Championship"
                placeholderTextColor={Colors.inputPlaceholder}
                value={newName}
                onChangeText={setNewName}
              />

              <Text style={styles.label}>Event Link (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://ftcscout.org/..."
                placeholderTextColor={Colors.inputPlaceholder}
                value={newLink}
                onChangeText={setNewLink}
                autoCapitalize="none"
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setShowCreate(false)}
                >
                  <Text style={styles.modalBtnCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnCreate, (!newName.trim() || createMutation.isPending) && { opacity: 0.5 }]}
                  onPress={() => {
                    if (!newName.trim()) return;
                    createMutation.mutate({ name: newName.trim(), eventLink: newLink.trim() || undefined });
                  }}
                  disabled={!newName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.background} />
                  ) : (
                    <Text style={styles.modalBtnCreateText}>Create</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

function CompetitionDetail({
  competition,
  onDelete,
  addTeamNumber,
  setAddTeamNumber,
  addTeamName,
  setAddTeamName,
  onAddTeam,
  onRemoveTeam,
  addTeamLoading,
}: any) {
  const { data: compDetail } = useQuery({
    queryKey: [`/api/competitions/${competition.id}`],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const teams = (compDetail as any)?.teams || [];

  return (
    <View style={styles.detailSection}>
      {competition.eventLink ? (
        <Text style={styles.eventLink}>{competition.eventLink}</Text>
      ) : null}

      <ImportTeamsButton competitionId={competition.id} hasLink={!!competition.eventLink} />

      <View style={styles.detailHeader}>
        <Text style={styles.detailTitle}>Teams ({teams.length})</Text>
      </View>

      <View style={styles.addTeamRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Team #"
          placeholderTextColor={Colors.inputPlaceholder}
          value={addTeamNumber}
          onChangeText={setAddTeamNumber}
          keyboardType="number-pad"
        />
        <TextInput
          style={[styles.input, { flex: 1.5 }]}
          placeholder="Name (optional)"
          placeholderTextColor={Colors.inputPlaceholder}
          value={addTeamName}
          onChangeText={setAddTeamName}
        />
        <Pressable
          style={[styles.addTeamBtn, addTeamLoading && { opacity: 0.5 }]}
          onPress={onAddTeam}
          disabled={addTeamLoading}
        >
          {addTeamLoading ? (
            <ActivityIndicator size="small" color={Colors.background} />
          ) : (
            <Ionicons name="add" size={20} color={Colors.background} />
          )}
        </Pressable>
      </View>

      {teams.map((t: any) => (
        <View key={t.teamNumber} style={styles.teamRow}>
          <View style={styles.teamBadgeSm}>
            <Text style={styles.teamBadgeSmText}>{t.teamNumber}</Text>
          </View>
          <Text style={styles.teamRowName}>{t.teamName || `Team ${t.teamNumber}`}</Text>
          <Pressable onPress={() => onRemoveTeam(t.teamNumber)}>
            <Ionicons name="close-circle" size={20} color={Colors.error + "80"} />
          </Pressable>
        </View>
      ))}

      <Pressable style={styles.deleteBtn} onPress={onDelete}>
        <Ionicons name="trash-outline" size={16} color={Colors.error} />
        <Text style={styles.deleteBtnText}>Delete Competition</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.text },
  addBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  listContent: { paddingHorizontal: 20, gap: 12 },
  compCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: "hidden",
  },
  compHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  compIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  compName: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.text },
  compDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  detailSection: { padding: 16, paddingTop: 0, gap: 10 },
  eventLink: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.primary },
  detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  addTeamRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    padding: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.inputText,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  addTeamBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  teamBadgeSm: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  teamBadgeSmText: { fontFamily: "Inter_700Bold", fontSize: 12, color: Colors.primary },
  teamRowName: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.text, flex: 1 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    paddingVertical: 8,
    marginTop: 4,
  },
  deleteBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.error },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary + "15",
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  importBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.primary },
  importResult: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginTop: 20,
  },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.textSecondary },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textMuted, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    gap: 12,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text, marginBottom: 4 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  modalBtnCancel: { backgroundColor: Colors.surfaceLight },
  modalBtnCancelText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  modalBtnCreate: { backgroundColor: Colors.primary },
  modalBtnCreateText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.background },
});
