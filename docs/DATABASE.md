# Database Setup and Configuration

This document describes the database architecture, setup process, and management for the Epic Auto Video Machine.

## Architecture Overview

The application uses **PostgreSQL** as the primary database with **Prisma ORM** for type-safe database access. The database is designed with multi-tenancy in mind, ensuring complete data isolation between users.

### Database Provider: Neon Postgres

We recommend using [Neon](https://neon.tech) for the PostgreSQL database because:
- ✅ Serverless PostgreSQL with automatic scaling
- ✅ Built-in connection pooling
- ✅ Generous free tier for development
- ✅ Excellent performance and reliability
- ✅ Easy branching for different environments

## Schema Overview

### Core Tables

1. **users** - User accounts and authentication
2. **accounts** - OAuth account linking (NextAuth.js)
3. **sessions** - User sessions (NextAuth.js)
4. **projects** - Video generation projects
5. **jobs** - Background job tracking
6. **scenes** - Individual story scenes
7. **assets** - Generated media files
8. **presets** - User-defined templates

### Key Features

- **Multi-tenant isolation**: All user data is scoped by `userId`
- **Soft deletes**: Important data is preserved with lifecycle management
- **JSON configuration**: Flexible configuration storage for projects and jobs
- **Audit trails**: Comprehensive tracking of changes and operations
- **Asset lifecycle**: Automatic cleanup of expired files

## Setup Instructions

### 1. Database Preparation

#### Option A: Neon Postgres (Recommended)

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard
4. The connection string format is:
   ```
   postgresql://username:password@host/database?sslmode=require
   ```

#### Option B: Local PostgreSQL

1. Install PostgreSQL locally
2. Create a database: `createdb epic_auto_video_machine`
3. Connection string format:
   ```
   postgresql://username:password@localhost:5432/epic_auto_video_machine
   ```

### 2. Environment Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```

2. Update the database URLs in `.env.local`:
   ```env
   DATABASE_URL="your-neon-connection-string"
   DIRECT_URL="your-neon-connection-string"
   ```

   > **Note**: For Neon, both URLs are typically the same. The `DIRECT_URL` is used for migrations.

### 3. Database Initialization

Run the automated setup script:

```bash
npm run db:init
```

This script will:
- Generate the Prisma client
- Push the schema to your database
- Seed initial data (demo user, default presets)

### 4. Verification

Check that everything is working:

```bash
# Open Prisma Studio to browse data
npm run db:studio

# Check API health endpoint
curl http://localhost:3000/api/health
```

## Development Workflow

### Common Commands

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Push schema changes to database (development)
npm run db:push

# Create and run migrations (production)
npm run db:migrate

# Reset database and reseed
npm run db:reset

# Open database browser
npm run db:studio

# Run seed script
npm run db:seed
```

### Schema Changes

1. Edit `prisma/schema.prisma`
2. Run `npm run db:push` for development
3. For production, create migrations: `npm run db:migrate`

### Adding Seed Data

Edit `prisma/seed.ts` to add initial data for development and testing.

## Multi-Tenant Security

### Row Level Security (RLS)

Since Prisma doesn't support native PostgreSQL RLS, we implement application-level security:

1. **User-scoped clients**: `DatabaseService.getUserScopedClient(userId)`
2. **Ownership verification**: `DatabaseService.verifyUserOwnership()`
3. **Middleware protection**: All API routes use authentication middleware

### Data Isolation

```typescript
// ✅ Correct: User-scoped query
const userProjects = await db.project.findMany({
  where: { userId: currentUser.id }
})

// ❌ Incorrect: Global query (security risk)
const allProjects = await db.project.findMany()
```

### Access Patterns

- **Users** can only access their own projects, assets, and presets
- **Premium users** get higher quotas and priority processing
- **Admins** can access all data for support and monitoring

## Performance Optimization

### Indexing Strategy

Key indexes are automatically created by Prisma:

- `projects.userId` - Fast user project lookups
- `jobs.projectId` - Job tracking by project
- `jobs.status` - Queue processing optimization
- `assets.userId` - User asset management
- `assets.expiresAt` - Lifecycle cleanup

### Connection Pooling

Neon provides built-in connection pooling. For other providers:

```typescript
// Prisma connection configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})
```

### Query Optimization

- Use `select` to limit returned fields
- Use `include` judiciously to avoid N+1 queries
- Implement pagination for large result sets
- Use database-level aggregations when possible

## Monitoring and Maintenance

### Health Checks

The `/api/health` endpoint provides comprehensive database health information:

- Connection status
- Query performance
- Active connections
- Database statistics

### Automated Maintenance

The system includes automated maintenance tasks:

```typescript
// Clean up expired assets
await DatabaseService.cleanupExpiredAssets()

// Validate schema integrity
await validateDatabaseSchema()

// Performance benchmarking
await performDatabaseBenchmark()
```

### Backup Strategy

For production:

1. **Neon**: Automatic backups included
2. **Self-hosted**: Set up regular `pg_dump` backups
3. **Point-in-time recovery**: Available with Neon Pro

## Troubleshooting

### Common Issues

#### Connection Errors

```bash
# Test connection
npx prisma db pull
```

If this fails:
- Check your `DATABASE_URL` format
- Ensure the database server is running
- Verify network connectivity and firewall settings

#### Migration Issues

```bash
# Reset and recreate
npm run db:reset

# Or manually fix
npx prisma migrate resolve --applied "migration-name"
```

#### Performance Issues

```bash
# Analyze slow queries
npm run db:studio
# Check the "Query" tab for performance insights
```

### Getting Help

1. Check the [Prisma documentation](https://www.prisma.io/docs)
2. Review [Neon documentation](https://neon.tech/docs)
3. Check application logs for detailed error messages
4. Use `npm run db:studio` to inspect data directly

## Production Deployment

### Environment Variables

Ensure these are set in production:

```env
DATABASE_URL="your-production-database-url"
DIRECT_URL="your-production-database-url"
NEXTAUTH_SECRET="your-secure-secret"
```

### Migration Deployment

```bash
# Deploy migrations to production
npm run db:migrate:deploy
```

### Monitoring

Set up monitoring for:
- Database connection health
- Query performance
- Storage usage
- Connection pool utilization

The built-in health check endpoint (`/api/health`) provides most of this information and can be integrated with monitoring services like Datadog, New Relic, or custom dashboards.