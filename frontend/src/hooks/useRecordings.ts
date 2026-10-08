import { useState, useRef, useCallback } from 'react';
import { get, set } from 'idb-keyval';
import api from '@/lib/api';

interface QueuedChunk {
  sessionId: string;
  type: string;
  sequenceNumber: number;
  startTime: number;
  endTime: number;
  duration: number;
  blob: Blob;
}

export const useRecordings = (attemptId: string) => {
  const [recordingStatus, setRecordingStatus] = useState<Record<string, string>>({});
  const mediaRecorders = useRef<Record<string, MediaRecorder>>({});
  const sequenceNumbers = useRef<Record<string, number>>({});

  const startRecording = useCallback(async (type: 'CAMERA' | 'SCREEN', stream: MediaStream) => {
    try {
      // 1. Detect supported codec
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }

      // 2. Register Session on Backend
      const res = await api.post('/recordings/start', {
        attemptId,
        type,
        mimeType,
        codec: mimeType
      });
      const sessionId = res.data.recordingSessionId;

      setRecordingStatus(prev => ({ ...prev, [type]: 'ACTIVE' }));
      sequenceNumbers.current[sessionId] = 0;

      // 3. Initialize MediaRecorder
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1000000 }); // 1Mbps target
      mediaRecorders.current[sessionId] = recorder;

      let chunkStartTime = Date.now();
      
      // REM-REC-FINAL-06: Durable retry via IndexedDB
      let isUploading = false;
      const IDB_KEY = `recording_queue_${sessionId}`;

      const getQueue = async (): Promise<QueuedChunk[]> => {
        try {
          return (await get(IDB_KEY)) || [];
        } catch { return []; }
      };

      const setQueue = async (q: QueuedChunk[]) => {
        try {
          await set(IDB_KEY, q);
        } catch (err) {
          console.error('IDB set failed', err);
        }
      };

      const processQueue = async () => {
        if (isUploading) return;
        isUploading = true;
        
        let pendingQueue = await getQueue();
        
        while (pendingQueue.length > 0) {
          const item = pendingQueue[0];
          
          const formData = new FormData();
          formData.append('chunk', item.blob, `chunk-${item.sequenceNumber}.webm`);
          formData.append('sequenceNumber', item.sequenceNumber.toString());
          formData.append('startTime', item.startTime.toString());
          formData.append('endTime', item.endTime.toString());
          formData.append('duration', item.duration.toString());

          try {
            await api.post(`/recordings/${item.sessionId}/chunks`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Remove on success
            pendingQueue = await getQueue();
            pendingQueue.shift(); 
            await setQueue(pendingQueue);
            
            setRecordingStatus(prev => ({ ...prev, [type]: 'UPLOADING_CONNECTED' }));
          } catch (err) {
            console.error(`Failed to upload chunk. Queue size: ${pendingQueue.length}`, err);
            setRecordingStatus(prev => ({ ...prev, [type]: 'UPLOAD_INTERRUPTED' }));
            break; // Stop processing, wait for next attempt
          }
        }
        isUploading = false;
      };

      // Set up a retry interval
      const retryInterval = setInterval(processQueue, 5000);

      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          const chunkEndTime = Date.now();
          const seq = sequenceNumbers.current[sessionId]++;
          
          const chunkData: QueuedChunk = {
            sessionId,
            type,
            sequenceNumber: seq,
            startTime: chunkStartTime,
            endTime: chunkEndTime,
            duration: chunkEndTime - chunkStartTime,
            blob: e.data
          };

          chunkStartTime = chunkEndTime;

          const pendingQueue = await getQueue();
          if (pendingQueue.length < 50) {
            pendingQueue.push(chunkData);
          } else {
            console.error('Recording queue bounded limit reached! Dropping oldest chunks.');
            pendingQueue.shift();
            pendingQueue.push(chunkData);
          }
          await setQueue(pendingQueue);
          
          processQueue();
        }
      };

      recorder.onstop = () => clearInterval(retryInterval);

      // Generate a chunk every 10 seconds (Phase 11 implementation detail)
      recorder.start(10000); 
      return sessionId;
    } catch (err) {
      console.error(`Failed to start ${type} recording:`, err);
      setRecordingStatus(prev => ({ ...prev, [type]: 'FAILED' }));
    }
  }, [attemptId]);

  const stopRecording = useCallback(async (sessionId: string) => {
    const recorder = mediaRecorders.current[sessionId];
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      try {
        await api.post(`/recordings/${sessionId}/complete`);
        setRecordingStatus(prev => ({ ...prev, [sessionId]: 'COMPLETED' }));
      } catch (err) {
        console.error('Failed to complete recording metadata', err);
      }
    }
  }, []);

  const stopAllRecordings = useCallback(() => {
    Object.keys(mediaRecorders.current).forEach(sessionId => {
      stopRecording(sessionId);
    });
  }, [stopRecording]);

  return { startRecording, stopRecording, stopAllRecordings, recordingStatus };
};
