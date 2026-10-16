const path = require('path');
const fs = require('fs');
const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
  withAndroidColors,
  AndroidConfig,
} = require('@expo/config-plugins');

const withNotificationChannel = (config) => {
  // 1. Copy notification icon to android/app/src/main/res/drawable/ic_notification.png
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const srcPath = path.resolve(projectRoot, 'assets/images/notification-icon.png');
      const destDir = path.resolve(
        modConfig.modRequest.platformProjectRoot,
        'app/src/main/res/drawable'
      );
      const destPath = path.resolve(destDir, 'ic_notification.png');

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      } else {
        console.warn(`[withNotificationChannel] Source notification icon not found at ${srcPath}`);
      }

      return modConfig;
    },
  ]);

  // 2. Add notification_orange color entry to colors.xml
  config = withAndroidColors(config, (modConfig) => {
    modConfig.modResults = AndroidConfig.Colors.assignColorValue(modConfig.modResults, {
      name: 'notification_orange',
      value: '#FF5C00',
    });
    return modConfig;
  });

  // 3. Android Manifest updates: add default FCM channel, icon, and color meta-data
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    if (!manifest.$) {
      manifest.$ = {};
    }
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const mainApplication = manifest.application?.[0];
    if (mainApplication) {
      if (!mainApplication['meta-data']) {
        mainApplication['meta-data'] = [];
      }

      // Helper to idempotently add or update a meta-data entry
      const setMetaData = (name, key, value, replaceAttr) => {
        const existing = mainApplication['meta-data'].find(
          (m) => m.$?.['android:name'] === name
        );
        if (existing) {
          existing.$[key] = value;
          existing.$['tools:replace'] = replaceAttr;
        } else {
          mainApplication['meta-data'].push({
            $: {
              'android:name': name,
              [key]: value,
              'tools:replace': replaceAttr,
            },
          });
        }
      };

      // 1. Channel ID (uses android:value and tools:replace="android:value")
      setMetaData(
        'com.google.firebase.messaging.default_notification_channel_id',
        'android:value',
        'promotions_high',
        'android:value'
      );

      // 2. Notification icon (uses android:resource and tools:replace="android:resource")
      setMetaData(
        'com.google.firebase.messaging.default_notification_icon',
        'android:resource',
        '@drawable/ic_notification',
        'android:resource'
      );

      // 3. Notification color (uses android:resource and tools:replace="android:resource")
      setMetaData(
        'com.google.firebase.messaging.default_notification_color',
        'android:resource',
        '@color/notification_orange',
        'android:resource'
      );
    }
    return modConfig;
  });

  // 2. MainApplication.kt updates: create channel on every start
  config = withMainApplication(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    // Check if channel creation already present
    if (!contents.includes('promotions_high')) {
      const channelImports = `import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build`;

      if (!contents.includes('import android.app.NotificationChannel')) {
        contents = contents.replace(
          'import android.app.Application',
          `import android.app.Application\n${channelImports}`
        );
      }

      const channelCreationFunction = `
  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channelId = "promotions_high"
      val channelName = "Offers & Updates"
      val channelDescription = "Special offers, deals and promotional updates"
      val importance = NotificationManager.IMPORTANCE_HIGH

      val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      val audioAttributes = AudioAttributes.Builder()
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .build()

      val channel = NotificationChannel(channelId, channelName, importance).apply {
        description = channelDescription
        enableLights(true)
        enableVibration(true)
        setSound(soundUri, audioAttributes)
      }

      val notificationManager = getSystemService(NotificationManager::class.java)
      notificationManager?.createNotificationChannel(channel)
    }
  }
`;

      contents = contents.replace(
        'super.onCreate()',
        `super.onCreate()\n    createNotificationChannels()`
      );

      // Append method before the last closing brace
      const lastBraceIndex = contents.lastIndexOf('}');
      if (lastBraceIndex !== -1) {
        contents = contents.slice(0, lastBraceIndex) + channelCreationFunction + '\n}\n';
      }

      modConfig.modResults.contents = contents;
    }

    return modConfig;
  });

  return config;
};

module.exports = withNotificationChannel;
