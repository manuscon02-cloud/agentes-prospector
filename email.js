// ── Envio de email via Resend ─────────────────────────────────
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function enviarEmail({ assunto, corpo }) {
  try {
    const result = await resend.emails.send({
      from: 'Vox Prospector <onboarding@resend.dev>',
      to: process.env.EMAIL_DESTINO,
      subject: assunto,
      text: corpo,
    });
    console.log(`📧 Email enviado para ${process.env.EMAIL_DESTINO} | ID: ${result?.data?.id || JSON.stringify(result)}`);
  } catch (err) {
    console.error(`❌ Erro ao enviar email: ${err.message}`);
  }
}
