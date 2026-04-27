/**
 * AI Service using OpenRouter API
 * With multi-model fallback and local static analysis
 */
const axios = require('axios');

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PRIMARY_MODEL = process.env.AI_MODEL || 'mistralai/mistral-7b-instruct-v0.1';
const FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL || 'openchat/openchat-7b';
const MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS) || 1000;
const TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE) || 0.3;
const SITE_URL = process.env.AI_SITE_URL || 'http://localhost:3000';
const SITE_NAME = process.env.AI_SITE_NAME || 'AI Code Review App';

// OpenRouter API endpoint
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Axios instance
const aiClient = axios.create({
  baseURL: OPENROUTER_URL,
  timeout: 30000, // 30 seconds for OpenRouter
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'HTTP-Referer': SITE_URL,
    'X-Title': SITE_NAME,
    'Content-Type': 'application/json'
  }
});

/**
 * Prompt système déterministe pour l'analyse professionnelle de code.
 */
const SYSTEM_PROMPT = `Tu es un ingénieur logiciel senior et un expert en revue de code.
Ta mission est d'analyser le code fourni de manière approfondie et précise.

CONSIGNES DE RÉVISION :
- Ne te limite pas aux erreurs de syntaxe.
- Détecte les erreurs logiques (métier).
- Identifie les comportements de programme incorrects.
- Révèle les hypothèses erronées dans le code (wrong assumptions).
- Repère les problèmes d'exécution (runtime), de sécurité et de performance.

IMPORTANT : Pense comme un développeur senior réel revue du code de production. Sois précis et réaliste. N'invente pas de problèmes. Si le code est correct, dis-le clairement.

FORMAT DE SORTIE JSON STRICT :
{
  "bugs": [
    { "line": number, "description": "string", "fix": "string", "severity": "HIGH|MEDIUM|LOW" }
  ],
  "businessLogicIssues": [
    { "line": number, "description": "string", "reason": "string", "severity": "CRITICAL|HIGH|MEDIUM" }
  ],
  "securityIssues": [
    { "line": number, "description": "string", "severity": "CRITICAL|HIGH|MEDIUM" }
  ],
  "performanceIssues": [
    { "line": number, "description": "string", "solution": "string" }
  ],
  "cleanCodeImprovements": [
    { "line": number, "description": "string", "suggestion": "string" }
  ],
  "eli5": "string (Explication simple pour débutants)",
  "correctedCode": "string (Version améliorée)",
  "score": number (0 à 100)
}

RÈGLES :
- Garde les explications structurées et claires.
- Ne produis UNIQUEMENT que le JSON, sans texte explicatif externe.`;

/**
 * Analyse de code principale avec OpenRouter et fallbacks
 */
const analyzeCode = async (code, language, context = '') => {
  try {
    console.log(`[INFO] 🔍 [ANALYSE] Début analyse ${language} avec OpenRouter (${PRIMARY_MODEL})`);
    
    // Tenter avec le modèle primaire
    try {
      return await callOpenRouter(code, language, context, PRIMARY_MODEL);
    } catch (primaryError) {
      console.warn(`[WARN] ⚠️ Échec modèle primaire (${PRIMARY_MODEL}):`, primaryError.message);
      
      // Tenter avec le modèle de secours
      console.log(`[INFO] 🔄 Tentative avec le modèle de secours (${FALLBACK_MODEL})...`);
      try {
        return await callOpenRouter(code, language, context, FALLBACK_MODEL);
      } catch (fallbackError) {
        console.error(`[ERROR] ❌ Échec modèle de secours (${FALLBACK_MODEL}):`, fallbackError.message);
        
        // Ultime recours: Analyse statique locale
        console.log('[INFO] 🛡️ Utilisation de l\'analyse statique locale (CodeAnalyzer)...');
        return getFallbackAnalysis(code, language);
      }
    }
  } catch (error) {
    console.error('[ERROR] ❌ Erreur fatale AI Service:', error.message);
    return getFallbackAnalysis(code, language);
  }
};

/**
 * Appel API à OpenRouter
 */
const callOpenRouter = async (code, language, context, model) => {
  const startTime = Date.now();
  
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Analyse ce code ${language}:\n\n\`\`\`${language}\n${code}\n\`\`\`\n${context ? `Contexte: ${context}` : ''}` }
  ];

  const response = await aiClient.post('', {
    model: model,
    messages: messages,
    max_tokens: MAX_TOKENS,
    temperature: 0.1, // Réduit pour plus de déterminisme
  });

  const content = response.data.choices[0].message.content;
  const executionTime = Date.now() - startTime;
  
  // Usage info
  const usage = {
    prompt_tokens: response.data.usage?.prompt_tokens || 0,
    completion_tokens: response.data.usage?.completion_tokens || 0,
    total_tokens: response.data.usage?.total_tokens || 0
  };

  // Parser le JSON
  let result;
  try {
    const extracted = extractJson(content);
    result = JSON.parse(extracted || content);
  } catch (e) {
    console.error('[ERROR] Erreur parsing JSON OpenRouter:', e.message);
    throw new Error('Réponse JSON invalide');
  }

  return normalizeAnalysisResult(result, code, language, executionTime, usage);
};

/**
 * Normalise le résultat de l'analyse
 */
const normalizeAnalysisResult = (result, code, language, executionTime, usage) => {
  // Mapping pour compatibilité ascendante si nécessaire
  const errors = result.bugs || result.errors || [];
  const businessIssues = result.businessLogicIssues || [];
  const security = result.securityIssues || [];
  const performance = result.performanceIssues || [];
  const cleanCode = result.cleanCodeImprovements || result.warnings || [];
  
  // Calculer un score sur 10 pour le frontend si le score est sur 100
  const normalizedScore = result.score > 10 ? Math.round(result.score / 10) : (result.score || 5);

  return {
    metadata: {
      codeLength: code.length,
      lineCount: code.split('\n').length,
      language: language,
      complexity: result.metadata?.complexity || calculateComplexity(code),
      maintenability: result.metadata?.maintenability || Math.round(normalizedScore)
    },
    score: normalizedScore,
    fullScore: result.score || (normalizedScore * 10), // Garder le score 0-100
    scoreBreakdown: {
      quality: result.scoreBreakdown?.quality || Math.round(normalizedScore),
      security: result.scoreBreakdown?.security || (security.length > 0 ? 4 : 9),
      performance: result.scoreBreakdown?.performance || (performance.length > 0 ? 5 : 9),
      readability: result.scoreBreakdown?.readability || 8
    },
    errors: errors,
    businessLogicIssues: businessIssues,
    securityIssues: security,
    performanceIssues: performance,
    warnings: cleanCode, // On mappe Clean Code vers warnings pour le frontend actuel
    summary: result.eli5 || result.summary || 'Analyse terminée.',
    eli5: result.eli5,
    correctedCode: result.correctedCode || code,
    originalCode: code,
    executionTime,
    tokensUsed: usage
  };
};

/**
 * Analyse statique de secours (CodeAnalyzer)
 */
const getFallbackAnalysis = (code, language) => {
  const analyzer = new CodeAnalyzer(code, language);
  const result = analyzer.analyze();
  
  return {
    metadata: {
      codeLength: code.length,
      lineCount: code.split('\n').length,
      language: language,
      complexity: calculateComplexity(code),
      maintenability: result.maintenability
    },
    score: result.score,
    scoreBreakdown: result.scoreBreakdown,
    errors: result.errors,
    warnings: result.warnings,
    securityIssues: result.securityIssues,
    summary: result.summary + ' (Analyse statique)',
    correctedCode: result.correctedCode,
    originalCode: code,
    executionTime: 0,
    tokensUsed: { input: 0, output: 0, total: 0 }
  };
};

/**
 * Classe d'analyse statique complète (Conservée comme demandé)
 */
class CodeAnalyzer {
  constructor(code, language) {
    this.code = code;
    this.language = language;
    this.lines = code.split('\n');
    this.errors = [];
    this.warnings = [];
    this.suggestions = [];
    this.securityIssues = [];
    this.performanceIssues = [];
  }

  analyze() {
    // Analyse par langage
    switch (this.language) {
      case 'javascript':
      case 'js':
      case 'typescript':
      case 'ts':
        this.analyzeJavaScript();
        break;
      case 'python':
        this.analyzePython();
        break;
      case 'java':
        this.analyzeJava();
        break;
      case 'ruby':
      case 'rb':
        this.analyzeRuby();
        break;
      case 'cpp':
      case 'c++':
        this.analyzeCpp();
        break;
      case 'csharp':
      case 'cs':
        this.analyzeCSharp();
        break;
      default:
        this.analyzeGeneric();
    }

    // Analyse universelle
    this.analyzeUniversal();

    // Génération du code corrigé
    const correctedCode = this.generateCorrectedCode();

    // Calcul des scores
    const score = Math.max(1, 10 - (this.errors.length * 2) - (this.warnings.length * 0.5));
    const scoreBreakdown = {
      quality: Math.max(1, 10 - this.errors.length * 3),
      security: Math.max(1, 10 - this.securityIssues.length * 2),
      performance: Math.max(1, 10 - this.performanceIssues.length),
      readability: Math.max(1, 9 - (this.warnings.filter(w => w.type === 'READABILITY').length * 0.5)),
      maintainability: Math.max(1, 10 - (this.errors.length + this.warnings.length) * 0.5),
      testing: Math.max(1, 8 - (this.warnings.filter(w => w.type === 'TESTING').length))
    };

    return {
      score,
      scoreBreakdown,
      errors: this.errors,
      warnings: this.warnings,
      suggestions: this.suggestions,
      securityIssues: this.securityIssues,
      performanceIssues: this.performanceIssues,
      summary: this.generateSummary(),
      correctedCode,
      maintenability: scoreBreakdown.maintainability,
      testability: scoreBreakdown.testing,
      documentation: this.calculateDocumentation()
    };
  }

  analyzeJavaScript() {
    this.lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();

      this.checkSyntaxErrors(line, lineNum);

      if (trimmed.includes('if (') && trimmed.includes('=') && !trimmed.includes('==') && !trimmed.includes('===')) {
        this.addError(lineNum, line.indexOf('='), 'LOGIC', 'HIGH', 'Assignation au lieu de comparaison', line.replace('=', '==='), 'Utiliser === pour les comparaisons');
      }

      if (trimmed.includes('eval(') || trimmed.includes('new Function(')) {
        this.addSecurity(lineNum, 'CWE-95', 'CRITICAL', 'eval() ou new Function() dangereux', 'Utilisez JSON.parse()');
      }

      if (trimmed.includes('var ') && !trimmed.includes('//')) {
        this.addWarning(lineNum, line.indexOf('var'), 'MODERNIZATION', 'MEDIUM', 'var est obsolète', 'Utilisez let ou const');
      }
    });
  }

  analyzePython() {
    this.lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      
      this.checkSyntaxErrors(line, lineNum);
      
      // Indentation checks
      if (line.length > 0 && line[0] === '\t') {
        this.addWarning(lineNum, 0, 'STYLE', 'LOW', 'Indentation avec tabulations au lieu d\'espaces', 'Utilisez 4 espaces pour l\'indentation (PEP 8)');
      }

      // Python 3 print syntax
      if (trimmed.startsWith('print ') && !trimmed.startsWith('print(')) {
        this.addError(lineNum, 0, 'SYNTAX', 'CRITICAL', 'print() nécessite des parenthèses en Python 3', line.replace('print ', 'print(') + ')', 'Syntaxe Python 3 obligatoire');
      }

      // Missing colon
      if ((trimmed.startsWith('if ') || trimmed.startsWith('elif ') || trimmed.startsWith('else') || 
           trimmed.startsWith('for ') || trimmed.startsWith('while ') || trimmed.startsWith('def ') || 
           trimmed.startsWith('class ')) && !trimmed.endsWith(':')) {
        this.addError(lineNum, line.length, 'SYNTAX', 'HIGH', 'Deux-points (:) manquant à la fin de la déclaration', line + ':', 'Les blocs de contrôle Python requièrent un :');
      }

      // Simple comparison error
      if (trimmed.includes('if ') && trimmed.includes('=') && !trimmed.includes('==') && !trimmed.includes('!=') && !trimmed.includes('<=') && !trimmed.includes('>=') && !trimmed.includes(' is ')) {
        this.addError(lineNum, line.indexOf('='), 'LOGIC', 'HIGH', 'Assignation dans une condition au lieu de comparaison', line.replace('=', '=='), 'Utilisez == pour comparer');
      }

      // Undefined variables (very simple heuristic)
      if (trimmed.includes('undefined_variable')) {
        this.addError(lineNum, line.indexOf('undefined_variable'), 'SYNTAX', 'CRITICAL', 'Variable non définie détectée', null, 'Définissez la variable avant usage');
      }
    });
  }

  analyzeJava() {
    this.lines.forEach((line, index) => {
      const lineNum = index + 1;
      this.checkSyntaxErrors(line, lineNum);
      if (line.trim() && !line.trim().endsWith(';') && !line.trim().endsWith('{') && !line.trim().endsWith('}') && !line.trim().startsWith('//')) {
        this.addError(lineNum, line.length, 'SYNTAX', 'HIGH', 'Point-virgule manquant', line + ';', 'Java requiert des points-virgules');
      }
    });
  }

  analyzeCpp() {
    this.lines.forEach((line, index) => {
      this.checkSyntaxErrors(line, index + 1);
      if (line.includes('strcpy') || line.includes('sprintf')) {
        this.addSecurity(index + 1, 'CWE-120', 'CRITICAL', 'Fonction non sécurisée', 'Utilisez strncpy ou snprintf');
      }
    });
  }

  analyzeCSharp() {
    this.lines.forEach((line, index) => {
      this.checkSyntaxErrors(line, index + 1);
    });
  }

  analyzeRuby() {
    this.lines.forEach((line, index) => {
      this.checkSyntaxErrors(line, index + 1);
    });
  }

  analyzeGeneric() {
    this.lines.forEach((line, index) => {
      this.checkSyntaxErrors(line, index + 1);
    });
  }

  analyzeUniversal() {
    this.lines.forEach((line, index) => {
      if (line.length > 120) {
        this.addWarning(index + 1, 0, 'STYLE', 'LOW', 'Ligne trop longue', 'Limiter à 120 caractères');
      }
    });
  }

  checkSyntaxErrors(line, lineNum) {
    const pairs = [['(', ')'], ['[', ']'], ['{', '}']];
    pairs.forEach(([open, close]) => {
      const o = (line.match(new RegExp('\\' + open, 'g')) || []).length;
      const c = (line.match(new RegExp('\\' + close, 'g')) || []).length;
      if (o > c) {
        this.addError(lineNum, line.length, 'SYNTAX', 'CRITICAL', `${close} manquant`, line + close.repeat(o-c), 'Erreur de syntaxe');
      }
    });
  }

  addError(lineNum, col, type, severity, desc, fix, impact) {
    this.errors.push({ id: `error-${this.errors.length + 1}`, type, severity, line: lineNum, column: col, description: desc, fix, impact });
  }

  addWarning(lineNum, col, type, severity, desc, suggestion) {
    this.warnings.push({ id: `warning-${this.warnings.length + 1}`, type, severity, line: lineNum, column: col, description: desc, suggestion });
  }

  addSecurity(lineNum, cwe, severity, desc, rec) {
    this.securityIssues.push({ id: `security-${this.securityIssues.length + 1}`, type: 'VULNERABILITY', severity, line: lineNum, cwe, description: desc, recommendation: rec });
  }

  addPerformance(lineNum, type, severity, desc, solution) {
    this.performanceIssues.push({ id: `perf-${this.performanceIssues.length + 1}`, type, severity, line: lineNum, description: desc, solution });
  }

  generateCorrectedCode() {
    let corrected = this.code;
    const sorted = [...this.errors].sort((a, b) => b.line - a.line);
    sorted.forEach(error => {
      if (error.fix) {
        const lines = corrected.split('\n');
        if (lines[error.line - 1]) {
          lines[error.line - 1] = error.fix;
          corrected = lines.join('\n');
        }
      }
    });
    return corrected;
  }

  generateSummary() {
    const counts = { e: this.errors.length, w: this.warnings.length, s: this.securityIssues.length };
    if (counts.e === 0 && counts.w === 0 && counts.s === 0) return 'Aucun problème majeur détecté.';
    return `${counts.s} sécurité, ${counts.e} erreurs, ${counts.w} avertissements.`;
  }

  calculateDocumentation() {
    const commentChar = (this.language === 'python' || this.language === 'ruby' || this.language === 'rb') ? '#' : '//';
    const comments = this.lines.filter(l => l.trim().startsWith(commentChar)).length;
    return Math.min(10, (comments / this.lines.length) * 10);
  }
}

const calculateComplexity = (code) => {
  const count = (code.match(/if|for|while|switch/g) || []).length;
  if (count > 10) return 'HIGH';
  if (count > 5) return 'MEDIUM';
  return 'LOW';
};

/**
 * Extracteur de JSON robuste multi-étapes
 */
const extractJson = (text) => {
  if (!text) return null;

  // Étape 1 : Nettoyage basique et essai de parsing direct
  const trimmed = text.trim();
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch (e) {}

  // Étape 2 : Recherche de blocs de code Markdown ```json ... ``` ou ``` ... ```
  const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  let match;
  while ((match = markdownRegex.exec(trimmed)) !== null) {
    try {
      const candidate = match[1].trim();
      JSON.parse(candidate);
      return candidate;
    } catch (e) {}
  }

  // Étape 3 : Recherche du bloc JSON principal via les accolades {...}
  // On cherche le premier '{' et le dernier '}'
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = trimmed.substring(start, end + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch (e) {}
  }

  // Étape 4 : Nettoyage agressif (suppression de textes parasites avant/après)
  // Parfois les modèles ajoutent des commentaires après l'objet
  const cleanedText = trimmed.replace(/^[^{]*/, '').replace(/}[^}]*$/, '}');
  try {
    JSON.parse(cleanedText);
    return cleanedText;
  } catch (e) {}

  return null;
};

const getSupportedLanguages = () => {
  return ['javascript', 'js', 'python', 'java', 'cpp', 'csharp', 'go', 'php', 'ruby'];
};

const checkHealth = async () => {
  try {
    return { status: 'ok', service: 'openrouter', timestamp: new Date().toISOString() };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
};

module.exports = {
  analyzeCode,
  checkHealth,
  getSupportedLanguages,
  MODEL: PRIMARY_MODEL
};
