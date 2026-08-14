# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**See also**: [AGENTS.md](./docs/AGENTS.md) for detailed testing documentation and E2E test setup.

## Development Commands

```bash
# First-time setup
make setup              # Install deps, start DB, generate Prisma client, sync schema, start dev

# Development
make dev                # Start development server (auto-runs prisma generate & migrate deploy)
npm run dev             # Alternative: just start Next.js dev server

# Database
make db-up              # Start PostgreSQL in Docker
make db-deploy          # Apply committed migrations
make db-baseline        # One-off: mark migrations applied on a dev DB created by the old `db push`
make db-migrate         # Create a migration from schema changes
make db-studio          # Open Prisma Studio (database GUI)

# Build & Production
make build              # Build for production
make start              # Start production server

# Testing (see AGENTS.md for details)
npx tsx e2e/seed-test-data.ts          # Seed test users and data
E2E_TEST_MODE=true npm run dev         # Start dev server in test mode
npx playwright test                     # Run E2E tests
npx playwright test --headed            # Run with visible browser
npx playwright show-report              # View test results

# Linting
npm run lint            # Run Next.js linter
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 14 (App Router, TypeScript)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js v5 with custom `auth()` helper
- **AI**: Dual provider system (OpenAI + Anthropic) with admin-switchable backend
- **Styling**: TailwindCSS + shadcn/ui components
- **Code Execution**: Piston API (sandboxed, rate-limited)

### Project Structure

```
src/
  app/
    (auth)/          # Login & register pages (standalone, no sidebar)
    (main)/          # Authenticated pages wrapped in MainLayoutClient (sidebar + topbar)
    api/             # API routes organized by feature
      chat/          # Chat/conversation endpoints
      assignments/   # Assignment CRUD
      grading/       # Submission grading
      admin/         # User management, settings
      run-code/      # Code execution via Piston API
  components/
    ui/              # shadcn/ui components
    layout/          # Sidebar, Topbar
  lib/
    auth.ts          # NextAuth v5 configuration
    prisma.ts        # Prisma client singleton
    ai.ts            # AI provider abstraction (OpenAI + Anthropic)
prisma/
  schema.prisma      # Database schema (User, Assignment, Submission, etc.)
```

### Key Patterns

#### Authentication
- **Always use**: `import { auth } from "@/lib/auth"` then `const session = await auth()`
- **Never use**: `getServerSession` from `next-auth` — this project uses NextAuth v5
- Session user structure: `{ id, name, email, image, role }`
- Available roles: `STUDENT`, `TA`, `PROFESSOR`, `ADMIN`

#### AI Provider System
- Dual provider support (OpenAI GPT-5.2 + Anthropic Claude Haiku)
- Admin-switchable default provider via settings
- System prompts: `DEFAULT_SYSTEM_PROMPT`, `SOCRATIC_SYSTEM_PROMPT`, `EXAM_MODE_SYSTEM_PROMPT`
- Location: `src/lib/ai.ts`

#### Database & Prisma
- Schema changes go through migrations: `npx prisma migrate dev --name <name>` locally, `prisma migrate deploy` elsewhere. Never `db push` (AGENTS.md Rule 3.1)
- Prisma client is a singleton at `src/lib/prisma.ts`
- Main models: `User`, `Conversation`, `Message`, `Assignment`, `Question`, `Submission`, `GradeAppeal`

#### Styling & Theming
- Dark mode via `next-themes` with `class` strategy on `<html>`
- ThemeProvider wraps SessionProvider in root layout
- Consistent dark mode mappings: `bg-white → dark:bg-gray-950`, `bg-gray-50 → dark:bg-gray-900`
- CSS variables defined in `globals.css` under `.dark {}` block

#### Chat Features
- **LaTeX Rendering**: Uses `remark-math` + `rehype-katex` with click-to-copy functionality
- **Code Blocks**: Interactive with syntax highlighting, edit mode, and sandboxed execution
  - Supported languages for execution: Python, JavaScript, TypeScript
  - Rate limit: 20 executions per hour per user
  - API: `/api/run-code` → Piston API
- **Message Copy**: Each message has a copy button (user: left of bubble, assistant: action bar below)
- **Docked side panel**: `SideChatLayout` + `SideChatPanel` (`src/components/chat/`) put the tutor in a resizable column beside page content (used by the assignment detail page). It reuses `useChatStream`/`useChatAttachments` and `/api/chat`, so bans, restrictions, rate limits and exam mode behave exactly as on `/chat`.
- **Deep link**: `/chat/[id]` opens that conversation on mount via `initialConversationId`

#### Assignment Types
- **QUIZ**: MC, numeric, free-response questions with auto-grading
- **FILE_UPLOAD**: PDF/image submissions with manual grading
- Optional "lock after submission" toggle for timed quizzes
- LaTeX export functionality for creating printable exam copies

#### Physics Simulations
- **Location**: `src/components/simulations/` (28 Canvas-based components)
- **Data**: `src/data/halliday-chapters.ts` — full Halliday textbook structure (6 parts, 44 chapters, 28 simulations)
- **Pages**: `/simulations` (chapter browser) and `/simulations/[id]` (individual sim viewer)
- **Rendering**: HTML5 Canvas with `requestAnimationFrame` at 60fps
- **Styling conventions for simulations**:
  - Canvas background: `#0f172a` (dark navy) or `#020617` (near-black for space themes)
  - Info panels: `rgba(0,0,0,0.6)` rounded rectangles with `ui-monospace` font
  - Force vectors: Red (`#ef4444`) for gravity/weight, Green (`#22c55e`) for velocity, Blue (`#3b82f6`) for other forces
  - Glow effects: `createRadialGradient` with color → transparent, use `shadowBlur` for line glow
  - Control cards: `rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4`
  - Slider accent colors: match the physics domain color (red, blue, amber, green, purple)
  - Equations section: monospace font in `bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2` cards
  - Canvas color values: Always use `rgba()` format for gradient stops, never CSS `transparent` keyword
- **Physics accuracy**: Use Velocity Verlet integrator for orbital/gravitational simulations to conserve energy
- **Adding new simulations**: Add entry to `halliday-chapters.ts`, create component in `src/components/simulations/`, register in `SimulationViewClient.tsx`

#### Exam Mode
- Platform-wide toggle (TA/Professor/Admin only)
- Switches AI tutor to guided-only mode (no direct answers)
- Red banner indicator for all users
- Audit logging for activation/deactivation

## Important Implementation Details

### File Uploads
- Stored in Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, and served only through `/api/files/<id>`, which authorizes every read
- Without the token uploads fall back to a private local directory in development, and are **rejected with 503 in production** (an ephemeral filesystem would lose student work)
- Chat attachments upload straight to Blob from the browser via `/api/upload/client`

### Code Execution Security
- All code runs in Piston API sandbox (third-party service)
- Rate limiting: 20 executions/hour per user, counted in the database (`RateLimitHit`) so it holds across serverless instances
- First-time confirmation dialog warns users about third-party execution
- Supported languages: Python, JavaScript, TypeScript, Java, C++, C, Go, Rust, Ruby, PHP

### Grade Appeals System
- Students can submit appeals with images and written explanations
- Threaded discussion between student and grader
- Status: Open, Resolved, Rejected
- Auto-updates grade when resolved with new score

### E2E Testing
- Uses Playwright for end-to-end tests
- **Special E2E mode**: Set `E2E_TEST_MODE=true` to bypass NextAuth (uses cookie-based fake sessions)
- ⚠️ **Never set `E2E_TEST_MODE=true` in production**
- Test users seeded via `e2e/seed-test-data.ts`: `test-student@e2e.local`, `test-ta@e2e.local`
- Cookie-based auth helpers in `e2e/helpers.ts`: `loginAsTestUser()`, `loginAndGoto()`
- **See AGENTS.md for complete testing documentation**

## Workflow

### Feature Development
- When working on a new feature, always create a new git worktree using `/worktree-manager:create <feature-name>` before starting development.
- Work in the worktree directory, not the main repository.
- When the feature is complete, use `/worktree-manager:cleanup` to merge back to main and remove the worktree.

### Git Commit Guidelines
- Prefix commits with type: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- Include `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>` in commit messages
- Use squash merges for PRs to keep history clean

## UI Development Rules 
Always verify changes visually using Playwright browser screenshots before claiming a UI fix is complete. Never say a UI change is done without taking a screenshot to confirm.

## Build & Deploy
This is a TypeScript project. Always run `npx tsc --noEmit` or the project's type-check command after making changes to catch build errors before committing. Vercel deployments will fail on type errors.

## Git Workflow
When creating PRs, always create a NEW branch from main. Never commit to an already-merged PR branch. Ask the user to confirm the target branch if ambiguous.

## UI Development Rules
For mobile CSS fixes, test at viewport widths 375px and 768px using Playwright. Mobile layout issues (sidebar overlap, keyboard behavior, spacing) often require 2-3 attempts — take screenshots at each iteration before moving on.

## Known Limitations
When working with images or screenshots, keep dimensions under 2000px to avoid API limits. When batch-processing images, process them one at a time rather than in bulk to avoid size limit errors.

## Build & Deploy
After Vercel deployment, always verify the build succeeded by checking the deployment URL. Common issues: prisma generate not running (add to build command), .next cache stale on localhost (delete it), and CJS/ESM incompatibilities with packages like react-katex.

## Recommended Agent Skills

Use the following skills when working on relevant areas of the codebase. Install with `npx skills add <source> -g -y`.

| Skill | Install | Purpose |
|-------|---------|---------|
| `vercel-react-best-practices` | `npx skills add vercel-labs/agent-skills@vercel-react-best-practices -g -y` | React & Next.js best practices from Vercel Engineering |
| `nextjs-app-router-patterns` | `npx skills add wshobson/agents@nextjs-app-router-patterns -g -y` | Next.js App Router architecture patterns |
| `tailwind-v4-shadcn` | `npx skills add jezweb/claude-skills@tailwind-v4-shadcn -g -y` | Tailwind CSS + shadcn/ui component patterns |
| `typescript-advanced-types` | `npx skills add wshobson/agents@typescript-advanced-types -g -y` | Advanced TypeScript type patterns |
| `prisma-expert` | `npx skills add sickn33/antigravity-awesome-skills@prisma-expert -g -y` | Prisma ORM best practices |
| `prisma-client-api` | `npx skills add prisma/skills@prisma-client-api -g -y` | Official Prisma Client API reference |
| `playwright-skill` | `npx skills add sickn33/antigravity-awesome-skills@playwright-skill -g -y` | Playwright E2E testing patterns |
| `clean-code` | Pre-installed | Uncle Bob's Clean Code: small functions, meaningful names, no side effects, SRP |
| `ai-code-cleanup` | Pre-installed | Remove AI slop: obvious comments, defensive bloat, type workarounds, style drift |
| `anti-slop` | Pre-installed | Detect/eliminate generic AI patterns in text, code, and design |
| `deslop` | Pre-installed | Quick branch cleanup: diff against main, remove all AI artifacts |
| `code-refactoring` | Pre-installed | Extract methods, guard clauses, parameter objects, polymorphism |
| `architecture-patterns` | Pre-installed | Clean Architecture, service layer, DDD patterns |

### Code Quality Skills — Mandatory Invocation

**You MUST call the `skill` tool to invoke these skills at the appropriate times. Do not skip this step.**

#### When starting a coding task:
```
[invoke skill: "clean-code"]
[invoke skill: "architecture-patterns"]
```

#### Before finishing / committing:
```
[invoke skill: "deslop"]
[invoke skill: "ai-code-cleanup"]
```

#### When refactoring:
```
[invoke skill: "code-refactoring"]
```

#### When reviewing AI-generated content:
```
[invoke skill: "anti-slop"]
```

| Skill | When to invoke | What it does |
|-------|---------------|--------------|
| `clean-code` | Start of every task | Reviews function size, naming, SRP, no side effects |
| `deslop` | Before every commit | Diffs branch against main, removes AI artifacts |
| `ai-code-cleanup` | Before code reviews | Removes obvious comments, defensive bloat, type casts |
| `code-refactoring` | When touching legacy code | Extract methods, guard clauses, flatten nesting |
| `architecture-patterns` | When designing services/components | Service layer, clean architecture, DDD |
| `anti-slop` | When reviewing AI output | Detects generic AI patterns in code, text, design |

See **AGENTS.md Section 11** for the full rules derived from these skills.