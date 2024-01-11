import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const auth = `Bearer ${ process.env.AUTH }`;

// GitHub API token
const authToken = {
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: auth
  }
};

export { axios, authToken };
