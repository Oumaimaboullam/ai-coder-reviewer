/**
 * Modèle d'Analyse pour MongoDB
 * Stocke les résultats d'analyse de code
 */
const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  // Relation utilisateur
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  // Code analysé
  code: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 50000
  },
  language: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    default: null
  },

  // Statut de l'analyse
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },

  // Résultat de l'analyse (rempli par le service AI)
  result: {
    // Score global (0-10)
    score: {
      type: Number,
      min: 0,
      max: 10,
      default: null
    },
    
    // Détail du score
    scoreBreakdown: {
      quality: { type: Number, min: 0, max: 10, default: null },
      security: { type: Number, min: 0, max: 10, default: null },
      performance: { type: Number, min: 0, max: 10, default: null },
      readability: { type: Number, min: 0, max: 10, default: null }
    },

    // Erreurs détectées
    errors: [{
      id: String,
      type: {
        type: String,
        enum: ['SYNTAX_ERROR', 'LOGIC_ERROR', 'SECURITY', 'PERFORMANCE', 'STYLE', 'BEST_PRACTICE', 'OTHER']
      },
      severity: {
        type: String,
        enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
      },
      line: Number,
      column: Number,
      description: String,
      fix: String,
      codeSnippet: String
    }],

    // Avertissements
    warnings: [{
      id: String,
      type: String,
      severity: String,
      line: Number,
      column: Number,
      description: String,
      suggestion: String
    }],

    // Suggestions d'amélioration
    suggestions: [{
      id: String,
      type: {
        type: String,
        enum: ['OPTIMIZATION', 'READABILITY', 'MODERNIZATION', 'REFACTORING', 'DOCUMENTATION']
      },
      description: String,
      impact: String,
      beforeCode: String,
      afterCode: String,
      explanation: String
    }],

    // Problèmes de sécurité
    securityIssues: [{
      id: String,
      type: String,
      severity: {
        type: String,
        enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
      },
      description: String,
      cve: String,
      recommendation: String,
      line: Number
    }],

    // Résumé général
    summary: {
      type: String,
      default: null
    }
  },

  // Métadonnées
  executionTime: {
    type: Number, // en millisecondes
    default: null
  },
  
  tokensUsed: {
    input: { type: Number, default: 0 },
    output: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },

  creditsUsed: {
    type: Number,
    default: 1
  },

  // Message d'erreur si l'analyse a échoué
  errorMessage: {
    type: String,
    default: null
  },

  // Date d'expiration pour suppression automatique (RGPD)
  expiresAt: {
    type: Date,
    default: () => {
      const date = new Date();
      date.setFullYear(date.getFullYear() + 1); // 1 an de conservation
      return date;
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Index pour améliorer les performances
analysisSchema.index({ userId: 1, createdAt: -1 }); // Pour l'historique
analysisSchema.index({ status: 1 }); // Pour les analyses en attente
analysisSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL pour suppression auto

// Index texte pour la recherche
analysisSchema.index(
  { 'result.summary': 'text', code: 'text' },
  { language_override: 'documentLanguage' } // Empêche Mongoose d'interpréter le champ `language` (qui est du code style 'php') comme une langue parlée
);

/**
 * Méthode pour obtenir les statistiques d'un utilisateur
 */
analysisSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
    {
      $group: {
        _id: null,
        totalAnalyses: { $sum: 1 },
        averageScore: { $avg: '$result.score' },
        totalErrors: { $sum: { $size: '$result.errors' } },
        totalWarnings: { $sum: { $size: '$result.warnings' } },
        languages: { $addToSet: '$language' }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalAnalyses: 0,
      averageScore: 0,
      totalErrors: 0,
      totalWarnings: 0,
      languages: []
    };
  }

  return {
    totalAnalyses: stats[0].totalAnalyses,
    averageScore: Math.round(stats[0].averageScore * 10) / 10,
    totalErrors: stats[0].totalErrors,
    totalWarnings: stats[0].totalWarnings,
    languages: stats[0].languages
  };
};

/**
 * Méthode pour obtenir les analyses par langage
 */
analysisSchema.statics.getLanguageDistribution = async function(userId) {
  return await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
    {
      $group: {
        _id: '$language',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

const Analysis = mongoose.model('Analysis', analysisSchema);

module.exports = Analysis;
