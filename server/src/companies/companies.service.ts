import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './company.entity';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

@Injectable()
export class CompaniesService {
  constructor(@InjectRepository(Company) private readonly repo: Repository<Company>) {}

  list(ownerId: string) {
    return this.repo.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  async get(ownerId: string, id: string) {
    const company = await this.repo.findOne({ where: { id, ownerId } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  create(ownerId: string, dto: CreateCompanyDto) {
    const company = this.repo.create({ ...dto, ownerId, status: 'Trial' });
    return this.repo.save(company);
  }

  async update(ownerId: string, id: string, dto: UpdateCompanyDto) {
    const company = await this.get(ownerId, id);
    Object.assign(company, dto);
    return this.repo.save(company);
  }

  async remove(ownerId: string, id: string) {
    const company = await this.get(ownerId, id);
    await this.repo.remove(company);
    return { id };
  }
}
