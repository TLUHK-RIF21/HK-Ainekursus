/** Function to clear selectedVersion value when leaving any specific course: when going to another course, going to dashboard, going to notifications page or else.
 * Do NOT clear selectedVersion when just going to another page under the same
 * specific course, e.g. from Loeng1 to Loeng2.
 */
const resetSelectedVersion = (req, res, next) => {
  // console.log('req.params.courseSlug1:', req.params.courseSlug);
  // console.log('req.path.courseSlug1:', req.session.courseSlug);

  /**
   * If visited page is from the same course, keep the courseSlug and
   * selectedVersion info in req.session. Otherwise, if another course or any
   * other page is visited, clear courseSlug and selectedVersion info from
   * req.session.
   */
  if (req.params.courseSlug === req.session.courseSlug) {
    return next();
  }
  req.session.courseSlug = null;
  req.session.selectedVersion = null;
  return next();
};

export default resetSelectedVersion;
