const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags
} = require('discord.js');
const db = require('../../database/db');

const EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

function buildPollEmbed(poll, guild) {
    const options  = JSON.parse(poll.options);
    const votes    = JSON.parse(poll.votes);
    const total    = Object.values(votes).reduce((a, b) => a + b.length, 0);
    const endsAt   = poll.ends_at ? `<t:${Math.floor(poll.ends_at / 1000)}:R>` : '`Sin límite`';
    const isEnded  = poll.ended === 1;

    const bars = options.map((opt, i) => {
        const key     = String(i);
        const count   = votes[key]?.length || 0;
        const pct     = total > 0 ? Math.round((count / total) * 100) : 0;
        const filled  = Math.round(pct / 10);
        const bar     = '█'.repeat(filled) + '░'.repeat(10 - filled);
        return `${EMOJIS[i]} **${opt}**\n\`${bar}\` **${pct}%** · ${count} voto(s)`;
    });

    return new EmbedBuilder()
        .setTitle(`📊 ${poll.question}`)
        .setDescription(bars.join('\n\n'))
        .setColor(isEnded ? '#95A5A6' : '#5865F2')
        .addFields(
            { name: '🗳️ Votos totales', value: `**${total}**`, inline: true },
            { name: '⏰ Cierra',         value: endsAt,          inline: true },
            { name: '📊 Estado',         value: isEnded ? '`CERRADA` 🔒' : '`ACTIVA` ✅', inline: true }
        )
        .setFooter({ text: `ID: ${poll.id} · Creada por ${guild?.name || 'Servidor'}` })
        .setTimestamp();
}

function buildPollButtons(pollId, options, disabled = false) {
    const rows = [];
    const chunks = [];

    // Máx 5 botones por fila, máx 2 filas = 10 opciones
    for (let i = 0; i < options.length; i += 5) {
        chunks.push(options.slice(i, i + 5));
    }

    for (const [ri, chunk] of chunks.entries()) {
        const row = new ActionRowBuilder().addComponents(
            chunk.map((opt, ci) => {
                const idx = ri * 5 + ci;
                return new ButtonBuilder()
                    .setCustomId(`poll_vote_${pollId}_${idx}`)
                    .setLabel(opt.slice(0, 80))
                    .setEmoji(EMOJIS[idx])
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled);
            })
        );
        rows.push(row);
    }

    // Fila de control (siempre al final)
    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`poll_results_${pollId}`).setLabel('Ver Resultados').setStyle(ButtonStyle.Primary).setEmoji('📊'),
        new ButtonBuilder().setCustomId(`poll_close_${pollId}`).setLabel('Cerrar Poll').setStyle(ButtonStyle.Danger).setEmoji('🔒').setDisabled(disabled)
    ));

    return rows;
}

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('📊 Sistema de encuestas avanzadas.')
        .addSubcommand(sub => sub
            .setName('create')
            .setDescription('Crea una encuesta con hasta 10 opciones.')
            .addStringOption(opt => opt.setName('pregunta').setDescription('Pregunta de la encuesta').setRequired(true).setMaxLength(200))
            .addStringOption(opt => opt.setName('opciones').setDescription('Opciones separadas por coma. Ej: Sí, No, Tal vez').setRequired(true))
            .addIntegerOption(opt => opt.setName('duracion').setDescription('Duración en minutos (0 = sin límite)').setMinValue(0).setMaxValue(10080))
            .addChannelOption(opt => opt.setName('canal').setDescription('Canal donde publicar (default: actual)'))
        )
        .addSubcommand(sub => sub
            .setName('close')
            .setDescription('Cierra una encuesta activa.')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID de la encuesta').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('results')
            .setDescription('Ver resultados de una encuesta.')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID de la encuesta').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('Ver encuestas activas del servidor.')
        )
        .addSubcommand(sub => sub
            .setName('delete')
            .setDescription('Elimina una encuesta. [Admin]')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID de la encuesta').setRequired(true))
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // ── CREATE ────────────────────────────────────────────────────────
        if (sub === 'create') {
            const pregunta  = interaction.options.getString('pregunta');
            const rawOpts   = interaction.options.getString('opciones');
            const duracion  = interaction.options.getInteger('duracion') ?? 0;
            const canal     = interaction.options.getChannel('canal') || interaction.channel;

            const options = rawOpts.split(',').map(o => o.trim()).filter(Boolean);

            if (options.length < 2)
                return interaction.reply({ content: '❌ Necesitas al menos **2 opciones** separadas por coma.', flags: [MessageFlags.Ephemeral] });
            if (options.length > 10)
                return interaction.reply({ content: '❌ Máximo **10 opciones** por encuesta.', flags: [MessageFlags.Ephemeral] });

            const ends_at    = duracion > 0 ? Date.now() + duracion * 60000 : null;
            const votes      = Object.fromEntries(options.map((_, i) => [String(i), []]));
            const timestamp  = Date.now();

            const info = db.prepare(`
                INSERT INTO polls (guild_id, channel_id, author_id, question, options, votes, voters, ends_at, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?)
            `).run(guildId, canal.id, interaction.user.id, pregunta, JSON.stringify(options), JSON.stringify(votes), ends_at, timestamp);

            const pollId = info.lastInsertRowid;
            const poll   = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);

            const msg = await canal.send({
                embeds:     [buildPollEmbed(poll, interaction.guild)],
                components: buildPollButtons(pollId, options)
            });

            db.prepare('UPDATE polls SET message_id = ? WHERE id = ?').run(msg.id, pollId);

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#57F287')
                    .setDescription(`✅ Encuesta **#${pollId}** publicada en ${canal}` +
                        (ends_at ? `\n⏰ Cierra <t:${Math.floor(ends_at / 1000)}:R>` : ''))
                ],
                flags: [MessageFlags.Ephemeral]
            });

            // Auto-cerrar si tiene duración
            if (ends_at) {
                setTimeout(async () => {
                    const current = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
                    if (current?.ended) return;
                    db.prepare('UPDATE polls SET ended = 1 WHERE id = ?').run(pollId);

                    const updatedPoll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
                    const opts        = JSON.parse(updatedPoll.options);

                    try {
                        await msg.edit({
                            embeds:     [buildPollEmbed(updatedPoll, interaction.guild)],
                            components: buildPollButtons(pollId, opts, true)
                        });
                        await canal.send({
                            embeds: [new EmbedBuilder()
                                .setColor('#ED4245')
                                .setDescription(`🔒 La encuesta **#${pollId}** ha cerrado.\n📊 **${pregunta}**`)
                            ]
                        });
                    } catch { /* mensaje eliminado */ }
                }, duracion * 60000);
            }
        }

        // ── CLOSE ─────────────────────────────────────────────────────────
        if (sub === 'close') {
            const id   = interaction.options.getInteger('id');
            const poll = db.prepare('SELECT * FROM polls WHERE id = ? AND guild_id = ?').get(id, guildId);

            if (!poll) return interaction.reply({ content: `❌ Encuesta **#${id}** no encontrada.`, flags: [MessageFlags.Ephemeral] });
            if (poll.ended) return interaction.reply({ content: `❌ La encuesta **#${id}** ya está cerrada.`, flags: [MessageFlags.Ephemeral] });
            if (poll.author_id !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: '❌ Solo el autor o un moderador puede cerrar esta encuesta.', flags: [MessageFlags.Ephemeral] });
            }

            db.prepare('UPDATE polls SET ended = 1 WHERE id = ?').run(id);
            const updated = db.prepare('SELECT * FROM polls WHERE id = ?').get(id);
            const opts    = JSON.parse(updated.options);

            const ch  = interaction.guild.channels.cache.get(poll.channel_id);
            if (ch && poll.message_id) {
                const msg = await ch.messages.fetch(poll.message_id).catch(() => null);
                if (msg) await msg.edit({ embeds: [buildPollEmbed(updated, interaction.guild)], components: buildPollButtons(id, opts, true) });
            }

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`🔒 Encuesta **#${id}** cerrada correctamente.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ── RESULTS ───────────────────────────────────────────────────────
        if (sub === 'results') {
            const id   = interaction.options.getInteger('id');
            const poll = db.prepare('SELECT * FROM polls WHERE id = ? AND guild_id = ?').get(id, guildId);

            if (!poll) return interaction.reply({ content: `❌ Encuesta **#${id}** no encontrada.`, flags: [MessageFlags.Ephemeral] });

            return interaction.reply({
                embeds: [buildPollEmbed(poll, interaction.guild)],
                flags:  [MessageFlags.Ephemeral]
            });
        }

        // ── LIST ──────────────────────────────────────────────────────────
        if (sub === 'list') {
            const polls = db.prepare('SELECT * FROM polls WHERE guild_id = ? AND ended = 0 ORDER BY timestamp DESC LIMIT 10').all(guildId);

            if (!polls.length) return interaction.reply({ content: '❌ No hay encuestas activas en este servidor.', flags: [MessageFlags.Ephemeral] });

            const lines = polls.map(p => {
                const total = Object.values(JSON.parse(p.votes)).reduce((a, b) => a + b.length, 0);
                const ends  = p.ends_at ? `· cierra <t:${Math.floor(p.ends_at / 1000)}:R>` : '';
                return `**#${p.id}** — ${p.question.slice(0, 60)} · \`${total} votos\` ${ends}`;
            });

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('📊 Encuestas Activas')
                    .setColor('#5865F2')
                    .setDescription(lines.join('\n'))
                    .setFooter({ text: `${polls.length} encuesta(s) activa(s)` })
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ── DELETE ────────────────────────────────────────────────────────
        if (sub === 'delete') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: '❌ Necesitas el permiso **Gestionar Mensajes**.', flags: [MessageFlags.Ephemeral] });
            }

            const id   = interaction.options.getInteger('id');
            const poll = db.prepare('SELECT * FROM polls WHERE id = ? AND guild_id = ?').get(id, guildId);
            if (!poll) return interaction.reply({ content: `❌ Encuesta **#${id}** no encontrada.`, flags: [MessageFlags.Ephemeral] });

            const ch = interaction.guild.channels.cache.get(poll.channel_id);
            if (ch && poll.message_id) {
                const msg = await ch.messages.fetch(poll.message_id).catch(() => null);
                if (msg) await msg.delete().catch(() => null);
            }

            db.prepare('DELETE FROM polls WHERE id = ?').run(id);
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`🗑️ Encuesta **#${id}** eliminada.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }
    }
};

module.exports.buildPollEmbed   = buildPollEmbed;
module.exports.buildPollButtons = buildPollButtons;