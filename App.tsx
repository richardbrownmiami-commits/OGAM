/**
 * Off Grid - On-Device AI Chat Application
 * Private AI assistant that runs entirely on your device
 */

import 'react-native-gesture-handler';
import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, View, StyleSheet, LogBox } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './src/navigation';
import { useTheme } from './src/theme';
import { hardwareService, modelManager, authService, ragService } from './src/services';
import logger from './src/utils/logger';
import { useAppStore, useAuthStore, useWhisperStore } from './src/stores';
import { useDebugLogsStore } from './src/stores/debugLogsStore';
import { initDebugLogFile, appendDebugLine } from './src/utils/debugLogFile';
import { startStartupMemoryProbe } from './src/services/startupMemoryProbe';
import { hydrateDownloadStore } from './src/services/downloadHydration';
import { initActiveDownloadPersistence } from './src/services/activeDownloadPersistence';
import { restoreQueuedDownloads } from './src/services/restoreQueuedDownloads';
import { startLoadPolicySync } from './src/services/loadPolicySync';
import { registerCoreDownloadProviders } from './src/services/modelDownloadService/registerProviders';
import { useDownloadListeners } from './src/hooks/useDownloads';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { LockScreen } from './src/screens';
import { useAppState } from './src/hooks/useAppState';
import { useDownloadStore } from './src/stores/downloadStore';
import { ErrorBoundary } from './src/components/ErrorBoundary';

LogBox.ignoreAllLogs();

if (__DEV__) {
  const fmt = (a: unknown): string => {
    if (a instanceof Error) return `${a.name}: ${a.message}`;
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  };
  const base = { log: logger.log, warn: logger.warn, error: logger.error };
  const tap = (level: 'log' | 'warn' | 'error') => (...args: unknown[]) => {
    base[level](...args);
    const message = args.map(fmt).join(' ');
    try { useDebugLogsStore.getState().addLog({ timestamp: Date.now(), level, message }); } catch {}
    try { appendDebugLine(level, message); } catch {}
  };
  logger.log = tap('log');
  logger.warn = tap('warn');
  logger.error = tap('error');
  initDebugLogFile();
  startStartupMemoryProbe();
}

function App() {
  useDownloadListeners();
  const [isInitializing, setIsInitializing] = useState(true);
  const setDeviceInfo = useAppStore((s) => s.setDeviceInfo);
  const setModelRecommendation = useAppStore((s) => s.setModelRecommendation);
  const setDownloadedModels = useAppStore((s) => s.setDownloadedModels);
  const { colors, isDark } = useTheme();
  const { isEnabled: authEnabled, isLocked, setLocked, setLastBackgroundTime } = useAuthStore();

  const reattachTextDownloadRecovery = useCallback(async () => {
    const restoredIds = await modelManager.restoreInProgressDownloads();
    modelManager.startBackgroundDownloadPolling();
    restoredIds.forEach((downloadId) => {
      modelManager.watchDownload(
        downloadId,
        async () => {
          const models = await modelManager.getDownloadedModels();
          setDownloadedModels(models);
          useDownloadStore.getState().remove(useDownloadStore.getState().downloadIdIndex[downloadId] ?? '');
        },
        (error: Error) => {
          logger.error('[App] Restored text download failed:', error);
          useDownloadStore.getState().setStatus(downloadId, 'failed', { message: error.message });
        },
      );
    });
  }, [setDownloadedModels]);

  useAppState({
    onBackground: useCallback(() => {
      if (authEnabled) {
        setLastBackgroundTime(Date.now());
        setLocked(true);
      }
    }, [authEnabled, setLastBackgroundTime, setLocked]),
    onForeground: useCallback(() => {
      hydrateDownloadStore()
        .catch((error) => logger.error('[App] Failed to hydrate download store on foreground:', error))
        .finally(() => reattachTextDownloadRecovery().catch((error) => logger.error('[App] Failed to restore text downloads on foreground:', error)));
    }, [reattachTextDownloadRecovery]),
  });

  const ensureAppStoreHydrated = useCallback(async () => {
    const persistApi = useAppStore.persist;
    if (!persistApi?.hasHydrated || !persistApi.rehydrate) return;
    if (!persistApi.hasHydrated()) await persistApi.rehydrate();
  }, []);

  const recoverDownloadState = useCallback(() => {
    (async () => {
      initActiveDownloadPersistence();
      await hydrateDownloadStore().catch((error) => logger.error('[App] Failed to hydrate download store during startup:', error));
      await reattachTextDownloadRecovery();
      registerCoreDownloadProviders();
      await restoreQueuedDownloads().catch((error) => logger.error('[App] Failed to restore queued downloads during startup:', error));
      logger.log('[BOOT] refresh model lists');
      const { textModels } = await modelManager.refreshModelLists();
      setDownloadedModels(textModels);
    })().catch((error) => logger.error('[App] Download-state recovery failed:', error));
  }, [setDownloadedModels, reattachTextDownloadRecovery]);

  const initializeApp = useCallback(async () => {
    try {
      logger.log('[BOOT] app store hydrate');
      await ensureAppStoreHydrated();
      startLoadPolicySync();
      recoverDownloadState();
      logger.log('[BOOT] device info');
      const deviceInfo = await hardwareService.getDeviceInfo();
      setDeviceInfo(deviceInfo);
      const recommendation = hardwareService.getModelRecommendation();
      setModelRecommendation(recommendation);
      logger.log('[BOOT] modelManager.initialize');
      await modelManager.initialize();
      await modelManager.cleanupMMProjEntries();
      const { textModels } = await modelManager.refreshModelLists();
      setDownloadedModels(textModels);
      logger.log('[BOOT] auth passphrase check');
      const hasPassphrase = await authService.hasPassphrase();
      if (hasPassphrase && authEnabled) setLocked(true);
      ragService.ensureReady().catch((err) => logger.error('Failed to initialize RAG service on startup', err));
      logger.log('[BOOT] startup complete');
      setIsInitializing(false);
      useWhisperStore.getState().refreshPresentModels();
    } catch (error) {
      logger.error('[App] Error initializing app:', error);
      setIsInitializing(false);
    }
  }, [authEnabled, ensureAppStoreHydrated, recoverDownloadState, setDeviceInfo, setDownloadedModels, setLocked, setModelRecommendation]);

  useEffect(() => { initializeApp(); }, [initializeApp]);
  const handleUnlock = useCallback(() => setLocked(false), [setLocked]);

  if (isInitializing) {
    return <GestureHandlerRootView style={[styles.flex, { backgroundColor: colors.background }]}><SafeAreaProvider><View style={[styles.loadingContainer, { backgroundColor: colors.background }]} testID="app-loading"><SystemBars style={isDark ? 'light' : 'dark'} /><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaProvider></GestureHandlerRootView>;
  }
  if (authEnabled && isLocked) {
    return <GestureHandlerRootView style={[styles.flex, { backgroundColor: colors.background }]} testID="app-locked"><SafeAreaProvider><SystemBars style={isDark ? 'light' : 'dark'} /><LockScreen onUnlock={handleUnlock} /></SafeAreaProvider></GestureHandlerRootView>;
  }
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <SystemBars style={isDark ? 'light' : 'dark'} />
        <NavigationContainer theme={{ dark: isDark, colors: { primary: colors.primary, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, notification: colors.primary }, fonts: { regular: { fontFamily: 'System', fontWeight: '400' }, medium: { fontFamily: 'System', fontWeight: '500' }, bold: { fontFamily: 'System', fontWeight: '700' }, heavy: { fontFamily: 'System', fontWeight: '900' } } }}>
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default function AppRoot() {
  return <ErrorBoundary><KeyboardProvider><App /></KeyboardProvider></ErrorBoundary>;
}
