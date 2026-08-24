import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  platform: string;
  isDesktop: boolean;
  openDirectoryPicker: () => Promise<string | null>;
  showNotification: (title: string, body: string) => Promise<void>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
}

const api: ElectronAPI = {
  platform: process.platform,
  isDesktop: true,
  openDirectoryPicker: () => ipcRenderer.invoke('dialog:openDirectory'),
  showNotification: (title, body) => ipcRenderer.invoke('app:notification', { title, body }),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
