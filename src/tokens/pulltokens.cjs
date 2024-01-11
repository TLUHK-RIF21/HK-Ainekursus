const { exec } = require('child_process');

const folderPath = 'src/tokens'; // you folder path

exec(
  `cd ${ folderPath } && git reset --hard && git pull`,
  (error, stdout, stderr) => {
    if (error) {
      console.error(` ${ error }`);
      return;
    }
    console.log(`git pull: ${ stdout }`);
  }
);
