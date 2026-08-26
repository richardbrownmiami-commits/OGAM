import { useState, useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { showAlert, AlertState, initialAlertState } from '../../components/CustomAlert';
import { useFocusTrigger } from '../../hooks/useFocusTrigger';
import { useDownloadStore, isActiveStatus, isFailedStatus } from '../../stores/downloadStore';
import { useAppStore } from '../../stores';
import { ModelTab, NavigationProp } from './types';
import { initialFilterState } from './constants';
import { useTextModels } from './useTextModels';
import { importGgufFiles, getErrorMessage } from './importHelpers';
import { isPickerStuck } from '../../utils/pickerErrorUtils';
import { isLiteRTAvailable } from '../../services/engines';
import { isLiteRTFileName } from '../../utils/modelHelpers';

export function useModelsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const focusTrigger = useFocusTrigger();
  const [activeTab, setActiveTabState] = useState<ModelTab>('text');
  const [alertState, setAlertState] = useState<AlertState>(initialAlertState);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ fraction: number; fileName: string } | null>(null);
  const { addDownloadedModel } = useAppStore();
  const text = useTextModels(setAlertState);

  const setActiveTab = (tab: ModelTab) => {
    setActiveTabState(tab);
    text.setFilterState(initialFilterState);
    text.setTextFiltersVisible(false);
  };

  const handleRefresh = async () => {
    text.setIsRefreshing(true);
    await text.loadDownloadedModels();
    if (text.hasSearched && text.searchQuery.trim()) await text.handleSearch();
    text.setIsRefreshing(false);
  };

  const isPickingRef = useRef(false);
  const validateImportFiles = (resolvedFiles: Array<{ name: string; uri: string }>): string | null => {
    const singleLitert = resolvedFiles.length === 1 && isLiteRTFileName(resolvedFiles[0].name);
    if (singleLitert && !isLiteRTAvailable()) return 'litert_unsupported';
    const allGguf = resolvedFiles.every(f => f.name.toLowerCase().endsWith('.gguf'));
    if (!allGguf && !singleLitert) return 'invalid_format';
    if (resolvedFiles.length > 2) return 'too_many';
    return null;
  };

  const handleImportLocalModel = async () => {
    if (isImporting || isPickingRef.current) return;
    isPickingRef.current = true;
    setIsImporting(true);
    try {
      const result = await pick({ type: [types.allFiles], allowMultiSelection: true });
      if (!result || result.length === 0) return;
      const resolvedFiles = result.map(f => ({
        ...f,
        name: (f.name?.trim() || decodeURIComponent(f.uri.split('/').pop() ?? '') || 'unknown').split('/').pop() || 'unknown',
      }));
      const validationError = validateImportFiles(resolvedFiles);
      if (validationError === 'litert_unsupported') {
        setAlertState(showAlert('Not Supported', 'LiteRT models are only supported on Android.'));
        return;
      }
      if (validationError === 'invalid_format') {
        setAlertState(showAlert('Invalid File', 'Supported local model formats: .gguf (text/vision) and .litertlm (Android LiteRT).'));
        return;
      }
      if (validationError === 'too_many') {
        setAlertState(showAlert('Too Many Files', 'Select 1 LiteRT file or up to 2 .gguf files (model + optional mmproj projector).'));
        return;
      }
      const firstFileName = resolvedFiles[0].name;
      setImportProgress({ fraction: 0, fileName: firstFileName });
      await importGgufFiles(resolvedFiles.slice(0, 2), { setAlertState, setImportProgress, addDownloadedModel });
    } catch (error: unknown) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return;
      if (isPickerStuck(error)) {
        setAlertState(showAlert('File Picker Unavailable', "The file picker isn't responding. Please close and reopen the app, then try again."));
        return;
      }
      setAlertState(showAlert('Import Failed', getErrorMessage(error)));
    } finally {
      isPickingRef.current = false;
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const activeDownloadCount = useDownloadStore(state => Object.values(state.downloads).filter(d => isActiveStatus(d.status)).length);
  const downloadBadgeCount = useDownloadStore(state => Object.values(state.downloads).filter(d => isActiveStatus(d.status) || isFailedStatus(d.status)).length);
  const totalModelCount = text.downloadedModels.length + activeDownloadCount;
  const handleDownload = useCallback((...args: Parameters<typeof text.handleDownload>) => text.handleDownload(...args), [text]);

  return {
    navigation, focusTrigger, activeTab, setActiveTab, alertState, setAlertState,
    isImporting, importProgress, totalModelCount, activeDownloadCount, downloadBadgeCount,
    handleImportLocalModel, handleRefresh,
    searchQuery: text.searchQuery, setSearchQuery: text.setSearchQuery,
    isLoading: text.isLoading, isRefreshing: text.isRefreshing, hasSearched: text.hasSearched,
    selectedModel: text.selectedModel, setSelectedModel: text.setSelectedModel,
    modelFiles: text.modelFiles, setModelFiles: text.setModelFiles, isLoadingFiles: text.isLoadingFiles,
    filterState: text.filterState, setFilterState: text.setFilterState,
    textFiltersVisible: text.textFiltersVisible, setTextFiltersVisible: text.setTextFiltersVisible,
    downloadedModels: text.downloadedModels, hasActiveFilters: text.hasActiveFilters,
    ramGB: text.ramGB, deviceRecommendation: text.deviceRecommendation,
    filteredResults: text.filteredResults, recommendedAsModelInfo: text.recommendedAsModelInfo,
    trendingAsModelInfo: text.trendingAsModelInfo, handleSearch: text.handleSearch,
    handleSelectModel: text.handleSelectModel, handleDownload,
    handleRepairMmProj: text.handleRepairMmProj, handleCancelDownload: text.handleCancelDownload,
    handleDeleteModel: text.handleDeleteModel, clearFilters: text.clearFilters,
    toggleFilterDimension: text.toggleFilterDimension, toggleOrg: text.toggleOrg,
    setTypeFilter: text.setTypeFilter, setSourceFilter: text.setSourceFilter,
    setSizeFilter: text.setSizeFilter, setQuantFilter: text.setQuantFilter,
    setSortOption: text.setSortOption, isModelDownloaded: text.isModelDownloaded,
    getDownloadedModel: text.getDownloadedModel, isRepairingVisionModel: text.isRepairingVisionModel,
  };
}

export type ModelsScreenViewModel = ReturnType<typeof useModelsScreen>;
