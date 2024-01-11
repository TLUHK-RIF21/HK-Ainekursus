/** Endpoints to update user's profile name on FE app.
 * GET method displays the html page with input.
 * POST method saves the profile name to DB.
 */
import express from 'express';
import ensureAuthenticated from '../middleware/ensureAuthenticated.js';
import pool from '../../db.js';
import { cacheCommitComments, cacheTeamUsers } from '../setup/setupCache.js';

const router = express.Router();
router.get('/', ensureAuthenticated, (req, res) => {
  let { displayName } = req.user;
  if (!displayName) {
    displayName = req.user.username;
  }
  let message = '';
  if (req.query && req.query.displayName) {
    message = 'Profiilinime sisestamine on kohustuslik. Lubatud on vaid tähed ja tühikud.';
  }

  // console.log('req.body.displayName1:', req.user);

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
            <div class=" text-lg mt-16 mb-4">Sisesta sobiv profiilinimi:</div>
            <form action="/save-displayName" method="post" class="input-w-button w-full mb-8">
                <input class="input-single pr-[calc(6ch+3rem)]" name="displayName" type="text" placeholder="${ displayName }"/><br>
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
   * Validate that input was entered and that it's a valid string containing
   * only letters and spaces. Entering only spaces is not allowed either.
   */
  if (
    !req.body.displayName
    || !req.body.displayName.trim().match(/^[A-zÀ-ú\s]+$/)
  ) {
    return res.redirect('/save-displayName?displayName=true');
  }

  if (req.body.displayName) {
    let conn;
    try {
      conn = await pool.getConnection();

      await conn.query('UPDATE users SET displayName = ? WHERE githubID = ?;', [
        req.body.displayName,
        user.id
      ]);
      req.user.displayName = req.body.displayName;

      // Flush caches that store users names so that users names would be shown
      // correctly across app.
      cacheTeamUsers.del(`usersInTeam+${ user.team.slug }`);
      cacheCommitComments.flushAll();
    } catch (err) {
      console.log('Unable to update user displayName in database');
      console.error(err);
    } finally {
      if (conn) {
        await conn.release();
      } // release to pool
    }
  }
  return res.redirect('/dashboard');
});

export default router;
