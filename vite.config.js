import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3001, 
    strictPort: true,
  },
  envDir: './',
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['bootstrap', 'react-select', 'sweetalert2'],
          'vendor-utils': ['axios', 'file-saver'],
        },
      },
    },
  },
})