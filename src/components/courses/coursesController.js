import 'core-js/actual/array/group-by.js';

import { performance } from 'perf_hooks';
import markdown from '../../setup/setupMarkdown.js';
import base64 from 'base-64';
import utf8 from 'utf8';
import getAllCoursesData from '../../functions/getAllCoursesData.js';
import { function1 } from '../../functions/imgFunctions.js';
import {
  returnNextPage,
  returnPreviousPage,
  setCourseButtonPaths
} from '../../functions/navButtonFunctions.js';
import apiRequests from './coursesService.js';
import allNotificationsController
  from '../notifications/notificationsController.js';
import {
  getComponentsUUIDs,
  getMarkedAsDoneComponents
} from '../../functions/getListOfDoneComponentUUIDs.js';
import {
  getFile,
  getFolder,
  updateFile, uploadFile
} from '../../functions/githubFileFunctions.js';
import {
  cacheConcepts,
  cacheConfig,
  cacheLessons
} from '../../setup/setupCache.js';
import { usersApi } from '../../setup/setupUserAPI.js';
import membersRequests from '../../functions/usersHkTluRequests.js';
import getCourseData from '../../functions/getCourseData.js';
import { getCombinedUserData } from '../../functions/githubUsersFuncs.js';
import { axios } from '../../setup/setupGithub.js';
import * as cheerio from 'cheerio';
import { createConfig, getConfig } from '../../functions/getConfigFuncs.js';
import { updateConfigFile } from './courseEditService.js';
import fs from 'fs';

/** responseAction function defines what to do after info about courses and current course page is received.
 * This step gets the data from GitHub, by doing Axios requests via
 * apiRequests[githubRequest] statement. Responses are saved into components,
 * files, sources parts in res.locals, respectively. After the responseAction()
 * function, the renderPage() function is run which renders the page on
 * frontend.
 */
const responseAction = async (req, res, next) => {
  const { githubRequest } = res.locals;
  let apiResponse;
  // if (apiRequests.hasOwnProperty(githubRequest)) {
  if (Object.prototype.hasOwnProperty.call(apiRequests, githubRequest)) {
    let func;

    try {
      func = await apiRequests[githubRequest];
    } catch (error) {
      console.log(`Unable to get ${ githubRequest }`);
      console.error(error);
    }
    await func(req, res).then((response) => {
      apiResponse = response;
    });
  }

  const {
    components, files, sources
  } = apiResponse;

  /** If GitHub API responds with no data for components, sources or files, then save those as empty to res.locals + render an empty page.
   * GitHub API responds with no data if there's inconsistency in the course
   * repo files or folder. E.g. if the config file refers to a folder with
   * lowercase ("arvuti"), but the folder name in GitHub is actually camelcase
   * ("Arvuti"). This is inconsistent and GitHub API does not respond with data
   * if the folder name is sent incorrectly with the API request. We require
   * the teacher to write all folder names lowercase. There's no good way to
   * validate that folder names are all in lowercase, and if not, then change
   * to lowercase from GitHub's side.
   */
  res.locals.resComponents = components
    ? components
    : { data: { content: '' } };
  res.locals.resFiles = files || [];
  res.locals.resSources = sources || { data: { content: '' } };

  return next();
};

/**
 * Last step to render page now that we have resComponents, resFiles and
 * resSources values from GitHub via Axios. We have everything needed to render
 * the page. This function also makes sure everything out the markdown content
 * is correctly parsed and passed to FE.
 */
const renderPage = async (req, res) => {
  const {
    config,
    breadcrumbNames,
    path,
    allCourses,
    backAndForwardPaths,
    markAsDonePaths,
    coursePathInGithub,
    teachers,
    branches,
    selectedVersion,
    markedAsDoneComponentsArr,
    allTeams,
    user,
    resComponents,
    resFiles,
    resSources,
    refBranch
  } = res.locals;

  /** Sisulehe sisu lugemine */
  const resComponentsContent = resComponents.data.content;
  const componentDecoded = base64.decode(resComponentsContent);
  const componentDecodedUtf8 = utf8.decode(componentDecoded);

  /**  Sisulehe piltide kuvamine
   * - functions: https://stackoverflow.com/a/58542933
   * - changing img src:
   * https://www.npmjs.com/package/modify-image-url-md?activeTab=explore
   */
  const start1 = performance.now();
  const markdownWithModifiedImgSources = await function1(coursePathInGithub,
    path, componentDecodedUtf8, refBranch
  );
  const end1 = performance.now();
  console.log(
    `Execution time markdownWithModifiedImgSources: ${ end1 - start1 } ms`);

  /** Add Table of Contents markdown element to Markdown before rendering Markdown */
  const markdownWithModifiedImgSourcesToc = markdownWithModifiedImgSources.concat(
    '\n\n ${toc} \n');

  /** Render Markdown */
  const start2 = performance.now();
  const componentMarkdown = await markdown.render(
    markdownWithModifiedImgSourcesToc);
  const end2 = performance.now();
  console.log(`Execution time componentMarkdown: ${ end2 - start2 } ms`);

  /** Select html from rendered Markdown, but exclude Table of Contents */
  const componentMarkdownWithoutTOC = componentMarkdown.substring(
    0,
    componentMarkdown.indexOf(
      '<nav class="table-of-contents-from-markdown-123">')
  );

  /** Select Table of Contents from rendered Markdown, but exclude preceding html. */
  function getStringBetween(str, start, end) {
    const result = str.match(new RegExp(`${start}(.*)${end}`));
    return result[1];
  }

  const componentMarkdownOnlyTOCWithoutNav = getStringBetween(componentMarkdown,
    '<nav class="table-of-contents-from-markdown-123">', '</nav>'
  );
  const componentMarkdownOnlyTOC = `<nav class="table-of-contents">${ componentMarkdownOnlyTOCWithoutNav }</nav>`;

  /** You now have stored the markdown content in two variables:
   * componentMarkdownWithoutTOC
   * componentMarkdownOnlyTOC
   */

  /** Each sisuleht (concepts, practices) has a sources reference which is stored in sources.json file in GitHub. */
    // define sources as NULL by default.
  let sourcesJSON = null;

  // NB! Sources are sent only with "Teemade endpointid" axios call. If
  // sourcesJSON stays NULL (is false), then content.handlebars does not
  // display "Allikad" div. If sourcesJSON gets filled (is true), then
  // "Allikad" div is displayed.
  if (resSources && resSources.data && resSources.data.content &&
    resSources.data.content !== '') {
    const sources = resSources.data;
    const sourcesDecoded = base64.decode(sources.content);
    const sourcesDecodedUtf8 = utf8.decode(sourcesDecoded);
    if (sourcesDecodedUtf8) {
      sourcesJSON = JSON.parse(sourcesDecodedUtf8);
    }
  }

  // used for adding new branch

  /** Finally you can render the course view with all correct information you've collected from GitHub, and with all correctly rendered Markdown content! */
  res.render('course', {
    component: componentMarkdownWithoutTOC,
    docs: config.docs,
    additionalMaterials: config.additionalMaterials,
    concepts: config.concepts,
    practices: config.practices,
    lessons: config.lessons,
    sources: sourcesJSON,
    breadcrumb: breadcrumbNames,
    path,
    backAndForwardPaths,
    markAsDonePaths,
    courses: allCourses,
    returnPreviousPage,
    returnNextPage,
    config,
    files: resFiles,
    user,
    ToC: componentMarkdownOnlyTOC,
    teachers,
    branches,
    selectedVersion,
    refBranch,
    currentPath: req.body.currentPath,
    markedAsDoneComponentsArr,
    allTeams
  });
};

const renderEditPage = async (req, res) => {
  const {
    config,
    path,
    allCourses,
    coursePathInGithub,
    teachers,
    branches,
    selectedVersion,
    allTeams,
    resComponents, resFiles, resSources, refBranch
  } = res.locals;

  //console.log(res.locals);
  /** Sisulehe sisu lugemine */
  const resComponentsContent = resComponents.data.content;
  const componentDecoded = base64.decode(resComponentsContent);
  const componentDecodedUtf8 = utf8.decode(componentDecoded);

  /**  Sisulehe piltide kuvamine
   * - functions: https://stackoverflow.com/a/58542933
   * - changing img src:
   * https://www.npmjs.com/package/modify-image-url-md?activeTab=explore
   */
  const start1 = performance.now();
  const markdownWithModifiedImgSources = await function1(coursePathInGithub,
    path, componentDecodedUtf8, refBranch
  );
  const end1 = performance.now();
  console.log(
    `Execution time markdownWithModifiedImgSources: ${ end1 - start1 } ms`);

  /** Each sisuleht (concepts, practices) has a sources reference which is stored in sources.json file in GitHub. */
    // define sources as NULL by default.
  let sourcesJSON = null;

  // NB! Sources are sent only with "Teemade endpointid" axios call. If
  // sourcesJSON stays NULL (is false), then content.handlebars does not
  // display "Allikad" div. If sourcesJSON gets filled (is true), then
  // "Allikad" div is displayed.
  if (resSources && resSources.data && resSources.data.content &&
    resSources.data.content !== '') {
    const sources = resSources.data;
    const sourcesDecoded = base64.decode(sources.content);
    const sourcesDecodedUtf8 = utf8.decode(sourcesDecoded);
    if (sourcesDecodedUtf8) {
      sourcesJSON = JSON.parse(sourcesDecodedUtf8);
    }
  }

  // used for adding new branch
  const curYear = new Date().getFullYear();
  const years = [curYear, curYear + 1, curYear + 2];

  // get docs/lisamaterjalid.md
  const repoPath = coursePathInGithub.split('/').pop();

  const additionalMaterials = await getFile(process.env.REPO_ORG_NAME, repoPath,
    'docs/lisamaterjalid.md', refBranch
  );

  // for each lessons get README and lisamaterjalid.md
  for await (const _m of config.config.lessons.map((lesson) => {
    getFile(process.env.REPO_ORG_NAME, repoPath,
      `lessons/${ lesson.slug }/lisamaterjalid.md`, refBranch
    ).then((material) => (lesson.additionalMaterials = material));
  })) {
    // console.log(material);
  }
  for await (const about of config.config.lessons.map(
    (lesson) => getFile(process.env.REPO_ORG_NAME, repoPath,
      `lessons/${ lesson.slug }/README.md`, refBranch
    ).then((about) => (lesson.content = about)))) {
    // console.log(material);
  }

  const allConcepts = await allCoursesController.getAllConcepts(
    allCourses,
    refBranch
  );

  // replace each lesson.component slug with object
  config.config.lessons.map((l) => {
    l.components.map((slug) => {
      const def = allConcepts.find((concept) => concept.slug === slug);
      return def || null;
    });
  });

  /** Finally you can render the course view with all correct information you've collected from GitHub, and with all correctly rendered Markdown content! */
  const viewVars = {
    component: markdownWithModifiedImgSources,
    docs: config.config.docs,
    additionalMaterials: additionalMaterials,
    concepts: config.config.concepts,
    practices: config.config.practices,
    lessons: config.config.lessons,
    sources: sourcesJSON,
    path,
    courses: allCourses,
    config: config.config,
    files: resFiles,
    user: req.user,
    teachers,
    branches,
    selectedVersion,
    refBranch,
    currentPath: req.body.currentPath,
    //allTeams,
    //years,
    allConcepts
  };

  res.render('course-edit', viewVars);
};
const allCoursesController = {
  /** For '/dashboard' route: */
  getAllCourses: async (req, res) => {
    const adminName = process.env.ADMIN_NAME;
    const adminEmail = process.env.ADMIN_EMAIL;

    const isTeacher = req.user.roles.includes('teacher');

    const start3 = performance.now();
    let allCourses = await getAllCoursesData(req);

    const end3 = performance.now();
    console.log(`Execution time getAllCoursesData: ${ end3 - start3 } ms`);
    //const allCoursesActive = allCourses.filter((x) => x.courseIsActive);

    /** Save all teachers in a variable, needed for rendering */
    //const start4 = performance.now();
    // const allTeachers = await teamsController.getUsersInTeam('teachers');
    //const allTeachers = await teamsController.getTeachers();
    //const end4 = performance.now();
    //console.log(`Execution time allTeachers: ${ end4 - start4 } ms`);

    res.locals.allCoursesActive = allCourses; // allCoursesActive;
    //res.locals.allTeacher = allTeachers;

    /** By default, courses are displayed on dashboard by their name. Set coursesDisplayBy to 'name'
     * If coursesDisplayBy is provided, use this instead - courses are then
     * displayed on dashboard by Name, Progress or Semester. Save
     * coursesDisplayBy to req.session, so dashboard would be loaded with last
     * visited coursesDisplayBy.
     */
    let coursesDisplayBy = req.session.coursesDisplayBy || 'name';

    /** For INVALID coursesDisplayBy parameters, OR if teacher tries to load courses by Progress, redirect back to /dashboard page.
     * coursesDisplayBy is defaulted to 'name'  */
    if ((req.query.coursesDisplayBy && req.query.coursesDisplayBy !== 'name' &&
      req.query.coursesDisplayBy !== 'progress' &&
      req.query.coursesDisplayBy !== 'semester') || (req.user && req.user.team
      // NB! 'teachers' team doesn't have progress bars on courses, so they
      // can't load courses by Progress:
      && isTeacher && req.query.coursesDisplayBy &&
      req.query.coursesDisplayBy === 'progress')) {
      return res.redirect('/dashboard');
    }

    /** For VALID coursesDisplayBy parameters, save req.session.coursesDisplayBy to the given coursesDisplayBy. On Dashboard, courses will be successfully displayed by either Name, Progress or Semester. */
    if (req.query.coursesDisplayBy &&
      (req.query.coursesDisplayBy === 'name' || req.query.coursesDisplayBy ===
        'semester'
        // 'teachers' team doesn't have Progress bars on courses, so check that
        // user's team is NOT 'teachers:
        || (req.query.coursesDisplayBy === 'progress' && !isTeacher))) {
      coursesDisplayBy = req.query.coursesDisplayBy;
      req.session.coursesDisplayBy = req.query.coursesDisplayBy;
    }
    res.locals.coursesDisplayBy = coursesDisplayBy;

    /** Following describes different DASHBOARD logics for TEACHER, based on given coursesDisplayBy */
    if (isTeacher) {
      /*
       * Filter allCoursesActive where the teacher is logged-in user
       */
      allCourses = allCourses.filter(
        (course) => course.teachers.some(t => t.id === req.user.userId));

      //console.log('allTeacherCourses1:', allTeacherCourses);

      /*
       * Sort allTeacherCourses, these are teacher's own courses
       */
      allCourses.sort((a, b) => a.name.localeCompare(b.name));
      // console.log('allTeacherCourses2:', allTeacherCourses);

      /* These are teachers of all other courses.
       * 1) group by teacher name
       * 2) remove logged in user from the list
       * 3) then sort by teacher name and by each teacher's courses
       * */
      /*const allCoursesGroupedByTeacher = allCoursesActive.groupBy(
       ({ teacherUsername }) => teacherUsername);
       // console.log('allCoursesGroupedByTeacher1:',
       // allCoursesGroupedByTeacher);

       delete allCoursesGroupedByTeacher[req.user.username];
       // console.log('allCoursesGroupedByTeacher2:',
       // allCoursesGroupedByTeacher);

       const sortedCoursesGroupedByTeacher = Object.keys(
       allCoursesGroupedByTeacher).sort().reduce((acc, teacher) => {
       acc[teacher] = allCoursesGroupedByTeacher[teacher].sort(
       (a, b) => a.courseName?.localeCompare(b.courseName));
       return acc;
       }, {});*/

      /**
       * Get last 7 day notifications for active courses, needed for dashboard
       */
      const allTeachers = [];
      const { courseUpdates7Days } = await allNotificationsController.getCoursesUpdates(
        allCourses, allTeachers);
      // console.log('teachers:', allCoursesActive);
      /** Rendering teacher's dashboard if courses are displayed by Name */
      if (coursesDisplayBy === 'name') {
        return res.render('dashboard-teacher', {
          adminName,
          adminEmail,
          coursesDisplayBy,
          courses: allCourses,
          user: req.user,
          teacherCourses: [], //sortedCoursesGroupedByTeacher,
          teachers: allTeachers,
          courseUpdates7Days
        });
      }
      /** Rendering teacher's dashboard if courses are displayed by Semester */
      if (coursesDisplayBy === 'semester') {
        const allCoursesGroupedBySemester = allCourses.groupBy(
          ({ semester }) => semester);

        const sortedCoursesGroupedBySemester = Object.keys(
          allCoursesGroupedBySemester).sort((a, b) => {
          // Extract the year and first letter of each element
          const [yearA, seasonA] = a.split(' ');
          const [yearB, seasonB] = b.split(' ');
          // Compare the years first
          if (yearA !== yearB) {
            return yearB - yearA;
          }
          // If the years are the same, compare the first letter
          return seasonB[0].localeCompare(seasonA[0]);
        }).reduce((acc, semester) => {
          acc[semester] = allCoursesGroupedBySemester[semester].sort(
            (a, b) => a.name.localeCompare(b.name));
          return acc;
        }, {});

        const sortedCoursesGroupedBySemesterWithFullNames = {};
        Object.keys(sortedCoursesGroupedBySemester).forEach((semester) => {
          if (Object.prototype.hasOwnProperty.call(
            sortedCoursesGroupedBySemester, semester)) {
            sortedCoursesGroupedBySemesterWithFullNames[`${ semester }`] = sortedCoursesGroupedBySemester[semester];
          }
        });

        return res.render('dashboard-teacher', {
          adminName,
          adminEmail,
          coursesDisplayBy,
          courses: sortedCoursesGroupedBySemesterWithFullNames,
          user: req.user,
          teacherCourses: [], //sortedCoursesGroupedByTeacher,
          teachers: [],
          courseUpdates7Days
        });
      }
    }

    /** Following describes different DASHBOARD logics for STUDENT, based on given coursesDisplayBy */
    if (!isTeacher) {

      /*
       * Filter allCoursesActive where the user is logged-in user
       */
      allCourses = allCourses?.filter(
        (course) => course?.students.some(t => t.id === req.user.userId));

      // Create an object to store the grouped data
      const allCoursesGroupedByTeacher = {};

      const allTeachers = [];
      // Iterate through the courses in your data
      allCourses.forEach(course => {
        // Iterate through the teachers of the current course
        course.teachers.forEach(teacher => {
          const displayName = `${ teacher.firstName } ${ teacher.lastName }`;
          // Check if the teacher's name is already in the grouped data
          if (allCoursesGroupedByTeacher[displayName]) {
            // If the teacher is already in the grouped data, push the current
            // course to their list of courses
            allCoursesGroupedByTeacher[displayName].push(course);
          } else {
            // If the teacher is not in the grouped data, create a new entry
            // for them
            getCombinedUserData(teacher.id).then((gitUserData) => {
              teacher.avatar_url = gitUserData.github.avatar_url;
            });
            allCoursesGroupedByTeacher[displayName] = [course];
          }
          allTeachers.push(teacher);
        });
      });

      const sortedCoursesGroupedByTeacher = Object.keys(
        allCoursesGroupedByTeacher).sort().reduce((acc, teacher) => {
        acc[teacher] = allCoursesGroupedByTeacher[teacher].sort(
          (a, b) => a.name.localeCompare(b.name));
        return acc;
      }, {});

      /**
       * Get last 7 day notifications for active courses, needed for dashboard
       */
      const { courseUpdates7Days } = await allNotificationsController.getCoursesUpdates(
        allCourses, []);

      /** Next, you must get all active courses WITH the list of components that have been markedAsDone. Use the allCoursesController.allCoursesActiveWithComponentsData() function that store those courses. */
      let courses;
      if (req.user && req.user.userId) {
        courses = await allCoursesController.allCoursesActiveWithComponentsData(
          allCourses, req.user.id);
      } else {
        courses = allCourses;
      }

      courses = await allCoursesController.allCoursesActiveWithComponentsUUIDs(
        courses);

      courses.map((c) => c.teacher = c.teachers[0].firstName + ' ' +
        c.teachers[0].lastName);
      res.locals.allCoursesActive = courses;

      //console.log('coursesDisplayBy1:', courses);
      /** Test entries for student: */
      /* courses[0].markedAsDoneComponentsUUIDs.push('9f953cdc-4d0d-4700-b5d0-90857cc039b9');
       courses[1].markedAsDoneComponentsUUIDs.push('73deac36-adf9-4205-9e69-dba0bc7976f1');
       courses[1].markedAsDoneComponentsUUIDs.push('188625d2-e039-4ea7-9737-2d4396820ec1');
       courses[1].markedAsDoneComponentsUUIDs.push('c6a0a770-7f11-425d-a748-f0a9fe13f89e');
       // courses[2].markedAsDoneComponentsUUIDs.push('8425abdd-9690-4bab-92b6-1c6feb5aead9');
       // courses[2].markedAsDoneComponentsUUIDs.push('138e043e-9aab-4400-85c8-d72d242f670b');
       // courses[2].markedAsDoneComponentsUUIDs.push('f24f3ffb-199d-4b78-aa00-dce4992f18d9');
       courses[4].markedAsDoneComponentsUUIDs.push('1bca8c63-7637-4a6f-844d-c0a231cbd397');
       courses[3].markedAsDoneComponentsUUIDs.push('fbbbf667-ec8b-4287-baad-6975b917f505');
       courses[3].markedAsDoneComponentsUUIDs.push('ea8b329e-1585-4d13-abcb-60d2c01a4da3');
       courses[3].markedAsDoneComponentsUUIDs.push('9e552ecd-728c-4556-91e9-d42611393dbe');
       courses[3].markedAsDoneComponentsUUIDs.push('750a3a40-6f2e-4575-b684-79608403642c'); */

      //console.log('allTeachers1:', allTeachers);
      /** Rendering student's dashboard if courses are displayed by Name */
      if (coursesDisplayBy === 'name') {
        return res.render('dashboard-student', {
          coursesDisplayBy,
          courses,
          adminName,
          adminEmail,
          user: req.user,
          teacherCourses: sortedCoursesGroupedByTeacher,
          teachers: allTeachers,
          courseUpdates7Days
        });
      }
      /** Rendering student's dashboard if courses are displayed by Progress */
      if (coursesDisplayBy === 'progress') {
        /**
         * Sort courses by the % of elements in markedAsDoneComponentsUUIDs
         * that are included in the courseBranchComponentsUUIDs array. A'ka the
         * precentage of markedAsDone components. If two elements have the same
         * %, these elements are sorted by courseName
         */
        courses.sort((a, b) => {
          const aLength = a.courseBranchComponentsUUIDs.length;
          const bLength = b.courseBranchComponentsUUIDs.length;
          const aDoneLength = a.markedAsDoneComponentsUUIDs.filter(
            (uuid) => a.courseBranchComponentsUUIDs.includes(uuid)).length;
          const bDoneLength = b.markedAsDoneComponentsUUIDs.filter(
            (uuid) => b.courseBranchComponentsUUIDs.includes(uuid)).length;
          const aPercentage = aLength > 0 ? aDoneLength / aLength : 0;
          const bPercentage = bLength > 0 ? bDoneLength / bLength : 0;

          if (aPercentage === bPercentage) {
            return a.name.localeCompare(b.name);
          }
          if (aPercentage === 0) {
            return 1;
          }
          if (bPercentage === 0) {
            return -1;
          }
          return bPercentage - aPercentage;
        });
        // console.log('courses2:', courses);

        return res.render('dashboard-student', {
          coursesDisplayBy,
          courses,
          adminName,
          adminEmail,
          user: req.user,
          teacherCourses: sortedCoursesGroupedByTeacher,
          teachers: [], //allTeachers,
          courseUpdates7Days
        });
      }
      /** Rendering student's dashboard if courses are displayed by Semester */
      if (coursesDisplayBy === 'semester') {
        const allCoursesGroupedBySemester = courses.groupBy(
          ({ semester }) => semester);

        const sortedCoursesGroupedBySemester = Object.keys(
          allCoursesGroupedBySemester).sort((a, b) => {
          // Extract the year and first letter of each element
          const [yearA, seasonA] = a.split(' ');
          const [yearB, seasonB] = b.split(' ');
          // Compare the years first
          if (yearA !== yearB) {
            return yearB - yearA;
          }
          // If the years are the same, compare the first letter
          return seasonB[0].localeCompare(seasonA[0]);
        }).reduce((acc, semester) => {
          acc[semester] = allCoursesGroupedBySemester[semester].sort(
            (a, b) => a.name.localeCompare(b.name));
          return acc;
        }, {});

        const sortedCoursesGroupedBySemesterWithFullNames = {};
        Object.keys(sortedCoursesGroupedBySemester).forEach((semester) => {
          if (Object.prototype.hasOwnProperty.call(
            sortedCoursesGroupedBySemester, semester)) {
            sortedCoursesGroupedBySemesterWithFullNames[`${ semester }`] = sortedCoursesGroupedBySemester[semester];
          }
        });
        // console.log('sortedCoursesGroupedBySemesterWithFullNames1:',
        // sortedCoursesGroupedBySemesterWithFullNames);

        return res.render('dashboard-student', {
          coursesDisplayBy,
          adminName,
          adminEmail,
          courses: sortedCoursesGroupedBySemesterWithFullNames,
          user: req.user,
          teacherCourses: sortedCoursesGroupedByTeacher,
          teachers: [], //allTeachers,
          courseUpdates7Days
        });
      }
    }

    /** If isTeacher is somehow neither true/false, redirect back to /dashboard. */
    console.log('isTeacher is neither true/false');
    return res.redirect('/dashboard');
  }, /** For '/course/:courseSlug/:contentSlug?/:componentSlug?' route */
  getSpecificCourse: async (req, res, next) => {
    /** Read parameters sent with endpoint */
    const {
      courseId, contentSlug, componentSlug
    } = req.params;

    //return res.send(`${ courseId }, ${ contentSlug }, ${ componentSlug }`);
    res.locals.user = req.user;
    const { ref } = req.query;
    const isTeacher = req.user.roles.includes('teacher');

    /** If user's team is not found, route to /notfound. Only users with valid team are allowed to see course content. This is checked with app.js. */
    /*if (!req.user.team.slug) {
     return res.redirect('/notfound');
     }*/

    /*const teamSlug = req.user.team.slug;
     res.locals.teamSlug = teamSlug;*/

    /** selectedVersion variable refers to either:
     * - teacher's selected version on a course page
     * - manually entered ref= value in URL.
     * selectedVersion variable is used down below to get correct course
     * version from GitHub.
     */
    const selectedVersion = ref || null;
    res.locals.selectedVersion = selectedVersion;
    //console.log('selectedVersion1:', selectedVersion);

    // console.log('markedAsDoneComponentsArr10:', markedAsDoneComponentsArr);
    res.locals.markedAsDoneComponentsArr = await getMarkedAsDoneComponents(
      req.user.userId,
      courseId
    );

    //console.log(
    //  'markedAsDoneComponentsArr10:', res.locals.markedAsDoneComponentsArr);

    /** Get all available courses for the user. */
    //const start7 = performance.now();
    //const allCourses = await getAllCoursesData(req);
    //const end7 = performance.now();
    //console.log(`Execution time allCourses: ${ end7 - start7 } ms`);

    //const allCoursesActive = allCourses.filter((x) => x.courseIsActive);
    //allCoursesActive.sort((a, b) => a.courseName.localeCompare(b.courseName));
    // console.log('allCoursesActive2:', allCoursesActive);

    /** Get the selected course that was accessed with current endpoint  */
    let course = await apiRequests.getCourseById(courseId);

    if (!course) {
      return res.redirect('/notfound');
    }
    //course = course.data.data;

    let validBranches = [];
    // in edit mode get all versions
    if (isTeacher) {
      validBranches = await apiRequests.listBranches(
        course.repository.replace('https://github.com/', ''));

      validBranches = validBranches.map((b) => b.name);
    }

    if (validBranches.length === 0) { // repo not found
      return res.redirect('/notfound');
    }

    // if selectedVersion='draft', check if branch exists, if not create it
    // from master
    if (selectedVersion === 'draft' && !validBranches.includes('draft')) {
      const newBranch = await apiRequests.createNewBranch(
        course.repository.replace('https://github.com/', ''), 'master',
        'draft'
      );
    }

    let courseConfig = await getCourseData(course, selectedVersion);
    // if we are missing config file, create it...
    if (!courseConfig || !courseConfig.config) {
      courseConfig = { config: null };
      courseConfig.config = await createConfig(course, selectedVersion);
      //console.log(test);
      //return res.send('missing config');
    }

    course = { ...course, ...courseConfig };

    res.locals.course = course;
    //await teamsController.getUsersInTeam('teachers');
    // console.log('allTeachers0:', allTeachers);
    res.locals.teachers = [];

    /** Check if course Repo has a branch that matches user team's slug.
     * -- If yes, then all GitHub requests must refer to this branch. In the
     * app, STUDENT must see data only from the branch that has a matching Team
     * name. E.g. student in team "rif20" should only see course information
     * from branch "rif20" for any course, if such branch exists.
     * -- If such branch doesn't exist, then STUDENT should see data from
     * master/main branch. For TEACHERS, the logic is explained on following
     * rows.
     */

    /** refBranch variable refers to the repo branch where course data must be read. refBranch is defined on following rows. */

    /** Get all course branches that have config as active:true */
    /*try {
     validBranches = await apiRequests.validBranchesService(
     course.coursePathInGithub
     );
     } catch (error) {
     console.error(error);
     }*/

    /**
     * KURSUSE ÕIGE VERSIOONI NÄITAMISE LOOGIKA:
     * 1. Kui on antud selectedVersion ja kursuse aktiivsete branchide all on
     * sama nimega branch, siis loe infot sellest branchist
     * 2. Kui on antud selectedVersion, ja kursuse aktiivsete branchide all EI
     * OLE sama nimega branchi, siis suuna /notfound lehele. St, et kasutaja
     * püüdis URLi ligi pääseda kursusele versioonile, mis ei ole aktiivne.
     * 3. Kui pole antud selectedVersion, siis vaata, kas kursuse aktiivsete
     * branchide all on kasutaja tiiminimega sama branch. Kui jah, siis loe
     * infot sellest branchist
     * 4. Kui pole antud selectedVersion, ja kui kursuse aktiivsete branchide
     * all EI OLE kasutaja tiiminimega sama nimega branchi, siis pead
     * kontrollima, kas kasutaja on äkki 'teachers' tiimis (NB! ('teachers')
     * tiimil pole enda nimega branche).
     * -- 4a. Kui kasutaja ON 'teachers' tiimis, siis sa pead leidma aktiivsete
     * branchide alt esimese kursuse, mille teacherUsername on kasutaja
     * username. Kui kursusel nii master kui ka rif20 branchid aktiivsed, aga
     * masteri teacher on muu kasutaja, siis peab sisseloginud kasutajale
     * kuvama rif20 branchi, kus tema on määratud õpetaja. St, tagasta kursuse
     * esimene aktiivne branch, mille lingitud õpetaja on sisseloginud õpetaja.
     * -- 4b. Kui kasutaja ON 'teachers' tiimis, ja kui aktiivsete branchide
     * all pole ühtegi versioon, mille teacherUsername on sisseloginud
     * kasutaja, siis tagasta kursuse esimene aktiivne branch.
     * -- 4c. Kui kursuse all pole ühtegi aktiivset branchi, suuna "/notfound"
     * lehele.
     * 5. Kui kasutaja EI OLE 'teachers' tiimis, aga kui aktiivsete branchide
     * all on mõni versioon, siis tagasta esimene aktiivne versioon.
     * 6. Kui kasutaja EI OLE 'teachers' tiimis, pole antud selectedVersion ja
     * kasutaja tiim pole validBranches hulgas, siis suuna "/notfound" lehele.
     */

    // 1.
    /*if (selectedVersion && validBranches.includes(selectedVersion)) {
     refBranch = selectedVersion;
     // 2.
     } else if (selectedVersion && !validBranches.includes(selectedVersion)) {
     return res.redirect('/notfound');
     // 3.
     } else if (!selectedVersion && validBranches.includes(teamSlug)) {
     refBranch = teamSlug;
     // 4.
     } else if (!selectedVersion && !validBranches.includes(teamSlug)) {
     const validBranchConfigPromises = validBranches.map(async (branch) => {
     return await getConfig(course.coursePathInGithub, branch);
     });
     const validBranchConfigs = await Promise.all(validBranchConfigPromises);
     // console.log('validBranchConfigs1:', validBranchConfigs);

     if (allTeachers.find((teacher) => teacher.login === req.user.username)) {
     validBranchConfigs.findIndex(
     (config) => config.teacherUsername === req.user.username
     );

     return res.redirect('/notfound');
     }
     // 5.
     if (validBranches.length >= 0) {
     const firstActiveBranchIndex = validBranchConfigs.findIndex(
     (config) => config.active === true
     );
     refBranch = validBranches[firstActiveBranchIndex];
     }
     // 6.
     } else {
     return res.redirect('/notfound');
     }*/

    // console.log('refBranch3:', refBranch);

    /**
     * Save refBranch to res.locals. This is used by coursesService.js file.
     */
    res.locals.refBranch = ref;
    res.locals.branches = validBranches;
    res.locals.allTeams = []; /*(await teamsController.getAllValidTeams()).teams // get all teams names except
     // for teachers and existing
     // branches
     .filter(
     (team) => team.name !== 'Teachers' && !validBranches.includes(team.name)
     ).map((team) => team.name);*/

    /** Get config file for given course and its correct refBranch */
    /*let config;

     try {
     config = await getConfig(course.coursePathInGithub, refBranch);
     } catch (error) {
     console.log(
     'No config found with getConfig function when loading course page. Rerouting to /notfound.'
     );
     return res.redirect('/notfound');
     }*/

    /*console.log(
     `reading content data for ${ course.coursePathInGithub } from ${ refBranch } branch`
     );*/

    // console.log('config2:', config);
    // console.log('config.lessons2:', config.lessons);

    res.locals.course = course;
    //res.locals.courses = [course];
    res.locals.config = courseConfig;
    res.locals.allCourses = []; //allCoursesActive;

    /** Get arrays of components where Back and Forward buttons must be displayed.
     * Get arrays of components where "Märgi loetuks" options must be
     * displayed. */
    const {
      backAndForwardPaths, markAsDonePaths
    } = setCourseButtonPaths(courseConfig.config);
    //console.log('backAndForwardPaths4:', backAndForwardPaths);
    //console.log('markAsDonePaths4:', markAsDonePaths);
    res.locals.backAndForwardPaths = backAndForwardPaths;
    res.locals.markAsDonePaths = markAsDonePaths;

    /** Following code works directly on the config file that was received.
     * It uses parameters given with current endpoint (courseSlug, contentSlug,
     * componentSlug) and finds matching elements from the config file. Once
     * matching element is found from the config file, it makes a request to
     * Github to pull this information with Github API.
     */

    /**
     * Find from multiple object arrays
     * For contentSlug, find slug from docs, additionalMaterials, lessons,
     * lessons additionalMaterials For componentSlug, find slug from concepts,
     * practices If exists, add to breadcrumbNames and path
     */

    /**
     * Collect docs arrays from config under one object array.
     */

    let docsArray = courseConfig.config?.docs?.concat(
      courseConfig.config.additionalMaterials, courseConfig.config.lessons);
    courseConfig.config?.lessons?.forEach((x) => {
      docsArray = docsArray.concat(x.additionalMaterials);
    });
    /**
     * Then check for matching slug from docs object array.
     * If a match, get the respective contentName.
     */
    let contentName;
    let githubRequest;

    /**
     * Sisulehe content ja componenti UUID lugemine config failist, andmebaasis
     * sisulehe märkimiseks
     */
    let contentUUId = '';
    let componentUUId = '';
    let componentName = '';
    let componentType = '';

    //console.log(courseConfig.config);
    //return res.send(courseConfig.config);
    courseConfig.config?.docs?.forEach((x) => {
      if (x.slug === contentSlug) {
        contentName = x.name;
        githubRequest = 'docsService';
      }
    });
    courseConfig.config?.additionalMaterials?.forEach((x) => {
      if (x.slug === contentSlug) {
        contentName = x.name;
        githubRequest = 'courseAdditionalMaterialsService';
        // console.log('Slug found in config.additionalMaterials');
      }
    });
    courseConfig.config?.lessons?.forEach((x) => {
      if (x.slug === contentSlug) {
        contentName = x.name;
        contentUUId = x.uuid;
        githubRequest = 'lessonsService';
        // console.log('Slug found in config.lessons');
      }
    });

    /**
     * Check for matching slug from concepts, practices and lessons
     * additionalMaterials arrays. If a match, get the componentName,
     * componentUUID and set componentType.
     */

    courseConfig.config?.concepts?.forEach((x) => {
      if (x.slug === componentSlug) {
        const lesson = courseConfig.config.lessons?.find(
          (les) => les.components.includes(componentSlug));
        // console.log('lesson1:', lesson);

        if (lesson && lesson.slug === contentSlug) {
          componentName = x.name;
          componentUUId = x.uuid;
          componentType = 'concept';
          githubRequest = 'lessonComponentsService';
          // console.log('Slug found in config.concepts');
        }
      }
    });
    courseConfig.config?.practices?.forEach((x) => {
      if (x.slug === componentSlug) {
        const lesson = courseConfig.config?.lessons?.find(
          (les) => les.components.includes(componentSlug));
        // console.log('lesson1:', lesson);

        if (lesson && lesson.slug === contentSlug) {
          componentName = x.name;
          componentUUId = x.uuid;
          componentType = 'practice';
          githubRequest = 'lessonComponentsService';
          // console.log('Slug found in config.concepts');
        }
      }
    });
    courseConfig.config?.lessons?.forEach((x) => {
      if (x.additionalMaterials[0].slug === componentSlug && x.slug ===
        contentSlug) {
        componentName = x.additionalMaterials[0].name;
        componentType = 'docs';
        githubRequest = 'lessonAdditionalMaterialsService';
        // console.log('Slug found in config.lessons.additionalMaterials');
      }
    });

    /** You can check all relevant values about current endpoint:
     */
    // console.log('courseSlug1:', courseSlug);
    // console.log('course.courseName1:', course.courseName);
    // console.log('contentSlug1:', contentSlug);
    // console.log('contentName1:', contentName);
    // console.log('contentUUID1:', contentUUID);
    // console.log('componentSlug1:', componentSlug);
    // console.log('componentName1:', componentName);
    //console.log('componentUUID1:', componentUUId);
    // console.log('githubRequest1:', githubRequest);

    /**
     * IF contentSlug exists, but contentName is NOT returned from config file.
     * OR if contentSlug, contentName and componentSlug exist, but
     * componentName is NOT returned from config file. THEN
     * - a) user accessed an URL that does not match with the config file.
     * - b) config file has inconsistencies (lesson components do not match
     * with concepts or practices arrays). Config file MUST BE checked for any
     * inconsistencies. Redirect back to homepage!
     */
    if ((contentSlug && !contentName) ||
      (contentSlug && contentName && componentSlug && !componentName)) {
      console.log(
        'no contentName or componentName found', contentSlug, contentName,
        componentSlug, componentName
      );
      return res.redirect('/notfound');
    }

    /** Function to set correct fullPath, depending on if componentSlug and/or contentSlug exist.
     * This defines correct fullPath, depending how deep into subpages you are.
     * This is used to assign correct a href-s for sidebar elements and for
     * Back/Forward buttons.
     */
    function getFullPath() {
      if (componentSlug) {
        return `${ contentSlug }/${ componentSlug }`;
      }
      if (contentSlug) {
        return `${ contentSlug }`;
      }
      return undefined;
    }

    /** Function to set correct componentType, depending on if componentSlug and/or contentSlug exist.
     * This defines correct componentType, depeonding how deep into subpages
     * you are. This is used to assign correct sidebar icons.
     */
    function getType() {
      if (componentSlug) {
        return componentType;
      }
      if (contentSlug) {
        return 'docs';
      }
      return undefined;
    }

    /**  Save page names for breadcrumbs. */
    const breadcrumbNames = {
      courseName: course.courseName, contentName, componentName
    };
    /** Save all relevant info about current page: slugs, fullPath, menu icons. These are used to render correct info on given page with responseAction() and renderPage() functions. */
    const path = {
      courseId,
      contentSlug,
      componentSlug,
      refBranch: 'master',
      contentUUId,
      componentUUId,
      fullPath: getFullPath(contentSlug, componentSlug),
      type: getType(contentSlug, componentSlug)
    };

    res.locals.githubRequest = githubRequest;
    res.locals.coursePathInGithub = course.repository.replace(
      'https://github.com/', '');
    res.locals.breadcrumbNames = breadcrumbNames;
    res.locals.path = path;

    return next();
  },

  /** The function allCoursesActiveWithComponentsData() is used to get info about markedAsDone components for each active course for the given user (githubID).
   * Parameters are list of all active courses + user's githubID whose
   * markedAsDone info is requested.
   */
  allCoursesActiveWithComponentsData: async (allCoursesActive, githubID) => {
    /** First, for each course, get a list of component UUIDs that has been marked as done. Save this to allCoursesActiveDoneComponentsArr array. */
    const allCoursesActiveDoneComponentsPromises = allCoursesActive.map(
      (course) => getMarkedAsDoneComponents(githubID, course.id));

    const allCoursesActiveDoneComponentsArr = await Promise.all(
      allCoursesActiveDoneComponentsPromises);
    /*console.log(
     'allCoursesActiveDoneComponentsArr1:',
     allCoursesActiveDoneComponentsArr
     );*/

    /** Then, again for each course, add the respective array of done components as a key-value pair: */
    allCoursesActive.forEach((course, index) => {
      allCoursesActive[index].markedAsDoneComponentsUUIDs = allCoursesActiveDoneComponentsArr[index];
    });

    /** You now have a list of active courses where each course has a list of markedAsDone components' UUIDs by the given user. */
    // console.log('allCoursesActive1:', allCoursesActive);
    return allCoursesActive;
  },

  allCoursesActiveWithComponentsUUIDs: async (allCoursesActive) => {
    /** First, for each course, get a list of component UUIDs  */
    const allCoursesActiveComponentsUUIDsPromises = allCoursesActive.map(
      (course) => getComponentsUUIDs(course.repository));

    const allCoursesActiveDoneComponentsUUIDsArr = await Promise.all(
      allCoursesActiveComponentsUUIDsPromises);

    /** Then, again for each course, add the respective array of done components as a key-value pair: */
    allCoursesActive.forEach((course, index) => {
      allCoursesActive[index].courseBranchComponentsUUIDs = allCoursesActiveDoneComponentsUUIDsArr[index];
    });

    return allCoursesActive;
  },
  getAllConcepts: async (courses, refBranch) => {
    if (cacheConcepts.has('concepts')) {
      return new Promise((resolve) => {
        console.log('✅✅  concepts IS from cache');
        resolve(cacheConcepts.get('concepts'));
      });
    }
    console.log('❌❌ concepts IS NOT from cache');
    const allConcepts = [];
    await Promise.all(courses.map(async (course) => {
      const folderContent = await getFolder(process.env.REPO_ORG_NAME,
        course.courseSlugInGithub, 'concepts', refBranch
      );
      course.config.concepts.forEach((concept) => {
        // find where is concept defined
        if (folderContent.filter((f) => f.name === concept.slug).length) {
          concept.course = course.courseSlugInGithub;
        }
        // vaata kas sama uuid'ga on juba kirje, kui on, siis lisa sellele
        // usedIn
        const isDefined = allConcepts.find((c) => c.uuid === concept.uuid);
        if (isDefined) {
          if (Array.isArray(isDefined.usedIn)) {
            isDefined.usedIn.push(course.courseSlugInGithub);
          } else {
            isDefined.usedIn = [course.courseSlugInGithub];
          }
        } else {
          concept.course = course.courseSlugInGithub;
          if (Array.isArray(concept.usedIn)) {
            concept.usedIn.push(course.courseSlugInGithub);
          } else {
            concept.usedIn = [course.courseSlugInGithub];
          }
          allConcepts.push(concept);
        }
      });
    }));
    cacheConcepts.set('concepts', allConcepts);

    return allConcepts.filter((c) => !!c.course)
      .sort((a, b) => a.name > b.name ? 1 : b.name > a.name ? -1 : a.course >
      b.course ? 1 : b.course > a.course ? -1 : 0);
  },

  getOtherTeachersCourses: async (req, res) => {
    const user = req.user;

    const allCourses = await apiRequests.getAllCourses();

    if (!allCourses.data.data.length > 0) {
      res.redirect('/');
    }

    let teacherCourses = allCourses.data.data.filter(
      course => !course.teachers.some(teacher => user.userId === teacher.id)
    );

    // Flatten the array
    let flatArray = await Promise.all(
      teacherCourses.flatMap(
        async course => {
          return await Promise.all(course.teachers.map(
            async teacher => {
              const teacherData = await getCombinedUserData(teacher.id);
              teacher.displayName = teacher.firstName + ' ' +
                teacher.lastName;
              teacher.avatar_url = teacherData.github.avatar_url;
              delete course.teachers;
              delete course.students;
              return { ...teacher, course: course };
            }));
        }));

    //Sort by teacher name
    let sortedArray = flatArray.flat().sort(
      (a, b) => a.displayName.localeCompare(b.displayName));

    //const result = [];
    teacherCourses = Object.values(
      sortedArray.reduce((acc, { course, ...x }) => {
        acc[x.id] = acc[x.id] || { ...x, courses: [] };
        acc[x.id].courses.push(course);
        return acc;
      }, {}));

    return res.render('other-teachers', {
      teacherCourses,
      user
    });

  },
  getOisContent: async (req, res) => {
    let longDescription = '';
    let course = await usersApi.get(
      membersRequests.getCourse + req.query.courseId)
      .catch((error) => {
        console.error(error);
      });

    if (course) {
      course = course.data.data;
      await axios('https://ois2.tlu.ee/tluois/aine/' + course.code)
        .then((response) => {
          const { data } = response;
          const $ = cheerio.load(data);

          $('.yldaine_r', data).each(function () {
            const yldaineC1 = $(this).find('div.yldaine_c1').text();
            const yldaineC2 = $(this).find('div.yldaine_c2').text();

            switch (yldaineC1) {
              case 'Õppeaine sisu lühikirjeldus':
                longDescription = yldaineC2;
                break;
              case 'Õppeaine õpiväljundid':
                longDescription += '\n\n ' + yldaineC2;
                break;
            }
          });

          return res.json(conf);
        })
        .catch(() => {
          console.log('ois fetch error');
        });
    }

    return res.json({ data: longDescription });
  },
  getAllLessons: async (searchTerm, courses, refBranch) => {
    if (cacheLessons.has('lessons')) {
      return new Promise((resolve) => {
        console.log('✅✅  lessons IS from cache');
        resolve(cacheLessons.get('concepts'));
      });
    }
    console.log('❌❌ lessons IS NOT from cache');
    const allLessons = [];
    await Promise.all(courses.map(async (course) => {
      const folderContent = await getFolder(process.env.REPO_ORG_NAME,
        course.courseSlugInGithub, 'lessons', refBranch
      );
      course.config.lessons.forEach((lesson) => {
        if (folderContent.filter((f) => f.name === lesson.slug).length) {
          lesson.course = course.courseSlugInGithub;
          allLessons.push(lesson);
        }
      });
    }));
    cacheLessons.set('lessons', allLessons);
    return allLessons;
  },
  updateCourseData: async (req, res) => {
    const body = req.body;
    const keys = Object.keys(body);
    const values = Object.values(body);
    const response = {};
    const courseId = req.body.courseId;
    if (courseId) {
      const course = await apiRequests.getCourseById(courseId);
      const repoName = course.repository.replace('https://github.com/', '');
      const [owner, repo] = repoName.split('/');

      // handle file uploads
      if (req.files) {
        const fileKey = Object.keys(req.files)[0];
        const path = fileKey + req.files[fileKey].name;
        const content = req.files[fileKey].data.toString('base64');
        await uploadFile(
          owner, repo, path, content, 'file added: ' + path,
          'draft',
          true
        );
        // todo update files data
      }
      // courseId is always there, so we start from index 1
      for (let i = 1; i < keys.length; i++) {
        response[keys[i]] = values[i];
        console.log(`Key: ${ keys[i] }, Value: ${ values[i] }`);
        if (keys[i].startsWith('config/')) { // update config file
          // key = config/courseName
          const config = await getConfig(repoName, 'draft');
          const updatedConfig = updateConfigFile(keys[i], values[i], config);
          await updateFile(
            owner, repo, 'config.json',
            { content: JSON.stringify(updatedConfig), sha: updatedConfig.sha },
            'course edit', 'draft'
          );
          cacheConfig.set(`getConfig:${ repoName }+draft`, updatedConfig);
        } else if (keys[i].endsWith('.md')) { // update file in folder
          // get file sha
          const oldFile = await getFile(owner, repo, keys[i], 'draft');
          await updateFile(
            owner, repo, keys[i],
            { content: values[i], sha: oldFile.sha },
            'file edit: ' + keys[i], 'draft'
          );
        } else {
          console.log(`Key: ${ keys[i] }, Value: ${ values[i] }`);
        }
      }
      return res.json(response);
    }
    return res.status(500).send('error');
  },
  /*
   Kursuse muutmine:
   concepts = [
   {
   "slug": "naidis-sisuteema",
   "name": "Näidis Sisuteema",
   "uuid": "7cc19837-3dfe-4da7-ac2e-b4f7132fb3a4"
   }, {
   "slug": "sisu-loomise-juhend",
   "name": "Sisu loomise juhend",
   "uuid": "49b640ef-5c58-41e2-9392-4514f49a9c17"
   }],

   kasutaja peab saama "linkida" teistest repodest.
   Link tähendab, et config.json concepts osas on objekt, mis kuulub tegelikult teise reposse.
   Kasutaja peab saama otsida concepte (esialgu nime järgi, aga ka sisu järgi),
   kasutaja peab nägema eelvaadet,
   kasutaja peab saama muuta concepti - kui on lingitud sisu, siis näeb, kus veel on kasutatud,
   kui hakkab sisu muutma, siis peaks saama valida, kas muudab originaali kõikjal, või luuakse orig põhjal uus sisu

   Äkki võiks sama loogika olla ka teiste plokkide kohta (lessons, praktikumid)

   */
  async publishCourse(course) {
    const mergeResponse = await apiRequests.mergeMasterWithDraft(
      course.repository.replace('https://github.com/', ''),
      'Shipped cool_feature!'
    );
    if (mergeResponse.status === 204 || mergeResponse.status === 201) { // delete draft branch
      return await apiRequests.deleteBranch(
        course.repository.replace('https://github.com/', ''),
        'draft'
      );
    }
    return false;
  }
};
export {
  allCoursesController,
  responseAction,
  renderPage,
  renderEditPage,
  getMarkedAsDoneComponents
};
