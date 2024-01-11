/** Endpoint to mark a course component as Done */
import express from 'express';
import ensureAuthenticated from '../middleware/ensureAuthenticated.js';
import pool from '../../db.js';
import { cacheMarkedAsDoneComponents } from '../setup/setupCache.js';

const router = express.Router();
router.post('/', ensureAuthenticated, async (req, res) => {
  const {
    courseId,
    componentSlug,
    componentUUId,
    nextPagePath
  } = req.body;

  const githubID = req.user.userId;

  if (!githubID || !courseId || !componentSlug || !componentUUId) {
    console.log(githubID, courseId, componentSlug, componentUUId);
    return res.redirect('/notfound');
  }

  if (githubID && courseId && componentSlug && componentUUId) {
    let conn;
    try {
      conn = await pool.getConnection();
      const res1 = await conn.query(
        'SELECT markedAsDoneComponents FROM users_progress WHERE githubID = ? AND courseCode = ?;',
        [githubID, courseId]
      );

      if (!res1[0]) {
        const keyValue = {};
        keyValue[componentUUId] = componentSlug;
        await conn.query(
          'INSERT INTO users_progress (githubID, courseCode, markedAsDoneComponents) VALUES (?, ?, ?);',
          [githubID, courseId, keyValue]
        );
      } else {
        await conn.query(
          'UPDATE users_progress SET markedAsDoneComponents = JSON_SET(markedAsDoneComponents, ?, ?) WHERE githubID = ? AND courseCode = ?;',
          [`$."${ componentUUId }"`, componentSlug, githubID, courseId]
        );
      }

      /** Check if cache for markedAsDoneComponents for given user and given course exists.
       * If yes, delete cache for markedAsDoneComponents when user adds a
       * component from given course */
      if (
        cacheMarkedAsDoneComponents.has(
          `markedAsDoneComponents+${ githubID }+${ courseId }`
        )
      ) {
        cacheMarkedAsDoneComponents.del(
          `markedAsDoneComponents+${ githubID }+${ courseId }`
        );
      }
    } catch (err) {
      console.log('Unable to mark component as done');
      console.error(err);
    } finally {
      if (conn) {
        await conn.release();
      } // release to pool
    }
  }

  return res.redirect(nextPagePath);
});

export default router;
