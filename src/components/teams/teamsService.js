import axios from 'axios';
import githubTeamsRequests from '../../functions/githubTeamsRequests.js';
import { authToken } from '../../setup/setupGithub.js';

const {
  requestTeams,
  requestTeamMembers
} = githubTeamsRequests;

/**
 * Define all API requests that are done to GitHub API
 */
const apiRequests = {
  getTeamsService: async () => {
    const teamsRaw = await axios.get(requestTeams, authToken).catch((error) => {
      console.error(error);
    });
    if (!teamsRaw) {
      return [];
    }
    return teamsRaw.data;
  },
  getTeamMembersService: async (teamSlug) => {
    const teamMembersRaw = await axios.get(
      requestTeamMembers(teamSlug),
      authToken
    ).catch((error) => {
      console.error(error);
    });

    if (!teamMembersRaw) {
      return [];
    }

    return teamMembersRaw.data.map((member) => member);
  }
};

export default apiRequests;
