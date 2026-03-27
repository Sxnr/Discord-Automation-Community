const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

async function checkGiveaways(client) {
    const now     = Date.now();
    const pending = db.prepare('SELECT * FROM giveaways WHERE ended = 0 AND end_time <= ?').all(now);

    for (const giveaway of pending) {
        try {
            const guild = client.guilds.cache.get(giveaway.guild_id);
            if (!guild) continue;

            const channel = guild.channels.cache.get(giveaway.channel_id);
            if (!channel) continue;

            const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
            const participants = JSON.parse(giveaway.participants || '[]');

            let winners = [];
            if (participants.length > 0) {
                winners = [...participants].sort(() => 0.5 - Math.random()).slice(0, giveaway.winner_count);
            }

            // Marcar como finalizado ANTES de editar para evitar doble ejecución
            db.prepare('UPDATE giveaways SET ended = 1, winners = ? WHERE message_id = ?').run(JSON.stringify(winners), giveaway.message_id);

            const endEmbed = new EmbedBuilder()
                .setTitle('🎊 SORTEO FINALIZADO')
                .setColor('#E74C3C')
                .setDescription(
                    `>>> **Premio:** ${giveaway.prize}\n\n` +
                    `🏆 **${winners.length > 0 ? 'Ganadores' : 'Resultado'}:**\n` +
                    `${winners.length > 0 ? winners.map(id => `<@${id}>`).join('\n') : '*Nadie participó 😢*'}`
                )
                .addFields(
                    { name: '👥 Participantes', value: `\`${participants.length}\``, inline: true },
                    { name: '🏆 Ganadores',     value: `\`${winners.length}\``,      inline: true },
                    // ➕ Mostrar quién organizó el sorteo
                    { name: '👤 Organizado por', value: giveaway.host_id ? `<@${giveaway.host_id}>` : 'Desconocido', inline: true }
                )
                .setFooter({ text: 'Usa /giveaway reroll para elegir nuevos ganadores' })
                .setTimestamp();

            if (message) {
                await message.edit({ embeds: [endEmbed], components: [] });
            }

            if (winners.length > 0 && channel) {
                await channel.send({
                    content: `🎊 ¡Felicidades ${winners.map(id => `<@${id}>`).join(', ')}! Han ganado **${giveaway.prize}** 🎉`,
                    embeds: [new EmbedBuilder()
                        .setDescription(`> Usa \`/giveaway reroll\` con el ID \`${giveaway.message_id}\` si algún ganador no puede reclamar el premio.`)
                        .setColor('#F1C40F')
                    ]
                });
            }

        } catch (error) {
            console.error(`[Giveaway Manager] Error procesando sorteo ${giveaway.message_id}:`, error);
        }
    }
}

// ➕ Actualiza el contador de participantes en el embed cada cierto tiempo
async function updateParticipantCounts(client) {
    const active = db.prepare('SELECT * FROM giveaways WHERE ended = 0').all();

    for (const giveaway of active) {
        try {
            const guild = client.guilds.cache.get(giveaway.guild_id);
            if (!guild) continue;

            const channel = guild.channels.cache.get(giveaway.channel_id);
            if (!channel) continue;

            const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
            if (!message || !message.embeds[0]) continue;

            const participants = JSON.parse(giveaway.participants || '[]');
            const oldEmbed     = message.embeds[0];

            // Actualizar solo el campo de participantes para no reescribir todo el embed
            const updatedDescription = oldEmbed.description?.replace(
                /👥 \*\*Participantes:\*\* `\d+`/,
                `👥 **Participantes:** \`${participants.length}\``
            );

            if (updatedDescription && updatedDescription !== oldEmbed.description) {
                const updatedEmbed = EmbedBuilder.from(oldEmbed).setDescription(updatedDescription);
                await message.edit({ embeds: [updatedEmbed] }).catch(() => null);
            }

        } catch (error) {
            // Silencioso: no interrumpir el loop por un embed que no se pueda editar
        }
    }
}

module.exports = { checkGiveaways, updateParticipantCounts };