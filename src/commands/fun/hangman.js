const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');

const WORDS = [
    // Animales
    'perro','gato','elefante','jirafa','delfin','pingüino','cocodrilo','mariposa','camello','tortuga',
    // Tecnología
    'computadora','teclado','monitor','servidor','internet','programa','algoritmo','javascript','python','database',
    // Países
    'chile','argentina','brasil','mexico','colombia','peru','venezuela','ecuador','uruguay','paraguay',
    // Frutas
    'manzana','platano','naranja','fresa','sandia','mango','papaya','cereza','durazno','granada',
    // Objetos
    'sombrero','zapato','reloj','espejo','paraguas','mochila','bicicleta','telescopio','microscopio','calculadora',
];

const STAGES = [
    '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```',
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const sessions = new Map(); // userId → game state

function buildDisplay(word, guessed) {
    return word.toUpperCase().split('').map(l => guessed.includes(l) || l === ' ' ? l : '▢').join(' ');
}

function buildLetterRows(gameId, guessed, failed) {
    const rows = [];
    const chunks = [ALPHABET.slice(0, 9), ALPHABET.slice(9, 18), ALPHABET.slice(18)];
    for (const chunk of chunks) {
        rows.push(new ActionRowBuilder().addComponents(
            chunk.map(l => new ButtonBuilder()
                .setCustomId(`hm_letter_${gameId}_${l}`)
                .setLabel(l)
                .setStyle(
                    guessed.includes(l)
                        ? (failed.includes(l) ? ButtonStyle.Danger : ButtonStyle.Success)
                        : ButtonStyle.Secondary
                )
                .setDisabled(guessed.includes(l))
            )
        ));
    }
    return rows;
}

function buildEmbed(state) {
    const { word, guessed, failed, stage } = state;
    const display  = buildDisplay(word, guessed);
    const isWin    = word.toUpperCase().split('').every(l => guessed.includes(l));
    const isLose   = stage >= STAGES.length - 1;
    const color    = isWin ? '#57F287' : isLose ? '#ED4245' : '#FEE75C';

    return new EmbedBuilder()
        .setTitle('🎯 Ahorcado')
        .setColor(color)
        .addFields(
            { name: '🪢 Intentos fallidos',  value: `\`${failed.join(' ') || 'Ninguno'}\` · ${stage}/${STAGES.length - 1}`, inline: false },
            { name: '🔤 Palabra',             value: `\`${display}\``, inline: false },
            { name: '🪓 Progreso',            value: STAGES[stage], inline: false },
        )
        .setFooter({ text: isWin ? '🎉 ¡Ganaste!' : isLose ? `💀 Era: ${word.toUpperCase()}` : 'Adivina letra por letra' });
}

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('hangman')
        .setDescription('🎯 Juega al ahorcado.')
        .addStringOption(opt => opt
            .setName('palabra')
            .setDescription('Palabra personalizada (opcional, si no se elige una aleatoria)')
            .setMaxLength(20)
        ),

    async execute(interaction) {
        const custom  = interaction.options.getString('palabra');
        const word    = (custom || WORDS[Math.floor(Math.random() * WORDS.length)]).toUpperCase();
        const gameId  = `${interaction.user.id}_${Date.now()}`;

        const state = { word, guessed: [], failed: [], stage: 0, gameId, userId: interaction.user.id };
        sessions.set(gameId, state);

        const embed = buildEmbed(state);
        const rows  = buildLetterRows(gameId, [], []);

        return interaction.reply({ embeds: [embed], components: rows });
    }
};

module.exports.sessions         = sessions;
module.exports.buildEmbed       = buildEmbed;
module.exports.buildLetterRows  = buildLetterRows;
module.exports.STAGES           = STAGES;