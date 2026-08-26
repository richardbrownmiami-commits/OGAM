import React, { useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { MainTabParamList } from '../../navigation/types';
import Icon from 'react-native-vector-icons/Feather';
import { CustomAlert, hideAlert } from '../../components/CustomAlert';
import { RECOMMENDED_MODELS } from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';
import { useModelsScreen } from './useModelsScreen';
import { createStyles } from './styles';
import { initialFilterState } from './constants';
import { TextModelsTab } from './TextModelsTab';
import { VoiceModelsUpsell } from '../../components/models/VoiceModelsUpsell';
import { TranscriptionModelsTab } from './TranscriptionModelsTab';
import { useSlot, SLOTS } from '../../bootstrap/slotRegistry';

export const ModelsScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const vm = useModelsScreen();
  const VoiceModelsPanel = useSlot(SLOTS.modelsScreenVoiceTab);
  const route = useRoute<RouteProp<MainTabParamList, 'ModelsTab'>>();
  const didAutoSelect = useRef(false);

  useFocusEffect(useCallback(() => {
    const { initialTab, repairModelId, initialSearchQuery } = route.params ?? {};
    if (initialTab) vm.setActiveTab(initialTab);
    if (initialSearchQuery && !didAutoSelect.current) {
      vm.setActiveTab('text');
      vm.setSearchQuery(initialSearchQuery);
    }
    if (repairModelId && !didAutoSelect.current) {
      didAutoSelect.current = true;
      const match = RECOMMENDED_MODELS.find(m => m.id === repairModelId);
      if (match) vm.handleSelectModel({ id: match.id, name: match.name, author: match.id.split('/')[0], description: match.description, modelType: match.type, paramCount: match.params, minRamGB: match.minRam, downloads: 0, likes: 0, tags: [], lastModified: '', files: [] });
    }
    return () => { didAutoSelect.current = false; vm.setSelectedModel(null); vm.setModelFiles([]); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.initialTab, route.params?.repairModelId]));

  const isShowingDetail = vm.activeTab === 'text' && vm.selectedModel !== null;

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="models-screen">
      <View style={isShowingDetail ? collapsedStyle.hidden : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>Models</Text>
          <TouchableOpacity style={styles.downloadManagerButton} onPress={() => vm.navigation.navigate('DownloadManager')} testID="downloads-icon">
            <Icon name="download" size={20} color={colors.text} />
            {vm.downloadBadgeCount > 0 && <View style={styles.downloadBadge}><Text testID="downloads-badge-count" style={styles.downloadBadgeText}>{vm.downloadBadgeCount}</Text></View>}
          </TouchableOpacity>
        </View>
        <View>
          {vm.isImporting && vm.importProgress ? (
            <View style={styles.importProgressCard}>
              <View style={styles.importProgressHeader}><Icon name="file" size={18} color={colors.primary} /><Text style={styles.importProgressText} numberOfLines={1}>Importing {vm.importProgress.fileName}</Text></View>
              <View style={styles.imageProgressBar}><View style={[styles.imageProgressFill, { width: `${Math.round(vm.importProgress.fraction * 100)}%` }]} /></View>
              <Text style={styles.importProgressPercent}>{Math.round(vm.importProgress.fraction * 100)}%</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.importButton} onPress={vm.handleImportLocalModel} testID="import-local-model" disabled={vm.isImporting}>
              <Icon name="folder-plus" size={20} color={colors.primary} /><Text style={styles.importButtonText}>Import Local Model</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          <TouchableOpacity style={styles.tabItem} onPress={() => { vm.setActiveTab('text'); vm.setFilterState(initialFilterState); vm.setTextFiltersVisible(false); }}>
            <Text style={[styles.tabText, vm.activeTab === 'text' && styles.tabTextActive]}>Text Models</Text>{vm.activeTab === 'text' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} testID="voice-models-tab" onPress={() => { vm.setActiveTab('voice'); }}>
            <Text style={[styles.tabText, vm.activeTab === 'voice' && styles.tabTextActive]}>Voice Models</Text>{vm.activeTab === 'voice' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} testID="transcription-models-tab" onPress={() => { vm.setActiveTab('transcription'); }}>
            <Text style={[styles.tabText, vm.activeTab === 'transcription' && styles.tabTextActive]}>Transcription Models</Text>{vm.activeTab === 'transcription' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {vm.activeTab === 'text' && (
        <TextModelsTab
          searchQuery={vm.searchQuery} setSearchQuery={vm.setSearchQuery} isLoading={vm.isLoading} isRefreshing={vm.isRefreshing}
          hasSearched={vm.hasSearched} selectedModel={vm.selectedModel} setSelectedModel={vm.setSelectedModel}
          modelFiles={vm.modelFiles} setModelFiles={vm.setModelFiles} isLoadingFiles={vm.isLoadingFiles}
          filterState={vm.filterState} textFiltersVisible={vm.textFiltersVisible} setTextFiltersVisible={vm.setTextFiltersVisible}
          filteredResults={vm.filteredResults} recommendedAsModelInfo={vm.recommendedAsModelInfo} trendingAsModelInfo={vm.trendingAsModelInfo}
          ramGB={vm.ramGB} deviceRecommendation={vm.deviceRecommendation} hasActiveFilters={vm.hasActiveFilters}
          downloadedModels={vm.downloadedModels} alertState={vm.alertState} setAlertState={vm.setAlertState} focusTrigger={vm.focusTrigger}
          handleSearch={vm.handleSearch} handleRefresh={vm.handleRefresh} handleSelectModel={vm.handleSelectModel} handleDownload={vm.handleDownload}
          handleRepairMmProj={vm.handleRepairMmProj} handleCancelDownload={vm.handleCancelDownload} handleDeleteModel={vm.handleDeleteModel}
          clearFilters={vm.clearFilters} toggleFilterDimension={vm.toggleFilterDimension} toggleOrg={vm.toggleOrg} setTypeFilter={vm.setTypeFilter}
          setSourceFilter={vm.setSourceFilter} setSizeFilter={vm.setSizeFilter} setQuantFilter={vm.setQuantFilter} setSortOption={vm.setSortOption}
          isModelDownloaded={vm.isModelDownloaded} getDownloadedModel={vm.getDownloadedModel} isRepairingVisionModel={vm.isRepairingVisionModel}
        />
      )}
      {vm.activeTab === 'voice' && (VoiceModelsPanel ? <VoiceModelsPanel /> : <VoiceModelsUpsell onGetPro={() => vm.navigation.navigate('ProDetail')} />)}
      {vm.activeTab === 'transcription' && <TranscriptionModelsTab />}
      <CustomAlert {...vm.alertState} onClose={() => vm.setAlertState(hideAlert())} />
    </SafeAreaView>
  );
};

const collapsedStyle = StyleSheet.create({ hidden: { height: 0, overflow: 'hidden' } });
