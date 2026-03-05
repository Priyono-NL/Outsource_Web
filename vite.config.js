import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Kita buat prefix '/api-sso' sebagai jembatan
      '/api-sso': {
        target: 'https://sso.ceresnl.com:50443',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-sso/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
        },
      },
    }
  }
})