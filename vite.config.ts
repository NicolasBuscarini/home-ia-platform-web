import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    // Static bundle is served by the portal API under /platform/.
    base: command === 'build' ? '/platform/' : '/',
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    plugins: [
      react(),
      federation({
        name: 'home_ia_platform',
        filename: 'remoteEntry.js',
        exposes: {
          './AccessModule': './src/AccessModule.tsx',
          './SystemsModule': './src/SystemsModule.tsx',
        },
        shared: ['react', 'react-dom', 'home-ia-shared'],
        dts: false,
      }),
    ],
    server: {
      host: '0.0.0.0',
      port: 5175,
      strictPort: true,
      cors: true,
      origin: env.VITE_REMOTE_ORIGIN || 'http://127.0.0.1:5175',
    },
    preview: {
      host: '0.0.0.0',
      port: 5175,
      strictPort: true,
      cors: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      target: 'esnext',
    },
  };
});
