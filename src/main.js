const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');

let mainWindow;
let botProcess = null;

const isDev = process.env.NODE_ENV === 'development';

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-accelerated-video');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');

function getConfigPath() {
    if (isDev) {
        return path.join(__dirname, '../config');
    }
    return path.join(path.dirname(process.execPath), 'config');
}

function ensureConfigDirectory() {
    const configDir = getConfigPath();
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    
    const configFile = path.join(configDir, 'config.json');
    if (!fs.existsSync(configFile)) {
        const defaultConfig = {
            botNicknames: [],
            itemsToSell: [],
            receiverNickname: 'MrVupsin'
        };
        fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
    }
    
    const readmeFile = path.join(configDir, 'README.txt');
    if (!fs.existsSync(readmeFile)) {
        const readmeContent = 
            'Папка config содержит настройки программы.\n' +
            'config.json - основной файл конфигурации.\n' +
            'Вы можете редактировать config.json вручную, когда программа выключена.\n' +
            'Не забудьте сделать резервную копию перед редактированием.';
        fs.writeFileSync(readmeFile, readmeContent);
    }
}

ipcMain.on('save-config', (event, config) => {
    try {
        const configPath = path.join(getConfigPath(), 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving config:', error);
    }
});

ipcMain.on('get-config', (event) => {
    try {
        const configPath = path.join(getConfigPath(), 'config.json');
        const config = JSON.parse(fs.readFileSync(configPath));
        event.reply('config-data', config);
    } catch (error) {
        console.error('Error loading config:', error);
        event.reply('config-data', { botNicknames: [], itemsToSell: [] });
    }
});

function createWindow() {
    ensureConfigDirectory();
    
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        icon: path.join(__dirname, '../assets/icon.png'),
        show: false,
        minWidth: 800,
        minHeight: 600,
        center: true,
        backgroundColor: '#141E30',
        frame: true,
        visualEffectState: 'active',
        titleBarStyle: 'default',
        maximizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            devTools: isDev,
            backgroundThrottling: false,
            offscreen: false,
            enableRemoteModule: false,
            worldSafeExecuteJavaScript: true,
            spellcheck: false,
            enableWebSQL: false,
            enableBlinkFeatures: ''
        }
    });

    mainWindow.setMenu(null);

    if (isDev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    mainWindow.loadFile(path.join(__dirname, '../views/index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.maximize();
    });

    mainWindow.webContents.setFrameRate(60);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.on('start-bot', (event) => {
    console.log('Starting bot...');
    if (!botProcess) {
        try {
            const configPath = path.join(getConfigPath(), 'config.json');
            
            botProcess = fork(path.join(__dirname, 'server.js'), [], {
                env: {
                    ...process.env,
                    CONFIG_PATH: configPath
                }
            });
            
            botProcess.on('message', (message) => {
                if (message.type === 'log') {
                    mainWindow.webContents.send('bot-log', message.data.message, message.data.type);
                }
            });

            botProcess.on('error', (error) => {
                mainWindow.webContents.send('bot-log', `Ошибка процесса: ${error.message}`, 'error');
            });

            botProcess.on('exit', (code) => {
                mainWindow.webContents.send('bot-log', `Процесс завершился с кодом: ${code}`, 'warning');
                botProcess = null;
            });

            event.reply('bot-status', 'started');
            // mainWindow.webContents.send('bot-log', 'Боты запущены', 'success');
        } catch (error) {
            console.error('Error starting bot:', error);
            event.reply('bot-status', 'error');
            mainWindow.webContents.send('bot-log', `Ошибка запуска: ${error.message}`, 'error');
        }
    }
});

ipcMain.on('stop-bot', (event) => {
    console.log('Stopping bot...');
    if (botProcess) {
        botProcess.kill();
        botProcess = null;
        event.reply('bot-status', 'stopped');
        // mainWindow.webContents.send('bot-log', 'Боты остановлены', 'warning');
    }
});
  