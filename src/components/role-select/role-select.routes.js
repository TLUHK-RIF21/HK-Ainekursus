import express from 'express';

const router = express.Router();

router.get(
  '/', (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    return (req.user.roles.includes('teacher') &&
      req.user.roles.includes('student'))
      ? res.render('role-select', req)
      : res.redirect('/');
  }
);

router.post('/', (req, res, next) => {
  //console.log(req.body);
  req.user.roles = [req.body.role];
  return res.redirect('/dashboard');
});

export default router;