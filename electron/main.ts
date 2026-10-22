import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promises as fs, writeFileSync } from 'node:fs';

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

const backupDir = path.join(dataDir, 'backups');
const KEEP_BACKUPS = 14;
const BACKUP_NAME = /^app-data-\d{4}-\d{2}-\d{2}\.json$/;

// Before the first save of each day, keep a copy of the file as it was
async function dailyBackup(): Promise<void> {
	const day = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, local time
	const target = path.join(backupDir, `app-data-${day}.json`);
	try {
		await fs.access(target);
		return;
	} catch {
		// No backup yet today
	}
	try {
		await fs.mkdir(backupDir, { recursive: true });
		await fs.copyFile(dataFile, target);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
			console.error('Daily backup failed:', error);
		}
		return;
	}
	const old = (await fs.readdir(backupDir)).filter((f) => BACKUP_NAME.test(f)).sort();
	for (const name of old.slice(0, -KEEP_BACKUPS)) {
		await fs.rm(path.join(backupDir, name)).catch(() => {});
	}
}

// Saves run one at a time so two writes can't race on the same temp file
let saveQueue: Promise<void> = Promise.resolve();

ipcMain.handle('save-data', (_event, data: unknown) => {
	const save = saveQueue.then(async () => {
		await fs.mkdir(dataDir, { recursive: true });
		await dailyBackup();
		await writeJsonAtomic(dataFile, data);
	});
	saveQueue = save.catch(() => {});
	return save;
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

ipcMain.handle('export-csv', async (event, name: string, csv: string) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	const options = {
		title: 'Export CSV',
		defaultPath: path.join(app.getPath('documents'), path.basename(name)),
		filters: [{ name: 'CSV', extensions: ['csv'] }],
	};
	const result = win
		? await dialog.showSaveDialog(win, options)
		: await dialog.showSaveDialog(options);
	if (result.canceled || !result.filePath) return null;
	// The BOM makes Excel read the file as UTF-8 (names with ä, ö and so on)
	await fs.writeFile(result.filePath, `\ufeff${csv}`, 'utf-8');
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

const windowStateFile = path.join(app.getPath('userData'), 'window-state.json');

interface WindowState {
	x?: number;
	y?: number;
	width: number;
	height: number;
	maximized?: boolean;
}

async function loadWindowState(): Promise<WindowState> {
	const saved = (await readJson(windowStateFile)) as WindowState | null;
	if (!saved || typeof saved.width !== 'number' || typeof saved.height !== 'number') {
		return { width: 1280, height: 860 };
	}
	const size = { width: saved.width, height: saved.height, maximized: saved.maximized };
	if (typeof saved.x !== 'number' || typeof saved.y !== 'number') return size;

	// Forget the position when the monitor it was on is no longer there
	const bounds = { x: saved.x, y: saved.y, width: saved.width, height: saved.height };
	const area = screen.getDisplayMatching(bounds).workArea;
	const visible =
		bounds.x < area.x + area.width &&
		bounds.x + bounds.width > area.x &&
		bounds.y < area.y + area.height &&
		bounds.y + bounds.height > area.y;
	return visible ? { ...bounds, maximized: saved.maximized } : size;
}

// Only the app itself may load in the window; web links open in the browser
function isAppUrl(url: string): boolean {
	if (VITE_DEV_SERVER_URL) return url.startsWith(VITE_DEV_SERVER_URL);
	return url.startsWith('file:');
}

function openExternal(url: string) {
	if (/^https?:\/\//.test(url)) shell.openExternal(url);
}

async function createWindow() {
	const state = await loadWindowState();
	win = new BrowserWindow({
		icon: path.join(process.env.VITE_PUBLIC as string, 'icon.png'),
		x: state.x,
		y: state.y,
		width: state.width,
		height: state.height,
		minWidth: 960,
		minHeight: 640,
		backgroundColor: '#0e0f0c',
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, 'preload.mjs'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});
	if (state.maximized) win.maximize();

	win.webContents.setWindowOpenHandler(({ url }) => {
		openExternal(url);
		return { action: 'deny' };
	});
	win.webContents.on('will-navigate', (event, url) => {
		if (isAppUrl(url)) return;
		event.preventDefault();
		openExternal(url);
	});

	// Let the renderer write pending changes before the window goes away
	let closing = false;
	win.on('close', (event) => {
		if (closing) return;
		closing = true;
		event.preventDefault();
		const target = win;
		if (target) {
			const state: WindowState = {
				...target.getNormalBounds(),
				maximized: target.isMaximized(),
			};
			// Sync: the app may quit as soon as the window is destroyed
			try {
				writeFileSync(windowStateFile, JSON.stringify(state));
			} catch (e) {
				console.error('Could not save window state:', e);
			}
		}
		const finish = () => {
			if (target && !target.isDestroyed()) target.destroy();
		};
		ipcMain.once('flush-done', finish);
		setTimeout(finish, 2000);
		target?.webContents.send('flush-request');
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

// A second copy would overwrite the same data file, so focus the first one instead
if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	app.on('second-instance', () => {
		if (!win || win.isDestroyed()) return;
		if (win.isMinimized()) win.restore();
		win.focus();
	});
	app.whenReady().then(createWindow);
}
