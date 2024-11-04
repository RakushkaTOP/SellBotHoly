const mineflayer = require('mineflayer');
const { pathfinder, goals: { GoalNear } } = require('mineflayer-pathfinder');

const botNicknames = [
    'HIKIgiv', 'Frecoka', 'hikigiy', 'jokolight', "sosogihys",
];

let itemsToSell = [
    { name: 'stone', quantity: 64, price: 2000 },
    { name: 'spruce_log', quantity: 64, price: 4000 },
    { name: 'iron_ore', quantity: 32, price: 4000 },
    { name: 'sugar_cane', quantity: 64, price: 4000 },
    { name: 'dirt', quantity: 64, price: 1200 },
    { name: 'dark_oak_log', quantity: 64, price: 4000 },
];
let canSellItems = true;

// Функция для создания торгового бота
function createTradingBot(index) {
    const botName = botNicknames[index];

    const tradingBot = mineflayer.createBot({
        host: 'hub.holyworld.ru',
        port: 25565,
        username: botName,
        version: '1.19.4'
    });

    tradingBot.loadPlugin(pathfinder);

    tradingBot.once('spawn', () => {
        tradingBot.chat('/anarchy');
        
        tradingBot.on('windowOpen', async (window) => {
            try {
                console.log('Открыто окно:', window.title);

                // Нажмите на слот 15 через 5 секунд после открытия окна
                setTimeout(async () => {
                    try {
                        await tradingBot.clickWindow(25, 0, 0);
                    } catch (err) {
                        // Проверяем, является ли ошибка ошибкой при нажатии на слот 15
                        if (err.message.includes("Server didn't respond to transaction for clicking on slot 13")) {
                            // Если да, то игнорируем эту ошибку
                            return;
                        }
                        console.error('Ошибка при нажатии на слот 15:', err);
                    }
                }, 5000);
            } catch (err) {
                console.error('Произошла ошибка:', err);
            }
        });

        setTimeout(() => {
            console.log(`${botName} зашел на сервер.`);
            tradingBot.chat('/pay MrVupsin all'); // Команда перед выходом
            performNewFunction(tradingBot, index);
        }, 13000);
    });

    tradingBot.on('message', (message) => {
        console.log(message.toString());
    });

    tradingBot.on('error', (err) => {
        console.error('Ошибка:', err);
    });

    tradingBot.on('end', () => {
        console.log(`${botName} отключился от сервера.`);
        if (index + 1 < botNicknames.length) {
            createTradingBot(index + 1);
        } else {
            console.log("Все боты успешно продали предметы.");
            createTradingBot(0);
//            setTimeout(() => {
//                console.log("Перезапуск процесса продажи предметов.");
//                createTradingBot(0);
//            }, 5 * 60 * 1000); // 5 минут в миллисекундах
        }
    });
}

// Новая функция для выполнения последовательности действий
async function performNewFunction(tradingBot, index) {
    tradingBot.chat('/ah');

    tradingBot.once('windowOpen', async (window) => {
        try {
            console.log('Открыто окно:', window.title);

            // Нажмите на слот 45 через 4 секунды после открытия окна
            setTimeout(async () => {
                try {
                    await tradingBot.clickWindow(45, 0, 0);
                } catch (err) {
                    console.error('Ошибка при нажатии на слот 45:', err);
                }
            }, 4000);

            // Нажмите на слот 0 через 2 секунды после нажатия на слот 45
            setTimeout(async () => {
                try {
                    await tradingBot.clickWindow(0, 0, 0);
                } catch (err) {
                    console.error('Ошибка при нажатии на слот 0:', err);
                }
            }, 6000);

            // Нажмите на слот 0 через 3 секунды после предыдущего нажатия
            setTimeout(async () => {
                try {
                    await tradingBot.clickWindow(0, 0, 0);
                } catch (err) {
                    console.error('Ошибка при нажатии на слот 0:', err);
                }
            }, 9000);

            // Нажмите на слот 0 через 3 секунды после предыдущего нажатия
            setTimeout(async () => {
                try {
                    await tradingBot.clickWindow(0, 0, 0);
                } catch (err) {
                    console.error('Ошибка при нажатии на слот 0:', err);
                }
            }, 12000);

            // Нажмите на слот 0 через 3 секунды после предыдущего нажатия
            setTimeout(async () => {
                try {
                    await tradingBot.clickWindow(0, 0, 0);
                } catch (err) {
                    console.error('Ошибка при нажатии на слот 0:', err);
                }
            }, 15000);

            // Нажмите на слот 0 через 3 секунды после предыдущего нажатия
            setTimeout(async () => {
                try {
                    await tradingBot.clickWindow(0, 0, 0);
                } catch (err) {
                    console.error('Ошибка при нажатии на слот 0:', err);
                }
            }, 18000);

            // Закрыть окно и запустить autoSellItems через 3 секунды после последнего нажатия
            setTimeout(async () => {
                try {
                    await tradingBot.closeWindow();
                } catch (err) {
                    console.error('Ошибка при закрытии окна:', err);
                }
                autoSellItems(tradingBot, index);
            }, 21000);
        } catch (err) {
            console.error('Произошла ошибка:', err);
        }
    });
}

// Функция для продажи предметов
async function autoSellItems(tradingBot, index) {
    for (const itemToSell of itemsToSell) {
        const items = tradingBot.inventory.items();
        const itemsToSell = items.filter(item => item.name.includes(itemToSell.name) && item.count >= itemToSell.quantity);

        if (itemsToSell.length > 0 && canSellItems) {
            let successfullySold = false;

            for (const item of itemsToSell) {
                await tradingBot.equip(item, 'hand');
                tradingBot.chat(`/ah sell ${itemToSell.price} all`);
                console.log(`Выставлено на продажу ${item.displayName} x${itemToSell.quantity} за ${itemToSell.price}.`);

                await sleep(1500);

                if (tradingBot.heldItem && tradingBot.heldItem.type === item.type) {
                    console.log("Место на аукционе закончилось, переход к следующему боту.");
                    canSellItems = false;
                    successfullySold = true;
                    break;
                }

                await sleep(500);
            }

            if (successfullySold) {
                break;
            }
        }
    }

    if (canSellItems) {
        await takeItemsFromChest(tradingBot, index);
    } else {
        console.log("Больше нельзя выставлять предметы на продажу.");
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
        await tradingBot.pathfinder.goto(new GoalNear(chestToOpen.position.x, chestToOpen.position.y, chestToOpen.position.z, 1));
        const chest = await tradingBot.openContainer(chestToOpen);

        for (const itemToSell of itemsToSell) {
            const item = chest.containerItems().find(item => item.name.includes(itemToSell.name) && item.count >= itemToSell.quantity);
            if (item) {
                await chest.withdraw(item.type, null, itemToSell.quantity);
                console.log(`Взяты ${itemToSell.quantity} ${itemToSell.name} из сундука.`);
                chest.close();
                autoSellItems(tradingBot, index);
                return;
            }
        }

        console.log(`Не удалось найти предметы из списка в сундуке у ${botNicknames[index]}.`);
        chest.close();
        tradingBot.quit();
    } else {
        console.log(`Не удалось найти сундук для ${botNicknames[index]}.`);
        tradingBot.quit();
    }
}

// Вспомогательная функция для создания паузы
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Запуск первого бота
createTradingBot(0);