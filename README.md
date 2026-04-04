# 🤖 AI Studio - Autonomous Agents & Generative AI Backend

**Live Demo**:
[https://ai-studio.tarekmonowar.dev/](https://ai-studio.tarekmonowar.dev/) |
[https://ai-studio-tm.vercel.app/](https://ai-studio-tm.vercel.app/)

**GitHub Repositories**:

- Frontend:
  [https://github.com/tarekmonowar/Ai-Studio-FrontEnd](https://github.com/tarekmonowar/Ai-Studio-FrontEnd)
- Backend:
  [https://github.com/tarekmonowar/Ai-Studio-BackEnd](https://github.com/tarekmonowar/Ai-Studio-BackEnd)

![AI Studio Backend - AI Agents](src/app/images/aiagents.png)

## 📖 What This Project Solves

The AI Studio Backend acts as the centralized nervous system for **Autonomous AI Agents**. Instead of solely serving traditional text completion logic, this backend natively parses massive LLM workloads to execute robust server-side function calling arrays.

It forms the crucial bridge parsing natural language intents from the user via the frontend, actively routing them into systematic automated processes—whether that means commanding the frontend application to autonomously redirect pages and repaint styling patterns, or triggering heavy server-side protocols like assembling personalized SMTP email packets (via securely optimized Nodemailer transports) without any manual click layers dynamically.

## ✨ AI Automation Features

- **Server-Side Function Orchestration**: Dynamically serves strictly typed Zod schemas mapping system functions to LLM function-calling capabilities. 
- **Automated Mail Distribution Engine**: Ingests deterministic agent instructions, auto-formatting, heavily sanitizing anti-spam signals, and instantly firing HTML styled emails natively over optimized Nodemailer layouts.
- **Provider Abstraction via Azure AI**: Hooks securely into immense Azure OpenAI generative instances driving near-instant intelligence models ensuring intent-parsing latency is basically untraceable.
- **Stateless Intelligence Design**: Capable of reading highly variable runtime context arrays natively on demand, instructing the agent flawlessly when executing dynamic operations securely.

## 🧠 Generative AI Capabilities

![Generative AI Backend](src/app/images/aigenerative.png)

The backend system heavily and natively supports immense **Generative AI capabilities**. It functions as a highly secure API proxy to the heaviest large language models available. It carefully coordinates prompt structure rules, gracefully catches execution limits, and safely streams dense technical text-completion insight outputs immediately back across network pipelines over to the user interface simultaneously.

## 🛠️ Tech Stack

- **Runtime**: Node.js & TypeScript
- **Database Architecture**: MongoDB (Mongoose)
- **AI Integrations**: Azure OpenAI capabilities
- **Email Infrastructure**: Nodemailer / SMTP
- **Validations**: Zod type-safe parsing

## 🚀 Getting Started

1. **Clone the repository**:

   ```bash
   git clone https://github.com/tarekmonowar/Ai-Studio-BackEnd.git
   cd backend
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Set up Environment Variables**: Create a `.env` file based on your
   configuration needs:

   ```env
   PORT=8787
   AZURE_OPENAI_ENDPOINT=your-azure-openai-endpoint
   AZURE_OPENAI_API_KEY=your-azure-openai-api-key
   AZURE_OPENAI_MODEL=your-deployment-name
   
   # Email tool config
   EMAIL_USER=your_smtp_email@gmail.com
   EMAIL_PASS=your_smtp_password
   EMAIL_FROM=your_smtp_email@gmail.com
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```

### Endpoints

- **AI Agent Tool Actions**: `POST /ai/tools/send-email`
- **Agent Chat & Orchestration**: `POST /ai/agent-chat`

---

_For the visual user interface connecting directly to this framework, trace the
[Frontend Repository](https://github.com/tarekmonowar/Ai-Studio-FrontEnd)._
