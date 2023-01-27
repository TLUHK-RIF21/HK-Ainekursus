/* eslint-disable max-len */
const { default: axios } = require('axios');
const { requestImgURL } = require('./repoFunctions');
const { authToken } = require('../setup/setupGithub');

const getImgResponse = async (coursePathInGithub, componentSlug, url) => {
  let response = '';

  // code without image cache:
  try {
    response = await axios.get(requestImgURL(coursePathInGithub, componentSlug, url), authToken);
  } catch (err) {
    // Handle Error Here
    console.error(err);
  }
  return response;
};

const function2 = async (coursePathInGithub, path, img) => {
  // *** code source: ***
  // functions: https://stackoverflow.com/a/58542933

  // Get the "img src" of single image
  const url = img.match(/[(].*[^)]/)[0].split('(')[1];

  if (!url) return;
  // encode "img src" so that special characters get changed. Example: kõvaketas – k%C3%B5vaketas; mälu – m%C3%A4lu
  const urlEncoded = encodeURI(url);

  // get full download URL only for images that don't already have full URL
  if (!urlEncoded.startsWith('http')) {
    const imgResponse = await getImgResponse(coursePathInGithub, path, urlEncoded);

    // console.log('getImgResponse:', getImgResponse);

    const results = [];
    try {
      const imgDownloadUrl = imgResponse.data.download_url;

      results.push(url);
      results.push(imgDownloadUrl);
    } catch (error) {
      results.push(url);
    }
    return results;
  }
  return true;
};

const function3 = async (markdownText, finishedPromises) => {
  // console.log('text3:', markdownText);

  let newText = markdownText;
  /* DB call to reload data */
  // console.log('finishedPromises:', finishedPromises);
  // eslint-disable-next-line array-callback-return
  finishedPromises.map((urlPair) => {
    // console.log('urlPair:', urlPair);
    if (urlPair.length === 1) return newText;

    newText = newText.replace(urlPair[0], urlPair[1]);
  });
  return newText;
};

const function1 = async (coursePathInGithub, path, componentDecodedUtf8) => {
  const markdownText = componentDecodedUtf8;

  // *** code sources: ***
  // functions: https://stackoverflow.com/a/58542933
  // changing img src: https://www.npmjs.com/package/modify-image-url-md?activeTab=explore

  // Get all the images from the text
  const images = markdownText.match(/!\[.*\]\(.*\)/g);

  // async/await - create an array of promises
  // from function2, then await until Promise.all has
  // fully resolved/rejected

  // if markdown HAS NO images, then return same markdown text
  if (!images) return markdownText;

  // if markdown DOES HAVE images, then change "img src" to full URL from github:

  // for each image, get its used "img src" and needed "download_url" to display image on webapp. Response are Promises, save those in new array
  const promises = images.map((img) => function2(coursePathInGithub, path, img));
  // solve each Promise in previous array, save results in new array
  const finishedPromises = await Promise.all(promises);

  // finally call function that changes each "img src" value with the image's github "download_url" value in the markdown text:
  return function3(markdownText, finishedPromises);
};

module.exports = { function1, function2, function3 };
