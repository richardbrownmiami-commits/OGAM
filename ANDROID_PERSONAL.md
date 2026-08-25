# OGAM — Android Personal Build

This branch is prepared for personal Android APK use only.

- Android build only
- Direct APK installation; no Play Store/AAB publishing workflow
- Gradle 8.7 with Android Gradle Plugin 8.6
- Java 17
- Android SDK 34 / NDK 26.1.10909125
- ARM ABIs: `armeabi-v7a`, `arm64-v8a`
- GitHub Actions builds a release APK and stores it as a workflow artifact

The release build uses the repository's existing debug signing configuration for personal sideloading. Do not use this signing setup for public distribution.
