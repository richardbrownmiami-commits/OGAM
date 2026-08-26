import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Onboarding: undefined;
  ModelDownload: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Chat: { conversationId?: string; projectId?: string };
  ProjectDetail: { projectId: string };
  ProjectEdit: { projectId?: string };
  ProjectChats: { projectId: string };
  KnowledgeBase: { projectId: string };
  DocumentPreview: { filePath: string; fileName: string; fileSize: number };
  ModelSettings: undefined;
  RemoteServers: undefined;
  DeviceInfo: undefined;
  StorageSettings: undefined;
  SecuritySettings: undefined;
  Sync: undefined;
  Notifications: undefined;
  DownloadManager: undefined;
  ProDetail: undefined;
  About: undefined;
  Tools: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  ChatsTab: undefined;
  ProjectsTab: undefined;
  ModelsTab:
    | {
        initialTab?: 'text' | 'voice' | 'transcription';
        repairModelId?: string;
        initialSearchQuery?: string;
      }
    | undefined;
  SettingsTab: undefined;
};
