const ICONS = {
  development: './assets/app-icon-development.png',
  preview: './assets/app-icon-preview.png',
  production: './assets/app-icon-production.png',
};

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT || 'production';
  const icon = ICONS[variant] || ICONS.production;

  return {
    ...config,
    icon,
    plugins: [...(config.plugins || []), ...((config.plugins || []).includes('expo-image') ? [] : ['expo-image'])],
  };
};
