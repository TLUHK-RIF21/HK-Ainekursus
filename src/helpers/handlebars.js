/* eslint-disable no-underscore-dangle */
/* eslint-disable max-len */
/* eslint-disable no-script-url */
// https://stackoverflow.com/a/40956931
// CommonJS export Alternative:

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import moment from 'moment';
// import { checkServerIdentity } from 'tls';

moment.locale('et');

// Siin saab defineerida handlebarsiga seotud detaile.
// Helpers objekti alla saab lisada funktsioone, mida kasutada lisaks built-in helpersitele

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
        } return opts.inverse(this);
      },
      if_not_equal: (a, b, opts) => {
        if (a !== b) {
          return opts.fn(this);
        } return opts.inverse(this);
      },
      last: (array) => array[array.length - 1].path,

      concatActivePath: (arg1, arg2) => `${arg1}/${arg2}`,
      ifInPaths: (elem, list, options) => {
        if (list === undefined) return options.inverse(this);
        const listMap = list.map((a) => a.path);
        if (listMap.indexOf(elem) > -1) {
          return options.fn(this);
        }
        return options.inverse(this);
      },
      ifInMarkedComponents: (elem, list, options) => {
        console.log('elem:', elem);
        console.log('list:', list);
        if (list === undefined) {
          // console.log('list is undefined');
          return options.inverse(this);
        }
        if (list.includes(elem)) {
          // console.log('elem in list');
          return options.fn(this);
        }
        // console.log('elem not in list');

        return options.inverse(this);
      },
      ifTeamInTeamCourses: (elem, list, options) => {
        if (list === undefined) return options.inverse(this);
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
      componentIcon: (type) => {
        switch (type) {
          case 'docs': return 'attach_file';
          case 'concepts': return 'sticky_note_2';
          case 'practice': return 'home_repair_service';
          default: return '';
            // do nothing
        }
      },
      showComponentType: (component, concepts, practices) => {
        // https://stackoverflow.com/a/50909930
        const checkMatch = (obj) => obj.slug === component;
        if (concepts.some(checkMatch)) return 'sticky_note_2';
        if (practices.some(checkMatch)) return 'build';
        return 'attach_file';
      },
      showComponentName: (componentUppercase, concepts, practices) => {
        const component = componentUppercase;
        const components = concepts.concat(practices);
        const comp = components.find((x) => (x.slug) === component);
        return comp.name;
      },
      showComponentUUID: (componentUppercase, concepts, practices) => {
        console.log('componentUppercase5:', componentUppercase);
        console.log('concepts5:', concepts);
        console.log('practices5:', practices);
        const component = componentUppercase;
        const components = concepts.concat(practices);
        const comp = components.find((x) => (x.slug) === component);
        console.log('comp.uuid5:', comp.uuid);
        return comp.uuid;
      },
      capitalize: (aString) => aString.charAt(0).toUpperCase() + aString.slice(1),
      findTeacher: (teacherName, teachers) => {
        // console.log('teacherName2:', teacherName);
        // console.log('teachers2:', teachers);
        const teacherData = teachers.find((x) => x.login === teacherName);
        // console.log('teacherData2:', teacherData);

        let teacher;
        /**
         * Kui config-failis kirjutatud teacherUsername ei vasta ühegi kasutaja login-nimele teachers tiimis, siis kuva "Määramata õppejõud" nime ja neutraalset avatari
         */
        if (!teacherData) {
          teacher = {
            login: 'Määramata',
            displayName: 'Määramata õppejõud',
            avatar_url: '/images/anonymous-avatar.png',
          };
        } else {
          teacher = {
            login: teacherData.login,
            displayName: teacherData.displayName,
            email: teacherData.email,
            avatar_url: teacherData.avatar_url,
          };
        }
        // console.log('teacher1:', teacher);
        return teacher;
      },
      findTeamCourses: (teamSlug, teamCourses) => {
        // console.log('teamSlug2:', teamSlug);
        // console.log('teamCourses2:', teamCourses);
        const coursesData = teamCourses[teamSlug];
        // console.log('coursesData2:', coursesData);

        if (coursesData.length === 0) return false;
        return coursesData;
      },
      /**
       * Set behaviours on which cases the Version dropdown option should get a checked mark.
       */
      setDefaultChecked: (branchSlug, refBranch, selectedVersion, branches) => {
        console.log('branchSlug5:', branchSlug);
        console.log('refBranch5:', refBranch);
        console.log('selectedVersion5:', selectedVersion);
        console.log('branches5:', branches);

        /**
         * For students
         */
        if (selectedVersion && branchSlug === selectedVersion) {
          return 'checked';
        }
        if (!selectedVersion && branchSlug === refBranch) {
          return 'checked';
        }
        if (!selectedVersion && !branches.includes(refBranch) && branchSlug === 'master') {
          return 'checked';
        } return '';
      },
      createPath: (currentPath) => {
        const { courseSlug, contentSlug, componentSlug } = currentPath;

        if (courseSlug && contentSlug && componentSlug) return `/course/${courseSlug}/${contentSlug}/${componentSlug}`;
        if (courseSlug && contentSlug && !componentSlug) return `/course/${courseSlug}/${contentSlug}`;
        if (courseSlug && !contentSlug && !componentSlug) return `/course/${courseSlug}`;
        return '';
      },
      limit: (arr, limit) => {
        if (!Array.isArray(arr)) { return []; }
        return arr.slice(0, limit);
      },
      timeSince: (date) => moment(date).fromNow(),
      matchingDoneComponentsCount: (markedAsDoneComponentsUUIDs, courseBranchComponentsUUIDs) => {
        console.log('markedAsDoneComponentsUUIDs7:', markedAsDoneComponentsUUIDs);
        console.log('courseBranchComponentsUUIDs7:', courseBranchComponentsUUIDs);
        const commonElementsCount = markedAsDoneComponentsUUIDs.filter((item) => courseBranchComponentsUUIDs.includes(item)).length;

        return commonElementsCount;
      },
      jsonStringify: (context) => JSON.stringify(context),
    },
  });
}
