const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getPlayer, checkDJ, sameChannel } = require('../../music/player');

function parseTime(input) {
    // Acepta "1:30", "90" (segundos) o "90s"
    if (/^\d+$/.test(input)) return parseInt(input, 10) * 1000;
    const m = input.match(/^(\d+):(\d{1,2})$/);
    if (m) return (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) * 1000;
    const s = input.match(/^(\d+)\s*s$/);
    if (s) return parseInt(s[1], 10) * 1000;
    return NaN;
}

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('⏩ Salta a un punto de la canción actual.')
        .addStringOption(o => o
            .setName('tiempo')
            .setDescription('Tiempo destino, ej. 1:30 o 90 (segundos)')
            .setRequired(true)
        ),

    async execute(interaction) {
        const queue = getPlayer()?.nodes.get(interaction.guild.id);
        if (!queue?.isPlaying())
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ No hay música reproduciéndose.' }], flags: MessageFlags.Ephemeral });
        if (!checkDJ(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Necesitas el rol **DJ** para usar este comando.' }], flags: MessageFlags.Ephemeral });
        if (!sameChannel(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Debes estar en el mismo canal de voz que el bot.' }], flags: MessageFlags.Ephemeral });

        const ms = parseTime(interaction.options.getString('tiempo'));
        if (isNaN(ms) || ms < 0)
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Formato inválido. Usa `1:30` o `90` (segundos).' }], flags: MessageFlags.Ephemeral });

        const duration = queue.currentTrack?.durationMS ?? 0;
        if (duration && ms > duration)
            return interaction.reply({ embeds: [{ color: 0xED4245, description: `❌ Esa canción dura solo \`${queue.currentTrack?.duration}\`.` }], flags: MessageFlags.Ephemeral });

        try {
            await queue.node.seek(ms);
        } catch (e) {
            return interaction.reply({ embeds: [{ color: 0xED4245, description: `❌ No se pudo hacer seek: \`${e.message}\`` }], flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setColor(0x1DB954)
            .setTitle('⏩ Seek')
            .setDescription(`▶️ Saltamos a \`${interaction.options.getString('tiempo')}\` en **${queue.currentTrack?.title}**.`);

        return interaction.reply({ embeds: [embed] });
    },
};
