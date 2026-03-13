# Tee Time Notifier

Monitors tee time availability at Falls Road Golf Course and sends email notifications when new times open up. Data is stored to GitHub and results are displayed on a GitHub Pages website.

## Live Site

**[https://juddrollins.github.io/tee-time-notifier/](https://juddrollins.github.io/tee-time-notifier/)**

Shows current available tee times, newly opened slots, times that have been booked, and a full pull log for the week.

---

## How It Works

Every 10 minutes, three steps run in sequence:

```
fetch → compare → notify
```

| Step | What it does |
|------|-------------|
| `fetch` | Calls the tee time API for the target weekend (8:00–11:30 AM window), filters by player count and holes, saves a timestamped JSON file to the `data` branch |
| `compare` | Reads the first and latest fetch files for the week, diffs the tee time IDs, writes `comparison.json` with new and disappeared times |
| `notify` | If new times were found, sends an HTML email via Gmail SMTP |

### Target Weekend Logic

- **Mon–Thu**: tracks the upcoming Saturday/Sunday
- **Fri onwards**: tracks the following Saturday/Sunday
- Switches at midnight Friday, giving a full week of tracking before the weekend

### Data Storage

All fetched data lives in the [`data` branch](../../tree/data):

```
data/
  weekend-YYYY-MM-DD/
    2026-03-10T10-00-00Z.json   ← individual fetch snapshots
    2026-03-10T10-10-00Z.json
    comparison.json              ← diff of first vs latest pull
```

---

## Repo Structure

```
src/
  fetch/        # Step 1: calls tee time API, saves JSON to GitHub
  compare/      # Step 2: diffs first vs latest pull, writes comparison.json
  notify/       # Step 3: sends email if new times found
  lib/
    dates.ts    # Target weekend calculation logic
    github.ts   # GitHub API client (read/write files to data branch)
    types.ts    # Shared TypeScript interfaces
docs/
  index.html    # GitHub Pages site (lives on gh-pages branch)
scripts/
  setup-pi.sh   # One-command Raspberry Pi deployment setup
run.sh          # Runs all three steps sequentially
```

---

## Getting Started Locally

### Prerequisites

- Node.js 18+
- A GitHub personal access token with `Contents: Read and write` on this repo
- A Gmail account with an [app password](https://support.google.com/accounts/answer/185833) for SMTP

### 1. Clone and install

```bash
git clone https://github.com/juddrollins/tee-time-notifier.git
cd tee-time-notifier
npm install
```

### 2. Create a `.env` file

```
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=juddrollins
GITHUB_REPO=tee-time-notifier
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
NOTIFY_EMAILS=you@gmail.com
COURSE_ID=16503
PLAYERS=4
HOLES=18
```

### 3. Build and run

```bash
npm run build

# Run all three steps
node dist/fetch/index.js
node dist/compare/index.js
node dist/notify/index.js
```

Or run everything at once with `./run.sh`.

### 4. Run tests

```bash
npm test
```

Tests cover the compare logic and target weekend date calculation. All tests use Vitest.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | Personal access token with `Contents: Read and write` |
| `GITHUB_OWNER` | GitHub username |
| `GITHUB_REPO` | Repository name where data is stored |
| `SMTP_USER` | Gmail address used to send notifications |
| `SMTP_PASS` | Gmail app password |
| `NOTIFY_EMAILS` | Comma-separated list of notification recipients |
| `COURSE_ID` | Golf course ID (Falls Road = `16503`) |
| `PLAYERS` | Number of players to filter for |
| `HOLES` | Number of holes (`18`) |

---

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | TypeScript source code |
| `data` | JSON fetch snapshots and comparison files (written by the notifier) |
| `gh-pages` | Static GitHub Pages website (`docs/index.html`) |

---

## Contributing

### Workflow

1. Branch off `main` — use a descriptive prefix: `fix/`, `feature/`, `docs/`
2. Make your changes and write or update tests where relevant
3. Open a PR targeting `main`
4. PRs are squash-merged — keep the PR title clear, it becomes the commit message
5. The self-hosted runner on the Pi will automatically pull and rebuild after merge

### Running tests before pushing

```bash
npm test
```

### PR guidelines

- One logical change per PR
- Reference the relevant GitHub issue in the PR description (e.g. `closes #3`)
- Don't commit `.env` or any secrets
- Keep `dist/` out of commits — it's built on deploy

---

## Raspberry Pi Deployment

The notifier runs on a Raspberry Pi via cron. To set up a new Pi:

```bash
git clone https://github.com/juddrollins/tee-time-notifier.git
cd tee-time-notifier
cp .env.example .env   # fill in your values
chmod +x run.sh scripts/setup-pi.sh
./scripts/setup-pi.sh
```

`setup-pi.sh` installs dependencies, builds TypeScript, and registers the cron job at `*/10 * * * *`.

**Updating after a code change:**
```bash
git pull origin main
npm install && npm run build
```

This happens automatically on every push to `main` via a self-hosted GitHub Actions runner.

**Checking logs:**
```bash
tail -100f ~/tee-time-notifier/cron.log
```
