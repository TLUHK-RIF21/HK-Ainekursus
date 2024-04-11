import express from 'express';
import validateTeacher from '../../middleware/validateTeacher.js';
import apiRequests from './coursesService.js';
import {
  courseEditController,
  renderEditPage
} from './courseEditController.js';

const router = express.Router();

router.get('/publish/:courseId', validateTeacher, async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const course = await apiRequests.getCourseById(courseId);
    if (!course) {
      return res.redirect('/notfound');
    }
    await courseEditController.publishCourse(course);
    return res.redirect(`/course/${ courseId }/about?ref=master`);
  } catch (error) {
    next(error);
  }
});

//edit general data
router.get('/:courseId', validateTeacher,
  courseEditController.getSpecificCourse, // general data
  courseEditController.getGeneral, renderEditPage
);

router.post(
  '/:courseId',
  courseEditController.updateGeneral
);

//concepts related routes
router.get('/:courseId/concept/:slug', validateTeacher,
  courseEditController.getSpecificCourse, courseEditController.getConcept,
  renderEditPage
);

router.post('/:courseId/concept/:slug', courseEditController.updateConcept);

router.delete(
  '/:courseId/concept/:slug',
  courseEditController.deleteConcept
);

//lessons related routes
router.get('/:courseId/lesson/:slug', validateTeacher,
  courseEditController.getSpecificCourse, courseEditController.getLesson,
  renderEditPage
);

router.post('/:courseId/lesson/:slug', courseEditController.updateLesson);

router.delete(
  '/:courseId/lesson/:slug',
  courseEditController.deleteLesson
);

//practices related routes
router.get('/:courseId/practice/:slug', validateTeacher,
  courseEditController.getSpecificCourse, courseEditController.getPractice,
  renderEditPage
);

router.post('/:courseId/practice/:slug', courseEditController.updatePractice);

router.delete(
  '/:courseId/practice/:slug',
  courseEditController.deletePractice
);

export default router;