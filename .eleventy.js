const fs = require("fs");

const { DateTime } = require("luxon");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");

const pluginRss = require("@11ty/eleventy-plugin-rss");
const pluginSyntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

const { EleventyHtmlBasePlugin } = require("@11ty/eleventy");

const metadata = require('./_data/metadata.json');
// Change this to match the actual path prefix.
const pathPrefix = process.env.PATH_PREFIX || metadata.pathPrefix;

const UserConfig = require("@11ty/eleventy/src/UserConfig");

/**
 * @param {UserConfig} eleventyConfig
 */
module.exports = function (eleventyConfig) {
  // Copy the `img`, and `fonts` folders to the output
  // CSS isn't copied over, that's done inline via the base template.
  eleventyConfig.addPassthroughCopy("img");
  eleventyConfig.addPassthroughCopy("fonts");
  eleventyConfig.addPassthroughCopy({ "node_modules/simplelightbox/dist/simple-lightbox.min.css": "simplelightbox/simple-lightbox.min.css" });
  eleventyConfig.addPassthroughCopy({ "node_modules/simplelightbox/dist/simple-lightbox.min.js": "simplelightbox/simple-lightbox.min.js" });

  //Since moving the CSS inline eleventy no longer watches it (because it's not being copied to output), so I had to include it as a watch target.
  eleventyConfig.addWatchTarget("./css/");
  eleventyConfig.addWatchTarget("./js/");

  // Customize Markdown library and settings:
  let markdownLibrary = markdownIt({
    html: true,
    linkify: true,
    typographer: true
  }).use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.headerLink(),
    level: [1, 2, 3, 4],
    slugify: eleventyConfig.getFilter("slugify")
  });

  // Wrap images in a figure, a, and figcaption.
  // This lets the simplelightbox code serve it up too!
  // Also adds loading lazy attribute
  let imageRenderer = require('./_configs/markdownlibrary.renderer.image');
  markdownLibrary.renderer.rules.image = (tokens, idx, options, env, slf) => imageRenderer(tokens, idx, options, env, slf, markdownLibrary);

  // If a Markdown link points at an .md file, convert it to its corresponding post URL
  let linkRenderer = require('./_configs/markdownlibrary.renderer.links');
  markdownLibrary.renderer.rules.link_open = linkRenderer;

  eleventyConfig.setLibrary("md", markdownLibrary);
  // Re-enable the indented code block feature
  eleventyConfig.amendLibrary("md", mdLib => mdLib.enable("code"))

  // RSS
  eleventyConfig.addPlugin(pluginRss);
  // Code syntax with Prism JS
  eleventyConfig.addPlugin(pluginSyntaxHighlight);

  //Converts most URLs to URLs with pathPrefix
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);

  // Date used below posts
  eleventyConfig.addFilter("readableDate", dateObj => {
    return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat("dd LLL yyyy");
  });

  // Date used in sitemap and data attribute
  // https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
  eleventyConfig.addFilter('htmlDateString', (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat('yyyy-LL-dd');
  });

  // Get the first `n` elements of a collection. Used on the home page to limit number of items to display.
  eleventyConfig.addFilter("head", (array, n) => {
    if (!Array.isArray(array) || array.length === 0) {
      return [];
    }
    if (n < 0) {
      return array.slice(n);
    }

    return array.slice(0, n);
  });


  // Filters out irrelevant tags that aren't really related to content, only used for organising things
  eleventyConfig.addFilter("filterTagList", function (tags) {
    return (tags || []).filter(tag => ["all", "nav", "post", "posts"].indexOf(tag) === -1);
  });

  // Paired shortcode that takes a JSON array of CSS file paths
  // It then combines them, which includes reconciles overriden values!
  // And returns the output.
  eleventyConfig.addPairedShortcode("cssminification", require('./_configs/cssminification.shortcode'));

  //Paired shortcode to display a notice panel like standard, error, warning, etc.
  let notice = require('./_configs/notice.shortcode');
  eleventyConfig.addPairedShortcode("notice", (data, noticeType) => notice(data, noticeType, markdownLibrary));

  // Paired shortcode to display a figure with caption.
  // This is very similar to the regular Markdown image,
  // But I'll keep this around in case the other way ever breaks in the future
  // Plus, this has the 'width' flexibility, and maybe more future features.
  let figure = require('./_configs/figure.shortcode');
  eleventyConfig.addShortcode("figure", (image, caption, widthName) => figure(image, caption, widthName, markdownLibrary));

  // If the post contains images, then add the Lightbox JS/CSS and render lightboxes for it.
  // Since it needs access to the `page` object, we can't use arrow notation here.
  let lightbox = require('./_configs/lightboxref.shortcode');
  eleventyConfig.addShortcode("addLightBoxRefIfNecessary", function () { return lightbox(this.page); });

  // The `gallery` paired shortcode shows a set of images and displays it in a grid.
  let gallery = require('./_configs/gallery.shortcode');
  eleventyConfig.addPairedShortcode("gallery", (data) => gallery(data, markdownLibrary));

  // Generate excerpt from first paragraph
  let excerpt = require('./_configs/excerpt.shortcode')
  eleventyConfig.addShortcode("excerpt", excerpt);

  // Show the current year using a shortcode
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // Shortcode for Github Repo Card
  let ghRepoCard = require('./_configs/githubrepocard.shortcode');
  eleventyConfig.addShortcode("githubrepocard", ghRepoCard);

  // The `gist` shortcode renders the gist's files as code blocks
  // For some reason calling the method directly isn't possible, I have to wrap it.
  let gist = require('./_configs/gist.shortcode');
  eleventyConfig.addShortcode("gist", async (gistId) => gist(gistId, markdownLibrary));





  return {
    // Control which files Eleventy will process
    // e.g.: *.md, *.njk, *.html, *.liquid
    templateFormats: [
      "md",
      "njk",
      "html",
      "liquid"
    ],

    // Pre-process *.md files with: (default: `liquid`)
    markdownTemplateEngine: "njk",

    // Pre-process *.html files with: (default: `liquid`)
    htmlTemplateEngine: "njk",

    // -----------------------------------------------------------------
    // If your site deploys to a subdirectory, change `pathPrefix` in metadata.json.
    // Don’t worry about leading and trailing slashes, we normalize these.

    // If you don’t have a subdirectory, use "" or "/" (they do the same thing)
    // This is only used for link URLs (it does not affect your file structure)
    // Best paired with the `url` filter: https://www.11ty.dev/docs/filters/url/

    // You can also pass this in on the command line using `--pathprefix`

    // Optional (default is "/")
    pathPrefix: pathPrefix,
    // -----------------------------------------------------------------

    // These are all optional (defaults are shown):
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
};
