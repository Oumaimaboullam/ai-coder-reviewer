// Types pour l'application AI Code Reviewer

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isPremium: boolean;
  creditsRemaining: number;
  premiumEndDate?: string;
  preferences?: {
    emailNotifications: boolean;
    darkMode: boolean;
    language: string;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: User;
  tokens: TokenPair;
}

export interface CodeError {
  id: string;
  type: 'SYNTAX_ERROR' | 'LOGIC_ERROR' | 'SECURITY' | 'PERFORMANCE' | 'STYLE' | 'BEST_PRACTICE';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  line: number;
  column?: number;
  description: string;
  fix?: string;
  codeSnippet?: string;
}

export interface CodeSuggestion {
  id: string;
  type: 'OPTIMIZATION' | 'READABILITY' | 'MODERNIZATION' | 'REFACTORING' | 'DOCUMENTATION';
  description: string;
  impact?: string;
  beforeCode?: string;
  afterCode?: string;
  explanation?: string;
}

export interface SecurityIssue {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  line?: number;
  recommendation?: string;
}

export interface AnalysisResult {
  score: number;
  scoreBreakdown: {
    quality: number;
    security: number;
    performance: number;
    readability: number;
  };
  errors: CodeError[];
  warnings: CodeError[];
  suggestions: CodeSuggestion[];
  securityIssues: SecurityIssue[];
  summary: string;
  correctedCode: string;
  eli5?: string;
  fullScore?: number;
  businessLogicIssues?: any[];
}

export interface Analysis {
  _id: string;
  userId: string;
  code: string;
  language: string;
  fileName?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: AnalysisResult;
  executionTime?: number;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
  creditsUsed: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisSummary {
  id: string;
  language: string;
  fileName?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  score?: number;
  errorsCount: number;
  warningsCount: number;
  createdAt: string;
  executionTime?: number;
}

export interface UserStats {
  totalAnalyses: number;
  averageScore: number;
  totalErrors: number;
  totalWarnings: number;
  languages: string[];
  languageDistribution: { language: string; count: number }[];
  recentAnalyses: number;
  creditsRemaining: number;
  isPremium: boolean;
}

export interface Subscription {
  hasSubscription: boolean;
  plan: 'free' | 'monthly' | 'annual' | 'lifetime';
  status?: 'active' | 'cancelled' | 'past_due';
  isActive?: boolean;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  renewalDate?: string;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string;
}

export interface Language {
  id: string;
  name: string;
  extension: string;
  icon: string;
}

export interface Invoice {
  id: string;
  amount: number;
  status: string;
  paidAt?: string;
  pdfUrl?: string;
  createdAt: string;
}
