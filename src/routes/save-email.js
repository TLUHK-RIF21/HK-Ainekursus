/** Endpoints to update user's email on FE app.
 * GET method displays the html page with input.
 * POST method saves the email to DB.
 */
import express from 'express';
import ensureAuthenticated from '../middleware/ensureAuthenticated.js';
import pool from '../../db.js';
import { cacheTeamUsers } from '../setup/setupCache.js';

const router = express.Router();

router.get('/', ensureAuthenticated, (req, res) => {
  let { email } = req.user;
  if (!email) {
    email = 'email@gmail.com';
  }
  let message = '';
  if (req.query && req.query.email) {
    message = 'Sisestatud email pole korrektne';
  }

  res.send(`
      <!DOCTYPE html>
      <html lang='et'>
      <head>
      <title></title>
      <meta charset='UTF-8' />
      <meta http-equiv='X-UA-Compatible' content='IE=edge' />
      <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      <link rel='stylesheet' href='/css/main.css' />
      <link
      rel='stylesheet'
      href='https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'
    />
        <body style="margin:0; display:flex; width:100%; height:100vh; justify-content:center; align-items:center; background-color: #261d30;">
          <div style="width: 34rem; max-width:100%;
          padding: 2rem;
          background-color: white;
          border-radius: 2rem; position:relative;">
            <div style="position:absolute;    right: 1rem;
            top: 1rem;">
              <a href="javascript:history.back()"><span style="font-size:3rem" class="material-symbols-outlined">
              cancel
              </span></a>
            </div>
            <div class=" text-lg mt-16 mb-4">Sisesta oma e-mail:</div>
            <form action="/save-email" method="post" class="input-w-button w-full mb-8">
                <input class="input-single pr-[calc(6ch+3rem)]" name="email"  type="email" placeholder="${ email }"/><br>
                <input class="btn btn-primary" type="submit" value="Salvesta"/>
            </form>
            <p style="color:red;">${ message }</p>
          </div>  
        </body>
        </html>
    `);
});

router.post('/', ensureAuthenticated, async (req, res) => {
  const { user } = req;
  /**
   * Validate that input was entered and that it's a valid email.
   * If not, redirect back to /save-email page.
   */
  if (
    !req.body.email
    || !req.body.email.trim().match(/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/)
  ) {
    return res.redirect('/save-email?email=true');
  }

  let conn;
  try {
    conn = await pool.getConnection();

    await conn.query('UPDATE users SET email = ? WHERE githubID = ?;', [
      req.body.email,
      user.id
    ]);
    req.user.email = req.body.email;

    // Flush caches that stores users emails so that users emails would be
    // shown correctly across app. console.log(`usersInTeam1:
    // usersInTeam+${user.team.slug}`);
    cacheTeamUsers.del(`usersInTeam+${ user.team.slug }`);
  } catch (err) {
    console.error(err);
    console.log('Unable to update user email in database');
  } finally {
    if (conn) {
      await conn.release();
    } // release to pool
  }

  return res.redirect('/dashboard');
});

export default router;
