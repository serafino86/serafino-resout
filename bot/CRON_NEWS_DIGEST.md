`run-news-digest.js` is the daily job that:

1. collects configured news sources
2. updates `data/news-state.json`
3. builds the filtered briefing
4. sends the Telegram digest if `TELEGRAM_BOT_TOKEN` and `TELEGRAM_DEFAULT_CHAT_ID` are set

Before enabling cron, run:

```bash
cd /home/enrico/Workspace/serafino-resout-site/bot
npm run check:news-digest
```

The command exits with code `0` only when the required env variables are present.

Example cron, every day at 07:30:

```cron
30 7 * * * cd /home/enrico/Workspace/serafino-resout-site/bot && /usr/bin/node scripts/run-news-digest.js >> /tmp/serafino-news-digest.log 2>&1
```

Example cron, every 6 hours for collection plus Telegram digest:

```cron
0 */6 * * * cd /home/enrico/Workspace/serafino-resout-site/bot && /usr/bin/node scripts/run-news-digest.js >> /tmp/serafino-news-digest.log 2>&1
```

Required env:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_DEFAULT_CHAT_ID`
- `CRM_DASHBOARD_URL`
- `CRM_DATA_PATH`
- `CRM_PIPELINE_STATE_PATH`

Optional env:

- `NEWS_DIGEST_MODE=default|local_models|business|test_now`
