const { Octokit } = require("@octokit/core");

const octokit = new Octokit({ auth: process.env.TOKEN });
const ticketId = "PIC-2613"

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

octokit.request("GET /repos/ministryofjustice/court-case-service/commits?per_page=100", {
    org: "octokit",
    type: "private",
}).then((response) => {

    const filteredData = response.data
        .filter((item) => item.commit.message.includes(ticketId))

    filteredData.map(date => console.log(date))

    const commitDates = filteredData.map(item => new Date(item.commit.author.date));
    const maxDate = Math.max(...commitDates);
    const minDate = Math.min(...commitDates);
    const cycleTime = getTimeDelta(maxDate, minDate);
    const bugFixes = filteredData.filter(item => item.commit.message.includes("🐛")).length


    console.log(`Of the ${response.data.length} last commits, ${filteredData.length} were associated with ticket ${ticketId}`)
    console.log(`The first commit was on ${new Date(minDate)}`)
    console.log(`The last commit was on ${new Date(maxDate)}`)
    console.log(`Cycle time for ${ticketId} was ${(cycleTime.days)} days, ${(cycleTime.hours)} hours and ${(cycleTime.minutes)} minutes`)
    console.log(`There were ${bugFixes} bug fixes associated with this ticket`)
});
