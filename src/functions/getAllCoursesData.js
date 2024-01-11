import { performance } from 'perf_hooks';
import * as cheerio from 'cheerio';
import { axios } from '../setup/setupGithub.js';
import { cacheOisContent } from '../setup/setupCache.js';
import { getConfig } from './getConfigFuncs.js';
import dotenv from 'dotenv';
import membersRequests from './usersHkTluRequests.js';
import { usersApi } from '../setup/setupUserAPI.js';

dotenv.config();

const { requestGroups, getAllCourses } = membersRequests;

const coursePromise = (param, refBranch, validBranches) => getConfig(
  param.repository, refBranch).then(async (config) => {
  if (!config) {
    console.log(`No config found for ${ param.repository }, ${ refBranch }`);
    return {};
  }

  /** Read course information from ÕIS Ainekaart using the courseUrl value from config file.
   * Guide: https://hackernoon.com/how-to-build-a-web-scraper-with-nodejs
   * Then store info from ÕIS Ainekaart under a course's object.
   * Finally return the object.
   */
  let oisContent = {};

  const routePathOisContent = `oisContent+${ param.repository }+${ refBranch }`;

  const start6 = performance.now();

  if (!cacheOisContent.has(routePathOisContent)) {
    console.log(`❌❌ oisContent IS NOT from cache: ${ routePathOisContent }`);

    try {
      await axios(config.courseUrl).then((response) => {
        const { data } = response;
        const $ = cheerio.load(data);

        $('.yldaine_r', data).each(function () {
          const ryhmHeader = $(this).find('div.ryhmHeader').text();
          const yldaine_c1 = $(this).find('div.yldaine_c1').text();
          const yldaine_c2 = $(this).find('div.yldaine_c2').text();

          if (ryhmHeader && ryhmHeader !== '') {
            oisContent.oisName = ryhmHeader;
          }
          if (yldaine_c1 && yldaine_c1 === 'Õppeaine kood') {
            oisContent.code = yldaine_c2;
          }
          if (yldaine_c1 && yldaine_c1 === 'Õppeaine nimetus eesti k') {
            oisContent.name = yldaine_c2;
          }
          if (yldaine_c1 && yldaine_c1 === 'Õppeaine maht EAP') {
            oisContent.EAP = yldaine_c2;
          }
          if (yldaine_c1 && yldaine_c1 === 'Kontrollivorm') {
            oisContent.grading = yldaine_c2;
          }
          // if (yldaine_c1 && yldaine_c1 === 'Õppeaine eesmärgid')
          // oisContent.eesmargid = yldaine_c2; if (yldaine_c1 && yldaine_c1
          // === 'Õppeaine sisu lühikirjeldus') oisContent.summary =
          // yldaine_c2; if (yldaine_c1 && yldaine_c1 === 'Õppeaine
          // õpiväljundid') oisContent.opivaljundid = yldaine_c2;
        });
      });
    } catch (error) {
      // console.error(error);
      console.error('ÕIS fetch error: ', config.courseUrl);
    }

    cacheOisContent.set(routePathOisContent, oisContent);
  } else {
    console.log(`✅✅ oisContent FROM CACHE: ${ routePathOisContent }`);
    oisContent = cacheOisContent.get(routePathOisContent);
  }
  const end6 = performance.now();
  console.log(`Execution time oisContent: ${ end6 - start6 } ms`);

  // console.log('oisContent.name5:', oisContent.name);

  // console.log('config5:', config);
  const allComponentSlugs = [];

  config.lessons.forEach((lesson) => {
    allComponentSlugs.push(lesson.components);
  });

  const allComponentSlugsFlat = [].concat(...allComponentSlugs);
  // console.log('allComponentSlugsFlat5:', allComponentSlugsFlat);

  const allComponentsUUIDs = [
    ...config.concepts.filter(
      (concept) => allComponentSlugsFlat.includes(concept.slug))
      .map((concept) => concept.uuid),
    ...config.practices.filter(
      (practice) => allComponentSlugsFlat.includes(practice.slug))
      .map((practice) => practice.uuid)];

  // console.log('allComponentsUUIDs5:', allComponentsUUIDs);

  return {
    courseUrl: config.courseUrl,
    teacherUsername: config.teacherUsername,
    courseIsActive: config.active,
    courseName: config.courseName || oisContent.name,
    courseSlug: oisContent.code, // || result.slug,
    courseCode: oisContent.code, // || result.courseCode,
    courseSemester: config.semester,
    courseSlugInGithub: param.name,
    coursePathInGithub: param.full_name,
    courseEAP: Math.round(oisContent.EAP),
    courseGrading: oisContent.grading, // courseEesmargid: oisContent.eesmargid,
    // courseSummary: oisContent.summary,
    // courseOpivaljundid: oisContent.opivaljundid,
    refBranch,
    courseBranchComponentsUUIDs: allComponentsUUIDs,
    courseAllActiveBranches: validBranches,
    config
  };
});

const getAllCoursesData = async (req) => {
  const { user } = req;

  // if user is set get user specific courses, otherwise get all courses
  const courses = await usersApi.get(
    user ? requestGroups + user.userId : getAllCourses)
    .catch((error) => {
      console.error(error);
    });

  return courses ? courses.data.data : [];
};

export default getAllCoursesData;
