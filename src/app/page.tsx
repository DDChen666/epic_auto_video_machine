'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Textarea,
  Badge,
  Progress,
  Spinner,
  Toggle,
  Select,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalContent,
  ModalFooter,
  useToast,
  ToastContainer,
} from '@/components/ui'
import { ThemeToggle } from '@/components/theme-toggle'

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false)
  const [toggleValue, setToggleValue] = useState(false)
  const [selectValue, setSelectValue] = useState('')
  const [progress, setProgress] = useState(65)
  const { toasts, addToast, removeToast } = useToast()

  const selectOptions = [
    { value: '9:16', label: '9:16 (直式短片)', icon: '📱' },
    { value: '16:9', label: '16:9 (橫式影片)', icon: '🖥️' },
    { value: '1:1', label: '1:1 (方形貼文)', icon: '⬜' },
  ]

  const showToast = (type: 'success' | 'error' | 'warning' | 'info') => {
    addToast({
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Toast`,
      message: `This is a ${type} toast notification with Epic Auto Video Machine styling.`,
      duration: 5000,
    })
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="glass-card border-b border-glass-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <h1 className="text-xl font-bold gradient-text">
                Epic Auto Video Machine
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="gradient" size="sm">
                Design System
              </Badge>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold gradient-text mb-4">
            設計系統展示
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            展示 Epic Auto Video Machine 的完整設計系統，包含玻璃擬態效果、漸層色彩和流暢動效。
          </p>
        </motion.div>

        {/* Components Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Buttons */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>按鈕元件</CardTitle>
              <CardDescription>
                各種樣式和尺寸的按鈕元件
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="default">預設按鈕</Button>
                <Button variant="gradient">漸層按鈕</Button>
                <Button variant="glass">玻璃按鈕</Button>
                <Button variant="outline">外框按鈕</Button>
                <Button variant="ghost">幽靈按鈕</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="xs">極小</Button>
                <Button size="sm">小型</Button>
                <Button size="default">預設</Button>
                <Button size="lg">大型</Button>
              </div>
              <div className="flex gap-2">
                <Button loading>載入中</Button>
                <Button leftIcon="🚀">左圖示</Button>
                <Button rightIcon="→">右圖示</Button>
              </div>
            </CardContent>
          </Card>

          {/* Form Elements */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>表單元件</CardTitle>
              <CardDescription>
                輸入框、選擇器和其他表單元件
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="專案名稱"
                placeholder="輸入您的專案名稱..."
                variant="glass"
              />
              <Textarea
                label="專案描述"
                placeholder="描述您的影片內容..."
                variant="glass"
                rows={3}
              />
              <Select
                label="影片比例"
                options={selectOptions}
                value={selectValue}
                onChange={setSelectValue}
                placeholder="選擇影片比例..."
                variant="glass"
              />
            </CardContent>
          </Card>

          {/* Progress & Loading */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>進度與載入</CardTitle>
              <CardDescription>
                進度條和載入動畫元件
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Progress
                  value={progress}
                  variant="gradient"
                  label="影片生成進度"
                  showValue
                  animated
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    size="xs"
                    onClick={() => setProgress(Math.max(0, progress - 10))}
                  >
                    -10%
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => setProgress(Math.min(100, progress + 10))}
                  >
                    +10%
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Spinner variant="gradient" text="處理中..." />
                <Spinner variant="dots" size="lg" />
              </div>
            </CardContent>
          </Card>

          {/* Interactive Elements */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>互動元件</CardTitle>
              <CardDescription>
                開關、徽章和其他互動元件
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle
                checked={toggleValue}
                onChange={setToggleValue}
                label="啟用背景音樂"
                description="為影片添加背景音樂"
                variant="gradient"
              />
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">預設</Badge>
                <Badge variant="secondary">次要</Badge>
                <Badge variant="success">成功</Badge>
                <Badge variant="warning">警告</Badge>
                <Badge variant="error">錯誤</Badge>
                <Badge variant="glass">玻璃</Badge>
                <Badge variant="gradient">漸層</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Modal & Toast */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>彈窗與通知</CardTitle>
              <CardDescription>
                模態框和吐司通知元件
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => setModalOpen(true)} variant="gradient">
                開啟模態框
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => showToast('success')}
                >
                  成功通知
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => showToast('error')}
                >
                  錯誤通知
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => showToast('warning')}
                >
                  警告通知
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => showToast('info')}
                >
                  資訊通知
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Template Showcase */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>模板風格</CardTitle>
              <CardDescription>
                三種預設模板的視覺風格展示
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="template-classic p-4 rounded-card border">
                  <h4 className="font-semibold text-gray-800">Classic Clean</h4>
                  <p className="text-sm text-gray-600">白底細陰影 + 輕轉場</p>
                </div>
                <div className="template-dark p-4 rounded-card border text-white">
                  <h4 className="font-semibold">Dark Glass</h4>
                  <p className="text-sm text-gray-300">深色玻璃擬態風格</p>
                </div>
                <div className="template-vivid p-4 rounded-card border text-white">
                  <h4 className="font-semibold">Vivid Gradient</h4>
                  <p className="text-sm text-gray-100">鮮豔漸層背景</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <ModalHeader>
          <ModalTitle>Epic Auto Video Machine</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <p className="text-gray-600 dark:text-gray-400">
            這是一個使用玻璃擬態效果的模態框，展示了我們的設計系統如何創造出現代化和高級感的使用者介面。
          </p>
          <div className="mt-4 p-4 glass rounded-card">
            <h4 className="font-semibold mb-2">設計特色：</h4>
            <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
              <li>• 玻璃擬態背景效果</li>
              <li>• 流暢的動畫轉場</li>
              <li>• 漸層色彩系統</li>
              <li>• 響應式設計</li>
            </ul>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            取消
          </Button>
          <Button variant="gradient" onClick={() => setModalOpen(false)}>
            確認
          </Button>
        </ModalFooter>
      </Modal>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
