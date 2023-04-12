const pluginWebc = require("@11ty/eleventy-plugin-webc");
const bundlerPlugin = require("@11ty/eleventy-plugin-bundle");

// Libs for transforming output
const esbuild = require("esbuild");
const { minify: minifyCSS } = require("csso");
const { minify: minifyHTML } = require("html-minifier-terser");

module.exports = (eleventyConfig) => {
  // Set up webc plugin to process all webc files
  eleventyConfig.addPlugin(pluginWebc, {
    components: ["src/_components/**/*.webc"],
  });

  eleventyConfig.addWatchTarget("src/**/*.{js,mjs,css}");

  // Pass through word files and manifest without any processing
  eleventyConfig.addPassthroughCopy({
    "src/words": "words",
    "src/pwa/manifest.json": "manifest.json",
  });

  // Apply custom transforms to bundled JS and CSS
  eleventyConfig.addPlugin(bundlerPlugin, {
    transforms: [
      async function (content) {
        switch (this.type) {
          case "js":
            try {
              let unminifiedCode = content;

              // Wrap AlpineJS code in an Alpine init event listener
              const [bucket] = this.buckets;
              if (bucket === "alpine-init") {
                unminifiedCode = `document.addEventListener("alpine:init", () => {${unminifiedCode}})`;
              } else if (bucket === "alpine-initialized") {
                unminifiedCode = `document.addEventListener("alpine:initialized", () => {${unminifiedCode}})`;
              }

              // Minify the JS bundle
              return (await esbuild.transform(unminifiedCode, { minify: true }))
                .code;
            } catch (e) {
              console.error("Error while minifying JS bundle:", e);
            }
            break;
          case "css":
            try {
              // Minify the CSS bundle
              return minifyCSS(content).css;
            } catch (e) {
              console.error("Error while minifying CSS bundle:", e);
            }
            break;
          default:
        }

        return content;
      },
    ],
  });

  // Minify the HTML output
  eleventyConfig.addTransform("htmlmin", async function (content) {
    if (this.page.outputPath && this.page.outputPath.endsWith(".html")) {
      try {
        return await minifyHTML(content, {
          useShortDoctype: true,
          removeComments: true,
          collapseWhitespace: true,
        });
      } catch (e) {
        console.error("HTML minification error: ", e);
        return content;
      }
    }

    return content;
  });

  return {
    dir: {
      input: "src",
    },
  };
};
