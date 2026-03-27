const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const fs   = require('node:fs');
const path = require('node:path');
const config = require('./config.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        // ➕ Necesarios para auditLogs.js
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildPresences
    ]
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

// --- GIVEAWAY MANAGER ---
// ➕ Se inicia después del ready para que el client esté listo
const { checkGiveaways, updateParticipantCounts } = require('./utils/giveawayManager');

client.once('ready', () => {
    // Verificar sorteos expirados cada 10 segundos
    setInterval(() => checkGiveaways(client), 10000);
    // Actualizar contador de participantes en embeds cada 60 segundos
    setInterval(() => updateParticipantCounts(client), 60000);

    // --- STATUS ROTATIVO ---
    // FIX: Lee datos en VIVO en cada rotación para que los números sean siempre correctos
    const getStatuses = () => {
        const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const guildCount   = client.guilds.cache.size;
        const cmdCount     = client.commands.size;

        return [
            { text: `${guildCount} servidor${guildCount !== 1 ? 'es' : ''}`,  type: ActivityType.Watching  },
            { text: `${totalMembers} miembro${totalMembers !== 1 ? 's' : ''}`, type: ActivityType.Watching  },
            { text: `${cmdCount} comandos disponibles`,                         type: ActivityType.Listening },
            { text: '/help para empezar',                                       type: ActivityType.Playing   },
            { text: 'Gestionando la comunidad',                                 type: ActivityType.Watching  },
        ];
    };

    let statusIndex = 0;

    const rotateStatus = () => {
        const statuses = getStatuses(); // Siempre datos frescos
        const current  = statuses[statusIndex % statuses.length];
        client.user.setActivity(current.text, { type: current.type });
        statusIndex++;
    };

    rotateStatus(); // Ejecutar inmediatamente al arrancar
    setInterval(rotateStatus, 15000); // Rotar cada 15 segundos
});

client.login(config.token);