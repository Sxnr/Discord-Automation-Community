const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('setup-welcome')
        .setDescription('🎨 Configura el sistema de bienvenida.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('set')
            .setDescription('⚙️ Configura canal y diseño.')
            .addChannelOption(opt => opt.setName('canal').setDescription('📍 Canal de bienvenida.').setRequired(true))
            .addStringOption(opt => opt
                .setName('mensaje')
                .setDescription('📝 Texto del embed. Usa {user}, {server}, {count}.')
                .setRequired(true)
            )
            .addStringOption(opt => opt.setName('fondo').setDescription('🖼️ URL de imagen de fondo (1024x450 recomendada).'))
            .addStringOption(opt => opt.setName('color').setDescription('🎨 Color del embed en HEX. Ej: #5865F2'))
            .addRoleOption(opt => opt.setName('mencionar_rol').setDescription('📣 Rol a mencionar al dar bienvenida.'))
        )
        .addSubcommand(sub => sub
            .setName('test')
            .setDescription('🧪 Simula una bienvenida para ver el resultado.')
        )
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('📊 Ver configuración actual de bienvenida.')
        )
        .addSubcommand(sub => sub
            .setName('disable')
            .setDescription('🚫 Desactiva el sistema de bienvenida.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const guildId = interaction.guild.id;
        const sub     = interaction.options.getSubcommand();

        // ── SET ───────────────────────────────────────────────────────────
        if (sub === 'set') {
            const canal    = interaction.options.getChannel('canal');
            const mensaje  = interaction.options.getString('mensaje');
            const fondo    = interaction.options.getString('fondo');
            const color    = interaction.options.getString('color');
            const rol      = interaction.options.getRole('mencionar_rol');

            if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
                return interaction.editReply({ content: '❌ El color debe estar en formato HEX válido. Ej: `#5865F2`' });
            }

            db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
            db.prepare(`
                UPDATE guild_settings
                SET welcome_channel    = ?,
                    welcome_message    = ?,
                    welcome_background = ?,
                    welcome_color      = ?,
                    welcome_role       = ?,
                    welcome_enabled    = 1
                WHERE guild_id = ?
            `).run(canal.id, mensaje, fondo || null, color || null, rol?.id || null, guildId);

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🎨 Bienvenida Configurada')
                    .setColor(color || '#2ECC71')
                    .addFields(
                        { name: '📍 Canal',         value: `${canal}`, inline: true },
                        { name: '🖼️ Fondo',         value: fondo ? '`Imagen personalizada` ✅' : '`Degradado por defecto`', inline: true },
                        { name: '🎨 Color embed',   value: color ? `\`${color}\`` : '`#5865F2 (default)`', inline: true },
                        { name: '📣 Mencionar rol', value: rol ? `${rol}` : '`Ninguno`', inline: true },
                        { name: '📝 Mensaje',       value: `\`\`\`${mensaje.slice(0, 100)}\`\`\`` }
                    )
                    .setFooter({ text: 'Usa /setup-welcome test para previsualizar.' })
                ]
            });
        }

        // ── TEST ──────────────────────────────────────────────────────────
        if (sub === 'test') {
            const config = db.prepare('SELECT welcome_channel FROM guild_settings WHERE guild_id = ?').get(guildId);
            if (!config?.welcome_channel) {
                return interaction.editReply({ content: '❌ Primero configura la bienvenida con `/setup-welcome set`.' });
            }

            const event = require('../../events/guildMemberAdd');
            await event.execute(interaction.member);
            return interaction.editReply({ content: '✅ Prueba enviada al canal de bienvenida.' });
        }

        // ── STATUS ────────────────────────────────────────────────────────
        if (sub === 'status') {
            const c = db.prepare('SELECT welcome_channel, welcome_message, welcome_background, welcome_color, welcome_role, welcome_enabled FROM guild_settings WHERE guild_id = ?').get(guildId);

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('📊 Estado del Sistema de Bienvenida')
                    .setColor(c?.welcome_color || '#5865F2')
                    .addFields(
                        { name: '⚡ Estado',         value: c?.welcome_enabled ? '`ACTIVO` ✅' : '`INACTIVO` ❌', inline: true },
                        { name: '📍 Canal',          value: c?.welcome_channel ? `<#${c.welcome_channel}>` : '`No configurado`', inline: true },
                        { name: '🎨 Color',          value: c?.welcome_color ? `\`${c.welcome_color}\`` : '`#5865F2 (default)`', inline: true },
                        { name: '🖼️ Fondo',          value: c?.welcome_background ? '`Imagen personalizada`' : '`Degradado default`', inline: true },
                        { name: '📣 Mencionar rol',  value: c?.welcome_role ? `<@&${c.welcome_role}>` : '`Ninguno`', inline: true },
                        { name: '📝 Mensaje',        value: c?.welcome_message ? `\`\`\`${c.welcome_message.slice(0, 200)}\`\`\`` : '`No configurado`' }
                    )
                    .setFooter({ text: 'Variables disponibles: {user}, {server}, {count}' })
                ]
            });
        }

        // ── DISABLE ───────────────────────────────────────────────────────
        if (sub === 'disable') {
            db.prepare('UPDATE guild_settings SET welcome_enabled = 0 WHERE guild_id = ?').run(guildId);
            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor('#ED4245')
                    .setDescription('🚫 Sistema de bienvenida **desactivado**. Usa `/setup-welcome set` para reactivarlo.')
                ]
            });
        }
    }
};