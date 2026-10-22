import { ExpoConfig, ConfigContext } from 'expo/config';
import appJson from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig: ExpoConfig = (appJson as { expo: ExpoConfig }).expo || config;

  return {
    ...baseConfig,
    android: {
      ...baseConfig.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON || baseConfig.android?.googleServicesFile,
    },
    ios: {
      ...baseConfig.ios,
      googleServicesFile:
        process.env.GOOGLE_SERVICE_INFO_PLIST || baseConfig.ios?.googleServicesFile,
    },
  };
};
