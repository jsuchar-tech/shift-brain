import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx$/,
    exclude: []
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.jsx': 'jsx'
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: function(path) {
          return path.replace(/^\/api/, '')
        }
      }
    }
  },
  build: {
    // Safely resolves the path to the sibling api/public directory
    outDir: path.resolve(__dirname, '../api/public'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Enforces the core JS bundle to be named 'widget.js' instead of matching index-[hash].js
        entryFileNames: 'widget.js',
        // Enforces chunks to be neatly organized if code-splitting happens
        chunkFileNames: 'assets/[name].js',
        // Enforces your style blocks to compile into 'widget.css' instead of index-[hash].css
        assetFileNames: 'widget.[ext]'
      }
    }
  }
})

