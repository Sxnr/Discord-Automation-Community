const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const fs   = require('node:fs');
const path = require('node:path');
const config = require('./config.js');
const birthdayChecker = require('./events/birthdayChecker');
client.once(birthdayChecker.name, (...args) => birthdayChecker.execute(...args));
const reminderLoader = require('./events/reminderLoader');
client.once(reminderLoader.name, (...args) => reminderLoader.execute(...args));

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
        const folderPath   = path.join(commandsPath, folder);
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        // ➕ Loop unificado: carga Y categoría en uno solo
        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const command  = require(filePath);

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
        const filePath    = path.join(eventsPath, file);
        const eventModule = require(filePath);

        // ➕ Soporte para array de eventos (auditLogs.js) y objeto simple
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

client.login(config.token);