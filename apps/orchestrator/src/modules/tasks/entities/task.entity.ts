import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { TaskStatus } from '@claude-orchestrator/shared';

@Entity('tasks')
@Index(['status'])
@Index(['createdAt'])
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: TaskStatus.QUEUED })
  status: TaskStatus;

  @Column('text')
  prompt: string;

  @Column('text', { nullable: true })
  code?: string;

  @Column({ type: 'int', default: 300 })
  timeout: number;

  @Column({ nullable: true })
  workerId?: string;

  @Column('text', { nullable: true })
  result?: string;

  @Column('text', { nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;
}