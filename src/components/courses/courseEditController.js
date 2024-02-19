import {
  deleteFolderFromRepo, getFile, updateFile
} from '../../functions/githubFileFunctions.js';
import apiRequests from './coursesService.js';
import getCourseData from '../../functions/getCourseData.js';
import {
  fetchAndProcessCourseData,
  getCourseGeneralContent,
  getImageFiles,
  handleCourseGeneralFiles,
  handleLessonUpdate,
  updateCourseName,
  extractAllImageDetails,
  handleCourseItemData,
  handleCourseItemFiles
} from './courseEditService.js';
import {
  cacheConceptUsage,
  cacheConfig
} from '../../setup/setupCache.js';
import validBranchesService from './coursesService.js';

const courseEditController = {
  /**
   * Get one course for editing based on ID
   * @param req
   * @param res
   * @param next
   * @return {Promise<*>}
   */
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

    if (!validBranches.includes('draft')) {
      await validBranchesService.createNewBranch(
        course.repository.replace('https://github.com/', ''), 'master',
        'draft'
      );
    }
    res.locals.refBranch = 'draft';

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
      if (x.additionalMaterials.length && x.additionalMaterials[0].slug ===
        componentSlug && x.slug === contentSlug) {
        componentName = x.additionalMaterials[0].name;
        componentType = 'docs';
        githubRequest = 'lessonAdditionalMaterialsService';
        // console.log('Slug found in config.lessons.additionalMaterials');
      }
    });

    if ((contentSlug && !contentName) ||
      (contentSlug && contentName && componentSlug && !componentName)) {
      console.log('no contentName or componentName found', contentSlug,
        contentName, componentSlug, componentName
      );
      return res.redirect('/notfound');
    }
    next();
  },

  /**
   * Merge 'master' branch with 'draft' and delete 'draft' on success
   * @param course
   * @return {Promise<*>}
   */
  publishCourse: async (course) => {
    const mergeResponse = await apiRequests.mergeMasterWithDraft(
      course.repository.replace('https://github.com/', ''),
      'Shipped cool_feature!'
    );
    if (mergeResponse.status === 204 || mergeResponse.status === 201) { // delete draft branch
      return await apiRequests.deleteBranch(
        course.repository.replace('https://github.com/', ''), 'draft');
    }
    return false;
  },

  /**
   * Get course general data
   * @param req
   * @param res
   * @param next
   * @return {Promise<void>}
   */
  getGeneral: async (req, res, next) => {
    // Get course docs/README.md, docs/lisamaterjalid.md
    const [owner, repo] = res.locals.course.repository.replace(
      'https://github.com/', '')
      .split('/');
    const generalContent = await getCourseGeneralContent(
      owner, repo, 'docs', 'draft');
    res.locals = { ...res.locals, ...generalContent };
    res.locals.partial = 'course-edit.general';
    next();
  },

  /**
   * Update course general data
   * @param req
   * @param res
   * @return {Promise<*>}
   */
  updateGeneral: async (req, res) => {
    const {
      courseId,
      courseName,
      readmeSHA,
      readmeContent,
      materialsSHA,
      materialsContent
    } = req.body;
    const oldFiles = req.body['files[]'];
    const newFiles = req.files;
    if (courseId && courseName) {
      const course = await apiRequests.getCourseById(courseId);
      if (course) {
        const [owner, repo] = course.repository.replace(
          'https://github.com/', '')
          .split('/');
        await updateCourseName(owner, repo, course, courseName);
        await handleCourseGeneralFiles(owner, repo, courseId,
          { sha: readmeSHA, content: readmeContent },
          { sha: materialsSHA, content: materialsContent }
        );
        await handleCourseItemFiles(
          owner, repo, '', oldFiles, newFiles, 'docs');
      }
    }
    return res.redirect('back');
  },

  // concept handlers
  getConcept: async (req, res, next) => {
    // Get one concept data based on req.params.courseId and req.params.slug
    const [owner, repo] = res.locals.course.repository.replace(
      'https://github.com/', '')
      .split('/');
    // Get main content
    res.locals.readme = await getFile(
      owner, repo, `concepts/${ req.params.slug }/README.md`, 'draft');
    if (res.locals.readme) { // existing concept
      //remove extra whitespaces and replace line endings
      /*res.locals.readme.content = res.locals.readme.content.split('\r\n')
       .map(line => line.trim() + '\r');*/
      res.locals.readme.slug = req.params.slug;
      res.locals.readme.data = res.locals.config.config.concepts.find(
        c => c.slug === req.params.slug);

      res.locals.conceptUsage = await apiRequests.conceptUsage(
        req, res.locals.readme.data?.uuid);
      res.locals.files = await getImageFiles(
        owner, repo, `concepts/${ req.params.slug }/files`, 'draft');
      // replace relative image urls in markdown with absolute path
      const imageUrls = extractAllImageDetails(res.locals.readme.content);
      imageUrls.forEach((image) => {
        const dest = res.locals.files.find(
          (img) => image.imageUrl === 'files/' + img.name);
        if (dest) {
          res.locals.readme.content = res.locals.readme.content.replace(
            `](${ image.imageUrl })`, `](${ dest.thumbUrl })`);
        }
      });
    } else { // create new
      res.locals.readme = {
        slug: 'new', data: {}, sources: {}
      };
    }
    res.locals.partial = 'course-edit.concepts';
    next();
  },

  updateConcept: async (req, res) => {
    const { courseId, content, name, sha, slug } = req.body;
    if (!(content && courseId)) {
      return res.redirect('back');
    } else {
      const course = await apiRequests.getCourseById(courseId);
      if (course) {
        const [owner, repo] = course.repository.replace(
          'https://github.com/', '').split('/');
        // create new concept object
        const concept = { name, content, slug, sha: sha.length ? sha : null };
        // update course config and concept data
        const updated = await handleCourseItemData(
          owner, repo, course, concept, 'concepts');
        // get embedded images from content
        const imageUrls = extractAllImageDetails(updated.content, true)
          .map((img) => (`concepts/${ updated.slug }/${ img.imageUrl }`));
        // add files from content
        if (imageUrls.length) {
          if (req.body['files[]']) {
            req.body['files[]'] = [
              ...new Set([...req.body['files[]'], ...imageUrls])];
          } else {
            req.body['files[]'] = imageUrls;
          }
        }
        if (req.body['files[]']) {
          await handleCourseItemFiles(
            owner, repo, updated.slug, req.body['files[]'], req.files,
            'concepts'
          );
        }
        // clear cache
        cacheConceptUsage.del('conceptUsages+' + courseId);
        cacheConfig.del(`getConfig:${ owner }/${ repo }+draft`);
        return res.redirect(
          `/course-edit/${ course.id }/concept/${ updated.slug }`);
      }
      return res.redirect('back');
    }
  },

  deleteConcept: async (req, res) => {
    const { courseId, slug } = req.params;
    const course = await apiRequests.getCourseById(courseId);

    if (course) {
      const [owner, repo] = course.repository.replace('https://github.com/', '')
        .split('/');
      await deleteFolderFromRepo(owner, repo, `concepts/${ slug }`, 'draft');
      const courseConfig = await getCourseData(course, 'draft');
      if (courseConfig) {
        courseConfig.config.concepts = courseConfig.config.concepts.filter(
          c => c.slug !== slug);
        await updateFile(owner, repo, 'config.json', {
          content: JSON.stringify(courseConfig.config),
          sha: courseConfig.config.sha
        }, 'concept removed from the config.json', 'draft');
      }
      cacheConceptUsage.del('conceptUsages+' + courseId);
      cacheConfig.del(`getConfig:${ owner }/${ repo }+draft`);
      return res.status(202).send('ok');
    }
    return res.status(501).send('error');
  },

  // lesson handlers
  getLesson: async (req, res, next) => {
    const [owner, repo] = res.locals.course.repository.replace(
      'https://github.com/', '')
      .split('/');
    const folderContent = await getCourseGeneralContent(
      owner, repo, 'lessons/' + req.params.slug, 'draft');
    res.locals = { ...res.locals, ...folderContent };
    // add concepts data
    res.locals.allConcepts = await fetchAndProcessCourseData();
    if (folderContent && req.params.slug !== 'new') {
      // add config data

      res.locals.readme.data = res.locals.config.config.lessons.find(
        c => c.slug === req.params.slug);
      res.locals.readme.data.components = res.locals.readme.data.components.map(
        uuid => {
          const concept = res.locals.config.config.concepts.find(
            concept => concept.uuid === uuid);
          if (!concept) {
            const practice = res.locals.config.config.practices.find(
              practice => practice.uuid === uuid);
            if (practice) {
              practice.type = 'practices';
              return practice;
            } else {
              // check external concepts
              return res.locals.allConcepts.find(c => c.uuid === uuid);
            }
          } else {
            concept.type = 'concepts';
            return concept;
          }
        });

    } else { // new lesson
      res.locals.readme = {
        slug: '', data: {}, sources: {}
      };
    }

    res.locals.readme.slug = req.params.slug;
    res.locals.partial = 'course-edit.lessons';
    next();
  },

  updateLesson: async (req, res) => {
    const { courseId, lessonName } = req.body;
    const lessonSlug = req.params.slug;
    if (!(courseId && lessonName)) {
      return res.redirect('back');
    } else {
      const course = await apiRequests.getCourseById(data.courseId);
      // if we have course
      if (course) {
        const [owner, repo] = course.repository.replace(
          'https://github.com/', '')
          .split('/');
        const url = await handleLessonUpdate(
          owner, repo, course, req.body, lessonSlug);
        cacheConceptUsage.del('conceptUsages+' + courseId);
        console.log('🚨uued failid:', req.files);
        // add files
        await handleCourseItemFiles(owner, repo, lessonSlug,
          req.body['files[]'], req.files, 'lessons'
        );
        return res.redirect(url);
      }
      return res.redirect('back');
    }
  },

  deleteLesson: async (req, res) => {
    const { courseId, slug } = req.params;
    const course = await apiRequests.getCourseById(courseId);
    if (course) {
      const [owner, repo] = course.repository.replace('https://github.com/', '')
        .split('/');
      await deleteFolderFromRepo(owner, repo, `lessons/${ slug }`, 'draft');
      const courseConfig = await getCourseData(course, 'draft');
      if (courseConfig) {
        courseConfig.config.lessons = courseConfig.config.lessons.filter(
          l => l.slug !== slug);
        await updateFile(owner, repo, 'config.json', {
          content: JSON.stringify(courseConfig.config),
          sha: courseConfig.config.sha
        }, 'lesson removed from the config.json', 'draft');
      }
      cacheConfig.del(`getConfig:${ owner }/${ repo }+draft`);
      cacheConceptUsage.del('conceptUsages+' + courseId);
      return res.status(202).send('ok');
    }
    return res.status(501).send('error');
  },

  // practice handlers
  getPractice: async (req, res, next) => {
    // Get one practice data based on req.params.courseId and req.params.slug
    const [owner, repo] = res.locals.course.repository.replace(
      'https://github.com/', '')
      .split('/');
    // Get main content
    res.locals.readme = await getFile(
      owner, repo, `practices/${ req.params.slug }/README.md`, 'draft');
    //remove extra whitespaces and replace line endings
    /*res.locals.readme.content = res.locals.readme.content.split('\r\n')
     .map(line => line.trim() + '\r');*/
    //console.log(res.locals.readme.content);
    if (res.locals.readme) { // existing practice
      res.locals.readme.slug = req.params.slug;
      res.locals.readme.data = res.locals.config.config.practices.find(
        c => c.slug === req.params.slug);

      res.locals.practiceUsage = await apiRequests.conceptUsage(
        req, res.locals.readme.data?.uuid);
      res.locals.files = await getImageFiles(
        owner, repo, `practices/${ req.params.slug }/files`, 'draft');
      // replace relative image urls in markdown with absolute path
      const imageUrls = extractAllImageDetails(res.locals.readme.content);
      imageUrls.forEach((image) => {
        const dest = res.locals.files.find(
          (img) => image.imageUrl === 'files/' + img.name);
        if (dest) {
          res.locals.readme.content = res.locals.readme.content.replace(
            `](${ image.imageUrl })`, `](${ dest.thumbUrl })`);
        }
      });
    } else { // create new
      res.locals.readme = {
        slug: 'new', data: {}, sources: {}
      };
    }
    res.locals.partial = 'course-edit.practices';
    next();
  },

  updatePractice: async (req, res) => {
    const { courseId, content, name, sha, slug } = req.body;
    if (!(content && courseId)) {
      return res.redirect('back');
    } else {
      const course = await apiRequests.getCourseById(courseId);
      if (course) {
        const [owner, repo] = course.repository.replace(
          'https://github.com/', '').split('/');
        // create new concept object
        const practice = { name, content, slug, sha: sha.length ? sha : null };
        // update course config and concept data
        const updated = await handleCourseItemData(
          owner, repo, course, practice, 'practices');
        // get embedded images from content
        const imageUrls = extractAllImageDetails(updated.content, true)
          .map((img) => (`practices/${ updated.slug }/${ img.imageUrl }`));
        // add files from content
        if (imageUrls.length) {
          if (req.body['files[]']) {
            req.body['files[]'] = [
              ...new Set([...req.body['files[]'], ...imageUrls])];
          } else {
            req.body['files[]'] = imageUrls;
          }
        }
        if (req.body['files[]']) {
          await handleCourseItemFiles(
            owner, repo, updated.slug, req.body['files[]'], req.files,
            'practices'
          );
        }
        // clear cache
        cacheConceptUsage.del('conceptUsages+' + courseId);
        cacheConfig.del(`getConfig:${ owner }/${ repo }+draft`);
        return res.redirect(
          `/course-edit/${ course.id }/practice/${ updated.slug }`);
      }
      return res.redirect('back');
    }
  },

  deletePractice: async (req, res) => {
    const { courseId, slug } = req.params;
    const course = await apiRequests.getCourseById(courseId);

    if (course) {
      const [owner, repo] = course.repository.replace('https://github.com/', '')
        .split('/');
      await deleteFolderFromRepo(owner, repo, `practices/${ slug }`, 'draft');
      const courseConfig = await getCourseData(course.id, 'draft');
      if (courseConfig) {
        course.config.practices = course.config.practices.filter(
          c => c.slug !== slug);
        await updateFile(owner, repo, 'config.json', {
          content: JSON.stringify(course.config), sha: course.config.sha
        }, 'practice removed from the config.json', 'draft');
      }
      cacheConceptUsage.del('conceptUsages+' + courseId);
      cacheConfig.del(`getConfig:${ owner }/${ repo }+draft`);
      return res.status(202).send('ok');
    }
    return res.status(501).send('error');
  }
};

const renderEditPage = async (req, res) => {
  res.locals.user = req.user;
  res.render('course-edit', res.locals);
};

export {
  courseEditController, renderEditPage
};