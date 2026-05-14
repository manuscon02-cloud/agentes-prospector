// ============================================================
//  AGENTE DE PROSPECÇÃO — v2.0
//  Busca REAL via Tavily API → Análise via GPT-4o → Email
//  Quando tiver nome da agência: Ctrl+H e substituir [NOME]
// ============================================================

import OpenAI from 'openai';
import { tavily } from '@tavily/core';
import { enviarEmail } from '../email.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

// ── Setores-alvo ─────────────────────────────────────────────
const SETORES = [
  {
    nome: 'Papel e Celulose',
    queries: [
      'expansão planta celulose Brasil 2025 2026',
      'nova fábrica papel celulose obra industrial Brasil',
    ],
  },
  {
    nome: 'Mineração',
    queries: [
      'expansão mineração Brasil 2025 nova planta obra',
      'mineradora ampliação instalações industriais Brasil',
    ],
  },
  {
    nome: 'Petroquímica',
    queries: [
      'expansão petroquímica Brasil 2025 2026 obra industrial',
      'refinaria ampliação nova unidade petroquímica Brasil',
    ],
  },
  {
    nome: 'Alimentos e Bebidas',
    queries: [
      'nova fábrica alimentos bebidas Brasil 2025 obra expansão',
      'frigorífico indústria alimentícia ampliação planta Brasil',
    ],
  },
  {
    nome: 'Sucroenergético',
    queries: [
      'usina açúcar etanol expansão obra 2025 2026 Brasil',
      'sucroenergético ampliação nova planta investimento Brasil',
    ],
  },
];

// ── Busca REAL via Tavily ─────────────────────────────────────
async function buscarNoticias(queries) {
  const resultados = [];

  for (const query of queries) {
    try {
      const res = await tvly.search(query, {
        searchDepth: 'advanced',
        maxResults: 5,
        includeAnswer: false,
      });

      for (const item of res.results) {
        if (item.content && item.url) {
          resultados.push({
            titulo: item.title || '',
            url: item.url,
            conteudo: item.content.slice(0, 600),
          });
        }
      }
    } catch (err) {
      console.warn(`  ⚠️ Erro na busca Tavily: ${err.message}`);
    }
  }

  // Remove URLs duplicadas
  const vistos = new Set();
  return resultados.filter((r) => {
    if (vistos.has(r.url)) return false;
    vistos.add(r.url);
    return true;
  });
}

// ── GPT-4o analisa notícias reais e monta oportunidades ──────
async function analisarOportunidades(setor, noticias) {
  if (!noticias.length) return [];

  const noticiasFmt = noticias
    .map((n, i) => `[${i + 1}] ${n.titulo}\nURL: ${n.url}\n${n.conteudo}`)
    .join('\n\n---\n\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um agente de prospecção B2B especializado em serviços industriais.
A empresa que você representa atua em: caldeiraria industrial, montagem eletromecânica, manutenção industrial, tubulação e estruturas metálicas. Atende todo o Brasil.
Retorne APENAS um array JSON válido. Sem texto antes ou depois.`,
      },
      {
        role: 'user',
        content: `Com base APENAS nas notícias reais abaixo do setor "${setor}", identifique oportunidades concretas de prospecção B2B.

NOTÍCIAS REAIS:
${noticiasFmt}

Retorne um array JSON. Para cada oportunidade real encontrada:
[
  {
    "empresa": "Nome exato da empresa citada",
    "local": "Cidade, Estado",
    "oportunidade": "Descrição objetiva do projeto citado na notícia",
    "urgencia": "Alta | Media | Baixa",
    "contato_ideal": "Cargo ideal para contatar",
    "fonte": "URL exata da notícia",
    "email_prospeccao": "Email frio profissional de até 120 palavras",
    "linkedin_msg": "Mensagem LinkedIn de até 50 palavras"
  }
]

IMPORTANTE: Só inclua oportunidades que estejam EXPLICITAMENTE nas notícias. Não invente dados.`,
      },
    ],
    max_tokens: 3000,
  });

  try {
    const texto = completion.choices[0].message.content.trim();
    const jsonMatch = texto.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch {
    console.warn(`  ⚠️ Erro ao processar resposta do GPT-4o`);
    return [];
  }
}

// ── Função principal exportada ────────────────────────────────
export async function rodarProspeccao() {
  console.log('🔍 [Prospecção v2] Buscando oportunidades reais...');

  const todasOportunidades = [];

  for (const setor of SETORES) {
    console.log(`  📡 ${setor.nome}...`);

    const noticias = await buscarNoticias(setor.queries);
    console.log(`  📰 ${noticias.length} notícias encontradas`);

    if (!noticias.length) continue;

    const ops = await analisarOportunidades(setor.nome, noticias);
    console.log(`  ✅ ${ops.length} oportunidades identificadas`);

    ops.forEach((op) => todasOportunidades.push({ setor: setor.nome, ...op }));
  }

  if (!todasOportunidades.length) {
    console.log('⚠️ Nenhuma oportunidade encontrada.');
    return;
  }

  // ── Monta email de relatório ──────────────────────────────
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const altas  = todasOportunidades.filter((o) => o.urgencia === 'Alta').length;
  const medias = todasOportunidades.filter((o) => o.urgencia === 'Media').length;
  const baixas = todasOportunidades.filter((o) => o.urgencia === 'Baixa').length;

  let corpo = `PROSPECÇÃO SEMANAL — [NOME]\n`;
  corpo += `Data: ${hoje}\n`;
  corpo += `Total: ${todasOportunidades.length} oportunidades reais\n`;
  corpo += `🔴 Alta: ${altas} | 🟡 Média: ${medias} | 🟢 Baixa: ${baixas}\n\n`;

  for (const setor of SETORES) {
    const items = todasOportunidades.filter((o) => o.setor === setor.nome);
    if (!items.length) continue;

    corpo += `━━━━━━━━━━━━━━━━━━━━\n${setor.nome.toUpperCase()} (${items.length})\n\n`;

    for (const op of items) {
      const icon = op.urgencia === 'Alta' ? '🔴' : op.urgencia === 'Media' ? '🟡' : '🟢';
      corpo += `${icon} ${op.empresa} — ${op.local}\n`;
      corpo += `Oportunidade: ${op.oportunidade}\n`;
      corpo += `Contato: ${op.contato_ideal}\n`;
      corpo += `Fonte: ${op.fonte}\n\n`;
      corpo += `EMAIL:\n${op.email_prospeccao}\n\n`;
      corpo += `LINKEDIN:\n${op.linkedin_msg}\n`;
      corpo += `─────────────────\n\n`;
    }
  }

  await enviarEmail({
    assunto: `[NOME] — Prospecção: ${todasOportunidades.length} oportunidades (${hoje})`,
    corpo,
  });

  console.log(`✅ Email enviado com ${todasOportunidades.length} oportunidades.`);
}
