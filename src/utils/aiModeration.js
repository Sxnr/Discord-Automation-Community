// ══════════════════════════════════════════════════════════════════
//  UTILIDAD DE MODERACIÓN POR IA
//  - Usa un LLM (OpenAI-compatible) si hay API key configurada.
//  - Si no hay key, cae a una heurística de spam/toxicidad.
//  - La heurística siempre corre como pre-filtro para ahorrar llamadas.
// ══════════════════════════════════════════════════════════════════

const AI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
const AI_API_URL = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
const AI_MODEL   = process.env.AI_MODEL || 'gpt-4o-mini';

// Lista mínima de respaldo (la verdadera clasificación la hace el LLM).
// Se enfoca en patrones de abuso/estafa obvious y spam estructural.
const TOXIC_TERMS = [
    'idiota', 'imbécil', 'estúpido', 'pendejo', 'cabrón', 'puta', 'mierda',
    'retardado', 'subnormal', 'basura de persona',
];
const SCAM_PATTERNS = [
    /free\s*nitro/i,
    /discord\.gg\/\w+/i,
    /dm\s+(me|para)/i,
    /gana\s+dinero\s+rápido/i,
    /click\s+here\s+to\s+claim/i,
];

function heuristicScore(text) {
    const t = text.toLowerCase();
    let score = 0;
    const categories = [];

    if (TOXIC_TERMS.some(w => t.includes(w))) {
        score = Math.max(score, 0.85);
        categories.push('toxicidad');
    }

    if (SCAM_PATTERNS.some(r => r.test(t))) {
        score = Math.max(score, 0.8);
        categories.push('estafa');
    }

    // Spam estructural
    const capsRatio = (text.match(/[A-Z]/g)?.length || 0) / Math.max(1, text.length);
    const repeated = /(.)\1{6,}/.test(text);
    const massMention = (text.match(/<@!?&?\d+>/g)?.length || 0) >= 5;
    const manyLinks = (text.match(/https?:\/\//g)?.length || 0) >= 3;

    if (capsRatio > 0.7 && text.length > 20) { score = Math.max(score, 0.6); categories.push('spam'); }
    if (repeated) { score = Math.max(score, 0.55); categories.push('spam'); }
    if (massMention) { score = Math.max(score, 0.75); categories.push('spam'); }
    if (manyLinks) { score = Math.max(score, 0.6); categories.push('spam'); }

    return {
        toxic: score >= 0.5,
        score: Math.min(1, score),
        categories,
        reason: categories.length ? `Heurística: ${categories.join(', ')}` : 'Sin señales',
        method: 'heuristic',
    };
}

async function callLLM(text) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify({
            model: AI_MODEL,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content:
                        'Eres un moderador de comunidades de Discord. Clasifica el mensaje y responde ' +
                        'SOLO con JSON válido (sin texto extra) con este formato: ' +
                        '{"toxic": boolean, "score": number entre 0 y 1, "categories": string[], ' +
                        '"reason": string}. Categorías posibles: "toxicidad", "acoso", "odio", ' +
                        '"spam", "nsfw", "estafa", "autolesion", "ninguna".',
                },
                { role: 'user', content: text },
            ],
        }),
        signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '{}';

    // Extraer JSON aunque el modelo añada ruido
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

    return {
        toxic: Boolean(parsed.toxic),
        score: typeof parsed.score === 'number' ? Math.min(1, Math.max(0, parsed.score)) : (parsed.toxic ? 0.8 : 0),
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        reason: parsed.reason || (parsed.toxic ? 'Clasificado por IA' : 'Sin señales'),
        method: 'ai',
    };
}

// Analiza un texto. Devuelve { toxic, score, categories, reason, method }
async function analyzeText(text) {
    if (!text || !text.trim()) {
        return { toxic: false, score: 0, categories: [], reason: 'Vacío', method: 'none' };
    }

    const heuristic = heuristicScore(text);

    // Si hay API key y la heurística sugiere revisión, confirmamos con el LLM
    if (AI_API_KEY && (heuristic.toxic || heuristic.score >= 0.25)) {
        try {
            return await callLLM(text);
        } catch (err) {
            console.error('[AIMod] Error del LLM, usando heurística:', err.message);
            return heuristic;
        }
    }

    return heuristic;
}

module.exports = { analyzeText, AI_ENABLED: Boolean(AI_API_KEY) };
