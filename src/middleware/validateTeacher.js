/** Function to validate if logged-in user is a teacher or not.
 */
const validateTeacher = (req, res, next) => {
  if (req.user.roles.includes('teacher')) {
    return next();
  }
  console.log(
    'Page is available only for teachers. User is NOT in \'teachers\' team. Rerouting to /notfound page.'
  );
  return res.redirect('/notfound');
};

export default validateTeacher;
