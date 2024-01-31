import base64 from 'base-64';
import { Octokit } from 'octokit';
import { Octokit as Github } from '@octokit/rest';
import utf8 from 'utf8';
import { v4 as uuidv4 } from 'uuid';

const octokit = new Octokit({
  auth: process.env.AUTH
});

const github = new Github({ auth: process.env.AUTH });
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

async function getFile(owner, repo, path, ref = '') {
  const content = await github.repos.getContent({
    owner: owner, repo: repo, path: path, ref: ref
  }).catch(() => {
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
  const content = await github.repos.getContent({
    owner: owner, repo: repo, path: path, ref: ref
  }).catch(() => {
    console.log('github get file error: ', path);
  });

  if (content && content.status === 200) {
    if (files) return content.data.filter(
      entry => (!entry.name.startsWith('.') && entry.size > 0));
    return content.data.filter((folder) => folder.type === 'dir')
      .map((folder) => {
        return {
          sha: folder.sha, name: folder.name
        };
      });
  }
  return [];
}

async function getTree(owner, repo, branch = 'master') {
  const branchData = await getBranch(owner, repo, branch);
  if (!branchData) return false;
  const content = github.git.getTree({
    owner: owner, repo: repo, tree_sha: branchData.commit.sha, recursive: true
  }).catch(() => {
    console.log('get tree error');
  });

  /*const content = await octokit.request(
   `GET /repos/${ repo }/git/trees/${ branchData.commit.sha }?recursive=1`, {
   headers: {
   'X-GitHub-Api-Version': '2022-11-28'
   }
   }).catch(() => {
   console.log('get tree error');

   });*/

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
  return await github.repos.createOrUpdateFileContents({
    owner: owner,
    repo: repo,
    path: path,
    sha: file.sha,
    content: bytesToBase64(file.content),
    branch: branch,
    message: commitMessage
  }).catch((err) => {
    console.log(err);
  });

  /*octokit.request(
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
   });*/
}

async function deleteFile(owner, repo, path, sha, commitMessage,
  branch = 'master'
) {
  return await github.repos.deleteFile({
    owner: owner,
    repo: repo,
    path: path,
    sha: sha,
    branch: branch,
    message: commitMessage
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

async function getBranch(owner, repo, branch = 'master') {
  const content = github.repos.getBranch({
    owner: owner, repo: repo, branch: branch
  }).catch(() => {
    console.log('get tree error');
  });
  /*const content = await octokit.request(
   `GET /repos/${ repo }/branches/${ branch }`, {
   headers: {
   'X-GitHub-Api-Version': '2022-11-28'
   }
   }).catch(() => {
   console.log('get tree error');
   });*/

  if (content && content.status === 200) {
    return content.data;
  }
  return false;
}

const deleteFolder = async (org, repo, directoryName, branch) => {
  try {
    const latestCommitTreeSha = await getLatestCommitTreeSha(org, repo, branch);

    const { data: folderEntries } = await github.git.getTree({
      owner: org, repo: repo, tree_sha: latestCommitTreeSha, recursive: true
    });

    if (folderEntries.tree.length) {
      const doBeRemoved = folderEntries.tree.filter(
        entry => entry.path.startsWith(directoryName));
      for (let i = 0; i < doBeRemoved.length; i++) {
        await deleteFile(org, repo, doBeRemoved[i].path, doBeRemoved[i].sha,
          'delete folder', branch
        );
      }
    }
  } catch (error) {
    console.error('Error:', error.message || error);
  }
};

// Get the tree SHA of the latest commit
async function getLatestCommitTreeSha(repoOwner, repoName, branch) {
  const latestCommitSha = await getLatestCommitSha(repoOwner, repoName, branch);
  const { data: commit } = await github.git.getCommit({
    owner: repoOwner, repo: repoName, commit_sha: latestCommitSha
  });
  return commit.tree.sha;
}

// Get the latest commit SHA of the default branch (e.g., 'main' or 'master')
async function getLatestCommitSha(repoOwner, repoName, branch) {
  const { data } = await github.repos.getBranch({
    owner: repoOwner, repo: repoName, branch: branch
  });
  return data.commit.sha;
}

/*
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

 const deleteFromRepo = async (org, repo, directoryName, branch) => {

 const currentCommit = await getCurrentCommit(org, repo, branch);
 const { data: repoTree } = await github.git.getTree({
 owner: org, repo, tree_sha: currentCommit.treeSha, recursive: true
 });
 const directorySha = await getDirectorySha(repoTree.tree, directoryName);

 if (!directorySha) {
 throw new Error(`Could not find an directory '${ directoryName }'`);
 }

 const { data: directoryTree } = await github.git.getTree({
 owner: org, repo, tree_sha: directorySha, recursive: true
 });

 const blobs = directoryTree.tree.map((blob) => {
 return { 'url': `${ directoryName }/${ blob.path }`, 'sha': null };
 });

 const newTree = await createNewTree(org, repo, blobs, currentCommit.treeSha);
 console.log(newTree);
 const commitMessage = `Deleting '${ directoryName }' files.`;
 const newCommit = await createNewCommit(org, repo, commitMessage, newTree.sha,
 currentCommit.commitSha
 );
 await setBranchToCommit(org, repo, newCommit.sha);
 };

 const createNewTree = async (owner, repo, blobs, parentTreeSha) => {
 const tree = blobs.map(({ sha, url: path }, index) => ({
 path: path, mode: `100644`, type: `blob`, sha
 }));

 const { data } = await github.git.createTree({
 owner, repo, tree, base_tree: parentTreeSha
 });

 return data;
 };

 const setBranchToCommit = (
 org, repo, commitSha, branch = `master`) => github.git.updateRef(
 { owner: org, repo, ref: `heads/${ branch }`, sha: commitSha });

 const getCurrentCommit = async (org, repo, branch = 'master') => {
 const { data: refData } = await github.git.getRef({
 owner: org, repo, ref: `heads/${ branch }`
 });
 const commitSha = refData.object.sha;
 const { data: commitData } = await github.git.getCommit({
 owner: org, repo, commit_sha: commitSha
 });
 return {
 commitSha, treeSha: commitData.tree.sha
 };
 };

 const getDirectorySha = async (tree, directoryName) => {
 return tree
 .filter(({ path: directoryPath }) => directoryPath ? directoryPath.includes(
 directoryName) : false)
 .map(({ sha }) => sha)
 .filter(sha => sha !== undefined).values().next().value;
 };

 const createNewCommit = async (
 org, repo, message, currentTreeSha, currentCommitSha) => {
 const { data } = await github.git.createCommit({
 owner: org, repo, message, tree: currentTreeSha, parents: [currentCommitSha]
 });

 return data;
 };

 // Recursively get the tree entries for the specified path
 async function getTreeEntries(repoOwner, repoName, treeSha, path) {
 const { data } = await github.git.getTree({
 owner: repoOwner,
 repo: repoName,
 tree_sha: treeSha,
 recursive: true
 });
 return data.tree.filter(entry => entry.path.startsWith(path));
 }

 // Delete the specified subfolder from the repository
 async function deleteSubFolder(repoOwner, repoName, subFolderPath, branch) {
 try {
 const latestCommitTreeSha = await getLatestCommitTreeSha(
 repoOwner, repoName, branch);

 const { data: subFolderEntries } = await github.git.getTree({
 owner: repoOwner,
 repo: repoName,
 tree_sha: latestCommitTreeSha,
 recursive: true
 });

 //console.log('tree', subFolderEntries);
 //const subFolderEntries = await getTreeEntries(
 //  repoOwner, repoName, latestCommitTreeSha, subFolderPath);

 if (subFolderEntries.tree.length === 0) {
 console.log(
 `Subfolder '${ subFolderPath }' not found in the repository.`);
 return;
 }

 // Create a new tree without the subfolder entries
 const newTree = subFolderEntries.tree.reduce((acc, entry) => {
 acc.push({ path: entry.path, mode: '100644', type: 'blob', sha: null });
 return acc;
 }, []);

 console.log(newTree);
 // Create a new commit with the updated tree
 const { data: newCommit } = await github.git.createCommit({
 owner: repoOwner,
 repo: repoName,
 message: 'Deleting subfolder',
 tree: newTree,
 parents: [await getLatestCommitSha(repoOwner, repoName, branch)]
 });

 // Update the reference (branch) to the new commit
 await github.git.updateRef({
 owner: repoOwner,
 repo: repoName,
 ref: 'heads/' + branch, // Change to your default branch name if different
 sha: newCommit.sha
 });

 console.log(`Subfolder '${ subFolderPath }' deleted successfully.`);
 } catch (error) {
 console.error('Error:', error.message || error);
 }
 }
 */
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
  getBranch,
  deleteFolder
  //deleteSubFolder,
  //deleteFromRepo
};
