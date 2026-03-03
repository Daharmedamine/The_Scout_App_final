import { drizzle } from "drizzle-orm/node-postgres";
import { eq, or, and, desc, inArray } from "drizzle-orm";
import { teams, scoutingReports, sharedReports, robotProfiles, competitions, competitionTeams, translations, authTokens } from "@shared/schema";
import type { Team, ScoutingReport, InsertReport, RobotProfile, InsertRobotProfile, Competition, InsertCompetition, CompetitionTeam, Translation } from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const db = drizzle(process.env.DATABASE_URL);

export async function getTeamByNumber(teamNumber: number): Promise<Team | undefined> {
  const result = await db.select().from(teams).where(eq(teams.teamNumber, teamNumber)).limit(1);
  return result[0];
}

export async function getTeamById(id: string): Promise<Team | undefined> {
  const result = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  return result[0];
}

export async function createTeam(teamNumber: number, teamName: string | undefined, hashedPassword: string): Promise<Team> {
  const result = await db.insert(teams).values({
    teamNumber,
    teamName: teamName || null,
    password: hashedPassword,
  }).returning();
  return result[0];
}

export async function createReport(ownerTeamNumber: number, data: InsertReport): Promise<ScoutingReport> {
  const result = await db.insert(scoutingReports).values({
    ownerTeamNumber,
    scoutedTeamNumber: data.scoutedTeamNumber,
    competitionId: data.competitionId || null,
    autonomous: data.autonomous || null,
    teleop: data.teleop || null,
    endgame: data.endgame || null,
    robotPerformance: data.robotPerformance || null,
    weight: data.weight || null,
    strongSuits: data.strongSuits || null,
    weakSuits: data.weakSuits || null,
    betterAt: data.betterAt || null,
  }).returning();
  return result[0];
}

export async function getReportById(id: string): Promise<ScoutingReport | undefined> {
  const result = await db.select().from(scoutingReports).where(eq(scoutingReports.id, id)).limit(1);
  return result[0];
}

export async function getReportsByOwner(ownerTeamNumber: number): Promise<ScoutingReport[]> {
  return db.select().from(scoutingReports)
    .where(eq(scoutingReports.ownerTeamNumber, ownerTeamNumber))
    .orderBy(desc(scoutingReports.createdAt));
}

export async function getSharedReports(teamNumber: number): Promise<ScoutingReport[]> {
  const shared = await db.select().from(sharedReports)
    .where(eq(sharedReports.sharedWithTeamNumber, teamNumber));

  if (shared.length === 0) return [];

  const reportIds = shared.map(s => s.reportId);
  const reports: ScoutingReport[] = [];
  for (const rid of reportIds) {
    const r = await db.select().from(scoutingReports).where(eq(scoutingReports.id, rid)).limit(1);
    if (r[0]) reports.push(r[0]);
  }
  return reports.sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db2 = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return db2 - da;
  });
}

export async function updateReport(id: string, data: Partial<InsertReport>): Promise<ScoutingReport | undefined> {
  const result = await db.update(scoutingReports)
    .set({
      scoutedTeamNumber: data.scoutedTeamNumber,
      autonomous: data.autonomous || null,
      teleop: data.teleop || null,
      endgame: data.endgame || null,
      robotPerformance: data.robotPerformance || null,
      weight: data.weight || null,
      strongSuits: data.strongSuits || null,
      weakSuits: data.weakSuits || null,
      betterAt: data.betterAt || null,
      updatedAt: new Date(),
    })
    .where(eq(scoutingReports.id, id))
    .returning();
  return result[0];
}

export async function deleteReport(id: string): Promise<void> {
  await db.delete(sharedReports).where(eq(sharedReports.reportId, id));
  await db.delete(scoutingReports).where(eq(scoutingReports.id, id));
}

export async function shareReport(reportId: string, sharedWithTeamNumber: number): Promise<void> {
  await db.insert(sharedReports).values({
    reportId,
    sharedWithTeamNumber,
  }).onConflictDoNothing();
}

export async function getSharesForReport(reportId: string): Promise<number[]> {
  const result = await db.select().from(sharedReports).where(eq(sharedReports.reportId, reportId));
  return result.map(r => r.sharedWithTeamNumber);
}

export async function removeShare(reportId: string, teamNumber: number): Promise<void> {
  await db.delete(sharedReports).where(
    and(
      eq(sharedReports.reportId, reportId),
      eq(sharedReports.sharedWithTeamNumber, teamNumber),
    )
  );
}

// Robot Profile functions
export async function getRobotProfile(teamNumber: number): Promise<RobotProfile | undefined> {
  const result = await db.select().from(robotProfiles).where(eq(robotProfiles.teamNumber, teamNumber)).limit(1);
  return result[0];
}

export async function upsertRobotProfile(teamNumber: number, data: InsertRobotProfile): Promise<RobotProfile> {
  const result = await db.insert(robotProfiles).values({
    teamNumber,
    description: data.description || null,
    strategy: data.strategy || null,
    strengths: data.strengths || null,
    weaknesses: data.weaknesses || null,
    robotType: data.robotType || null,
    preferredStrategy: data.preferredStrategy || null,
    imageUrl: data.imageUrl || null,
    scoutingData: data.scoutingData || null,
  }).onConflictDoUpdate({
    target: robotProfiles.teamNumber,
    set: {
      description: data.description || null,
      strategy: data.strategy || null,
      strengths: data.strengths || null,
      weaknesses: data.weaknesses || null,
      robotType: data.robotType || null,
      preferredStrategy: data.preferredStrategy || null,
      imageUrl: data.imageUrl || null,
      scoutingData: data.scoutingData || null,
      updatedAt: new Date(),
    },
  }).returning();
  return result[0];
}

export async function getAllRobotProfiles(): Promise<RobotProfile[]> {
  return db.select().from(robotProfiles);
}

// Competition functions
export async function createCompetition(ownerTeamNumber: number, data: InsertCompetition): Promise<Competition> {
  const result = await db.insert(competitions).values({
    ownerTeamNumber,
    name: data.name,
    eventLink: data.eventLink || null,
  }).returning();
  return result[0];
}

export async function getCompetitionsByOwner(ownerTeamNumber: number): Promise<Competition[]> {
  return db.select().from(competitions)
    .where(eq(competitions.ownerTeamNumber, ownerTeamNumber))
    .orderBy(desc(competitions.createdAt));
}

export async function getCompetitionById(id: string): Promise<Competition | undefined> {
  const result = await db.select().from(competitions).where(eq(competitions.id, id)).limit(1);
  return result[0];
}

export async function updateCompetition(id: string, data: Partial<InsertCompetition>): Promise<Competition | undefined> {
  const result = await db.update(competitions)
    .set({
      name: data.name,
      eventLink: data.eventLink || null,
      updatedAt: new Date(),
    })
    .where(eq(competitions.id, id))
    .returning();
  return result[0];
}

export async function deleteCompetition(id: string): Promise<void> {
  await db.delete(competitionTeams).where(eq(competitionTeams.competitionId, id));
  await db.delete(competitions).where(eq(competitions.id, id));
}

// Competition Team functions
export async function addTeamToCompetition(competitionId: string, teamNumber: number, teamName?: string): Promise<CompetitionTeam> {
  const result = await db.insert(competitionTeams).values({
    competitionId,
    teamNumber,
    teamName: teamName || null,
  }).onConflictDoNothing().returning();
  return result[0];
}

export async function removeTeamFromCompetition(competitionId: string, teamNumber: number): Promise<void> {
  await db.delete(competitionTeams).where(
    and(
      eq(competitionTeams.competitionId, competitionId),
      eq(competitionTeams.teamNumber, teamNumber),
    )
  );
}

export async function getCompetitionTeams(competitionId: string): Promise<CompetitionTeam[]> {
  return db.select().from(competitionTeams)
    .where(eq(competitionTeams.competitionId, competitionId))
    .orderBy(competitionTeams.teamNumber);
}

export async function getReportsForCompetition(competitionId: string, ownerTeamNumber: number): Promise<ScoutingReport[]> {
  const compTeamRows = await db.select({ teamNumber: competitionTeams.teamNumber })
    .from(competitionTeams)
    .where(eq(competitionTeams.competitionId, competitionId));
  const compTeamNumbers = compTeamRows.map(r => r.teamNumber);

  if (compTeamNumbers.length === 0) {
    return db.select().from(scoutingReports)
      .where(
        and(
          eq(scoutingReports.competitionId, competitionId),
          eq(scoutingReports.ownerTeamNumber, ownerTeamNumber),
        )
      )
      .orderBy(desc(scoutingReports.createdAt));
  }

  return db.select().from(scoutingReports)
    .where(
      and(
        eq(scoutingReports.ownerTeamNumber, ownerTeamNumber),
        or(
          eq(scoutingReports.competitionId, competitionId),
          inArray(scoutingReports.scoutedTeamNumber, compTeamNumbers),
        ),
      )
    )
    .orderBy(desc(scoutingReports.createdAt));
}

export async function getCachedTranslation(ownerTeamNumber: number, contentType: string, contentId: string, languageCode: string): Promise<Translation | undefined> {
  const result = await db.select().from(translations)
    .where(
      and(
        eq(translations.ownerTeamNumber, ownerTeamNumber),
        eq(translations.contentType, contentType),
        eq(translations.contentId, contentId),
        eq(translations.languageCode, languageCode),
      )
    )
    .limit(1);
  return result[0];
}

export async function saveTranslation(ownerTeamNumber: number, contentType: string, contentId: string, languageCode: string, translatedText: string): Promise<Translation> {
  const result = await db.insert(translations).values({
    ownerTeamNumber,
    contentType,
    contentId,
    languageCode,
    translatedText,
  }).returning();
  return result[0];
}

export async function updatePreferredLanguage(teamNumber: number, languageCode: string): Promise<void> {
  await db.update(teams).set({ preferredLanguage: languageCode }).where(eq(teams.teamNumber, teamNumber));
}

export async function getPreferredLanguage(teamNumber: number): Promise<string> {
  const result = await db.select({ preferredLanguage: teams.preferredLanguage }).from(teams).where(eq(teams.teamNumber, teamNumber)).limit(1);
  return result[0]?.preferredLanguage || "en";
}

export async function storeToken(token: string, teamId: string, teamNumber: number): Promise<void> {
  await db.insert(authTokens).values({ token, teamId, teamNumber });
}

export async function getTokenData(token: string): Promise<{ teamId: string; teamNumber: number } | null> {
  const result = await db.select().from(authTokens).where(eq(authTokens.token, token)).limit(1);
  if (!result[0]) return null;
  return { teamId: result[0].teamId, teamNumber: result[0].teamNumber };
}

export async function deleteToken(token: string): Promise<void> {
  await db.delete(authTokens).where(eq(authTokens.token, token));
}
