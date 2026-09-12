require('dotenv').config();
const { runDbSyncOrExit } = require('./lib/db-push');

/** Desktop: Schema-Push erfolgt in Electron main.cjs vor server.js (PHIX_SKIP_DB_PUSH=1). */
if (process.env.PHIX_SKIP_DB_PUSH !== '1') {
  runDbSyncOrExit();
}

const { createApp } = require('./createApp');

const { app, ensureAppUsers, attachHttpServer, initAutoBackupScheduler } = createApp();

const PORT = process.env.PORT || 3000;

async function start() {
  await ensureAppUsers();
  initAutoBackupScheduler();
  const httpServer = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  attachHttpServer(httpServer);
}

start().catch((err) => {
  console.error('[server] Start fehlgeschlagen:', err);
  process.exit(1);
});
