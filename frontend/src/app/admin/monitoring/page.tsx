'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import io from 'socket.io-client';
import { Shield, ShieldAlert, Monitor, VideoOff, CheckCircle2, AlertTriangle, MessageSquare, PauseCircle, XCircle, LogOut, FileText } from 'lucide-react';
import api from '@/lib/api';

interface CandidateState {
  id: string;
  name: string;
  exam?: string;
  status: 'ONLINE' | 'OFFLINE';
  camera: 'STARTED' | 'STOPPED';
  screen: 'STARTED' | 'STOPPED';
  violations: { severity: string; type: string; timestamp: string }[];
  riskScore: number;
  attemptId?: string;
}

interface LiveCandidateEntry {
  candidateId: string;
  name: string;
  examName: string;
  status: 'ONLINE' | 'OFFLINE';
  camera: 'STARTED' | 'STOPPED';
  screen: 'STARTED' | 'STOPPED';
  riskScore: number;
  violations: { severity: string; type: string; timestamp: string }[];
  attemptId: string;
}

export default function LiveMonitoringPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Record<string, CandidateState>>({});

  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateState | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);
  const peerConnectionRef = React.useRef<RTCPeerConnection | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  useEffect(() => {
    // Fetch real live attempts from DB
    api.get('/admin/live').then(res => {
      const liveData: Record<string, CandidateState> = {};
      res.data.candidates.forEach((cand: LiveCandidateEntry) => {
        liveData[cand.candidateId] = {
          id: cand.candidateId,
          name: cand.name,
          exam: cand.examName,
          status: cand.status,
          camera: cand.camera,
          screen: cand.screen,
          riskScore: cand.riskScore,
          violations: cand.violations,
          attemptId: cand.attemptId
        };
      });
      setCandidates(liveData);
    }).catch(err => {
      console.error('Failed fetching live attempts', err);
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        router.push('/login?error=unauthorized');
      }
    });

    const initSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000', {
      auth: { token: localStorage.getItem('token') }
    });

    initSocket.on('candidate:status_update', (data) => {
      setCandidates(prev => ({
        ...prev,
        [data.candidateId]: { ...prev[data.candidateId], status: data.status }
      }));
    });

    initSocket.on('candidate:camera_status', (data) => {
      setCandidates(prev => ({
        ...prev,
        [data.candidateId]: { ...prev[data.candidateId], camera: data.status }
      }));
    });

    initSocket.on('violation:alert', (data) => {
      setCandidates(prev => {
        const cand = prev[data.candidateId];
        if (!cand) return prev;
        
        let newRisk = cand.riskScore;
        if (data.violation.severity === 'CRITICAL') newRisk += 40;
        else if (data.violation.severity === 'HIGH') newRisk += 20;
        else newRisk += 5;

        return {
          ...prev,
          [data.candidateId]: { 
            ...cand, 
            riskScore: Math.min(100, newRisk),
            violations: [data.violation, ...cand.violations] 
          }
        };
      });
    });

    initSocket.on('webrtc:answer', async (data) => {
      if (peerConnectionRef.current && data.adminId === initSocket.id) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    initSocket.on('webrtc:ice-candidate', async (data) => {
      if (peerConnectionRef.current && data.candidate && 
          (data.sourceId === selectedCandidate?.id || data.sourceId === selectedCandidate?.attemptId || data.candidateId === selectedCandidate?.id || data.candidateId === selectedCandidate?.attemptId)) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    // Defer to avoid setState-in-effect lint error
    setTimeout(() => setSocket(initSocket), 0);

    return () => {
      initSocket.disconnect();
      if (peerConnectionRef.current) peerConnectionRef.current.close();
    };
  }, [selectedCandidate]);

  const requestLiveStream = async (candidateId: string) => {
    if (!socket) return;
    setIsStreaming(true);

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:ice-candidate', {
          target: 'CANDIDATE',
          targetId: candidateId,
          candidate: event.candidate,
          sourceId: socket.id
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnectionRef.current = pc;

    const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);

    socket.emit('webrtc:offer', {
      candidateId,
      offer,
      adminId: socket.id
    });
  };

  const sendCommand = (candidateId: string, action: string, message?: string) => {
    if (socket) {
      socket.emit('admin:command', { candidateId, action, message });
      alert(`Command ${action} sent to candidate`);
    }
  };



  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-600 bg-red-100';
    if (score >= 40) return 'text-amber-600 bg-amber-100';
    return 'text-green-600 bg-green-100';
  };

  const handleApiCommand = async (candidateId: string, action: string, attemptId?: string) => {
    if (!attemptId) return;
    try {
      if (action === 'LOCK') await api.post(`/admin/live/${attemptId}/lock`);
      if (action === 'UNLOCK') await api.post(`/admin/live/${attemptId}/unlock`);
      if (action === 'FORCE_SUBMIT') await api.post(`/admin/live/${attemptId}/force-submit`);
      
      // Also emit via socket for immediate candidate UI reaction
      if (socket) {
        socket.emit('admin:command', { candidateId, action, message: `Exam ${action}` });
      }
      alert(`Action ${action} executed successfully`);
    } catch (err) {
      console.error(err);
      alert('Failed to execute command');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-300 flex font-sans selection:bg-blue-500/30">
      {/* Sidebar */}
      <div className="w-64 bg-[#0f172a]/80 backdrop-blur-xl border-r border-slate-800 flex flex-col hidden md:flex shadow-2xl z-10 relative">
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800/50">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-extrabold text-white tracking-tight">ProctorGuard AI</span>
        </div>
        <div className="p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Operations</p>
            <div className="bg-blue-600/10 text-blue-400 px-4 py-3 rounded-xl font-semibold cursor-pointer border border-blue-500/20 flex items-center transition-all shadow-[0_0_15px_rgba(37,99,235,0.1)]">
              <Monitor className="w-5 h-5 mr-3" /> Live Monitoring
            </div>
            <div onClick={() => router.push('/admin/exams')} className="text-slate-400 px-4 py-3 rounded-xl font-medium hover:bg-slate-800/50 hover:text-slate-200 cursor-pointer transition-all flex items-center">
              <FileText className="w-5 h-5 mr-3" /> Exam Management
            </div>
            <div className="text-slate-400 px-4 py-3 rounded-xl font-medium hover:bg-slate-800/50 hover:text-slate-200 cursor-pointer transition-all flex items-center">
              <AlertTriangle className="w-5 h-5 mr-3" /> Violation Queue
            </div>
            <div className="text-slate-400 px-4 py-3 rounded-xl font-medium hover:bg-slate-800/50 hover:text-slate-200 cursor-pointer transition-all flex items-center">
              <CheckCircle2 className="w-5 h-5 mr-3" /> Integrity Reports
            </div>
        </div>
        <div className="mt-auto p-6 border-t border-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <span className="text-sm font-bold text-slate-300">AD</span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Admin User</p>
                <p className="text-xs text-slate-500">Security Officer</p>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Sign Out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background Ambient Lights */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[120px] rounded-full pointer-events-none" />

        <header className="bg-[#0f172a]/60 backdrop-blur-md border-b border-slate-800/60 p-5 flex justify-between items-center px-8 z-10 sticky top-0">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Live Examination Grid</h1>
            <p className="text-sm text-slate-400 mt-1 font-medium">Real-time behavior analysis and remote proctoring</p>
          </div>
          <div className="flex space-x-4">
            <div className="flex items-center text-sm font-bold text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
              <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></span> 
              Active Sessions: {Object.values(candidates).filter(c => c.status === 'ONLINE').length}
            </div>
            <div className="flex items-center text-sm font-bold text-red-400 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span> 
              Critical Risk: {Object.values(candidates).filter(c => c.riskScore >= 70).length}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto z-10 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Object.values(candidates).map(candidate => (
              <div 
                key={candidate.id} 
                onClick={() => setSelectedCandidate(candidate)}
                className={`bg-[#131c31]/80 backdrop-blur-sm rounded-2xl border-2 cursor-pointer transition-all duration-300 group hover:-translate-y-1 ${
                  candidate.riskScore >= 70 
                    ? 'border-red-500/50 shadow-[0_8px_30px_rgba(239,68,68,0.15)]' 
                    : 'border-slate-800 hover:border-blue-500/50 hover:shadow-[0_8px_30px_rgba(37,99,235,0.1)]'
                }`}
              >
                {/* Mock Camera Feed Area */}
                <div className="aspect-video bg-slate-900 rounded-t-xl relative overflow-hidden">
                  {candidate.camera === 'STARTED' ? (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#131c31] to-transparent z-10 opacity-60" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        {/* Simulation of a face tracking box */}
                        <div className="w-32 h-32 border border-emerald-500/30 rounded-lg absolute flex items-center justify-center group-hover:border-emerald-400/60 transition-colors">
                          <div className="w-full h-[1px] bg-emerald-500/20 absolute top-1/2 animate-scan" />
                        </div>
                        <span className="text-slate-600 font-medium z-0">[Encrypted Stream Active]</span>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 bg-slate-900">
                      <VideoOff className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Feed Offline</span>
                    </div>
                  )}
                  
                  {/* Status Badges Overlay */}
                  <div className="absolute top-3 left-3 z-20 flex space-x-2">
                    <div className={`w-3 h-3 rounded-full ${candidate.status === 'ONLINE' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-slate-600'}`}></div>
                  </div>

                  <div className="absolute top-3 right-3 z-20">
                    <div className={`px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider backdrop-blur-md shadow-lg flex items-center border ${
                      candidate.riskScore >= 70 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      candidate.riskScore >= 40 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}>
                      Risk Score: {candidate.riskScore}
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-4">
                    <h3 className="font-bold text-white text-lg truncate group-hover:text-blue-400 transition-colors">{candidate.name}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-1 flex items-center">
                      <ShieldAlert className="w-3 h-3 mr-1 opacity-70" /> {candidate.id.substring(0, 12)}...
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className={`px-2.5 py-1.5 rounded-lg flex items-center border ${candidate.camera === 'STARTED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      <VideoOff className="w-3.5 h-3.5 mr-1.5" /> Cam
                    </span>
                    <span className={`px-2.5 py-1.5 rounded-lg flex items-center border ${candidate.screen === 'STARTED' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      <Monitor className="w-3.5 h-3.5 mr-1.5" /> Screen
                    </span>
                    <span className={`px-2.5 py-1.5 rounded-lg flex items-center border ${candidate.violations.length > 0 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> {candidate.violations.length} Flags
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {Object.keys(candidates).length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-500">
                <ShieldAlert className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-xl font-bold text-slate-400">No Active Sessions</h3>
                <p className="text-sm mt-2">Candidates currently engaged in examinations will appear here.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Detail Panel - Sliding Glassmorphic Overlay */}
      {selectedCandidate && (
        <>
          <div className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSelectedCandidate(null)} />
          <div className="fixed lg:relative right-0 top-0 bottom-0 w-full max-w-md bg-[#131c31]/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl flex flex-col z-50 transform transition-transform duration-300">
            
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#0f172a]/80">
              <div>
                <h2 className="font-extrabold text-xl text-white">{selectedCandidate.name}</h2>
                <div className="flex items-center mt-1 space-x-2">
                  <div className={`w-2 h-2 rounded-full ${selectedCandidate.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                  <span className="text-xs font-semibold text-slate-400">{selectedCandidate.status}</span>
                </div>
              </div>
              <button onClick={() => setSelectedCandidate(null)} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-full">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col space-y-6 flex-1 overflow-y-auto custom-scrollbar">
              
              {/* Primary Video Action */}
              <button 
                onClick={() => requestLiveStream(selectedCandidate.id)}
                disabled={isStreaming}
                className="w-full relative overflow-hidden group flex items-center justify-center p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transition-all font-bold disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <Monitor className="w-5 h-5 mr-2 relative z-10" /> 
                <span className="relative z-10">{isStreaming ? 'Establishing Secure Tunnel...' : 'Initialize Live Surveillance'}</span>
              </button>

              {isStreaming && (
                <div className="aspect-video bg-black rounded-xl overflow-hidden relative shadow-2xl border border-slate-700">
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                  <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse">LIVE INCIDENT FEED</div>
                  
                  {/* Fake UI Overlay for high-end look */}
                  <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center text-[10px] text-white/70 font-mono">
                    <span>CH-01 // WEBRTC</span>
                    <span>REC_ACTV // 00:00:00</span>
                  </div>
                </div>
              )}

              {/* Control Deck */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Tactical Controls</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => router.push(`/admin/evidence/${selectedCandidate.attemptId}`)}
                    className="flex flex-col items-center justify-center p-4 bg-slate-800/50 text-blue-400 rounded-xl border border-blue-500/20 hover:bg-blue-500/10 transition-colors"
                  >
                    <MessageSquare className="w-5 h-5 mb-2" />
                    <span className="text-xs font-bold">Evidence Vault</span>
                  </button>
                  <button 
                    onClick={() => sendCommand(selectedCandidate.id, 'PAUSE', 'Exam paused for security review.')}
                    className="flex flex-col items-center justify-center p-4 bg-slate-800/50 text-amber-400 rounded-xl border border-amber-500/20 hover:bg-amber-500/10 transition-colors"
                  >
                    <PauseCircle className="w-5 h-5 mb-2" />
                    <span className="text-xs font-bold">Halt Session</span>
                  </button>
                  <button 
                    onClick={() => sendCommand(selectedCandidate.id, 'RESUME', 'Exam resumed')}
                    className="flex flex-col items-center justify-center p-4 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5 mb-2" />
                    <span className="text-xs font-bold">
                      Resume Session
                    </span>
                  </button>
                  <button 
                    onClick={() => handleApiCommand(selectedCandidate.id, 'LOCK', selectedCandidate.attemptId ?? '')}
                    className="flex flex-col items-center justify-center p-4 bg-slate-800/50 text-slate-300 rounded-xl border border-slate-600 hover:bg-slate-700 transition-colors"
                  >
                    <ShieldAlert className="w-5 h-5 mb-2" />
                    <span className="text-xs font-bold">Lock Console</span>
                  </button>
                  <button 
                    onClick={() => handleApiCommand(selectedCandidate.id, 'UNLOCK', selectedCandidate.attemptId ?? '')}
                    className="flex flex-col items-center justify-center p-4 bg-slate-800/50 text-slate-300 rounded-xl border border-slate-600 hover:bg-slate-700 transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5 mb-2" />
                    <span className="text-xs font-bold">Unlock Console</span>
                  </button>
                  
                  <button 
                    onClick={() => sendCommand(selectedCandidate.id, 'TERMINATE', 'Exam terminated due to severe policy violations.')}
                    className="col-span-2 flex items-center justify-center p-4 bg-red-500/10 text-red-400 rounded-xl border border-red-500/30 hover:bg-red-500/20 transition-all hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                  >
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    <span className="text-sm font-bold tracking-wide">EMERGENCY TERMINATE</span>
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div className="flex-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Violation Telemetry</h3>
                {selectedCandidate.violations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 bg-slate-800/30 rounded-xl border border-slate-800 border-dashed">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mb-2" />
                    <p className="text-slate-400 text-xs font-medium">Session integrity nominal.</p>
                  </div>
                ) : (
                  <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
                    {selectedCandidate.violations.map((v, i) => (
                      <div key={i} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active`}>
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#131c31] bg-slate-800 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${
                          v.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border-red-900/50' : 
                          v.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border-amber-900/50' : ''
                        }`}>
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border shadow-sm ${
                          v.severity === 'CRITICAL' ? 'bg-red-500/5 border-red-500/20' : 
                          v.severity === 'HIGH' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-slate-800/50 border-slate-700'
                        }`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className={`font-bold text-sm ${v.severity === 'CRITICAL' ? 'text-red-400' : v.severity === 'HIGH' ? 'text-amber-400' : 'text-slate-300'}`}>{v.type}</span>
                          </div>
                          <div className="text-slate-500 text-xs font-mono mb-2">{new Date(v.timestamp).toLocaleTimeString()}</div>
                          <div className="text-slate-400 text-xs">Source: <span className="text-slate-300 font-semibold">AI Detection</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
