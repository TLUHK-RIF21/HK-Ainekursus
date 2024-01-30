import express from 'express';
import validateTeacher from '../../middleware/validateTeacher.js';
import apiRequests from './coursesService.js';
import {
  courseEditController, fileUpload, renderEditPage
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

//edit concept data
router.get('/:courseId/concept/:slug', validateTeacher,
  courseEditController.getSpecificCourse, courseEditController.getConcept,
  renderEditPage
);

router.post('/:courseId', (req, res) => {
  // Handle POST request for /:courseId
  // You can access the request body with req.body
  //allCoursesController.updateCourseData
});

router.post('/:courseId/concept/:slug', courseEditController.updateConcept);

router.delete(
  '/:courseId/concept/:slug',
  // Handle DELETE request for /:courseId/concept/:slug
  // req.params.slug = { courseId: '1', slug: 'uus-sisuteema' }
  courseEditController.deleteConcept
);

router.post('/upload', fileUpload);

/*router.post(
 '/',
 allCoursesController.updateCourseData
 );*/

export default router;