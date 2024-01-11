import axios from 'axios';
import {
  cacheBranches,
  cacheFiles,
  cachePageContent, cacheTeamCourses
} from '../../setup/setupCache.js';
import githubReposRequests from '../../functions/githubReposRequests.js';
import { authToken } from '../../setup/setupGithub.js';
import { getConfig } from '../../functions/getConfigFuncs.js';
import { Octokit } from 'octokit';
import { usersApi } from '../../setup/setupUserAPI.js';
import membersRequests from '../../functions/usersHkTluRequests.js';

const {
  requestDocs,
  requestCourseAdditionalMaterials,
  requestCourseFiles,
  requestLessons,
  requestLessonAdditionalMaterials,
  requestLessonFiles,
  requestConcepts,
  requestSources,
  requestPractices,
  requestRepoBranches
} = githubReposRequests;

/**
 * Define files to ignore from Github /files folders
 */
const ignoreFiles = ['.DS_Store', '.gitkeep'];

const octokit = new Octokit({
  auth: process.env.AUTH
});
/**
 * Define all API requests that are done to GitHub API
 */
const apiRequests = {
  validBranchesService: async (coursePathInGithub) => {
    const routePath = `${ coursePathInGithub }+branches`;
    /**
     * Get list of repo branches
     * Then validate branches where config has active:true
     * Pass only those branches as array
     */

    let branches;
    let validBranches;

    if (!cacheBranches.has(routePath)) {
      console.log(`❌❌ branches IS NOT from cache: ${ routePath }`);

      const branchesRaw = await axios.get(
        requestRepoBranches(coursePathInGithub),
        authToken
      );

      branches = branchesRaw.data.map((branch) => branch.name);

      const branchPromises = await branches.reduce((acc, branch) => {
        /** IF CONFIG IS BROKEN (doesn't pass validation), the branch is not considered either! */
        acc[branch] = getConfig(coursePathInGithub, branch);
        return acc;
      }, {});

      const validBranchesRaw = await Promise.all(
        Object.entries(branchPromises)
          .map(([key, promise]) => promise.then((value) => [key, value]))
      ).then((resolvedArr) => {
        const resolvedObj = Object.fromEntries(resolvedArr);
        return Object.entries(resolvedObj).filter(
          ([, value]) => value && value.active
        );
      }).catch((error) => {
        console.error(error); // handle error
      });

      if (!validBranchesRaw) {
        return [];
      }

      validBranches = validBranchesRaw.map((x) => x[0]);

      cacheBranches.set(routePath, validBranches);
    } else {
      console.log(`✅✅ branches FROM CACHE: ${ routePath }`);
      validBranches = cacheBranches.get(routePath);
    }

    return validBranches;
  },
  docsService: async (req, res) => {
    const { repository } = res.locals.course;
    const { refBranch } = res.locals;
    const routePath = `${ req.url }+${ refBranch }+components`;
    const coursePathInGithub = repository.replace('https://github.com/', '');
    let components;

    if (!cachePageContent.has(coursePathInGithub)) {
      console.log(
        `❌❌ docs components IS NOT from cache: ${ coursePathInGithub }`);
      components = await axios.get(
        requestDocs(coursePathInGithub, refBranch),
        authToken
      ).catch((err) => {
        console.log(`❌❌ get docs failed: ${ coursePathInGithub }`, err);
      });

      cachePageContent.set(routePath, components);
    } else {
      console.log(`✅✅ docs components FROM CACHE: ${ routePath }`);
      components = cachePageContent.get(routePath);
    }

    return { components };
  },
  courseAdditionalMaterialsService: async (req, res) => {
    const { repository } = res.locals.course;
    const coursePathInGithub = repository.replace('https://github.com/', '');
    const { refBranch } = res.locals;

    const routePath = `${ req.url }+${ refBranch }+components`;
    const routePathFiles = `${ req.url }+${ refBranch }+files`;

    let components;
    let files;

    if (!cachePageContent.get(routePath) || !cacheFiles.get(routePathFiles)) {
      console.log(
        `❌❌ courseAdditionalMaterials components IS NOT from cache: ${ routePath }`
      );
      console.log(
        `❌❌ courseAdditionalMaterials files IS NOT from cache: ${ routePathFiles }`
      );

      const componentsRaw = await axios.get(
        requestCourseAdditionalMaterials(coursePathInGithub, refBranch),
        authToken
      );
      // Github raw download_url juhend:
      // https://stackoverflow.com/questions/73819136/how-do-i-get-and-download-the-contents-of-a-file-in-github-using-the-rest-api/73824136
      // Download_url token muutub iga 7 päeva tagant Githubi poolt:
      // https://github.com/orgs/community/discussions/23845#discussioncomment-3241866
      const filesRaw = await axios.get(
        requestCourseFiles(coursePathInGithub, refBranch),
        authToken
      );

      await axios.all([componentsRaw, filesRaw]).then(
        axios.spread((...responses) => {
          [components, files] = responses;
          files = responses[1].data.filter(
            (x) => !ignoreFiles.includes(x.name)
          );
          cachePageContent.set(routePath, components);
          cacheFiles.set(routePathFiles, files);
        })
      ).catch((error) => {
        console.error(error);
      });
    } else {
      console.log(
        `✅✅ courseAdditionalMaterials components FROM CACHE: ${ routePath }`
      );
      console.log(
        `✅✅ courseAdditionalMaterials files FROM CACHE: ${ routePathFiles }`
      );
      components = cachePageContent.get(routePath);
      files = cacheFiles.get(routePathFiles);
    }
    return {
      components,
      files
    };
  },
  lessonsService: async (req, res) => {
    const { repository } = res.locals.course;
    const coursePathInGithub = repository.replace('https://github.com/', '');
    const {
      path,
      refBranch
    } = res.locals;

    const routePath = `${ req.url }+${ refBranch }+components`;
    let components;
    if (!cachePageContent.get(routePath)) {
      console.log(`❌❌ lessons components IS NOT from cache: ${ routePath }`);
      components = await axios.get(
        requestLessons(coursePathInGithub, `${ path.contentSlug }`, refBranch),
        authToken
      );
      cachePageContent.set(routePath, components);
    } else {
      console.log(`✅✅ lessons components FROM CACHE: ${ routePath }`);
      components = cachePageContent.get(routePath);
    }

    return { components };
  },
  lessonAdditionalMaterialsService: async (req, res) => {
    const { repository } = res.locals.course;
    const coursePathInGithub = repository.replace('https://github.com/', '');

    const {
      path,
      refBranch
    } = res.locals;

    const routePath = `${ req.url }+${ refBranch }+components`;
    const routePathFiles = `${ req.url }+${ refBranch }+files`;

    let components;
    let files;

    if (!cachePageContent.get(routePath) || !cacheFiles.get(routePathFiles)) {
      console.log(
        `❌❌ lessonAdditionalMaterials components IS NOT from cache: ${ routePath }`
      );
      console.log(
        `❌❌ lessonAdditionalMaterials files IS NOT from cache: ${ routePathFiles }`
      );

      const componentsRaw = await axios.get(
        requestLessonAdditionalMaterials(
          coursePathInGithub,
          `${ path.contentSlug }`,
          refBranch
        ),
        authToken
      );
      // Github raw download_url juhend:
      // https://stackoverflow.com/questions/73819136/how-do-i-get-and-download-the-contents-of-a-file-in-github-using-the-rest-api/73824136
      // Download_url token muutub iga 7 päeva tagant Githubi poolt:
      // https://github.com/orgs/community/discussions/23845#discussioncomment-3241866
      const filesRaw = await axios.get(
        requestLessonFiles(
          coursePathInGithub,
          `${ path.contentSlug }`,
          refBranch
        ),
        authToken
      );

      await axios.all([componentsRaw, filesRaw]).then(
        axios.spread((...responses) => {
          [components, files] = responses;
          files = responses[1].data.filter(
            (x) => !ignoreFiles.includes(x.name)
          );
          cachePageContent.set(routePath, components);
          cacheFiles.set(routePathFiles, files);
        })
      ).catch((error) => {
        console.error(error);
      });
    } else {
      console.log(
        `✅✅ lessonAdditionalMaterials components FROM CACHE: ${ routePath }`
      );
      console.log(
        `✅✅ lessonAdditionalMaterials files FROM CACHE: ${ routePathFiles }`
      );
      components = cachePageContent.get(routePath);
      files = cacheFiles.get(routePathFiles);
    }

    return {
      components,
      files
    };
  },
  lessonComponentsService: async (req, res) => {
    const { repository } = res.locals.course;
    const coursePathInGithub = repository.replace('https://github.com/', '');
    const {
      path,
      refBranch
    } = res.locals;

    const routePath = `${ req.url }+${ refBranch }+components`;
    const routePathSources = `${ req.url }+${ refBranch }+sources`;

    let components;
    let sources;
    let componentsRaw;
    let sourcesRaw;

    if (path.type === 'concept') {
      if (!cachePageContent.get(routePath)) {
        console.log(`❌❌ concept components IS NOT from cache: ${ routePath }`);
        console.log(
          `❌❌ concept sources IS NOT from cache: ${ routePathSources }`
        );

        try {
          componentsRaw = await axios.get(
            requestConcepts(
              coursePathInGithub,
              `${ path.componentSlug }`,
              refBranch
            ),
            authToken
          ).catch(() => {
            console.log('unable to fetch ' + path.componentSlug);
          });
        } catch (error) {
          console.log('Unable to get componentsRaw');
          console.error(error);
        }
        try {
          sourcesRaw = await axios.get(
            requestSources(
              coursePathInGithub,
              `${ path.componentSlug }`,
              refBranch
            ),
            authToken
          ).catch(() => {
            console.log('unable to fetch ' + path.componentSlug);
          });
        } catch (error) {
          console.log('Unable to get sourcesRaw');
          console.error(error);
        }

        await axios.all([componentsRaw, sourcesRaw]).then(
          axios.spread((...responses) => {
            [components, sources] = responses;
            cachePageContent.set(routePath, components);
            cachePageContent.set(routePathSources, sources);
          })
        ).catch((error) => error);
      } else {
        console.log(`✅✅ concept components FROM CACHE: ${ routePath }`);
        console.log(`✅✅ concept sources FROM CACHE: ${ routePathSources }`);
        components = cachePageContent.get(routePath);
        sources = cachePageContent.get(routePathSources);
      }
    }

    if (path.type === 'practice') {
      if (!cachePageContent.get(routePath)) {
        console.log(`❌❌ practice components IS NOT from cache: ${ routePath }`);
        components = await axios.get(
          requestPractices(
            coursePathInGithub,
            `${ path.componentSlug }`,
            refBranch
          ),
          authToken
        ).catch(() => {
          console.log('unable to fetch practice components');
        });
        cachePageContent.set(routePath, components);
      } else {
        console.log(`✅✅ practice components FROM CACHE: ${ routePath }`);
        components = cachePageContent.get(routePath);
      }
    }

    return {
      components,
      sources
    };
  },
  async createNewBranch(repo, from, to) {
    const parent = await octokit.request(
      `GET /repos/${ repo }/git/ref/heads/${ from }`,
      {
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );
    const parentSha = parent.data.object.sha;
    //console.log('sha', parentSha);

    // 4. create new branch/ref
    return await octokit.request(
      `POST /repos/${ repo }/git/refs`,
      {
        ref: `refs/heads/${ to }`,
        sha: parentSha,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );
  },
  async listBranches(repo) {
    const resp = await octokit.request(
      `GET /repos/${ repo }/branches?per_page=100`, {
        owner: 'OWNER',
        repo: 'REPO',
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }).catch(() => {
      console.log('Unable to fetch branches');
    });
    return (resp && resp.data) ? resp.data : [];
  },
  getAllCourses: async () => {
    return await usersApi.get(membersRequests.getAllCourses)
      .catch((error) => {
        console.error(error);
      });

  },
  getCourseById: async (courseId) => {
    const cacheName = `course+${ courseId }`;
    if (!cacheTeamCourses.has(cacheName)) {
      console.log(
        `❌❌ course ${ courseId } IS NOT from cache`
      );

      const course = await usersApi.get(membersRequests.getCourse + courseId)
        .catch((error) => {
          console.error(error);
        });
      cacheTeamCourses.set(cacheName, course?.data?.data);
      return course?.data?.data;
    } else {
      console.log(
        `✅✅ course for ${ courseId } FROM CACHE`
      );
      return cacheTeamCourses.get(cacheName);
    }
  },
  async mergeMasterWithDraft(repo, message) {
    return await octokit.request(`POST /repos/${ repo }/merges`, {
      base: 'master',
      head: 'draft',
      commit_message: message,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
  },
  async deleteBranch(repo, branch) {
    return await octokit.request(
      `DELETE /repos/${ repo }/git/refs/heads/${ branch }`, {
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
  }
};

export default apiRequests;
