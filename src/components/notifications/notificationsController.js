import { performance } from 'perf_hooks';

import getAllCoursesData from '../../functions/getAllCoursesData.js';
import apiRequestsCommits from '../commits/commitsService.js';
import teamsController from '../teams/teamsController.js';

const allNotificationsController = {
  getCoursesUpdates: async (allCoursesActive, allTeachers) => {
    /**
     * Following gets notifications/comment for each active course:
     */
    const commentsWithCourses = await Promise.all(
      allCoursesActive.map(async (activeCourse) => {
        /**
         * For each active course, get commits.
         */

          //repository:
          // 'https://github.com/tluhk/Sissejuhatus_tarkvaraarendusse',
        const commitsRaw = await apiRequestsCommits.commitsService(
            activeCourse.repository.replace('https://github.com/', ''),
            'master' //activeCourse.refBranch
          ) || [];

        /**
         * Then filter out commits that have commit_count more than 0. This
         * means teacher has added custom comment that should be displayed on
         * webapp.
         */
        const commitsWithComments = commitsRaw?.data?.filter(
          (commit) => commit.commit.comment_count > 0
        );

        /**
         * For such commits, get commit SHAs.
         */
        const commitSHAsWithComments = commitsWithComments?.map(
          (commit) => commit.sha
        ) || [];

        /*
         * Then get comments that are linked to those commit SHAs. Save those comments to array. These are your course updates.
         */
        const commitCommentsPromises = commitSHAsWithComments.map(
          (commitSHA) => apiRequestsCommits.getCommitComments(
            activeCourse.repository.replace('https://github.com/', ''),
            commitSHA
          )
        );
        const commitCommentsRaw = await Promise.all(commitCommentsPromises);

        //console.log(commitCommentsRaw);
        /**
         * Flatten the comments array to remove empty entries.
         */
        const commentsArray = commitCommentsRaw.flatMap(
          (item) => item.data.map((comment) => ({
            url: comment.url,
            html_url: comment.html_url,
            id: comment.id,
            node_id: comment.node_id,
            user: allTeachers.find(
              (user) => user.login === comment.user.login
            ) || { displayName: comment.user.login },
            position: comment.position,
            line: comment.line,
            path: comment.path,
            commit_id: comment.commit_id,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            author_association: comment.author_association,
            body: comment.body,
            reactions: comment.reactions
          })));
        /**
         * Finally, for each comment, add course information.
         */
        commentsArray.forEach((comment) => {
          comment.course = activeCourse;
        });

        return commentsArray;
      })
    );

    /**
     * Here you have and array of comments with course info
     * (commentsWithCourses const). You must flatten the array, so only
     * elements with actual content are stored.
     */
    const commentsWithCoursesFlattened = commentsWithCourses.flatMap(
      (arr) => arr
    );
    commentsWithCoursesFlattened.sort(
      (b, a) => a.created_at > b.created_at ? 1 : b.created_at > a.created_at
        ? -1
        : 0);
    /**
     * Limit notifications to max 30 days ago
     */
    const date30DaysAgo = new Date();
    date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
    const dateISO30DaysAgo = date30DaysAgo.toISOString().substring(0, 10);

    /**
     * Limit notifications to max 7 days ago
     */
    const date7DaysAgo = new Date();
    date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);
    const dateISO7DaysAgo = date7DaysAgo.toISOString().substring(0, 10);

    /**
     * Filter out comments that were created max 30 days ago (for
     * /notifications page). Filter out comments that were created max 7 days
     * ago (for /dashboard).
     */
    const courseUpdates30Days = commentsWithCoursesFlattened.filter(
      (entry) => entry.created_at >= dateISO30DaysAgo
    );
    const courseUpdates7Days = commentsWithCoursesFlattened.filter(
      (entry) => entry.created_at >= dateISO7DaysAgo
    );

    /**
     * Return such comments
     */
    return {
      courseUpdates30Days,
      courseUpdates7Days
    };
  },
  renderNotificationsPage: async (req, res) => {
    let {
      allCoursesActive,
      allTeachers
    } = res.locals;
    /**
     * If allCoursesActive is not provided, get it manually
     */
    if (!allCoursesActive) {
      /*let teamSlug;
       if (req.user && req.user.team) {
       teamSlug = req.user.team.slug;
       }
       res.locals.teamSlug = teamSlug;*/

      const start3 = performance.now();
      const allCourses = await getAllCoursesData(req);
      const end3 = performance.now();
      console.log(`Execution time getAllCoursesData: ${ end3 - start3 } ms`);
      allCoursesActive = allCourses; //.filter((x) => x.courseIsActive);
    }

    /** Save all teachers in a variable, needed for rendering */
    if (!allTeachers) {
      const start4 = performance.now();
      // todo replace with new API call
      allTeachers = await teamsController.getUsersInTeam('teachers');
      const end4 = performance.now();
      console.log(`Execution time allTeachers: ${ end4 - start4 } ms`);
    }

    /**
     * Get notifications for all active courses
     */
    const {
      courseUpdates30Days,
      courseUpdates7Days
    } = await allNotificationsController.getCoursesUpdates(
      allCoursesActive,
      allTeachers
    );

    return res.render('notifications', {
      courses: allCoursesActive,
      user: req.user,
      teachers: allTeachers,
      courseUpdates30Days,
      courseUpdates7Days
    });
  }
};

export default allNotificationsController;
