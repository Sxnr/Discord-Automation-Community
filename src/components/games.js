const { EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../database/db');
const { checkAndUnlock } = require('../commands/economy/achievements');

module.exports = async function (interaction) {
    const { customId } = interaction;

    // ── AHORCADO ──
    if (customId.startsWith('hm_letter_')) {
        const parts = customId.split('_');
        const gameId = `${parts[2]}_${parts[3]}`;
        const letter = parts[4];

        const { sessions, buildEmbed, buildLetterRows } = require('../commands/fun/hangman');
        const state = sessions.get(gameId);

        if (!state) { await interaction.reply({ content: '❌ Esta partida ya no está activa.', flags: [MessageFlags.Ephemeral] }); return true; }
        if (state.userId !== interaction.user.id) { await interaction.reply({ content: '❌ Esta no es tu partida.', flags: [MessageFlags.Ephemeral] }); return true; }

        state.guessed.push(letter);
        if (!state.word.includes(letter)) {
            state.failed.push(letter);
            state.stage++;
        }

        const isWin = state.word.split('').every(l => state.guessed.includes(l));
        const isLose = state.stage >= 6;

        const embed = buildEmbed(state);
        const rows = (isWin || isLose)
            ? []
            : buildLetterRows(gameId, state.guessed, state.failed);

        if (isWin || isLose) sessions.delete(gameId);

        await interaction.update({ embeds: [embed], components: rows });
        return true;
    }

    // ── TICTACTOE ──
    if (customId.startsWith('ttt_move_')) {
        const parts = customId.split('_');
        const gameId = `${parts[2]}_${parts[3]}`;
        const cell = parseInt(parts[4]);

        const { games, buildBoard, buildEmbed, checkWin } = require('../commands/fun/tictactoe');
        const state = games.get(gameId);

        if (!state) { await interaction.reply({ content: '❌ Esta partida ya no está activa.', flags: [MessageFlags.Ephemeral] }); return true; }
        if (interaction.user.id !== state.turn.id) { await interaction.reply({ content: '❌ No es tu turno.', flags: [MessageFlags.Ephemeral] }); return true; }
        if (state.board[cell]) { await interaction.reply({ content: '❌ Esa celda ya está ocupada.', flags: [MessageFlags.Ephemeral] }); return true; }

        const mark = state.marks[interaction.user.id];
        state.board[cell] = mark;

        const isWin = checkWin(state.board, mark);
        const isDraw = !isWin && state.board.every(c => c !== null);

        if (isWin) {
            state.winner = interaction.user;
            games.delete(gameId);
            await interaction.update({
                content: `🏆 ¡**${interaction.user.username}** ganó la partida!`,
                embeds: [buildEmbed(state, 'win')],
                components: buildBoard(gameId, state.board, true)
            });
            return true;
        }

        if (isDraw) {
            games.delete(gameId);
            await interaction.update({
                content: '🤝 ¡Empate!',
                embeds: [buildEmbed(state, 'draw')],
                components: buildBoard(gameId, state.board, true)
            });
            return true;
        }

        // Cambiar turno
        state.turn = state.turn.id === state.p1.id ? state.p2 : state.p1;

        await interaction.update({
            content: `Turno de ${state.turn} ${state.marks[state.turn.id]}`,
            embeds: [buildEmbed(state)],
            components: buildBoard(gameId, state.board)
        });
        return true;
    }

    // ── TRIVIA ──
    if (customId.startsWith('trivia_ans_')) {
        const parts = customId.split('_');
        const sessionId = `${parts[2]}_${parts[3]}`;
        const optIdx = parseInt(parts[4]);

        const { activeSessions } = require('../commands/fun/trivia');
        const session = activeSessions.get(sessionId);

        if (!session) { await interaction.reply({ content: '❌ Esta pregunta ya expiró.', flags: [MessageFlags.Ephemeral] }); return true; }
        if (session.userId !== interaction.user.id) { await interaction.reply({ content: '❌ Esta no es tu pregunta.', flags: [MessageFlags.Ephemeral] }); return true; }
        if (session.answered) { await interaction.reply({ content: '⚠️ Ya respondiste.', flags: [MessageFlags.Ephemeral] }); return true; }

        session.answered = true;
        activeSessions.delete(sessionId);

        const chosen = session.shuffled[optIdx];
        const isRight = String(chosen) === String(session.answer);
        const timeTaken = ((Date.now() - session.startTime) / 1000).toFixed(1);
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        // Actualizar stats
        if (isRight) {
            db.prepare(`
            INSERT INTO trivia_stats (guild_id, user_id, correct, streak, best_streak)
            VALUES (?, ?, 1, 1, 1)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET
                correct     = correct + 1,
                streak      = streak + 1,
                best_streak = MAX(best_streak, streak + 1)
        `).run(guildId, userId);
        } else {
            db.prepare(`
            INSERT INTO trivia_stats (guild_id, user_id, wrong, streak)
            VALUES (?, ?, 1, 0)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET wrong = wrong + 1, streak = 0
        `).run(guildId, userId);
        }

        const stats = db.prepare('SELECT streak, best_streak FROM trivia_stats WHERE guild_id = ? AND user_id = ?').get(guildId, userId);

        const embed = new EmbedBuilder()
            .setTitle(`${session.question.cat} — Trivia`)
            .setColor(isRight ? '#57F287' : '#ED4245')
            .setDescription(
                `## ${session.question.q}\n\n` +
                (isRight ? `✅ **¡Correcto!**` : `❌ **Incorrecto.** La respuesta era: **${session.answer}**`)
            )
            .addFields(
                { name: '🎯 Tu respuesta', value: `\`${chosen}\``, inline: true },
                { name: '⏱️ Tiempo', value: `\`${timeTaken}s\``, inline: true },
                { name: '🔥 Racha', value: `\`${stats?.streak || 0}\``, inline: true }
            )
            .setFooter({ text: interaction.user.tag })
            .setTimestamp();

        if (isRight) {
            const triviaStats = db.prepare('SELECT correct, streak FROM trivia_stats WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
            checkAndUnlock(guildId, userId, 'trivia_correct', triviaStats?.correct || 1, interaction.client);
            checkAndUnlock(guildId, userId, 'trivia_streak', triviaStats?.streak || 1, interaction.client);
        }

        await interaction.update({ embeds: [embed], components: [] });
        return true;
    }

    return false;
};
