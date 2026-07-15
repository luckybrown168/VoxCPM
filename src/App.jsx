import React, { useState, useRef, useEffect } from 'react';

export default function App() {
  const [text, setText] = useState('哈囉！這是我用 VoxCPM 2 產生的聲音。聽說我現在不僅會說英語，還學會了超道地的廣東話和東北話，是不是很神氣呢？');
  const [backendUrl, setBackendUrl] = useState(() => {
    return localStorage.getItem('voxcpm_backend_url') || 'http://localhost:8000';
  });
  
  const [generationType, setGenerationType] = useState('clone'); // clone (語音克隆) 或 standard (標準預設聲音)
  const [promptText, setPromptText] = useState('這是一段測試的聲音樣本。'); // 參考音檔的逐字稿
  const [dialect, setDialect] = useState('mandarin'); // 方言
  const [language, setLanguage] = useState('zh'); // 語言
  
  const [refAudioFile, setRefAudioFile] = useState(null);
  const [refAudioUrl, setRefAudioUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioResult, setAudioResult] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // 後端與模型下載狀態
  const [backendStatus, setBackendStatus] = useState({
    connected: false,
    modelStatus: 'Unknown',
    gpuAvailable: false,
    device: 'Unknown'
  });
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // 儲存後端網址
  useEffect(() => {
    localStorage.setItem('voxcpm_backend_url', backendUrl);
  }, [backendUrl]);

  // 輪詢監控後端健康與下載狀態 (每 3 秒一次)
  useEffect(() => {
    let interval;
    const checkHealth = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/health`);
        if (res.ok) {
          const data = await res.json();
          setBackendStatus({
            connected: true,
            modelStatus: data.model_status,
            gpuAvailable: data.gpu_available,
            device: data.device
          });
        }
      } catch (err) {
        setBackendStatus(prev => ({ ...prev, connected: false, modelStatus: 'Offline' }));
      }
    };

    checkHealth();
    interval = setInterval(checkHealth, 3000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  // 錄音計時器
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingSeconds(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const startRecording = async () => {
    setErrorMsg('');
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const file = new File([audioBlob], 'my_voice_sample.wav', { type: 'audio/wav' });
        setRefAudioFile(file);
        setRefAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setErrorMsg('無法啟用麥克風，請確認權限或點選「上傳音檔」方式提供。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRefAudioFile(file);
      setRefAudioUrl(URL.createObjectURL(file));
      setErrorMsg('');
    }
  };

  // 呼叫 FastAPI 後端 API 生成語音
  const generateVoice = async () => {
    if (!text.trim()) {
      setErrorMsg('請輸入想要合成的台詞內容！');
      return;
    }

    const formData = new FormData();
    formData.append('text', text);
    formData.append('dialect', dialect);
    formData.append('language', language);

    // 只有在克隆模式下才需要音檔與逐字稿
    if (generationType === 'clone') {
      if (!refAudioFile) {
        setErrorMsg('請先錄製或上傳一段您的聲音樣本！');
        return;
      }
      if (!promptText.trim()) {
        setErrorMsg('請輸入參考音檔的「逐字稿」！這對 VoxCPM 的克隆品質非常重要。');
        return;
      }
      formData.append('ref_audio', refAudioFile);
      formData.append('prompt_text', promptText);
    }

    setLoading(true);
    setStatusMsg('正在將請求傳送至後端 Docker 容器...');
    setErrorMsg('');
    setAudioResult(null);

    try {
      setStatusMsg('VoxCPM 正在進行推理中（可能需要數秒）...');
      const response = await fetch(`${backendUrl}/api/tts`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || `伺服器回應錯誤: ${response.status}`);
      }

      const blob = await response.blob();
      const generatedAudioUrl = URL.createObjectURL(blob);
      setAudioResult(generatedAudioUrl);
      setStatusMsg('語音合成成功！');
    } catch (err) {
      console.error(err);
      setErrorMsg(`生成失敗: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl w-full space-y-6">
        
        {/* 標題區 */}
        <div className="text-center">
          <span className="px-3 py-1 bg-gradient-to-r from-teal-500/10 to-indigo-500/10 text-teal-400 rounded-full text-xs font-semibold border border-teal-500/20 uppercase tracking-widest">
            VoxCPM 2.0 Engine 🚀
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl bg-gradient-to-r from-teal-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            VoxCPM 2.0 語音複刻
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            支援 30 國語言、9 大方言，完美複刻您的聲音與語氣。
          </p>
        </div>

        {/* 狀態監控面板 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 shadow-xl">
          <div className="space-y-2">
            <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">API 伺服器網址</span>
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div className="flex flex-col justify-center space-y-2 pt-2 md:pt-0">
            <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">當前服務狀態</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-700/30">
                <span className="text-slate-500">連線: </span>
                <span className={backendStatus.connected ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {backendStatus.connected ? "● 線上" : "○ 離線"}
                </span>
              </div>
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-700/30">
                <span className="text-slate-500">模型: </span>
                <span className="text-teal-400 font-bold block truncate">
                  {backendStatus.modelStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 參數設定區 */}
        <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50 shadow-xl space-y-4">
          <h2 className="text-lg font-bold flex items-center space-x-2 text-teal-400">
            <span>⚙️</span> <span>VoxCPM 2 多元語音配置</span>
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold">生成模式</label>
              <select
                value={generationType}
                onChange={(e) => setGenerationType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
              >
                <option value="clone">🎙️ 零樣本聲音複製 (克隆音色)</option>
                <option value="standard">🤖 標準 TTS (無需上傳音檔)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold">目標說出方言</label>
              <select
                value={dialect}
                onChange={(e) => setDialect(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
              >
                <option value="mandarin">國語 (普通話)</option>
                <option value="cantonese">廣東話 (粵語)</option>
                <option value="sichuanese">四川話</option>
                <option value="northeastern">東北話</option>
                <option value="southern_min">閩南話 (台語)</option>
                <option value="shanghainese">吳語 (上海話)</option>
                <option value="henan">河南話</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold">輸出語言 (30國)</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
              >
                <option value="zh">中文 (Chinese)</option>
                <option value="en">英文 (English)</option>
                <option value="ja">日語 (Japanese)</option>
                <option value="ko">韓語 (Korean)</option>
                <option value="th">泰語 (Thai)</option>
                <option value="vi">越南語 (Vietnamese)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 核心工作流 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* 左側：音色來源輸入 */}
          <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/50 shadow-xl flex flex-col justify-between">
            {generationType === 'clone' ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 text-xs font-bold">1</span>
                    <h2 className="text-xl font-bold">聲音樣本與逐字稿</h2>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    為確保品質，請提供一段清晰的聲音，並**務必輸入這段聲音裡說出的文字 (逐字稿)**。
                  </p>

                  <div className="flex flex-col items-center justify-center p-4 bg-slate-900/60 rounded-xl border border-dashed border-slate-700">
                    {isRecording ? (
                      <div className="flex flex-col items-center space-y-3">
                        <div className="relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <div className="h-12 w-12 bg-red-500 rounded-full flex items-center justify-center text-white">🎤</div>
                        </div>
                        <span className="text-red-400 font-semibold text-lg">{recordingSeconds} 秒</span>
                        <button onClick={stopRecording} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-full text-xs transition">停止並保存</button>
                      </div>
                    ) : (
                      <button onClick={startRecording} disabled={loading} className="flex flex-col items-center space-y-2 group focus:outline-none">
                        <div className="h-10 w-10 bg-slate-800 group-hover:bg-indigo-600 rounded-full flex items-center justify-center text-xl border border-slate-700 transition">🎙️</div>
                        <span className="text-sm text-slate-300 font-medium group-hover:text-indigo-400 transition">點擊此處開始錄音</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs mt-2">
                    <span className="text-slate-400">或上傳本地音檔：</span>
                    <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition">
                      選擇檔案
                      <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" disabled={loading} />
                    </label>
                  </div>
                  
                  {refAudioUrl && (
                    <div className="mt-3">
                      <audio src={refAudioUrl} controls className="w-full h-8 accent-teal-500" />
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-700/50 pt-4">
                  <label className="text-sm font-semibold text-slate-300 block mb-2">聲音樣本的逐字稿 <span className="text-red-400">*</span></label>
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    disabled={loading}
                    className="w-full h-20 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    placeholder="請輸入聲音樣本所說出的確切文字內容..."
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center text-3xl border border-slate-700">🤖</div>
                <h3 className="text-lg font-bold text-slate-200">標準模式</h3>
                <p className="text-sm text-slate-400">
                  在此模式下不需上傳您的聲音。系統將使用 VoxCPM 內建的高品質預設聲線為您朗讀台詞。
                </p>
              </div>
            )}
          </div>

          {/* 右側：要合成的文字 */}
          <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/50 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold">2</span>
                <h2 className="text-xl font-bold">要合成的台詞內容</h2>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={loading}
                className="w-full h-48 bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="輸入要轉換為語音的文字內容..."
              />
            </div>

            <div className="mt-6">
              <button
                onClick={generateVoice}
                disabled={loading || !backendStatus.connected}
                className={`w-full py-3 px-6 rounded-xl text-white font-semibold flex items-center justify-center space-x-2 transition shadow-lg ${
                  loading || !backendStatus.connected
                    ? 'bg-slate-700 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 active:scale-[0.98]'
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>正在生成高品質音訊...</span>
                  </>
                ) : (
                  <span>✨ 點擊合成語音</span>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* 狀態提示與結果區 */}
        {(statusMsg || errorMsg || audioResult) && (
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/50 shadow-xl space-y-4 animate-fade-in">
            <h3 className="text-md font-bold text-slate-300">生成狀態與播放結果</h3>
            
            {statusMsg && !errorMsg && (
              <div className="text-sm text-indigo-400 flex items-center space-x-2">
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                <span>{statusMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-400">
                ⚠️ 失敗：{errorMsg}
              </div>
            )}

            {audioResult && (
              <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-emerald-400">🎉 語音生成完畢！</span>
                  <a href={audioResult} download="voxcpm_voice.wav" className="text-xs text-indigo-400 hover:underline font-medium">
                    下載 WAV 語音
                  </a>
                </div>
                <audio src={audioResult} controls className="w-full h-10 accent-emerald-500" autoPlay />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}