import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Mail delivery service.
 * nodemailer is not installed — all sends are logged only.
 * Install nodemailer and restore SMTP/SendGrid transport when email is needed.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger('Mailer');

  constructor(private readonly config: ConfigService) {}

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const url = `${this.config.get('FRONTEND_URL', 'http://localhost:5173')}/reset-password?token=${encodeURIComponent(token)}`;
    this.logger.log(`[MOCK] Password reset for ${email}: ${url}`);
  }
}
