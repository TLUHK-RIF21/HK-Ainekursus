import { expect } from 'chai';
import sinon from 'sinon';
import apiRequests from '../components/courses/coursesService.js';
import * as editApiRequests from '../components/courses/courseEditService.js';

import {
  courseEditController
} from '../components/courses/courseEditController.js';
import {
  fetchAndProcessCourseData,
  getCourseGeneralContent,
  getImageFiles,
  handleCourseItemFiles,
  handleLessonUpdate
} from '../components/courses/courseEditService.js';
import getCourseData from '../functions/getCourseData.js';
import {
  deleteFolderFromRepo, getFile,
  updateFile
} from '../functions/githubFileFunctions.js';

describe('courseEditController', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getSpecificCourse', () => {
    it('should redirect to notfound if course does not exist', async () => {
      sinon.stub(apiRequests, 'getCourseById').resolves(null);
      const req = { params: { courseId: 'nonexistent' } };
      const res = { redirect: sinon.spy() };
      const next = sinon.spy();
      await courseEditController.getSpecificCourse(req, res, next);
      expect(res.redirect.calledWith('/notfound')).to.be.true;
    });

    it('should call next if course exists', async () => {
      sinon.stub(apiRequests, 'getCourseById')
        .resolves({
          id: 1,
          repository: 'https://github.com/tluhk/HK_Fotograafia-ja-digitaalne-pilditootlus'
        });
      sinon.stub(apiRequests, 'listBranches')
        .resolves([{ name: 'master' }, { name: 'draft' }]);
      const req = { params: { courseId: 1 } };
      const res = { redirect: sinon.spy(), locals: {} };
      const next = sinon.spy();

      await courseEditController.getSpecificCourse(req, res, next);

      expect(next.called).to.be.true;
    });
  });

  describe('publishCourse', () => {
    it(
      'should return false if merge response status is not 204 or 201',
      async () => {
        const course = { repository: 'https://github.com/test/test' };
        sinon.stub(apiRequests, 'mergeMasterWithDraft')
          .resolves({ status: 500 });

        const result = await courseEditController.publishCourse(course);

        expect(result).to.be.false;
      }
    );

    it(
      'should call deleteBranch if merge response status is 204 or 201',
      async () => {
        const course = { repository: 'https://github.com/test/test' };
        sinon.stub(apiRequests, 'mergeMasterWithDraft')
          .resolves({ status: 204 });
        const deleteBranchStub = sinon.stub(apiRequests, 'deleteBranch');

        await courseEditController.publishCourse(course);

        expect(deleteBranchStub.called).to.be.true;
      }
    );
  });

  describe('getGeneral', () => {
    it('should get course general data', async () => {
      const req = { params: { courseId: 'existing' } };
      const res = {
        locals: { course: { repository: 'https://github.com/tluhk/HK_Fotograafia-ja-digitaalne-pilditootlus' } },
        redirect: sinon.spy()
      };
      const next = sinon.spy();

      sinon.stub(apiRequests, 'getCourseById').resolves({ id: 'existing' });
      sinon.replace(
        editApiRequests, 'getCourseGeneralContent', sinon.fake.returns({
          readme: { content: 'content' }, materials: { content: 'content' }
        }));

      /*sinon.stub(editApiRequests, 'getCourseGeneralContent')
       .resolves({
       readme: { content: 'content' }, materials: { content: 'content' }
       });*/

      await courseEditController.getGeneral(req, res, next);

      expect(res.locals.readme.content).to.equal('content');
      expect(res.locals.materials.content).to.equal('content');
      expect(next.called).to.be.true;
    });
  });

  describe('updateGeneral', () => {
    it('should update course general data', async () => {
      const req = {
        body: {
          courseId: 'existing',
          courseName: 'newName',
          readmeSHA: 'sha',
          readmeContent: 'content',
          materialsSHA: 'sha',
          materialsContent: 'content'
        }, files: []
      };
      const res = { redirect: sinon.spy() };

      sinon.stub(apiRequests, 'getCourseById').resolves({ id: 'existing' });
      sinon.stub(apiRequests, 'updateCourseName').resolves();
      sinon.stub(apiRequests, 'handleCourseGeneralFiles').resolves();
      sinon.stub(apiRequests, 'handleCourseItemFiles').resolves();

      await courseEditController.updateGeneral(req, res);

      expect(res.redirect.calledWith('back')).to.be.true;
    });
  });

  describe('getConcept', () => {
    it('should get course concept data', async () => {
      const req = {
        params: {
          courseId: 'existing',
          repository: 'https://github.com/owner/repo',
          slug: 'concept1'
        }
      };
      const res = {
        locals: { course: { repository: 'https://github.com/owner/repo' } },
        redirect: sinon.spy()
      };
      const next = sinon.spy();

      sinon.stub(apiRequests, 'getCourseById')
        .resolves(
          { id: 'existing' });
      sinon.stub(getFile, 'arguments')
        .resolves({ content: 'concept content' });

      await courseEditController.getConcept(req, res, next);

      expect(res.locals.readme.content).to.equal('concept content');
      expect(next.called).to.be.true;
    });
  });

  describe('updateConcept', () => {
    it('should update course concept data', async () => {
      const req = {
        body: {
          courseId: 'existing',
          content: 'new content',
          name: 'concept1',
          sha: 'sha',
          slug: 'concept1'
        }, files: []
      };
      const res = { redirect: sinon.spy() };

      sinon.stub(apiRequests, 'getCourseById').resolves({ id: 'existing' });
      sinon.stub(apiRequests, 'handleCourseItemData')
        .resolves({ slug: 'concept1' });
      sinon.stub(apiRequests, 'handleCourseItemFiles').resolves();

      await courseEditController.updateConcept(req, res);

      expect(res.redirect.calledWith(
        '/course-edit/existing/concept/concept1')).to.be.true;
    });
  });

  describe('deleteConcept', () => {
    it('should delete concept correctly when concept exists', async () => {
      const req = {
        params: {
          courseId: '1',
          slug: 'concept1'
        }
      };
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.stub()
      };

      const course = { repository: 'https://github.com/owner/repo' };
      const courseConfig = { config: { concepts: [{ slug: 'concept1' }] } };

      sinon.stub(apiRequests, 'getCourseById').resolves(course);
      sinon.stub(getCourseData, 'arguments').resolves(courseConfig);
      sinon.stub(deleteFolderFromRepo, 'arguments').resolves();
      sinon.stub(updateFile, 'arguments').resolves();

      await courseEditController.deleteConcept(req, res);

      expect(res.status.calledWith(202)).to.be.true;
      expect(res.send.calledWith('ok')).to.be.true;
    });

    it('should handle error when concept does not exist', async () => {
      const req = {
        params: {
          courseId: '1',
          slug: 'concept1'
        }
      };
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.stub()
      };

      sinon.stub(apiRequests, 'getCourseById').resolves(null);

      await courseEditController.deleteConcept(req, res);

      expect(res.status.calledWith(501)).to.be.true;
      expect(res.send.calledWith('error')).to.be.true;
    });
  });

  describe('getLesson', () => {
    it('should get lesson data correctly when lesson exists', async () => {
      const req = {
        params: {
          courseId: '1',
          slug: 'lesson1'
        }
      };
      const res = {
        locals: {
          course: { repository: 'https://github.com/owner/repo' }
        }
      };
      const next = sinon.spy();

      const lessonContent = { content: 'Lesson content' };
      const allConcepts = [{ name: 'Concept 1' }, { name: 'Concept 2' }];

      sinon.stub(getCourseGeneralContent, 'arguments').resolves(lessonContent);
      sinon.stub(getFile, 'arguments').resolves(lessonContent);
      sinon.stub(fetchAndProcessCourseData, 'arguments').resolves(allConcepts);

      await courseEditController.getLesson(req, res, next);

      expect(res.locals.readme).to.exist;
      expect(res.locals.readme).to.deep.equal(lessonContent);
      expect(res.locals.allConcepts).to.exist;
      expect(res.locals.allConcepts).to.deep.equal(allConcepts);
      expect(next.called).to.be.true;
    });

    it('should handle scenario when lesson does not exist', async () => {
      const req = {
        params: {
          courseId: '1',
          slug: 'lesson1'
        }
      };
      const res = {
        locals: {
          course: { repository: 'https://github.com/owner/repo' }
        },
        redirect: sinon.spy()
      };
      const next = sinon.spy();

      sinon.stub(getCourseGeneralContent, 'arguments').resolves(null);
      sinon.stub(getFile, 'arguments').resolves(null);

      await courseEditController.getLesson(req, res, next);

      expect(res.redirect.calledWith('/notfound')).to.be.true;
    });
  });

  describe('updateLesson', () => {
    it('should update lesson data correctly when lesson exists', async () => {
      const req = {
        body: {
          courseId: '1',
          lessonName: 'Lesson 1',
          content: 'Lesson content',
          slug: 'lesson1'
        },
        files: []
      };
      const res = {
        redirect: sinon.spy()
      };

      const course = { id: '1', repository: 'https://github.com/owner/repo' };

      sinon.stub(apiRequests, 'getCourseById').resolves(course);
      sinon.stub(handleLessonUpdate, 'arguments')
        .resolves(`/course-edit/${ course.id }/lesson/${ req.body.slug }`);
      sinon.stub(handleCourseItemFiles, 'arguments').resolves();

      await courseEditController.updateLesson(req, res);

      expect(res.redirect.calledWith(
        `/course-edit/${ course.id }/lesson/${ req.body.slug }`)).to.be.true;
    });

    it(
      'should redirect back when courseId or lessonName is not provided',
      async () => {
        const req = {
          body: {},
          files: []
        };
        const res = {
          redirect: sinon.spy()
        };

        await courseEditController.updateLesson(req, res);

        expect(res.redirect.calledWith('back')).to.be.true;
      }
    );

    it('should redirect back when course does not exist', async () => {
      const req = {
        body: {
          courseId: '1',
          lessonName: 'Lesson 1',
          content: 'Lesson content',
          slug: 'lesson1'
        },
        files: []
      };
      const res = {
        redirect: sinon.spy()
      };

      sinon.stub(apiRequests, 'getCourseById').resolves(null);

      await courseEditController.updateLesson(req, res);

      expect(res.redirect.calledWith('back')).to.be.true;
    });
  });

  describe('deleteLesson', () => {
    it('should delete lesson correctly when lesson exists', async () => {
      const req = {
        params: {
          courseId: '1',
          slug: 'lesson1'
        }
      };
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.stub()
      };

      const course = { id: '1', repository: 'https://github.com/owner/repo' };
      const courseConfig = { config: { lessons: [{ slug: 'lesson1' }] } };

      sinon.stub(apiRequests, 'getCourseById').resolves(course);
      sinon.stub(getCourseData, 'arguments').resolves(courseConfig);
      sinon.stub(deleteFolderFromRepo, 'arguments').resolves();
      sinon.stub(updateFile, 'arguments').resolves();

      await courseEditController.deleteLesson(req, res);

      expect(res.status.calledWith(202)).to.be.true;
      expect(res.send.calledWith('ok')).to.be.true;
    });

    it('should handle error when lesson does not exist', async () => {
      const req = {
        params: {
          courseId: '1',
          slug: 'lesson1'
        }
      };
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.stub()
      };

      sinon.stub(apiRequests, 'getCourseById').resolves(null);

      await courseEditController.deleteLesson(req, res);

      expect(res.status.calledWith(501)).to.be.true;
      expect(res.send.calledWith('error')).to.be.true;
    });
  });

  describe('getPractice', () => {
    it('should get practice data correctly when practice exists', async () => {
      const req = {
        params: {
          courseId: '1',
          slug: 'practice1'
        }
      };
      const res = {
        locals: {
          course: { repository: 'https://github.com/owner/repo' }
        }
      };
      const next = sinon.spy();

      const practiceContent = { content: 'Practice content' };
      const practiceData = { name: 'Practice 1', slug: 'practice1' };

      sinon.stub(getFile, 'arguments').resolves(practiceContent);
      sinon.stub(getImageFiles, 'arguments').resolves([]);
      sinon.stub(apiRequests, 'conceptUsage').resolves([]);

      await courseEditController.getPractice(req, res, next);

      expect(res.locals.readme).to.exist;
      expect(res.locals.readme).to.deep.equal(practiceContent);
      expect(res.locals.readme.data).to.deep.equal(practiceData);
      expect(next.called).to.be.true;
    });

    it('should handle scenario when practice does not exist', async () => {
      const req = {
        params: {
          courseId: '1',
          slug: 'practice1'
        }
      };
      const res = {
        locals: {
          course: { repository: 'https://github.com/owner/repo' }
        }
      };
      const next = sinon.spy();

      sinon.stub(getFile, 'arguments').resolves(null);

      await courseEditController.getPractice(req, res, next);

      expect(res.locals.readme).to.exist;
      expect(res.locals.readme.slug).to.equal('new');
      expect(next.called).to.be.true;
    });
  });

  describe('updatePractice', () => {
    it(
      'should update practice data correctly when practice exists',
      async () => {
        const req = {
          body: {
            courseId: '1',
            content: 'Updated practice content',
            name: 'Updated Practice',
            sha: 'existing_sha',
            slug: 'practice1'
          },
          files: []
        };
        const res = {
          redirect: sinon.spy()
        };

        const course = { id: '1', repository: 'https://github.com/owner/repo' };

        sinon.stub(apiRequests, 'getCourseById').resolves(course);
        sinon.stub(handleCourseItemData, 'arguments')
          .resolves(`/course-edit/${ course.id }/practice/${ req.body.slug }`);
        sinon.stub(handleCourseItemFiles, 'arguments').resolves();

        await courseEditController.updatePractice(req, res);

        expect(res.redirect.calledWith(
          `/course-edit/${ course.id }/practice/${ req.body.slug }`)).to.be.true;
      }
    );

    it(
      'should redirect back when courseId or practiceName is not provided',
      async () => {
        const req = {
          body: {},
          files: []
        };
        const res = {
          redirect: sinon.spy()
        };

        await courseEditController.updatePractice(req, res);

        expect(res.redirect.calledWith('back')).to.be.true;
      }
    );

    it('should redirect back when course does not exist', async () => {
      const req = {
        body: {
          courseId: '1',
          content: 'Updated practice content',
          name: 'Updated Practice',
          sha: 'existing_sha',
          slug: 'practice1'
        },
        files: []
      };
      const res = {
        redirect: sinon.spy()
      };

      sinon.stub(apiRequests, 'getCourseById').resolves(null);

      await courseEditController.updatePractice(req, res);

      expect(res.redirect.calledWith('back')).to.be.true;
    });
  });

  describe('deletePractice', () => {
    it('should delete practice correctly when practice exists', async () => {
      const req = {
        params: {
          courseId: '1',
          slug: 'practice1'
        }
      };
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.stub()
      };

      const course = { id: '1', repository: 'https://github.com/owner/repo' };
      const courseConfig = { config: { practices: [{ slug: 'practice1' }] } };

      sinon.stub(apiRequests, 'getCourseById').resolves(course);
      sinon.stub(getCourseData, 'arguments').resolves(courseConfig);
      sinon.stub(deleteFolderFromRepo, 'arguments').resolves();

      await courseEditController.deletePractice(req, res);

      expect(res.status.calledWith(202)).to.be.true;
      expect(res.send.calledWith('ok')).to.be.true;
    });

    it('should handle error when practice does not exist', async () => {
      const req = {
        params: {
          courseId: '1',
          slug: 'practice1'
        }
      };
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.stub()
      };

      sinon.stub(apiRequests, 'getCourseById').resolves(null);

      await courseEditController.deletePractice(req, res);

      expect(res.status.calledWith(501)).to.be.true;
      expect(res.send.calledWith('error')).to.be.true;
    });
  });
});