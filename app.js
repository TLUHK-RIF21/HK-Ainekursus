/* eslint-disable no-underscore-dangle */
/* eslint-disable max-len */
/* eslint-disable import/newline-after-import */
/**
 * Import express framework
 */
import express from 'express';
import path, { join } from 'path';
import exphbs from 'express-handlebars';
import favicon from 'serve-favicon';

/**
 * Create a session middleware with the given options using passport
 * https://gist.github.com/jwo/ea79620b5229e7821e4ae61055899cf9
 * https://www.npmjs.com/package/passport-github2
 */
import session from 'express-session';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import pkg from 'body-parser';

/* kui tahad livesse lasta, siis chekout production ja seal kustuta kogu livereload plokk ära – see blokeerib lehte */
import { createServer } from 'livereload';
import connectLivereload from 'connect-livereload';

import dotenv from 'dotenv';

import { fileURLToPath } from 'url';
import cache from './src/setup/setupCache';

import { allCoursesController, responseAction, renderPage } from './src/components/courses/coursesController';
import otherController from './src/components/other/otherController';
import membersController from './src/components/members/membersController';
import teamsController from './src/components/teams/teamsController';
import allNotificationsController from './src/components/notifications/notificationsController';

/**
 *  Import handlebars helpers: https://stackoverflow.com/a/32707476
 */
import handlebarsFactory from './src/helpers/handlebars';

dotenv.config();

const { urlencoded } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
  * Create express app
  */
const app = express();
const port = process.env.PORT || 3000;

const liveReloadServer = createServer();
liveReloadServer.watch(join(__dirname, '/views'));
liveReloadServer.watch(join(__dirname, 'public'));
liveReloadServer.server.once('connection', () => {
  setTimeout(() => {
    liveReloadServer.refresh('/');
  }, 100);
});
app.use(connectLivereload());

const handlebars = handlebarsFactory(exphbs);

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('views', join(__dirname, '/views'));

/**
 *  Define application static folder
 */
app.use(express.static(join(__dirname, '/public')));

/**
 *  Define favicon file
 */
app.use(favicon(join(__dirname, '/public/images', 'favicon.ico')));

/**
  * Testing API endpoints
  */
app.get('/ping', (req, res) => {
  res.status(200).json({
    message: 'API is working',
  });
});

const loginConfig = {
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL,
};

/**
 * Authentication
 * https://github.com/cfsghost/passport-github/blob/master/examples/login/app.js
 *
  // Simple route middleware to ensure user is authenticated.
  //   Use this route middleware on any resource that needs to be protected.  If
  //   the request is authenticated (typically via a persistent login session),
  //   the request will proceed.  Otherwise, the user will be redirected to the
  //   login page.
 */
const ensureAuthenticated = ((req, res, next) => {
  if (req.isAuthenticated()) {
    // console.log('req.session1:', req.session);
    // console.log('req.session.passport.user.id1:', req.session.passport.user.id);
    // console.log('Authenticated');
    return next();
  }
  // console.log('req.session2:', req.session);
  console.log('NOT Authenticated');
  return res.redirect('/');
});

const cacheService = (async (req, res, next) => {
  const { cacheName } = res.locals;
  // console.log('cacheName1:', cacheName);
  try {
    if (cache.has(cacheName) && cache.get(cacheName) !== undefined) {
      console.log(`${cacheName} loaded with CACHE`);
      res.locals[cacheName] = await cache.get(cacheName);
      delete res.locals.cacheName;
      // console.log('res.locals2:', res.locals);

      return next();
    }
    return console.log(`${cacheName} loaded with API`);
  } catch (err) {
    return console.error('err');
    // throw new Error(err);
  }
});

/**
 * Request tluhk org teams and teamMembers once during app starting.
 * Save teamAssignments into res.locals
 */
const getTeamAssignments = (async (req, res, next) => {
  if (res.locals.teamAssignments) return next();

  const cacheName = 'teamAssignments';
  res.locals.cacheName = cacheName;

  await cacheService(req, res);
  if (res.locals[cacheName]) return next();

  // console.log('res.locals3:', res.locals);
  const { teams } = await teamsController.getAllValidTeams().catch((error) => {
    console.error(error);
    return res.redirect('/notfound');
  });
  const getAllTeamAssignments = await teamsController.getAllTeamAssignments(teams);
  // console.log('getAllTeamAssignments1:', getAllTeamAssignments);

  cache.set(cacheName, getAllTeamAssignments);
  res.locals[cacheName] = getAllTeamAssignments;
  delete res.locals.cacheName;
  // console.log('res.locals4:', res.locals);

  // console.log('res.locals.teamAssignments1:', res.locals.teamAssignments);

  return next();
});

/**
 * Clear selectedVersion value when leaving any course page.
 */
const resetSelectedVersion = ((req, res, next) => {
  // console.log('req.params.courseSlug1:', req.params.courseSlug);
  // console.log('req.path.courseSlug1:', req.session.courseSlug);

  /**
   * If visited page is from the same course, keep the courseSlug and selectedVersion info in req.session.
   * Otherwise, if another course or any other page is visited , clear courseSlug and selectedVersion info from req.session
   */
  if (req.params.courseSlug === req.session.courseSlug) {
    return next();
  }
  req.session.courseSlug = null;
  req.session.selectedVersion = null;
  return next();
});

/**
 * Initialize Passport!
 * Also use passport.session() middleware, to support persistent login sessions (recommended).
 */
app.use(
  session({
    name: 'HK_e-kursused',
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    // prompt: 'login',
    cookie: {
      secure: false, // change this to true if you're using HTTPS
      maxAge: 60 * 60 * 1000, // 1 hour
      // name: 'HK_e-kursused', // specify your cookie name here
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());
app.use(urlencoded({ extended: true }));

GitHubStrategy.prototype.authorizationParams = function (options) {
  return options || {};
};

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete GitHub profile is serialized
//   and deserialized.
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

/** LOGIN LOGIC
   * check if githubUserID exists in tluhk Github organisation members
   * if not, redirect to /noauth page, showing you must ask access from tluhk
   * -- if yes:
   * get all tluhk teams
   * get all githubUserID teams
   * get all tluhk HK_ team assignments
   * check if githubUserID exists in tluhk Github organisation teams
   * -- if not, redirect to /noauth page, showing you must ask access from tluhk
   * -- if yes:
   * check which teams it exists in
   * check if githubID exists in users
   * -- if yes, check that user is up-to-date with github user?? + update??
   * -- if yes, read user info from database? github?
   * -- if not, add githubUser to users
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
      callbackURL: loginConfig.callbackURL,
      // proxy: true,
    },
    (async (accessToken, refreshToken, profile, done) => {
      process.nextTick(() => {
        // asynchronous verification, for effect...
        // console.log('GitHubStrategy1:', { accessToken, refreshToken, profile });
        // console.log('accessToken1:', accessToken);

        // eslint-disable-next-line no-param-reassign
        // profile.token = accessToken;

        console.log({ profile });

        /**
         * Check if Github user is part of tluhk Github org members.
         * If not, forbid access by not saving passport profile.
         * If yes, save github user profile in the passport.
         */
        const userInOrgMembers = membersController.isUserInOrgMembers(profile.id);

        if (!userInOrgMembers) {
          console.log('no user in tluhk org');
          return done(null, null);
        }
        console.log('user exists in tluhk org');

        // getUser();
        // saveUser();
        // console.log('userInOrgMembers1:', userInOrgMembers);
        // console.log('profile1:', profile);
        // console.log('Logged in');
        return done(null, profile);
      });

      // an example of how you might save a user
      // new User({ username: profile.username }).fetch().then(user => {
      //   if (!user) {
      //     user = User.forge({ username: profile.username })
      //   }
      //   user.save({ profile: profile, access_token: accessToken }).then(() => {
      //     return done(null, user)
      //   })
      // })
    }),
  ),
);

/**
 * https://stackoverflow.com/a/25687358
 * in an express middleware (before the router).
 * I recommend the middleware route, I use such a function to add last visit date-time to the req.session, and am also developing middleware in using app.all('*') to do IP request tracking
 */
app.use(getTeamAssignments, async (req, res, next) => {
  // console.log('req.user5:', req.user);
  if (req.user && !req.user.team) {
    const { user } = req;
    const userTeam = await teamsController.getUserTeam(user.id, res.locals.teamAssignments);
    // console.log('user1:', user);
    // console.log('userTeam1:', userTeam);
    req.user.team = userTeam;
  // eslint-disable-next-line brace-style
  }

  /**
   * TO ALLOW LOGGING IN WITH ANY USER, COMMENT OUT FOLLOWING else STATEMENT!
   * FOR TESTING, THE APP IS BY DEFAULT LOGGED IN AS seppkh IN TEAM rif20
   *
   * IF YOU WANT TO LOG IN AS seppkh AND USE ITS TRUE GITHUB TEAM:
   * 1. ENABLE FULL else STATEMENT
   * 2. COMMENT OUT team: {} KEY.
   * 3. THEN ENABLE FOLLOWING if (req.user && !req.user.team) {} CONDITION
   */
  else {
    req.user = {
      id: '62253084',
      nodeId: 'MDQ6VXNlcjYyMjUzMDg0',
      displayName: null,
      username: 'seppkh',
      profileUrl: 'https://github.com/seppkh',
      provider: 'github',
      _json: {
        avatar_url: 'https://avatars.githubusercontent.com/u/62253084?v=4',
        type: 'User',
      },
      team: {
        name: 'rif20',
        id: 6514564,
        node_id: 'T_kwDOBqxQ5c4AY2eE',
        slug: 'rif20',
      },
    };

    if (req.user && !req.user.team) {
      const { user } = req;
      const userTeam = await teamsController.getUserTeam(user.id, res.locals.teamAssignments);
      // console.log('user1:', user);
      // console.log('userTeam1:', userTeam);
      req.user.team = userTeam;
    }
  }

  next();
});

// GET /login
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in GitHub authentication will involve redirecting
//   the user to github.com.  After authorization, GitHub will redirect the user
//   back to this application at /github-callback
app.get(
  '/login',
  (req, res) => {
    let message = '';
    if (req.query.email) message = 'Emaili sisestamine pole lubatud';
    res.send(`
        <html>
        <body>
            <form action="/login" method="post">
                <span>Sisesta enda Githubi kasutajanimi (mitte email):</span>
                <input name="login" type="text"/>
                <input type="submit" value="Connect"/>
            </form>
            <p style="color:red;">${message}</p>
        </body>
        </html>
    `);
  },
);

app.post('/login', (req, res, next) => {
  // console.log('req.body.login1:', req.body.login);
  if (!req.body.login) {
    return res.sendStatus(400);
  }

  /**
   * Check if entered value is email
   */
  // Regular expression to check if string is email
  const regexExp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/gi;
  const isEmail = regexExp.test(req.body.login);
  /**
   * If entered value is email, redirect back to login and show "email is not allowed" message
   */
  if (isEmail) return res.redirect('/login?email=true');

  return passport.authenticate('github', {
    login: req.body.login,
  })(req, res, next);
});

/*
  passport.authenticate('github', {
    // prompt: 'login',
    // scope: ['user:email'],
  }),
); */

/**
 * // Github callback
 * Use passport.authenticate() as route middleware to authenticate the callback request.
 * If authentication fails, the user will be redirected back to the "/noauth" page.
 * Otherwise, the primary route function will be called, which will redirect the user to the "/" homepage.
 */
app.get(
  '/github-callback',
  passport.authenticate('github', {
    // prompt: 'login',
    successRedirect: '/dashboard',
    failureRedirect: '/noauth',
    scope: ['user'],
  }),
);

/**
  * Available endpoints without login
  */
app.get('/', resetSelectedVersion, allCoursesController.getAllCourses);
app.get('/dashboard', resetSelectedVersion, allCoursesController.getAllCourses);

/**
 * Available endpoints with login
 */
app.get('/course/:courseSlug/:contentSlug?/:componentSlug?', resetSelectedVersion, ensureAuthenticated, allCoursesController.getSpecificCourse, responseAction, renderPage);

app.post('/save-selected-version', (req, res) => {
  // console.log('req.body1:', req.body);

  // Store the selectedValue in the session
  req.session.selectedVersion = req.body.selectedVersion;
  req.session.courseSlug = req.body.courseSlug;

  // console.log('req.session.selectedVersion1:', req.session.selectedVersion);

  // console.log('req.session.currentPath1:', req.body.currentPath);

  /**
   * Stores selectedVersion correctly,
   * but I need to make the original GET request again to reload same page with selectedVersion value.
   */
  res.redirect(req.body.currentPath);
});

/**
 * Notifications page
 */
app.get('/notifications', resetSelectedVersion, allNotificationsController.renderNotificationsPage);

/**
 * Courses page
 */
app.get('/courses', resetSelectedVersion, allNotificationsController.renderNotificationsPage);

/**
 * 404 page for wrong links
 */
app.get('/notfound', resetSelectedVersion, otherController.notFound);

/**
 * Page for not authorized login attempt (github user not part of tluhk organisation)
 */
app.get('/noauth', otherController.noAuth);

/**
 * Logout
 * https://www.tabnine.com/code/javascript/functions/express/Request/logout
 */

app.get('/logout', resetSelectedVersion, (req, res, next) => {
  // console.log('req.user3:', req.user);

  /**
   * Try deleting github App Authorization when logging out. Gives 404 error.
   */
  /* try {
    axios.create({
      method: 'delete',
      url: 'https://api.github.com/applications/' + process.env.GITHUB_CLIENT_ID + '/grant',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
        },
      },
      data: {
        access_token: req.user.token, // This is the body part
      },
    });
  } catch (error) {
    console.log(error);
  } */

  console.log('Logging out process');
  req.logout((err) => {
    if (err) { return next(err); }
    return req.session.destroy((err2) => {
      if (err2) { return next(err2); }
      console.log('Logged out');
      // localStorage.removeItem('accessToken');
      res.clearCookie('HK_e-kursused');
      // console.log('req.session2:', req.session);
      // console.log('req2:', req);
      return res.redirect('/');
    });
  });
});

/**
 * Redirect all unknown paths to 404 page
 */
app.all('*', resetSelectedVersion, otherController.notFound);

/**
 * Start a server and listen on port 3000
 */
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
