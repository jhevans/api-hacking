const { Octokit } = require("@octokit/core");

const octokit = new Octokit({ auth: process.env.TOKEN });

function getTimeDelta(maxDate, minDate) {
    const ms = maxDate - minDate;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor(((ms / (1000 * 60 * 60 * 24)) - days) * 24);
    const minutes = Math.floor(((((ms / (1000 * 60 * 60 * 24)) - days) * 24) - hours) * 60);

    return {
        days: days,
        hours: hours,
        minutes: minutes
    };
}

function getStats(commits) {
    const commitDates = commits.map(item => new Date(item.commit.author.date));

    return {
        commitDates,
        dateOfLastCommit: new Date(Math.max(...commitDates)),
        dateOfFirstCommit: new Date(Math.min(...commitDates)),
        cycleTime: getTimeDelta(Math.max(...commitDates), Math.min(...commitDates)),
        numberOfBugFixes: commits.filter(item => item.commit.message.includes("🐛")).length
    };
}

const ticketIdRegex = /PIC-\d{1,4}/;
octokit.request("GET /repos/ministryofjustice/court-case-service/commits?per_page=100", {
    org: "octokit",
    type: "private",
}).then((response) => {

    const tickets = new Map()

    response.data.forEach(item => {
        if (item.commit.message.match(ticketIdRegex) == null)
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

        console.log(`Of the ${response.data.length} last commits, ${commitArray.length} were associated with ticket ${ticketId}`)
        console.log(`The first commit was on ${stats.dateOfFirstCommit}`)
        console.log(`The last commit was on ${stats.dateOfLastCommit}`)
        console.log(`Cycle time for ${ticketId} was ${(stats.cycleTime.days)} days, ${(stats.cycleTime.hours)} hours and ${(stats.cycleTime.minutes)} minutes`)
        console.log(`There were ${stats.numberOfBugFixes} bug fixes associated with this ticket`)
        console.log(`------------------`)
    })
});
