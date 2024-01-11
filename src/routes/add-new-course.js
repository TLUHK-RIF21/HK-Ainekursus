import express from 'express';
import ensureAuthenticated from '../middleware/ensureAuthenticated.js';
import { Octokit } from 'octokit';
import { v4 as uuidv4 } from 'uuid';
import validateTeacher from '../middleware/validateTeacher.js';
import slugify from 'slugify';
import {
  delay,
  getFile,
  updateFile
} from '../functions/githubFileFunctions.js';
import { cacheTeamCourses } from '../setup/setupCache.js';
import { axios } from '../setup/setupGithub.js';
import * as cheerio from 'cheerio';
import getAllCoursesData from '../functions/getAllCoursesData.js';
import { usersApi } from '../setup/setupUserAPI.js';
import membersRequests from '../functions/usersHkTluRequests.js';

const router = express.Router();
router.get('/', ensureAuthenticated, validateTeacher, (req, res) => {
  return res.render('course-add-new');
});

router.post(
  '/',
  ensureAuthenticated,
  validateTeacher,
  async (req, res, next) => {
    let errorMessage = '';
    // validate request
    if (req.body.oisUrl) {
      const octokit = new Octokit({
        auth: process.env.AUTH
      });

      const { user } = req;
      const templateOwner = process.env.REPO_ORG_NAME;
      const templateRepo = process.env.TEMPLATE_REPO;
      const repo_prefix = process.env.REPO_PREFIX;

      let oisUrl = req.body.oisUrl;
      let oisCode = '';
      let oisGrading = '';
      let oisEAP = '';
      let shortDescription = '';
      let longDescription = '';
      let courseName = '';

      // figure out what user sent: a) OIS url 2) ainekood
      try {
        new URL(oisUrl);
      } catch (error) {
        oisUrl = `https://ois2.tlu.ee/tluois/aine/${ req.body.oisUrl }`;
      }
      const tmpSlug = oisUrl.split('/').slice(-1)[0];
      // if course exists...
      const allCourses = await getAllCoursesData('teachers', req);
      const oisCodeExists = allCourses.find(
        (course) => course.courseCode === tmpSlug
      );

      if (oisCodeExists) {
        return res.status(400)
          .send({
            msg: 'duplicate',
            courseCode: tmpSlug
          });
      }

      // fetch OIS content
      try {
        await axios(oisUrl).then((response) => {
          const { data } = response;
          if (data.includes(' ei leitud!')) {
            errorMessage = data;
          } else {
            const $ = cheerio.load(data);

            $('.yldaine_r', data).each(function () {
              const yldaineC1 = $(this).find('div.yldaine_c1').text();
              const yldaineC2 = $(this).find('div.yldaine_c2').text();

              switch (yldaineC1) {
                case 'Õppeaine nimetus eesti k':
                  courseName = yldaineC2;
                  break;
                case 'Õppeaine eesmärgid':
                  shortDescription = yldaineC2;
                  break;
                case 'Õppeaine sisu lühikirjeldus':
                  longDescription = yldaineC2;
                  break;
                case 'Õppeaine õpiväljundid':
                  longDescription += yldaineC2;
                  break;
                case 'Õppeaine kood':
                  oisCode = yldaineC2;
                  break;
                case 'Õppeaine maht EAP':
                  oisEAP = yldaineC2;
                  break;
                case  'Kontrollivorm' :
                  oisGrading = yldaineC2;
              }
            });
          }
        });
      } catch (error) {
        errorMessage = 'ÕIS\'st ei saanud andmeid: ' + oisUrl;
      }
      if (!courseName || !longDescription || errorMessage) {
        errorMessage = 'Kontrolli ÕIS`i linki, andmeid ei leitud';
        return res.status(400).send({ msg: errorMessage });
      }

      // check for repo name availability
      let repoName = slugify(`${ repo_prefix }${ courseName }`);
      const nameExists = cacheTeamCourses.get('allCoursesData+teachers');
      //console.log(nameExists);
      if (nameExists) {
        nameExists.data?.filter((course) => course.full_name.startsWith(
          `${ templateOwner }/${ repoName }`
        ));
      }
      if (nameExists && nameExists.length) {
        // we have matching name, lets add suffix
        let suffix = 1;
        while (
          nameExists.findIndex(
            (course) => course.full_name
              === `${ templateOwner }/${ repoName }_${ suffix }`
          ) >= 0
          ) {
          suffix++;
        }
        repoName = `${ repoName }_${ suffix }`;
      }

      // create repo
      const created = await octokit.request(
        `POST /repos/${ templateOwner }/${ templateRepo }/generate`, {
          owner: templateOwner,
          name: repoName,
          description: shortDescription.replace(
            /(<|&lt;)br\s*\/*(>|&gt;)/g,
            ' '
          ).trim(),
          include_all_branches: false,
          private: true,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }).catch((err) => {
        //console.log(err);
        errorMessage = 'Kursuse loomine ebaõnnestus';
        return res.status(400).send({ msg: errorMessage });
      });

      if (created.status === 201) {
        let contentOK = false;
        let timeOut = false;
        let waitCounter = 0;
        // wait for content be available and fetch config.json file
        while (!contentOK && !timeOut) {
          await delay(1000);

          const config = await getFile(
            templateOwner,
            repoName,
            'config.json'
          );
          if (config) {
            contentOK = true;
            // fix some config.json fields
            const newConfig = updateConfig(
              config.content,
              courseName,
              oisUrl,
              user.username,
              repoName
            );

            // upload modified file
            updateFile(
              templateOwner,
              repoName,
              'config.json',
              {
                content: newConfig,
                sha: config.sha
              },
              'fix config.json'
            ).then(() => {
              console.log('config.json updated');
            }).catch(() => {
              errorMessage = 'config.json loomine ebaõnnestus';
            });
          }
          waitCounter++;
          timeOut = waitCounter > 20;
        }

        // replace readme file
        const readme = await getFile(templateOwner, repoName, 'README.md');
        if (readme) {
          readme.content = longDescription;
          updateFile(
            templateOwner,
            repoName,
            'README.md',
            readme,
            'initial readme'
          ).then(() => console.log('Readme updated'));
        }

        cacheTeamCourses.del('allCoursesData+teachers');

        // add course via users API
        await usersApi.post(membersRequests.getAllCourses, {
          name: courseName,
          repository: created.data.html_url,
          code: oisCode,
          credits: oisEAP,
          form: oisGrading,
          userId: user.userId
        }).catch((err) => {
          console.log('Grupi lisamine ebaõnnestus:', err.response.statusText);
        }).then((apiResponse) => {
          return res.status(201)
            .send({
              msg: 'Kursus lisatud',
              courseCode: tmpSlug,
              courseId: apiResponse.data.data.id
            });
        });

      }
    } else {
      return res.status(400).send({ msg: 'Kontrolli andmeid' });
    }
  }
);

function updateConfig(content, courseName, courseUrl, userName, repoName) {
  const conf = JSON.parse(content);
  conf.courseName = courseName;
  conf.courseUrl = courseUrl;
  conf.teacherUsername = userName;
  conf.semester = '';
  conf.lessons.forEach((l) => (l.uuid = uuidv4()));
  conf.concepts.forEach((c) => {
    c.uuid = uuidv4();
    c.repo = repoName;
  });
  conf.practices.forEach((p) => (p.uuid = uuidv4()));
  return JSON.stringify(conf);
}

export default router;
