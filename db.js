import mariadb from 'mariadb';
import mysql from 'mysql2';
// https://stackoverflow.com/a/74320569
import dotenv from 'dotenv';
// Load modules

dotenv.config();

/*const pool = mariadb.createPool({
 host: process.env.DB_HOST,
 user: process.env.DB_USER,
 password: process.env.DB_PASSWORD,
 database: 'course_management',
 idleCheckInterval: 1000,
 maxConnextionTimeout: 30000,
 idlePoolTimeout: 3000,
 errorLimit: 5,
 preInitDelay: 50,
 sessionTimeout: 60000,
 /* Setting acquireTimeout helps running app WITHOUT Docker quicker (npm run start-app).
 Do NOT enable acquireTimeout on live site WITH Docker (npm start) – this will close database pools to quickly and DB actions will get ignored.  */
// acquireTimeout: 50, // acquireTimeout option defines the maximum number of
// milliseconds to wait for a connection to become available in the pool before
// throwing an error. });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'course_management',
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0
}).promise();

export default pool;
