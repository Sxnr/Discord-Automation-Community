const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getPlayer, registerSkipVote } = require('../music/player');

function musicControlRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setLabel('Pausar').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_resume').setEmoji('▶️').setLabel('Reanudar').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel('Saltar').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('music_voteskip').setEmoji('🗳️').setLabel('Votar skip').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel('Detener').setStyle(ButtonStyle.Danger),
    );
}

module.exports = async (interaction) => {
    if (!interaction.isButton()) return false;
    const ids = ['music_pause', 'music_resume', 'music_skip', 'music_voteskip', 'music_stop'];
    if (!ids.includes(interaction.customId)) return false;

    const queue = getPlayer()?.nodes.get(interaction.guildId);
    if (!queue || !queue.isPlaying()) {
        await interaction.reply({ content: '❌ No hay música activa en este servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    // Responde de forma segura: si la interacción ya fue gestionada por otra
    // instancia (ejecución duplicada), el reply falla y lo ignoramos.
    const ack = (content) => interaction.reply({ content, flags: [MessageFlags.Ephemeral] }).catch(() => {});

    try {
        if (interaction.customId === 'music_pause') {
            queue.node.pause();
            await ack('⏸️ Música pausada.');
        } else if (interaction.customId === 'music_resume') {
            queue.node.resume();
            await ack('▶️ Música reanudada.');
        } else if (interaction.customId === 'music_skip') {
            await queue.node.skip();
            await ack('⏭️ Saltando a la siguiente canción...');
        } else if (interaction.customId === 'music_voteskip') {
            const voiceChannel = queue.voiceChannel;
            if (!voiceChannel?.members.has(interaction.user.id)) {
                return ack('🗳️ Debes estar en el canal de voz para votar.');
            }
            const members = voiceChannel.members.filter(m => !m.user.bot).size;
            const { votes, needed, reached } = registerSkipVote(interaction.guildId, interaction.user.id, members);
            if (reached) {
                await queue.node.skip();
                await ack('🗳️ Voto alcanzado. Saltando canción...');
            } else {
                await ack(`🗳️ Votos: ${votes}/${needed} (faltan ${needed - votes}).`);
            }
        } else if (interaction.customId === 'music_stop') {
            await queue.node.stop();
            await ack('⏹️ Música detenida.');
        }
    } catch (e) {
        await ack(`❌ ${e.message}`);
    }
    return true;
};

module.exports.musicControlRow = musicControlRow;
