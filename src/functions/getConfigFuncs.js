import { jsonrepair } from 'jsonrepair';
import base64 from 'base-64';
import utf8 from 'utf8';
import { authToken, axios } from '../setup/setupGithub.js';
import { cacheConfig } from '../setup/setupCache.js';
import githubReposRequests from './githubReposRequests.js';
import { getTree, uploadFile } from './githubFileFunctions.js';

const { requestConfig } = githubReposRequests;

const getRepoResponse = async (selectedCourse, refBranch) => {
  let response = '';
  try {
    response = await axios.get(
      requestConfig(selectedCourse, refBranch),
      authToken
    );
  } catch (err) {
    // Handle Error Here
    // console.error(err);
    console.error(`Fetch config failed: ${ selectedCourse }`);
  }
  return response;
};

const validateConfig = (configObj, selectedCourse, refBranch) => {
  /** Validate that config includes all expected keys */

  const expectedKeys = refBranch === 'master' ? [
      'courseUrl',
      'active',
      'docs',
      'lessons',
      'concepts',
      'practices'
    ]
    : [
      'courseUrl',
      'active',
      'semester',
      'docs',
      'teacherUsername',
      'lessons',
      'concepts',
      'practices'];

  const objectKeys = Object.keys(configObj);
  const hasAllKeys = expectedKeys.every((key) => objectKeys.includes(key));

  if (!hasAllKeys) {
    console.error(
      `Config file of ${ selectedCourse }, branch ${ refBranch } has one or more expected keys missing.`);
    return false;
  }

  /** Validate that docs, additionalMaterials, lessons, concepts and practices keys have Arrays as values and that each array consists of at least on elem (Arrays are not empty).  */

  if (!Array.isArray(configObj.docs) || !configObj.docs.length > 0 ||
    !Array.isArray(configObj.additionalMaterials) ||
    !configObj.additionalMaterials.length > 0 ||
    !Array.isArray(configObj.lessons) || !configObj.lessons.length > 0 ||
    !Array.isArray(configObj.concepts) || !configObj.concepts.length > 0
    || !Array.isArray(configObj.practices)
    || !configObj.practices.length > 0
  ) {
    console.log(
      `Config file of ${ selectedCourse }, branch ${ refBranch } has one or more expected keys with incorrect type or empty array.`);
    return false;
  }

  const expectedKeys2 = ['slug', 'name'];
  const objectKeysDocs = Object.keys(configObj.docs[0]);
  const hasAllKeysDocs = expectedKeys2.every(
    (key) => objectKeysDocs.includes(key));

  const objectKeysAdditionalMaterials = Object.keys(
    configObj.additionalMaterials[0]);
  const hasAllKeysAdditionalMaterials = expectedKeys2.every(
    (key) => objectKeysAdditionalMaterials.includes(key));

  const expectedKeys3 = [
    'slug', 'name', 'uuid', 'components', 'additionalMaterials'];

  const hasAllKeysLessons = configObj.lessons.every((lesson) => {
    const objectKeysLesson = Object.keys(lesson);
    const lessonHasAllKeys = expectedKeys3.every(
      (key) => objectKeysLesson.includes(key));
    if (!lessonHasAllKeys) {
      console.log(
        `Config file of ${ selectedCourse }, branch ${ refBranch } has one or more expected lesson keys missing.`);
      return false;
    }
    if (!Array.isArray(lesson.components) || !lesson.components.length > 0 ||
      !Array.isArray(lesson.additionalMaterials) ||
      !lesson.additionalMaterials.length > 0) {
      console.log(
        `Config file of ${ selectedCourse }, branch ${ refBranch } has one or more expected lesson keys with incorrect type, or empty array.`);
      return false;
    }
    const lessonKeysAdditionalMaterials = Object.keys(
      lesson.additionalMaterials[0]);

    // console.log('lessonKeysAdditionalMaterials1:',
    // lessonKeysAdditionalMaterials);
    const lessonAddMaterialsHaveKeys = expectedKeys2.every(
      (key) => lessonKeysAdditionalMaterials.includes(key));
    if (!lessonAddMaterialsHaveKeys) {
      console.log(
        `Config file of ${ selectedCourse }, branch ${ refBranch } has one or more expected lesson additionalMaterials array with missing keys.`);
      return false;
    }
    return true;
  });

  const expectedKeys4 = ['slug', 'name', 'uuid'];

  const hasAllKeysConcepts = configObj.concepts.every((concept) => {
    const objectKeysConcept = Object.keys(concept);
    return expectedKeys4.every((key) => objectKeysConcept.includes(key));
  });

  const hasAllKeysPractices = configObj.practices.every((practice) => {
    const objectKeysPractice = Object.keys(practice);
    return expectedKeys4.every((key) => objectKeysPractice.includes(key));
  });

  if (!hasAllKeysDocs || !hasAllKeysAdditionalMaterials || !hasAllKeysLessons ||
    !hasAllKeysConcepts || !hasAllKeysPractices) {
    console.log(
      `Config file of ${ selectedCourse }, branch ${ refBranch } has one or more expected docs, additionalMaterials, lessons, concepts or practices array with missing keys or incorrect type.`);
    return false;
  }
  return true;
};

const getConfig = async (selectedCourse, refBranch) => {
  let config;

  /** Check if cache already has course branch config.
   * If yes, read config from cache.
   * If not, make new GitHub request for config and cache it.
   */
    // console.log('selectedCourse1:', selectedCourse);
    // console.log('refBranch1:', refBranch);

  const routePath = `getConfig:${ selectedCourse }+${ refBranch }`;
  // console.log('routePath1:', routePath);
  // console.log('cacheConfig.get(routePath)1:', cacheConfig.get(routePath));
  // console.log('cacheConfig.has(routePath)1:', cacheConfig.has(routePath));
  // console.log('cacheConfig.get(routePath)1:', cacheConfig.get(routePath));

  if (cacheConfig.has(routePath) || cacheConfig.get(routePath) !== undefined) {
    config = cacheConfig.get(routePath);
    console.log(`✅ getConfig FROM CACHE: ${ selectedCourse }+${ refBranch }`);
  } else {
    console.log(
      `❌ getConfig IS NOT from cache: ${ selectedCourse }+${ refBranch }`);
    try {
      config = await getRepoResponse(selectedCourse, refBranch);
    } catch (error) {
      console.error(error);
    }

    cacheConfig.set(routePath, config);
    // console.log('config from api');
  }

  // console.log('config2:', config);
  // console.log('config.data2:', config.data);

  if (!config.data) {
    return null;
  }
  // console.log('config2:', config);
  /** Decode GitHub response with base64 and utf8. Result is a string configDecodedUtf8 that contains the config file content. */
  const configDecoded = base64.decode(config.data.content);

  const configDecodedUtf8 = utf8.decode(configDecoded);
  // console.log('configDecodedUtf8:', configDecodedUtf8);
  // console.log('typeof configDecodedUtf8:', typeof configDecodedUtf8);

  /** Fix broken JSON before parsing it: https://www.npmjs.com/package/jsonrepair .
   * E.g. the config file might be missing a comma, or double quotes here or
   * there. This must be fixed before JSON.parse() command.
   */
  let repairedConfigJSON;
  /* Validate that config is object type and in JSON format */
  try {
    repairedConfigJSON = jsonrepair(configDecodedUtf8);
  } catch (error) {
    console.error(
      `Config file of ${ selectedCourse }, branch ${ refBranch } is not object type or does not match JSON format.`);
    return null;
  }
  // console.log('repairedConfigJSON8:', repairedConfigJSON);
  // console.log('typeof repairedConfigJSON8:', typeof repairedConfigJSON);

  /** Parse string into object */
  const configObj = JSON.parse(repairedConfigJSON);
  configObj.sha = config.data.sha;
  // console.log('configObj8:', configObj);

  /** Validate that config file has correct structure */
  if (!validateConfig(configObj, selectedCourse, refBranch)) {
    return null;
  }

  /** Convert all lessons component array elements to lowercase */
  configObj.lessons.forEach((lesson, indexLesson) => {
    if (Array.isArray(lesson.components)) {
      const arr = lesson.components;
      configObj.lessons[indexLesson].components = arr.map(
        (item) => item.toLowerCase());
    }
  });
  // console.log('configObj.lessons[0].components10:',
  // configObj.lessons[0].components);

  /** Convert all "slug" key values to lowercase */
  Object.keys(configObj).forEach((key) => {
    if (Array.isArray(configObj[key])) {
      const arr = configObj[key];
      arr.forEach((item) => {
        // if (item.hasOwnProperty("slug")) {
        if (Object.prototype.hasOwnProperty.call(item, 'slug')) {
          item.slug = item.slug.toLowerCase();
          // console.log('item10:', item);
        }
      });
    }
  });
  return configObj;
};

const createConfig = async (course, refBranch) => {

  const conf = {
    courseName: course.name,
    courseUrl: 'https://ois2.tlu.ee/tluois/aine/' + course.code,
    teacherUsername: course.teachers[0].firstName + ' ' +
      course.teachers[0].lastName,
    active: true,
    semester: course.semester
  };

  const gitPath = course.repository.replace('https://github.com/', '');
  const tree = await getTree(gitPath, refBranch);

  // fix tree
  // add missing parts
  if (!tree.additionalMaterials) tree.additionalMaterials = [
    {
      slug: 'lisamaterjalid', name: 'Aine lisamaterjalid'
    }];
  if (!tree.practices) tree.practices = [
    {
      slug: 'praktikum_01',
      name: 'Näidis Praktikum',
      uuid: 'eb040d98-f24a-43f6-92bb-12af08d2d32c'
    }];

  tree.docs.push({
    slug: 'about',
    name: 'Aine info'
  });

  // fix lessons
  tree.lessons.forEach(lesson => {
    if (!lesson.components) {
      lesson.components = ['naidis-sisuteema'];
    }
    if (!lesson.additionalMaterials) {
      lesson.additionalMaterials = [
        {
          'slug': 'lisamaterjalid', 'name': 'Loengu lisamaterjalid'
        }];
    }
  });

  const [owner, repo] = gitPath.split('/');
  await uploadFile(owner, repo, 'config.json',
    JSON.stringify({ ...conf, ...tree }), 'config.json lisamine'
  );

  return { ...conf, ...tree };
};

export { getConfig, createConfig };
