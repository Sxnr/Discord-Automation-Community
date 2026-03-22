const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`-----------------------------------------`);
        console.log(`Logueado como: ${client.user.tag}`);
        console.log(`Estado: Operacional`);
        console.log(`Servidores: ${client.guilds.cache.size}`);
        console.log(`-----------------------------------------`);

        // Actividad dinamica
        client.user.setActivity(`Gestionando Comunidad`, { type: ActivityType.Watching });
    }
}