import { Column, Entity } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export interface IssueComment {
  author: string;
  text: string;
  date: string;
}

@Entity('dev_commits')
export class DevCommit extends OwnedEntity {
  @Column()
  message!: string;

  @Column({ default: '' })
  author!: string;

  @Column({ default: '' })
  module!: string;

  @Column({ default: '' })
  branch!: string;

  @Column({ default: 'Open' })
  status!: 'Merged' | 'Open' | 'Pending';

  @Column({ nullable: true, type: 'varchar' })
  date?: string | null;
}

@Entity('dev_feature_flags')
export class DevFeatureFlag extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  module!: string;

  @Column({ default: '' })
  description!: string;

  @Column({ default: 'Disabled' })
  status!: 'Enabled' | 'Disabled';

  @Column({ default: 0 })
  companiesAffected!: number;

  @Column({ default: '' })
  createdBy!: string;

  @Column({ default: 0 })
  rolloutPercent!: number;
}

@Entity('dev_deployments')
export class DevDeployment extends OwnedEntity {
  @Column()
  module!: string;

  @Column({ default: 'Dev' })
  environment!: 'Dev' | 'Staging' | 'Production';

  @Column({ default: 'Pending' })
  status!: 'Deployed' | 'Deploying' | 'Failed' | 'Pending';

  @Column({ nullable: true, type: 'varchar' })
  timestamp?: string | null;

  @Column({ default: '' })
  duration!: string;
}

@Entity('dev_issues')
export class DevIssue extends OwnedEntity {
  @Column()
  title!: string;

  @Column({ default: '' })
  module!: string;

  @Column({ default: 'Medium' })
  priority!: 'Critical' | 'High' | 'Medium' | 'Low';

  @Column({ default: 'Open' })
  status!: 'Open' | 'In Progress' | 'Resolved' | 'Closed';

  @Column({ default: '' })
  assignee!: string;

  @Column({ nullable: true, type: 'varchar' })
  created?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  comments?: IssueComment[] | null;
}
