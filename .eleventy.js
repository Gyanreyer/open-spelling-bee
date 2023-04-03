const pluginWebc = require("@11ty/eleventy-plugin-webc");
const esbuild = require("esbuild");
const { minify: minifyHTML } = require("html-minifier-terser");
const through = require("through2");

module.exports = (eleventyConfig) => {
  // Set up webc plugin to process all webc files
  eleventyConfig.addPlugin(pluginWebc, {
    components: ["src/_components/**/*.webc"],
  });

  const jsAssetPathRegex = /\.m?js$/;

  eleventyConfig.addPassthroughCopy(
    {
      "src/js": "js",
      "src/pwa": "/",
    },
    {
      transform: function (src, dest, stats) {
        return through(function (chunk, enc, done) {
          const output = chunk.toString();
          if (jsAssetPathRegex.test(src)) {
            esbuild
              .transform(output, { minify: true })
              .then((result) => done(null, result.code));
          } else if (src.endsWith(".json")) {
            done(null, JSON.stringify(JSON.parse(output)));
          } else {
            done(null, output);
          }
        });
      },
    }
  );

  // Pass through word files without any processing
  eleventyConfig.addPassthroughCopy("src/words");

  eleventyConfig.addTransform("htmlmin", async function (content) {
    if (this.page.outputPath && this.page.outputPath.endsWith(".html")) {
      return await minifyHTML(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
      });
    }

    return content;
  });

  return {
    dir: {
      input: "src",
    },
  };
};
