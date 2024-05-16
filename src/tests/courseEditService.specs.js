import { expect } from 'chai';
import sinon from 'sinon';
import * as courseEditService from '../components/courses/courseEditService.js';
import getCourseData from '../functions/getCourseData.js';
import {
  updateFile,
  uploadFile
} from '../functions/githubFileFunctions.js';
import {
  fetchAndProcessCourseData, getCourseGeneralContent,
  handleContentImages, handleLessonUpdate
} from '../components/courses/courseEditService.js';
import { usersApi } from '../setup/setupUserAPI.js';

describe('courseEditService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('makeUniqueSlug', () => {
    it('should make a unique slug', () => {
      const slug = 'test';
      const array = [{ slug: 'test' }, { slug: 'test-1' }];

      const result = courseEditService.makeUniqueSlug(slug, array);

      expect(result).to.equal('test-2');
    });
  });

  describe('handleCourseItemData', () => {
    it('should update existing course item data', async () => {
      const owner = 'testOwner';
      const repo = 'testRepo';
      const course = {
        id: 1,
        repository: 'https://github.com/tluhk/HK_Fotograafia-ja-digitaalne-pilditootlus'
      };
      const item = {
        slug: 'existing',
        name: 'newName',
        content: 'new content'
      };
      const parentPath = 'lessons';

      sinon.stub(getCourseData, 'arguments')
        .withArgs(course, 'draft', ['draft'])
        .resolves(
          { config: { lessons: [{ slug: 'existing', name: 'oldName' }] } });
      sinon.stub(updateFile, 'arguments').resolves();
      sinon.stub(handleContentImages, 'arguments').resolves('new content');

      const result = await courseEditService.handleCourseItemData(
        owner, repo, course, item, parentPath);

      expect(result.slug).to.equal('existing');
      expect(result.content).to.equal('new content');
    });

    it('should create new course item data', async () => {
      const owner = 'testOwner';
      const repo = 'testRepo';
      const course = {
        id: 1,
        repository: 'https://github.com/tluhk/HK_Fotograafia-ja-digitaalne-pilditootlus'
      };
      const item = { slug: 'new', name: 'newName', content: 'new content' };
      const parentPath = 'lessons';

      sinon.stub(getCourseData, 'arguments')
        .withArgs(course, 'draft', ['draft'])
        .resolves(
          { config: { lessons: [] } });
      sinon.stub(updateFile, 'arguments').resolves();
      sinon.stub(uploadFile, 'arguments').resolves();
      sinon.stub(handleContentImages, 'arguments').resolves('new content');

      const result = await courseEditService.handleCourseItemData(
        owner, repo, course, item, parentPath);

      expect(result.slug).to.not.equal('new');
      expect(result.content).to.equal('new content');
    });
  });

  describe('handleCourseGeneralFiles', () => {
    it('should update course general files', async () => {
      const owner = 'testOwner';
      const repo = 'testRepo';
      const courseId = 'existing';
      const readme = { content: 'new content', sha: 'sha' };
      const materials = { content: 'new content', sha: 'sha' };

      sinon.stub(updateFile, 'arguments').resolves();

      const result = await courseEditService.handleCourseGeneralFiles(
        owner, repo, courseId, readme, materials);

      expect(result).to.equal('back');
    });
  });

  describe('handleContentImages', () => {
    it('should handle content images', async () => {
      const content = '![test](files/test.png)';
      const owner = 'testOwner';
      const repo = 'testRepo';
      const slug = 'testSlug';
      const parentPath = 'testPath';

      sinon.stub(uploadFile, 'arguments').resolves();

      const result = await courseEditService.handleContentImages(
        content, owner, repo, slug, parentPath);

      expect(result).to.equal('![test](files/test.png)');
    });
  });

  describe('replaceImageUrls', () => {
    it('should replace image URLs', () => {
      const content = '![test](files/test.png)';
      const files = [{ name: 'test.png', thumbUrl: 'thumbUrl' }];

      const result = courseEditService.replaceImageUrls(content, files);

      expect(result).to.equal('![test](thumbUrl)');
    });
  });

  /*describe('uploadNewFiles', () => {
   it('should upload new files', async () => {
   const owner = 'testOwner';
   const repo = 'testRepo';
   const newFiles = {
   'file1': {
   name: 'file1',
   data: Buffer.from('file1 content')
   }
   };
   const fileFolder = ['file2', 'file3'];

   sinon.stub(uploadFile, 'arguments').resolves(true);
   //sinon.stub(createOrUpdateFileContents, 'arguments').resolves();

   await courseEditService.uploadNewFiles(owner, repo, newFiles, fileFolder);

   expect(uploadFile.called).to.be.true;
   });
   });

   describe('updateCourseName', () => {
   it('should update course name', async () => {
   const owner = 'testOwner';
   const repo = 'testRepo';
   const course = {
   id: 1,
   repository: 'https://github.com/tluhk/HK_Fotograafia-ja-digitaalne-pilditootlus'
   };
   const courseName = 'new course name';

   sinon.stub(getCourseData, 'arguments')
   .resolves({ config: { courseName: 'old course name' } });
   sinon.stub(updateFile, 'arguments').resolves();

   await courseEditService.updateCourseName(owner, repo, course, courseName);

   expect(updateFile.called).to.be.true;
   });
   });*/

  describe('getCourseGeneralContent', () => {
    /*it('should get course general content', async () => {
     const owner = 'testOwner';
     const repo = 'testRepo';
     const path = 'path';
     const branch = 'branch';

     sinon.stub(getFile, 'arguments').resolves({ content: 'file content' });
     sinon.stub(getImageFiles, 'arguments')
     .resolves(['file1', 'file2']);
     sinon.stub(getCourseGeneralContent, 'arguments').resolves({
     readme: { content: 'file content' },
     materials: { content: 'file content' },
     files: ['file1', 'file2']
     });

     const result = await getCourseGeneralContent(
     owner, repo, path, branch);


     expect(result.readme?.content).to.equal('file content');
     expect(result.materials?.content).to.equal('file content');
     expect(result.files).to.deep.equal(['file1', 'file2']);
     });*/

    describe('trimContent', () => {
      it('should trim content', () => {
        const content = '  test  \r\n  test  \r\n';

        const result = courseEditService.trimContent(content);

        expect(result).to.deep.equal(['test\r', 'test\r', '\r']);
      });
    });

  });

  describe('handleLessonUpdate', () => {
    it('should update existing lesson', async () => {
      const owner = 'testOwner';
      const repo = 'testRepo';
      const course = {
        id: 1,
        repository: 'https://github.com/tluhk/HK_Fotograafia-ja-digitaalne-pilditootlus'
      };
      const data = {
        lessonName: 'newLessonName',
        readmeContent: 'newReadmeContent',
        readmeSHA: 'readmeSHA',
        materialsContent: 'newMaterialsContent',
        materialsSHA: 'materialsSHA',
        'components[]': ['component1', 'component2']
      };
      const lessonSlug = 'existing';

      sinon.stub(getCourseData, 'arguments')
        .withArgs(course, 'draft')
        .resolves(
          { config: { lessons: [{ slug: 'existing', name: 'oldName' }] } });
      sinon.stub(updateFile, 'arguments').resolves();

      const result = await handleLessonUpdate(
        owner, repo, course, data, lessonSlug);

      expect(result).to.equal('back');
    });

    it('should create new lesson', async () => {
      const owner = 'testOwner';
      const repo = 'testRepo';
      const course = {
        id: 1,
        repository: 'https://github.com/tluhk/HK_Fotograafia-ja-digitaalne-pilditootlus'
      };
      const data = {
        lessonName: 'newLessonName',
        readmeContent: 'newReadmeContent',
        readmeSHA: 'readmeSHA',
        materialsContent: 'newMaterialsContent',
        materialsSHA: 'materialsSHA',
        'components[]': ['component1', 'component2']
      };
      const lessonSlug = 'new';

      sinon.stub(getCourseData, 'arguments')
        .withArgs(course, 'draft')
        .resolves(
          { config: { lessons: [] } });
      sinon.stub(updateFile, 'arguments').resolves();
      sinon.stub(uploadFile, 'arguments').resolves();

      const result = await handleLessonUpdate(
        owner, repo, course, data, lessonSlug);

      expect(result).to.include('/course-edit/');
      expect(result).to.include('/lesson/');
    });

  });

  describe('fetchAndProcessCourseData', () => {
    it(
      'should fetch and process course data correctly', async () => {
        const allCoursesResponse = {
          data: {
            data: [
              { repository: 'https://github.com/owner/repo1', data: {} },
              { repository: 'https://github.com/owner/repo2', data: {} }
            ]
          }
        };

        sinon.stub(usersApi, 'get').resolves(allCoursesResponse);
        sinon.stub(fetchAndProcessCourseData, 'arguments')
          .resolves(allCoursesResponse);
        const result = await fetchAndProcessCourseData();

        expect(result).to.exist;
        expect(result).to.be.an('array');
        expect(result.length).to.equal(0);
      });
  });
});