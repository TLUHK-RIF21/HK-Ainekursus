import { getFile } from '../../functions/githubFileFunctions.js';
import apiRequests from './coursesService.js';
import getCourseData from '../../functions/getCourseData.js';

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
  }
};

const renderEditPage = async (req, res) => {
  //console.log(JSON.stringify(res.locals.sources));
  res.render('course-edit', res.locals);
};

const fileUpload = async (req, res) => {
  console.log(req.body);
  return res.send('OK');
};

export {
  courseEditController, renderEditPage, fileUpload
};

const test =
  {
    refBranch: 'draft',
    branches: ['2023-12', 'draft', 'master'],
    course: {
      id: 1,
      name: 'Esimene kursus',
      repository: 'https://github.com/tluhk/HK_Fotograafia-ja-digitaalne-pilditootlus',
      code: 'KUA6711.FK',
      credits: 4,
      form: 'eksam',
      semester: '2023 sügis',
      students: [],
      teachers: []
    },
    config: {
      courseUrl: 'https://ois2.tlu.ee/tluois/aine/KUA6711.FK',
      teacherUsername: 'kaiusk',
      courseIsActive: true,
      courseName: 'Fotograafia ja digitaalne pilditöötlused',
      courseSlug: 'KUA6711.FK',
      courseCode: 'KUA6711.FK',
      courseSemester: '',
      courseSlugInGithub: 'Esimene kursus',
      coursePathInGithub: 'Esimene kursus',
      courseEAP: 3,
      courseGrading: 'eksam',
      refBranch: 'draft',
      courseBranchComponentsUUIDs: [
        '6ed7f7ff-876d-4f05-81ac-170cca19c9d3',
        'bf4f5592-aedc-4c44-a18b-9504123c0c74',
        'eb040d98-f24a-43f6-92bb-12af08d2d32c'
      ],
      courseAllActiveBranches: undefined,
      config: {
        courseName: 'Fotograafia ja digitaalne pilditöötlused',
        courseUrl: 'https://ois2.tlu.ee/tluois/aine/KUA6711.FK',
        teacherUsername: 'kaiusk',
        active: true,
        semester: '',
        docs: [],
        additionalMaterials: [],
        lessons: [],
        concepts: [],
        practices: [],
        sha: '5acbf3e4d01d85012ff14a4d591fd0f8dd33bb3c'
      }
    },
    githubRequest: 'docsService',
    coursePathInGithub: 'tluhk/HK_Fotograafia-ja-digitaalne-pilditootlus',
    breadcrumbNames: {
      courseName: 'Esimene kursus',
      contentName: 'Aine info',
      componentName: ''
    },
    path: {
      courseId: '1',
      contentSlug: 'about',
      refBranch: 'draft',
      fullPath: 'about',
      type: 'docs'
    },
    readme: {
      sha: 'cb1ae6a6736c6cbd7ee2008b05ba2f0110f6656f',
      content: '# Näidis sisuteema\n' +
        '\n' +
        '## Sissejuhatus\n' +
        '\n' +
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Eget mauris pharetra et ultrices. Sem nulla pharetra diam sit amet. Habitant morbi tristique senectus et netus et. \n' +
        '\n' +
        '## Suurema teema pealkiri\n' +
        '\n' +
        '### Alateema\n' +
        '\n' +
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Eget mauris pharetra et ultrices.\n' +
        '\n' +
        '### Alateema\n' +
        '\n' +
        'Quam quisque id diam vel quam elementum pulvinar etiam non. Condimentum lacinia quis vel eros donec ac odio tempor orci. Lacus sed turpis tincidunt id aliquet risus feugiat in. Neque vitae tempus quam pellentesque nec nam. Consectetur a erat nam at lectus urna duis convallis.\n' +
        '\n' +
        '## Suurema teema pealkiri\n' +
        '\n' +
        '### Alateema\n' +
        '\n' +
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Eget mauris pharetra et ultrices.\n'
    },
    sources: {
      sha: '336de955fa911beb2e6f264d7476642dbd8a2e68',
      content: [[], [], []]
    }
  };

