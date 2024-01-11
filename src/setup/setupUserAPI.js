import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const usersApi = axios.create({
  baseURL: process.env.USERS_API_URL,
  headers: {
    Accept: 'application/json',
    Authorization: `Bearer ${ process.env.USERS_API_TOKEN.trim() }`
  }
});

export { usersApi };
