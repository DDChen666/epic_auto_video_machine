import { PrismaClient } from '@prisma/client'
import { DEFAULT_PROJECT_CONFIG } from '../src/types'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create default presets for new users
  const defaultPresets = [
    {
      id: 'preset-classic-clean',
      name: 'Classic Clean',
      config: JSON.parse(
        JSON.stringify({
          ...DEFAULT_PROJECT_CONFIG,
          template: {
            name: 'classic',
            transitions: 'fade',
            transition_duration: 500,
            background_music: true,
            bgm_volume: -18,
          },
        })
      ),
      isDefault: true,
    },
    {
      id: 'preset-dark-glass',
      name: 'Dark Glass',
      config: JSON.parse(
        JSON.stringify({
          ...DEFAULT_PROJECT_CONFIG,
          template: {
            name: 'dark',
            transitions: 'zoom',
            transition_duration: 800,
            background_music: true,
            bgm_volume: -20,
          },
        })
      ),
      isDefault: false,
    },
    {
      id: 'preset-vivid-gradient',
      name: 'Vivid Gradient',
      config: JSON.parse(
        JSON.stringify({
          ...DEFAULT_PROJECT_CONFIG,
          template: {
            name: 'vivid',
            transitions: 'fade',
            transition_duration: 600,
            background_music: true,
            bgm_volume: -16,
          },
        })
      ),
      isDefault: false,
    },
  ]

  // Create a demo user for development
  if (process.env.NODE_ENV === 'development') {
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo@example.com' },
      update: {},
      create: {
        id: 'demo-user-id',
        email: 'demo@example.com',
        name: 'Demo User',
        role: 'USER',
        settings: {
          language: 'zh-TW',
          timezone: 'Asia/Taipei',
          notifications: {
            email: true,
            discord: false,
            webhook: false,
          },
        },
      },
    })

    console.log('✅ Created demo user:', demoUser.email)

    // Create default presets for demo user
    for (const preset of defaultPresets) {
      await prisma.preset.upsert({
        where: { id: preset.id },
        update: {},
        create: {
          ...preset,
          userId: demoUser.id,
        },
      })
    }

    console.log('✅ Created default presets for demo user')

    // Create a sample project
    const sampleProject = await prisma.project.upsert({
      where: { id: 'sample-project-id' },
      update: {},
      create: {
        id: 'sample-project-id',
        userId: demoUser.id,
        title: '範例專案：恐怖故事',
        description: '這是一個範例專案，展示如何將文字故事轉換為影片',
        status: 'DRAFT',
        config: JSON.parse(JSON.stringify(DEFAULT_PROJECT_CONFIG)),
      },
    })

    console.log('✅ Created sample project:', sampleProject.title)

    // Create sample scenes
    const sampleScenes = [
      {
        projectId: sampleProject.id,
        index: 0,
        text: '深夜時分，李明獨自走在回家的路上。街燈昏暗，四周寂靜得令人不安。',
        prompt: null,
      },
      {
        projectId: sampleProject.id,
        index: 1,
        text: '突然，他聽到身後傳來腳步聲，但當他回頭時，卻什麼也沒看到。',
        prompt: null,
      },
      {
        projectId: sampleProject.id,
        index: 2,
        text: '腳步聲越來越近，李明開始加快步伐，心跳聲在寂靜的夜晚顯得格外響亮。',
        prompt: null,
      },
    ]

    for (const scene of sampleScenes) {
      await prisma.scene.upsert({
        where: {
          projectId_index: {
            projectId: scene.projectId,
            index: scene.index,
          },
        },
        update: {},
        create: scene,
      })
    }

    console.log('✅ Created sample scenes')
  }

  console.log('🎉 Database seed completed!')
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
