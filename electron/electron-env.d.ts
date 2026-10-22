/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
	interface ProcessEnv {
		/**
		 * The built directory structure
		 *
		 * ```tree
		 * ├─┬─┬ dist
		 * │ │ └── index.html
		 * │ │
		 * │ ├─┬ dist-electron
		 * │ │ ├── main.js
		 * │ │ └── preload.js
		 * │
		 * ```
		 */
		APP_ROOT: string;
		/** /dist/ or /public/ */
		VITE_PUBLIC: string;
	}
}

// Used in Renderer process, exposed in `preload.ts`
interface Window {
	api: {
		loadData: () => Promise<unknown | null>;
		saveData: (data: unknown) => Promise<void>;
		exportData: (data: unknown) => Promise<string | null>;
		/** Save dialog for a CSV file; resolves to the chosen path, or null if cancelled. */
		exportCsv: (name: string, csv: string) => Promise<string | null>;
		importData: () => Promise<unknown | null>;
		openDataFolder: () => Promise<void>;
		/** Main asks the renderer to save pending changes before the window closes. */
		onFlushRequest: (flush: () => Promise<void>) => void;
	};
}
