module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/renderer.js'],
  theme: {
    extend: {
      fontFamily: { ui: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'], mono: ['JetBrains Mono', 'Consolas', 'monospace'] },
      colors: {
        voltix: {
          black: '#05040a', panel: '#0b0711', ink: '#17121d', red: '#ff174d', pink: '#ff2f96', purple: '#8a2dff', blue: '#4167ff', green: '#43ff8e'
        }
      }
    }
  },
  plugins: []
};
