import express from 'express';
import {
  allCoursesController, renderEditPage,
  responseAction
} from './coursesController.js';
import validateTeacher from '../../middleware/validateTeacher.js';
import apiRequests from './coursesService.js';

const router = express.Router();

router.get(
  '/publish/:courseId',
  validateTeacher,
  async (req, res, next) => {
    try {
      const courseId = req.params.courseId;
      const course = await apiRequests.getCourseById(courseId);
      if (!course) {
        return res.redirect('/notfound');
      }
      await allCoursesController.publishCourse(course);
      return res.redirect(`/course/${ courseId }/about?ref=master`);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:courseId/:contentSlug?/:componentSlug?',
  validateTeacher,
  allCoursesController.getSpecificCourse,
  responseAction,
  renderEditPage
);

router.post(
  '/',
  allCoursesController.updateCourseData
);

export default router;