import { ipcRenderer, contextBridge } from 'electron';

// --------- Expose a small typed API to the Renderer process ---------
contextBridge.exposeInMainWorld('api', {
	loadData: (): Promise<unknown | null> => ipcRenderer.invoke('load-data'),
	saveData: (data: unknown): Promise<void> => ipcRenderer.invoke('save-data', data),
	exportData: (data: unknown): Promise<string | null> => ipcRenderer.invoke('export-data', data),
	importData: (): Promise<unknown | null> => ipcRenderer.invoke('import-data'),
	openDataFolder: (): Promise<void> => ipcRenderer.invoke('open-data-folder'),
	onFlushRequest: (flush: () => Promise<void>) => {
		ipcRenderer.on('flush-request', async () => {
			await flush().catch(() => {});
			ipcRenderer.send('flush-done');
		});
	},
});
