const baseUrl = 'https://api.github.com';
import dotenv from 'dotenv';

dotenv.config();

// Github API request endpoints
const githubReposRequests = {
  requestRepos: `${ baseUrl }/orgs/${ process.env.REPO_ORG_NAME }/repos?per_page=100`,
  requestTeamCourses: (teamSlug) => `${ baseUrl }/orgs/${ process.env.REPO_ORG_NAME }/teams/${ teamSlug }/repos?per_page=100`,
  requestRepoBranches: (coursePathInGithub) => `${ baseUrl }/repos/${ coursePathInGithub }/branches`,
  // config
  requestConfig:
  /**
     * if refBranch is provided:
     * - check if repo has branch with same name
     * if yes, get the config from that branch
     * if not, get the config from main branch
     */
      (coursePathInGithub, refBranch) => `${ baseUrl }/repos/${ coursePathInGithub }/contents/config.json?ref=${ refBranch }`,
  // docs related
  requestDocs: (coursePathInGithub, refBranch) => `${ baseUrl }/repos/${ coursePathInGithub }/contents/docs/README.md?ref=${ refBranch }`,
  requestCourseAdditionalMaterials: (coursePathInGithub, refBranch) => `${ baseUrl }/repos/${ coursePathInGithub }/contents/docs/lisamaterjalid.md?ref=${ refBranch }`,
  requestCourseFiles: (coursePathInGithub, refBranch) => `${ baseUrl }/repos/${ coursePathInGithub }/contents/docs/files?ref=${ refBranch }`,
  // lessons related
  requestLessons: (coursePathInGithub, opt, refBranch) => `${ baseUrl }/repos/${ coursePathInGithub }/contents/lessons/${ opt }/README.md?ref=${ refBranch }`,
  requestLessonAdditionalMaterials: (coursePathInGithub, opt, refBranch) => `${ baseUrl }/repos/${ coursePathInGithub }/contents/lessons/${ opt }/lisamaterjalid.md?ref=${ refBranch }`,
  requestLessonFiles: (coursePathInGithub, opt, refBranch) => `${ baseUrl }/repos/${ coursePathInGithub }/contents/lessons/${ opt }/files?ref=${ refBranch }`,
  // concepts related
  requestConcepts: (coursePathInGithub, opt, refBranch) => `${ baseUrl }/repos/${ coursePathInGithub }/contents/concepts/${ opt }/README.md?ref=${ refBranch }`,
  requestSources: (coursePathInGithub, opt, refBranch) => `${ baseUrl }/repos/${ coursePathInGithub }/contents/concepts/${ opt }/sources.json?ref=${ refBranch }`,
  requestStaticURL: (coursePathInGithub, opt, refBranch) => `${ baseUrl }/repos/${ coursePathInGithub }/contents/concepts/${ opt }/images?ref=${ refBranch }`,
  // practices related
  requestPractices: (coursePathInGithub, opt, refBranch) => `${ baseUrl }/repos/${ coursePathInGithub }/contents/practices/${ opt }/README.md?ref=${ refBranch }`,
  // images related
  requestImgURL: (coursePathInGithub, path, url, refBranch) => {
    if (path.type === 'docs') {
      return `${ baseUrl }/repos/${ coursePathInGithub }/contents/docs/${ url }?ref=${ refBranch }`;
    }
    if (path.type === 'concept') {
      return `${ baseUrl }/repos/${ coursePathInGithub }/contents/concepts/${ path.componentSlug }/${ url }?ref=${ refBranch }`;
    }
    if (path.type === 'practice') {
      return `${ baseUrl }/repos/${ coursePathInGithub }/contents/practices/${ path.componentSlug }/${ url }?ref=${ refBranch }`;
    }
    return '';
  }
};

export default githubReposRequests;
