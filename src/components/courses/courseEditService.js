import getCourseData from '../../functions/getCourseData.js';
import apiRequests from './coursesService.js';
import {
  deleteFile,
  deleteFilesFromRepo,
  getFile,
  getFolder,
  updateFile,
  uploadFile
} from '../../functions/githubFileFunctions.js';
import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';
import {
  cacheConcepts,
  cacheConfig,
  cacheTeamCourses
} from '../../setup/setupCache.js';
import { usersApi } from '../../setup/setupUserAPI.js';

const GITHUB_URL_PREFIX = 'https://github.com/';

function updateConfigFile(path, value, config) {
// Split the input key into parts
  let parts = path.split('/');
  //console.log('parts', parts);
// If the first part matches an existing key in the config object
  if (parts[1] in config) {
    // If the second part is an array
    if (Array.isArray(config[parts[1]])) {
      // Loop through the array
      for (let i = 0; i < config[parts[1]].length; i++) {
        // If the third part matches an existing key in the array item
        if (parts[2] in config[parts[1]][i]) {
          // Update the value
          config[parts[1]][i][parts[2]] = value;
        }
      }
    } else {
      config[parts[1]] = value;
    }
  }
  return config;
}

function makeUniqueSlug(slug, array) {
  // Create a variable that holds the original value of "slug"
  const originalSlug = slug;
  // Create a variable that holds a counter for how many times "slug" has been
  // changed
  let counter = 0;
  // Create a loop that runs until "slug" is unique
  while (true) {
    const isDuplicate = array.some(concept => concept.slug === slug);
    // If "slug" is not in the array, return it and end the function
    if (!isDuplicate) {
      return slug;
    }
    // If "slug" is in the array, increase the counter by one
    counter++;
    // Add the number to the end of "slug" and a dash between the original
    // "slug"
    slug = originalSlug + '-' + counter;
  }
}

// Looge funktsioon, mis loob uue faili sisu
async function createFileContent(
  owner, repo, concept, course, sources, branch) {
  // create unique slug from name
  const slug = makeUniqueSlug(
    slugify(concept.name.toLowerCase().trim()), course.config.concepts);

  // add README.md file
  await uploadFile(owner, repo, `concepts/${ slug }/README.md`, concept.content,
    `created concept: ${ concept.name }`, branch
  );

  // add empty sources.json fail
  await uploadFile(owner, repo, `concepts/${ slug }/sources.json`,
    JSON.stringify(sources), `created concept: ${ concept.name }`, branch
  );

  // update config.json
  course.config.concepts.push({
    name: concept.name,
    slug: slug,
    uuid: uuidv4(),
    repo: slugify(course.courseName)
  });
  await updateFile(owner, repo, 'config.json', {
    content: JSON.stringify(course.config), sha: course.config.sha
  }, 'concept added to the config.json', branch);

  // return redirect url
  return `/course-edit/${ course.id }/concept/${ slug }`;
}

// Looge funktsioon, mis tegeleb kursuse ja kontseptsiooni failidega
async function handleCourseAndConceptFiles(courseId, concept, sources) {
  // get course from API
  const course = await apiRequests.getCourseById(courseId);
  // if we have course
  if (course) {
    const [owner, repo] = course.repository.replace(GITHUB_URL_PREFIX, '')
      .split('/');
    const courseConfig = await getCourseData(course, 'draft');
    // if we have sha - update existing file
    if (concept.sha) {
      await updateFile(owner, repo, `concepts/${ concept.slug }/README.md`,
        { content: concept.content, sha: concept.sha },
        `edit concept: ${ concept.name }`, 'draft'
      );
      await updateFile(owner, repo, `concepts/${ concept.slug }/sources.json`, {
        content: JSON.stringify(sources), sha: concept.additionalMaterials.sha
      }, `edit sources: ${ concept.name }`, 'draft');
      return 'back';
    } else { // no sha - create new content
      // get course config
      return await createFileContent(
        owner, repo, concept, courseConfig, sources, 'draft');
    }
  }
  return 'back';
}

async function handleCourseAndPracticeFiles(courseId, practice, sources) {
  // get course from API
  const course = await apiRequests.getCourseById(courseId);
  // if we have course
  if (course) {
    const [owner, repo] = course.repository.replace(GITHUB_URL_PREFIX, '')
      .split('/');
    const courseConfig = await getCourseData(course, 'draft');
    // if we have sha - update existing file
    if (practice.sha) {
      await updateFile(owner, repo, `practices/${ practice.slug }/README.md`,
        { content: practice.content, sha: practice.sha },
        `edit practice: ${ practice.name }`, 'draft'
      );
    } else { // no sha - create new content
      await updateFile(owner, repo, `practices/${ practice.slug }/README.md`,
        { content: practice.content },
        `edit practice: ${ practice.name }`, 'draft'
      );
    }
  }
  return 'back';
}

async function handleCourseGeneralFiles(courseId, readme, materials) {
  // get course from API
  const course = await apiRequests.getCourseById(courseId);
  if (course) {
    const [owner, repo] = course.repository.replace(GITHUB_URL_PREFIX, '')
      .split('/');
    if (readme && readme.content) await updateFile(owner, repo,
      `docs/README.md`, { content: readme.content, sha: readme.sha },
      `edit docs/readme`, 'draft'
    );
    if (materials && materials.content) await updateFile(owner, repo,
      `docs/lisamaterjalid.md`,
      { content: materials.content, sha: materials.sha },
      `docs/lisamaterjalid.md`, 'draft'
    );
    //clear course cache
    cacheTeamCourses.del(`course+${ courseId }`);
  }
  return 'back';
}

async function handleCourseFiles(courseId, oldFiles, newFiles) {
  const course = await apiRequests.getCourseById(courseId);
  if (course) {
    const [owner, repo] = course.repository.replace(GITHUB_URL_PREFIX, '')
      .split('/');
    const fileFolder = await getFolder(
      owner, repo, 'docs/files', 'draft', true);

    // 1. Delete removed files
    // Filter and map files to be deleted
    // delete if file in fileFolder but not in oldFiles
    const toDelete = fileFolder.filter(item => !oldFiles?.includes(item.path))
      .map(file => file.path);
    await deleteFilesFromRepo(owner, repo, 'docs/files', toDelete, 'draft');

    // 2. Upload new files
    await uploadNewFiles(owner, repo, newFiles, fileFolder);
  }
}

async function handleLessonFiles(courseId, courseSlug, oldFiles, newFiles) {
  const course = await apiRequests.getCourseById(courseId);
  if (course) {
    const [owner, repo] = course.repository.replace(GITHUB_URL_PREFIX, '')
      .split('/');
    const fileFolder = await getFolder(
      owner, repo, `lessons/${ courseSlug }/files`, 'draft', true);

    // 1. Delete removed files
    // Filter and map files to be deleted
    const toDelete = fileFolder.filter(item => !oldFiles?.includes(item.path))
      .map(file => file.path);
    if (toDelete.length)
      await deleteFilesFromRepo(
        owner, repo, `lessons/${ courseSlug }/files`, toDelete, 'draft');
    // 2. Upload new files
    await uploadNewFiles(owner, repo, newFiles, fileFolder);
  }
}

async function uploadNewFiles(owner, repo, newFiles, fileFolder) {
  if (typeof newFiles === 'object' && newFiles) {
    // get key name
    const fileKey = Object.keys(newFiles)[0];
    // if single file uploaded - convert this to array, else use original
    // array
    const fileList = Array.isArray(newFiles[fileKey])
      ? newFiles[fileKey]
      : [newFiles[fileKey]];

    for (const newFile of fileList) {
      console.log('🚨uued failid:', newFiles);
      const path = fileKey.replace('[]', '/') + slugify(newFile.name);
      const content = newFile.data.toString('base64');
      const existingFile = fileFolder.find(file => file.path === path);
      if (!existingFile) {
        await uploadFile(owner, repo, path, content, 'file added: ' + path,
          'draft', true
        );
      } else if (existingFile.sha !== newFile.sha) {
        await deleteFile(owner, repo, path, existingFile.sha,
          'file updated: ' + path, 'draft'
        );
        await uploadFile(owner, repo, path, content, 'file updated: ' + path,
          'draft', true
        );
      }
    }
  }
}

async function updateGeneralData(courseId, courseName, courseUrl) {
  const course = await apiRequests.getCourseById(courseId);
  if (course) {
    const [owner, repo] = course.repository.replace(GITHUB_URL_PREFIX, '')
      .split('/');
    const courseConfig = await getCourseData(course, 'draft');
    if (courseConfig) {
      courseConfig.config.courseName = courseName;
      courseConfig.config.courseUrl = courseUrl;
      await updateFile(owner, repo, 'config.json', {
        content: JSON.stringify(courseConfig.config),
        sha: courseConfig.config.sha
      }, 'update general data', 'draft');
    }
  }
}

async function getFolderContent(owner, repo, path, branch) {
  const data = {};

  // Get README file
  const readme = await getFile(owner, repo, `${ path }/README.md`, branch);
  if (readme) {
    data.readme = readme;
  }

  // Get lisamaterjalid.md file
  const lisamaterjalid = await getFile(
    owner, repo, `${ path }/lisamaterjalid.md`, branch);
  if (lisamaterjalid) {
    data.materials = lisamaterjalid;
  }

  // Get files from "files" directory
  data.files = await getImageFiles(owner, repo, `${ path }/files`, branch);

  return data;
}

async function getImageFiles(owner, repo, path, branch) {
  const files = await getFolder(owner, repo, path, branch, true);
  const result = [];
  // Filter and format files
  files.filter(file => file.type === 'file').forEach(file => {
    const name = file.name;
    const thumbUrl = /\.(jpg|png|gif|jpeg)$/i.test(name)
      ? file.download_url
      : '/images/thumb.png';
    const url = file.download_url;
    const sha = file.sha;
    const path = file.path;

    result.push({ name, thumbUrl, url, sha, path });
  });
  return result;
}

async function getAllConcepts(courses, refBranch) {
  if (cacheConcepts.has('concepts')) {
    return new Promise((resolve) => {
      console.log('✅✅  concepts IS from cache');
      resolve(cacheConcepts.get('concepts'));
    });
  }
  console.log('❌❌ concepts IS NOT from cache');
  const allConcepts = [];
  await Promise.all(courses.map(async (course) => {
    // repository: 'https://github.com/tluhk/HK_Sissejuhatus-informaatikasse',
    const [owner, repo] = course.repository.replace('https://github.com/', '')
      .split('/');
    const folderContent = await getFolder(owner, repo, 'concepts', refBranch);
    course.config?.config?.concepts?.forEach((concept) => {
      // find where is concept defined
      if (folderContent.filter((f) => f.name === concept.slug).length) {
        concept.course = course.repository;
      }
      // vaata kas sama uuid'ga on juba kirje, kui on, siis lisa sellele
      // usedIn
      const isDefined = allConcepts.find((c) => c.uuid === concept.uuid);
      if (isDefined) {
        if (Array.isArray(isDefined.usedIn)) {
          isDefined.usedIn.push(course.code);
        } else {
          isDefined.usedIn = [course.code];
        }
      } else {
        concept.course = course.code;
        if (Array.isArray(concept.usedIn)) {
          concept.usedIn.push(course.code);
        } else {
          concept.usedIn = [course.code];
        }
        allConcepts.push(concept);
      }
    });
  }));
  cacheConcepts.set('concepts', allConcepts);
  return allConcepts.filter((c) => !!c.course)
    .sort((a, b) => a.name > b.name ? 1 : b.name > a.name ? -1 : a.course >
    b.course ? 1 : b.course > a.course ? -1 : 0);
}

async function fetchAndProcessCourseData() {
  try {
    const allCoursesResponse = await usersApi.get('groups');
    const allCourses = allCoursesResponse.data;

    const coursesWithConfig = await Promise.all(
      allCourses.data.map(async (course) => {
        course.config = await getCourseData(course, 'master');
        return course;
      })
    );

    const allConcepts = await getAllConcepts(coursesWithConfig, 'master');
    // todo filter out already used (uuid in lesson.components)
    return allConcepts; /*.filter(
     (c) => c.course !== repository
     );*/
  } catch (error) {
    console.error('Error fetching and processing courses:', error);
  }
}

async function handleLessonUpdate(
  courseId, readme, materials, lessonName, lessonSlug, components) {
  // get course from API
  const course = await apiRequests.getCourseById(courseId);
  // if we have course
  if (course) {
    const [owner, repo] = course.repository.replace(GITHUB_URL_PREFIX, '')
      .split('/');
    const courseConfig = await getCourseData(course, 'draft');
    const ourLessonIndex = courseConfig.config.lessons.map(l => l.slug)
      .indexOf(lessonSlug);
    if (ourLessonIndex >= 0) { // update config.json
      courseConfig.config.lessons[ourLessonIndex].name = lessonName;
      courseConfig.config.lessons[ourLessonIndex].components = components;
      // todo update components part
      await updateFile(owner, repo, 'config.json', {
        content: JSON.stringify(courseConfig.config),
        sha: courseConfig.config.sha
      }, `edit lesson data ${ lessonName }`, 'draft');
      cacheConfig.del(`getConfig:${ owner }/${ repo }/+draft`);
    }

    // if we have sha - update existing file
    if (lessonSlug !== 'new') {
      await updateFile(owner, repo, `lessons/${ lessonSlug }/README.md`,
        { content: readme.content, sha: readme.sha },
        `edit lesson: ${ lessonName }`, 'draft'
      );
      await updateFile(owner, repo, `lessons/${ lessonSlug }/lisamaterjalid.md`,
        { content: materials.content, sha: materials.sha },
        `edit lisamaterjalid.md : ${ lessonName }`, 'draft'
      );
      return 'back';
    } else { // no sha - create new content
      // 1. add lesson to the conf
      const slug = slugify(lessonName.toLowerCase().trim());
      courseConfig.config.lessons.push(
        {
          slug: slug,
          name: lessonName.trim(),
          uuid: uuidv4(),
          components: [...components],
          additionalMaterials: []
        }
      );
      await updateFile(owner, repo, 'config.json', {
        content: JSON.stringify(courseConfig.config),
        sha: courseConfig.config.sha
      }, `lesson added ${ lessonName }`, 'draft');
      cacheConfig.del(`getConfig:${ owner }/${ repo }/+draft`);
      // 2. upload files
      await uploadFile(owner, repo, `lessons/${ slug }/README.md`,
        JSON.stringify(readme.content),
        `lesson added: ${ lessonName }`, 'draft'
      );
      await uploadFile(owner, repo, `lessons/${ slug }/lisamaterjalid.md`,
        JSON.stringify(materials.content),
        `lesson added: ${ lessonName }`, 'draft'
      );
      // todo upload images

      return `/course-edit/${ course.id }/lesson/${ slug }`;
    }
  }
  return 'back';
}

export {
  updateConfigFile,
  makeUniqueSlug,
  handleCourseAndConceptFiles,
  handleCourseAndPracticeFiles,
  handleCourseGeneralFiles,
  updateGeneralData,
  handleCourseFiles,
  handleLessonFiles,
  getFolderContent,
  handleLessonUpdate,
  fetchAndProcessCourseData,
  getAllConcepts,
  getImageFiles
};
