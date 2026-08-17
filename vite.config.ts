import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path';
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
    },
  }, build: {
    // commonjsOptions: { transformMixedEsModules: true }, // Change
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        // psycmicrograph: resolve(__dirname, 'psycmicrograph.html')
        // nested: resolve(__dirname, 'nested/index.html'),
      },
    },
  },
  plugins: [react()],
  server: {
     watch: {
      usePolling: true,
    },
    allowedHosts: true,
    proxy: {
      // '/api':{
      //   target: `http://localhost:3000`,
      //   ws: true
      // },
      '/jupyter': {
        target: `http://localhost:10100`,
        ws: true
      }, '/api': {
        target: `http://localhost:8084`,
        ws: true
      }, "/brave-api/ws-group": {
        target: "ws://localhost:8084",
        ws: true,
        changeOrigin: true,
      }, "/brave-api": {
        target: `http://localhost:8084`,
        ws: true,
        changeOrigin: true,
      }, "/container": {
        target: `http://localhost:8084`,
        ws: true,
        changeOrigin: true,
      }, "/images": {
        target: `http://localhost:8084`,
        ws: true,
        changeOrigin: true,
      }, "/onlyoffice": {
        target: `http://localhost:8084`,
        ws: true,
        changeOrigin: true,
      }, "/docs": {
        target: `http://localhost:8084`,
        ws: true,
        changeOrigin: true,
      }, "/data-analysis": {
        target: `http://localhost:8084`,
        ws: true,
        changeOrigin: true,
      }, "/data-project": {
        target: `http://localhost:8084`,
        ws: true,
        changeOrigin: true,
      }
    }
  }
})
