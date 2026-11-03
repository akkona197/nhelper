# Master Task (nhelper)

English | [Tiếng Việt](README.vi.md)

A personal task manager built around a weekly calendar, with an **AI Inbox** that turns a pasted chat message or email into structured, schedulable tasks.

Live app: https://master-task.akkona197.workers.dev

## The problem

In a customer service operations team, work arrives as chat messages: a weekly task list from a lead, a request from another team, a reminder in a group thread. One message often mixes several deliverables with labels, owners, links and deadlines written in free form. Copying these into a task tool by hand is slow, and items get lost.

Master Task closes that gap: paste the message, review the tasks the model extracts, add the ones you want to the calendar.

## What it does

| Screen | Purpose |
|---|---|
| Calendar | Day, 3-day, week and month views. Drag tasks between days, onto projects or labels, move overdue tasks to today |
| Workload | Estimated hours per week, average per working day (Mon to Sat), completion rate, daily hours chart |
| AI Inbox | Paste a message, get suggested tasks (title, description, priority, estimate, deadline), add them one by one |
| Notifications | In-app and browser reminders, realtime via Supabase Realtime |
| Board | Sticky notes with drag, resize, colors and images |
| Feedback | Users submit bugs and ideas; a database trigger turns each into a task for the owner |

Recurring tasks (daily or by weekday) are materialized as one row per occurrence in `task_instances`, so each occurrence can be completed, moved or annotated independently.

## Architecture

```
Browser (React 19, TanStack Start)  --->  Cloudflare Workers (hosting, SSR)
        |
        +--> Supabase: Postgres + Row Level Security, Auth, Storage, Realtime
        |
        +--> Supabase Edge Function `parse-tasks`  --->  Cloudflare Workers AI
                                                          primary:  Llama 3.3 70B (fp8-fast)
                                                          fallback: Llama 3.1 8B
```

Every user table has Row Level Security enabled; each user reads and writes only rows with their own `user_id`.

## Design decisions

**LLM provider and model choice.** The AI Inbox went through several providers in a short period, each change driven by a concrete constraint:

1. Started on the AI service bundled with the original no-code builder.
2. Moved the `parse-tasks` function to Google Gemini to own the integration directly.
3. Added rotation across several Gemini models when individual models hit free-tier limits.
4. Switched to Cloudflare Workers AI after the Gemini free tier became unavailable in the deployment region.
5. Tried Llama 3.1 8B as primary for latency, with 70B as fallback.
6. Settled on Llama 3.3 70B fp8-fast as primary and 8B as fallback, together with a stricter prompt, because task grouping quality mattered more than the latency gain.

**Structured output instead of free-text parsing.** The request uses a JSON schema (`response_format: json_schema`) and `temperature: 0.2`. The function still tolerates either a string or an object in the response and falls through to the next model on any parse failure, so a single bad generation does not surface as a user error.

**Grouping rules in the prompt.** The main failure mode was splitting one deliverable into several tasks because it spanned several lines, or turning label lines ("Channel:", "PIC:", week headers) into tasks. The prompt states explicit grouping rules and includes a worked example.

**Duplicate reminder protection.** Reminders are checked every minute in the browser. With several tabs open or after a reload, the same reminder could be inserted twice. The client checks the database before inserting and de-duplicates on load.

**Data ownership and backups.** The app moved from the builder's hosting and database to its own Cloudflare Workers deployment and its own Supabase project. A scheduled GitHub Action exports all user tables daily; because this repository is public, the export is encrypted with AES-256 before it is stored as a workflow artifact.

## Known limitations

- No evaluation set yet for the AI Inbox. Model choice was made by manual testing, not measured accuracy, latency or cost.
- The `parse-tasks` function is deployed with `verify_jwt = false`.
- The feedback migration hardcodes the owner's email; change it before reusing the schema.
- Backups cover database tables only, not Storage files.

## Tech stack

TanStack Start, TanStack Router, TanStack Query, React 19, TypeScript, Vite 7, Tailwind CSS 4, shadcn/ui, Tiptap, Recharts, Supabase (Postgres, Auth, Storage, Realtime, Edge Functions), Cloudflare Workers, Cloudflare Workers AI.

## Run locally

Requires Bun (or Node.js 22+ with npm) and a Supabase project.

```bash
cp .env.example .env   # fill in your Supabase URL and publishable key
bun install
bun run dev
```

Apply the schema with the Supabase CLI:

```bash
supabase link --project-ref <project-id>
supabase db push
```

Deploy the AI function:

```bash
supabase secrets set CF_ACCOUNT_ID=<cloudflare-account-id> CF_API_TOKEN=<token-with-workers-ai-access>
supabase functions deploy parse-tasks
```

Backups need three repository secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE`. Decrypt a backup with `gpg -d backup-YYYY-MM-DD.json.gpg > backup.json`.

## How this was built

I own the problem definition, requirements and the design decisions above. The code was written with AI coding assistants (first a no-code builder, then Claude).

## Author

Phan Nguyen Yen Nhi, QA Team Lead in customer service operations, building tools for CX teams.
[LinkedIn](https://www.linkedin.com/in/nhi-phan-29b369195/)
