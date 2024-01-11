import membersRequests from '../../functions/usersHkTluRequests.js';
import { usersApi } from '../../setup/setupUserAPI.js';

const { requestMembers } = membersRequests;

/**
 * Define all API requests that are done to users API
 */
const apiRequests = {
  getMembersService: async () => {
    const membersRaw = await usersApi.get(requestMembers)
      .catch((error) => {
        console.error(error);
      });
    return membersRaw.data.data ? membersRaw.data.data : [];
  }
};

export default apiRequests;
