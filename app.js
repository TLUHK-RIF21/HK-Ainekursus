/** Import express framework */
import express from 'express';
import path, { join } from 'path';
import exphbs from 'express-handlebars';
import favicon from 'serve-favicon';
import fileUpload from 'express-fileupload';
/** Create a session middleware with the given options using passport
 * https://gist.github.com/jwo/ea79620b5229e7821e4ae61055899cf9
 * https://www.npmjs.com/package/passport-github2
 */
import session from 'express-session';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import pkg from 'body-parser';
import { fileURLToPath } from 'url';
import pool from './db.js';
import {
  allCoursesController
} from './src/components/courses/coursesController.js';
import otherController from './src/components/other/otherController.js';
import membersController from './src/components/members/membersController.js';
import allNotificationsController
  from './src/components/notifications/notificationsController.js';
/** Import handlebars helpers: https://stackoverflow.com/a/32707476 */
import handlebarsFactory from './src/helpers/handlebars.js';
/** Import middleware's */
import resetSelectedVersion from './src/middleware/resetSelectedVersion.js';
import ensureAuthenticated from './src/middleware/ensureAuthenticated.js';
import validateTeacher from './src/middleware/validateTeacher.js';
/** Import routes */
import logoutRoutes from './src/routes/logout.js';
import progressRoutes from './src/routes/progress.js';
import removeAsDone from './src/routes/remove-as-done.js';
import markAsDone from './src/routes/mark-as-done.js';
import addNewCourseRoutes from './src/routes/add-new-course.js';
import addNewVersionRoutes from './src/routes/add-new-version.js';
import courseRoutes from './src/components/courses/coursesRoutes.js';
import courseEditRoutes from './src/components/courses/courseEditRoutes.js';
import roleRoutes from './src/components/role-select/role-select.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Create express app */
const app = express();
const port = process.env.PORT || 3000;

/** Set up Handlebars views */
const handlebars = handlebarsFactory(exphbs);
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('views', join(__dirname, '/views'));

/** Define application static folder */
app.use(express.static(join(__dirname, '/public')));

/** Define favicon file */
app.use(favicon(join(__dirname, '/public/images', 'favicon.ico')));

app.use(fileUpload());

app.use(express.json());

/** Testing API endpoints */
app.get('/ping', (req, res) => {
  res.status(200).json({
    message: 'API is working'
  });
});

/** Set up Github credentials */
const loginConfig = {
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL
};

/** Initialize Passport.
 * Used for user login and session.
 * Also use passport.session() middleware, to support persistent login sessions
 * (recommended). https://github.com/jaredhanson/passport
 * https://www.npmjs.com/package/passport-github2
 */
app.use(
  session({
    name: 'HK_ainekursused',
    secret: process.env.PASSPORT_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // prompt: 'login',
    cookie: {
      secure: false, // change this to true if you're using HTTPS
      maxAge: 60 * 60 * 1000 // 1 hour
      // name: 'HK_ainekursused', // specify your cookie name here
    }
  })
);
app.use(passport.initialize());
app.use(passport.session());

/** Middleware for parsing bodies from URL. Options can be found here. Source code can be found here.
 * https://github.com/expressjs/body-parser#bodyparserurlencodedoptions
 * // { extended: true } precises that the req.Body object will contain values
 * of any type instead of just strings. https://stackoverflow.com/a/55558485
 */
const { urlencoded } = pkg;
app.use(urlencoded({ extended: true }));

/** Setup passport session.
 To support persistent login sessions, Passport needs to be able to
 serialize users into and deserialize users out of the session.  Typically,
 this will be as simple as storing the user ID when serializing, and finding
 the user by ID when deserializing. However, since this example does not
 have a database of user records, the complete GitHub profile is serialized
 and deserialized.
 */
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

/** LOGIN LOGIC FULL DESCRIPTION:
 * check if githubUserID exists in tluhk GitHub organisation members
 * if not, redirect to /noauth page, showing they must ask access from tluhk
 * personnel
 * -- if yes:
 * get all tluhk teams
 * get all githubUserID teams
 * get all tluhk HK_ teams' assignments
 * check if githubUserID exists in tluhk GitHub organisation's teams
 * -- if not, redirect to /noauth page, showing they must ask access from tluhk
 * personnel
 * -- if yes:
 * check which teams the user exists in
 * check if githubID exists in users
 * -- if yes, check that DB user data is up-to-date with GitHub user data
 * -- if no, add githubUser to DB users
 * -- if yes, read user's displayName and/or email info from Database.
 * Everything else about the user is read from GitHub.
 */

// Use the GitHubStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and GitHub
//   profile), and invoke a callback with a user object.
passport.use(
  new GitHubStrategy(
    {
      clientID: loginConfig.clientID,
      clientSecret: loginConfig.clientSecret,
      callbackURL: loginConfig.callbackURL
      // proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      process.nextTick(async () => {
        // console.log('GitHubStrategy1:', { accessToken, refreshToken, profile
        // }); console.log('accessToken1:', accessToken);

        /** Double check that GitHub user is part of tluhk GitHub org members.
         * If not, forbid access by not returning passport profile.
         * If yes, return GitHub user profile with the passport.
         */
          // console.log('profile1:', profile);
        const userInOrgMembers = await membersController.isUserInOrgMembers(
            profile.username
          );

        if (!userInOrgMembers) {
          console.log('No user in tluhk org');
          return done(null, null);
        }

        const { id, username, _json } = profile;

        const userData = {
          userId: userInOrgMembers.id,
          githubID: id,
          username,
          displayName: `${ userInOrgMembers.firstName } ${ userInOrgMembers.lastName }`,
          email: userInOrgMembers.email,
          roles: userInOrgMembers.roles,
          avatar_url: _json.avatar_url
        };

        //console.log('Logging in...', userData);
        /**
         * Return user profile with a successful login,
         */
        return done(null, userData);
      });
    }
  )
);

/** Endpoints for logging in
 //   Use passport.authenticate() as route middleware to authenticate the
 //   request. The first step in GitHub authentication will involve redirecting
 //   the user to GitHub.com.  After authorization, GitHub will redirect the user
 //   back to this application at /github-callback
 */
app.get('/login', (req, res) => {
  let message = '';
  /**
   * Validate that text input is not empty or is not an email
   */
  if (req.query.invalid)
    message =
      'Sisestatud Github kasutajanimi pole korrektne või ei kuulu kolledži kasutajate hulka';
  if (req.query.email) message = 'Emaili sisestamine pole lubatud';

  return res.render('login', {
    message
  });
});

app.post('/login', async (req, res, next) => {
  /**
   * If entered value is empty, redirect back to log in and show "invalid
   * username" message
   */
  if (!req.body.login || !req.body.login.trim())
    return res.redirect('/login?invalid=true');

  /**
   * If entered value is email, redirect back to log in and show "entering
   * email is not allowed" message
   */
  if (req.body.login.trim().match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,}$/)) {
    console.log(`Invalid login – email not allowed`);
    return res.redirect('/login?email=true');
  }

  /**  If entered username doesn't exist in users, redirect back to log in and show "invalid username" message */
  const userInOrgMembers = await membersController.isUserInOrgMembers(
    req.body.login
  );

  if (!userInOrgMembers) {
    console.log(`Invalid login – entered username is not in tluhk org members`);
    return res.redirect('/login?invalid=true');
  }

  return passport.authenticate('github', {
    login: req.body.login
  })(req, res, next);
});

/** GitHub callback to confirm/reject login
 * Use passport.authenticate() as route middleware to authenticate the callback
 * request. If authentication fails, the user will be redirected back to the
 * "/noauth" page. Otherwise, the primary route function will be called, which
 * will redirect the user to the "/" homepage.
 */
app.get(
  '/github-callback',
  passport.authenticate('github', {
    successRedirect: '/dashboard',
    failureRedirect: '/noauth',
    scope: ['user']
  })
);

app.use('/role-select', roleRoutes);

/** From here on, following endpoints are available only with successful login and authentication */
app.use(ensureAuthenticated);

/** General endpoint, duplicates /dashboard for now */
app.get(
  '/',
  resetSelectedVersion,
  allCoursesController.getAllCourses
);

/** Endpoint for dashboard */
app.get(
  '/dashboard',
  resetSelectedVersion,
  allCoursesController.getAllCourses
);

/** Endpoints to change course version.
 * Only available for teachers.
 */
app.post('/save-selected-version', validateTeacher, (req, res) => {
  // Store the selectedValue in the session
  req.session.selectedVersion = req.body.selectedVersion;
  req.session.courseSlug = req.body.courseSlug;
  // console.log('req.session.selectedVersion1:', req.session.selectedVersion);
  // console.log('req.session.currentPath1:', req.body.currentPath);

  /**
   * Stores selectedVersion correctly,
   * and then makes the original GET request again to reload same page with
   * selectedVersion value.
   */
  res.redirect(
    `${ req.body.currentPath }?ref=${ req.session.selectedVersion }`);
});

/** Endpoint for notifications page */
app.get(
  '/notifications',
  resetSelectedVersion,
  allNotificationsController.renderNotificationsPage
);

/** Endpoint to change how courses are displayed on dashboard */
app.post('/courses-display-by', (req, res) => {
  // Store the displayBy in the session
  req.session.coursesDisplayBy = req.body.coursesDisplayBy;

  return res.redirect(
    `/dashboard?coursesDisplayBy=${ req.session.coursesDisplayBy }`
  );
});

app.use('/mark-component-as-done', markAsDone);
app.use('/remove-component-as-done', removeAsDone);
/** Endpoint for 404 page for invalid or inaccessible links */
app.get('/notfound', resetSelectedVersion, otherController.notFound);

/** Page for not authorized login attempt (GitHub user not part of tluhk organisation) */
app.get('/noauth', otherController.noAuth);

app.use('/progress-overview', progressRoutes);
app.use('/logout', logoutRoutes);
app.use('/add-course', addNewCourseRoutes);
app.use('/add-version', addNewVersionRoutes);

app.use('/course', courseRoutes);
app.use('/course-edit', courseEditRoutes);

app.get('/get-ois-content', allCoursesController.getOisContent);

/** Redirect all unknown paths to 404 page */
app.all('*', resetSelectedVersion, otherController.notFound);

/** Start a server and listen on port 3000 */
app.listen(port, () => {
  console.log(`App is running`);
});

export default app;
