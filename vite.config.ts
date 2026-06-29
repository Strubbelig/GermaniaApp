import { defineConfig } from 'vite';

// Relative base so the build works under a GitHub Pages project path
// (https://USER.github.io/REPO/) without knowing the repo name at build time.
export default defineConfig({
  base: './',
  build: { outDir: 'dist' },
});
