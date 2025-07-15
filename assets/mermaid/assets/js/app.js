// Mermaid 特有的应用逻辑
class MermaidApp {
    constructor() {
        this.manager = null
        this.currentMermaidCode = ''
        this.lastContentSnapshot = null // 上一次内容快照
        this.zoomLevel = 1.0
        this.isDragging = false
        this.previewOffsetX = 0
        this.previewOffsetY = 0
        this.init()
    }

    async init() {
        // 初始化统一管理器
        const urlParams = new URLSearchParams(window.location.search)
        const fileId = urlParams.get('file')
        
        if (!fileId) {
            this.showError('❌ No file ID parameter')
            return
        }
        
        // 先创建管理器实例但不初始化
        this.manager = new MermaidManager({
            fileId: fileId,
            path: 'Loading...',
            saveEndpoint: `/save/${fileId}`,
            autoSaveEnabled: false, // 先设为false，避免过早初始化
            onSave: (data) => {
                console.log('Mermaid data saved:', data)
                // 保存成功后更新快照
                if (data && data.mermaidCode) {
                    this.lastContentSnapshot = this.createContentSnapshot(data.mermaidCode)
                }
            },
            onRefresh: (data) => {
                this.handleFileChange(data)
            }
        })
        
        // 扩展管理器的方法（在manager初始化之前）
        this.setupManagerExtensions()
        
        // 现在启用自动保存并手动调用setupChangeListener
        this.manager.autoSaveEnabled = true
        this.manager.setupChangeListener()
        
        // 异步获取并更新文件路径（延迟一点确保DOM准备好）
        setTimeout(() => {
            this.updateFilePathDisplay(fileId)
        }, 200)
        
        // 初始化Mermaid编辑器
        await this.initMermaidEditor()
        
        // 设置事件监听
        this.setupEventListeners()
    }
    
    // 创建内容快照（只包含真正的内容数据）
    createContentSnapshot(mermaidCode) {
        return {
            content: mermaidCode ? mermaidCode.trim() : '',
            length: mermaidCode ? mermaidCode.length : 0
        }
    }
    
    // 检测内容是否真正发生变化
    isContentChanged(oldSnapshot, newSnapshot) {
        if (!oldSnapshot || !newSnapshot) return true
        return oldSnapshot.content !== newSnapshot.content
    }
        
    async updateFilePathDisplay(fileId) {
        try {
            const response = await fetch(`/file-info/${fileId}`)
            if (response.ok) {
                const data = await response.json()
                const filePath = data.filePath || 'Unknown File'
                
                // 更新顶部工具栏的文件路径显示
                const filePathEl = document.getElementById('prototype-path')
                if (filePathEl) {
                    filePathEl.textContent = filePath
                }
                
                // 更新manager的路径
                if (this.manager) {
                    this.manager.prototypePath = filePath
                }
            }
        } catch (error) {
            console.error('Failed to get file path:', error)
            const pathEl = document.getElementById('prototype-path')
            if (pathEl) {
                pathEl.textContent = 'Unknown File'
            }
        }
    }
    
    setupManagerExtensions() {
        // 扩展统一管理器的方法
        this.manager.setupChangeListener = () => {
            const editor = document.getElementById('editor')
            if (editor) {
                editor.addEventListener('input', (e) => {
                    const mermaidCode = e.target.value
                    
                    // 始终更新当前代码和渲染（实时更新）
                    this.currentMermaidCode = mermaidCode
                    this.renderMermaid(mermaidCode)
                    
                    // 创建当前内容快照
                    const currentSnapshot = this.createContentSnapshot(mermaidCode)
                    
                    // 检测是否有真正的内容变化，只有内容变化时才保存
                    if (this.isContentChanged(this.lastContentSnapshot, currentSnapshot)) {
                        console.log('Content changed, saving to server')
                        this.lastContentSnapshot = currentSnapshot
                        this.manager.save({ mermaidCode })
                    } else {
                        console.log('Only whitespace or formatting changed, preview updated but not saved')
                    }
                })
            }
        }
        
        this.manager.triggerSave = () => {
            const editor = document.getElementById('editor')
            if (editor) {
                const mermaidCode = editor.value
                this.manager.save({ mermaidCode })
            }
        }
        
        this.manager.handleFileChange = (data) => {
            this.handleFileChange(data)
        }
    }
    
    async initMermaidEditor() {
        // 初始化Mermaid库
        if (typeof mermaid === 'undefined') {
            this.showError('❌ Mermaid library not loaded')
            return
        }

        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose',
            themeVariables: {
                primaryColor: '#007bff',
                primaryTextColor: '#fff',
                primaryBorderColor: '#007bff',
                lineColor: '#333',
                secondaryColor: '#f8f9fa',
                tertiaryColor: '#fff'
            }
        })
        
        // 加载初始文件
        await this.loadInitialFile()
    }
    
    async loadInitialFile() {
        const urlParams = new URLSearchParams(window.location.search)
        const fileId = urlParams.get('file')
        
        if (!fileId) {
            this.showError('❌ No file ID specified')
            return
        }

        try {
            console.log('Loading initial file from server...')
            const response = await fetch(`/file/${fileId}`)
            
            if (!response.ok) {
                throw new Error(`File request failed: ${response.status} ${response.statusText}`)
            }
            
            const data = await response.json()
            const mermaidCode = data.mermaidCode || ''
            console.log('Loaded initial content:', mermaidCode.slice(0, 50) + '...')
            
            this.currentMermaidCode = mermaidCode
            
            const editor = document.getElementById('editor')
            if (editor) {
                console.log('Setting editor value...')
                editor.value = mermaidCode
            }
            
            await this.renderMermaid(mermaidCode)
            // 设置初始内容快照
            this.lastContentSnapshot = this.createContentSnapshot(mermaidCode)
            console.log('Initial snapshot set:', this.lastContentSnapshot)
            this.manager.showSaveStatus('Loaded', 2000)
            
        } catch (error) {
            console.error('Load failed:', error)
            this.showError(`❌ Loading failed: ${error.message}`)
        }
    }
    
    setupEventListeners() {
        // 设置缩放、截图等按钮的事件监听
        const zoomOutBtn = document.getElementById('zoom-out')
        const zoomInBtn = document.getElementById('zoom-in')
        const zoomDisplay = document.getElementById('zoom-display')
        const screenshotBtn = document.getElementById('screenshot-btn')
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomOut())
        }
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomIn())
        }
        
        if (zoomDisplay) {
            zoomDisplay.addEventListener('click', () => this.resetZoom())
        }
        
        if (screenshotBtn) {
            screenshotBtn.addEventListener('click', () => this.takeScreenshot())
        }
        
        // 初始化拖拽和调整大小功能
        this.initResizer()
    }
    
    handleFileChange(data) {
        // 处理文件变化，更新编辑器内容
        if (data && data.mermaidCode && data.mermaidCode !== this.currentMermaidCode) {
            console.log('File changed from server, updating editor content')
            this.currentMermaidCode = data.mermaidCode
            const editor = document.getElementById('editor')
            if (editor) {
                // 关键修复：在设置editor.value之前先更新快照
                // 避免触发input事件时产生重复保存
                this.lastContentSnapshot = this.createContentSnapshot(data.mermaidCode)
                
                editor.value = data.mermaidCode
                this.renderMermaid(data.mermaidCode)
            }
        }
    }

    async renderMermaid(code) {
        const preview = document.getElementById('preview')
        
        if (!preview) return
        
        if (!code.trim()) {
            preview.innerHTML = '<div class="loading"><div>📝 Please enter Mermaid code</div></div>'
            return
        }

        try {
            // 清空预览区域
            preview.innerHTML = ''
            
            // 创建新的mermaid元素
            const element = document.createElement('div')
            element.className = 'mermaid'
            element.textContent = code
            preview.appendChild(element)
            
            // 重新初始化mermaid以清除缓存
            await mermaid.run({
                querySelector: '.mermaid',
                suppressErrors: false
            })
            
            // 渲染完成后应用缩放和拖动
            setTimeout(() => {
                this.applyZoom()
                this.initDragPreview()
            }, 50)
            
        } catch (error) {
            console.error('Mermaid rendering error:', error)
            this.showError(`Rendering error: ${error.message || 'Diagram syntax error, please check Mermaid code'}`)
        }
    }

    // 缩放功能
    updateZoomDisplay() {
        const display = document.getElementById('zoom-display')
        if (display) {
            display.textContent = Math.round(this.zoomLevel * 100) + '%'
        }
    }

    applyZoom() {
        const preview = document.getElementById('preview')
        const mermaidElement = preview?.querySelector('.mermaid')
        
        if (mermaidElement) {
            const translateX = this.previewOffsetX / this.zoomLevel
            const translateY = this.previewOffsetY / this.zoomLevel
            mermaidElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${this.zoomLevel})`
            mermaidElement.style.transformOrigin = 'center'
            
            const container = mermaidElement.parentElement
            if (container) {
                container.style.overflow = this.zoomLevel > 1 || this.previewOffsetX !== 0 || this.previewOffsetY !== 0 ? 'auto' : 'hidden'
            }
        }
        
        this.updateZoomDisplay()
    }

    zoomIn() {
        if (this.zoomLevel < 5.0) {
            this.zoomLevel += 0.1
            this.applyZoom()
        }
    }

    zoomOut() {
        if (this.zoomLevel > 0.1) {
            this.zoomLevel -= 0.1
            this.applyZoom()
        }
    }

    resetZoom() {
        this.zoomLevel = 1.0
        this.previewOffsetX = 0
        this.previewOffsetY = 0
        this.applyZoom()
    }

    // 截图功能
    async takeScreenshot() {
        const preview = document.getElementById('preview')
        const mermaidElement = preview?.querySelector('.mermaid svg')
        
        if (!mermaidElement) {
            this.manager.showSaveStatus('❌ No diagram to screenshot', 3000)
            return
        }

        try {
            this.manager.showSaveStatus('📸 Taking screenshot...', 0) // 不自动消失，等成功或失败消息覆盖
            
            // 克隆SVG元素
            const svgClone = mermaidElement.cloneNode(true)
            
            // 获取SVG的实际尺寸
            const svgRect = mermaidElement.getBoundingClientRect()
            const svgWidth = svgRect.width
            const svgHeight = svgRect.height
            
            // 确保SVG有明确的尺寸属性
            svgClone.setAttribute('width', svgWidth)
            svgClone.setAttribute('height', svgHeight)
            
            // 添加白色背景
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
            rect.setAttribute('width', '100%')
            rect.setAttribute('height', '100%')
            rect.setAttribute('fill', '#ffffff')
            svgClone.insertBefore(rect, svgClone.firstChild)
            
            // 序列化SVG并转换为base64 data URL
            const svgData = new XMLSerializer().serializeToString(svgClone)
            const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
            
            // 创建Canvas
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            // 设置高DPI支持
            const dpr = window.devicePixelRatio || 1
            canvas.width = svgWidth * dpr
            canvas.height = svgHeight * dpr
            canvas.style.width = svgWidth + 'px'
            canvas.style.height = svgHeight + 'px'
            ctx.scale(dpr, dpr)
            
            // 加载和绘制图片
            const img = new Image()
            img.onload = () => {
                try {
                    // 设置白色背景
                    ctx.fillStyle = '#ffffff'
                    ctx.fillRect(0, 0, svgWidth, svgHeight)
                    
                    // 绘制SVG
                    ctx.drawImage(img, 0, 0, svgWidth, svgHeight)
                    
                    // 保存图片
                    canvas.toBlob(async (blob) => {
                        try {
                            await this.saveScreenshotToServer(blob)
                            this.manager.showSaveStatus('Screenshot saved to vscode workspace', 5000)
                        } catch (error) {
                            console.error('Failed to save screenshot:', error)
                            // 回退到浏览器下载
                            const link = document.createElement('a')
                            link.download = this.getScreenshotFileName()
                            link.href = URL.createObjectURL(blob)
                            link.click()
                            URL.revokeObjectURL(link.href)
                            this.manager.showSaveStatus('📷 Screenshot downloaded', 3000)
                        }
                    }, 'image/png')
                    
                } catch (drawError) {
                    console.error('Drawing error:', drawError)
                    this.manager.showSaveStatus('❌ Drawing failed', 5000)
                }
            }
            
            img.onerror = () => {
                console.error('Image loading failed')
                this.manager.showSaveStatus('❌ Image loading failed', 5000)
            }
            
            img.src = svgDataUrl
            
        } catch (error) {
            console.error('Screenshot failed:', error)
            this.manager.showSaveStatus(`❌ Screenshot failed: ${error.message}`, 5000)
        }
    }

    getScreenshotFileName() {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const hour = String(now.getHours()).padStart(2, '0')
        const minute = String(now.getMinutes()).padStart(2, '0')
        const second = String(now.getSeconds()).padStart(2, '0')
        
        const timestamp = `${year}-${month}-${day}_${hour}-${minute}-${second}`
        return `mermaid-diagram-${timestamp}.png`
    }
    
    async saveScreenshotToServer(blob) {
        const urlParams = new URLSearchParams(window.location.search)
        const fileId = urlParams.get('file')
        
        if (!fileId) {
            throw new Error('No file ID available')
        }

        const arrayBuffer = await blob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        const response = await fetch(`/save-screenshot/${fileId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                },
                body: uint8Array
        })
            
            if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Failed to save screenshot: ${response.status} ${response.statusText} - ${errorText}`)
        }
    }

    // 图表拖动功能
    initDragPreview() {
        const preview = document.getElementById('preview')
        const mermaidElement = preview?.querySelector('.mermaid')
        
        if (!mermaidElement) return

        // 移除旧的事件监听器
        if (mermaidElement._dragListeners) {
            mermaidElement.removeEventListener('mousedown', mermaidElement._dragListeners.mousedown)
            document.removeEventListener('mousemove', mermaidElement._dragListeners.mousemove)
            document.removeEventListener('mouseup', mermaidElement._dragListeners.mouseup)
        }

        let startX = 0
        let startY = 0
        let initialOffsetX = 0
        let initialOffsetY = 0

        const handleMouseDown = (e) => {
            this.isDragging = true
            startX = e.clientX
            startY = e.clientY
            initialOffsetX = this.previewOffsetX
            initialOffsetY = this.previewOffsetY
            
            document.body.style.cursor = 'grabbing'
            document.body.style.userSelect = 'none'
            e.preventDefault()
        }

        const handleMouseMove = (e) => {
            if (!this.isDragging) return
            
            const deltaX = e.clientX - startX
            const deltaY = e.clientY - startY
            
            this.previewOffsetX = initialOffsetX + deltaX
            this.previewOffsetY = initialOffsetY + deltaY
            
            this.applyZoom()
        }

        const handleMouseUp = () => {
            if (this.isDragging) {
                this.isDragging = false
                document.body.style.cursor = ''
                document.body.style.userSelect = ''
            }
        }

        mermaidElement._dragListeners = {
            mousedown: handleMouseDown,
            mousemove: handleMouseMove,
            mouseup: handleMouseUp
        }

        mermaidElement.addEventListener('mousedown', handleMouseDown)
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }
    
    // 分割线调整功能
    initResizer() {
        const resizer = document.getElementById('resizer')
        if (!resizer) {
            console.warn('Resizer element not found')
            return
        }
        
        let isResizing = false

        const handleMouseDown = (e) => {
            console.log('Resizer mouse down')
            isResizing = true
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
            e.preventDefault()
        }

        const handleMouseMove = (e) => {
            if (!isResizing) return

            const container = document.querySelector('.container')
            const containerRect = container.getBoundingClientRect()
            const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

            // 限制在合理范围内
            if (newLeftWidth > 15 && newLeftWidth < 85) {
                document.documentElement.style.setProperty('--editor-width', `${newLeftWidth}%`)
                console.log('Setting editor width to:', `${newLeftWidth}%`)
            }
        }

        const handleMouseUp = () => {
            console.log('Resizer mouse up')
            isResizing = false
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }

        resizer.addEventListener('mousedown', handleMouseDown)
        console.log('Resizer initialized successfully')
    }

    showError(message) {
        const preview = document.getElementById('preview')
        if (preview) {
            preview.innerHTML = `<div class="loading"><div>${message}</div></div>`
        }
        this.manager.showSaveStatus(message, 5000)
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new MermaidApp()
}) 