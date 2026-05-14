// ── Servidor principal ────────────────────────────────────────
import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import { tavily } from '@tavily/core';
import { iniciarCrons, getUltimaExecucao } from './cron.js';

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

app.use(express.json());
app.use(express.static('public'));

// ── Rota de prospecção manual (chamada pelo botão na tela) ────
app.post('/api/prospectar', async (req, res) => {
  const { setores = [] } = req.body;

  if (!setores.length) {
    return res.status(400).json({ erro: 'Selecione pelo menos um setor' });
  }

  // Resposta em streaming — a tela vai recebendo os cards em tempo real
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  let totalOportunidades = 0;

  for (const setor of setores) {
    try {
      send({ tipo: 'status', msg: `🔍 Buscando notícias reais: ${setor}...` });

      // 1. Busca real via Tavily
      const query = `expansão industrial ${setor} Brasil 2025 2026 obra nova planta`;
      const resultado = await tvly.search(query, {
        searchDepth: 'advanced',
        maxResults: 6,
        includeAnswer: false,
      });

      const noticias = resultado.results
        .filter((r) => r.content && r.url)
        .map((r) => ({
          titulo: r.title || '',
          url: r.url,
          conteudo: r.content.slice(0, 600),
        }));

      if (!noticias.length) {
        send({ tipo: 'status', msg: `⚠️ Sem notícias para ${setor}` });
        continue;
      }

      send({ tipo: 'status', msg: `📰 ${noticias.length} notícias encontradas em ${setor}. Analisando...` });

      // 2. GPT-4o analisa as notícias reais
      const noticiasFmt = noticias
        .map((n, i) => `[${i + 1}] ${n.titulo}\nURL: ${n.url}\n${n.conteudo}`)
        .join('\n\n---\n\n');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Você é um agente de prospecção B2B especializado em serviços industriais.
A empresa representa serviços de: caldeiraria industrial, montagem eletromecânica, manutenção industrial, tubulação e estruturas metálicas.
Retorne APENAS um array JSON válido. Sem texto antes ou depois.`,
          },
          {
            role: 'user',
            content: `Com base APENAS nas notícias reais abaixo do setor "${setor}", identifique oportunidades de prospecção.

NOTÍCIAS:
${noticiasFmt}

Retorne array JSON:
[{
  "empresa": "Nome da empresa",
  "local": "Cidade, Estado",
  "oportunidade": "Descrição do projeto/expansão",
  "urgencia": "Alta | Media | Baixa",
  "contato_ideal": "Cargo ideal para contatar",
  "fonte": "URL da notícia",
  "email_prospeccao": "Email frio profissional até 120 palavras",
  "linkedin_msg": "Mensagem LinkedIn até 50 palavras"
}]

Só inclua oportunidades que estejam nas notícias. Não invente.`,
          },
        ],
        max_tokens: 2500,
      });

      const texto = completion.choices[0].message.content.trim();
      const jsonMatch = texto.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      const items = JSON.parse(jsonMatch[0]);

      for (const item of items) {
        send({ tipo: 'oportunidade', data: { setor, ...item } });
        totalOportunidades++;
        await new Promise((r) => setTimeout(r, 30));
      }

    } catch (err) {
      send({ tipo: 'status', msg: `❌ Erro em ${setor}: ${err.message}` });
    }
  }

  send({ tipo: 'concluido', total: totalOportunidades });
  res.end();
});

// ── Rota de TESTE — dispara email agora com 1 setor rápido ───
app.post('/api/testar-email', async (req, res) => {
  try {
    console.log('🧪 [Teste] Disparando email de teste...');
    const { rodarProspeccao } = await import('./agentes/prospeccao.js');
    await rodarProspeccao();
    res.json({ ok: true, msg: 'Email de teste enviado! Verifique sua caixa de entrada.' });
  } catch (err) {
    console.error('❌ [Teste] Erro:', err.message);
    res.status(500).json({ ok: false, msg: err.message });
  }
});

// ── Status dos agentes ────────────────────────────────────────
app.get('/status', (req, res) => {
  const exec = getUltimaExecucao();
  res.json({
    servico: 'Vox Prospector — TWA Equipamentos e Serviços Industriais',
    timestamp: new Date().toISOString(),
    agentes: {
      prospeccao: {
        agendamento: 'Segunda-feira às 08h (Brasília)',
        ultimaExecucao: exec.prospeccao,
      },
    },
  });
});

// ── Inicia servidor ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Vox Prospector (TWA) rodando na porta ${PORT}`);
  iniciarCrons();
});
