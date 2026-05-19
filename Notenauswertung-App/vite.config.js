import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom Plugin, das eine API Route zum Herunterfahren bereitstellt
function shutdownPlugin() {
  return {
    name: 'shutdown-plugin',
    configureServer(server) {
      server.middlewares.use('/shutdown', (req, res, next) => {
        if (req.method !== 'POST') return next();
        res.statusCode = 200;
        res.end('Vite dev server stopped');
        setTimeout(() => process.exit(0), 300);
      });
    }
  }
}

export default defineConfig({
  plugins: [react(), shutdownPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
