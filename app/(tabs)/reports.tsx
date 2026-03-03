import React, { useState, useMemo } from "react";
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
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getQueryFn } from "@/lib/query-client";
import Colors from "@/constants/colors";

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [search, setSearch] = useState("");

  const { data: reports, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["/api/reports"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const reportList = (reports as any[]) || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return reportList;
    return reportList.filter((r: any) =>
      String(r.scoutedTeamNumber).includes(search.trim())
    );
  }, [reportList, search]);

  function renderReport({ item }: { item: any }) {
    return (
      <Pressable
        style={({ pressed }) => [styles.reportCard, pressed && { opacity: 0.85 }]}
        onPress={() => router.push({ pathname: "/report/[id]", params: { id: item.id } })}
      >
        <View style={styles.reportCardLeft}>
          <View style={styles.teamBadge}>
            <Text style={styles.teamBadgeText}>{item.scoutedTeamNumber}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reportCardTitle}>Team {item.scoutedTeamNumber}</Text>
            <Text style={styles.reportCardDate}>
              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 16 }]}>
        <Text style={styles.title}>My Reports</Text>
        <Pressable
          onPress={() => router.push("/scout")}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by team number..."
          placeholderTextColor={Colors.inputPlaceholder}
          value={search}
          onChangeText={setSearch}
          keyboardType="number-pad"
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
          scrollEnabled={!!filtered.length}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {search ? "No matching reports" : "No reports yet"}
              </Text>
              <Text style={styles.emptyText}>
                {search ? "Try a different team number" : "Create your first scouting report"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.text,
  },
  addBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.inputText,
    paddingVertical: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  reportCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  reportCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  teamBadge: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  teamBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.primary,
  },
  reportCardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  reportCardDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
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
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
  },
});
