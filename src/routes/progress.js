/** Endpoints for progress overview pages.
 * Only available for teachers.
 */
import express from 'express';

const router = express.Router();
import resetSelectedVersion from '../middleware/resetSelectedVersion.js';
import validateTeacher from '../middleware/validateTeacher.js';
import allOverviewController
  from '../components/progress-overview/overviewController.js';

router.get(
  '/',
  resetSelectedVersion,
  validateTeacher,
  allOverviewController.getOverview
);

router.get(
  '/:courseId?',
  resetSelectedVersion,
  validateTeacher,
  allOverviewController.getOverview
);

router.post('/', validateTeacher, (req, res) => {
  let selectedCourseDataParsed;
  if (req.body && req.body.selectedCourseData) {
    selectedCourseDataParsed = JSON.parse(req.body.selectedCourseData);
  }
  req.session.courseSlugData = selectedCourseDataParsed;

  if (req.body && req.body.selectedTeam && req.body.selectedCourse) {
    return res.redirect(
      `/progress-overview/${ req.body.selectedTeam }/${ req.body.selectedCourse }`
    );
  }

  // Store the displayBy in the session
  req.session.displayBy = req.body.displayBy;

  return res.redirect(
    `/progress-overview?displayBy=${ req.session.displayBy }`
  );
});

export default router;
