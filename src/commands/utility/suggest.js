const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');
const db = require('../../database/db');
const { buildEmbed, buildVoteRow } = require('../../utils/suggestHelpers');

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('suggest')
        .setDescription('Sistema de sugerencias del servidor.')
        .addSubcommand(sub => sub
            .setName('send')
            .setDescription('Envía una sugerencia.')
            .addStringOption(opt => opt
                .setName('sugerencia')
                .setDescription('¿Qué quieres sugerir?')
                .setMinLength(10)
                .setMaxLength(1000)
                .setRequired(true)
            )
        )
        .addSubcommand(sub => sub
            .setName('edit')
            .setDescription('Edita tu sugerencia pendiente.')
            .addIntegerOption(opt => opt
                .setName('id')
                .setDescription('ID de la sugerencia')
                .setMinValue(1)
                .setRequired(true)
            )
            .addStringOption(opt => opt
                .setName('nuevo_texto')
                .setDescription('Nuevo contenido')
                .setMinLength(10)
                .setMaxLength(1000)
                .setRequired(true)
            )
        )
        .addSubcommand(sub => sub
            .setName('accept')
            .setDescription('Acepta una sugerencia. [Staff]')
            .addIntegerOption(opt => opt
                .setName('id')
                .setDescription('ID de la sugerencia')
                .setMinValue(1)
                .setRequired(true)
            )
            .addStringOption(opt => opt
                .setName('razon')
                .setDescription('Razón de la aceptación')
                .setRequired(false)
            )
        )
        .addSubcommand(sub => sub
            .setName('deny')
            .setDescription('Rechaza una sugerencia. [Staff]')
            .addIntegerOption(opt => opt
                .setName('id')
                .setDescription('ID de la sugerencia')
                .setMinValue(1)
                .setRequired(true)
            )
            .addStringOption(opt => opt
                .setName('razon')
                .setDescription('Razón del rechazo')
                .setRequired(false)
            )
        )
        .addSubcommandGroup(group => group
            .setName('config')
            .setDescription('Configura el sistema de sugerencias. [Admin]')
            .addSubcommand(sub => sub
                .setName('channel')
                .setDescription('Canal donde se publican las sugerencias.')
                .addChannelOption(opt => opt
                    .setName('canal')
                    .setDescription('Canal de sugerencias')
                    .setRequired(true)
                )
            )
            .addSubcommand(sub => sub
                .setName('log')
                .setDescription('Canal de logs para sugerencias procesadas.')
                .addChannelOption(opt => opt
                    .setName('canal')
                    .setDescription('Canal de logs')
                    .setRequired(true)
                )
            )
            .addSubcommand(sub => sub
                .setName('status')
                .setDescription('Ver configuración actual.')
            )
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const group   = interaction.options.getSubcommandGroup(false);
        const guildId = interaction.guild.id;

        // ── CONFIG ────────────────────────────────────────────────────────
        if (group === 'config') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Necesitas el permiso **Gestionar Servidor**.', ephemeral: true });
            }
            db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);

            if (sub === 'channel') {
                const ch = interaction.options.getChannel('canal');
                db.prepare('UPDATE guild_settings SET suggest_channel = ? WHERE guild_id = ?').run(ch.id, guildId);
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Canal de sugerencias configurado en ${ch}`)],
                    ephemeral: true
                });
            }

            if (sub === 'log') {
                const ch = interaction.options.getChannel('canal');
                db.prepare('UPDATE guild_settings SET suggest_log_channel = ? WHERE guild_id = ?').run(ch.id, guildId);
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Canal de logs configurado en ${ch}`)],
                    ephemeral: true
                });
            }

            if (sub === 'status') {
                const config = db.prepare('SELECT suggest_channel, suggest_log_channel FROM guild_settings WHERE guild_id = ?').get(guildId);
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('💡 Configuración de Sugerencias')
                        .setColor('#5865F2')
                        .addFields(
                            { name: '📢 Canal de sugerencias', value: config?.suggest_channel     ? `<#${config.suggest_channel}>`     : '`No configurado`', inline: true },
                            { name: '📋 Canal de logs',        value: config?.suggest_log_channel ? `<#${config.suggest_log_channel}>` : '`No configurado`', inline: true }
                        )
                    ],
                    ephemeral: true
                });
            }
        }

        // ── SEND ──────────────────────────────────────────────────────────
        if (sub === 'send') {
            const config = db.prepare('SELECT suggest_channel FROM guild_settings WHERE guild_id = ?').get(guildId);
            if (!config?.suggest_channel) {
                return interaction.reply({ content: '❌ No hay canal de sugerencias configurado. Pide a un admin que use `/suggest config channel`.', ephemeral: true });
            }

            const channel = interaction.guild.channels.cache.get(config.suggest_channel);
            if (!channel) {
                return interaction.reply({ content: '❌ El canal de sugerencias no existe. Pide a un admin que lo reconfigure.', ephemeral: true });
            }

            const content = interaction.options.getString('sugerencia');

            const result = db.prepare(`
                INSERT INTO suggestions (guild_id, channel_id, author_id, content, status, votes_up, votes_down, timestamp)
                VALUES (?, ?, ?, ?, 'pending', '[]', '[]', ?)
            `).run(guildId, channel.id, interaction.user.id, content, Date.now());

            const suggId = result.lastInsertRowid;
            const embed  = buildEmbed(interaction.user, content, suggId, [], []);
            const row    = buildVoteRow(suggId, 0, 0);

            const msg = await channel.send({ embeds: [embed], components: [row] });
            db.prepare('UPDATE suggestions SET message_id = ? WHERE id = ?').run(msg.id, suggId);

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Tu sugerencia **#${suggId}** fue publicada en ${channel}`)],
                ephemeral: true
            });
        }

        // ── EDIT ──────────────────────────────────────────────────────────
        if (sub === 'edit') {
            const id      = interaction.options.getInteger('id');
            const newText = interaction.options.getString('nuevo_texto');
            const sug     = db.prepare('SELECT * FROM suggestions WHERE id = ? AND guild_id = ?').get(id, guildId);

            if (!sug)                                  return interaction.reply({ content: `❌ Sugerencia **#${id}** no encontrada.`,                    ephemeral: true });
            if (sug.author_id !== interaction.user.id) return interaction.reply({ content: '❌ Solo puedes editar tus propias sugerencias.',             ephemeral: true });
            if (sug.status !== 'pending')              return interaction.reply({ content: '❌ Solo puedes editar sugerencias que estén **pendientes**.', ephemeral: true });

            db.prepare('UPDATE suggestions SET content = ? WHERE id = ?').run(newText, id);

            const ch = interaction.guild.channels.cache.get(sug.channel_id);
            if (ch) {
                const msg = await ch.messages.fetch(sug.message_id).catch(() => null);
                if (msg) {
                    const up   = JSON.parse(sug.votes_up);
                    const down = JSON.parse(sug.votes_down);
                    await msg.edit({
                        embeds:     [buildEmbed(interaction.user, newText, id, up, down)],
                        components: [buildVoteRow(id, up.length, down.length)]
                    });
                }
            }

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Sugerencia **#${id}** editada.`)],
                ephemeral: true
            });
        }

        // ── ACCEPT / DENY ─────────────────────────────────────────────────
        if (sub === 'accept' || sub === 'deny') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: '❌ Necesitas el permiso **Gestionar Mensajes**.', ephemeral: true });
            }

            const id     = interaction.options.getInteger('id');
            const reason = interaction.options.getString('razon') || 'Sin razón especificada';
            const sug    = db.prepare('SELECT * FROM suggestions WHERE id = ? AND guild_id = ?').get(id, guildId);

            if (!sug)                     return interaction.reply({ content: `❌ Sugerencia **#${id}** no encontrada.`, ephemeral: true });
            if (sug.status !== 'pending') return interaction.reply({ content: '❌ Esta sugerencia ya fue procesada.',    ephemeral: true });

            const newStatus = sub === 'accept' ? 'accepted' : 'denied';
            db.prepare('UPDATE suggestions SET status = ?, reason = ? WHERE id = ?').run(newStatus, reason, id);

            const up     = JSON.parse(sug.votes_up);
            const down   = JSON.parse(sug.votes_down);
            const author = await interaction.client.users.fetch(sug.author_id).catch(() => null);

            const ch = interaction.guild.channels.cache.get(sug.channel_id);
            if (ch) {
                const msg = await ch.messages.fetch(sug.message_id).catch(() => null);
                if (msg) {
                    await msg.edit({
                        embeds:     [buildEmbed(author, sug.content, id, up, down, newStatus, reason, interaction.user)],
                        components: []
                    });
                }
            }

            const config = db.prepare('SELECT suggest_log_channel FROM guild_settings WHERE guild_id = ?').get(guildId);
            if (config?.suggest_log_channel) {
                const logCh = interaction.guild.channels.cache.get(config.suggest_log_channel);
                if (logCh) {
                    await logCh.send({
                        embeds: [new EmbedBuilder()
                            .setTitle(sub === 'accept' ? '✅ Sugerencia Aceptada' : '❌ Sugerencia Rechazada')
                            .setColor(sub === 'accept' ? '#57F287' : '#ED4245')
                            .setDescription(`**#${id}:** ${sug.content}`)
                            .addFields(
                                { name: '👤 Autor',  value: `<@${sug.author_id}>`, inline: true },
                                { name: '🛡️ Staff', value: `${interaction.user}`,  inline: true },
                                { name: '📝 Razón',  value: reason,                inline: false }
                            )
                            .setTimestamp()
                        ]
                    });
                }
            }

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(sub === 'accept' ? '#57F287' : '#ED4245')
                    .setDescription(`${sub === 'accept' ? '✅ Aceptada' : '❌ Rechazada'} la sugerencia **#${id}**.`)
                ],
                ephemeral: true
            });
        }
    }
};