const input = document.getElementById('fileInput');
const list = document.getElementById('fileList');
const uploadedFiles = new Set();

input.addEventListener('change', uploadFiles);

async function uploadFiles() {
  for (let i = 0; i < input.files.length; i++) {
    if (uploadedFiles.has(input.files[i].name)) {
      console.log('File already uploaded:', input.files[i].name);
      continue;
    }
    let formData = new FormData();
    formData.append('file', input.files[i]);
    let response = await fetch(
      '/course-edit/upload', { method: 'POST', body: formData });
    if (!response.ok) {
      console.error('Error uploading file:', response.statusText);
    } else {
      let files = await response.json();
      updateFileList(files);
      uploadedFiles.add(input.files[i].name);
    }
  }
}

function updateFileList(files) {
  while (list.hasChildNodes()) {
    list.removeChild(list.firstChild);
  }

  for (let i = 0; i < files.length; i++) {
    let li = document.createElement('li');
    li.textContent = files[i];
    let deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async function () {
      let formData = new FormData();
      formData.append('filename', files[i]);
      let response = await fetch(
        '/course-edit/delete', { method: 'POST', body: formData });
      if (!response.ok) {
        console.error('Error deleting file:', response.statusText);
      } else {
        let files = await response.json();
        updateFileList(files);
        uploadedFiles.delete(files[i]);
      }
    });
    li.appendChild(deleteButton);
    list.appendChild(li);
  }
}