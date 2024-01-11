// https://stackoverflow.com/a/40956931
// CommonJS export Alternative:

import path from 'path';
import { fileURLToPath } from 'url';

import moment from 'moment';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// import { checkServerIdentity } from 'tls';

moment.locale('et');

// Siin saab defineerida handlebarsiga seotud detaile.
// Helpers objekti alla saab lisada funktsioone, mida kasutada lisaks built-in
// helpersitele

// handlebar options: https://stackoverflow.com/a/40898191
export default function hbsHelpers(hbs) {
  return hbs.create({
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, '../..', '/views/layouts'),
    partialsDir: path.join(__dirname, '../..', '/views/partials'),
    helpers: {
      if_equal: (a, b, opts) => {
        if (a === b) {
          return opts.fn(this);
        }
        return opts.inverse(this);
      },
      if_not_equal: (a, b, opts) => {
        if (a !== b) {
          return opts.fn(this);
        }
        return opts.inverse(this);
      },
      last: (array) => array[array.length - 1].path,

      concatActivePath: (arg1, arg2) => `${ arg1 }/${ arg2 }`,
      ifInPaths: (elem, list, options) => {
        if (list === undefined) {
          return options.inverse(this);
        }
        const listMap = list.map((a) => a.path);
        if (listMap.indexOf(elem) > -1) {
          return options.fn(this);
        }
        return options.inverse(this);
      },
      ifInMarkedComponents: (elem, list, options) => {
        //console.log('elem:', elem);
        //console.log('list:', list);
        if (list === undefined) {
          // console.log('list is undefined');
          return options.inverse(this);
        }
        if (list.includes(elem)) {
          //console.log('elem in list');
          return options.fn(this);
        }
        //console.log('elem not in list');

        return options.inverse(this);
      },
      ifTeamInTeamCourses: (elem, list, options) => {
        if (list === undefined) {
          return options.inverse(this);
        }
        const listMap = list.map((a) => a.path);
        if (listMap.indexOf(elem) > -1) {
          return options.fn(this);
        }
        return options.inverse(this);
      },
      ifNotInList: (elem, list, options) => {
        if (list.indexOf(elem) <= -1) {
          return options.fn(this);
        }
        return options.inverse(this);
      },
      if_contains: (a, opts) => {
        if (opts) {
          return opts.includes(a);
        }
      },
      componentIcon: (type) => {
        switch (type) {
          case 'docs':
            return 'attach_file';
          case 'concepts':
            return 'sticky_note_2';
          case 'practice':
            return 'home_repair_service';
          default:
            return '';
          // do nothing
        }
      },
      showComponentType: (component, concepts, practices) => {
        // https://stackoverflow.com/a/50909930
        const checkMatch = (obj) => obj.slug === component;
        if (concepts?.some(checkMatch)) {
          return 'sticky_note_2';
        }
        if (practices?.some(checkMatch)) {
          return 'build';
        }
        return 'attach_file';
      },
      showComponentName: (componentUppercase, concepts, practices) => {
        const component = componentUppercase.toLowerCase();
        const components = concepts?.concat(practices);
        // console.log('component5:', component);
        // console.log('components5:', components);

        const comp = components?.find(
          (x) => x.slug.toLowerCase() === component);
        // console.log('comp.name5:', comp.name);
        return comp ? comp.name : 'ei leia :(';
      },
      showComponentUUID: (componentUppercase, concepts, practices) => {
        const component = componentUppercase.toLowerCase();
        const components = concepts?.concat(practices);
        // console.log('components6:', components);

        const comp = components?.find(
          (x) => x.slug.toLowerCase() === component);
        // console.log('comp.uuid6:', comp.uuid);
        return comp ? comp.uuid : 'ei leia :(';
      },
      capitalize: (aString) => aString?.charAt(0).toUpperCase() +
        aString?.slice(1),
      uppercase: (aString) => aString.toUpperCase(),
      isTeacher: (user) => {
        return user?.roles?.includes('teacher') || false;
      },
      findTeacher: (teacherName, teachers) => {
        console.log(teacherName, teachers);
        const teacherData = teachers?.find(
          (x) => (x.firstName + ' ' + x.lastName) === teacherName);
        // console.log('teacherData2:', teacherData);

        let teacher;
        /**
         * Kui config-failis kirjutatud teacherUsername ei vasta ühegi kasutaja
         * login-nimele teachers tiimis, siis kuva "Määramata õppejõud" nime ja
         * neutraalset avatari
         */
        if (!teacherData) {
          teacher = {
            login: 'Määramata',
            displayName: 'Määramata õppejõud',
            avatar_url: '/images/anonymous-avatar.png'
          };
        } else {
          teacher = teacherData;/* {
           login: teacherData.login,
           displayName: teacherData.displayName,
           email: teacherData.email,
           avatar_url: teacherData.avatar_url
           }*/
        }
        // console.log('teacher1:', teacher);
        return teacher;
      },
      findTeamCourses: (teamSlug, teamCourses) => {
        // console.log('teamSlug2:', teamSlug);
        // console.log('teamCourses2:', teamCourses);
        const coursesData = teamCourses[teamSlug];
        // console.log('coursesData2:', coursesData);

        if (!coursesData || coursesData.length === 0) {
          return false;
        }
        return coursesData;
      },
      /**
       * Set behaviours on which cases the Version dropdown option should get a
       * checked mark.
       */
      setDefaultChecked: (branchSlug, refBranch, selectedVersion, branches) => {
        // console.log('branchSlug5:', branchSlug);
        // console.log('refBranch5:', refBranch);
        // console.log('selectedVersion5:', selectedVersion);
        //console.log('branches5:', branchSlug, refBranch, selectedVersion,
        // branches);

        /**
         * For students
         */
        if (selectedVersion && branchSlug === selectedVersion) {
          return 'checked';
        }
        if (!selectedVersion && (branchSlug === refBranch)) {
          return 'checked';
        }
        if (
          !selectedVersion
          && !branches?.includes(refBranch)
          && branchSlug === 'master'
        ) {
          return 'checked';
        }
        return '';
      },
      add: (a, b) => {
        return a + b;
      },
      createPath: (currentPath) => {
        const {
          courseSlug,
          contentSlug,
          componentSlug
        } = currentPath;

        if (courseSlug && contentSlug && componentSlug) {
          return `/course/${ courseSlug }/${ contentSlug }/${ componentSlug }`;
        }
        if (courseSlug && contentSlug && !componentSlug) {
          return `/course/${ courseSlug }/${ contentSlug }`;
        }
        if (courseSlug && !contentSlug && !componentSlug) {
          return `/course/${ courseSlug }`;
        }
        return '';
      },
      limit: (arr, limit) => {
        if (!Array.isArray(arr)) {
          return [];
        }
        return arr.slice(0, limit);
      },
      timeSince: (date) => moment(date).fromNow(),
      matchingDoneComponentsCount: (
        markedAsDoneComponentsUUIDs,
        courseBranchComponentsUUIDs
      ) => {
        /*console.log(
         'markedAsDoneComponentsUUIDs7:',
         markedAsDoneComponentsUUIDs
         );
         console.log(
         'courseBranchComponentsUUIDs7:',
         courseBranchComponentsUUIDs
         );*/
        if (markedAsDoneComponentsUUIDs) {
          return markedAsDoneComponentsUUIDs.filter(
            (item) => courseBranchComponentsUUIDs.includes(item)).length;
        } else return 0;
      },
      matchingDoneComponentsPercent: (
        markedAsDoneComponentsUUIDs,
        courseBranchComponentsUUIDs
      ) => {
        // console.log('markedAsDoneComponentsUUIDs7:',
        // markedAsDoneComponentsUUIDs);
        // console.log('courseBranchComponentsUUIDs7:',
        // courseBranchComponentsUUIDs);
        if (markedAsDoneComponentsUUIDs && courseBranchComponentsUUIDs) {
          const commonElementsCount = markedAsDoneComponentsUUIDs.filter(
            (item) => courseBranchComponentsUUIDs.includes(item)).length;
          // console.log('percent1:', percent);
          return (commonElementsCount / courseBranchComponentsUUIDs.length) *
            100;
        } else {
          return 0;
        }
      },
      jsonStringify: (context) => JSON.stringify(context)
    }
  });
}
