import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { getQueryFn } from "@/lib/query-client";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: reports, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["/api/reports"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: sharedReports } = useQuery({
    queryKey: ["/api/reports/shared"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const reportList = (reports as any[]) || [];
  const sharedList = (sharedReports as any[]) || [];
  const recentReports = reportList.slice(0, 3);

  return (
    <View style={[styles.container]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + webTopInset + 16,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.teamTitle}>Team {user?.teamNumber}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.newScoutBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/scout");
          }}
        >
          <View style={styles.newScoutIcon}>
            <Ionicons name="add" size={24} color={Colors.background} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.newScoutTitle}>New Scout Report</Text>
            <Text style={styles.newScoutSub}>Scout a team during a match</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </Pressable>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="document-text" size={24} color={Colors.primary} />
            <Text style={styles.statNumber}>{reportList.length}</Text>
            <Text style={styles.statLabel}>My Reports</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="share-social" size={24} color={Colors.accent} />
            <Text style={styles.statNumber}>{sharedList.length}</Text>
            <Text style={styles.statLabel}>Shared With Me</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Reports</Text>
          {reportList.length > 0 && (
            <Pressable onPress={() => router.push("/(tabs)/reports")}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
        ) : recentReports.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="clipboard-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyText}>Tap "New Scout Report" to get started</Text>
          </View>
        ) : (
          recentReports.map((report: any) => (
            <Pressable
              key={report.id}
              style={({ pressed }) => [styles.reportCard, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: "/report/[id]", params: { id: report.id } })}
            >
              <View style={styles.reportCardLeft}>
                <View style={styles.teamBadge}>
                  <Text style={styles.teamBadgeText}>{report.scoutedTeamNumber}</Text>
                </View>
                <View>
                  <Text style={styles.reportCardTitle}>Team {report.scoutedTeamNumber}</Text>
                  <Text style={styles.reportCardDate}>
                    {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : ""}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  greeting: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  teamTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.text,
  },
  newScoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.primary + "40",
  },
  newScoutIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  newScoutIconAdd: {
    color: Colors.background,
  },
  newScoutTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  newScoutSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statNumber: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: Colors.text,
  },
  seeAll: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.primary,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
});
