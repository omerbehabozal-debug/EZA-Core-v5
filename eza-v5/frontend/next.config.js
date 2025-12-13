const path = require("path");

module.exports = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Alias configuration for @ imports
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
    };
    
    // Ensure proper module resolution
    config.resolve.extensions = [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".json",
      ...(config.resolve.extensions || []),
    ];
    
    return config;
  },
};
