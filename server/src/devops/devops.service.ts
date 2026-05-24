import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DevCommit, DevDeployment, DevFeatureFlag, DevIssue } from './devops.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class CommitsService extends OwnedCrudService<DevCommit> {
  constructor(@InjectRepository(DevCommit) repo: Repository<DevCommit>) { super(repo); }
}

@Injectable()
export class FeatureFlagsService extends OwnedCrudService<DevFeatureFlag> {
  constructor(@InjectRepository(DevFeatureFlag) repo: Repository<DevFeatureFlag>) { super(repo); }
}

@Injectable()
export class DeploymentsService extends OwnedCrudService<DevDeployment> {
  constructor(@InjectRepository(DevDeployment) repo: Repository<DevDeployment>) { super(repo); }
}

@Injectable()
export class IssuesService extends OwnedCrudService<DevIssue> {
  constructor(@InjectRepository(DevIssue) repo: Repository<DevIssue>) { super(repo); }
}
