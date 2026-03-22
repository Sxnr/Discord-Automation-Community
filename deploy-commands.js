const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./src/config');
const fs = require('fs');
const path = require('path');

const commands = [];
const foldersPath = path.join(__dirname, 'src/commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        }
    }
}

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(`Cargando ${commands.length} comandos de barra (/).`);
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );
        console.log(`¡Éxito! Se registraron ${data.length} comandos.`);
    } catch (error) {
        console.error(error);
    }
})();