const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        // 1. Reporte Técnico de Inicialización en Consola
        const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const totalGuilds = client.guilds.cache.size;

        console.log(`\n=================================================`);
        console.log(`🚀 SISTEMA GLOBAL ONLINE`);
        console.log(`=================================================`);
        console.log(`🤖 Identidad: ${client.user.tag}`);
        console.log(`🛡️ Servidores: ${totalGuilds.toLocaleString()}`);
        console.log(`👥 Usuarios Totales: ${totalUsers.toLocaleString()}`);
        console.log(`📡 Latencia API: ${client.ws.ping}ms`);
        console.log(`🗄️ Base de Datos: Sincronizada (SQLite3)`);
        console.log(`=================================================\n`);

        // 2. Sistema de Actividad Dinámica (Rotación cada 15 segundos)
        const activities = [
            { name: `${totalGuilds} servidores 🛡️`, type: ActivityType.Watching },
            { name: `/help para asistencia 📂`, type: ActivityType.Listening },
            { name: `${totalUsers} usuarios activos ✨`, type: ActivityType.Watching },
            { name: `Soporte Técnico Profesional 🎫`, type: ActivityType.Playing }
        ];

        let i = 0;
        setInterval(() => {
            const activity = activities[i];
            client.user.setPresence({
                activities: [activity],
                status: 'online',
            });
            
            // Incrementamos o reiniciamos el índice
            i = (i + 1) % activities.length;
        }, 15000); // Cambio cada 15 segundos
    }
};