const { Events, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const db = require('../database/db');
const path = require('node:path');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const { guild } = member;

        // 1. Consultar configuración en la DB
        const settings = db.prepare('SELECT welcome_channel, ticket_welcome_msg, ticket_embed_image FROM guild_settings WHERE guild_id = ?').get(guild.id);

        if (!settings || !settings.welcome_channel) return;

        const channel = guild.channels.cache.get(settings.welcome_channel);
        if (!channel) return;

        try {
            // --- INGENIERÍA DE IMAGEN (CANVAS) ---
            const canvas = createCanvas(1024, 450);
            const ctx = canvas.getContext('2d');

            // 1. Fondo (Si no hay imagen en la DB, usamos un degradado profesional)
            if (settings.ticket_embed_image && settings.ticket_embed_image.startsWith('http')) {
                const background = await loadImage(settings.ticket_embed_image).catch(() => null);
                if (background) {
                    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
                } else {
                    drawDefaultBackground(ctx, canvas);
                }
            } else {
                drawDefaultBackground(ctx, canvas);
            }

            // 2. Capa de oscurecimiento (Overlay) para legibilidad
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 3. Círculo del Avatar
            ctx.save();
            ctx.beginPath();
            ctx.arc(512, 140, 100, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();

            const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
            ctx.drawImage(avatar, 412, 40, 200, 200);
            ctx.restore();

            // 4. Texto: Nombre del Usuario
            ctx.font = 'bold 50px sans-serif';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.fillText(member.user.username.toUpperCase(), 512, 300);

            // 5. Texto: Bienvenida
            ctx.font = '30px sans-serif';
            ctx.fillStyle = '#BDC3C7';
            ctx.fillText(`BIENVENIDO A ${guild.name.toUpperCase()}`, 512, 350);

            // 6. Texto: Contador
            ctx.font = '25px sans-serif';
            ctx.fillStyle = '#F1C40F';
            ctx.fillText(`MIEMBRO #${guild.memberCount}`, 512, 400);

            // Preparar el archivo
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `welcome-${member.id}.png` });

            // 2. Sistema de Mensaje (Embed + Imagen)
            const renderedMessage = (settings.ticket_welcome_msg || '¡Bienvenido {user}!')
                .replace('{user}', member.toString())
                .replace('{server}', guild.name);

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('✨ ¡Nueva Incorporación! ✨')
                .setDescription(`>>> ${renderedMessage}`)
                .setColor('#5865F2')
                .setImage(`attachment://welcome-${member.id}.png`)
                .setFooter({ text: `Cluster Global • Sincronizado` })
                .setTimestamp();

            await channel.send({ embeds: [welcomeEmbed], files: [attachment] });

        } catch (error) {
            console.error(`❌ Error generando imagen de bienvenida:`, error);
        }
    },
};

// Función auxiliar para degradado de fondo
function drawDefaultBackground(ctx, canvas) {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#2C3E50');
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Dibujamos unos detalles geométricos sutiles
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    for(let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
}