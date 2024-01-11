// Github API request endpoints
import dotenv from 'dotenv';

dotenv.config();

const githubMembersRequests = {
  requestMembers: `https://api.github.com/orgs/${ process.env.REPO_ORG_NAME }/members?per_page=1000`
};

export default githubMembersRequests;
