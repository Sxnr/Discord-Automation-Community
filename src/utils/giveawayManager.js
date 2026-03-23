const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

/**
 * Este gestor verifica periódicamente la base de datos para finalizar sorteos
 */
async function checkGiveaways(client) {
    const now = Date.now();
    
    // Obtenemos sorteos que ya deberían haber terminado y no están marcados como finalizados
    const pending = db.prepare('SELECT * FROM giveaways WHERE ended = 0 AND end_time <= ?').all(now);

    for (const giveaway of pending) {
        try {
            const guild = client.guilds.cache.get(giveaway.guild_id);
            if (!guild) continue;

            const channel = guild.channels.cache.get(giveaway.channel_id);
            if (!channel) continue;

            const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
            
            const participants = JSON.parse(giveaway.participants);
            let winners = [];

            if (participants.length > 0) {
                // Algoritmo de selección aleatoria (Fisher-Yates simplificado para picking)
                const shuffled = participants.sort(() => 0.5 - Math.random());
                winners = shuffled.slice(0, giveaway.winner_count);
            }

            // Marcar como finalizado en la DB inmediatamente para evitar doble ejecución
            db.prepare('UPDATE giveaways SET ended = 1 WHERE message_id = ?').run(giveaway.message_id);

            const endEmbed = new EmbedBuilder()
                .setTitle(`🎊 SORTEO FINALIZADO 🎊`)
                .setColor('#E74C3C')
                .setDescription(`>>> **Premio:** ${giveaway.prize}\n\n🏆 **Ganadores:**\n${winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'Nadie participó 😢'}`)
                .setFooter({ text: 'Gracias por participar' })
                .setTimestamp();

            if (message) {
                await message.edit({ embeds: [endEmbed], components: [] });
                if (winners.length > 0) {
                    await channel.send({ content: `🎊 ¡Felicidades ${winners.map(id => `<@${id}>`).join(', ')}! Han ganado **${giveaway.prize}**.` });
                }
            }
        } catch (error) {
            console.error(`Error procesando sorteo ${giveaway.message_id}:`, error);
        }
    }
}

module.exports = { checkGiveaways };