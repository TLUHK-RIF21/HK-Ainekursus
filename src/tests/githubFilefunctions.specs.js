import { expect } from 'chai';
import sinon from 'sinon';

import { Octokit as Github } from '@octokit/rest';
import { getFile } from '../functions/githubFileFunctions.js';

describe('githubFileFunctions', () => {
  let githubStub;

  beforeEach(() => {
    githubStub = sinon.stub(Github, 'repos');
  });

  afterEach(() => {
    githubStub.restore();
  });

  it('getFile should return file content', async () => {
    githubStub.getContent.resolves({
      status: 200,
      data: {
        sha: 'testSha',
        content: 'testContent'
      }
    });

    const result = await getFile('owner', 'repo', 'path', 'ref');
    expect(result).to.deep.equal({
      sha: 'testSha',
      content: 'testContent'
    });
  });

  // Add similar tests for updateFile, deleteFile, delay, getFolder,
  // uploadFile, getTree, getBranch, deleteFolderFromRepo, deleteFilesFromRepo
});