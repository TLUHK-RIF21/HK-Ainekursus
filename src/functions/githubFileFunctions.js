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

const deleteFolderFromRepo = async (org, repo, directoryName, branch) => {

  const currentCommit = await getCurrentCommit(org, repo, branch);
  const { data: repoTree } = await github.git.getTree({
    owner: org, repo, tree_sha: currentCommit.treeSha, recursive: true
  });
  const directorySha = await getDirectorySha(repoTree.tree, directoryName);

  if (!directorySha) {
    throw new Error(`Could not find an directory '${ directoryName }'`);
  }

  const { data: directoryTree } = await github.git.getTree({
    owner: org,
    repo, tree_sha: directorySha, recursive: true
  });

  const blobs = directoryTree.tree.map((blob) => {
    return { 'url': `${ directoryName }/${ blob.path }`, 'sha': null };
  });

  const newTree = await createNewTree(org, repo, blobs, currentCommit.treeSha);

  const commitMessage = `Deleting '${ directoryName }' files.`;
  const newCommit = await createNewCommit(org, repo, commitMessage, newTree.sha,
    currentCommit.commitSha
  );

  await setBranchToCommit(org, repo, newCommit.sha, branch);
};
const deleteFilesFromRepo = async (org, repo, path, toDelete, branch) => {

  const currentCommit = await getCurrentCommit(org, repo, branch);
  const { data: repoTree } = await github.git.getTree({
    owner: org, repo, tree_sha: currentCommit.treeSha, recursive: true
  });
  const directorySha = await getDirectorySha(repoTree.tree, path);

  if (!directorySha) {
    throw new Error(`Could not find an directory '${ path }'`);
  }

  const { data: directoryTree } = await github.git.getTree({
    owner: org,
    repo, tree_sha: directorySha, recursive: true
  });

  const blobs = directoryTree.tree.map((blob) => {
    return {
      'url': `${ path }/${ blob.path }`,
      'sha': toDelete.includes(blob.path) ? null : blob.sha
    };
  });

  const newTree = await createNewTree(org, repo, blobs, currentCommit.treeSha);

  const commitMessage = `Deleting files from '${ path }'.`;
  const newCommit = await createNewCommit(org, repo, commitMessage, newTree.sha,
    currentCommit.commitSha
  );

  await setBranchToCommit(org, repo, newCommit.sha, branch);
};

const createNewTree = async (owner, repo, blobs, parentTreeSha) => {
  const tree = blobs.map(({ sha, url: path }) => ({
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
  deleteFolderFromRepo
};
