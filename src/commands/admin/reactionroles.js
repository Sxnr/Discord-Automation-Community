const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder,
    ButtonStyle, PermissionFlagsBits, MessageFlags
} = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('reactionroles')
        .setDescription('📌 Sistema de Reaction Roles.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

        // create-panel
        .addSubcommand(s => s
            .setName('create-panel')
            .setDescription('Crea un panel de reaction roles en un canal.')
            .addChannelOption(o => o.setName('canal').setDescription('Canal destino').setRequired(true))
            .addStringOption(o => o.setName('titulo').setDescription('Título del panel').setRequired(true).setMaxLength(100))
            .addStringOption(o => o.setName('descripcion').setDescription('Descripción del panel').setMaxLength(300))
            .addStringOption(o => o.setName('color').setDescription('Color HEX (ej: #5865F2)'))
            .addStringOption(o => o
                .setName('modo')
                .setDescription('Modo de asignación')
                .addChoices(
                    { name: '🔄 Toggle (añadir/quitar)', value: 'toggle' },
                    { name: '➕ Solo añadir',            value: 'add'    },
                    { name: '1️⃣ Único (máximo 1 rol)',  value: 'unique' },
                )
            )
        )
        // add-role
        .addSubcommand(s => s
            .setName('add-role')
            .setDescription('Agrega un rol a un panel existente.')
            .addStringOption(o => o.setName('message_id').setDescription('ID del mensaje del panel').setRequired(true))
            .addRoleOption(o => o.setName('rol').setDescription('Rol a asignar').setRequired(true))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji del botón').setRequired(true))
            .addStringOption(o => o.setName('label').setDescription('Texto del botón').setMaxLength(60))
        )
        // remove-role
        .addSubcommand(s => s
            .setName('remove-role')
            .setDescription('Elimina un rol de un panel.')
            .addStringOption(o => o.setName('message_id').setDescription('ID del mensaje del panel').setRequired(true))
            .addRoleOption(o => o.setName('rol').setDescription('Rol a eliminar').setRequired(true))
        )
        // list
        .addSubcommand(s => s
            .setName('list')
            .setDescription('Lista todos los paneles del servidor.')
        )
        // delete-panel
        .addSubcommand(s => s
            .setName('delete-panel')
            .setDescription('Elimina un panel completo.')
            .addStringOption(o => o.setName('message_id').setDescription('ID del mensaje del panel').setRequired(true))
        )
        // refresh
        .addSubcommand(s => s
            .setName('refresh')
            .setDescription('Actualiza los botones de un panel (tras agregar/quitar roles).')
            .addStringOption(o => o.setName('message_id').setDescription('ID del mensaje del panel').setRequired(true))
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // ══════════════════════════════════════════════════════════════════
        // CREATE-PANEL
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'create-panel') {
            const canal = interaction.options.getChannel('canal');
            const title = interaction.options.getString('titulo');
            const desc  = interaction.options.getString('descripcion') || 'Selecciona un rol haciendo clic en los botones.';
            const color = interaction.options.getString('color') || '#5865F2';
            const modo  = interaction.options.getString('modo') || 'toggle';

            const hex = /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#5865F2';

            const embed = new EmbedBuilder()
                .setTitle(`📌 ${title}`)
                .setDescription(desc)
                .setColor(hex)
                .setFooter({ text: `Modo: ${modo} · Sin roles aún · Usa /reactionroles add-role` })
                .setTimestamp();

            const msg = await canal.send({ embeds: [embed] });

            db.prepare(`
                INSERT INTO reaction_role_panels (guild_id, channel_id, message_id, title, description, color, mode, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(guildId, canal.id, msg.id, title, desc, hex, modo, Date.now());

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287')
                    .setTitle('✅ Panel creado')
                    .setDescription(
                        `Panel enviado en ${canal}.\n\n` +
                        `> **ID del mensaje:** \`${msg.id}\`\n` +
                        `> Usa \`/reactionroles add-role\` para agregar roles.`
                    )
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // ADD-ROLE
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'add-role') {
            const msgId = interaction.options.getString('message_id');
            const rol   = interaction.options.getRole('rol');
            const emoji = interaction.options.getString('emoji');
            const label = interaction.options.getString('label') || rol.name;

            const panel = db.prepare('SELECT * FROM reaction_role_panels WHERE guild_id = ? AND message_id = ?').get(guildId, msgId);
            if (!panel) return interaction.reply({ content: `❌ Panel \`${msgId}\` no encontrado.`, flags: [MessageFlags.Ephemeral] });

            const existing = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND role_id = ?').get(guildId, msgId, rol.id);
            if (existing) return interaction.reply({ content: `❌ El rol ${rol} ya está en este panel.`, flags: [MessageFlags.Ephemeral] });

            const count = db.prepare('SELECT COUNT(*) as c FROM reaction_roles WHERE guild_id = ? AND message_id = ?').get(guildId, msgId).c;
            if (count >= 25) return interaction.reply({ content: '❌ Máximo **25 roles** por panel.', flags: [MessageFlags.Ephemeral] });

            db.prepare(`
                INSERT INTO reaction_roles (guild_id, channel_id, message_id, emoji, role_id, mode, label)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(guildId, panel.channel_id, msgId, emoji, rol.id, panel.mode, label);

            // Actualizar botones del mensaje
            await refreshPanelButtons(interaction.client, guildId, panel);

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287')
                    .setDescription(`✅ Rol ${rol} agregado al panel con el botón ${emoji} **${label}**.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // REMOVE-ROLE
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'remove-role') {
            const msgId = interaction.options.getString('message_id');
            const rol   = interaction.options.getRole('rol');
            const panel = db.prepare('SELECT * FROM reaction_role_panels WHERE guild_id = ? AND message_id = ?').get(guildId, msgId);
            if (!panel) return interaction.reply({ content: `❌ Panel \`${msgId}\` no encontrado.`, flags: [MessageFlags.Ephemeral] });

            const info = db.prepare('DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND role_id = ?').run(guildId, msgId, rol.id);
            if (!info.changes) return interaction.reply({ content: `❌ El rol ${rol} no estaba en ese panel.`, flags: [MessageFlags.Ephemeral] });

            await refreshPanelButtons(interaction.client, guildId, panel);

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287')
                    .setDescription(`✅ Rol ${rol} eliminado del panel.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // LIST
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'list') {
            const panels = db.prepare('SELECT * FROM reaction_role_panels WHERE guild_id = ? ORDER BY timestamp DESC').all(guildId);
            if (!panels.length) return interaction.reply({ content: '❌ No hay paneles creados.', flags: [MessageFlags.Ephemeral] });

            const lines = panels.map(p => {
                const roles = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ?').all(guildId, p.message_id);
                const list  = roles.map(r => `${r.emoji} <@&${r.role_id}>`).join(', ') || '_Sin roles_';
                return `**${p.title}** · \`${p.message_id}\` · Modo: \`${p.mode}\`\n> ${list}`;
            });

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('📌 Paneles de Reaction Roles')
                    .setColor('#5865F2')
                    .setDescription(lines.join('\n\n'))
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // DELETE-PANEL
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'delete-panel') {
            const msgId = interaction.options.getString('message_id');
            const panel = db.prepare('SELECT * FROM reaction_role_panels WHERE guild_id = ? AND message_id = ?').get(guildId, msgId);
            if (!panel) return interaction.reply({ content: `❌ Panel \`${msgId}\` no encontrado.`, flags: [MessageFlags.Ephemeral] });

            db.prepare('DELETE FROM reaction_role_panels WHERE guild_id = ? AND message_id = ?').run(guildId, msgId);
            db.prepare('DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ?').run(guildId, msgId);

            // Intentar borrar el mensaje original
            try {
                const canal = await interaction.client.channels.fetch(panel.channel_id);
                const msg   = await canal.messages.fetch(msgId);
                await msg.delete();
            } catch {}

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287')
                    .setDescription(`🗑️ Panel **${panel.title}** eliminado.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // REFRESH
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'refresh') {
            const msgId = interaction.options.getString('message_id');
            const panel = db.prepare('SELECT * FROM reaction_role_panels WHERE guild_id = ? AND message_id = ?').get(guildId, msgId);
            if (!panel) return interaction.reply({ content: `❌ Panel \`${msgId}\` no encontrado.`, flags: [MessageFlags.Ephemeral] });

            await refreshPanelButtons(interaction.client, guildId, panel);
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Panel **${panel.title}** actualizado.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }
    }
};

// ── Función compartida para reconstruir botones del panel ─────────────────
async function refreshPanelButtons(client, guildId, panel) {
    try {
        const canal  = await client.channels.fetch(panel.channel_id);
        const msg    = await canal.messages.fetch(panel.message_id);
        const roles  = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ?').all(guildId, panel.message_id);

        const rows = [];
        for (let i = 0; i < roles.length; i += 5) {
            const chunk = roles.slice(i, i + 5);
            rows.push(new ActionRowBuilder().addComponents(
                chunk.map(r =>
                    new ButtonBuilder()
                        .setCustomId(`rr_${r.message_id}_${r.role_id}`)
                        .setLabel(r.label || 'Rol')
                        .setEmoji(r.emoji)
                        .setStyle(ButtonStyle.Secondary)
                )
            ));
        }

        const embed = new EmbedBuilder()
            .setTitle(`📌 ${panel.title}`)
            .setDescription(panel.description)
            .setColor(panel.color)
            .setFooter({ text: `Modo: ${panel.mode} · ${roles.length} rol(es)` })
            .setTimestamp();

        await msg.edit({ embeds: [embed], components: rows });
    } catch (e) {
        console.error('[RR] Error refreshing panel:', e.message);
    }
}

module.exports.refreshPanelButtons = refreshPanelButtons;