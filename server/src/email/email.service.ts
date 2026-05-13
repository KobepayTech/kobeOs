import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailMessage } from './email.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class EmailService extends OwnedCrudService<EmailMessage> {
  constructor(@InjectRepository(EmailMessage) repo: Repository<EmailMessage>) { super(repo); }

  listFolder(uid: string, folder: string) {
    return this.repo.find({
      where: { ownerId: uid, folder: folder as EmailMessage['folder'] },
      order: { createdAt: 'DESC' },
    });
  }
}
