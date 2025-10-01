import { TaskStatus } from '../index';
export declare class UpdateTaskDto {
    status?: TaskStatus;
    workerId?: string;
    result?: string;
    errorMessage?: string;
    startedAt?: Date;
    completedAt?: Date;
}
