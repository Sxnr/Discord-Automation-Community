const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getPlayer, checkDJ, sameChannel } = require('../../music/player');

const FILTERS = [
    { name: 'bassboost',       label: '🔊 Bass Boost' },
    { name: 'bassboost_low',  label: '🔉 Bass Boost (suave)' },
    { name: 'bassboost_high', label: '🔊 Bass Boost (fuerte)' },
    { name: '8D',             label: '🌀 8D' },
    { name: 'nightcore',      label: '⚡ Nightcore' },
    { name: 'vaporwave',      label: '🌊 Vaporwave' },
    { name: 'treble',         label: '🎚️ Treble' },
    { name: 'reverb',         label: '🏛️ Reverb' },
    { name: 'chorus',         label: '🎶 Chorus' },
    { name: 'compressor',     label: '🗜️ Compressor' },
    { name: 'lofi',           label: '😌 Lo-Fi' },
    { name: 'earrape',        label: '📢 Earrape' },
];

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('filters')
        .setDescription('🎚️ Activa/desactiva filtros de audio (bass boost, nightcore, 8D...).')
        .addStringOption(o => o
            .setName('filtro')
            .setDescription('Filtro a cambiar')
            .setRequired(true)
            .addChoices(...FILTERS.map(f => ({ name: f.label, value: f.name })))
        )
        .addStringOption(o => o
            .setName('accion')
            .setDescription('Activar o desactivar (por defecto: alternar)')
            .setRequired(false)
            .addChoices(
                { name: '✅ Activar',    value: 'on' },
                { name: '❌ Desactivar', value: 'off' },
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

        const name   = interaction.options.getString('filtro');
        const action = interaction.options.getString('accion');
        const active = queue.filters.filters.includes(name);

        let enabled;
        try {
            if (action === 'on')       { await queue.filters.add(name);    enabled = true; }
            else if (action === 'off') { await queue.filters.remove(name); enabled = false; }
            else                        { enabled = await queue.filters.toggle(name); }
        } catch (e) {
            return interaction.reply({ embeds: [{ color: 0xED4245, description: `❌ No se pudo aplicar el filtro: \`${e.message}\`` }], flags: MessageFlags.Ephemeral });
        }

        const label = FILTERS.find(f => f.name === name)?.label ?? name;
        const enabledList = queue.filters.filters.length
            ? queue.filters.filters.map(f => FILTERS.find(x => x.name === f)?.label ?? f).join(', ')
            : 'ninguno';

        const embed = new EmbedBuilder()
            .setColor(enabled ? 0x1DB954 : 0xED4245)
            .setTitle('🎚️ Filtros de audio')
            .setDescription(`${enabled ? '✅ Activado' : '❌ Desactivado'}: **${label}**`)
            .addFields({ name: '🎛️ Activos ahora', value: enabledList })
            .setFooter({ text: 'Los filtros requieren FFmpeg funcional en el host.' });

        return interaction.reply({ embeds: [embed] });
    },
};
