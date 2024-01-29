import base64 from 'base-64';
import { Octokit } from 'octokit';
import utf8 from 'utf8';
import { v4 as uuidv4 } from 'uuid';

const octokit = new Octokit({
  auth: process.env.AUTH
});

// From
// https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem.
function base64ToBytes(base64) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

// From
// https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem.
function bytesToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  const binString = String.fromCodePoint(...bytes);
  return btoa(binString);
}

async function getFile(owner, repo, path, ref = null) {
  const content = await octokit.request(
    `GET /repos/${ owner }/${ repo }/contents/${ path }${ ref
      ? '?ref=' + ref
      : '' }`, {
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }).catch((err) => {
    console.log('github get file error: ', path);
  });

  if (content && content.status === 200) {
    return {
      sha: content.data.sha,
      content: content.data.content ? utf8.decode(
        base64.decode(content.data.content)) : ''
    };
  }
  return false;
}

async function getFolder(owner, repo, path, ref = null, files = false) {
  const content = await octokit.request(
    `GET /repos/${ owner }/${ repo }/contents/${ path }${ ref
      ? '?ref=' + ref
      : '' }`, {
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }).catch((err) => {
    console.log(
      `FAILED: GET /repos/${ owner }/${ repo }/contents/${ path }${ ref
        ? '?ref=' + ref
        : '' }`);
  });

  if (content && content.status === 200) {
    return content.data.filter((folder) => folder.type === 'dir')
      .map((folder) => {
        return {
          sha: folder.sha, name: folder.name
        };
      });
  }
  return [];
}

async function getTree(repo, branch = 'master') {
  const branchData = await getBranch(repo, branch);
  if (!branchData) return false;
  const content = await octokit.request(
    `GET /repos/${ repo }/git/trees/${ branchData.commit.sha }?recursive=1`, {
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }).catch((err) => {
    console.log('get tree error');

  });

  const tree = {};
  content.data?.tree?.filter((t) => (t.path.includes('/') && t.type === 'blob'))
    .forEach((item) => {
      const pathParts = item.path.split('/');
      if (pathParts[1] !== '.DS_Store') {
        const contentName = pathParts[0];
        if (!tree[contentName]) {
          // todo get name from about.md or readme.md
          tree[contentName] = [
            {
              slug: pathParts[1].endsWith('.md')
                ? pathParts[1].slice(0, -3)
                : pathParts[1], name: pathParts[1], uuid: uuidv4()
            }];
        }

        let obj = tree[contentName].find(o => o.name === pathParts[1]);
        if (!obj) {
          // todo get name from about.md or readme.md
          tree[contentName].push({
            slug: pathParts[1].endsWith('.md')
              ? pathParts[1].slice(0, -3)
              : pathParts[1], name: pathParts[1], uuid: uuidv4()
          });
          obj = tree[contentName].find(o => o.slug === pathParts[1]);
        }

        if (pathParts.length === 4) {
          if (!obj[pathParts[2]]) {
            obj[pathParts[2]] = [pathParts[3]];
          } else {
            obj[pathParts[2]].push(pathParts[3]);
          }
        }
      }
    });
  return tree;
}

async function updateFile(owner, repo, path, file, commitMessage,
  branch = 'master'
) {
  return await octokit.request(
    `PUT /repos/${ owner }/${ repo }/contents/${ path }`, {
      message: commitMessage,
      content: bytesToBase64(file.content),
      sha: file.sha,
      branch: branch,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }).catch((err) => {
    console.log(err);
  });
}

async function deleteFile(owner, repo, path, sha, commitMessage,
  branch = 'master'
) {
  return await octokit.request(
    `DELETE /repos/${ owner }/${ repo }/contents/${ path }`, {
      message: commitMessage, sha: sha, branch: branch, headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }).catch((err) => {
    console.log(err);
  });
}

async function uploadFile(owner, repo, path, // folder + new filename
  file, // req.files.file
  commitMessage, branch = 'master', encoded = false
) {
  const base64Content = encoded ? file : (file instanceof ArrayBuffer)
    ? new Buffer.from(file.data).toString('base64')
    : bytesToBase64(file);

  return await octokit.request(
    `PUT /repos/${ owner }/${ repo }/contents/${ path }`, {
      message: commitMessage, content: base64Content, branch: branch, headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }).catch((err) => {
    console.log(err);
  });
}

async function getBranch(repo, branch = 'master') {
  const content = await octokit.request(
    `GET /repos/${ repo }/branches/${ branch }`, {
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }).catch((err) => {
    console.log('get tree error');
  });

  if (content && content.status === 200) {
    return content.data;
  }
  return false;
}

async function renameFolder(owner, repo, branch, oldFolder, newFolder) {
// Looge uus haru, kus soovite kausta ümber nimetada
  const newBranch = 'rename-folder';
  const branchRef = await octokit.request(
    `GET /repos/${ owner }/${ repo }/git/ref/heads/${ branch }`, {
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }).catch(() => {
    console.log('get ref error');
  });

  const newBranchRef = await octokit.request(
    `POST /repos/${ owner }/${ repo }/git/refs`, {
      ref: newBranch, sha: branchRef.data.object.sha, headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }).catch(() => {
    console.log('create ref error');
  });

// Looge uus puuobjekt, mis sisaldab uue kausta nime ja selle sisu
  const baseTree = await octokit.request(
    `GET /repos/${ owner }/${ repo }/git/trees/${ branchRef.data.object.sha }`,
    {
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );

  const newTree = await octokit.request(
    `POST /repos/${ owner }/${ repo }/git/trees`, {
      base_tree: baseTree.data.sha, tree: [
        {
          path: `${ newFolder }/README.md`,
          mode: '040000',
          type: 'tree',
          sha: 'b827aae57a3c0c57ea01f8c62d9a0f884f8d4fcd'
        }]
    });

// Looge uus pühendumisobjekt, mis viitab uuele puule
  const commit = await octokit.git.createCommit({
    owner,
    repo,
    message: `Rename ${ oldFolder } to ${ newFolder }`,
    tree: newTree.data.sha,
    parents: [branchRef.data.object.sha]
  });

// Uuendage haru viidet uuele pühendumisele
  await octokit.git.updateRef(
    { owner, repo, ref: `heads/${ newBranch }`, sha: commit.data.sha });

// Kustutage vana kaust
  await octokit.repos.deleteFile({
    owner,
    repo,
    path: `${ oldFolder }/README.md`,
    message: `Delete ${ oldFolder }`,
    sha: 'b827aae57a3c0c57ea01f8c62d9a0f884f8d4fcd',
    branch: newBranch
  });

// Esitage oma muudatused pull requestina ja ühendage need peaharuga
  await octokit.pulls.create({
    owner,
    repo,
    title: `Rename ${ oldFolder } to ${ newFolder }`,
    head: newBranch,
    base: branch
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export {
  getFile,
  updateFile,
  deleteFile,
  delay,
  getFolder,
  uploadFile,
  getTree,
  getBranch
};
