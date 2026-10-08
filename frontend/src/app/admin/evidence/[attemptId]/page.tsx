'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Shield, FileVideo, Camera, ArrowLeft } from 'lucide-react';

function EvidenceContent() {
  const { attemptId } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [chunks, setChunks] = useState<{ fileUrl: string; chunkIndex: number; createdAt: string }[]>([]);
  const [snapshots, setSnapshots] = useState<{ fileUrl: string; severity: string; description: string }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // In a real app we'd fetch both chunks and snapshots.
    // For Phase 11, we fetch playback chunks from the API.
    const fetchEvidence = async () => {
      try {
        const attemptsReq = await api.get('/admin/live'); // Get recording sessions
        // For Phase 11 MVP, we query the exact playback endpoint directly
        // Assuming attemptId points to a recording session ID directly for now, or we'd resolve it
        const res = await api.get(`/recordings/${attemptId}/playback`);
        setChunks(res.data.chunks || []);
        setLoading(false);
      } catch (err) {
        setError('Failed to load evidence or no recordings found.');
        setLoading(false);
      }
    };
    fetchEvidence();
  }, [attemptId]);

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center text-blue-600 mb-6 font-bold hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Monitoring
        </button>

        <h1 className="text-3xl font-black text-slate-800 mb-8 flex items-center">
          <Shield className="w-8 h-8 mr-3 text-purple-600" /> Evidence Review
        </h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg font-bold mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-bold text-slate-700 flex items-center">
              <FileVideo className="w-5 h-5 mr-2" /> Video Recordings
            </h2>
          </div>
          <div className="p-6">
            {chunks.length === 0 ? (
              <p className="text-slate-500 italic">No video chunks available yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chunks.map((c, i) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-slate-200">
                    <div className="bg-slate-800 text-slate-300 text-xs p-2 flex justify-between">
                      <span>Chunk #{c.chunkIndex}</span>
                      <span>{new Date(c.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <video controls src={c.fileUrl} className="w-full aspect-video bg-black" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EvidencePage() {
  return (
    <Suspense fallback={<div className="p-10 font-bold">Loading...</div>}>
      <EvidenceContent />
    </Suspense>
  );
}
