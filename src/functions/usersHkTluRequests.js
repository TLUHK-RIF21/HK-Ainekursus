// Github API request endpoints
import dotenv from 'dotenv';

dotenv.config();

const membersRequests = {
  requestMembers: 'users/',
  requestGroups: 'groups/user/',
  getUser: 'users/github/',
  getCourse: 'groups/',
  getAllCourses: 'groups'
};

export default membersRequests;
