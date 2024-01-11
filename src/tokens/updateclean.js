// this file removes all lines what consist [object Object] from the global.css
// file Import the required modules
import fs from 'fs';
import path from 'path';

function updateGlobalCSS(outputDirPath) {
  // Define the path to the global.css file
  const globalCSSPath = path.join(outputDirPath, 'global.css');

  // Read the contents of the global.css file
  const fileContents = fs.readFileSync(globalCSSPath, 'utf8');

  // Remove any lines that contain "[object Object];"
  const newFileContents = fileContents.split('\n')
    .filter((line) => !line.includes('[object Object];'))
    .join('\n');

  // Regroup all similar variables
  // ...

  // Write the updated contents to the global.css file
  fs.writeFileSync(globalCSSPath, newFileContents);
}

// Define the path to the output directory
const outputDirPath = path.join(__dirname, 'output');

// Call the updateGlobalCSS function
console.log('Updating global.css...');
updateGlobalCSS(outputDirPath);
console.log('global.css updated!');
