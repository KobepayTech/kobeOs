import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrintCustomer, PrintJob, PrintMaterial, PrintProduct } from './print.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class PrintProductsService extends OwnedCrudService<PrintProduct> {
  constructor(@InjectRepository(PrintProduct) repo: Repository<PrintProduct>) { super(repo); }
}

@Injectable()
export class PrintJobsService extends OwnedCrudService<PrintJob> {
  constructor(@InjectRepository(PrintJob) repo: Repository<PrintJob>) { super(repo); }
}

@Injectable()
export class PrintMaterialsService extends OwnedCrudService<PrintMaterial> {
  constructor(@InjectRepository(PrintMaterial) repo: Repository<PrintMaterial>) { super(repo); }
}

@Injectable()
export class PrintCustomersService extends OwnedCrudService<PrintCustomer> {
  constructor(@InjectRepository(PrintCustomer) repo: Repository<PrintCustomer>) { super(repo); }
}
