import { defineConfig, type Plugin } from 'vite';
import path from 'node:path';
import electron from 'vite-plugin-electron/simple';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Production only: the dev server needs inline scripts for React Fast Refresh
const CSP = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data:",
	"font-src 'self' data:",
	"object-src 'none'",
	"base-uri 'none'",
	"form-action 'none'",
].join('; ');

const contentSecurityPolicy = (): Plugin => ({
	name: 'content-security-policy',
	apply: 'build',
	transformIndexHtml: () => [
		{
			tag: 'meta',
			attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
			injectTo: 'head-prepend',
		},
	],
});

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		contentSecurityPolicy(),
		react(),
		tailwindcss(),
		electron({
			main: {
				// Shortcut of `build.lib.entry`.
				entry: 'electron/main.ts',
			},
			preload: {
				// Shortcut of `build.rolldownOptions.input`.
				// Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
				input: path.join(import.meta.dirname, 'electron/preload.ts'),
			},
			// Ployfill the Electron and Node.js API for Renderer process.
			// If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
			// See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
			renderer:
				process.env.NODE_ENV === 'test'
					? // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
						undefined
					: {},
		}),
	],
});
