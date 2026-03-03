# replit.md

## Overview

The Scout App is an FTC (FIRST Tech Challenge) robotics team scouting and competition intelligence platform. It allows FTC teams to create accounts tied to their team number, log in from any device, and create/manage scouting reports about other teams during competitions. Reports cover autonomous performance, tele-op, endgame, and robot performance metrics. Teams can also share reports with other teams, manage competitions, and get AI-powered analysis.

The app uses a full-stack architecture: an Expo/React Native frontend (targeting web, iOS, and Android) paired with an Express.js backend and PostgreSQL database. The frontend and backend live in the same repository and share schema definitions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with React Native 0.81, using the new architecture
- **Routing**: expo-router with file-based routing (typed routes enabled)
  - `app/index.tsx` — Auth gate that redirects to login or dashboard
  - `app/(auth)/` — Login and signup screens (modal presentation)
  - `app/(tabs)/` — Main tabbed interface (Dashboard, Reports, Events, AI, Shared, Settings)
  - `app/scout.tsx` — Scouting form for creating new reports
  - `app/report/[id].tsx` — Detail view for individual reports
- **State Management**: TanStack React Query for server state; React Context for auth state (`lib/auth-context.tsx`)
- **Fonts**: Inter font family (Google Fonts via `@expo-google-fonts/inter`)
- **UI Libraries**: expo-blur, expo-haptics, expo-image, expo-linear-gradient, react-native-gesture-handler, react-native-keyboard-controller
- **Styling**: React Native StyleSheet with a centralized color theme (`constants/colors.ts`) — dark theme with yellow/gold accent
- **API Communication**: Custom `apiRequest` helper and `getQueryFn` factory in `lib/query-client.ts` using `expo/fetch` with credentials included. API base URL derived from `EXPO_PUBLIC_DOMAIN` environment variable.

### Backend (Express.js)

- **Framework**: Express 5 running on Node.js
- **Entry point**: `server/index.ts`
- **Routes**: `server/routes.ts` — RESTful API endpoints for auth, scouting reports, competitions, robot profiles, and AI analysis
- **Storage layer**: `server/storage.ts` — Database access functions using Drizzle ORM
- **Authentication**: Bearer token auth with database-backed token store (`auth_tokens` table). Tokens survive server restarts. Passwords hashed with `bcrypt`.
- **AI Integration**: OpenAI via Replit AI Integrations (gpt-4o-mini) for team analysis, alliance suggestions, and competition analysis. Uses SSE streaming.
- **CORS**: Dynamic CORS configuration supporting Replit domains and localhost development
- **API Endpoints**:
  - `POST /api/auth/login` — Login with team number + password
  - `POST /api/auth/signup` — Create team account
  - `POST /api/auth/logout` — Logout
  - `GET /api/auth/me` — Check current session
  - CRUD operations for scouting reports (`/api/reports`)
  - Share reports with other teams (`/api/reports/:id/share`)
  - CRUD for competitions (`/api/competitions`)
  - Manage competition teams (`/api/competitions/:id/teams`)
  - Competition reports (`/api/competitions/:id/reports`)
  - Robot profiles (`/api/robot-profiles`, `/api/robot-profiles/mine`)
  - AI analysis endpoints (`/api/ai/analyze-team`, `/api/ai/alliance-suggestion`, `/api/ai/competition-analysis`) — SSE streaming
- **Build**: Production server built with esbuild, outputs to `server_dist/`

### Database (PostgreSQL + Drizzle ORM)

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema location**: `shared/schema.ts` (shared between frontend and backend)
- **Schema validation**: Zod schemas for input validation
- **Tables**:
  - `teams` — Team accounts (id UUID, team_number unique int, team_name, hashed password, created_at)
  - `scouting_reports` — Reports with owner_team_number, scouted_team_number, competition_id, and JSONB columns for autonomous, teleop, endgame, robot_performance data, plus text fields
  - `shared_reports` — Junction table for sharing reports between teams
  - `robot_profiles` — Robot profile data per team (description, strategy, strengths, weaknesses, robot_type, scouting_data JSONB)
  - `competitions` — Competition workspaces (owner_team_number, name, event_link)
  - `competition_teams` — Teams registered in a competition (competition_id, team_number, team_name)
- **Migrations**: Managed via `drizzle-kit push` (schema push approach, not migration files)
- **Connection**: Via `DATABASE_URL` environment variable

### Build & Development

- **Dev workflow**: Two processes run simultaneously — Expo dev server (`expo:dev`) and Express server (`server:dev` via tsx)
- **Production build**: `scripts/build.js` runs `npx expo export --platform web` to generate a static web app in `dist/`, then builds native iOS/Android bundles for Expo Go, and bundles the server with esbuild
- **Web serving (production)**: The Express server serves the Expo web export from `dist/` for browser visitors, while still serving native manifests for Expo Go mobile clients. When someone visits the published URL in a browser, they get the full web app.
- **Web serving (development)**: The Expo dev server on port 8081 handles web during development. The Express server on port 5000 handles API and also serves the web export if `dist/` exists.
- **Patches**: Uses `patch-package` (postinstall script)

## External Dependencies

### Database
- **PostgreSQL** — Primary data store, connected via `DATABASE_URL` environment variable.

### AI
- **OpenAI** — Via Replit AI Integrations. Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit** — Database ORM and schema management
- **openai** — OpenAI SDK for AI analysis features
- **bcrypt** — Password hashing
- **@tanstack/react-query** — Client-side data fetching and caching
- **expo-router** — File-based routing for React Native
- **zod** — Runtime schema validation

### Environment Variables Required
- `DATABASE_URL` — PostgreSQL connection string
- `EXPO_PUBLIC_DOMAIN` — Domain for API requests from the frontend
- `SESSION_SECRET` — Secret for session encryption (falls back to a default)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key (managed by Replit)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI base URL (managed by Replit)
- `REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS` — Used for CORS configuration and Expo dev server setup
