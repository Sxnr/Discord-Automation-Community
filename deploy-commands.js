const { REST, Routes } = require('discord.js');
const { clientId, token } = require('./src/config'); // ➕ guildId ya no es necesario aquí
const fs   = require('fs');
const path = require('path');

// Reordena recursivamente las opciones para que las requeridas
// siempre estén antes que las opcionales (requisito de la API de Discord).
// Evita el error 50035 sin tener que editar cada comando manualmente.
function orderRequiredFirst(options) {
    if (!Array.isArray(options)) return options;
    const sorted = [...options].sort(
        (a, b) => (a.required ? 0 : 1) - (b.required ? 0 : 1)
    );
    return sorted.map(o => (o.options ? { ...o, options: orderRequiredFirst(o.options) } : o));
}

const commands = [];
const foldersPath    = path.join(__dirname, 'src/commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command  = require(filePath);

        if ('data' in command && 'execute' in command) {
            const json = command.data.toJSON();
            json.options = orderRequiredFirst(json.options);
            commands.push(json);
        } else {
            console.warn(`⚠️  El archivo ${file} no tiene 'data' o 'execute'.`);
        }
    }
}

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(`⏳ Desplegando ${commands.length} comandos de forma GLOBAL...`);

        const data = await rest.put(
            Routes.applicationCommands(clientId), // ✅ Global: todos los servidores
            { body: commands }
        );

        console.log(`✅ ¡Éxito! ${data.length} comandos registrados globalmente.`);
        console.log(`⏰ Pueden tardar hasta 1 hora en aparecer en servidores nuevos.`);

    } catch (error) {
        console.error('❌ Error al desplegar comandos:', error);
    }
})();