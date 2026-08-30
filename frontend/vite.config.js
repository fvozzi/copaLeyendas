var _a, _b;
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import packageJson from './package.json';
var env = (_b = (_a = globalThis.process) === null || _a === void 0 ? void 0 : _a.env) !== null && _b !== void 0 ? _b : {};
var appVersion = env.VITE_APP_VERSION || packageJson.version;
var appBuild = env.VITE_APP_BUILD || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
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
