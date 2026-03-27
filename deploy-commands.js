const { REST, Routes } = require('discord.js');
const { clientId, token } = require('./src/config'); // ➕ guildId ya no es necesario aquí
const fs   = require('fs');
const path = require('path');

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
            commands.push(command.data.toJSON());
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