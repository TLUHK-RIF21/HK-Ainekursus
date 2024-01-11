import axios from 'axios';

import { cacheCommits, cacheCommitComments } from '../../setup/setupCache.js';
import { authToken } from '../../setup/setupGithub.js';
import githubCommitsRequests from '../../functions/githubCommitsRequests.js';

const {
  requestCommits,
  requestCommitComments
} = githubCommitsRequests;

/**
 * Define all API requests that are done to GitHub API
 */
const apiRequestsCommits = {
  /** Get commits from selected course and selected branch */
  commitsService: async (coursePathInGithub, refBranch) => {
    const routePath = `${ coursePathInGithub }+${ refBranch }+commits`;
    let commits;

    if (!cacheCommits.has(routePath)) {
      console.log(`❌❌ commits IS NOT from cache: ${ routePath }`);

      commits = await axios.get(
        requestCommits(coursePathInGithub, refBranch),
        authToken
      ).catch((err) => {
        console.log('commits not found for course: ', coursePathInGithub);
      });

      cacheCommits.set(routePath, commits);
    } else {
      console.log(`✅✅ commits FROM CACHE: ${ routePath }`);
      commits = cacheCommits.get(routePath);
    }

    return commits;
  } /** Get comments from selected course and selected commit */,
  getCommitComments: async (coursePathInGithub, commitSHA) => {
    const routePath = `${ coursePathInGithub }+commit+${ commitSHA }+comments`;

    let comments;

    if (!cacheCommitComments.has(routePath)) {
      console.log(`❌❌ commit comments IS NOT from cache: ${ routePath }`);
      comments = await axios.get(
        requestCommitComments(coursePathInGithub, commitSHA),
        authToken
      );

      cacheCommitComments.set(routePath, comments);
    } else {
      console.log(`✅✅ commit comments FROM CACHE: ${ routePath }`);
      comments = cacheCommitComments.get(routePath);
    }

    return comments;
  }
};

export default apiRequestsCommits;
