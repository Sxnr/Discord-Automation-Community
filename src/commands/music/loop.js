const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getPlayer, checkDJ, sameChannel } = require('../../music/player');
const { QueueRepeatMode } = require('discord-player');

const MODES = {
    off:      { id: QueueRepeatMode.OFF,      label: '❌ Loop desactivado',    color: 0xED4245 },
    track:    { id: QueueRepeatMode.TRACK,    label: '🔂 Repitiendo canción',   color: 0x1DB954 },
    queue:    { id: QueueRepeatMode.QUEUE,    label: '🔁 Repitiendo cola',      color: 0x5865F2 },
    autoplay: { id: QueueRepeatMode.AUTOPLAY, label: '🔀 Autoplay activado',    color: 0xFEE75C },
};

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('🔁 Cambia el modo de repetición de la cola.')
        .addStringOption(o => o
            .setName('modo')
            .setDescription('Modo de loop')
            .setRequired(true)
            .addChoices(
                { name: '❌ Desactivado',     value: 'off'      },
                { name: '🔂 Repetir canción', value: 'track'    },
                { name: '🔁 Repetir cola',    value: 'queue'    },
                { name: '🔀 Autoplay',        value: 'autoplay' },
            )
        ),

    async execute(interaction) {
        const queue = getPlayer()?.nodes.get(interaction.guild.id);
        if (!queue?.isPlaying())
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ No hay música reproduciéndose.' }], flags: MessageFlags.Ephemeral });
        if (!checkDJ(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Necesitas el rol **DJ** para usar este comando.' }], flags: MessageFlags.Ephemeral });
        if (!sameChannel(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Debes estar en el mismo canal de voz que el bot.' }], flags: MessageFlags.Ephemeral });

        const mode = MODES[interaction.options.getString('modo')];
        queue.setRepeatMode(mode.id);

        return interaction.reply({ embeds: [{ color: mode.color, description: `${mode.label}` }] });
    },
};
