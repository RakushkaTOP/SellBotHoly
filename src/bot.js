const mineflayer = require('mineflayer');
const { pathfinder, goals: { GoalNear } } = require('mineflayer-pathfinder');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { mapDownloader } = require('mineflayer-item-map-downloader');

let canSellItems = true;

// Загрузка конфигурации
const configPath = process.env.CONFIG_PATH;
const config = JSON.parse(fs.readFileSync(configPath));

// Вспомогательная функция для создания паузы
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// В начале файла добавляем переменную для текущего бота
let currentBot = null;

// Функция для создания торгового бота
async function createTradingBot(index) {
    const botName = config.botNicknames[index];

    const tradingBot = mineflayer.createBot({
        host: 'hub.holyworld.ru',
        port: 25565,
        username: botName,
        version: '1.19.4',
        "mapDownloader-outputDir": './captcha_maps'
    });

    tradingBot.loadPlugin(pathfinder);
    tradingBot.loadPlugin(mapDownloader);

    currentBot = tradingBot;

    // Добавляем обработчик сообщений от сервера
    process.on('message', (message) => {
        if (message.type === 'chat-message' && currentBot) {
            currentBot.chat(message.message);
            process.send({ 
                type: 'log', 
                data: { 
                    message: `[${botName}] отправлено: ${message.message}`, 
                    type: 'info' 
                } 
            });
        }
    });

    // Создаем/очищаем папку для карт капчи
    const captchaMapsDir = './captcha_maps';
    if (fs.existsSync(captchaMapsDir)) {
        fs.readdirSync(captchaMapsDir).forEach(file => {
            fs.unlinkSync(path.join(captchaMapsDir, file));
        });
    } else {
        fs.mkdirSync(captchaMapsDir);
    }

    // Функция проверки наличия всех карт
    function checkMaps() {
        const files = fs.readdirSync(captchaMapsDir);
        const pngFiles = files.filter(file => 
            file.startsWith('map_') && 
            file.endsWith('.png') && 
            !file.includes('combined')
        );
        
        if (pngFiles.length === 12) {
            combineMaps();
            return true;
        }
        return false;
    }

    // Функция объединения карт капчи
    async function combineMaps() {
        try {
            const mapOrder = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

            const finalImage = await sharp({
                create: {
                    width: 128 * 4,
                    height: 128 * 3,
                    channels: 4,
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                }
            });

            const compositeOperations = [];

            for (let i = 0; i < mapOrder.length; i++) {
                const mapNum = mapOrder[i].toString().padStart(6, '0');
                const mapPath = `./captcha_maps/map_${mapNum}.png`;
                
                if (!fs.existsSync(mapPath)) {
                    throw new Error(`Файл не найден: ${mapPath}`);
                }

                const x = (i % 4) * 128;
                const y = Math.floor(i / 4) * 128;

                compositeOperations.push({
                    input: mapPath,
                    left: x,
                    top: y
                });
            }

            await finalImage
                .composite(compositeOperations)
                .toFile('./captcha_maps/combined_captcha.png');

            const base64Image = fs.readFileSync('./captcha_maps/combined_captcha.png', 'base64');
            process.send({ 
                type: 'captcha-image', 
                data: { 
                    image: base64Image,
                    message: 'Получена капча',
                    type: 'info'
                } 
            });

        } catch (err) {
            process.send({ 
                type: 'log', 
                data: { 
                    message: `Ошибка при объединении карт: ${err.message}`, 
                    type: 'error' 
                } 
            });
        }
    }

    // Проверяем наличие карт каждую секунду
    const checkInterval = setInterval(() => {
        if (checkMaps()) {
            clearInterval(checkInterval);
        }
    }, 1000);

    tradingBot.once('spawn', () => {
        process.send({ 
            type: 'log', 
            data: { 
                message: `Бот ${botName} подключился к серверу`, 
                type: 'success' 
            } 
        });

        tradingBot.chat('/anarchy');
        
        tradingBot.on('windowOpen', async (window) => {
            try {
                process.send({ 
                    type: 'log', 
                    data: { 
                        message: `Открыто окно: ${window.title}`, 
                        type: 'info' 
                    } 
                });

                setTimeout(async () => {
                    try {
                        await tradingBot.clickWindow(25, 0, 0);
                    } catch (err) {
                        if (!err.message.includes("Server didn't respond to transaction")) {
                            process.send({ 
                                type: 'log', 
                                data: { 
                                    message: `Ошибка при нажатии на слот: ${err.message}`, 
                                    type: 'error' 
                                } 
                            });
                        }
                    }
                }, 5000);
            } catch (err) {
                process.send({ 
                    type: 'log', 
                    data: { 
                        message: `Произошла ошибка: ${err.message}`, 
                        type: 'error' 
                    } 
                });
            }
        });

        setTimeout(() => {
            tradingBot.chat(`/pay ${config.receiverNickname} all`);
            performNewFunction(tradingBot, index);
        }, 13000);
    });

    tradingBot.on('message', (message) => {
        process.send({ 
            type: 'log', 
            data: { 
                message: `[${botName}] ${message.toString()}`, 
                type: 'info' 
            } 
        });
    });

    tradingBot.on('error', (err) => {
        process.send({ 
            type: 'log', 
            data: { 
                message: `Ошибка: ${err.message}`, 
                type: 'error' 
            } 
        });
    });

    tradingBot.on('end', () => {
        process.send({ 
            type: 'log', 
            data: { 
                message: `Бот ${botName} отключился от сервера`, 
                type: 'warning' 
            } 
        });
        
        if (index + 1 < config.botNicknames.length) {
            createTradingBot(index + 1);
        } else {
            process.send({ 
                type: 'log', 
                data: { 
                    message: "Все боты завершили работу, перезапуск цикла", 
                    type: 'success' 
                } 
            });
            createTradingBot(0);
        }
    });
}

async function performNewFunction(tradingBot, index) {
    tradingBot.chat('/ah');

    tradingBot.once('windowOpen', async (window) => {
        try {
            const clickSequence = [
                { slot: 45, delay: 4000 },
                { slot: 0, delay: 6000 },
                { slot: 0, delay: 9000 },
                { slot: 0, delay: 12000 },
                { slot: 0, delay: 15000 },
                { slot: 0, delay: 18000 }
            ];

            for (const click of clickSequence) {
                setTimeout(async () => {
                    try {
                        await tradingBot.clickWindow(click.slot, 0, 0);
                    } catch (err) {
                        process.send({ 
                            type: 'log', 
                            data: { 
                                message: `Ошибка при нажатии на слот ${click.slot}: ${err.message}`, 
                                type: 'error' 
                            } 
                        });
                    }
                }, click.delay);
            }

            setTimeout(async () => {
                try {
                    await tradingBot.closeWindow();
                } catch (err) {
                    process.send({ 
                        type: 'log', 
                        data: { 
                            message: `Ошибка при закрытии окна: ${err.message}`, 
                            type: 'error' 
                        } 
                    });
                }
                autoSellItems(tradingBot, index);
            }, 21000);
        } catch (err) {
            process.send({ 
                type: 'log', 
                data: { 
                    message: `Произошла ошибка: ${err.message}`, 
                    type: 'error' 
                } 
            });
        }
    });
}

async function autoSellItems(tradingBot, index) {
    for (const itemToSell of config.itemsToSell) {
        const items = tradingBot.inventory.items();
        const itemsToSell = items.filter(item => 
            item.name.includes(itemToSell.name) && 
            item.count >= itemToSell.quantity
        );

        if (itemsToSell.length > 0 && canSellItems) {
            let successfullySold = false;

            for (const item of itemsToSell) {
                await tradingBot.equip(item, 'hand');
                tradingBot.chat(`/ah sell ${itemToSell.price} all`);
                
                process.send({ 
                    type: 'log', 
                    data: { 
                        message: `Выставлено на продажу ${item.displayName} x${itemToSell.quantity} за ${itemToSell.price}`, 
                        type: 'success' 
                    } 
                });

                await sleep(1500);

                if (tradingBot.heldItem && tradingBot.heldItem.type === item.type) {
                    process.send({ 
                        type: 'log', 
                        data: { 
                            message: "Место на аукционе закончилось, переход к следующему боту", 
                            type: 'warning' 
                        } 
                    });
                    canSellItems = false;
                    successfullySold = true;
                    break;
                }

                await sleep(500);
            }

            if (successfullySold) break;
        }
    }

    if (canSellItems) {
        await takeItemsFromChest(tradingBot, index);
    } else {
        process.send({ 
            type: 'log', 
            data: { 
                message: "Больше нельзя выставлять предметы на продажу", 
                type: 'warning' 
            } 
        });
        canSellItems = true;
        tradingBot.quit();
    }
}

async function takeItemsFromChest(tradingBot, index) {
    tradingBot.setControlState('jump', true);
    setTimeout(() => {
        tradingBot.setControlState('jump', false);
    }, 100);

    await sleep(3000);

    const chestToOpen = tradingBot.findBlock({
        matching: block => block.name.includes('chest'),
        maxDistance: 10
    });

    if (chestToOpen) {
        await tradingBot.pathfinder.goto(new GoalNear(
            chestToOpen.position.x, 
            chestToOpen.position.y, 
            chestToOpen.position.z, 
            1
        ));
        
        const chest = await tradingBot.openContainer(chestToOpen);

        for (const itemToSell of config.itemsToSell) {
            const item = chest.containerItems().find(
                item => item.name.includes(itemToSell.name) && 
                item.count >= itemToSell.quantity
            );
            
            if (item) {
                await chest.withdraw(item.type, null, itemToSell.quantity);
                process.send({ 
                    type: 'log', 
                    data: { 
                        message: `Взяты ${itemToSell.quantity} ${itemToSell.name} из сундука`, 
                        type: 'success' 
                    } 
                });
                chest.close();
                autoSellItems(tradingBot, index);
                return;
            }
        }

        process.send({ 
            type: 'log', 
            data: { 
                message: `Не удалось найти предметы из списка в сундуке у ${config.botNicknames[index]}`, 
                type: 'warning' 
            } 
        });
        chest.close();
        tradingBot.quit();
    } else {
        process.send({ 
            type: 'log', 
            data: { 
                message: `Не удалось найти сундук для ${config.botNicknames[index]}`, 
                type: 'warning' 
            } 
        });
        tradingBot.quit();
    }
}

// Запуск первого бота при старте
if (config.botNicknames && config.botNicknames.length > 0) {
    createTradingBot(0);
} else {
    process.send({ 
        type: 'log', 
        data: { 
            message: 'Нет настроенных ботов в конфигурации', 
            type: 'error' 
        } 
    });
}

// Обработка сигналов завершения
process.on('SIGTERM', () => {
    process.send({ 
        type: 'log', 
        data: { 
            message: 'Процесс бота завершается...', 
            type: 'warning' 
        } 
    });
    process.exit(0);
}); 