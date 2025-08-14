# Epic Auto Video Machine

Transform your stories into stunning videos automatically with AI-powered scene generation, voice synthesis, and professional editing.

## Features

- 🎬 **Automated Video Generation**: Convert text stories into professional videos
- 🎨 **Multiple Templates**: Choose from Classic Clean, Dark Glass, or Vivid Gradient styles
- 🎵 **AI Voice Synthesis**: Generate natural-sounding narration with Gemini TTS
- 🖼️ **AI Image Generation**: Create stunning visuals with Imagen 4 and Gemini
- 📱 **Multiple Aspect Ratios**: Support for 9:16, 16:9, and 1:1 formats
- ⚡ **Real-time Processing**: Track progress with live updates
- 🔒 **Secure & Private**: Enterprise-grade security with multi-tenant isolation

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: Neon Postgres
- **AI Services**: Google Gemini (Text, TTS, Image Generation)
- **Storage**: Cloudflare R2
- **Authentication**: NextAuth.js
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (Neon recommended)
- Google Gemini API key

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd epic_auto_video_machine
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

4. Fill in your environment variables in `.env.local`

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

## Project Structure

```
src/
├── app/                 # Next.js 14 app directory
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # Reusable UI components
│   └── ui/            # Base UI components
├── lib/               # Utility functions and configurations
│   ├── constants.ts   # Design tokens and constants
│   └── utils.ts       # Helper functions
└── types/             # TypeScript type definitions
    └── index.ts       # Core type definitions
```

## Environment Variables

See `.env.example` for a complete list of required environment variables.

Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Authentication secret
- `GEMINI_API_KEY` - Google Gemini API key
- `CLOUDFLARE_R2_*` - Cloudflare R2 storage credentials

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@example.com or join our Discord community.
