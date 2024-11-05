function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const mainContent = document.getElementById('main-content');
    
    if (loadingScreen && mainContent) {
        mainContent.classList.add('fade-in');
        mainContent.style.opacity = '1';
        mainContent.style.transform = 'translateY(0)';
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

const ws = new WebSocket(`ws://${window.location.host}`);

const terminal = {
    output: document.getElementById('terminalOutput'),
    
    initialize() {
        const commandInput = document.getElementById('commandInput');
        const sendButton = document.getElementById('sendCommand');
        
        if (commandInput && sendButton) {
            const sendMessage = () => {
                const message = commandInput.value.trim();
                if (message) {
                    ws.send(JSON.stringify({
                        type: 'chat-message',
                        message: message
                    }));
                    commandInput.value = '';
                }
            };

            sendButton.addEventListener('click', sendMessage);
            commandInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        }

        document.getElementById('clearTerminal')?.addEventListener('click', () => {
            this.clear();
        });
    },

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const msgElement = document.createElement('div');
        msgElement.className = `terminal-message log-${type}`;
        msgElement.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
        this.output.appendChild(msgElement);
        this.output.parentElement.scrollTop = this.output.parentElement.scrollHeight;
    },

    clear() {
        if (this.output) {
            this.output.innerHTML = '';
        }
    },

    showCaptcha(imageBase64) {
        const msgElement = document.createElement('div');
        msgElement.className = 'terminal-message captcha-container';
        
        const timestamp = new Date().toLocaleTimeString();
        msgElement.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <div class="captcha-message">Получена капча:</div>
            <img src="data:image/png;base64,${imageBase64}" class="captcha-image">
            <div class="captcha-input-container">
                <input type="text" class="captcha-input" placeholder="Введите ответ на капчу">
                <button class="captcha-submit">Отправить</button>
            </div>
        `;
        
        this.output.appendChild(msgElement);
        
        const captchaInput = msgElement.querySelector('.captcha-input');
        const submitButton = msgElement.querySelector('.captcha-submit');
        
        const submitCaptcha = () => {
            const answer = captchaInput.value.trim();
            if (answer) {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'captcha-answer',
                        answer: answer
                    }));
                    this.log(`Отправлен ответ на капчу: ${answer}`, 'info');
                }
                captchaInput.disabled = true;
                submitButton.disabled = true;
            }
        };

        captchaInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitCaptcha();
            }
        });

        submitButton.addEventListener('click', submitCaptcha);
        
        captchaInput.focus();
        
        this.output.parentElement.scrollTop = this.output.parentElement.scrollHeight;
    }
};

const configManager = {
    async load() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            if (typeof updateUIFromConfig === 'function') {
                updateUIFromConfig(config);
            }
            // terminal.log('Конфигурация загружена', 'success');
        } catch (error) {
            terminal.log('Ошибка загрузки конфигурации', 'error');
        }
    },

    async save(config) {
        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
            const result = await response.json();
            if (result.success) {
                terminal.log('Конфигурация сохранена', 'success');
            }
        } catch (error) {
            terminal.log('Ошибка сохранения конфигурации', 'error');
        }
    }
};

ws.onopen = () => {
    console.log('WebSocket соединение установлено');
    hideLoadingScreen();
};

ws.onerror = (error) => {
    console.error('WebSocket ошибка:', error);
    terminal.log('Ошибка подключения к серверу', 'error');
};

function updateBotStatus(status) {
    const startButton = document.getElementById('startBot');
    const stopButton = document.getElementById('stopBot');
    
    if (status === 'started') {
        startButton.disabled = true;
        stopButton.disabled = false;
        terminal.log('Боты запущены', 'success');
    } else if (status === 'stopped') {
        startButton.disabled = false;
        stopButton.disabled = true;
        terminal.log('Боты остановлены', 'warning');
    } else if (status === 'error') {
        startButton.disabled = false;
        stopButton.disabled = true;
        terminal.log('Ошибка запуска ботов', 'error');
    }
}

const electronAPI = {
    startBot: () => ws.send(JSON.stringify({ type: 'start-bot' })),
    stopBot: () => ws.send(JSON.stringify({ type: 'stop-bot' })),
    saveConfig: (config) => ws.send(JSON.stringify({ type: 'save-config', config })),
    getConfig: () => configManager.load(),
    
    // Callbacks storage
    _configCallback: null,
    _botLogCallback: null,

    onConfigData: (callback) => {
        electronAPI._configCallback = callback;
    },
    
    onBotLog: (callback) => {
        electronAPI._botLogCallback = callback;
    }
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'bot-log') {
        terminal.log(message.data.message, message.data.type);
    } else if (message.type === 'captcha-image') {
        terminal.showCaptcha(message.data);
    } else if (message.type === 'bot-status') {
        updateBotStatus(message.data);
    }
};

window.electronAPI = electronAPI;

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    mainContent.style.transform = 'translateY(20px)';
    
    setTimeout(hideLoadingScreen, 1000);
    
    const botsTableBody = document.querySelector('#botsTable tbody');
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    
    window.electronAPI.getConfig();
    
    terminal.initialize();

    const receiverInput = document.getElementById('receiverNickname');
    
    receiverInput.addEventListener('change', () => {
        saveConfig();
    });

    function updateUIFromConfig(config) {
        const currentConfig = {
            botNicknames: Array.from(botsTableBody.querySelectorAll('tr')).map(row => 
                row.cells[0].textContent.trim()
            ),
            itemsToSell: Array.from(itemsTableBody.querySelectorAll('tr')).map(row => ({
                name: row.cells[0].textContent.trim(),
                quantity: parseInt(row.cells[1].textContent) || 64,
                price: parseInt(row.cells[2].textContent) || 1000
            }))
        };

        const configChanged = JSON.stringify(currentConfig) !== JSON.stringify(config);
        
        if (configChanged) {
            console.log('Config changed, updating UI');
            botsTableBody.innerHTML = '';
            itemsTableBody.innerHTML = '';
            
            if (config.botNicknames) {
                config.botNicknames.forEach(nickname => addBotToTable(nickname));
            }
            if (config.itemsToSell) {
                config.itemsToSell.forEach(item => addItemToTable(item));
            }
        }

        if (config.receiverNickname) {
            receiverInput.value = config.receiverNickname;
        }
    }

    window.electronAPI.onConfigData((config) => {
        updateUIFromConfig(config);
    });

    function makeEditable(cell) {
        let isEditing = false;
        
        cell.addEventListener('dblclick', function() {
            if (isEditing) return;
            isEditing = true;
            
            const currentValue = this.textContent;
            const input = document.createElement('input');
            input.value = currentValue;
            input.style.width = '90%';
            
            if (this.dataset.type === 'number') {
                input.type = 'number';
                input.min = '1';
            }

            this.textContent = '';
            this.appendChild(input);
            input.focus();

            const finishEditing = async () => {
                if (!isEditing) return;
                
                let newValue = input.value.trim();
                if (input.type === 'number') {
                    newValue = parseInt(newValue) || 1;
                }
                cell.textContent = newValue;
                isEditing = false;
                
                if (newValue !== currentValue) {
                    await saveConfig();
                }
            };

            input.addEventListener('blur', finishEditing);
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finishEditing();
                    input.blur();
                }
            });

            input.addEventListener('input', async function() {
                let newValue = this.value.trim();
                if (this.type === 'number') {
                    newValue = parseInt(newValue) || 1;
                }
                if (newValue !== currentValue) {
                    await saveConfig();
                }
            });
        });
    }

    function addBotToTable(nickname) {
        const row = document.createElement('tr');
        
        const nameCell = document.createElement('td');
        nameCell.textContent = nickname;
        makeEditable(nameCell);

        const actionsCell = document.createElement('td');
        actionsCell.innerHTML = `
            <div class="action-group">
                <button class="btn-action btn-up" onclick="moveBotUp(this)" title="Переместить вверх">
                    <i class="material-icons">keyboard_arrow_up</i>
                </button>
                <button class="btn-action btn-down" onclick="moveBotDown(this)" title="Переместить вниз">
                    <i class="material-icons">keyboard_arrow_down</i>
                </button>
                <button class="btn-action btn-danger" onclick="deleteBot(this)" title="Удалить">
                    <i class="material-icons">close</i>
                </button>
            </div>
        `;

        row.appendChild(nameCell);
        row.appendChild(actionsCell);
        botsTableBody.appendChild(row);
    }

    function addItemToTable(item) {
        const row = document.createElement('tr');
        
        const nameCell = document.createElement('td');
        nameCell.textContent = item.name;
        makeEditable(nameCell);

        const quantityCell = document.createElement('td');
        quantityCell.textContent = item.quantity;
        quantityCell.dataset.type = 'number';
        makeEditable(quantityCell);

        const priceCell = document.createElement('td');
        priceCell.textContent = item.price;
        priceCell.dataset.type = 'number';
        makeEditable(priceCell);

        const actionsCell = document.createElement('td');
        actionsCell.innerHTML = `
            <div class="action-group">
                <button class="btn-action btn-up" onclick="moveItemUp(this)" title="Переместить вверх">
                    <i class="material-icons">keyboard_arrow_up</i>
                </button>
                <button class="btn-action btn-down" onclick="moveItemDown(this)" title="Переместить вниз">
                    <i class="material-icons">keyboard_arrow_down</i>
                </button>
                <button class="btn-action btn-danger" onclick="deleteItem(this)" title="Удалить">
                    <i class="material-icons">close</i>
                </button>
            </div>
        `;

        row.appendChild(nameCell);
        row.appendChild(quantityCell);
        row.appendChild(priceCell);
        row.appendChild(actionsCell);
        itemsTableBody.appendChild(row);
    }

    window.deleteBot = async function(button) {
        button.closest('tr').remove();
        await saveConfig();
    }

    window.deleteItem = async function(button) {
        button.closest('tr').remove();
        await saveConfig();
    }

    window.moveItemUp = async function(button) {
        const row = button.closest('tr');
        const prevRow = row.previousElementSibling;
        if (prevRow) {
            row.parentNode.insertBefore(row, prevRow);
            await saveConfig();
        }
    }

    window.moveItemDown = async function(button) {
        const row = button.closest('tr');
        const nextRow = row.nextElementSibling;
        if (nextRow) {
            row.parentNode.insertBefore(nextRow, row);
            await saveConfig();
        }
    }

    window.moveBotUp = async function(button) {
        const row = button.closest('tr');
        const prevRow = row.previousElementSibling;
        if (prevRow) {
            row.parentNode.insertBefore(row, prevRow);
            await saveConfig();
        }
    }

    window.moveBotDown = async function(button) {
        const row = button.closest('tr');
        const nextRow = row.nextElementSibling;
        if (nextRow) {
            row.parentNode.insertBefore(nextRow, row);
            await saveConfig();
        }
    }

    const configManager = {
        async load() {
            try {
                const response = await fetch('/api/config');
                const config = await response.json();
                updateUIFromConfig(config);
                terminal.log('Конфигурация загружена', 'success');
            } catch (error) {
                terminal.log('Ошибка загрузки конфигурации', 'error');
            }
        },

        async save(config) {
            try {
                const response = await fetch('/api/config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(config)
                });
                const result = await response.json();
                if (result.success) {
                    terminal.log('Конфигурация сохранена', 'success');
                }
            } catch (error) {
                terminal.log('Ошибка сохранения конфигурации', 'error');
            }
        }
    };

    async function saveConfig() {
        const config = {
            botNicknames: Array.from(botsTableBody.querySelectorAll('tr')).map(row => 
                row.cells[0].textContent.trim()
            ),
            itemsToSell: Array.from(itemsTableBody.querySelectorAll('tr')).map(row => ({
                name: row.cells[0].textContent.trim(),
                quantity: parseInt(row.cells[1].textContent) || 64,
                price: parseInt(row.cells[2].textContent) || 1000
            })),
            receiverNickname: receiverInput.value || 'MrVupsin'
        };
        
        try {
            await configManager.save(config);
            terminal.log('Конфигурация автоматически сохранена', 'success');
        } catch (error) {
            terminal.log('Ошибка сохранения конфигурации', 'error');
        }
    }

    window.electronAPI.onBotLog((message, type) => {
        terminal.log(message, type);
    });

    const configSection = document.createElement('div');
    configSection.className = 'config-section';
    configSection.innerHTML = `
        <div class="config-controls">
            <button id="reloadConfig" class="btn btn-secondary">
                <i class="material-icons">refresh</i>
                <span>Обновить конфиг</span>
            </button>
            <button id="exportConfig" class="btn btn-secondary">
                <i class="material-icons">download</i>
                <span>Экспорт</span>
            </button>
            <button id="importConfig" class="btn btn-secondary">
                <i class="material-icons">upload</i>
                <span>Импорт</span>
            </button>
            <input type="file" id="configFileInput" style="display: none" accept=".json">
        </div>
    `;

    const header = document.querySelector('.header');
    if (header && header.nextSibling) {
        header.parentNode.insertBefore(configSection, header.nextSibling);
    }

    const style = document.createElement('style');
    style.textContent = `
        .config-section {
            margin: 20px 0;
            padding: 15px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .config-controls {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        
        .btn-secondary {
            background: #6c757d;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 5px;
            cursor: pointer;
            transition: background 0.3s;
        }
        
        .btn-secondary:hover {
            background: #5a6268;
        }
    `;
    document.head.appendChild(style);

    document.getElementById('reloadConfig')?.addEventListener('click', () => {
        configManager.load();
    });

    document.getElementById('exportConfig')?.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'config.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            terminal.log('Ошибка экспорта конфигурации', 'error');
        }
    });

    document.getElementById('importConfig')?.addEventListener('click', () => {
        document.getElementById('configFileInput')?.click();
    });

    document.getElementById('configFileInput')?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const content = await file.text();
                const config = JSON.parse(content);
                await configManager.save(config);
                configManager.load();
            } catch (error) {
                terminal.log('Ошибка импорта конфигурации', 'error');
            }
        }
    });

    document.getElementById('addBot')?.addEventListener('click', () => {
        console.log('Добавление бота...');
        addBotToTable('Новый бот');
        saveConfig();
    });

    document.getElementById('addItem')?.addEventListener('click', () => {
        console.log('Добавление предмета...');
        addItemToTable({
            name: 'Новый предмет',
            quantity: 64,
            price: 1000
        });
        saveConfig();
    });

    configManager.load();

    // Добавляем обработчики для кнопок старт/стоп
    document.getElementById('startBot')?.addEventListener('click', () => {
        electronAPI.startBot();
    });

    document.getElementById('stopBot')?.addEventListener('click', () => {
        electronAPI.stopBot();
    });
}); 