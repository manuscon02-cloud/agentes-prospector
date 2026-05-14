// ============================================================
//  VOX PROSPECTOR — TWA Equipamentos e Serviços Industriais
//  Busca REAL via Tavily (2 fontes) → GPT-4o → Email
// ============================================================

import OpenAI from 'openai';
import { tavily } from '@tavily/core';
import { enviarEmail } from '../email.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

const SETORES = [
  {
    nome: 'Papel e Celulose',
    queries: [
      'Klabin Suzano Bracell expansão nova planta obra 2026 2027',
      'indústria papel celulose investimento ampliação Brasil 2026',
    ],
  },
  {
    nome: 'Sucroenergético',
    queries: [
      'Raízen São Martinho Tereos expansão usina obra 2026 2027',
      'usina açúcar etanol ampliação nova planta investimento Brasil 2026',
    ],
  },
  {
    nome: 'Mineração',
    queries: [
      'Vale Kinross CSN mineração expansão obra industrial Brasil 2026 2027',
      'mineradora ampliação instalações nova planta Brasil 2026',
    ],
  },
  {
    nome: 'Alimentos e Bebidas',
    queries: [
      'Nestlé ADM BRF JBS nova fábrica expansão obra Brasil 2026 2027',
      'indústria alimentos bebidas ampliação planta industrial Brasil 2026',
    ],
  },
];

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
            publishedDate: item.publishedDate || '',
          });
        }
      }
    } catch (err) {
      console.warn(`  ⚠️ Erro na busca Tavily: ${err.message}`);
    }
  }

  const vistos = new Set();
  return resultados.filter((r) => {
    if (vistos.has(r.url)) return false;
    vistos.add(r.url);
    return true;
  });
}

async function analisarOportunidades(setor, noticias) {
  if (!noticias.length) return [];

  const noticiasFmt = noticias
    .map((n, i) => `[${i + 1}] ${n.titulo}\nDATA: ${n.publishedDate || 'não informada'}\nURL: ${n.url}\n${n.conteudo}`)
    .join('\n\n---\n\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é o Vox Prospector, agente de prospecção B2B de elite da TWA Equipamentos e Serviços Industriais (Sertãozinho/SP).

A TWA atua em: caldeiraria industrial, montagem e desmontagem eletromecânica, manutenção industrial, tubulação, estruturas metálicas, soldagem especializada, mandrilhamento de tubos e locação de guindastes.
Diferenciais: equipe de engenharia própria, conformidade com NRs 6, 10, 11, 12, 31, 33 e 35.
Contexto: estamos em 2026. Ignore oportunidades encerradas ou de 2025. Foque em projetos ativos ou planejados para 2026/2027.
Retorne APENAS um array JSON válido. Sem texto antes ou depois.`,
      },
      {
        role: 'user',
        content: `Analise as notícias reais abaixo do setor "${setor}" e identifique oportunidades concretas de prospecção para a TWA.

REGRAS:
- Só inclua oportunidades com pelo menos 2 fontes confirmando ou com fonte confiável e data recente (2025/2026)
- Descarte notícias vagas, sem empresa identificada ou anteriores a 2025
- O email deve ser assinado por William Costa, Gerente Comercial TWA
- Tom: profissional, técnico, direto ao ponto — destinatário é Diretor ou Gerente de Projetos

NOTÍCIAS:
${noticiasFmt}

Retorne array JSON:
[
  {
    "empresa": "Nome exato da empresa",
    "local": "Cidade, Estado",
    "oportunidade": "Descrição objetiva do projeto citado",
    "urgencia": "Alta | Media | Baixa",
    "contato_ideal": "Cargo ideal (ex: Gerente de Projetos, Diretor Industrial)",
    "fonte": "URL da notícia principal",
    "assunto_email": "Assunto impactante mencionando empresa e projeto",
    "email_prospeccao": "Email frio completo até 150 palavras, assinado por William Costa / Gerente Comercial TWA / (16) 9XXXX-XXXX / comercial@twaequipamentos.com.br",
    "linkedin_msg": "Mensagem LinkedIn até 50 palavras"
  }
]`,
      },
    ],
    max_tokens: 3500,
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

export async function rodarProspeccao() {
  console.log('🔍 [Vox Prospector] Buscando oportunidades reais 2026/2027...');

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

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const altas  = todasOportunidades.filter((o) => o.urgencia === 'Alta').length;
  const medias = todasOportunidades.filter((o) => o.urgencia === 'Media').length;
  const baixas = todasOportunidades.filter((o) => o.urgencia === 'Baixa').length;

  let corpo = `VOX PROSPECTOR — TWA Equipamentos e Serviços Industriais\n`;
  corpo += `Data: ${hoje}\n`;
  corpo += `Total: ${todasOportunidades.length} oportunidades reais (2026/2027)\n`;
  corpo += `🔴 Alta: ${altas} | 🟡 Média: ${medias} | 🟢 Baixa: ${baixas}\n\n`;

  for (const setor of SETORES) {
    const items = todasOportunidades.filter((o) => o.setor === setor.nome);
    if (!items.length) continue;

    corpo += `━━━━━━━━━━━━━━━━━━━━\n${setor.nome.toUpperCase()} (${items.length})\n\n`;

    for (const op of items) {
      const icon = op.urgencia === 'Alta' ? '🔴' : op.urgencia === 'Media' ? '🟡' : '🟢';
      corpo += `${icon} ${op.empresa} — ${op.local}\n`;
      corpo += `Oportunidade: ${op.oportunidade}\n`;
      corpo += `Contato ideal: ${op.contato_ideal}\n`;
      corpo += `Fonte: ${op.fonte}\n\n`;
      corpo += `ASSUNTO: ${op.assunto_email || ''}\n\n`;
      corpo += `EMAIL:\n${op.email_prospeccao}\n\n`;
      corpo += `LINKEDIN:\n${op.linkedin_msg}\n`;
      corpo += `─────────────────\n\n`;
    }
  }

  await enviarEmail({
    assunto: `Vox Prospector — ${todasOportunidades.length} oportunidades TWA (${hoje})`,
    corpo,
  });

  console.log(`✅ Email enviado com ${todasOportunidades.length} oportunidades.`);
}
