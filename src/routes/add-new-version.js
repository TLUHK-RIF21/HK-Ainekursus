import express from 'express';
import ensureAuthenticated from '../middleware/ensureAuthenticated.js';
import { Octokit } from 'octokit';
import validateTeacher from '../middleware/validateTeacher.js';
import getAllCoursesData from '../functions/getAllCoursesData.js';
import { cacheBranches } from '../setup/setupCache.js';
import {
  delay,
  getFile,
  updateFile
} from '../functions/githubFileFunctions.js';

const router = express.Router();

router.post('/', ensureAuthenticated, validateTeacher, async (req, res) => {
  let error = '';
  // 1. validate request
  if (
    req.body.courseId
    && req.body.version
    && req.body.parentBranch
  ) {
    const octokit = new Octokit({
      auth: process.env.AUTH
    });

    const ref = req.body.parentBranch;
    // 2. get repo from courseSlug
    const repoName = (await getAllCoursesData(req)).find(
      (course) => course.id == req.body.courseId
    ).repository.replace('https://github.com/', '');

    // 3. get parent branch sha
    const parent = await octokit.request(
      `GET /repos/${ repoName }/git/ref/heads/${ ref }`,
      {
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );
    const parentSha = parent.data.object.sha;

    // 4. create new branch/ref
    const newBranch = await octokit.request(
      `POST /repos/${ repoName }/git/refs`,
      {
        ref: 'refs/heads/' + req.body.version,
        sha: parentSha,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    // 7. get status=201, redirect back to the course page
    cacheBranches.del(`${ repoName }+branches`);
    if (newBranch.status === 201) {
      const backURL = req.header('Referer') || '/';
      return res.redirect(backURL);
    } else {
      error = 'Uut versiooni ei saanud luua';
      return res.send(error);
    }
  } else {
    return res.send('invalid data');
  }
});

export default router;
