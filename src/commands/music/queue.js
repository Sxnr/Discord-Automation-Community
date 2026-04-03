const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getPlayer } = require('../../music/player');

const PAGE_SIZE = 10;

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('📋 Muestra la cola de reproducción.')
        .addIntegerOption(o => o.setName('pagina').setDescription('Página a mostrar').setMinValue(1)),

    async execute(interaction) {
        const queue = getPlayer()?.nodes.get(interaction.guild.id);

        if (!queue?.isPlaying()) {
            return interaction.reply({
                embeds: [{ color: 0xED4245, description: '❌ No hay música reproduciéndose en este momento.' }],
                flags: MessageFlags.Ephemeral,
            });
        }

        const tracks  = queue.tracks.toArray();
        const current = queue.currentTrack;
        const total   = tracks.length;
        const pages   = Math.max(1, Math.ceil(total / PAGE_SIZE));
        let   page    = Math.min((interaction.options.getInteger('pagina') ?? 1) - 1, pages - 1);

        const buildEmbed = (p) => {
            const slice = tracks.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);
            const list  = slice.length
                ? slice.map((t, i) =>
                    `\`${p * PAGE_SIZE + i + 1}.\` **[${t.title}](${t.url})** \`${t.duration}\` — <@${t.requestedBy?.id ?? '0'}>`
                  ).join('\n')
                : '*No hay más canciones.*';

            const totalMs  = tracks.reduce((a, t) => a + (t.durationMS ?? 0), 0);
            const durStr   = totalMs > 3600000
                ? `${Math.floor(totalMs / 3600000)}h ${Math.floor((totalMs % 3600000) / 60000)}m`
                : `${Math.floor(totalMs / 60000)}m`;

            return new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`📋 Cola — ${interaction.guild.name}`)
                .setDescription(
                    `**▶️ Ahora:**\n[${current.title}](${current.url}) \`${current.duration}\` — <@${current.requestedBy?.id ?? '0'}>\n\n` +
                    (total ? `**Siguiente (${total}):**\n${list}` : '*Cola vacía después de esta canción.*')
                )
                .setFooter({ text: `Página ${p + 1}/${pages} • ${total} canciones • Duración total: ${durStr}` });
        };

        const buildRow = (p) => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`q_prev_${interaction.id}`).setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
            new ButtonBuilder().setCustomId(`q_next_${interaction.id}`).setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(p >= pages - 1),
        );

        const msg = await interaction.reply({
            embeds: [buildEmbed(page)],
            components: pages > 1 ? [buildRow(page)] : [],
            fetchReply: true,
        });

        if (pages <= 1) return;

        const col = msg.createMessageComponentCollector({ time: 90_000 });
        col.on('collect', async btn => {
            if (btn.user.id !== interaction.user.id)
                return btn.reply({ content: '⛔ Solo el autor puede navegar.', ephemeral: true });
            if (btn.customId === `q_prev_${interaction.id}`) page = Math.max(0, page - 1);
            else page = Math.min(pages - 1, page + 1);
            await btn.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
        });
        col.on('end', () => msg.edit({ components: [] }).catch(() => {}));
    },
};
