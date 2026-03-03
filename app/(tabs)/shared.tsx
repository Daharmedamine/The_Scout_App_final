import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
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

export default function SharedScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: reports, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["/api/reports/shared"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const reportList = (reports as any[]) || [];

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
            <Text style={styles.reportCardSub}>By Team {item.ownerTeamNumber}</Text>
            <Text style={styles.reportCardDate}>
              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
            </Text>
          </View>
        </View>
        <View style={styles.sharedBadge}>
          <Ionicons name="eye" size={14} color={Colors.accent} />
          <Text style={styles.sharedBadgeText}>View Only</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 16 }]}>
        <Text style={styles.title}>Shared With Me</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={reportList}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
          scrollEnabled={!!reportList.length}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="share-social-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No shared reports</Text>
              <Text style={styles.emptyText}>
                When other teams share their reports with you, they'll appear here
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.text,
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
    backgroundColor: Colors.accent + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  teamBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.accent,
  },
  reportCardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  reportCardSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  reportCardDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent + "15",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sharedBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.accent,
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
