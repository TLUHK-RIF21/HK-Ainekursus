import { cacheOrgMembers } from '../../setup/setupCache.js';
import apiRequests from './membersService.js';
import { usersApi } from '../../setup/setupUserAPI.js';
import membersRequests from '../../functions/usersHkTluRequests.js';

const membersController = {
  /*getOrgMembers: async () => {
   //
   // Request all members from http://users.hk.tlu.ee:3333/users
   //
   const cacheName = 'orgMembers';
   let members;

   if (!cacheOrgMembers.has(cacheName)) {
   console.log('❌❌ Org Members IS NOT from cache');
   members = await apiRequests.getMembersService();
   cacheOrgMembers.set(cacheName, members);
   } else {
   console.log('✅✅ Org Members FROM CACHE');
   members = cacheOrgMembers.get(cacheName);
   }
   return members;
   },*/

  isUserInOrgMembers: async (user) => {
    /**
     * check if given githubUserID is part of tluhk organisation members
     */
    const userInOrgMembers = await usersApi.get(membersRequests.getUser + user)
      .catch((e) => console.log('❌❌ no user found', e));
    if (!userInOrgMembers) {
      return false;
    }

    return userInOrgMembers.data.data;
  },
  getUserData: async (userId) => {
    const userData = await usersApi.get(membersRequests.requestMembers + userId)
      .catch((e) => console.log('❌❌ no user found', e));
    if (!userData) {
      return false;
    }
    return userData.data.data;
  }
};

export default membersController;
