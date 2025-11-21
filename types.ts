export interface PttComment {
  type: '推' | '噓' | '→';
  user: string;
  content: string;
  time: string;
  id: string; // Generated unique ID
}

export interface PttPost {
  title: string;
  author: string;
  date: string;
  url: string;
  mainContent: string;
  comments: PttComment[];
  stats: {
    push: number;
    boo: number;
    arrow: number;
    total: number;
  };
}

export interface AiAnalysisResult {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  keyPoints: string[];
}
