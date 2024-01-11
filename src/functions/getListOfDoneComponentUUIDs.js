import pool from '../../db.js';
import {
  cacheComponentsUUIds,
  cacheMarkedAsDoneComponents
} from '../setup/setupCache.js';
import { getFile } from './githubFileFunctions.js';

/** Function to get a list of UUIDs of components that have been markedAsDone by a selected user in a selected course. This data is stored in MariaDB.
 * Parameters are user's githubID and course's slug. E.g. '24424256' and
 * 'HKI6001.HK'.
 */
const getMarkedAsDoneComponents = async (githubID, courseId) => {
  let res10;
  let keysArray = [];

  const cacheName = `markedAsDoneComponents+${ githubID }+${ courseId }`;

  /** Check if Cache has markedAsDoneComponents array for given user and for given course.
   * This Cache is flushed whenever user adds or removes a component from given
   * course.
   */
  if (!cacheMarkedAsDoneComponents.has(cacheName)) {
    console.log(
      `❌❌ markedAsDoneComponents for ${ githubID } in ${ courseId } IS NOT from cache`
    );

    // read markedAsDoneComponents value from database
    if (githubID && courseId) {
      let conn;
      try {
        conn = await pool.getConnection();
        //console.log('Connected to MariaDB 5!');

        let fields;
        [res10, fields] = await conn.query(
          'SELECT markedAsDoneComponents FROM users_progress WHERE githubID = ? AND courseCode = ?;',
          [githubID, courseId]
        );
        //console.log('res10:', res10);
      } catch (err) {
        console.log('Unable to get marked as done components');
        console.error(err);
      } finally {
        if (conn) {
          conn.release();
        } // release to pool
      }

      // if nothing has been saved to database yet, return empty array
      if (!res10 || !res10[0]) {
        return keysArray;
      }

      // if sth had been saved to DB before, but then removed and DB now
      // returns empty object, return empty array
      if (res10[0].markedAsDoneComponents === '{}') {
        return keysArray;
      }

      // remove the curly braces around DB entry (that's string type)
      const string = res10[0].markedAsDoneComponents.slice(1, -1);

      // convert DB string entry to object
      const obj = {};

      string.split(',').forEach((pair) => {
        const [key, value] = pair.trim().split(':');
        const keyUnqouted = key.slice(1, -1);
        const valueUnquoted = value.slice(1, -1);
        obj[keyUnqouted] = valueUnquoted;
      });

      // Finally, save keys from object to array and return the array of keys.
      keysArray = Object.keys(obj);
    }

    cacheMarkedAsDoneComponents.set(cacheName, keysArray);
  } else {
    console.log(
      `✅✅ markedAsDoneComponents for ${ githubID } in ${ courseId } FROM CACHE`
    );
    keysArray = cacheMarkedAsDoneComponents.get(cacheName);
  }

  /** Return an array of component UUIDs that have been marked as done (by selected user in selected course). */
  return keysArray;
};

const getComponentsUUIDs = async (repoUrl) => {
  // fetch courseBranchComponentsUUIDs for each course
  // get config.json for the repo
  // from file get: "practices":[{"slug":"praktikum_01","name":"Näidis
  // Praktikum","uuid":"eb040d98-f24a-43f6-92bb-12af08d2d32c"}]

  const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
  const cacheName = `componentsUUIDs+${ repo }`;
  let keysArray = [];

  if (!cacheComponentsUUIds.has(cacheName)) {
    const configJson = await getFile(owner, repo, 'config.json');
    if (configJson) {
      const config = JSON.parse(configJson.content);
      const allComponentSlugs = [];

      config.lessons.filter(lesson => lesson.components).forEach((lesson) => {
        allComponentSlugs.push(lesson.components);
      });

      if (allComponentSlugs.length) {
        const allComponentSlugsFlat = [].concat(...allComponentSlugs);
        console.log('allComponentSlugsFlat5:', allComponentSlugsFlat);

        keysArray = [
          ...config.concepts?.filter(
            (concept) => allComponentSlugsFlat.includes(concept.slug))
            .map((concept) => concept.uuid),
          ...config.practices?.filter(
            (practice) => allComponentSlugsFlat.includes(practice.slug))
            .map((practice) => practice.uuid)
        ];
      }
      //keysArray = data.practices.map(
      //  (p) => p.uuid);
    }

    cacheComponentsUUIds.set(cacheName, keysArray);
  } else {
    keysArray = cacheComponentsUUIds.get(cacheName);
  }
  return keysArray;
};

const ttlMarkedAsDone = async (courseId) => {
  const cacheName = `ttlMarkedAsDone+${ courseId }`;
  if (!cacheMarkedAsDoneComponents.has(cacheName)) {
    console.log(
      `❌❌ ttlMarkedAsDone for ${ courseId } IS NOT from cache`
    );

    let res10;
    let conn;
    if (courseId) {
      try {
        conn = await pool.getConnection();

        [res10] = await conn.query(
          'SELECT count(githubID) as done FROM users_progress WHERE courseCode = ?;',
          [courseId]
        );
        //console.log('res10:', res10);
      } catch (err) {
        console.log('Unable to get marked as done components');
        console.error(err);
      } finally {
        if (conn) {
          conn.release();
        } // release to pool
      }
      cacheMarkedAsDoneComponents.set(cacheName, res10[0].done);
      return res10[0].done;
    } else {
      console.log(
        `✅✅ ttlMarkedAsDone for ${ courseId } FROM CACHE`
      );
      return cacheMarkedAsDoneComponents.get(cacheName);
    }
  }
};

const markedAsDone = async (courseId) => {
  const cacheName = `markedAsDone+${ courseId }`;
  if (!cacheMarkedAsDoneComponents.has(cacheName)) {
    console.log(
      `❌❌ markedAsDone for ${ courseId } IS NOT from cache`
    );

    let res10;
    let conn;
    if (courseId) {
      try {
        conn = await pool.getConnection();

        [res10] = await conn.query(
          'select githubID, JSON_EXTRACT(JSON_KEYS(markedAsDoneComponents), "$[0]") as uuid from users_progress where courseCode = ?',
          [courseId]
        );
        //console.log('res10:', res10);
      } catch (err) {
        console.log('Unable to get marked as done components');
        console.error(err);
      } finally {
        if (conn) {
          conn.release();
        } // release to pool
      }

      const groupedArray = Object.values(
        res10.reduce((acc, { githubID, uuid }) => {
          acc[githubID] = acc[githubID] || { githubID, uuid: [] };
          acc[githubID].uuid.push(uuid);
          return acc;
        }, {}));

      cacheMarkedAsDoneComponents.set(cacheName, groupedArray);
      return groupedArray;
    } else {
      console.log(
        `✅✅ ttlMarkedAsDone for ${ courseId } FROM CACHE`
      );
      return cacheMarkedAsDoneComponents.get(cacheName);
    }
  }
};

export {
  getMarkedAsDoneComponents,
  getComponentsUUIDs,
  ttlMarkedAsDone,
  markedAsDone
} ;
