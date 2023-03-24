const pluginWebc = require("@11ty/eleventy-plugin-webc");

module.exports = (eleventyConfig) => {
  // Set up webc plugin to process all webc files
  eleventyConfig.addPlugin(pluginWebc, {
    components: ["src/_components/**/*.webc"],
  });

  eleventyConfig.addPassthroughCopy({
    "src/words": "words",
    "src/pwa": "pwa",
    "node_modules/alpinejs/dist/module.esm.js": "js/alpine.mjs",
    "node_modules/@alpinejs/persist/dist/module.esm.js":
      "js/alpine-persist.mjs",
  });

  return {
    dir: {
      input: "src",
    },
  };
};
