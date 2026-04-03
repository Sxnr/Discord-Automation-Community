const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const ICONS = {
    '01d':'☀️','01n':'🌙','02d':'⛅','02n':'⛅','03d':'☁️','03n':'☁️',
    '04d':'☁️','04n':'☁️','09d':'🌧️','09n':'🌧️','10d':'🌦️','10n':'🌦️',
    '11d':'⛈️','11n':'⛈️','13d':'🌨️','13n':'🌨️','50d':'🌫️','50n':'🌫️',
};

function windDir(deg) {
    return ['N','NE','E','SE','S','SO','O','NO'][Math.round(deg / 45) % 8];
}

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('clima')
        .setDescription('🌤️ Consulta el clima actual de cualquier ciudad.')
        .addStringOption(o => o
            .setName('ciudad')
            .setDescription('Ciudad a consultar. Ej: Santiago, CL | Buenos Aires, AR')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption(o => o
            .setName('unidades')
            .setDescription('Sistema de temperatura (por defecto Celsius)')
            .addChoices(
                { name: '🌡️ Celsius',    value: 'metric'   },
                { name: '🌡️ Fahrenheit', value: 'imperial' },
                { name: '🌡️ Kelvin',     value: 'standard' },
            )
        ),

    async execute(interaction) {
        const ciudad   = interaction.options.getString('ciudad');
        const unidades = interaction.options.getString('unidades') || 'metric';
        const sym      = unidades === 'metric' ? '°C' : unidades === 'imperial' ? '°F' : 'K';
        const speedSym = unidades === 'imperial' ? 'mph' : 'm/s';

        await interaction.deferReply();

        const key = process.env.OPENWEATHER_KEY;
        const base = 'https://api.openweathermap.org/data/2.5';
        const q    = encodeURIComponent(ciudad);

        let w, f;
        try {
            const [wRes, fRes] = await Promise.all([
                fetch(`${base}/weather?q=${q}&appid=${key}&units=${unidades}&lang=es`),
                fetch(`${base}/forecast?q=${q}&appid=${key}&units=${unidades}&lang=es&cnt=8`),
            ]);

            if (wRes.status === 404) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setTitle('❌ Ciudad no encontrada')
                        .setDescription(`No encontré **"${ciudad}"**.\n💡 Intenta agregar el país: \`Santiago, CL\` | \`Madrid, ES\``)
                    ],
                });
            }
            if (!wRes.ok) throw new Error(`HTTP ${wRes.status}`);

            w = await wRes.json();
            f = await fRes.json();
        } catch (e) {
            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#ED4245')
                    .setDescription(`❌ Error al conectar con OpenWeatherMap.\n\`${e.message}\``)
                ],
            });
        }

        const icon    = ICONS[w.weather[0].icon] || '🌡️';
        const desc    = w.weather[0].description;
        const descCap = desc.charAt(0).toUpperCase() + desc.slice(1);

        const forecastLines = (f.list || []).slice(1, 5).map(item => {
            const hora = new Date(item.dt * 1000).toLocaleTimeString('es-CL', {
                hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
            });
            const ico = ICONS[item.weather[0].icon] || '🌡️';
            return `\`${hora}\` ${ico} **${Math.round(item.main.temp)}${sym}** — ${item.weather[0].description}`;
        }).join('\n') || '_Sin datos_';

        const toTime = ts => new Date(ts * 1000).toLocaleTimeString('es-CL', {
            hour: '2-digit', minute: '2-digit',
        });

        const nubes     = w.clouds?.all ?? '?';
        const lluvia    = w.rain?.['1h'] ? `🌧️ ${w.rain['1h']} mm/h` : null;
        const nieve     = w.snow?.['1h'] ? `❄️ ${w.snow['1h']} mm/h` : null;
        const extras    = [lluvia, nieve].filter(Boolean).join(' · ') || null;

        const embed = new EmbedBuilder()
            .setTitle(`${icon} ${w.name}, ${w.sys.country}`)
            .setDescription(`**${descCap}**`)
            .setColor('#00B0F4')
            .setThumbnail(`https://openweathermap.org/img/wn/${w.weather[0].icon}@2x.png`)
            .addFields(
                { name: '🌡️ Temperatura',  value: `**${Math.round(w.main.temp)}${sym}**\nSensación **${Math.round(w.main.feels_like)}${sym}**`, inline: true },
                { name: '📊 Mín / Máx',    value: `${Math.round(w.main.temp_min)}${sym} / ${Math.round(w.main.temp_max)}${sym}`, inline: true },
                { name: '💧 Humedad',       value: `${w.main.humidity}%`, inline: true },
                { name: '🌬️ Viento',        value: `${w.wind.speed} ${speedSym} ${windDir(w.wind.deg)}${w.wind.gust ? ` (ráfagas ${w.wind.gust} ${speedSym})` : ''}`, inline: true },
                { name: '👁️ Visibilidad',   value: `${((w.visibility || 0) / 1000).toFixed(1)} km`, inline: true },
                { name: '🔵 Presión',       value: `${w.main.pressure} hPa`, inline: true },
                { name: '☁️ Nubosidad',     value: `${nubes}%`, inline: true },
                { name: '🌅 Amanecer',      value: toTime(w.sys.sunrise), inline: true },
                { name: '🌇 Atardecer',     value: toTime(w.sys.sunset),  inline: true },
                ...(extras ? [{ name: '🌧️ Precipitación', value: extras, inline: false }] : []),
                { name: '📅 Próximas horas', value: forecastLines },
            )
            .setFooter({ text: `Solicitado por ${interaction.user.username} · OpenWeatherMap` })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    },
};