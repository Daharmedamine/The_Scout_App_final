import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import OpenAI from "openai";
import {
  getTeamByNumber,
  createTeam,
  createReport,
  getReportById,
  getReportsByOwner,
  getSharedReports,
  updateReport,
  deleteReport,
  shareReport,
  getSharesForReport,
  removeShare,
  getRobotProfile,
  upsertRobotProfile,
  getAllRobotProfiles,
  createCompetition,
  getCompetitionsByOwner,
  getCompetitionById,
  updateCompetition,
  deleteCompetition,
  addTeamToCompetition,
  removeTeamFromCompetition,
  getCompetitionTeams,
  getReportsForCompetition,
  getCachedTranslation,
  saveTranslation,
  updatePreferredLanguage,
  getPreferredLanguage,
  storeToken,
  getTokenData,
  deleteToken,
} from "./storage";
import { SUPPORTED_LANGUAGES } from "@shared/languages";
import { insertTeamSchema, loginSchema, insertReportSchema, insertRobotProfileSchema, insertCompetitionSchema } from "@shared/schema";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

async function getAuthFromRequest(req: Request): Promise<{ teamNumber: number; teamId: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return await getTokenData(token);
}

async function requireAuth(req: Request, res: Response, next: () => void) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  (req as any).auth = auth;
  next();
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(app: Express): Promise<Server> {

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const parsed = insertTeamSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }

      const { teamNumber, teamName, password } = parsed.data;

      const existing = await getTeamByNumber(teamNumber);
      if (existing) {
        return res.status(409).json({ message: "Team number already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const team = await createTeam(teamNumber, teamName, hashedPassword);

      const token = generateToken();
      await storeToken(token, team.id, team.teamNumber);

      return res.json({
        id: team.id,
        teamNumber: team.teamNumber,
        teamName: team.teamName,
        preferredLanguage: team.preferredLanguage || "en",
        token,
      });
    } catch (error) {
      console.error("Signup error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const { teamNumber, password } = parsed.data;

      const team = await getTeamByNumber(teamNumber);
      if (!team) {
        return res.status(401).json({ message: "Invalid team number or password" });
      }

      const match = await bcrypt.compare(password, team.password);
      if (!match) {
        return res.status(401).json({ message: "Invalid team number or password" });
      }

      const token = generateToken();
      await storeToken(token, team.id, team.teamNumber);

      return res.json({
        id: team.id,
        teamNumber: team.teamNumber,
        teamName: team.teamName,
        preferredLanguage: team.preferredLanguage || "en",
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      await deleteToken(authHeader.slice(7));
    }
    res.json({ message: "Logged out" });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const auth = await getAuthFromRequest(req);
    if (!auth) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    return res.json({
      teamNumber: auth.teamNumber,
      teamId: auth.teamId,
    });
  });

  app.post("/api/reports", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const parsed = insertReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }

      const report = await createReport(auth.teamNumber, parsed.data);
      return res.json(report);
    } catch (error) {
      console.error("Create report error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/reports", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const reports = await getReportsByOwner(auth.teamNumber);
      return res.json(reports);
    } catch (error) {
      console.error("Get reports error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/reports/shared", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const reports = await getSharedReports(auth.teamNumber);
      return res.json(reports);
    } catch (error) {
      console.error("Get shared reports error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/reports/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const report = await getReportById(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      const shares = await getSharesForReport(report.id);
      const isOwner = report.ownerTeamNumber === auth.teamNumber;
      const isShared = shares.includes(auth.teamNumber);

      if (!isOwner && !isShared) {
        return res.status(403).json({ message: "Access denied" });
      }

      return res.json({ ...report, isOwner, sharedWith: isOwner ? shares : [] });
    } catch (error) {
      console.error("Get report error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/reports/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const report = await getReportById(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      if (report.ownerTeamNumber !== auth.teamNumber) {
        return res.status(403).json({ message: "Only the owner can edit" });
      }

      const parsed = insertReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }

      const updated = await updateReport(req.params.id, parsed.data);
      return res.json(updated);
    } catch (error) {
      console.error("Update report error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/reports/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const report = await getReportById(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      if (report.ownerTeamNumber !== auth.teamNumber) {
        return res.status(403).json({ message: "Only the owner can delete" });
      }

      await deleteReport(req.params.id);
      return res.json({ message: "Deleted" });
    } catch (error) {
      console.error("Delete report error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/reports/:id/share", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const report = await getReportById(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      if (report.ownerTeamNumber !== auth.teamNumber) {
        return res.status(403).json({ message: "Only the owner can share" });
      }

      const { teamNumber } = req.body;
      if (!teamNumber || typeof teamNumber !== "number") {
        return res.status(400).json({ message: "Team number is required" });
      }

      if (teamNumber === auth.teamNumber) {
        return res.status(400).json({ message: "Cannot share with yourself" });
      }

      const targetTeam = await getTeamByNumber(teamNumber);
      if (!targetTeam) {
        return res.status(404).json({ message: "Team not found" });
      }

      await shareReport(req.params.id, teamNumber);
      return res.json({ message: "Report shared" });
    } catch (error) {
      console.error("Share report error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/reports/:id/share/:teamNumber", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const report = await getReportById(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      if (report.ownerTeamNumber !== auth.teamNumber) {
        return res.status(403).json({ message: "Only the owner can manage sharing" });
      }

      await removeShare(req.params.id, parseInt(req.params.teamNumber));
      return res.json({ message: "Share removed" });
    } catch (error) {
      console.error("Remove share error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== COMPETITIONS ====================

  app.post("/api/competitions", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const parsed = insertCompetitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const competition = await createCompetition(auth.teamNumber, parsed.data);
      return res.json(competition);
    } catch (error) {
      console.error("Create competition error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/competitions", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const competitions = await getCompetitionsByOwner(auth.teamNumber);
      return res.json(competitions);
    } catch (error) {
      console.error("Get competitions error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/competitions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const competition = await getCompetitionById(req.params.id);
      if (!competition) {
        return res.status(404).json({ message: "Competition not found" });
      }
      if (competition.ownerTeamNumber !== auth.teamNumber) {
        return res.status(403).json({ message: "Access denied" });
      }
      const teams = await getCompetitionTeams(req.params.id);
      return res.json({ ...competition, teams });
    } catch (error) {
      console.error("Get competition error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/competitions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const competition = await getCompetitionById(req.params.id);
      if (!competition) {
        return res.status(404).json({ message: "Competition not found" });
      }
      if (competition.ownerTeamNumber !== auth.teamNumber) {
        return res.status(403).json({ message: "Only the owner can edit" });
      }
      const parsed = insertCompetitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const updated = await updateCompetition(req.params.id, parsed.data);
      return res.json(updated);
    } catch (error) {
      console.error("Update competition error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/competitions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const competition = await getCompetitionById(req.params.id);
      if (!competition) {
        return res.status(404).json({ message: "Competition not found" });
      }
      if (competition.ownerTeamNumber !== auth.teamNumber) {
        return res.status(403).json({ message: "Only the owner can delete" });
      }
      await deleteCompetition(req.params.id);
      return res.json({ message: "Deleted" });
    } catch (error) {
      console.error("Delete competition error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/competitions/:id/teams", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const competition = await getCompetitionById(req.params.id);
      if (!competition) {
        return res.status(404).json({ message: "Competition not found" });
      }
      if (competition.ownerTeamNumber !== auth.teamNumber) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { teamNumber, teamName } = req.body;
      if (!teamNumber || typeof teamNumber !== "number") {
        return res.status(400).json({ message: "Team number is required" });
      }
      const result = await addTeamToCompetition(req.params.id, teamNumber, teamName);
      return res.json(result);
    } catch (error) {
      console.error("Add team to competition error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/competitions/:id/teams/:teamNumber", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const competition = await getCompetitionById(req.params.id);
      if (!competition) {
        return res.status(404).json({ message: "Competition not found" });
      }
      if (competition.ownerTeamNumber !== auth.teamNumber) {
        return res.status(403).json({ message: "Access denied" });
      }
      await removeTeamFromCompetition(req.params.id, parseInt(req.params.teamNumber));
      return res.json({ message: "Team removed" });
    } catch (error) {
      console.error("Remove team from competition error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/competitions/:id/import-teams", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const competition = await getCompetitionById(req.params.id);
      if (!competition) {
        return res.status(404).json({ message: "Competition not found" });
      }
      if (competition.ownerTeamNumber !== auth.teamNumber) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (!competition.eventLink) {
        return res.status(400).json({ message: "No event link set for this competition" });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let pageText: string;
      try {
        const pageRes = await fetch(competition.eventLink, {
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 ScoutApp/1.0" },
        });
        if (!pageRes.ok) {
          return res.status(400).json({ message: `Could not fetch event page (HTTP ${pageRes.status})` });
        }
        const html = await pageRes.text();
        pageText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (pageText.length > 30000) {
          pageText = pageText.slice(0, 30000);
        }
      } catch (fetchErr: any) {
        return res.status(400).json({ message: `Failed to fetch event page: ${fetchErr.message}` });
      } finally {
        clearTimeout(timeout);
      }

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You extract FTC (FIRST Tech Challenge) team information from event web pages. Return ONLY a JSON array of objects with "number" (integer) and "name" (string or null). Example: [{"number":12345,"name":"RoboWarriors"},{"number":67890,"name":null}]. If you cannot find any teams, return an empty array []. Do not include any text outside the JSON array.`,
          },
          {
            role: "user",
            content: `Extract all FTC team numbers and names from this event page content:\n\n${pageText}`,
          },
        ],
        temperature: 0,
        max_tokens: 4000,
      });

      const aiText = aiResponse.choices[0]?.message?.content?.trim() || "[]";
      let extractedTeams: { number: number; name: string | null }[];
      try {
        const jsonMatch = aiText.match(/\[[\s\S]*\]/);
        extractedTeams = JSON.parse(jsonMatch ? jsonMatch[0] : "[]");
        extractedTeams = extractedTeams.filter(
          (t) => typeof t.number === "number" && t.number > 0 && t.number < 100000
        );
      } catch {
        return res.status(500).json({ message: "AI could not parse teams from the page" });
      }

      if (extractedTeams.length === 0) {
        return res.json({ imported: 0, teams: [], message: "No teams found on the event page" });
      }

      const imported: { teamNumber: number; teamName: string | null }[] = [];
      for (const t of extractedTeams) {
        try {
          await addTeamToCompetition(req.params.id, t.number, t.name || undefined);
          imported.push({ teamNumber: t.number, teamName: t.name });
        } catch (e) {
          // skip duplicates
        }
      }

      return res.json({ imported: imported.length, teams: imported });
    } catch (error) {
      console.error("Import teams error:", error);
      return res.status(500).json({ message: "Failed to import teams" });
    }
  });

  app.get("/api/competitions/:id/reports", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const competition = await getCompetitionById(req.params.id);
      if (!competition) {
        return res.status(404).json({ message: "Competition not found" });
      }
      if (competition.ownerTeamNumber !== auth.teamNumber) {
        return res.status(403).json({ message: "Access denied" });
      }
      const reports = await getReportsForCompetition(req.params.id, auth.teamNumber);
      return res.json(reports);
    } catch (error) {
      console.error("Get competition reports error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== ROBOT PROFILES ====================

  app.get("/api/robot-profiles/mine", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const profile = await getRobotProfile(auth.teamNumber);
      return res.json(profile || null);
    } catch (error) {
      console.error("Get robot profile error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/robot-profiles/:teamNumber", requireAuth, async (req: Request, res: Response) => {
    try {
      const profile = await getRobotProfile(parseInt(req.params.teamNumber));
      return res.json(profile || null);
    } catch (error) {
      console.error("Get robot profile error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/robot-profiles", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const parsed = insertRobotProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const profile = await upsertRobotProfile(auth.teamNumber, parsed.data);
      return res.json(profile);
    } catch (error) {
      console.error("Upsert robot profile error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== AI ANALYSIS ====================

  app.post("/api/ai/analyze-team", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const { teamNumber } = req.body;
      if (!teamNumber) {
        return res.status(400).json({ message: "Team number is required" });
      }

      const profile = await getRobotProfile(teamNumber);
      const reports = await getReportsByOwner(auth.teamNumber);
      const teamReports = reports.filter(r => r.scoutedTeamNumber === teamNumber);

      if (!profile && teamReports.length === 0) {
        return res.status(404).json({ message: "No data available for this team" });
      }

      const prompt = buildTeamAnalysisPrompt(teamNumber, profile, teamReports);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert FTC (FIRST Tech Challenge) robotics competition analyst. Provide concise, actionable analysis. Use markdown formatting." },
          { role: "user", content: prompt },
        ],
        stream: true,
        max_tokens: 1500,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("AI analyze team error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Analysis failed" })}\n\n`);
        res.end();
      } else {
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.post("/api/ai/alliance-suggestion", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const { competitionId } = req.body;

      let teamNumbers: number[] = [];
      let reports: any[] = [];

      if (competitionId) {
        const competition = await getCompetitionById(competitionId);
        if (!competition || competition.ownerTeamNumber !== auth.teamNumber) {
          return res.status(403).json({ message: "Access denied" });
        }
        const compTeams = await getCompetitionTeams(competitionId);
        teamNumbers = compTeams.map(t => t.teamNumber);
        reports = await getReportsForCompetition(competitionId, auth.teamNumber);
      } else {
        const allReports = await getReportsByOwner(auth.teamNumber);
        teamNumbers = [...new Set(allReports.map(r => r.scoutedTeamNumber))];
        reports = allReports;
      }

      if (reports.length === 0) {
        return res.status(404).json({ message: "No scouting data available for alliance suggestions" });
      }

      const prompt = buildAllianceSuggestionPrompt(auth.teamNumber, teamNumbers, reports);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert FTC alliance selection strategist. Suggest optimal alliance partners based on scouting data. Use markdown formatting." },
          { role: "user", content: prompt },
        ],
        stream: true,
        max_tokens: 2000,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("AI alliance suggestion error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Analysis failed" })}\n\n`);
        res.end();
      } else {
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.post("/api/ai/competition-analysis", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const { competitionId } = req.body;
      if (!competitionId) {
        return res.status(400).json({ message: "Competition ID is required" });
      }

      const competition = await getCompetitionById(competitionId);
      if (!competition || competition.ownerTeamNumber !== auth.teamNumber) {
        return res.status(403).json({ message: "Access denied" });
      }

      const compTeams = await getCompetitionTeams(competitionId);
      const reports = await getReportsForCompetition(competitionId, auth.teamNumber);

      if (reports.length === 0) {
        return res.status(404).json({ message: "No scouting reports for this competition yet" });
      }

      const prompt = buildCompetitionAnalysisPrompt(competition.name, auth.teamNumber, compTeams, reports);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert FTC competition strategist. Provide comprehensive competition analysis with rankings, threats, and strategy recommendations. Use markdown formatting." },
          { role: "user", content: prompt },
        ],
        stream: true,
        max_tokens: 2500,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("AI competition analysis error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Analysis failed" })}\n\n`);
        res.end();
      } else {
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // ==================== TRANSLATION ====================

  app.post("/api/translate", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const { contentType, contentId, targetLanguageCode, rawText } = req.body;

      if (!contentType || !targetLanguageCode || !rawText) {
        return res.status(400).json({ message: "contentType, targetLanguageCode, and rawText are required" });
      }

      const validLang = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguageCode);
      if (!validLang) {
        return res.status(400).json({ message: "Unsupported language code" });
      }

      if (targetLanguageCode === "en") {
        return res.json({ translatedText: rawText });
      }

      const cacheKey = contentId || Buffer.from(rawText.slice(0, 200)).toString("base64").slice(0, 50);

      const cached = await getCachedTranslation(auth.teamNumber, contentType, cacheKey, targetLanguageCode);
      if (cached) {
        return res.json({ translatedText: cached.translatedText, cached: true });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You translate FTC scouting content into ${validLang.name}. Preserve structure and formatting. Do NOT change numbers, team numbers, stats, percentages, or formulas. Keep robotics terms accurate and clear. Keep team names and competition names unchanged. Return only the translated text with no extra commentary.`,
          },
          { role: "user", content: rawText },
        ],
        max_tokens: 3000,
      });

      const translatedText = completion.choices[0]?.message?.content || rawText;

      await saveTranslation(auth.teamNumber, contentType, cacheKey, targetLanguageCode, translatedText);

      return res.json({ translatedText, cached: false });
    } catch (error) {
      console.error("Translation error:", error);
      return res.status(500).json({ message: "Translation failed" });
    }
  });

  // ==================== PREFERRED LANGUAGE ====================

  app.get("/api/settings/preferred-language", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const lang = await getPreferredLanguage(auth.teamNumber);
      return res.json({ preferredLanguage: lang });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/settings/preferred-language", requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const { languageCode } = req.body;
      if (!languageCode) {
        return res.status(400).json({ message: "languageCode is required" });
      }
      const validLang = SUPPORTED_LANGUAGES.find(l => l.code === languageCode);
      if (!validLang) {
        return res.status(400).json({ message: "Unsupported language code" });
      }
      await updatePreferredLanguage(auth.teamNumber, languageCode);
      return res.json({ preferredLanguage: languageCode });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function buildTeamAnalysisPrompt(teamNumber: number, profile: any, reports: any[]): string {
  let prompt = `Analyze FTC Team ${teamNumber} based on the following data:\n\n`;

  if (profile) {
    prompt += `Robot Profile:\n`;
    if (profile.description) prompt += `- Description: ${profile.description}\n`;
    if (profile.strategy) prompt += `- Strategy: ${profile.strategy}\n`;
    if (profile.strengths) prompt += `- Strengths: ${profile.strengths}\n`;
    if (profile.weaknesses) prompt += `- Weaknesses: ${profile.weaknesses}\n`;
    if (profile.robotType) prompt += `- Robot Type: ${profile.robotType}\n`;
    prompt += `\n`;
  }

  if (reports.length > 0) {
    prompt += `Scouting Reports (${reports.length} total):\n`;
    for (const r of reports.slice(0, 5)) {
      prompt += `\nReport from ${r.createdAt}:\n`;
      if (r.autonomous) prompt += `  Autonomous: ${JSON.stringify(r.autonomous)}\n`;
      if (r.teleop) prompt += `  Teleop: ${JSON.stringify(r.teleop)}\n`;
      if (r.endgame) prompt += `  Endgame: ${JSON.stringify(r.endgame)}\n`;
      if (r.robotPerformance) prompt += `  Robot Performance: ${JSON.stringify(r.robotPerformance)}\n`;
      if (r.strongSuits) prompt += `  Strong Suits: ${r.strongSuits}\n`;
      if (r.weakSuits) prompt += `  Weak Suits: ${r.weakSuits}\n`;
      if (r.betterAt) prompt += `  Better At: ${r.betterAt}\n`;
    }
  }

  prompt += `\nProvide: 1) Overall rating (1-10), 2) Key strengths, 3) Key weaknesses, 4) Best alliance role, 5) Strategy tips when competing against them.`;
  return prompt;
}

function buildAllianceSuggestionPrompt(myTeam: number, teamNumbers: number[], reports: any[]): string {
  let prompt = `Our team is FTC Team ${myTeam}. We need alliance partner suggestions from the following scouted teams.\n\n`;

  const teamData = new Map<number, any[]>();
  for (const r of reports) {
    if (!teamData.has(r.scoutedTeamNumber)) {
      teamData.set(r.scoutedTeamNumber, []);
    }
    teamData.get(r.scoutedTeamNumber)!.push(r);
  }

  for (const [tn, rs] of teamData) {
    prompt += `Team ${tn} (${rs.length} reports):\n`;
    const latest = rs[0];
    if (latest.autonomous) prompt += `  Auto: ${JSON.stringify(latest.autonomous)}\n`;
    if (latest.teleop) prompt += `  Teleop: ${JSON.stringify(latest.teleop)}\n`;
    if (latest.endgame) prompt += `  Endgame: ${JSON.stringify(latest.endgame)}\n`;
    if (latest.robotPerformance) prompt += `  Performance: ${JSON.stringify(latest.robotPerformance)}\n`;
    if (latest.strongSuits) prompt += `  Strong: ${latest.strongSuits}\n`;
    if (latest.weakSuits) prompt += `  Weak: ${latest.weakSuits}\n`;
    if (latest.betterAt) prompt += `  Better At: ${latest.betterAt}\n`;
    prompt += `\n`;
  }

  prompt += `Suggest the top 3 alliance partner picks with reasoning. Consider complementary strengths and strategic fit.`;
  return prompt;
}

function buildCompetitionAnalysisPrompt(compName: string, myTeam: number, compTeams: any[], reports: any[]): string {
  let prompt = `Competition Analysis for "${compName}". Our team is ${myTeam}.\n\n`;
  prompt += `Teams in competition: ${compTeams.map(t => `${t.teamNumber}${t.teamName ? ` (${t.teamName})` : ''}`).join(', ')}\n\n`;

  prompt += `Scouting data:\n`;
  const teamData = new Map<number, any[]>();
  for (const r of reports) {
    if (!teamData.has(r.scoutedTeamNumber)) {
      teamData.set(r.scoutedTeamNumber, []);
    }
    teamData.get(r.scoutedTeamNumber)!.push(r);
  }

  for (const [tn, rs] of teamData) {
    const latest = rs[0];
    prompt += `\nTeam ${tn}:\n`;
    if (latest.autonomous) prompt += `  Auto: ${JSON.stringify(latest.autonomous)}\n`;
    if (latest.teleop) prompt += `  Teleop: ${JSON.stringify(latest.teleop)}\n`;
    if (latest.endgame) prompt += `  Endgame: ${JSON.stringify(latest.endgame)}\n`;
    if (latest.robotPerformance) prompt += `  Performance: ${JSON.stringify(latest.robotPerformance)}\n`;
    if (latest.strongSuits) prompt += `  Strong: ${latest.strongSuits}\n`;
  }

  prompt += `\nProvide: 1) Power rankings of all teams, 2) Top threats to our team, 3) Best alliance options, 4) Overall competition strategy recommendation.`;
  return prompt;
}
