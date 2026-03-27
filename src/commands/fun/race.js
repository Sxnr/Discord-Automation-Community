const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');

const ANIMALS  = ['🐎','🐇','🐢','🦊','🐆','🦅','🐊','🦄'];
const TRACK_LEN = 12;
const COOLDOWNS = new Map();
const COOLDOWN_MS = 20000;

function buildTrack(positions, animals, winner = null) {
    return animals.map((animal, i) => {
        const pos  = Math.min(positions[i], TRACK_LEN);
        const done = pos >= TRACK_LEN;
        const track = '─'.repeat(pos) + animal + '─'.repeat(Math.max(TRACK_LEN - pos, 0)) + '🏁';
        return `${done ? '🏆' : `${i + 1}.`} \`${track}\``;
    }).join('\n');
}

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('race')
        .setDescription('🏎️ Inicia una carrera de animales. ¡Apuesta por tu favorito!')
        .addStringOption(opt => opt
            .setName('animal')
            .setDescription('Elige en qué animal apostar')
            .setRequired(true)
            .addChoices(
                { name: '🐎 Caballo',   value: '0' },
                { name: '🐇 Conejo',   value: '1' },
                { name: '🐢 Tortuga',  value: '2' },
                { name: '🦊 Zorro',    value: '3' },
                { name: '🐆 Leopardo', value: '4' },
                { name: '🦅 Águila',   value: '5' },
                { name: '🐊 Cocodrilo',value: '6' },
                { name: '🦄 Unicornio',value: '7' }
            )
        )
        .addIntegerOption(opt => opt
            .setName('apuesta')
            .setDescription('Coins a apostar (1-500)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(500)
        ),

    async execute(interaction) {
        const userId  = interaction.user.id;
        const betIdx  = parseInt(interaction.options.getString('animal'));
        const bet     = interaction.options.getInteger('apuesta');

        const lastUsed = COOLDOWNS.get(userId);
        if (lastUsed && Date.now() - lastUsed < COOLDOWN_MS) {
            const left = Math.ceil((COOLDOWN_MS - (Date.now() - lastUsed)) / 1000);
            return interaction.reply({ content: `⏳ Espera **${left}s** antes de otra carrera.`, flags: [MessageFlags.Ephemeral] });
        }
        COOLDOWNS.set(userId, Date.now());

        await interaction.deferReply();

        const animals   = ANIMALS.slice();
        const positions = Array(animals.length).fill(0);

        // ── Animación ─────────────────────────────────────────────────────
        const embed = new EmbedBuilder()
            .setTitle('🏁 ¡Carrera en curso!')
            .setColor('#F1C40F')
            .setDescription(buildTrack(positions, animals))
            .setFooter({ text: `Apostaste por ${animals[betIdx]} · ${bet} coins` });

        await interaction.editReply({ embeds: [embed] });

        let winner = null;
        const interval = setInterval(async () => {
            // Avanzar animales con velocidad aleatoria y pesos distintos
            for (let i = 0; i < animals.length; i++) {
                const speed = Math.floor(Math.random() * 3); // 0, 1 o 2
                positions[i] = Math.min(positions[i] + speed, TRACK_LEN);
            }

            const finished = positions.findIndex(p => p >= TRACK_LEN);
            if (finished !== -1 && !winner) {
                winner = finished;
                clearInterval(interval);

                const won   = winner === betIdx;
                const prize = won ? bet * 3 : 0;

                const finalEmbed = new EmbedBuilder()
                    .setTitle(`🏆 ¡${animals[winner]} ganó la carrera!`)
                    .setColor(won ? '#57F287' : '#ED4245')
                    .setDescription(buildTrack(positions, animals, winner))
                    .addFields(
                        { name: '🎯 Tu apuesta',  value: `${animals[betIdx]}`, inline: true },
                        { name: won ? '🏆 Ganador' : '💸 Resultado', value: won ? `✅ ¡Ganaste **${prize} coins**!` : `❌ Perdiste **${bet} coins**`, inline: true }
                    )
                    .setFooter({ text: `${interaction.user.tag} · Multiplicador ganador: x3` })
                    .setTimestamp();

                return interaction.editReply({ embeds: [finalEmbed] });
            }

            embed.setDescription(buildTrack(positions, animals));
            await interaction.editReply({ embeds: [embed] }).catch(() => null);

        }, 1200);
    }
};