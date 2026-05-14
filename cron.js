// ── Agendamento automático dos agentes ───────────────────────
import cron from 'node-cron';
import { rodarProspeccao } from './agentes/prospeccao.js';

const ultimaExecucao = {
  prospeccao: null,
};

export function iniciarCrons() {
  // Segunda-feira às 08h (horário de Brasília)
  cron.schedule('0 8 * * 1', async () => {
    console.log('🕗 [Cron] Rodando agente de prospecção...');
    try {
      await rodarProspeccao();
      ultimaExecucao.prospeccao = new Date().toISOString();
    } catch (err) {
      console.error('❌ [Cron] Erro na prospecção:', err.message);
    }
  }, { timezone: 'America/Sao_Paulo' });

  console.log('⏰ Agendamentos ativos:');
  console.log('   📋 Prospecção: Segunda às 08h (Brasília)');
}

export function getUltimaExecucao() {
  return ultimaExecucao;
}
