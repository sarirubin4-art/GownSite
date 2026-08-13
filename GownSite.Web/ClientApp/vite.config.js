import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort : true,
    open: true,
    proxy: {
      '/api' : {
        target: 'http://localhost:5200',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
      '/uploads' : {
        target: 'http://localhost:5200',
        changeOrigin: true,
        secure: false
      }
    }
  }
})