import getAllCoursesData from '../../functions/getAllCoursesData.js';
import {
  getComponentsUUIDs, markedAsDone, ttlMarkedAsDone
} from '../../functions/getListOfDoneComponentUUIDs.js';
import { allCoursesController } from '../courses/coursesController.js';
import apiRequests from '../courses/coursesService.js';
import getCourseData from '../../functions/getCourseData.js';

const allOverviewController = {
  getOverview: async (req, res) => {
    /**
     * Check if user's team is 'teachers'
     * If not, then reroute to "/notfound" page
     * If yes, then continue to get overview info
     */
    if (!req.user.roles.includes('teacher')) {
      return res.redirect('/notfound');
    }

    const { courseId } = req.params;

    if (courseId) {
      const course = await apiRequests.getCourseById(courseId);
      const courseConfig = await getCourseData(course, 'master');
      course.config = courseConfig.config;
      let courseBranchComponentsUUIDs = courseConfig.config.practices
        ? courseConfig.config.practices
        : [];
      const done = await markedAsDone(courseId);

      course.students = course.students.map((user) => {
        let uuids = done.filter(
          courses => courses.githubID === user.id.toString())[0]?.uuid || [];
        //uuids = uuids.map(
        //  u => courseBranchComponentsUUIDs.find(c => c.uuid === u).name);
        const displayName = user.firstName + ' ' + user.lastName;

        return { userId: user.id, uuids, displayName };
      });

      course.courseBranchComponentsUUIDs = await getComponentsUUIDs(
        course.repository);

      course.components = courseBranchComponentsUUIDs.map(c => c.name);
      return res.render('overview-stats', {
        user: req.user, courseData: course
      });
    } else {
      // 1. leia kõik õpetaja kursused
      let allCourses = await getAllCoursesData(req);

      allCourses = allCourses.filter(
        (course) => course.teachers.some(t => t.id === req.user.userId));

      // 2. leia kõik mida saab märkida tehtuks
      const withComponentsUUIDs = await allCoursesController.allCoursesActiveWithComponentsUUIDs(
        allCourses);

      /* 3. leia summaarne tehtud % selle kuruse kohta, selleks:
       3.1 - mitu õpilast meil kuulab kursust? (S)
       3.2 - mitu ComponentsUUID meil on (U)
       3.3 - 100% = S x U
       3.4 - palju reaalselt on märkinud tehtuks? SELECT count(githubID) as done FROM users_progress WHERE courseCode = ?; => D
       3.5 - leia keskmine K = D * 100 / (S  * U)
       */
      async function addTTLMarkedAsDone(course) {
        const result = await ttlMarkedAsDone(course.id);
        const UUIDLength = course.courseBranchComponentsUUIDs.length *
          (course.students ? course.students.length : 0);
        return {
          ...course,
          ttlMarkedAsDoneCount: result,
          studentCount: course.students.length,
          UUIDLength,
          donePercentage: result * 100 / UUIDLength
        };
      }

      async function updateArray(array) {
        return await Promise.all(array.map(addTTLMarkedAsDone));
      }

      allCourses = await updateArray(withComponentsUUIDs);

      return res.render('overview-courses', {
        user: req.user, coursesWithTeams: allCourses
      });
    }
  }
};

export default allOverviewController;
