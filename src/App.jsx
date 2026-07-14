import React, { useState, useRef, useEffect } from 'react';

export default function App() {
  // 狀態管理
  const [text, setText] = useState('你好，這是我用 VoxCPM 克隆的專屬聲音，聽起來是不是非常自然呢？');
  const [backendUrl, setBackendUrl] = useState(() => {
    return localStorage.getItem('voxcpm_backend_url') || 'http://localhost:8000';
  });
  
  const [refAudioFile, setRefAudioFile] = useState(null);
  const [refAudioUrl, setRefAudioUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioResult, setAudioResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // 儲存後端網址至 LocalStorage
  useEffect(() => {
    localStorage.setItem('voxcpm_backend_url', backendUrl);
  }, [backendUrl]);

  // 錄音秒數計時器
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

  // 開始錄音 (直接在瀏覽器錄製 10 秒的個人聲音)
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

  // 結束錄音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // 處理上傳的音檔
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
      setErrorMsg('請輸入想要合成的文字內容！');
      return;
    }
    if (!refAudioFile) {
      setErrorMsg('請先錄製或上傳一段您的聲音樣本 (Reference Audio)！');
      return;
    }

    setLoading(true);
    setStatusMsg('正在將資料傳送至後端 Docker 容器...');
    setErrorMsg('');
    setAudioResult(null);

    const formData = new FormData();
    formData.append('text', text);
    formData.append('ref_audio', refAudioFile);

    try {
      setStatusMsg('VoxCPM 模型推理中，請稍候（這可能需要數秒）...');
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
      setErrorMsg(`連線失敗！請確認您的 Docker API 是否正常運行，且 API 網址設定正確。 (${err.message})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl w-full space-y-8">
        
        {/* 標題區 */}
        <div className="text-center">
          <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-semibold tracking-wider uppercase border border-indigo-500/20">
            VoxCPM Engine
          </span>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl bg-gradient-to-r from-teal-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
            VoxCPM 零樣本語音克隆
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            在 Docker 裡跑強大的開源語音克隆，並搭配 Vercel 前端，隨時生成您的專屬聲音。
          </p>
        </div>

        {/* 設定區卡片 */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-slate-200">API 伺服器設定</h3>
              <p className="text-xs text-slate-400">請填入您在本地或 GPU 伺服器上執行的 Docker API 網址</p>
            </div>
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="例如: http://localhost:8000"
              className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:w-80"
            />
          </div>
        </div>

        {/* 核心工作流 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* 左側：聲音克隆樣本輸入 */}
          <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/50 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 text-xs font-bold">1</span>
                <h2 className="text-xl font-bold">提供您的聲音樣本</h2>
              </div>
              <p className="text-sm text-slate-400 mb-6">
                請提供一段 5 至 15 秒清晰、無背景雜音的您本人的說話聲音。這將作為 VoxCPM 克隆音色的依據（Ref Audio）。
              </p>

              {/* 錄音或上傳切換 */}
              <div className="space-y-6">
                
                {/* 錄音按鈕組 */}
                <div className="flex flex-col items-center justify-center p-6 bg-slate-900/60 rounded-xl border border-dashed border-slate-700">
                  {isRecording ? (
                    <div className="flex flex-col items-center space-y-3">
                      <div className="relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <div className="h-12 w-12 bg-red-500 rounded-full flex items-center justify-center text-white">
                          🎤
                        </div>
                      </div>
                      <span className="text-red-400 font-semibold text-lg">錄音中... {recordingSeconds}s</span>
                      <button
                        onClick={stopRecording}
                        className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-full text-xs transition"
                      >
                        停止錄音並儲存
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startRecording}
                      disabled={loading}
                      className="flex flex-col items-center space-y-2 group focus:outline-none disabled:opacity-50"
                    >
                      <div className="h-12 w-12 bg-slate-800 group-hover:bg-indigo-600 rounded-full flex items-center justify-center text-xl border border-slate-700 transition">
                        🎙️
                      </div>
                      <span className="text-sm text-slate-300 font-medium group-hover:text-indigo-400 transition">
                        點擊這裡開始錄音
                      </span>
                    </button>
                  )}
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-700"></div>
                  <span className="flex-shrink mx-4 text-slate-500 text-xs uppercase">或</span>
                  <div className="flex-grow border-t border-slate-700"></div>
                </div>

                {/* 檔案上傳 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">上傳本地音檔 (.wav/.mp3)</span>
                  <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition">
                    選擇檔案
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={loading}
                    />
                  </label>
                </div>

              </div>
            </div>

            {/* 樣本播放預覽 */}
            {refAudioUrl && (
              <div className="mt-6 pt-6 border-t border-slate-700/50">
                <span className="text-xs text-slate-400 block mb-2">已就緒的聲音樣本：</span>
                <audio src={refAudioUrl} controls className="w-full h-8 accent-teal-500" />
              </div>
            )}
          </div>

          {/* 右側：文字輸入與生成 */}
          <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/50 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold">2</span>
                <h2 className="text-xl font-bold">要合成的文字</h2>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                請輸入想讓克隆後的聲音說出的內容：
              </p>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={loading}
                className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:opacity-50"
                placeholder="輸入要轉換為語音的繁體中文或英文內容..."
              />
            </div>

            {/* 生成觸發按鈕 */}
            <div className="mt-6">
              <button
                onClick={generateVoice}
                disabled={loading}
                className={`w-full py-3 px-6 rounded-xl text-white font-semibold flex items-center justify-center space-x-2 transition shadow-lg ${
                  loading 
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
                    <span>正在生成語音...</span>
                  </>
                ) : (
                  <>
                    <span>✨ 開始克隆我的專屬語音</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

        {/* 狀態提示與錯誤顯示 */}
        {(statusMsg || errorMsg || audioResult) && (
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/50 shadow-xl space-y-4">
            <h3 className="text-lg font-bold">生成狀態與結果</h3>
            
            {statusMsg && !errorMsg && (
              <div className="text-sm text-indigo-400 flex items-center space-x-2">
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                <span>{statusMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-400">
                ⚠️ 錯誤：{errorMsg}
              </div>
            )}

            {audioResult && (
              <div className="p-4 bg-emerald-950/20 border border-emerald-950 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-emerald-400">🎉 合成音檔生成完畢！</span>
                  <a
                    href={audioResult}
                    download="voxcpm_cloned_voice.wav"
                    className="text-xs text-indigo-400 hover:underline font-medium"
                  >
                    下載 WAV 音檔
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