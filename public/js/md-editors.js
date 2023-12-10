// markdown
/**
 * tinyMDE1 - Variable representing an instance of TinyMDE editor.
 *
 * @type {TinyMDE.Editor}
 * @description The `tinyMDE1` variable refers to an instance of the
 *   TinyMDE.Editor class, which is responsible for creating a Markdown editor.
 * @param {Object} options - An object containing configuration options for the
 *   editor.
 * @param {string} options.textarea - The id or CSS selector of the textarea
 *   element where the editor will be rendered.
 * @returns {TinyMDE.Editor} - The created TinyMDE editor instance.
 *
 * @event TinyMDE.Editor#change - A custom event triggered whenever the content
 *   of the editor changes.
 * @param {Object} eventData - The data associated with the change event.
 * @param {string} eventData.content - The new content of the editor.
 * @param {string} xxx - A parameter with unknown purpose.
 *
 * @function debounce - A utility function that limits the rate at which a
 *   function can be invoked.
 * @param {function} func - The function to be debounced.
 * @param {number} delay - The delay in milliseconds before invoking the
 *   function.
 * @returns {function} - The debounced function.
 *
 * @function handleMDChange - A function that handles the change event of the
 *   editor.
 * @param {string} content - The new content of the editor.
 * @param {string} component - The identifier of the component where the editor
 *   is being used.
 */
const tinyMDE1 = new TinyMDE.Editor({ textarea: 'component' }).addEventListener(
  'change', debounce((eventData, xxx) => {
    handleMDChange(eventData.content, 'component');
  }, 500));
/**
 * Represents the command bar for the TinyMDE editor.
 *
 * @class
 * @constructor
 * @param {Object} options - The options for the command bar.
 * @param {string} options.element - The ID of the DOM element to use as the
 *   command bar.
 * @param {TinyMDE.Editor} options.editor - The TinyMDE editor instance.
 */
const commandBar1 = new TinyMDE.CommandBar(
  { element: 'tinymde_commandbar', editor: tinyMDE1 });
/**
 * Represents an instance of the TinyMDE2 editor.
 * @constructor
 * @param {Object} options - The options for the editor.
 * @param {string} options.textarea - The ID of the textarea element to bind
 *   the editor to.
 */
const tinyMDE2 = new TinyMDE.Editor(
  { textarea: 'additionalMaterials[content]' }).addEventListener(
  'change', debounce((eventData, xxx) => {
    handleMDChange(eventData.content, 'additionalMaterials[content]');
  }, 500));
/**
 * Represents a CommandBar object for TinyMDE.
 *
 * @class
 * @constructor
 * @param {Object} options - The configuration options for the CommandBar.
 * @param {string} options.element - The ID of the HTML element that represents
 *   the CommandBar.
 * @param {Object} options.editor - The instance of the TinyMDE editor
 *   associated with the CommandBar.
 */
const commandBar2 = new TinyMDE.CommandBar(
  { element: 'tinymde_commandbar2', editor: tinyMDE2 });

/**
 * Retrieves all lesson elements from the document.
 *
 * @returns {NodeList} A NodeList containing all lesson elements.
 */
const lessons = document.querySelectorAll('.lesson');

lessons.forEach((title, index) => {
  title.addEventListener('click', () => {
    const content = title.nextElementSibling;
    content.classList.toggle('hidden');
  });
  const tinyMDE = new TinyMDE.Editor(
    { textarea: 'lessons_content_' + index }).addEventListener(
    'change', debounce((eventData, xxx) => {
      handleMDChange(eventData.content, 'lessons_content_' + index);
    }, 500));
  const cm = new TinyMDE.CommandBar({
    element: 'tinymde_commandbar_lessons_content_' + index, editor: tinyMDE
  });

  const tinyMDE2 = new TinyMDE.Editor(
    { textarea: 'lessons_add_' + index }).addEventListener(
    'change', debounce((eventData, xxx) => {
      handleMDChange(eventData.content, 'lessons_add_' + index);
    }, 500));
  const cm2 = new TinyMDE.CommandBar(
    { element: 'tinymde_commandbar_lessons_add_' + index, editor: tinyMDE2 });
});
