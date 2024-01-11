const otherController = {
  /**
   * for unknown routes
   */
  notFound: (req, res) => res.render('notfound', {
    user: req.user
  }),
  /**
   * for not authorized not login (GitHub user not part of tluhk organisation)
   */
  noAuth: (req, res) => {
    const adminName = process.env.ADMIN_NAME;
    const adminEmail = process.env.ADMIN_EMAIL;
    res.render('noauth', {
      adminName,
      adminEmail
    });
  }
};

export default otherController;
