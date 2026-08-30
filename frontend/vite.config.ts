import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import packageJson from './package.json';

const env =
  (globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  }).process?.env ?? {};
const appVersion = env.VITE_APP_VERSION || packageJson.version;
const appBuild = env.VITE_APP_BUILD || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_BUILD__: JSON.stringify(appBuild),
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    fs: {
      allow: ['..'],
    },
  },
});
