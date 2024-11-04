const mf = require('mineflayer')
const { mapDownloader } = require('mineflayer-item-map-downloader')
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

// Очищаем папку captcha_maps при запуске
const captchaMapsDir = './captcha_maps'
if (fs.existsSync(captchaMapsDir)) {
    fs.readdirSync(captchaMapsDir).forEach(file => {
        fs.unlinkSync(path.join(captchaMapsDir, file))
    })
} else {
    fs.mkdirSync(captchaMapsDir)
}

async function combineMaps() {
    try {
        const mapOrder = [
            11, 10, 9, 8,
            7, 6, 5, 4,
            3, 2, 1, 0
        ]

        const finalImage = await sharp({
            create: {
                width: 128 * 4,
                height: 128 * 3,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        })

        const compositeOperations = []

        for (let i = 0; i < mapOrder.length; i++) {
            const mapNum = mapOrder[i].toString().padStart(6, '0')
            const mapPath = `./captcha_maps/map_${mapNum}.png`
            
            if (!fs.existsSync(mapPath)) {
                throw new Error(`Файл не найден: ${mapPath}`)
            }

            const x = (i % 4) * 128
            const y = Math.floor(i / 4) * 128

            compositeOperations.push({
                input: mapPath,
                left: x,
                top: y
            })
        }

        await finalImage
            .composite(compositeOperations)
            .toFile('./captcha_maps/combined_captcha.png')

        console.log('Изображение капчи создано: combined_captcha.png')
        bot.quit()

    } catch (err) {
        console.error('Ошибка при объединении карт:', err)
        bot.quit()
    }
}

// Функция проверки наличия всех карт
function checkMaps() {
    const files = fs.readdirSync(captchaMapsDir)
    const pngFiles = files.filter(file => 
        file.startsWith('map_') && 
        file.endsWith('.png') && 
        !file.includes('combined')
    )

    console.log(`Найдено ${pngFiles.length} карт из 12`)
    
    if (pngFiles.length === 12) {
        console.log('Все карты получены, начинаем объединение...')
        combineMaps()
        return true
    }
    return false
}

const bot = mf.createBot({
    host: 'hub.holyworld.ru',
    port: 25565,
    username: 'gghusnmde',
    version: '1.19.4',
    "mapDownloader-outputDir": './captcha_maps'
})

bot.loadPlugin(mapDownloader)

bot.once('login', () => {
    console.log('Бот зашел на сервер')
})

// Проверяем наличие карт каждую секунду
const checkInterval = setInterval(() => {
    if (checkMaps()) {
        clearInterval(checkInterval)
    }
}, 1000)

bot.on('error', err => console.error('Ошибка:', err))
bot.on('kicked', reason => console.log('Кикнут:', reason))

console.log('Бот запускается...')