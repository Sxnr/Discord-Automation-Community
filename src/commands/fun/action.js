const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const ACTIONS = {
    hug:  { emoji: '🤗', verb: 'abrazó a',   color: '#F39C12', gifs: ['https://media.tenor.com/images/abc.gif'] },
    pat:  { emoji: '👋', verb: 'le dio pat a', color: '#3498DB', gifs: [] },
    slap: { emoji: '👋', verb: 'abofeteó a',  color: '#ED4245', gifs: [] },
    kiss: { emoji: '💋', verb: 'besó a',      color: '#E91E8C', gifs: [] },
    poke: { emoji: '👉', verb: 'pinchó a',    color: '#9B59B6', gifs: [] },
    wave: { emoji: '👋', verb: 'saludó a',    color: '#57F287', gifs: [] },
    bite: { emoji: '😈', verb: 'mordió a',    color: '#E74C3C', gifs: [] },
    cry:  { emoji: '😢', verb: 'lloró con',   color: '#5DADE2', gifs: [] },
};

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('action')
        .setDescription('🎭 Realiza una acción hacia otro usuario con GIF.')
        .addStringOption(opt => opt
            .setName('accion')
            .setDescription('Acción a realizar')
            .setRequired(true)
            .addChoices(
                { name: '🤗 Abrazar',  value: 'hug'  },
                { name: '👋 Pat',      value: 'pat'  },
                { name: '💢 Abofetear',value: 'slap' },
                { name: '💋 Besar',    value: 'kiss' },
                { name: '👉 Pinchar',  value: 'poke' },
                { name: '👋 Saludar', value: 'wave' },
                { name: '😈 Morder',  value: 'bite' },
                { name: '😢 Llorar',  value: 'cry'  }
            )
        )
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario objetivo').setRequired(false)),

    async execute(interaction) {
        const accion  = interaction.options.getString('accion');
        const target  = interaction.options.getUser('usuario');
        const action  = ACTIONS[accion];

        // GIF via Tenor API (si tienes key), si no usa embed sin imagen
        let gifUrl = null;
        try {
            const res = await fetch(`https://tenor.googleapis.com/v2/search?q=anime+${accion}&key=${process.env.TENOR_API_KEY}&limit=20&media_filter=gif`);
            const data = await res.json();
            const results = data?.results || [];
            if (results.length) {
                const pick = results[Math.floor(Math.random() * results.length)];
                gifUrl = pick.media_formats?.gif?.url || null;
            }
        } catch { /* sin key o sin internet */ }

        const targetText = target ? `${target}` : 'al aire';
        const description = target?.id === interaction.user.id
            ? `${interaction.user} **se ${accion === 'hug' ? 'abrazó a sí mismo' : `hizo la acción a sí mismo`}** ${action.emoji}`
            : `${interaction.user} **${action.verb}** ${targetText} ${action.emoji}`;

        const embed = new EmbedBuilder()
            .setDescription(description)
            .setColor(action.color)
            .setFooter({ text: interaction.user.tag })
            .setTimestamp();

        if (gifUrl) embed.setImage(gifUrl);

        return interaction.reply({ embeds: [embed] });
    }
};