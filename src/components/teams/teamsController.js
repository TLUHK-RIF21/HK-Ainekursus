import pool from '../../../db.js';
import apiRequests from './teamsService.js';
import { cacheTeamUsers } from '../../setup/setupCache.js';
import membersController from '../members/membersController.js';

const teamsController = {
  getAllValidTeams: async () => {
    /**
     * Request all teams of tluhk organisation
     */
    const allTeams = await apiRequests.getTeamsService();

    /** Set conditions, which Teams are read from tluhk org GitHub account
     * Filter out only main teams:
     * -- those that consist of 3 alphabetical symbols and 2 letters, e.g.
     * rif20, rif21
     * -- and 'teachers' team
     */
    const teams = allTeams.filter(
      (x) => x.slug.match(/^[a-zA-Z]{3}\d{2}$/) // match team names that consist of 3
        // alphabetical symbols and 2 letters,
        // e.g. rif20, rif21
        || x.slug === 'teachers' // or match 'teachers' team
    );

    return { teams };
  },
  getAllTeamAssignments: async (teams) => {
    // we'll map the team.slugs to an array of promises where each promise
    // resolves with the team members. We'll then pass the promises to
    // Promise.all, await it and log the result. Map each team.slug to a
    // promise that eventually fulfills with each teams members
    const promises = teams.map(async (team) => {
      return await teamsController.getOneTeamMembers(team.slug);
    });

    // Wait for all promises to fulfill first, then log the members
    const allMembersByTeam = await Promise.all(promises);

    const teamsWithMembers = teams;
    teamsWithMembers.forEach(
      (team, i) => (teamsWithMembers[i].members = allMembersByTeam[i])
    );

    return teamsWithMembers;
  },
  getUserTeam: async (userIDString, teamAssignments) => {
    const userID = parseInt(userIDString, 10);

    /**
     * This code uses some method of Array instead of forEach. Some method also
     * loops over all elements, but stops when a true value is returned. The
     * foundMember variable is used to store the return value of find, which is
     * either undefined if nothing is found, or the first found element. If
     * foundMember is truthy, it means the user was found and the loop stops.
     */
    let foundTeam;
    let foundMember;
    /**
     * Check if user in teachers team
     */
    const teachers = teamAssignments.find(({ slug }) => slug === 'teachers');
    foundMember = teachers.members.find((member) => {
      if (member.id === userID) {
        foundTeam = teachers;
        return true;
      }
      return false;
    });
    /**
     * If not in teacher team, check which other team they're in.
     * Get only first team they're found from, don't allow multiple teams.
     */
    if (!foundTeam) {
      teamAssignments.some((team) => {
        if (team.slug === 'teachers') {
          return false;
        }
        foundMember = team.members.find((member) => {
          if (member.id === userID) {
            foundTeam = team;
            return true;
          }
          return false;
        });
        if (foundMember) {
          return true;
        }
      });
    }
    return foundTeam;
  },
  getUsersInTeam: async (team) => {
    let users;
    const routePath = `usersInTeam+${ team }`;

    if (!cacheTeamUsers.has(routePath)) {
      console.log(`❌❌ users in team IS NOT from cache: ${ routePath }`);
      const usersPromise = await teamsController.getOneTeamMembers(team);
      users = await Promise.all(usersPromise);

      let conn;
      const promises = users.map(async (user, index) => {
        let response;
        try {
          conn = await pool.getConnection();
          response = await conn.query(
            'SELECT username, displayName, email FROM users WHERE githubID = ?;',
            [user.id]
          );
        } catch (err) {
          console.log('Unable to get user info from database');
          console.error(err);
        } finally {
          if (conn) {
            conn.release();
          } // release to pool
        }

        let displayName;
        let email;
        if (response && response[0]) {
          displayName = response[0].displayName;
          email = response[0].email;
        }

        if (!users[index].displayName && displayName) {
          users[index].displayName = displayName;
        } else {
          users[index].displayName = users[index].login;
        }

        users[index].email = email;
      });

      await Promise.all(promises);
      cacheTeamUsers.set(routePath, users);
    } else {
      console.log(`✅✅ users in team FROM CACHE: ${ routePath }`);
      users = cacheTeamUsers.get(routePath);
    }
    return users;
  },
  getOneTeamMembers: async (team) => {
    let members;
    if (typeof team === 'string') {
      members = await apiRequests.getTeamMembersService(team);
    }
    if (typeof team === 'object') {
      members = await apiRequests.getTeamMembersService(team.slug);
    }
    return members;
  },
  getTeachers: async () => {
    const allMembers = await membersController.getOrgMembers();
    return allMembers.filter(m => m.roles.includes('teacher'));
  }
};

export default teamsController;
