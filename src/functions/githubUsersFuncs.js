import { Octokit } from 'octokit';
import membersController from '../components/members/membersController.js';
import { cacheOrgMembers } from '../setup/setupCache.js';

const octokit = new Octokit({
  auth: process.env.AUTH
});

const getCombinedUserData = async (userId) => {
  if (!cacheOrgMembers.has('userData' + userId)) {
    console.log(
      `❌❌ userData for ${ userId } IS NOT from cache`
    );
    const apiData = await membersController.getUserData(userId);
    const githubData = await octokit.request(
      `GET /users/${ apiData.usernames.github }`, {
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }).catch(() => {
      console.log('Unable to fetch userdata');
    });
    cacheOrgMembers.set(
      'userData' + userId, { user: apiData, github: githubData.data });
    return { user: apiData, github: githubData.data };
  } else {
    console.log(
      `✅✅ userData for ${ userId } FROM CACHE`
    );
    return cacheOrgMembers.get('userData' + userId);
  }
};

export { getCombinedUserData };