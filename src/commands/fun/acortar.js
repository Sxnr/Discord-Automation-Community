const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

function esURLValida(str) {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch { return false; }
}

function extraerDominio(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return url; }
}

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('acortar')
        .setDescription('🔗 Acorta un enlace largo usando TinyURL.')
        .addStringOption(o => o
            .setName('url')
            .setDescription('URL a acortar (debe comenzar con https://)')
            .setRequired(true)
            .setMaxLength(2000)
        ),

    async execute(interaction) {
        const urlInput = interaction.options.getString('url').trim();

        if (!esURLValida(urlInput)) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('❌ URL inválida')
                    .setDescription('La URL debe comenzar con `http://` o `https://`.\n\n**Ejemplo:** `https://www.youtube.com/watch?v=abc123`')
                ],
                flags: MessageFlags.Ephemeral,
            });
        }

        const dominio = extraerDominio(urlInput);
        if (['tinyurl.com', 'bit.ly', 'goo.gl', 't.co', 'ow.ly'].includes(dominio)) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription('⚠️ Esa URL ya parece estar acortada.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply();

        let urlCorta;
        try {
            const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(urlInput)}`);
            if (!res.ok) throw new Error();
            urlCorta = (await res.text()).trim();
            if (!urlCorta.startsWith('http')) throw new Error();
        } catch {
            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('❌ No pude acortar la URL. Intenta de nuevo.')],
            });
        }

        const ahorro = Math.round((1 - urlCorta.length / urlInput.length) * 100);

        const embed = new EmbedBuilder()
            .setColor('#00B0F4')
            .setTitle('🔗 URL acortada')
            .addFields(
                { name: '📥 URL original', value: urlInput.length > 100 ? urlInput.slice(0, 97) + '...' : urlInput },
                { name: '✅ URL corta',    value: `**${urlCorta}**` },
                { name: '📊 Estadísticas', value: `📏 Original: **${urlInput.length}** caracteres\n📐 Corta: **${urlCorta.length}** caracteres\n📉 Ahorro: **${ahorro}%**` },
            )
            .setFooter({ text: `Solicitado por ${interaction.user.username} • TinyURL` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Abrir enlace').setStyle(ButtonStyle.Link).setURL(urlCorta).setEmoji('🌐'),
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    },
};