import React, { useState, useRef } from 'react';
import { Search, Download, MessageSquare, ThumbsUp, ThumbsDown, Minus, Loader2, BrainCircuit, Key, Sparkles, AlertCircle, FileText } from 'lucide-react';
import { fetchAndParsePtt, exportToCsv } from './services/pttService';
import { analyzeComments } from './services/geminiService';
import { PttPost, AiAnalysisResult } from './types';
import StatsChart from './components/StatsChart';

const App: React.FC = () => {
  const [inputContent, setInputContent] = useState('');
  const [apiKey, setApiKey] = useState(process.env.API_KEY || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [data, setData] = useState<PttPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [filterType, setFilterType] = useState<'all' | '推' | '噓' | '→'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // AI Result
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const filteredComments = data?.comments.filter(c => {
    const matchesType = filterType === 'all' || c.type === filterType;
    // Search Logic: Only match User ID (Case insensitive)
    const matchesSearch = c.user.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  }) || [];

  // Only flag as Gmail URL if it's short (likely just the link) and contains the domain.
  // If it's long, user likely pasted content.
  const isGmailLinkOnly = inputContent.includes('mail.google.com') && inputContent.length < 200 && !inputContent.includes('\n');

  const handleParse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputContent) return;
    
    if (isGmailLinkOnly) {
        setError("偵測到 Gmail 網址。基於隱私安全，無法直接讀取。請在 Gmail 頁面按 Ctrl+A 全選內容，Ctrl+C 複製，然後貼到上方的輸入框中即可解析。");
        return;
    }

    setLoading(true);
    setError(null);
    setData(null);
    setAiResult(null);

    try {
      const result = await fetchAndParsePtt(inputContent);
      setData(result);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      setError(err.message || '發生未知錯誤');
    } finally {
      setLoading(false);
    }
  };

  const loadExample = () => {
    const exampleUrl = 'https://www.ptt.cc/bbs/Stock/M.1763685004.A.D8F.html';
    setInputContent(exampleUrl);
  };

  const handleAiAnalysis = async () => {
    if (!data) return;
    if (!apiKey) {
      setShowApiKeyInput(true);
      return;
    }
    
    setAnalyzing(true);
    try {
      const result = await analyzeComments(data, apiKey);
      setAiResult(result);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExport = () => {
    if (data) {
      exportToCsv({
        ...data,
        comments: filteredComments
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">PTT Stock 鄉民分析器</h1>
          </div>
          <div className="flex items-center gap-2">
             <button 
               onClick={() => setShowApiKeyInput(!showApiKeyInput)}
               className="text-sm text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1 px-3 py-2 rounded-md hover:bg-slate-900"
             >
               <Key size={16} />
               {apiKey ? '已設定 API Key' : '設定 API Key'}
             </button>
          </div>
        </header>

        {/* API Key Input */}
        {showApiKeyInput && (
          <div className="bg-slate-900 border border-blue-900/50 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
            <label className="block text-sm font-medium text-blue-300 mb-2">Google Gemini API Key (用於 AI 分析)</label>
            <div className="flex gap-2">
                <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="貼上您的 Gemini API Key"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
                <button 
                    onClick={() => setShowApiKeyInput(false)}
                    className="bg-slate-800 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-700"
                >
                    隱藏
                </button>
            </div>
          </div>
        )}

        {/* Input Section */}
        <section className="bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-800 shadow-xl shadow-black/20">
          <form onSubmit={handleParse} className="space-y-4">
            <div className="flex justify-between items-center">
                <label className="block text-lg font-medium text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400"/>
                    輸入 PTT 網址 或 直接貼上內容
                </label>
                <button 
                    type="button"
                    onClick={loadExample}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                    <Sparkles size={12} />
                    帶入範例網址
                </button>
            </div>
            
            <div className="relative">
                <div className="absolute top-3 left-3 pointer-events-none">
                  {inputContent.startsWith('http') ? <Search className="h-5 w-5 text-slate-400" /> : <FileText className="h-5 w-5 text-slate-400" />}
                </div>
                <textarea
                  required
                  placeholder={isGmailLinkOnly 
                    ? "請將 Gmail 裡的文字內容複製，並貼在這裡..." 
                    : "在此貼上 PTT 網址 (https://www.ptt.cc/...) \n或者直接貼上文章的所有文字內容 (包含作者、標題、推文)"}
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 bg-slate-950 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px] ${
                    isGmailLinkOnly ? 'border-yellow-500/50 ring-2 ring-yellow-500/20' : 'border-slate-700'
                  }`}
                />
            </div>

            {isGmailLinkOnly && (
                <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg text-yellow-200 text-sm animate-in fade-in">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <div>
                        <p className="font-bold">偵測到 Gmail 連結</p>
                        <p>請回到 Gmail 頁面，按下 <b>Ctrl+A (全選)</b>，然後 <b>Ctrl+C (複製)</b>，再回到這裡將內容<b>貼上</b>即可。</p>
                    </div>
                </div>
            )}

            <button
              type="submit"
              disabled={loading || isGmailLinkOnly}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : '開始解析'}
            </button>

            {error && (
              <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-lg text-red-400 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <span>⚠️</span> {error}
              </div>
            )}
          </form>
        </section>

        {/* Results Section */}
        {data && (
          <div ref={resultsRef} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Meta Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-lg">
                <h2 className="text-2xl font-bold text-white mb-2 line-clamp-2">{data.title}</h2>
                <div className="flex flex-wrap gap-4 text-sm text-slate-400 mb-6">
                  <span className="bg-slate-800 px-2 py-1 rounded">作者: {data.author}</span>
                  <span className="bg-slate-800 px-2 py-1 rounded">時間: {data.date}</span>
                  {data.url.startsWith('http') && (
                    <a href={data.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                        開啟原始網頁
                    </a>
                  )}
                </div>
                
                {/* Stats Bar */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                  <div className="bg-slate-950 p-3 rounded-lg text-center border border-slate-800">
                    <div className="text-xs text-slate-500 mb-1">總推文</div>
                    <div className="text-xl font-bold text-white">{data.stats.total}</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg text-center border border-green-900/30">
                    <div className="text-xs text-green-500/80 mb-1">推</div>
                    <div className="text-xl font-bold text-green-500">{data.stats.push}</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg text-center border border-red-900/30">
                    <div className="text-xs text-red-500/80 mb-1">噓</div>
                    <div className="text-xl font-bold text-red-500">{data.stats.boo}</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg text-center border border-slate-800">
                    <div className="text-xs text-slate-500 mb-1">→</div>
                    <div className="text-xl font-bold text-slate-400">{data.stats.arrow}</div>
                  </div>
                </div>

                {/* AI Analysis Button/Area */}
                <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 rounded-xl p-1 border border-indigo-500/30">
                  {!aiResult ? (
                     <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-indigo-500/20 p-2 rounded-lg">
                             <BrainCircuit className="text-indigo-400 w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-indigo-100">AI 鄉民風向分析</h3>
                            <p className="text-xs text-indigo-300/70">使用 Gemini 分析多空情緒與重點摘要</p>
                          </div>
                        </div>
                        <button 
                          onClick={handleAiAnalysis}
                          disabled={analyzing}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 min-w-[140px] justify-center"
                        >
                          {analyzing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>分析中...</span>
                            </>
                          ) : '生成分析'}
                        </button>
                     </div>
                  ) : (
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-indigo-200 flex items-center gap-2">
                           <BrainCircuit className="w-5 h-5" /> AI 分析報告
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          aiResult.sentiment === 'bullish' ? 'bg-green-900/50 text-green-300 border border-green-700/50' :
                          aiResult.sentiment === 'bearish' ? 'bg-red-900/50 text-red-300 border border-red-700/50' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {aiResult.sentiment === 'bullish' ? '看多 📈' : aiResult.sentiment === 'bearish' ? '看空 📉' : '中立/觀望 😐'}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed mb-4 border-l-2 border-indigo-500 pl-3">
                        {aiResult.summary}
                      </p>
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase">討論重點</h4>
                        <ul className="space-y-1">
                          {aiResult.keyPoints.map((point, idx) => (
                            <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                              <span className="text-indigo-400 mt-1">•</span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart Card */}
              <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-lg flex flex-col justify-center">
                <h3 className="text-center text-slate-400 font-medium mb-4">情緒分佈</h3>
                <StatsChart stats={data.stats} />
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
               <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
                  <button 
                    onClick={() => setFilterType('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    全部 ({data.stats.total})
                  </button>
                  <button 
                    onClick={() => setFilterType('推')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filterType === '推' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    推 ({data.stats.push})
                  </button>
                  <button 
                    onClick={() => setFilterType('噓')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filterType === '噓' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    噓 ({data.stats.boo})
                  </button>
                  <button 
                    onClick={() => setFilterType('→')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filterType === '→' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    → ({data.stats.arrow})
                  </button>
               </div>

               <div className="flex items-center gap-3 w-full sm:w-auto">
                 <input 
                    type="text" 
                    placeholder="搜尋使用者 ID..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white w-full sm:w-48 outline-none focus:border-blue-500"
                 />
                 <button 
                   onClick={handleExport}
                   className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-lg transition-colors border border-slate-700 flex items-center gap-2 text-sm font-medium"
                   title="匯出 CSV"
                 >
                   <Download className="w-4 h-4" />
                   <span className="hidden sm:inline">匯出</span>
                 </button>
               </div>
            </div>

            {/* List */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
              {filteredComments.length === 0 ? (
                 <div className="p-12 text-center text-slate-500">
                   {data.stats.total > 0 
                     ? '沒有找到符合條件的推文' 
                     : '找不到推文，請確認貼上的內容格式是否正確 (包含完整標頭與推文區塊)'}
                 </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-sm">
                        <th className="p-4 w-16 text-center">推噓</th>
                        <th className="p-4 w-32">使用者</th>
                        <th className="p-4">內容</th>
                        <th className="p-4 w-32 hidden sm:table-cell text-right">時間</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredComments.map((comment) => (
                        <tr key={comment.id} className="hover:bg-slate-800/50 transition-colors group">
                          <td className="p-4 text-center">
                            <span className={`inline-block w-8 text-center font-bold ${
                              comment.type === '推' ? 'text-green-500' :
                              comment.type === '噓' ? 'text-red-500' :
                              'text-slate-500'
                            }`}>
                              {comment.type === '推' ? <ThumbsUp size={18} className="mx-auto"/> :
                               comment.type === '噓' ? <ThumbsDown size={18} className="mx-auto"/> :
                               <Minus size={18} className="mx-auto"/>}
                            </span>
                          </td>
                          <td className="p-4 text-yellow-500 font-mono text-sm whitespace-nowrap">{comment.user}</td>
                          <td className="p-4 text-slate-200 text-base md:text-lg leading-relaxed min-w-[200px]">
                            {comment.content}
                          </td>
                          <td className="p-4 text-slate-500 text-sm text-right hidden sm:table-cell font-mono whitespace-nowrap">
                            {comment.time}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default App;