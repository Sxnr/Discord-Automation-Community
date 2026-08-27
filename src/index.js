const { 
    Client, 
    GatewayIntentBits, 
    Collection, 
    Partials 
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config.js');
const { checkEnv } = require('./utils/checkEnv');

// Defensa: nunca dejamos que un rejection suelto crashee el proceso.
process.on('unhandledRejection', (reason) => {
    const code = reason?.code || (reason && reason.error?.code);
    // 10062 (interacción expirada) y 40060 (ya respondida) son ruido esperado en ejecuciones duplicadas.
    if (code === 10062 || code === 40060) return;
    console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
    const code = err?.code;
    if (code === 10062 || code === 40060) return;
    console.error('[uncaughtException]', err);
});

// discord.js re-emite como 'error' del Client las promesas no capturadas de
// interacciones (p.ej. 10062/40060 en ejecuciones duplicadas). Lo absorbemos.
client.on('error', (err) => {
    const code = err?.code;
    if (code === 10062 || code === 40060) return;
    console.error('[client.error]', code || '', err?.message || err);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();

// --- HANDLER DE COMANDOS ---
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);

            if ('data' in command && 'execute' in command) {
                command.category = folder;
                client.commands.set(command.data.name, command);
            }
        }
    }
}

// --- HANDLER DE EVENTOS ---
const eventsPath = path.join(__dirname, 'events');

if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const eventModule = require(filePath);

        const events = Array.isArray(eventModule) ? eventModule : [eventModule];

        for (const event of events) {
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
        }
    }
}

// Chequeo de keys/APIs al arranque (no bloquea si faltan opcionales)
checkEnv();

client.login(config.token);