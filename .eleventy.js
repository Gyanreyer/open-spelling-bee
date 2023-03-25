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
    "node_modules/seedrandom/lib/alea.min.js": "js/alea.min.js",
  });

  return {
    dir: {
      input: "src",
    },
  };
};
