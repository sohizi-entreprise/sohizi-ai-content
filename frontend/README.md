# Sohizi - AI Video Storyboard Generator

A creator-grade web application for generating video storyboards using AI. Build comprehensive video outlines, generate shot lists with camera specifications, and create consistent images for each shot using fal.ai.

## Features

- **Project Management**: Create and manage video projects with different formats (Story Time, Explainer, Documentary, Presenter)
- **AI-Powered Outline Generation**: Generate project briefs and scene outlines from your story concept
- **Shot Generation**: Automatically create detailed shot lists with camera specs (shot type, angle, lens, movement)
- **Entity Extraction**: Extract and maintain consistency for characters, locations, props, and costumes
- **Storyboard UI**: Visual storyboard interface with shot cards and entity chips
- **Image Generation**: Generate consistent images for each shot via fal.ai

## Tech Stack

- **Frontend**: React with TanStack Start (file-based routing)
- **UI**: shadcn/ui components with Tailwind CSS
- **Data Fetching**: TanStack Query
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-4o for outline/shot generation
- **Images**: fal.ai for image generation

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL database

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your configuration:
# - DATABASE_URL: Your PostgreSQL connection string
# - OPENAI_API_KEY: Your OpenAI API key
# - FAL_KEY: Your fal.ai API key (optional for image generation)

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

The app will be available at `http://localhost:3000`

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sohizi

# OpenAI API (for outline and shot generation)
OPENAI_API_KEY=sk-your-openai-api-key

# fal.ai API (for image generation)
FAL_KEY=your-fal-api-key
```

## Project Structure

```
src/
├── components/ui/     # shadcn/ui components
├── db/
│   ├── index.ts      # Drizzle client
│   └── schema.ts     # Database schema
├── lib/
│   ├── types.ts      # TypeScript types & Zod schemas
│   ├── utils.ts      # Utility functions
│   └── server/
│       ├── projects.ts  # Project CRUD operations
│       └── ai.ts        # AI generation functions
├── routes/
│   ├── __root.tsx          # Root layout
│   ├── index.tsx           # Redirect to /projects
│   └── projects/
│       ├── index.tsx       # Projects list
│       ├── new.tsx         # Create project
│       └── $projectId/
│           ├── outline.tsx   # Outline editor
│           └── storyboard.tsx # Storyboard view
└── styles.css              # Global styles & theme
```

## Database Schema

The app uses the following tables:
- `projects` - Video projects
- `project_briefs` - Project metadata (title, logline, audience, tone, etc.)
- `outline_acts` - Story acts structure
- `scenes` - Individual scenes
- `characters` - Character definitions
- `locations` - Location definitions
- `props` - Prop definitions
- `costumes` - Costume definitions
- `shots` - Individual shots with camera specs
- `shot_images` - Generated images for shots

## Workflow

1. **Create Project**: Name your project and choose a format
2. **Enter Story**: Provide your story concept, script, or idea
3. **Generate Outline**: AI creates a project brief with scenes skeleton
4. **Edit Outline**: Review and modify the outline as needed
5. **Generate Shots**: AI breaks scenes into detailed shot lists
6. **View Storyboard**: See all shots organized by scene
7. **Generate Images**: Create AI images for each shot

## Building for Production

```bash
pnpm build
```

## Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm test         # Run tests
pnpm lint         # Run ESLint
pnpm format       # Run Prettier
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Run migrations
pnpm db:push      # Push schema to database
pnpm db:studio    # Open Drizzle Studio
```

## License

MIT
