/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    // Generates an rgb() fallback before every oklch() color so that
    // older browsers (Chrome <111 / Safari <15.4) render solid colors
    // instead of transparent surfaces. Modern browsers keep using oklch().
    "@csstools/postcss-oklab-function": { preserve: true },
  },
};

export default config;
