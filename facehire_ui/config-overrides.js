// config-overrides.js

module.exports = function override(config, env) {
    // Traverse all rules and update the source-map-loader settings
    config.module.rules.forEach(rule => {
      if (rule.use) {
        rule.use.forEach(loaderObj => {
          if (
            loaderObj.loader &&
            loaderObj.loader.includes('source-map-loader')
          ) {
            // Modify options so that the source maps from pdfjs-dist are ignored.
            loaderObj.options = {
              ...loaderObj.options,
              filterSourceMappingUrl: (url) => {
                // Ignore source maps for pdfjs-dist.
                return url.indexOf('pdfjs-dist') === -1;
              },
            };
          }
        });
      }
    });
    return config;
  };
  