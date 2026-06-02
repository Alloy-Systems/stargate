
let startedAt = new Date()

let proxyRequestsTotal = 0
let proxyRequestsCompleted = 0
let proxyRequestsFailed = 0

let stargatePollsCompleted = 0
let stargatePollsFailed = 0

let tasksReceived = 0
let tasksCompleted = 0
let tasksFailed = 0
let tasksReportCompleted = 0
let tasksReportFailed = 0

let apiStatusSuccess = true
let stargatePollingStatusSuccess = true

export class Metrics {
    static resetMetrics() {
        startedAt = new Date()
        proxyRequestsTotal = 0
        proxyRequestsCompleted = 0
        proxyRequestsFailed = 0

        stargatePollsCompleted = 0
        stargatePollsFailed = 0

        tasksReceived = 0
        tasksCompleted = 0
        tasksFailed = 0
        tasksReportCompleted = 0
        tasksReportFailed = 0

        apiStatusSuccess = true
        stargatePollingStatusSuccess = true
    }

    static tickProxyRequestsTotal() {
        proxyRequestsTotal++
    }

    static tickProxyRequestsCompleted() {
        proxyRequestsCompleted++
    }

    static tickProxyRequestsFailed() {
        proxyRequestsFailed++
    }

    static tickStargatePollsCompleted() {
        stargatePollsCompleted++
    }

    static tickStargatePollsFailed() {
        stargatePollsFailed++
    }

    static increaseTasksReceived(count: number) {
        tasksReceived += count
    }

    static tickTasksReceived() {
        tasksReceived++
    }

    static tickTasksCompleted() {
        tasksCompleted++
    }

    static tickTasksFailed() {
        tasksFailed++
    }

    static tickTasksReportCompleted() {
        tasksReportCompleted++
    }

    static tickTasksReportFailed() {
        tasksReportFailed++
    }

    static setApiStatusSuccess(success: boolean) {
        apiStatusSuccess = success
    }

    static setStargatePollingStatusSuccess(success: boolean) {
        stargatePollingStatusSuccess = success
    }


    static getMetrics() {
        return {
            startedAt,
            proxyRequestsTotal,
            proxyRequestsCompleted,
            proxyRequestsFailed,
            stargatePollsCompleted,
            stargatePollsFailed,
            tasksReceived,
            tasksCompleted,
            tasksFailed,
            tasksReportCompleted,
            tasksReportFailed,
            apiStatusSuccess,
            stargatePollingStatusSuccess,
        }
    }
}