const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const SUBREDDITS = ['memes', 'dankmemes', 'me_irl', 'AdviceAnimals', 'ProgrammerHumor', 'wholesomememes', 'funny'];

async function fetchMeme(categoria) {
    const res  = await fetch(`https://meme-api.com/gimme/${categoria}`);
    const data = await res.json();
    if (!data || !data.url) throw new Error('Sin meme');
    return data;
}

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('😂 Obtiene un meme aleatorio de Reddit.')
        .addStringOption(o => o
            .setName('categoria')
            .setDescription('Categoría del meme (opcional)')
            .addChoices(
                { name: '😂 Memes generales', value: 'memes'           },
                { name: '🔥 Dank memes',       value: 'dankmemes'       },
                { name: '💻 Programadores',     value: 'ProgrammerHumor' },
                { name: '🌸 Wholesome',         value: 'wholesomememes'  },
                { name: '🤣 Funny',             value: 'funny'           },
            )
        ),

    async execute(interaction) {
        const categoria = interaction.options.getString('categoria')
            || SUBREDDITS[Math.floor(Math.random() * SUBREDDITS.length)];

        await interaction.deferReply();

        let post;
        try {
            post = await fetchMeme(categoria);
        } catch {
            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('❌ No pude obtener un meme ahora. Intenta de nuevo.')],
            });
        }

        if (post.nsfw && !interaction.channel?.nsfw) {
            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription('⚠️ El meme es NSFW y este canal no lo permite. Usa `/meme` de nuevo.')],
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(post.title.length > 256 ? post.title.slice(0, 253) + '...' : post.title)
            .setColor('#FF4500')
            .setImage(post.url)
            .addFields(
                { name: '⬆️ Upvotes',   value: post.ups?.toLocaleString('es-CL') || '?', inline: true },
                { name: '📌 Subreddit', value: `r/${post.subreddit}`,                      inline: true },
            )
            .setFooter({ text: `Por u/${post.author} • Solicitado por ${interaction.user.username}` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Ver en Reddit').setStyle(ButtonStyle.Link).setURL(post.postLink).setEmoji('🔗'),
            new ButtonBuilder().setCustomId(`meme_otro_${categoria}`).setLabel('Otro meme').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    },

    // Handler del botón "Otro meme"
    async handleButton(interaction) {
        if (!interaction.customId.startsWith('meme_otro_')) return;
        const categoria = interaction.customId.replace('meme_otro_', '');

        await interaction.deferUpdate();

        let post;
        try {
            post = await fetchMeme(categoria);
        } catch {
            return interaction.followUp({ content: '❌ No pude obtener otro meme.', flags: MessageFlags.Ephemeral });
        }

        if (post.nsfw && !interaction.channel?.nsfw) {
            return interaction.followUp({ content: '⚠️ El meme es NSFW. Intenta de nuevo.', flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setTitle(post.title.length > 256 ? post.title.slice(0, 253) + '...' : post.title)
            .setColor('#FF4500')
            .setImage(post.url)
            .addFields(
                { name: '⬆️ Upvotes',   value: post.ups?.toLocaleString('es-CL') || '?', inline: true },
                { name: '📌 Subreddit', value: `r/${post.subreddit}`,                      inline: true },
            )
            .setFooter({ text: `Por u/${post.author} • Solicitado por ${interaction.user.username}` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Ver en Reddit').setStyle(ButtonStyle.Link).setURL(post.postLink).setEmoji('🔗'),
            new ButtonBuilder().setCustomId(`meme_otro_${categoria}`).setLabel('Otro meme').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    },
};