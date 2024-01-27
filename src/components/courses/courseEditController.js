import {
  getFile,
  updateFile,
  uploadFile
} from '../../functions/githubFileFunctions.js';
import apiRequests from './coursesService.js';
import getCourseData from '../../functions/getCourseData.js';
import { getConfig } from '../../functions/getConfigFuncs.js';
import { updateConfigFile } from './courseEditService.js';
import { cacheConfig } from '../../setup/setupCache.js';

const courseEditController = {
  getSpecificCourse: async (req, res, next) => {
    const { courseId } = req.params;
    let course = await apiRequests.getCourseById(courseId);

    if (!course) {
      return res.redirect('/notfound');
    }

    let validBranches = await apiRequests.listBranches(
      course.repository.replace('https://github.com/', ''));
    validBranches = validBranches.map((b) => b.name);

    if (validBranches.length === 0) { // repo not found
      return res.redirect('/notfound');
    }
    res.locals.refBranch = 'draft';
    res.locals.branches = validBranches;

    let courseConfig = await getCourseData(course, 'draft');

    res.locals.course = course;
    res.locals.config = courseConfig;

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
    const contentSlug = 'about';
    const componentSlug = '';
    let contentName;
    let githubRequest;
    let contentUUId = '';
    let componentUUId = '';
    let componentName = '';
    let componentType = '';

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

    if ((contentSlug && !contentName) ||
      (contentSlug && contentName && componentSlug && !componentName)) {
      console.log(
        'no contentName or componentName found', contentSlug, contentName,
        componentSlug, componentName
      );
      return res.redirect('/notfound');
    }

    /*res.locals.githubRequest = githubRequest;
     res.locals.coursePathInGithub = course.repository.replace(
     'https://github.com/', '');*/

    //console.log(res.locals);
    next();

  },
  getConcept: async (req, res, next) => {
    // Get one concept data based on req.params.courseId and req.params.slug
    const [owner, repo] = res.locals.course.repository.replace(
      'https://github.com/', '')
      .split('/');
    /*const folderContent = await getFolder(
     owner, repo, `concepts/${ req.params.slug }`, 'draft');
     console.log(folderContent);*/
    res.locals.readme = await getFile(
      owner, repo, `concepts/${ req.params.slug }/README.md`, 'draft');
    res.locals.readme.slug = req.params.slug;
    res.locals.readme.data = res.locals.config.config.concepts.find(
      c => c.slug === req.params.slug);
    const sources = await getFile(
      owner, repo, `concepts/${ req.params.slug }/sources.json`, 'draft');
    if (sources && sources.content) {
      sources.content = JSON.parse(sources.content);
    }
    res.locals.sources = sources;
    res.locals.partial = 'course-edit.concepts';
    res.locals.conceptUsage = await apiRequests.conceptUsage(req);
    next();
  },

  getGeneral: async (req, res, next) => {
    // Get course docs/README.md, docs/lisamaterjalid.md
    const [owner, repo] = res.locals.course.repository.replace(
      'https://github.com/', '')
      .split('/');
    res.locals.readme = await getFile(
      owner, repo, `docs/README.md`, 'draft');
    res.locals.materials = await getFile(
      owner, repo, `docs/lisamaterjalid.md`, 'draft');
    res.locals.partial = 'course-edit.general';
    next();
  },

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
  }
};

const renderEditPage = async (req, res) => {
  //console.log(JSON.stringify(res.locals.conceptUsage));
  res.render('course-edit', res.locals);
};

const fileUpload = async (req, res) => {
  console.log(req.body);
  return res.send('OK');
};

export {
  courseEditController, renderEditPage, fileUpload
};
