AI Code Reviewer Platform

Plateforme complète d’analyse de code source basée sur l’intelligence artificielle, conçue avec une architecture microservices. Elle intègre une authentification JWT, un système de paiement Stripe et une documentation API via Swagger.

📌 Overview

Cette application permet aux développeurs de :

🔍 Analyser automatiquement leur code source
🛡️ Détecter les erreurs et vulnérabilités
⚙️ Recevoir des suggestions d’optimisation
📊 Obtenir un score de qualité
💳 Gérer un abonnement freemium
🏗️ Architecture
Client (React)
     ↓
API Gateway (Express)
     ↓
Microservices:
- Auth Service
- Code Service
- AI Service
- Payment Service
     ↓
RabbitMQ (Messaging)
     ↓
MongoDB + Redis
⚙️ Tech Stack
Backend
Node.js
Express.js
JWT Authentication
RabbitMQ
MongoDB
Redis
Frontend
React 18
Vite
DevOps
Docker
Docker Compose
External APIs
Local AI (Ollama)
Stripe API
✨ Features
🔐 Authentication
Inscription et connexion
JWT avec refresh tokens
Gestion sécurisée des utilisateurs
🤖 Code Analysis
Support de plusieurs langages
Analyse par intelligence artificielle
Détection d’erreurs et vulnérabilités
Score de qualité du code
💰 Payment System
Offre gratuite limitée
Abonnement premium
Intégration Stripe
📊 Dashboard
Historique des analyses
Statistiques utilisateur
Export des résultats
📦 Prerequisites
Docker et Docker Compose
Node.js (version 18+)
Ollama (Local AI)
Clés API :
Stripe
🚀 Installation
git clone https://github.com/your-org/ai-code-reviewer.git
cd ai-code-reviewer

cp .env.example .env

docker-compose up --build
🔧 Configuration

Créer un fichier .env :

AI_BASE_URL=http://host.docker.internal:11434
AI_MODEL=llama3
AI_FALLBACK_MODEL=mistral

STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_PUBLISHABLE_KEY=your_stripe_public

JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

MONGODB_URI=mongodb://localhost:27017
RABBITMQ_URL=amqp://guest:guest@localhost:5672
🌐 Services
Service	URL
Frontend	http://localhost:5173

API Gateway	http://localhost:3000

API Docs	http://localhost:3000/api-docs

RabbitMQ Panel	http://localhost:15672
📚 API Endpoints
🔐 Authentication
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
GET  /api/auth/me
💻 Code
POST /api/code/submit
GET  /api/code/history
GET  /api/code/analysis/:id
GET  /api/code/stats
🤖 AI
POST /api/ai/analyze
GET  /api/ai/languages
💳 Payment
POST /api/payment/create-checkout
GET  /api/payment/subscription
DELETE /api/payment/cancel-subscription
🧪 Testing
cd services/auth && npm test
cd services/code && npm test
🚀 Deployment
Docker
docker-compose up -d
Cloud Deployment
Render
Railway
MongoDB Atlas
CloudAMQP
📁 Project Structure
services/
  ├── gateway/
  ├── auth/
  ├── code/
  ├── ai/
  └── payment/

frontend/
docker-compose.yml
.env.example
🔒 Security
JWT avec expiration
Hash des mots de passe (bcrypt)
Rate limiting
Validation des entrées
Configuration CORS
HTTPS en production
⚠️ Important

Ne jamais exposer vos clés API dans le repository.
Ollama doit être installé et lancé sur votre machine hôte pour que l'analyse IA fonctionne.
Assurez-vous d'avoir téléchargé les modèles nécessaires :
`ollama pull llama3`
`ollama pull mistral`

👨‍💻 Author

Your Name

📜 License

MIT License