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

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date;
}