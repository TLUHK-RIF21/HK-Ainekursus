import { cacheTeamAssignments } from '../setup/setupCache.js';
import teamsController from '../components/teams/teamsController.js';

/** Function to request tluhk org teams and teamMembers from tluhk GitHub organisation.
 * Save teamAssignments into res.locals
 */
const getTeamAssignments = async (req, res, next) => {
  return next();
  /** If teamAssignments is already stored in res.local, then continue with next() */
  if (res.locals.teamAssignments) {
    return next();
  }
  const cacheName = 'teamAssignments';

  /** If teamAssignments is NOT yet stored in res.local, then check if it's stored in Cache.
   * Save teamAssignments to res.locals.
   */

  if (!cacheTeamAssignments.has(cacheName)) {
    console.log(`❌ ${ cacheName } IS NOT from cache`);
    const { teams } = await teamsController.getAllValidTeams()
      .catch((error) => {
        console.error(error);
        return res.redirect('/notfound');
      });
    const getAllTeamAssignments = await teamsController.getAllTeamAssignments(
      teams);

    cacheTeamAssignments.set(cacheName, getAllTeamAssignments);
    res.locals[cacheName] = getAllTeamAssignments;
  } else {
    console.log(`✅ ${ cacheName } FROM CACHE`);
    res.locals[cacheName] = cacheTeamAssignments.get(cacheName);
  }

  return next();
};

export default getTeamAssignments;
