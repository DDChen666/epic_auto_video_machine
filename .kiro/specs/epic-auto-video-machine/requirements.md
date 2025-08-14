# Epic Auto Video Machine - 需求文檔

## 簡介

Epic Auto Video Machine 是一個全託管的雲端影片自動生成平台，讓用戶能夠將文字故事一鍵轉換為視覺化短片。系統採用 Gemini-first 的 API 編排架構，支援 9:16/16:9/1:1 三種影片比例，提供預設即好用的體驗，同時將進階設定收納在設定介面中。

核心價值主張：把故事檔拖進來 → 一鍵自動生成影片。

**MVP 交付流程：** 1) 拖拽上傳 → 2) 場景切分 → 3) 提示詞生成 → 4) 影像生成 → 5) TTS → 6) 自動合成 → 7) 下載/分享

**目標用戶：** 創作者（短影音、知識型創作者、品牌營運）、行銷企劃/小編、教育者/講師

**成功指標：**

- T1：首月 80% 新手用戶在 10 分鐘內完成首支影片
- T2：平均失敗率 < 3%，失敗任務 2 分鐘內可重試成功
- T3：預估成本 vs 實際成本誤差 < ±20%

## 需求

### 需求 1: 文件上傳與解析

**用戶故事：** 作為創作者，我想要能夠拖拽上傳各種格式的文字檔案，以便快速開始影片生成流程。

#### 驗收標準

1. WHEN 用戶拖拽 .txt/.md/.docx/.pdf 檔案到上傳區 THEN 系統 SHALL 立即開始解析並顯示進度
2. WHEN 檔案大小超過 5MB THEN 系統 SHALL 顯示錯誤訊息並拒絕上傳
3. WHEN 文字內容超過 50k 字元 THEN 系統 SHALL 顯示警告並提供截取選項
4. WHEN 上傳 PDF 檔案 THEN 系統 SHALL 自動執行文字抽取並在必要時使用 OCR
5. WHEN 解析完成 THEN 系統 SHALL 顯示字數統計並自動建立草稿專案

### 需求 2: 場景切分與預覽

**用戶故事：** 作為創作者，我想要系統能夠智慧地將我的故事切分成適合的場景，並讓我能夠預覽和調整。

#### 驗收標準

1. WHEN 文字解析完成 THEN 系統 SHALL 使用預設規則（100-280字為一場景）自動切分
2. WHEN 用戶選擇 LLM 輔助切分 THEN 系統 SHALL 使用 Gemini 提高語義一致性
3. WHEN 場景切分完成 THEN 系統 SHALL 提供可視化介面顯示每個場景
4. WHEN 用戶點擊場景 THEN 系統 SHALL 允許合併、拆分或重新排序
5. WHEN 用戶修改場景 THEN 系統 SHALL 即時更新場景數量和成本估算

### 需求 3: 模板選擇與配置

**用戶故事：** 作為創作者，我想要能夠選擇不同的影片模板和比例，以符合不同平台的需求。

#### 驗收標準

1. WHEN 用戶進入模板選擇 THEN 系統 SHALL 提供 9:16、16:9、1:1 三種比例選項
2. WHEN 用戶選擇比例 THEN 系統 SHALL 顯示對應的預覽框和安全區域指引
3. WHEN 用戶選擇模板 THEN 系統 SHALL 提供 Classic Clean、Dark Glass、Vivid Gradient 三種風格
4. WHEN 用戶選擇語音 THEN 系統 SHALL 提供男聲、女聲、自然聲三種選項
5. WHEN 配置完成 THEN 系統 SHALL 更新成本和時間估算

### 需求 4: 提示詞生成與預覽

**用戶故事：** 作為創作者，我想要系統能夠為每個場景生成高品質的圖像提示詞，並讓我能夠預覽和微調。

#### 驗收標準

1. WHEN 場景確認後 THEN 系統 SHALL 使用 Gemini 為每個場景生成英文化的視覺提示詞
2. WHEN 提示詞生成完成 THEN 系統 SHALL 顯示每個場景的提示詞預覽（一行摘要）
3. WHEN 用戶點擊「接受全部」THEN 系統 SHALL 確認所有提示詞並進入下一步
4. WHEN 用戶選擇逐條微調 THEN 系統 SHALL 允許編輯個別場景的提示詞
5. WHEN 提示詞包含違規內容 THEN 系統 SHALL 自動過濾並提供替代方案

### 需求 5: 圖像生成

**用戶故事：** 作為創作者，我想要系統能夠為每個場景生成高品質的圖像，並支援不同的影片比例。

#### 驗收標準

1. WHEN 提示詞確認後 THEN 系統 SHALL 使用 Gemini 圖像生成 API 為每場景生成 1-3 張圖片
2. WHEN 生成多張圖片 THEN 系統 SHALL 使用 CLIP-score 或簡單規則自動選擇最優圖片
3. WHEN 選擇 9:16 比例 THEN 系統 SHALL 生成 1080×1920 解析度的圖片
4. WHEN 選擇 16:9 比例 THEN 系統 SHALL 生成 1920×1080 解析度的圖片
5. WHEN 選擇 1:1 比例 THEN 系統 SHALL 生成 1080×1080 解析度的圖片
6. WHEN 圖像生成失敗 THEN 系統 SHALL 自動重試最多 3 次並記錄失敗原因

### 需求 6: TTS 語音合成

**用戶故事：** 作為創作者，我想要系統能夠將我的故事文字轉換為自然的語音旁白，並生成對應的字幕。

#### 驗收標準

1. WHEN 圖像生成完成 THEN 系統 SHALL 使用 Gemini TTS API 生成語音旁白
2. WHEN 生成語音 THEN 系統 SHALL 根據用戶選擇使用男聲、女聲或自然聲
3. WHEN 處理中文內容 THEN 系統 SHALL 使用台灣腔並保持 0.9-1.1 的語速範圍
4. WHEN 遇到標點符號 THEN 系統 SHALL 自動插入適當的停頓
5. WHEN TTS 完成 THEN 系統 SHALL 同時生成 SRT 和 VTT 格式的字幕檔案
6. WHEN 語音生成失敗 THEN 系統 SHALL 提供重試選項並保留原始文字

### 需求 7: 影片合成與渲染

**用戶故事：** 作為創作者，我想要系統能夠將圖片、語音和字幕自動合成為完整的影片。

#### 驗收標準

1. WHEN 所有素材準備完成 THEN 系統 SHALL 使用雲端渲染服務進行影片合成
2. WHEN 合成影片 THEN 系統 SHALL 在圖片間添加交叉淡化或縮放轉場效果
3. WHEN 處理音頻 THEN 系統 SHALL 進行 RMS 正規化並確保旁白優先（ducking）
4. WHEN 添加背景音樂 THEN 系統 SHALL 自動調整音量至 -18 LUFS
5. WHEN 渲染完成 THEN 系統 SHALL 生成最終的 MP4 檔案
6. WHEN 渲染失敗 THEN 系統 SHALL 提供詳細錯誤訊息並允許重新渲染

### 需求 8: 任務管理與狀態追蹤

**用戶故事：** 作為創作者，我想要能夠即時查看影片生成進度，並在需要時進行重試或回滾操作。

#### 驗收標準

1. WHEN 任務開始執行 THEN 系統 SHALL 顯示 DAG 進度面板，包含所有處理步驟
2. WHEN 任務進行中 THEN 系統 SHALL 即時更新每個步驟的狀態（QUEUED/RUNNING/SUCCEEDED/FAILED）
3. WHEN 任務失敗 THEN 系統 SHALL 自動重試最多 3 次，使用指數退避策略
4. WHEN 重試次數用盡 THEN 系統 SHALL 停在 FAILED 狀態並允許 partial resume
5. WHEN 用戶請求回滾 THEN 系統 SHALL 恢復到指定的歷史版本參數
6. WHEN 任務完成 THEN 系統 SHALL 保留完整的審計日誌和中繼檔案

### 需求 9: 檔案下載與分享

**用戶故事：** 作為創作者，我想要能夠下載完成的影片和相關檔案，並能夠分享給他人。

#### 驗收標準

1. WHEN 影片生成完成 THEN 系統 SHALL 提供 final.mp4 的下載連結
2. WHEN 用戶請求下載 THEN 系統 SHALL 同時提供 captions.srt、prompts.json 等相關檔案
3. WHEN 用戶選擇分享 THEN 系統 SHALL 生成 24-72 小時有效的簽名 URL
4. WHEN 用戶需要永久分享 THEN 系統 SHALL 提供公共頁面選項（可關閉）
5. WHEN 檔案過期 THEN 系統 SHALL 根據保留政策自動清理（預設 30 天）

### 需求 10: 成本估算與控制

**用戶故事：** 作為用戶，我想要在開始生成前了解預估成本，並在過程中追蹤實際費用。

#### 驗收標準

1. WHEN 用戶配置完成 THEN 系統 SHALL 顯示成本估算區間（±20% 誤差範圍）
2. WHEN 任務進行中 THEN 系統 SHALL 即時更新實際成本
3. WHEN 成本超出預算 THEN 系統 SHALL 發送警告並提供停止選項
4. WHEN 用戶啟用 BYO 金鑰 THEN 系統 SHALL 不計入平台費用
5. WHEN 達到用量配額 THEN 系統 SHALL 暫停新任務並通知用戶

### 需求 11: 用戶設定與偏好

**用戶故事：** 作為用戶，我想要能夠自訂預設設定和偏好，以提高工作效率。

#### 驗收標準

1. WHEN 用戶進入設定頁面 THEN 系統 SHALL 提供語言、時區、預設模板等一般設定
2. WHEN 用戶修改生成設定 THEN 系統 SHALL 允許調整單場景張數、轉場樣式、BGM 開關
3. WHEN 用戶配置內容安全 THEN 系統 SHALL 提供分級、禁用詞庫、錯誤處理策略選項
4. WHEN 用戶設定通知 THEN 系統 SHALL 支援 Email、Discord、Webhook 通知方式
5. WHEN 用戶提供 BYO 金鑰 THEN 系統 SHALL 安全儲存並在生成時使用

### 需求 12: 多租戶與權限管理

**用戶故事：** 作為平台管理員，我想要確保不同用戶的資料完全隔離，並提供適當的權限控制。

#### 驗收標準

1. WHEN 用戶註冊 THEN 系統 SHALL 使用 OAuth 登入並建立獨立的租戶空間
2. WHEN 存取資料 THEN 系統 SHALL 使用 Row Level Security 確保多租戶隔離
3. WHEN 處理敏感資料 THEN 系統 SHALL 使用靜態和傳輸加密
4. WHEN 用戶請求刪除 THEN 系統 SHALL 立即刪除所有相關資料（含備援）
5. WHEN 檢測到違規內容 THEN 系統 SHALL 自動攔截並記錄審計日誌

### 需求 13: 視覺設計與使用者體驗

**用戶故事：** 作為創作者，我想要使用一個具有高級感和直觀操作的介面來生成影片。

#### 驗收標準

1. WHEN 用戶進入首頁 THEN 系統 SHALL 顯示漸層主色（#7C3AED → #06B6D4）的現代化介面
2. WHEN 用戶操作介面 THEN 系統 SHALL 使用大圓角（24px）和柔和陰影的設計元素
3. WHEN 用戶上傳檔案 THEN 系統 SHALL 提供淡入/滑動動效和即時回饋
4. WHEN 任務完成 THEN 系統 SHALL 顯示彩帶/微粒子特效慶祝
5. WHEN 用戶需要進階設定 THEN 系統 SHALL 將複雜選項收納在「更多設定」中

### 需求 14: 預設模板與風格

**用戶故事：** 作為創作者，我想要選擇不同的視覺風格模板來匹配我的內容調性。

#### 驗收標準

1. WHEN 用戶選擇模板 THEN 系統 SHALL 提供 Classic Clean（白底細陰影）模板選項
2. WHEN 用戶選擇模板 THEN 系統 SHALL 提供 Dark Glass（深色玻璃擬態）模板選項
3. WHEN 用戶選擇模板 THEN 系統 SHALL 提供 Vivid Gradient（鮮豔漸層）模板選項
4. WHEN 用戶未選擇模板 THEN 系統 SHALL 預設使用 Classic Clean 模板
5. WHEN 模板套用 THEN 系統 SHALL 自動調整轉場效果和視覺元素風格

### 需求 15: 系統效能與可靠性

**用戶故事：** 作為用戶，我想要系統能夠穩定運行並在合理時間內完成影片生成。

#### 驗收標準

1. WHEN 系統運行 THEN 系統 SHALL 維持 99.5% API 可用性
2. WHEN 生成任務執行 THEN 系統 SHALL 在 15 分鐘內完成 99% 的任務（48 場景基準）
3. WHEN 用戶提交任務 THEN 系統 SHALL 在 30 秒內開始排程處理
4. WHEN 任務失敗 THEN 系統 SHALL 保持失敗率低於 3%
5. WHEN 系統負載高 THEN 系統 SHALL 自動擴展資源並維持效能

### 需求 16: 多語言與國際化

**用戶故事：** 作為不同地區的用戶，我想要使用符合我語言習慣的介面和語音。

#### 驗收標準

1. WHEN 用戶設定語言 THEN 系統 SHALL 支援繁體中文和英文介面
2. WHEN 生成 TTS THEN 系統 SHALL 預設使用台灣腔中文語音
3. WHEN 用戶選擇時區 THEN 系統 SHALL 根據時區顯示正確的時間資訊
4. WHEN 生成字幕 THEN 系統 SHALL 支援中文和英文字幕格式
5. WHEN 處理文字內容 THEN 系統 SHALL 正確處理全形/半形字符和標點符號
