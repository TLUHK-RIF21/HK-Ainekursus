/** Endpoint to unmark/remove course component as Done */
import ensureAuthenticated from '../middleware/ensureAuthenticated.js';
import pool from '../../db.js';
import { cacheMarkedAsDoneComponents } from '../setup/setupCache.js';
import express from 'express';

const router = express.Router();
router.post('/', ensureAuthenticated, async (req, res) => {
  const {
    courseId,
    componentSlug,
    componentUUId
  } = req.body;

  const githubID = req.user.userId;

  if (!githubID || !courseId || !componentSlug || !componentUUId) {
    return res.redirect('/notfound');
  }

  if (githubID && courseId && componentSlug && componentUUId) {
    let conn;
    try {
      conn = await pool.getConnection();
      const res6 = await conn.query(
        'SELECT markedAsDoneComponents FROM users_progress WHERE githubID = ? AND courseCode = ?;',
        [githubID, courseId]
      );

      if (res6[0]) {
        await conn.query(
          'UPDATE users_progress SET markedAsDoneComponents = JSON_REMOVE(markedAsDoneComponents, ?) WHERE githubID = ? AND courseCode = ?;',
          [`$."${ componentUUId }"`, githubID, courseId]
        );
      }

      /** Check if cache for markedAsDoneComponents for given user and given course exists.
       * If yes, delete cache for markedAsDoneComponents when user removes a
       * done component from given course */
      if (cacheMarkedAsDoneComponents.has(
        `markedAsDoneComponents+${ githubID }+${ courseId }`
      )) {
        cacheMarkedAsDoneComponents.del(
          `markedAsDoneComponents+${ githubID }+${ courseId }`
        );
      }
    } catch (err) {
      // console.log('Unable to connect to MariaDB 3');
      console.log('Unable to remove component as done');
      console.error(err);
    } finally {
      if (conn) {
        await conn.release();
      } // release to pool
    }
  }

  return res.redirect('back');
});

export default router;
