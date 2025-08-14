import { UserRole } from '@prisma/client'
import { UserSettings } from './index'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string
      image?: string
      role: UserRole
      settings?: UserSettings
    }
  }

  interface User {
    id: string
    email: string
    name?: string
    image?: string
    role: UserRole
    settings?: UserSettings
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    settings?: UserSettings
  }
}
