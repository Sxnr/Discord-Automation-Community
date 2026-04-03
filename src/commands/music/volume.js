const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getPlayer, checkDJ, sameChannel } = require('../../music/player');
const db = require('../../database/db');

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('🔊 Ajusta el volumen de la música.')
        .addIntegerOption(o => o
            .setName('nivel')
            .setDescription('Volumen del 1 al 100')
            .setMinValue(1).setMaxValue(100).setRequired(true)
        ),

    async execute(interaction) {
        const queue = getPlayer()?.nodes.get(interaction.guild.id);
        if (!queue?.isPlaying())
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ No hay música reproduciéndose.' }], flags: MessageFlags.Ephemeral });
        if (!checkDJ(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Necesitas el rol **DJ** para usar este comando.' }], flags: MessageFlags.Ephemeral });
        if (!sameChannel(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Debes estar en el mismo canal de voz que el bot.' }], flags: MessageFlags.Ephemeral });

        const vol = interaction.options.getInteger('nivel');
        queue.node.setVolume(vol);

        // Persistir el volumen preferido del servidor
        db.prepare('UPDATE guild_settings SET music_volume = ? WHERE guild_id = ?').run(vol, interaction.guild.id);

        const emoji = vol === 0 ? '🔇' : vol < 30 ? '🔈' : vol < 70 ? '🔉' : '🔊';
        const bar = '█'.repeat(Math.round(vol / 5)) + '░'.repeat(20 - Math.round(vol / 5));

        return interaction.reply({ embeds: [{
            color: 0x5865F2,
            description: `${emoji} **Volumen ajustado a ${vol}%**\n\`${bar}\``,
        }]});
    },
};
