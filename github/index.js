const { Octokit } = require("@octokit/core");

const octokit = new Octokit({ auth: process.env.TOKEN });

octokit.request("GET /repos/ministryofjustice/court-case-service/commits", {
    org: "octokit",
    type: "private",
}).then((response) => response.data.forEach((item) => {
    console.log(item.commit.message);
}));
