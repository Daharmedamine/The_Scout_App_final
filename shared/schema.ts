import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { z } from "zod";

export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamNumber: integer("team_number").notNull().unique(),
  teamName: text("team_name"),
  password: text("password").notNull(),
  preferredLanguage: text("preferred_language").default("en"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scoutingReports = pgTable("scouting_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerTeamNumber: integer("owner_team_number").notNull(),
  scoutedTeamNumber: integer("scouted_team_number").notNull(),
  competitionId: varchar("competition_id"),
  autonomous: jsonb("autonomous").$type<{
    startingPosition?: string;
    preloadAction?: string;
    autoScoring?: string;
    navigationAccuracy?: string;
  }>(),
  teleop: jsonb("teleop").$type<{
    cyclesPerMinute?: string;
    scoringAccuracy?: string;
    consistency?: string;
    mechanismPerformance?: string;
  }>(),
  endgame: jsonb("endgame").$type<{
    taskCompletion?: string;
    reliability?: string;
    timeToComplete?: string;
    penaltiesTaken?: string;
  }>(),
  robotPerformance: jsonb("robot_performance").$type<{
    speed?: string;
    reliability?: string;
    defenseAbility?: string;
    driverSkill?: string;
  }>(),
  weight: text("weight"),
  strongSuits: text("strong_suits"),
  weakSuits: text("weak_suits"),
  betterAt: text("better_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sharedReports = pgTable("shared_reports", {
  reportId: varchar("report_id").notNull(),
  sharedWithTeamNumber: integer("shared_with_team_number").notNull(),
  sharedAt: timestamp("shared_at").defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.reportId, table.sharedWithTeamNumber] }),
]);

export const robotProfiles = pgTable("robot_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamNumber: integer("team_number").notNull().unique(),
  description: text("description"),
  strategy: text("strategy"),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  robotType: text("robot_type"),
  preferredStrategy: text("preferred_strategy"),
  imageUrl: text("image_url"),
  scoutingData: jsonb("scouting_data").$type<{
    autonomous?: Record<string, string>;
    teleop?: Record<string, string>;
    endgame?: Record<string, string>;
    robotPerformance?: Record<string, string>;
    weight?: string;
    strongSuits?: string;
    weakSuits?: string;
    betterAt?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const competitions = pgTable("competitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerTeamNumber: integer("owner_team_number").notNull(),
  name: text("name").notNull(),
  eventLink: text("event_link"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const competitionTeams = pgTable("competition_teams", {
  competitionId: varchar("competition_id").notNull(),
  teamNumber: integer("team_number").notNull(),
  teamName: text("team_name"),
  addedAt: timestamp("added_at").defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.competitionId, table.teamNumber] }),
]);

export const authTokens = pgTable("auth_tokens", {
  token: varchar("token").primaryKey(),
  teamId: varchar("team_id").notNull(),
  teamNumber: integer("team_number").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const translations = pgTable("translations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerTeamNumber: integer("owner_team_number").notNull(),
  contentType: text("content_type").notNull(),
  contentId: text("content_id").notNull(),
  languageCode: text("language_code").notNull(),
  translatedText: text("translated_text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeamSchema = z.object({
  teamNumber: z.number().int().positive(),
  teamName: z.string().optional(),
  password: z.string().min(4),
});

export const loginSchema = z.object({
  teamNumber: z.number().int().positive(),
  password: z.string().min(1),
});

export const insertReportSchema = z.object({
  scoutedTeamNumber: z.coerce.number().int().positive(),
  competitionId: z.string().optional(),
  autonomous: z.object({
    startingPosition: z.string().optional(),
    preloadAction: z.string().optional(),
    autoScoring: z.string().optional(),
    navigationAccuracy: z.string().optional(),
  }).optional(),
  teleop: z.object({
    cyclesPerMinute: z.string().optional(),
    scoringAccuracy: z.string().optional(),
    consistency: z.string().optional(),
    mechanismPerformance: z.string().optional(),
  }).optional(),
  endgame: z.object({
    taskCompletion: z.string().optional(),
    reliability: z.string().optional(),
    timeToComplete: z.string().optional(),
    penaltiesTaken: z.string().optional(),
  }).optional(),
  robotPerformance: z.object({
    speed: z.string().optional(),
    reliability: z.string().optional(),
    defenseAbility: z.string().optional(),
    driverSkill: z.string().optional(),
  }).optional(),
  weight: z.string().optional(),
  strongSuits: z.string().optional(),
  weakSuits: z.string().optional(),
  betterAt: z.string().optional(),
});

export const insertRobotProfileSchema = z.object({
  description: z.string().optional(),
  strategy: z.string().optional(),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  robotType: z.string().optional(),
  preferredStrategy: z.string().optional(),
  imageUrl: z.string().optional(),
  scoutingData: z.object({
    autonomous: z.record(z.string()).optional(),
    teleop: z.record(z.string()).optional(),
    endgame: z.record(z.string()).optional(),
    robotPerformance: z.record(z.string()).optional(),
    weight: z.string().optional(),
    strongSuits: z.string().optional(),
    weakSuits: z.string().optional(),
    betterAt: z.string().optional(),
  }).optional(),
});

export const insertCompetitionSchema = z.object({
  name: z.string().min(1),
  eventLink: z.string().optional(),
});

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;
export type ScoutingReport = typeof scoutingReports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type SharedReport = typeof sharedReports.$inferSelect;
export type RobotProfile = typeof robotProfiles.$inferSelect;
export type InsertRobotProfile = z.infer<typeof insertRobotProfileSchema>;
export type Competition = typeof competitions.$inferSelect;
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type CompetitionTeam = typeof competitionTeams.$inferSelect;
export type Translation = typeof translations.$inferSelect;
