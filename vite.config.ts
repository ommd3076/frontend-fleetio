import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    watch: {
      ignored: ['**/dist/**', '**/.git/**', '**/.publish/**', '**/.local-archive/**', '**/release/**', '**/.unlazy/**']
    }
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
})

