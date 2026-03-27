const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');

const games = new Map();

const WINS = [
    [0,1,2],[3,4,5],[6,7,8], // filas
    [0,3,6],[1,4,7],[2,5,8], // columnas
    [0,4,8],[2,4,6]          // diagonales
];

function checkWin(board, mark) {
    return WINS.some(combo => combo.every(i => board[i] === mark));
}

function buildBoard(gameId, board, disabled = false) {
    const rows = [];
    for (let r = 0; r < 3; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 3; c++) {
            const i     = r * 3 + c;
            const cell  = board[i];
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`ttt_move_${gameId}_${i}`)
                    .setLabel(cell || '​') // zero-width space si vacío
                    .setStyle(
                        cell === '❌' ? ButtonStyle.Danger   :
                        cell === '⭕' ? ButtonStyle.Success  :
                        ButtonStyle.Secondary
                    )
                    .setDisabled(!!cell || disabled)
            );
        }
        rows.push(row);
    }
    return rows;
}

function buildEmbed(state, result = null) {
    const { p1, p2, turn } = state;
    const color = result === 'win'  ? '#57F287' :
                  result === 'draw' ? '#FEE75C' :
                  result === 'lose' ? '#ED4245' : '#5865F2';

    const title = result === 'win'  ? `🏆 ¡${state.winner?.username} ganó!` :
                  result === 'draw' ? '🤝 ¡Empate!'  :
                  `❌ vs ⭕ — Turno de ${turn?.username}`;

    return new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .addFields(
            { name: '❌ Jugador 1', value: `${p1}`, inline: true },
            { name: '⭕ Jugador 2', value: `${p2}`, inline: true }
        )
        .setFooter({ text: result ? 'Partida finalizada.' : 'Haz clic en una celda para jugar.' })
        .setTimestamp();
}

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('❌ Juega Tic-Tac-Toe contra otro usuario.')
        .addUserOption(opt => opt
            .setName('oponente')
            .setDescription('Usuario con quien jugar')
            .setRequired(true)
        ),

    async execute(interaction) {
        const p1  = interaction.user;
        const p2  = interaction.options.getUser('oponente');

        if (p2.bot)           return interaction.reply({ content: '❌ No puedes jugar contra un bot.', flags: [MessageFlags.Ephemeral] });
        if (p2.id === p1.id)  return interaction.reply({ content: '❌ No puedes jugar contra ti mismo.', flags: [MessageFlags.Ephemeral] });

        const gameId = `${p1.id}_${Date.now()}`;
        const state  = {
            board:  Array(9).fill(null),
            p1, p2,
            turn:   p1,
            marks:  { [p1.id]: '❌', [p2.id]: '⭕' },
            winner: null
        };
        games.set(gameId, state);

        const embed = buildEmbed(state);
        const rows  = buildBoard(gameId, state.board);

        return interaction.reply({
            content: `${p2} ¡Te han retado a un Tic-Tac-Toe! Turno de ${p1} ❌`,
            embeds:  [embed],
            components: rows
        });
    }
};

module.exports.games      = games;
module.exports.buildBoard = buildBoard;
module.exports.buildEmbed = buildEmbed;
module.exports.checkWin   = checkWin;
module.exports.WINS       = WINS;