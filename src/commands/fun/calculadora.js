const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

function evalSeguro(expresion) {
    const peligroso = /\b(require|import|process|global|__dirname|__filename|eval|Function|prototype|constructor|window|document|fetch|fs|exec|spawn|Buffer|setTimeout|setInterval)\b/i;
    if (peligroso.test(expresion)) throw new Error('Expresión no permitida');

    let expr = expresion.trim()
        .replace(/,/g, '.')
        .replace(/\^/g, '**')
        .replace(/√\s*/g, 'Math.sqrt(')
        .replace(/\bsqrt\b/gi,  'Math.sqrt')
        .replace(/\bsin\b/gi,   'Math.sin')
        .replace(/\bcos\b/gi,   'Math.cos')
        .replace(/\btan\b/gi,   'Math.tan')
        .replace(/\babs\b/gi,   'Math.abs')
        .replace(/\bfloor\b/gi, 'Math.floor')
        .replace(/\bceil\b/gi,  'Math.ceil')
        .replace(/\bround\b/gi, 'Math.round')
        .replace(/\blog\b/gi,   'Math.log10')
        .replace(/\bln\b/gi,    'Math.log')
        .replace(/\bmax\b/gi,   'Math.max')
        .replace(/\bmin\b/gi,   'Math.min')
        .replace(/\bpi\b/gi,    'Math.PI')
        .replace(/\be\b/g,      'Math.E');

    // eslint-disable-next-line no-new-func
    const result = new Function('"use strict"; return (' + expr + ')')();
    if (typeof result !== 'number') throw new Error('El resultado no es un número');
    if (!isFinite(result))          throw new Error('Resultado infinito o indefinido');
    return result;
}

function formatearResultado(num) {
    if ((Math.abs(num) < 1e15 && Math.abs(num) > 1e-10) || num === 0) {
        return parseFloat(num.toFixed(10)).toLocaleString('es-CL', { maximumFractionDigits: 10 });
    }
    return num.toExponential(6);
}

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('calc')
        .setDescription('🧮 Calcula una expresión matemática.')
        .addStringOption(o => o
            .setName('expresion')
            .setDescription('Expresión a calcular. Ej: 25 * 4 + sqrt(144) / 2')
            .setRequired(true)
            .setMaxLength(200)
        ),

    async execute(interaction) {
        const input = interaction.options.getString('expresion');

        let resultado, isError = false, errorMsg = '';
        try {
            resultado = evalSeguro(input);
        } catch (e) {
            isError  = true;
            errorMsg = e.message;
        }

        if (isError) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('🧮 Error en la calculadora')
                    .addFields(
                        { name: '📥 Expresión', value: `\`${input}\`` },
                        { name: '❌ Error',      value: errorMsg },
                        { name: '💡 Sintaxis',  value: '**Operadores:** `+ - * / % ^`\n**Funciones:** `sqrt() sin() cos() tan() abs() round() floor() ceil() log() ln() max() min()`\n**Constantes:** `pi  e`\n**Ejemplo:** `sqrt(16) + 2^3 * pi`' },
                    )
                ],
                flags: MessageFlags.Ephemeral,
            });
        }

        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('🧮 Calculadora')
                .addFields(
                    { name: '📥 Expresión', value: `\`${input}\`` },
                    { name: '✅ Resultado', value: `## \`${formatearResultado(resultado)}\`` },
                )
                .setFooter({ text: `Solicitado por ${interaction.user.username}` })
                .setTimestamp()
            ],
        });
    },
};