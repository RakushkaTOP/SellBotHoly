const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startBot: () => ipcRenderer.send('start-bot'),
    stopBot: () => ipcRenderer.send('stop-bot'),
    getConfig: () => ipcRenderer.send('get-config'),
    saveConfig: (config) => ipcRenderer.send('save-config', config),
    onConfigData: (callback) => ipcRenderer.on('config-data', (event, value) => callback(value)),
    onBotLog: (callback) => ipcRenderer.on('bot-log', (event, message, type) => callback(message, type))
}); 