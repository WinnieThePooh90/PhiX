import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom Plugin, das eine API Route zum Herunterfahren bereitstellt
function shutdownPlugin() {
  return {
    name: 'shutdown-plugin',
    configureServer(server) {
      server.middlewares.use('/shutdown', (req, res) => {
        res.statusCode = 200;
        res.end('Sever killed');
        setTimeout(() => {
          process.exit(0);
        }, 500);
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
