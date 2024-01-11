/* eslint-disable max-len */

const baseUrl = 'https://api.github.com';

// Github API request endpoints
const githubCommitsRequests = {
  requestCommits: (coursePathInGithub, refBranch) => {
    /** Request only commits added max 30 days ago */
    const date = new Date();
    date.setDate(date.getDate() - 30);
    const dateISO = date.toISOString();
    return `${ baseUrl }/repos/${ coursePathInGithub }/commits?per_page=100&sha=${ refBranch }&since=${ dateISO }`;
  },
  requestCommitComments: (coursePathInGithub, commitSHA) => `${ baseUrl }/repos/${ coursePathInGithub }/commits/${ commitSHA }/comments`
};

export default githubCommitsRequests;
