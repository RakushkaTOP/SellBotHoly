const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
let botProcess = null;

// Serve static files
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.json());

// Config management
function getConfigPath() {
    return path.join(__dirname, '../config');
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

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('Client connected');

    // Send initial config
    const configPath = path.join(getConfigPath(), 'config.json');
    try {
        const config = JSON.parse(fs.readFileSync(configPath));
        ws.send(JSON.stringify({ 
            type: 'config-data', 
            data: config 
        }));
        
        // Отправляем начальный статус бота
        ws.send(JSON.stringify({ 
            type: 'bot-status', 
            data: botProcess ? 'started' : 'stopped' 
        }));
    } catch (error) {
        console.error('Error loading config:', error);
    }

    ws.on('message', async (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'start-bot':
                if (!botProcess) {
                    try {
                        const configPath = path.join(getConfigPath(), 'config.json');
                        
                        botProcess = fork(path.join(__dirname, 'bot.js'), [], {
                            env: {
                                ...process.env,
                                CONFIG_PATH: configPath
                            }
                        });
                        
                        botProcess.on('message', (message) => {
                            if (message.type === 'log') {
                                // Пропускаем дублирующие сообщения о запуске/остановке
                                if (message.data.message === 'Боты запущены' || 
                                    message.data.message === 'Боты остановлены' ||
                                    message.data.message.includes('карт из 12') ||
                                    message.data.message.includes('Все карты получены')) {
                                    return;
                                }
                                broadcastLog(message.data.message, message.data.type);
                            } else if (message.type === 'captcha-image') {
                                broadcastCaptchaImage(message.data.image);
                            }
                        });

                        broadcastBotStatus('started');
                        // broadcastLog('Боты запущены', 'success');
                    } catch (error) {
                        console.error('Error starting bot:', error);
                        broadcastBotStatus('error');
                        broadcastLog(`Ошибка запуска: ${error.message}`, 'error');
                    }
                }
                break;

            case 'stop-bot':
                if (botProcess) {
                    botProcess.kill();
                    botProcess = null;
                    broadcastBotStatus('stopped');
                    // broadcastLog('Боты остановлены', 'warning');
                }
                break;

            case 'save-config':
                try {
                    const configPath = path.join(getConfigPath(), 'config.json');
                    fs.writeFileSync(configPath, JSON.stringify(data.config, null, 2));
                    broadcastLog('Конфигурация сохранена', 'success');
                } catch (error) {
                    console.error('Error saving config:', error);
                    broadcastLog('Ошибка сохранения конфигурации', 'error');
                }
                break;

            case 'chat-message':
                if (botProcess) {
                    // Отправляем сообщение только один раз
                    botProcess.send({ 
                        type: 'chat-message', 
                        message: data.message 
                    });
                }
                break;

            case 'captcha-answer':
                if (botProcess) {
                    botProcess.send({ 
                        type: 'captcha-answer', 
                        answer: data.answer 
                    });
                }
                break;
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

function broadcastLog(message, type) {
    // Проверяем, не является ли сообщение дублирующим
    if (message === 'Боты запущены' || message === 'Боты остановлены') {
        // Проверяем, не отправляли ли мы это сообщение недавно
        const now = Date.now();
        if (lastBroadcastTime && now - lastBroadcastTime < 1000) {
            return; // Пропускаем дублирующее сообщение
        }
        lastBroadcastTime = now;
    }

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'bot-log',
                data: { message, type }
            }));
        }
    });
}

// Добавляем переменную для отслеживания времени последней отправки
let lastBroadcastTime = 0;

// Добавляем новые роуты для работы с конфигурацией
app.get('/api/config', (req, res) => {
    try {
        console.log('Получен запрос на чтение конфигурации');
        const configPath = path.join(getConfigPath(), 'config.json');
        const config = JSON.parse(fs.readFileSync(configPath));
        console.log('Отправка конфигурации:', config);
        res.json(config);
    } catch (error) {
        console.error('Ошибка чтения конфигурации:', error);
        res.status(500).json({ error: 'Ошибка загрузки конфигурации' });
    }
});

app.post('/api/config', express.json(), (req, res) => {
    try {
        console.log('Получен запрос на сохранение конфигурации:', req.body);
        const configPath = path.join(getConfigPath(), 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
        console.log('Конфигурация сохранена в:', configPath);
        broadcastConfigUpdate(req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка сохранения конфигурации:', error);
        res.status(500).json({ error: 'Ошибка сохранения конфигурации' });
    }
});

function broadcastConfigUpdate(config) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'config-update',
                data: config
            }));
        }
    });
}

// Добавляем функцию для рассылки статуса бота
function broadcastBotStatus(status) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'bot-status',
                data: status
            }));
        }
    });
}

// Добавьте новую функцию для рассылки изображения капчи
function broadcastCaptchaImage(imageBase64) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'captcha-image',
                data: imageBase64
            }));
        }
    });
}

// Start server
ensureConfigDirectory();
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});