import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger('Mailer');
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    this.init();
  }

  private init() {
    const sendgridKey = this.config.get('SENDGRID_API_KEY');
    if (sendgridKey) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: { user: 'apikey', pass: sendgridKey },
      });
      this.logger.log('Using SendGrid');
      return;
    }
    const smtpHost = this.config.get('SMTP_HOST');
    if (smtpHost) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(this.config.get('SMTP_PORT', 587)),
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });
      this.logger.log(`Using SMTP: ${smtpHost}`);
      return;
    }
    this.logger.warn('No mailer configured');
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const url = `${this.config.get('FRONTEND_URL', 'http://localhost:5173')}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send({
      to: email,
      subject: 'Reset your KobeOS password',
      html: `<div style="font-family:Arial;max-width:500px;margin:0 auto;"><h2>Password Reset</h2><p>Click to reset:</p><a href="${url}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:white;text-decoration:none;border-radius:6px;">Reset Password</a><p style="color:#64748b;font-size:12px;">Expires in 1 hour</p></div>`,
    });
  }

  private async send(opts: { to: string; subject: string; html: string }) {
    const from = this.config.get('EMAIL_FROM', 'noreply@kobeos.com');
    if (!this.transporter) {
      this.logger.log(`[MOCK] To: ${opts.to} | ${opts.subject}`);
      return;
    }
    await this.transporter.sendMail({ from, ...opts });
    this.logger.log(`Sent to ${opts.to}`);
  }
}
