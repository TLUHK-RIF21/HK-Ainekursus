// sync ois content
const oisSyncButton = document.getElementById('sync');
oisSyncButton.addEventListener('click', () => {
  fetch('/get-ois-content?courseId=1', {
    method: 'get', headers: {
      'Content-Type': 'application/json'
    }
  }).then((res) => {
    if (res.ok) {
      return res.json();
    }
    return Promise.reject(res); // 2. reject instead of throw
  }).then((res) => {
    tinyMDE1.setContent(res.data);
    document.getElementById('component').value = res.data;
  }).catch((e) => {
    console.log(e);
  });
});
