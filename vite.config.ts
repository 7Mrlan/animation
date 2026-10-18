import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative assets work on localhost, GitHub Pages and other subdirectories.
  base: './',
})
