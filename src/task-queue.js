const _ = require('lodash');


let taskTagCounter = 0;

class Task {

    constructor(job, tag) {
        this.tag = tag || ('task-' + (taskTagCounter++));
        this.promise = new Promise((resolve, reject) => {
            this.run = function() {
                return job().then(resolve, reject);
            };
        });
    }

}

module.exports = class TaskQueue {

    constructor(options) {
        this.limit = _.get(options, 'limit', null);
        this.interval = _.get(options, 'interval', null);
        this.debug = _.get(options, 'debug', false);
        this.runCount = 0;
        this.lastRunTime = null;
        this.timeout = null;
        this.taskQueue = [];

        if (this.interval) {
            this._runTask = this._runTaskInterval.bind(this, this._runTask.bind(this));
        }
        if (this.limit) {
            this._runTask = this._runTaskLimit.bind(this, this._runTask.bind(this));
        }
    }

    addTask(job, tag) {
        let task = new Task(job, tag);
        this.taskQueue.push(task);
        if (this.debug) {
            console.log(`[TaskQueue] submitted task to queue, task: ${task.tag}, queue size: ${this.taskQueue.length}, running tasks: ${this.runCount}`);
        }
        this._executeNextTask();
        return task.promise;
    }

    clearQueue() {
        this.taskQueue = [];
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }

    _executeNextTask() {
        if (_.isEmpty(this.taskQueue)) {
            return;
        }
        this._runTask();
    }

    _runTaskLimit(runTask) {
        if (this.runCount < this.limit) {
            runTask();
        }
        if (this.debug) {
            console.log(`[TaskQueue] task run count limit (${this.limit}) reached, queue size: ${this.taskQueue.length}, running tasks: ${this.runCount}, waiting for previous tasks to finish`);
        }
    }

    _runTaskInterval(runTask) {
        if (!this.lastRunTime) {
            runTask();
        } else if (!this.timeout) {
            let diff = process.hrtime(this.lastRunTime);
            let diffMs = diff[0] * 1000 + diff[1] / 1000000;
            if (diffMs >= this.interval) {
                runTask();
            } else {
                this.timeout = setTimeout(runTask, this.interval - diffMs);
                if (this.debug) {
                    console.log(`[TaskQueue] task interval is less than allowed (${this.interval}) reached, queue size: ${this.taskQueue.length}, running tasks: ${this.runCount}, waiting for ${this.interval - diffMs}ms`);
                }
            }
        }
    }

    _runTask() {
        const task = this.taskQueue.shift();
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        this.runCount += 1;
        this.lastRunTime = process.hrtime();
        if (this.debug) {
            console.log(`[TaskQueue] running task: ${task.tag}, queue size: ${this.taskQueue.length}, running tasks: ${this.runCount}`);
        }
        task.run().then(() => {
            this.runCount -= 1;
            if (this.debug) {
                console.log(`[TaskQueue] finished running task: ${task.tag}, queue size: ${this.taskQueue.length}, running tasks: ${this.runCount}`);
            }
            this._executeNextTask();
        });
        this._executeNextTask();
    }

}
