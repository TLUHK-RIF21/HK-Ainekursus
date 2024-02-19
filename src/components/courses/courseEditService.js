import getCourseData from '../../functions/getCourseData.js';
import {
  deleteFile, deleteFilesFromRepo, getFile, getFolder, updateFile, uploadFile
} from '../../functions/githubFileFunctions.js';
import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';
import {
  cacheConcepts, cacheConfig, cacheTeamCourses
} from '../../setup/setupCache.js';
import { usersApi } from '../../setup/setupUserAPI.js';

const GITHUB_URL_PREFIX = 'https://github.com/';

function makeUniqueSlug(slug, array) {
  // Create a variable that holds the original value of "slug"
  const originalSlug = slug;
  // Create a variable that holds a counter for how many times "slug" has been
  // changed
  let counter = 0;
  // Create a loop that runs until "slug" is unique
  while (true) {
    const isDuplicate = array.some(item => item.slug === slug);
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

/*async function createFileContent(
 owner, repo, concept, course, branch) {
 // create unique slug from name
 const slug = makeUniqueSlug(
 slugify(concept.name.toLowerCase().trim()), course.config.concepts);

 // add README.md file
 await uploadFile(owner, repo, `concepts/${ slug }/README.md`, concept.content,
 `created concept: ${ concept.name }`, branch
 );
 // update config.json
 course.config.concepts.push({
 name: concept.name,
 slug: slug,
 uuid: uuidv4(),
 repo: concept.repo
 });
 await updateFile(owner, repo, 'config.json', {
 content: JSON.stringify(course.config), sha: course.config.sha
 }, 'concept added to the config.json', branch);

 // return redirect url
 return `/course-edit/${ course.id }/concept/${ slug }`;
 }*/

/*async function handleCourseAndConceptFiles(owner, repo, course, concept) {
 const courseConfig = await getCourseData(course, 'draft');
 concept.repo = course.repository;
 // if we have sha - update existing file
 if (concept.sha) {
 await updateFile(owner, repo, `concepts/${ concept.slug }/README.md`,
 { content: concept.content, sha: concept.sha },
 `edit concept: ${ concept.name }`, 'draft'
 );
 return 'back';
 } else { // no sha - create new content
 return await createFileContent(
 owner, repo, concept, courseConfig, 'draft');
 }
 }*/

/**
 * General function for updating course data (lesson, practice, etc.)
 * @param owner
 * @param repo
 * @param course
 * @param item what we are changing
 * @param parentPath
 * @return {Promise<{item, slug: *}>}
 */
async function handleCourseItemData(owner, repo, course, item, parentPath) {
  const courseConfig = await getCourseData(course, 'draft');
  let slug = item.slug;
  if (slug === 'new') {
    slug = makeUniqueSlug(
      item.name.trim().toLowerCase(),
      courseConfig.config[parentPath]
    );
  }
  // upload embedded images and change image links in content
  item.content = await handleContentImages(
    item.content, owner, repo, slug, parentPath);
  // if we have item sha - update existing file
  if (item.sha) {
    await updateFile(owner, repo, `${ parentPath }/${ item.slug }/README.md`,
      { content: item.content, sha: item.sha },
      `editing ${ parentPath }: ${ item.name }`, 'draft'
    );
  } else { // no sha - create new content
    await uploadFile(owner, repo, `${ parentPath }/${ slug }/README.md`,
      { content: item.content }, `added ${ parentPath }: ${ item.name }`,
      'draft'
    );
  }
  // update config
  const ourItemIndex = courseConfig.config[parentPath].map(l => l.slug)
    .indexOf(item.slug);
  if (ourItemIndex >= 0) { // update config.json
    courseConfig.config[parentPath][ourItemIndex].name = item.name;
  } else { // add new item
    courseConfig.config[parentPath].push({
      slug: slug, name: item.name, uuid: uuidv4(), repo: repo
    });
  }
  await updateFile(owner, repo, 'config.json', {
    content: JSON.stringify(courseConfig.config), sha: courseConfig.config.sha
  }, `editing ${ parentPath } data ${ item.name }`, 'draft');
  return { slug: slug, content: item.content }; //`/course-edit/${ course.id
                                                // }/${
  // parentPath }/${ slug }`;
}

async function handleCourseGeneralFiles(
  owner, repo, courseId, readme, materials) {
  if (readme && readme.content) await updateFile(owner, repo, `docs/README.md`,
    { content: readme.content, sha: readme.sha }, `edit docs/readme`, 'draft'
  );
  if (materials && materials.content) await updateFile(owner, repo,
    `docs/lisamaterjalid.md`,
    { content: materials.content, sha: materials.sha },
    `docs/lisamaterjalid.md`, 'draft'
  );
  //clear course cache
  cacheTeamCourses.del(`course+${ courseId }`);
  return 'back';
}

/**
 * General function to handle file changes in item folder
 * @param owner repo owner
 * @param repo repo url
 * @param slug item slug (lesson_02, practice_01, etc.)
 * @param oldFiles existing files where deleted files are removed
 * @param newFiles newly added files
 * @param parentPath name of the parent folder (lessons, practices, etc)
 * @return {Promise<void>}
 */
async function handleCourseItemFiles(
  owner, repo, slug, oldFiles, newFiles, parentPath) {
  const fileFolder = await getFolder(owner, repo,
    slug ? `${ parentPath }/${ slug }/files` : `${ parentPath }/files`, 'draft',
    true
  );
  // 1. Delete removed files
  // Filter and map files to be deleted
  const toDelete = fileFolder.filter(item => !oldFiles?.includes(item.path))
    .map(file => file.path);
  if (toDelete.length) await deleteFilesFromRepo(owner, repo,
    slug ? `${ parentPath }/${ slug }/files` : `${ parentPath }/files`,
    toDelete, 'draft'
  );

  if (slug && newFiles && typeof newFiles === 'object') {
    // replace 'new' in object
    newFiles = Object.fromEntries(
      Object.entries(newFiles).map(([key, value]) => {
        const newKey = key.replace('/new/', `/${ slug }/`);
        return [newKey, value];
      }));
  }
  // 2. Upload new files
  await uploadNewFiles(owner, repo, newFiles, fileFolder);
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

async function updateCourseName(owner, repo, course, courseName) {
  const courseConfig = await getCourseData(course, 'draft');
  if (courseConfig) {
    courseConfig.config.courseName = courseName;
    await updateFile(owner, repo, 'config.json', {
      content: JSON.stringify(courseConfig.config), sha: courseConfig.config.sha
    }, 'update general data', 'draft');
  }
}

async function getCourseGeneralContent(owner, repo, path, branch) {
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

async function getImageFiles(owner, repo, srcPath, branch) {
  const files = await getFolder(owner, repo, srcPath, branch, true);
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
    const shortUrl = file.path.replace(srcPath, 'files');
    result.push({ name, thumbUrl, url, sha, path, shortUrl });
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
    .sort(
      (a, b) => a.name > b.name ? 1 : b.name > a.name ? -1 : a.course > b.course
        ? 1
        : b.course > a.course ? -1 : 0);
}

async function fetchAndProcessCourseData() {
  try {
    const allCoursesResponse = await usersApi.get('groups');
    const allCourses = allCoursesResponse.data;

    const coursesWithConfig = await Promise.all(
      allCourses.data.map(async (course) => {
        course.config = await getCourseData(course, 'master');
        return course;
      }));

    // todo filter out already used (uuid in lesson.components)
    return await getAllConcepts(coursesWithConfig, 'master'); /*.filter(
     (c) => c.course !== repository
     );*/
  } catch (error) {
    console.error('Error fetching and processing courses:', error);
  }
}

async function handleLessonUpdate(owner, repo, course, data, lessonSlug) {
  // get course from API
  const courseConfig = await getCourseData(course, 'draft');
  const ourLessonIndex = courseConfig.config.lessons.map(l => l.slug)
    .indexOf(lessonSlug);
  if (ourLessonIndex >= 0) { // update config.json
    courseConfig.config.lessons[ourLessonIndex].name = data.lessonName;
    courseConfig.config.lessons[ourLessonIndex].components = data['components[]'];
    // todo update components part
    await updateFile(owner, repo, 'config.json', {
      content: JSON.stringify(courseConfig.config), sha: courseConfig.config.sha
    }, `edit lesson data ${ data.lessonName }`, 'draft');
    cacheConfig.del(`getConfig:${ owner }/${ repo }/+draft`);
  }

  // if we have sha - update existing file
  if (lessonSlug !== 'new') {
    await updateFile(owner, repo, `lessons/${ lessonSlug }/README.md`,
      { content: data.readmeContent, sha: data.readmeSHA },
      `edit lesson: ${ data.lessonName }`, 'draft'
    );
    await updateFile(owner, repo, `lessons/${ lessonSlug }/lisamaterjalid.md`,
      { content: data.materialsContent, sha: data.materialsSHA },
      `edit lisamaterjalid.md : ${ data.lessonName }`, 'draft'
    );
    // todo delete cache
    cacheConfig.del(`getConfig:${ owner }/${ repo }/+draft`);
    return 'back';
  } else { // no sha - create new content
    // 1. add lesson to the conf
    const slug = slugify(data.lessonName.toLowerCase().trim());
    courseConfig.config.lessons.push({
      slug: slug,
      name: data.lessonName.trim(),
      uuid: uuidv4(),
      components: [...data['components[]']],
      additionalMaterials: []
    });
    await updateFile(owner, repo, 'config.json', {
      content: JSON.stringify(courseConfig.config), sha: courseConfig.config.sha
    }, `lesson added ${ data.lessonName }`, 'draft');
    cacheConfig.del(`getConfig:${ owner }/${ repo }/+draft`);
    // 2. upload files
    await uploadFile(owner, repo, `lessons/${ slug }/README.md`,
      JSON.stringify(data.materialsContent),
      `lesson added: ${ data.lessonName }`, 'draft'
    );
    await uploadFile(owner, repo, `lessons/${ slug }/lisamaterjalid.md`,
      JSON.stringify(data.materialsContent),
      `lesson added: ${ data.lessonName }`, 'draft'
    );
    // todo upload images

    return `/course-edit/${ course.id }/lesson/${ slug }`;
  }
}

function extractAllImageDetails(text, localFilesOnly = true) {
  const pattern = /!\[(.*?)\]\((.*?)\)/g;
  let match;
  const results = [];
  while ((match = pattern.exec(text)) !== null) {
    const imageName = match[1];
    const imageUrl = match[2];
    if (!imageUrl.startsWith('http') || !localFilesOnly) { // extract only local filenames: 'images/sample_photo.jpg'
      results.push({ imageName, imageUrl });
    }
  }
  return results;
}

/**
 * @param content markdown formatted text
 * @param owner repo owner
 * @param repo repo url
 * @param slug edited item name (lesson_02, practice_01, etc.)
 * @param parentPath parent folder name (lessons, practices, etc.)
 * @return {Promise<*>}
 */
async function handleContentImages(content, owner, repo, slug, parentPath) {
  const imageUrls = extractAllImageDetails(content, false);
  for (const img of imageUrls) {
    // Case 1: Handle local GitHub images
    if (img.imageUrl.startsWith('https://raw.githubusercontent.com')) {
      const fixedUrl = img.imageUrl.replace(
        `https://raw.githubusercontent.com/${ owner }/${ repo }/draft/${ parentPath }/${ slug }/`,
        ''
      ).split('?')[0];
      content = content.replace(`(${ img.imageUrl })`, `(${ fixedUrl })`);
    } else if (img.imageUrl.startsWith('data:image/')) { // Case 2: Handle embedded data images
      const [type, imgData] = img.imageUrl.split(',');
      const ext = type.split(';')[0].split('/')[1];
      // random name if imageName is missing
      const fileName = img.imageName
        ? slugify(img.imageName.trim().toLowerCase()) + '.' + ext
        : `${ uuidv4() }.${ ext }`;
      const path = `${ parentPath }/${ slug }/files/${ fileName }`;

      try {
        // Try uploading the image file using uploadFile function
        await uploadFile(
          owner, repo, path, imgData, 'new file added', 'draft', true);
        content = content.replace(
          img.imageUrl, path.replace(`${ parentPath }/${ slug }/`, ''));
      } catch (error) {
        console.error(
          `Error uploading image "${ img.imageUrl }": ${ error.message }`);
      }
    } else {
      console.warn(
        `Unsupported image format for "${ img.imageUrl }": Skipping upload.`);
    }
  }

  return content;
}

export {
  makeUniqueSlug,
  handleCourseItemData,
  handleCourseGeneralFiles,
  updateCourseName,
  getCourseGeneralContent,
  handleLessonUpdate,
  fetchAndProcessCourseData,
  getAllConcepts,
  getImageFiles,
  handleCourseItemFiles,
  extractAllImageDetails,
  handleContentImages
};
