# FACTURA — Solution de facturation pour PME ivoiriennes

Application SaaS de facturation conçue pour les entrepreneurs et PME de Côte d'Ivoire. Conforme DGI, paiement mobile money intégré, assistant IA.

**Demo live :** [factura-zwrz.vercel.app](https://factura-zwrz.vercel.app)

## Stack technique

- **Frontend :** React + TypeScript + Vite + Tailwind CSS
- **Backend :** Supabase (PostgreSQL + Auth + Edge Functions)
- **Déploiement :** Vercel

## Lancer en local

**Prérequis :** Node.js 18+

1. Installer les dépendances :
   ```bash
   npm install
   ```

2. Copier le fichier d'environnement :
   ```bash
   cp .env.example .env.local
   ```

3. Renseigner les variables dans `.env.local` :
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

4. Lancer le serveur de développement :
   ```bash
   npm run dev
   ```

## Comptes de démonstration

| Email | Mot de passe | Plan |
|-------|-------------|------|
| starter@demo-factura.ci | Demo@2024 | Gratuit |
| pro@demo-factura.ci | Demo@2024 | Pro |
| business@demo-factura.ci | Demo@2024 | Business |
