import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface TranscriptionState {
  currentFile: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  logs: string[];
  result: string | null;
}

interface SystemStatus {
  whisperInstalled: boolean;
  modelsCount: number;
  lastTranscriptionTime: string | null;
}

interface AppStore extends TranscriptionState {
  systemStatus: SystemStatus;
  activeTab: string;
  
  // Navigation actions
  setActiveTab: (tab: string) => void;
  
  // Transcription actions
  setCurrentFile: (file: string | null) => void;
  setStatus: (status: TranscriptionState['status']) => void;
  setProgress: (progress: number) => void;
  addLog: (log: string) => void;
  setResult: (result: string | null) => void;
  reset: () => void;
  
  // System status actions
  setWhisperInstalled: (installed: boolean) => void;
  setModelsCount: (count: number) => void;
  setLastTranscriptionTime: (time: string) => void;
  updateSystemStatus: (status: Partial<SystemStatus>) => void;
}

const initialState: TranscriptionState = {
  currentFile: null,
  status: 'idle',
  progress: 0,
  logs: [],
  result: null,
};

const initialSystemStatus: SystemStatus = {
  whisperInstalled: false,
  modelsCount: 0,
  lastTranscriptionTime: null,
};

export const useAppStore = create<AppStore>()(
  immer((set) => ({
    ...initialState,
    systemStatus: initialSystemStatus,
    activeTab: 'dashboard',
    
    setActiveTab: (tab) => set((state) => {
      state.activeTab = tab;
    }),
    
    setCurrentFile: (file) => set((state) => {
      state.currentFile = file;
    }),
    
    setStatus: (status) => set((state) => {
      state.status = status;
      if (status === 'completed') {
        state.systemStatus.lastTranscriptionTime = new Date().toISOString();
      }
    }),
    
    setProgress: (progress) => set((state) => {
      state.progress = Math.max(0, Math.min(1, progress));
    }),
    
    addLog: (log) => set((state) => {
      state.logs.push(log);
    }),
    
    setResult: (result) => set((state) => {
      state.result = result;
    }),
    
    reset: () => set((state) => {
      Object.assign(state, initialState);
    }),
    
    setWhisperInstalled: (installed) => set((state) => {
      state.systemStatus.whisperInstalled = installed;
    }),
    
    setModelsCount: (count) => set((state) => {
      state.systemStatus.modelsCount = count;
    }),
    
    setLastTranscriptionTime: (time) => set((state) => {
      state.systemStatus.lastTranscriptionTime = time;
    }),
    
    updateSystemStatus: (status) => set((state) => {
      Object.assign(state.systemStatus, status);
    }),
  }))
);