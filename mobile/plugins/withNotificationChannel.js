const { withAndroidManifest, withMainApplication } = require('@expo/config-plugins');

const withNotificationChannel = (config) => {
  // 1. Android Manifest updates: add default FCM channel meta-data
  config = withAndroidManifest(config, (modConfig) => {
    const mainApplication = modConfig.modResults.manifest.application?.[0];
    if (mainApplication) {
      if (!mainApplication['meta-data']) {
        mainApplication['meta-data'] = [];
      }

      const existingMeta = mainApplication['meta-data'].find(
        (m) => m.$?.['android:name'] === 'com.google.firebase.messaging.default_notification_channel_id'
      );

      if (!existingMeta) {
        mainApplication['meta-data'].push({
          $: {
            'android:name': 'com.google.firebase.messaging.default_notification_channel_id',
            'android:value': 'promotions_high',
          },
        });
      }
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
