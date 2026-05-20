require('dotenv').config();
const { runDbPush } = require('./lib/db-push');

runDbPush();

const { createApp } = require('./createApp');

const { app, migrateData, ensureAppUsers, attachHttpServer } = createApp();

const PORT = process.env.PORT || 3000;
const httpServer = app.listen(PORT, async () => {
  await migrateData();
  await ensureAppUsers();
  console.log(`Server running on port ${PORT}`);
});

attachHttpServer(httpServer);
