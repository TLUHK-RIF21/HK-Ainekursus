const Editor = toastui.Editor;

Editor.setLanguage('et-EE', {
  Markdown: 'Markdown',
  WYSIWYG: 'Visuaalne',
  Write: 'Kirjuta',
  Preview: 'Eelvaade',
  Headings: 'Pealkirjad',
  Paragraph: 'Lõik',
  Bold: 'Rasvane',
  Italic: 'Kursiiv',
  Strike: 'Läbikriipsutus',
  Code: 'Kood',
  Line: 'Horisontaalne joon',
  Blockquote: 'Tsitaat',
  'Unordered list': 'loeteulu',
  'Ordered list': 'Nummerdatud loeteulu',
  Task: 'Ülesanne',
  Indent: 'Suurenda taanet',
  Outdent: 'Vähenda taanet',
  'Insert link': 'Lisa link',
  'Insert CodeBlock': 'Lisa kood',
  'Insert table': 'Lisa tabel',
  'Insert image': 'Lisa pilt',
  Heading: 'Pealkiri',
  'Image URL': 'Pildi URL',
  'Select image file': 'Vali pildi fail',
  'Choose a file': 'Vali fail',
  'No file': 'Fail puudub',
  Description: 'Kirjeldus',
  OK: 'OK',
  More: 'Veel',
  Cancel: 'Tühista',
  File: 'Fail',
  URL: 'URL',
  'Link text': 'Lingi tekst',
  'Add row to up': 'Lisa rida üles',
  'Add row to down': 'Lisa rida alla',
  'Add column to left': 'Lisa veerg vasakule',
  'Add column to right': 'Lisa veerg paremale',
  'Remove row': 'kustuta rida',
  'Remove column': 'Kustuta veerg',
  'Align column to left': 'Joonda vasakule',
  'Align column to center': 'Joonda keskele',
  'Align column to right': 'Joonda paremale',
  'Remove table': 'Kustuta tabel',
  'Would you like to paste as table?': 'Tahad kleepida tabelina?',
  'Text color': 'Teksti värv',
  'Auto scroll enabled': 'Automaatne kerimine lubatud',
  'Auto scroll disabled': 'Automaatne kerimine keelatud',
  'Choose language': 'Vali keel',
  Undo: 'Võta tagasi',
  Redo: 'Tee uuesti'
});

function createUndoButton(editor) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toastui-editor-toolbar-icons';
  button.style.backgroundImage = 'none';
  button.style.margin = '0';
  button.innerHTML = `<i class="material-symbols-outlined">undo</i>`;
  button.addEventListener('click', () => {
    editor.exec('undo');
  });
  return button;
}

function createRedoButton(editor) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toastui-editor-toolbar-icons';
  button.style.backgroundImage = 'none';
  button.style.margin = '0';
  button.innerHTML = `<i class="material-symbols-outlined">redo</i>`;
  button.addEventListener('click', () => {
    editor.exec('redo');
  });
  return button;
}
