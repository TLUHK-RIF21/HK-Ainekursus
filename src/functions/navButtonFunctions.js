/* eslint-disable max-len */

const returnPreviousPage = (currentPath, paths) => {
  // console.log('paths', paths);
  // console.log('currentPath', currentPath);
  const currentIndex = paths.findIndex((object) => object.path === currentPath);
  // console.log('currentIndex', currentIndex);
  if (currentIndex !== 0) {
    return paths[currentIndex - 1].path;
  }
  return currentPath;
};
const returnNextPage = (currentPath, paths) => {
  const currentIndex = paths.findIndex(
    (object) => object.path === currentPath);
  if (currentIndex !== paths.lenght - 1) {
    return paths[currentIndex + 1].path;
  }
  return currentPath;
};

// *** BUTTONS – FORWARD/BACK PATH SETTINGS ***
const setCourseButtonPaths = (config) => {
  // For Forward/Back buttons, push all possible paths in one course to an
  // Array:
  const backAndForwardPaths = [];
  const markAsDonePaths = [];

  if (config) {
    // *** Comment out config.docs.map() if you don't want to show buttons on
    // Ainekursusest pages ***
    config.docs?.map((x) => backAndForwardPaths.push({
      path: x.slug
    }));
    config.lessons?.map((x) => {
      // *** Comment out backAndForwardPaths.push() if you don't want to show
      // buttons on Lesson pages ***
      backAndForwardPaths.push({
        path: x.slug
      });
      // *** Comment out x.components.map() if you don't want to show buttons on
      // Components pages (sisulehed ja praktikumid) ***
      x.components.map((y) => backAndForwardPaths.push({
        path: `${ x.slug }/${ y }`
      }));
      x.components.map((y) => markAsDonePaths.push({
        path: `${ x.slug }/${ y }`
      }));
      // *** Comment out x.additionalMaterials.map() if you don't want to show
      // buttons on Aine Lisamaterjalid pages ***
      x.additionalMaterials?.map((z) => backAndForwardPaths.push({
        path: `${ x.slug }/${ z.slug }`
      }));
    });
    // *** Comment out config.additionalMaterials.map() if you don't want to
    // show buttons on Aine Lisamaterjalid page ***
    config.additionalMaterials?.map((x) => backAndForwardPaths.push({
      path: x.slug
    }));
  }
  return {
    backAndForwardPaths,
    markAsDonePaths
  };
};

export { returnPreviousPage, returnNextPage, setCourseButtonPaths };
