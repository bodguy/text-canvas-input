import { defineConfig, UserConfigExport } from 'vite';

export default function (): UserConfigExport {
  return defineConfig({
    resolve: {},
    base: '/',
    build: {
      outDir: 'dist'
    },
    plugins: [],
    clearScreen: false,
    envPrefix: ['VITE_']
  });
}