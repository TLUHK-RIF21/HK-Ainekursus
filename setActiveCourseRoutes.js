/* eslint-disable max-len */
const express = require('express');

const { base64, utf8, MarkdownIt } = require('./setupMarkdown');
const { axios, authToken } = require('./setupGithub');

// Import request functions for Axios
const {
  requestDocs,
  requestLoengud,
  requestConcepts,
  requestSources,
  requestStaticURL,
} = require('./functions/repoFunctions');

// Define what to do with Axios Response, how it is rendered
function responseAction(
  resConcepts,
  config,
  res,
  breadcrumbNames,
  path,
  allCourses,
  ...options
) {
  const concepts = resConcepts.data;
  const conceptsDecoded = base64.decode(concepts.content);
  const conceptsDecodedUtf8 = utf8.decode(conceptsDecoded);
  const conceptsMarkdown = MarkdownIt.render(conceptsDecodedUtf8);

  const resSources = options[0];

  // define sources as NULL by default.
  let sourcesJSON = null;
  // NB! Sources are sent only with "Teemade endpointid" axios call. If sourcesJSON stays NULL (is false), then content.handlebars does not display "Allikad" div. If sourcesJSON gets filled (is true), then "Allikad" div is displayed.
  if (resSources) {
    const sources = resSources.data;
    const sourcesDecoded = base64.decode(sources.content);
    const sourcesDecodedUtf8 = utf8.decode(sourcesDecoded);
    sourcesJSON = JSON.parse(sourcesDecodedUtf8);
  }

  res.render('home', {
    content: conceptsMarkdown,
    docs: config.docs,
    concepts: config.concepts,
    loengud: config.loengud,
    sources: sourcesJSON,
    breadcrumb: breadcrumbNames,
    path,
    courses: allCourses,
  });
}

const setRoutes = async (app, config, course, allCourses) => {
  // *** ENDPOINTS ***
  const { courseName, courseSlug } = course;

  // ** SINGLE COURSE ENDPOINTS (home.handlebars) **
  // Ainekursusest ja Hindamine endpointid
  config.docs.forEach((elem) => {
    // console.log('elem.slug:', elem.slug);
    const breadcrumbNames = {
      courseName,
      contentName: elem.name,
    };
    const path = {
      courseSlug,
      contentSlug: elem.slug,
    };

    app.get(`/${courseSlug}/${elem.slug}`, (req, res) => {
      axios
        .get(requestDocs(`${elem.slug}`), authToken)
        .then((response) => {
          responseAction(response, config, res, breadcrumbNames, path, allCourses);
        })
        .catch((error) => {
          console.log(error);
        });
    });
  });

  // Loengute endpointid
  config.loengud.forEach((elem) => {
    // console.log('elem.slug:', elem.slug);
    const breadcrumbNames = {
      courseName,
      contentName: elem.name,
    };
    const path = {
      courseSlug,
      contentSlug: elem.slug,
    };

    app.get(`/${courseSlug}/${elem.slug}`, (req, res) => {
      axios
        .get(requestLoengud(`${elem.slug}`), authToken)
        .then((response) => {
          responseAction(response, config, res, breadcrumbNames, path, allCourses);
        })
        .catch((error) => {
          console.log(error);
        });
    });
  });

  // Teemade endpointid
  config.concepts.forEach((elem) => {
    const breadcrumbNames = {
      courseName,
      contentName: elem.name,
    };
    const path = {
      courseSlug,
      contentSlug: elem.slug,
    };

    // define folder for each concept's static files:
    // console.log('requestStatic(elem.slug)', requestStaticURL(elem.slug));
    app.use(express.static(requestStaticURL(elem.slug)));

    app.get(`/${courseSlug}/${elem.slug}`, (req, res) => {
      const concepts = axios.get(requestConcepts(`${elem.slug}`), authToken);
      const sources = axios.get(requestSources(`${elem.slug}`), authToken);

      axios
        .all([concepts, sources])
        .then(
          axios.spread((...responses) => {
            const resConcepts = responses[0];
            const resSources = responses[1];

            responseAction(
              resConcepts,
              config,
              res,
              breadcrumbNames,
              path,
              allCourses,
              resSources,
            );
          }),
        )
        .catch((error) => {
          console.log(error);
        });
    });
  });
};

module.exports = { setRoutes };