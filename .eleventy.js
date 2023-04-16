const pluginWebc = require("@11ty/eleventy-plugin-webc");
const bundlerPlugin = require("@11ty/eleventy-plugin-bundle");

const { Transform } = require("stream");

// Libs for transforming output
const esbuild = require("esbuild");
const { minify: minifyCSS } = require("csso");
const { minify: minifyHTML } = require("html-minifier-terser");

class TransformStream extends Transform {
  constructor(transformFunction) {
    super();
    this._transform = (chunk, enc, done) =>
      transformFunction(this, chunk, done);
  }
}

module.exports = (eleventyConfig) => {
  // Set up webc plugin to process all webc files
  eleventyConfig.addPlugin(pluginWebc, {
    components: ["src/_components/**/*.webc"],
  });

  eleventyConfig.addWatchTarget("src/**/*.{js,mjs,css}");

  // Pass through word files and manifest without any processing
  eleventyConfig.addPassthroughCopy({
    "src/words": "words",
  });

  eleventyConfig.addPassthroughCopy(
    {
      "src/pwa/serviceWorker.js": "sw.js",
    },
    {
      transform: () =>
        new TransformStream((stream, chunk, done) =>
          esbuild
            .transform(chunk.toString(), { minify: true })
            .then((result) => done(null, result.code))
        ),
    }
  );

  eleventyConfig.addPassthroughCopy(
    {
      "src/pwa/manifest.json": "manifest.json",
    },
    {
      transform: () =>
        new TransformStream((stream, chunk, done) =>
          done(null, JSON.stringify(JSON.parse(chunk.toString())))
        ),
    }
  );

  eleventyConfig.addPassthroughCopy({ "src/pwa/**/*.png": "/" });

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
              if (bucket === "alpine") {
                unminifiedCode = `
                  const importAlpine = import("https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/module.esm.js/+esm"); 
                  document.addEventListener("alpine:init", () => {${unminifiedCode}});
                  const a = (await importAlpine).default;
                  window.Alpine = a;
                  a.start();
                `;
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
