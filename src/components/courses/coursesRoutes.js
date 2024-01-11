import express from 'express';
import {
  allCoursesController, renderEditPage,
  renderPage,
  responseAction
} from './coursesController.js';
import validateTeacher from '../../middleware/validateTeacher.js';

const router = express.Router();

router.get(
  '/others',
  validateTeacher,
  allCoursesController.getOtherTeachersCourses,
  (req, res) => { return res.send('ok');}
);

/**
 * Get single course by Id
 */
router.get(
  '/:courseId/:contentSlug?/:componentSlug?',
  //ensureAuthenticated,
  allCoursesController.getSpecificCourse,
  responseAction,
  renderPage
);

export default router;