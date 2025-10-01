"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTaskDto = exports.QueryTaskDto = exports.CreateTaskDto = exports.TaskStatus = void 0;
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["QUEUED"] = "queued";
    TaskStatus["RUNNING"] = "running";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var create_task_dto_1 = require("./dto/create-task.dto");
Object.defineProperty(exports, "CreateTaskDto", { enumerable: true, get: function () { return create_task_dto_1.CreateTaskDto; } });
var query_task_dto_1 = require("./dto/query-task.dto");
Object.defineProperty(exports, "QueryTaskDto", { enumerable: true, get: function () { return query_task_dto_1.QueryTaskDto; } });
var update_task_dto_1 = require("./dto/update-task.dto");
Object.defineProperty(exports, "UpdateTaskDto", { enumerable: true, get: function () { return update_task_dto_1.UpdateTaskDto; } });
//# sourceMappingURL=index.js.map