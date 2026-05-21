require('dotenv').config();
const { runDbPushOrExit } = require('./lib/db-push');

/** Desktop: Schema-Push erfolgt in Electron main.cjs vor server.js (PHIX_SKIP_DB_PUSH=1). */
if (process.env.PHIX_SKIP_DB_PUSH !== '1') {
  runDbPushOrExit();
}

const { createApp } = require('./createApp');

const { app, migrateData, ensureAppUsers, attachHttpServer } = createApp();

const PORT = process.env.PORT || 3000;
const httpServer = app.listen(PORT, async () => {
  await migrateData();
  await ensureAppUsers();
  console.log(`Server running on port ${PORT}`);
});

attachHttpServer(httpServer);
