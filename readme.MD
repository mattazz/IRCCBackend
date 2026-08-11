# IRCC News Bot 🤖🇨🇦

A Telegram bot that delivers Immigration, Refugees and Citizenship Canada (IRCC) news, Express Entry draw results, and official speeches, backed by an Express webhook server.

## Features

- **News** — latest, monthly, or keyword-searched IRCC RSS news
- **Draws** — recent Express Entry draws, filterable by class, with a rolling-average CRS chart
- **Speeches** — latest official speech announcements, scraped and stored in MongoDB
- **FAQ** — interactive inline-keyboard menu covering Express Entry and Provincial Nominee Programs

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together.

## Bot Commands

| Command | Description |
|---|---|
| `/help` | List all available commands |
| `/latest_news` | Get the latest news |
| `/month [month]` | Get news for a specific month (e.g. `/month January`) |
| `/full` | Get the full news feed |
| `/search_news [keyword]` | Search news by keyword |
| `/latest_speech` | Get the last 10 official speeches |
| `/last_draws` | Get the last 5 IRCC draws |
| `/draws [number]` | Get the last `[number]` IRCC draws |
| `/filter_draws [class]` | Filter draws by class (see codes below) |
| `/faq` | Open the FAQ submenu |

**Filter draw codes:** `CEC` Canadian Experience Class · `FSW` Federal Skilled Worker · `FST` Federal Skilled Trades · `PNP` Provincial Nominee Program · `FLP` French language proficiency · `TO` Trade occupations · `HO` Healthcare occupations · `STEM` STEM occupations · `GEN` General · `TRAN` Transport occupations · `AGRI` Agriculture and agri-food occupations

## Setup

```bash
npm install
```

Create a `.env` file in the project root:

| Variable | Description |
|---|---|
| `TG_TOKEN` | Production Telegram bot token |
| `DEV_TG_TOKEN` | Telegram bot token used when `DEV_MODE=true` |
| `APP_URL` | Public URL of the production server (for the webhook) |
| `DEV_URL` | Public URL used when `DEV_MODE=true` |
| `WEBHOOK_PATH` | Path Telegram posts updates to (e.g. `/webhook`) |
| `DEV_MODE` | `true` to use the dev token/URL instead of production |
| `PORT` | Port the Express server listens on (defaults to `3000`) |
| `MONGODB_PASSWORD` | Password for the MongoDB Atlas user storing speech articles |
| `ADMIN_USER_ID` | Telegram chat ID that receives interaction logs |

Run the server:

```bash
npm start
```

Telegram delivers updates via webhook, so the server must be reachable at `APP_URL`/`DEV_URL` (e.g. through a Heroku deployment or a tunnel like ngrok during local development).

### Scheduled jobs

`src/utils/workerDBUpdater.js` scrapes the latest speech news and refreshes the MongoDB collection. It's meant to run on a schedule (e.g. Heroku Scheduler) rather than as part of the main server process:

```bash
node src/utils/workerDBUpdater.js
```

## Deployment

Deployed on Heroku (`Procfile.txt` runs `node app.js`). The `heroku-postbuild` script relocates Puppeteer's Chromium cache so the draw-scraping and speech-scraping utilities can launch a browser in the Heroku dyno.

## Roadmap

- [ ] Add a link to each draw in `/draws` and `/filter_draws` output
- [ ] Add scheduled DB upload of the most recent draws, and query the DB instead of scraping on each request
- [ ] Evaluate the accuracy of the rolling-average CRS calculation
- [ ] Limit `/latest_speech` to the current month's news
