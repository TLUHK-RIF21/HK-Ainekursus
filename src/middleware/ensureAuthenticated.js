/** Function to validate that logged-in user is authenticated.
 * If not, then route back to /login page.
 *
 * https://github.com/cfsghost/passport-github/blob/master/examples/login/app.js
 *
 // Simple route middleware to ensure user is authenticated for any action.
 //
 // Use this route middleware on any resource that needs to be protected. If
 // the request is authenticated (typically via a persistent login session),
 // the request will proceed. Otherwise, the user will be redirected to the
 // main page.
 */
const ensureAuthenticated = (req, res, next) => {
  // console.log('req.isAuthenticated1:', req.isAuthenticated);
  //console.log('req.user1:', req.user);
  if (req.isAuthenticated()) {
    // console.log('req.session1:', req.session);
    // console.log('req.session.passport.user.id1:',
    // req.session.passport.user.id); console.log('Authenticated');
    /* check for multiple user roles */
    if (req.user.roles.includes('teacher') &&
      req.user.roles.includes('student')) {
      return res.redirect('/role-select');
    }
    return next();
  }
  // console.log('req.session2:', req.session);
  console.log('User is NOT Authenticated');
  return res.redirect('/login');
};

export default ensureAuthenticated;
