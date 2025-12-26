import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dataDir = path.join(app.getPath('userData'), 'data');
const dataFile = path.join(dataDir, 'app-data.json');

// Files written by v1 of the app, merged into one object on first launch
const LEGACY_FILES = {
	runs: 'runs.json',
	friends: 'friends.json',
	rewardConfig: 'reward-config.json',
	activeRunId: 'active-run-id.json',
} as const;

async function readJson(file: string): Promise<unknown | null> {
	try {
		return JSON.parse(await fs.readFile(file, 'utf-8'));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
			console.error(`Error reading ${file}:`, error);
		}
		return null;
	}
}

// Write to a temp file then rename, so a crash can't leave a half-written file
async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
	const tmp = `${file}.tmp`;
	await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
	await fs.rename(tmp, file);
}

async function loadLegacy(): Promise<Record<string, unknown> | null> {
	const merged: Record<string, unknown> = {};
	let found = false;
	for (const [key, name] of Object.entries(LEGACY_FILES)) {
		const value = await readJson(path.join(dataDir, name));
		if (value !== null) {
			merged[key] = value;
			found = true;
		}
	}
	if (!found) return null;

	// Keep a copy of the originals before the new format replaces them
	const backupDir = path.join(
		dataDir,
		`backup-v1-${new Date().toISOString().replace(/[:.]/g, '-')}`,
	);
	await fs.mkdir(backupDir, { recursive: true });
	for (const name of Object.values(LEGACY_FILES)) {
		await fs.copyFile(path.join(dataDir, name), path.join(backupDir, name)).catch(() => {});
	}
	return merged;
}

ipcMain.handle('load-data', async () => {
	await fs.mkdir(dataDir, { recursive: true });
	try {
		const raw = await fs.readFile(dataFile, 'utf-8');
		return JSON.parse(raw);
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code !== 'ENOENT') {
			// Corrupt file: keep it for inspection and fall through to legacy/empty
			console.error('app-data.json unreadable:', error);
			await fs.rename(dataFile, `${dataFile}.corrupt-${Date.now()}`).catch(() => {});
		}
	}
	return loadLegacy();
});

ipcMain.handle('save-data', async (_event, data: unknown) => {
	await fs.mkdir(dataDir, { recursive: true });
	await writeJsonAtomic(dataFile, data);
});

ipcMain.handle('export-data', async (event, data: unknown) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	const defaultPath = path.join(
		app.getPath('documents'),
		`snowball-backup-${new Date().toISOString().slice(0, 10)}.json`,
	);
	const options = {
		title: 'Export backup',
		defaultPath,
		filters: [{ name: 'JSON', extensions: ['json'] }],
	};
	const result = win
		? await dialog.showSaveDialog(win, options)
		: await dialog.showSaveDialog(options);
	if (result.canceled || !result.filePath) return null;
	await writeJsonAtomic(result.filePath, data);
	return result.filePath;
});

ipcMain.handle('import-data', async (event) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	const options = {
		title: 'Import backup',
		properties: ['openFile' as const],
		filters: [{ name: 'JSON', extensions: ['json'] }],
	};
	const result = win
		? await dialog.showOpenDialog(win, options)
		: await dialog.showOpenDialog(options);
	if (result.canceled || result.filePaths.length === 0) return null;
	return readJson(result.filePaths[0]);
});

ipcMain.handle('open-data-folder', async () => {
	await fs.mkdir(dataDir, { recursive: true });
	await shell.openPath(dataDir);
});

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..');

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
	? path.join(process.env.APP_ROOT, 'public')
	: RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
	win = new BrowserWindow({
		icon: path.join(process.env.VITE_PUBLIC as string, 'icon.png'),
		width: 1280,
		height: 860,
		minWidth: 960,
		minHeight: 640,
		backgroundColor: '#0e0f0c',
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, 'preload.mjs'),
		},
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL);
	} else {
		win.loadFile(path.join(RENDERER_DIST, 'index.html'));
	}
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
		win = null;
	}
});

app.on('activate', () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

app.whenReady().then(createWindow);
