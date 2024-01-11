import express from 'express';
import resetSelectedVersion from '../middleware/resetSelectedVersion.js';
import ensureAuthenticated from '../middleware/ensureAuthenticated.js';

const router = express.Router();

/** Endpoint for Logout.
 https://www.tabnine.com/code/javascript/functions/express/Request/logout
 */
router.get('/', resetSelectedVersion, ensureAuthenticated, (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    return req.session.destroy((err2) => {
      if (err2) {
        return next(err2);
      }
      console.log('Logged out');
      res.clearCookie('HK_ainekursused');
      return res.redirect('/');
    });
  });
});

export default router;
