const { Octokit } = require("@octokit/core");

const octokit = new Octokit({ auth: process.env.TOKEN });

const ticketIdRegex = /PIC-\d{1,4}/;
const introducingCommitRegex = /Introduced by commit ([0-9A-Fa-f]{6,40})/

function millisToDaysHoursMins(ms) {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor(((ms / (1000 * 60 * 60 * 24)) - days) * 24);
    const minutes = Math.floor(((((ms / (1000 * 60 * 60 * 24)) - days) * 24) - hours) * 60);

    return {
        days: days,
        hours: hours,
        minutes: minutes
    };
}
function getTimeDelta(maxDate, minDate) {
    const ms = maxDate - minDate;
    return millisToDaysHoursMins(ms);
}

function getAverage(array){
    let values = array.filter(value => value != null);
    return values
        .reduce((accumulator, value) => accumulator +  value) / values.length
}

function getStats(commits) {
    const commitDates = commits.map(item => new Date(item.commit.author.date));

    let maxDate = Math.max(...commitDates);
    let minDate = Math.min(...commitDates);

    function isBug(item) {
        return item.commit.message.includes("🐛") || item.commit.message.includes("fix");
    }

    const bugFixes = commits.filter(item => isBug(item));
    const bugsWithMttr = bugFixes.map(item => {
        if (!introducingCommitRegex.test(item.commit.message))
            return null
        const introducingCommitHash = item.commit.message.match(introducingCommitRegex)[1]
        const introducingCommits = commits.filter(item => item.sha.includes(introducingCommitHash))
        if(introducingCommits.length === 1) {
            return new Date(item.commit.author.date) - new Date(introducingCommits[0].commit.author.date)
        }
        return null
    }).filter(item => item != null);
    let meanTimeToRecoveryMillis = null;
    if (bugsWithMttr.length > 0){
        meanTimeToRecoveryMillis = bugsWithMttr
            .reduce((accumulator, value) => accumulator + value, 0) / bugsWithMttr.length;
    }

    return {
        commitDates,
        dateOfLastCommit: new Date(maxDate),
        dateOfFirstCommit: new Date(minDate),
        cycleTimeMillis: maxDate - minDate,
        cycleTime: getTimeDelta(maxDate, minDate),
        numberOfBugFixes: bugFixes.length,
        // These numbers are misleading - it would be a good approximation if we did CD but as it is there's a manual
        // deployment step that needs to be completed before recovery actually happens. We could improve this be
        // checking at the Circle API when the change actually deployed to prod
        meanTimeToRecoveryMillis,
        meanTimeToRecovery: meanTimeToRecoveryMillis == null? null : millisToDaysHoursMins(meanTimeToRecoveryMillis)
    };
}

function getAverageCycleTime(statsArray) {
    const totalCycleTime = statsArray
        .reduce((accumulator, stats) => accumulator + stats.cycleTimeMillis, 0)
    const averageCycleTime = totalCycleTime / statsArray.length
    return millisToDaysHoursMins(averageCycleTime);
}

let sinceDate = `2022-10-01`;
let itemsPerPage = `100`;
octokit.request(`GET /repos/ministryofjustice/court-case-service/commits?per_page=${itemsPerPage}&since=${sinceDate}T00:00:00`, {
    org: "octokit",
    type: "private",
}).then((response) => {

    const tickets = new Map()

    response.data.forEach(item => {
        if (!ticketIdRegex.test(item.commit.message))
            return
        const ticketId = item.commit.message.match(ticketIdRegex)[0]
        if (tickets.has(ticketId)) {
            tickets.get(ticketId).push(item)
        } else {
            tickets.set(ticketId, [item])
        }
    })

    tickets.forEach((commitArray, ticketId) => {
        const stats = getStats(commitArray);

        console.log(`Since ${sinceDate} there have been ${response.data.length} commits, ${commitArray.length} were associated with ticket ${ticketId}`)
        console.log(`The first commit was on ${stats.dateOfFirstCommit}`)
        console.log(`The last commit was on ${stats.dateOfLastCommit}`)
        console.log(`Cycle time for ${ticketId} was ${(stats.cycleTime.days)} days, ${(stats.cycleTime.hours)} hours and ${(stats.cycleTime.minutes)} minutes`)
        console.log(`There were ${stats.numberOfBugFixes} bug fixes associated with this ticket`)
        if (stats.meanTimeToRecovery != null) {
            console.log(`Mean time to recovery was ${stats.meanTimeToRecovery.days} days, ${(stats.meanTimeToRecovery.hours)} hours and ${(stats.meanTimeToRecovery.minutes)} minutes`)
        }
        console.log(`------------------`)
    })

    const statsArray = Array.from(tickets, ([_, commitArray]) => getStats(commitArray))
    const aggregateStats = {
        avgCycleTime: getAverageCycleTime(statsArray),
        changeFailureRate: statsArray.filter(stats => stats.numberOfBugFixes > 0).length / statsArray.length,
        meanTimeToRecoveryMillis: getAverage(statsArray.map(stats => stats.meanTimeToRecoveryMillis)),
        meanTimeToRecovery: millisToDaysHoursMins(getAverage(statsArray.map(stats => stats.meanTimeToRecoveryMillis)))
    }

    console.log(`Since ${sinceDate} there have been ${response.data.length} commits working on ${Array.from(tickets.keys()).length} tickets`)
    console.log(`Average cycle time was ${aggregateStats.avgCycleTime.days} days, ${(aggregateStats.avgCycleTime.hours)} hours and ${(aggregateStats.avgCycleTime.minutes)} minutes`)
    console.log(`Change failure rate was ${aggregateStats.changeFailureRate}`)
    console.log(`Mean time to recovery was ${aggregateStats.meanTimeToRecovery.days} days, ${(aggregateStats.meanTimeToRecovery.hours)} hours and ${(aggregateStats.meanTimeToRecovery.minutes)} minutes`)
});
