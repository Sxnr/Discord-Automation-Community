const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildProgressBar(up, down) {
    const total  = up + down;
    const upPct  = total > 0 ? Math.round((up / total) * 100) : 0;
    const bars   = 16;
    const filled = Math.round((upPct / 100) * bars);
    return '█'.repeat(filled) + '░'.repeat(bars - filled) + ` ${upPct}%`;
}

function buildEmbed(author, content, id, votesUp, votesDown, status = 'pending', reason = null, staffUser = null) {
    const statusMap = {
        pending:  { label: '⏳ Pendiente', color: '#FEE75C' },
        accepted: { label: '✅ Aceptada',  color: '#57F287' },
        denied:   { label: '❌ Rechazada', color: '#ED4245' }
    };
    const { label, color } = statusMap[status] ?? statusMap.pending;
    const total = votesUp.length + votesDown.length;

    const embed = new EmbedBuilder()
        .setTitle(`💡 Sugerencia #${id}`)
        .setColor(color)
        .setDescription(`>>> ${content}`)
        .setThumbnail(author?.displayAvatarURL({ dynamic: true }) ?? null)
        .addFields(
            { name: '👤 Autor',  value: author ? `${author}` : 'Desconocido', inline: true },
            { name: '📊 Estado', value: label,                                inline: true },
            { name: '\u200b',    value: '\u200b',                             inline: true },
            {
                name:  `✅ A favor \`${votesUp.length}\`  ·  ❌ En contra \`${votesDown.length}\`  ·  🗳️ Total \`${total}\``,
                value: `\`${buildProgressBar(votesUp.length, votesDown.length)}\``,
                inline: false
            }
        )
        .setFooter({ text: `ID: ${id}` })
        .setTimestamp();

    if (reason && staffUser) {
        embed.addFields({
            name:  status === 'accepted' ? '✅ Razón de aceptación' : '❌ Razón de rechazo',
            value: `> ${reason}\n> — ${staffUser.tag}`,
            inline: false
        });
    }

    return embed;
}

function buildVoteRow(id, upCount = 0, downCount = 0) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`suggest_up_${id}`)
            .setLabel(`${upCount}`)
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`suggest_down_${id}`)
            .setLabel(`${downCount}`)
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
    );
}

module.exports = { buildEmbed, buildVoteRow };