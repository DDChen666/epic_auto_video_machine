#!/usr/bin/env tsx

/**
 * Database initialization script
 * This script sets up the database with initial schema and seed data
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const PROJECT_ROOT = join(__dirname, '..')

async function main() {
  console.log('🚀 Initializing Epic Auto Video Machine database...\n')

  try {
    // Check if .env.local exists
    const envPath = join(PROJECT_ROOT, '.env.local')
    if (!existsSync(envPath)) {
      console.log('⚠️  .env.local not found. Please create it with your database configuration.')
      console.log('   You can copy from .env.example and update the DATABASE_URL')
      process.exit(1)
    }

    // Check if DATABASE_URL is set
    const envContent = require('fs').readFileSync(envPath, 'utf8')
    if (!envContent.includes('DATABASE_URL=') || envContent.includes('your-database-url')) {
      console.log('⚠️  Please configure DATABASE_URL in .env.local')
      console.log('   For Neon Postgres, it should look like:')
      console.log('   DATABASE_URL="postgresql://username:password@host/database?sslmode=require"')
      process.exit(1)
    }

    console.log('1️⃣  Generating Prisma client...')
    execSync('npx prisma generate', { 
      cwd: PROJECT_ROOT, 
      stdio: 'inherit' 
    })

    console.log('\n2️⃣  Pushing database schema...')
    execSync('npx prisma db push', { 
      cwd: PROJECT_ROOT, 
      stdio: 'inherit' 
    })

    console.log('\n3️⃣  Seeding database with initial data...')
    execSync('npm run db:seed', { 
      cwd: PROJECT_ROOT, 
      stdio: 'inherit' 
    })

    console.log('\n✅ Database initialization completed successfully!')
    console.log('\n📊 You can now:')
    console.log('   • Run `npm run dev` to start the development server')
    console.log('   • Run `npm run db:studio` to open Prisma Studio')
    console.log('   • Visit http://localhost:3000/api/health to check system health')

  } catch (error) {
    console.error('\n❌ Database initialization failed:', error)
    console.log('\n🔧 Troubleshooting:')
    console.log('   • Ensure your database is running and accessible')
    console.log('   • Check your DATABASE_URL in .env.local')
    console.log('   • For Neon Postgres, ensure you have the correct connection string')
    console.log('   • Run `npm run db:studio` to test the connection')
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main()
}