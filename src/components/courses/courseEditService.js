//let input = {'config/lessons/name': 'new name'};
//let config = {id: 1, name: 'old name', lessons: [ {name: 'lesson 1', slug:
// 'lesson_1'}]};

import getCourseData from '../../functions/getCourseData.js';
import apiRequests from './coursesService.js';
import { updateFile, uploadFile } from '../../functions/githubFileFunctions.js';
import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';

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

async function changeFileContent(
  owner, repo, filePath, fileData, commitMessage, branch) {
  await updateFile(owner, repo, filePath, fileData, commitMessage, branch);
  return 'back';
}

// Looge funktsioon, mis loob uue faili sisu
async function createFileContent(owner, repo, concept, course, branch) {
  // create unique slug from name
  const slug = makeUniqueSlug(
    slugify(concept.name.toLowerCase()), course.config.concepts);

  // add README.md file
  await uploadFile(owner, repo, `concepts/${ slug }/README.md`,
    concept.content, `created concept: ${ concept.name }`, branch
  );

  // add empty sources.json fail
  await uploadFile(owner, repo, `concepts/${ slug }/sources.json`, '[]',
    `created concept: ${ concept.name }`, branch
  );

  // update config.json
  course.config.concepts.push({
    name: concept.name,
    slug: concept.slug,
    uuid: uuidv4(),
    repo: slugify(course.courseName)
  });
  await uploadFile(owner, repo, 'config.json',
    JSON.stringify(course.config), 'concept added to the config.json', branch
  );

  // return redirect url
  return `/course-edit/${ courseId }/concept/${ slug }`;
}

// Looge funktsioon, mis tegeleb kursuse ja kontseptsiooni failidega
async function handleCourseAndConceptFiles(courseId, concept) {
  // get course from API
  const course = await apiRequests.getCourseById(courseId);
  // if we have course
  if (course) {
    const [owner, repo] = course.repository.replace(GITHUB_URL_PREFIX, '')
      .split('/');
    // if we have sha - update existing file
    if (concept.sha) {
      return await changeFileContent(owner, repo,
        `concepts/${ concept.slug }/README.md`,
        { content: concept.content, sha: concept.sha },
        `edit concept: ${ concept.name }`, 'draft'
      );
    } else { // no sha - create new content
      // get course config
      const courseConfig = await getCourseData(course, 'draft');
      return await createFileContent(
        owner, repo, concept, courseConfig, 'draft');
    }
  }
  return 'back';
}

export { updateConfigFile, makeUniqueSlug, handleCourseAndConceptFiles };