//let input = {'config/lessons/name': 'new name'};
//let config = {id: 1, name: 'old name', lessons: [ {name: 'lesson 1', slug:
// 'lesson_1'}]};

function updateConfigFile(path, value, config) {
// Split the input key into parts
  let parts = path.split('/');
  console.log('parts', parts);
// If the first part matches an existing key in the config object
  if (parts[1] in config) {
    // If the second part is an array
    if (Array.isArray(config[parts[1]])) {
      // Loop through the array
      for (let i = 0; i < config[parts[1]].length; i++) {
        // If the third part matches an existing key in the array item
        if (parts[2] in config[parts[1]][i]) {
          // Update the value
          config[parts[1]][i][parts[2]] = value;
        }
      }
    } else {
      config[parts[1]] = value;
    }
  }
  return config;
}

export { updateConfigFile };