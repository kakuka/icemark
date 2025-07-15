// Markdown 特有的应用逻辑
class MarkdownApp {
    constructor() {
        this.editor = null
        this.manager = null
        this.currentFileId = null
        this.fileWatcher = null
        this.lastContentSnapshot = null
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
        this.manager = new MarkdownManager({
            fileId: fileId,
            path: 'Loading...',
            saveEndpoint: `/save/${fileId}`,
            autoSaveEnabled: false, // 先设为false，避免过早初始化
            onSave: (data) => {
                // 保存成功后更新快照
                if (data && data.markdownContent) {
                    this.lastContentSnapshot = this.createContentSnapshot(data.markdownContent)
                }
            },
            onRefresh: (data) => {
                this.handleFileChange(data)
            }
        })
        
        // 扩展管理器的方法（在manager初始化之前）
        this.setupManagerExtensions()
        
        // 异步获取并更新文件路径（延迟一点确保DOM准备好）
        setTimeout(() => {
            this.updateFilePathDisplay(fileId)
        }, 200)
        
        // 初始化Markdown编辑器
        await this.initMarkdownEditor()
        
        // 现在启用自动保存并手动调用setupChangeListener（在editor初始化之后）
        this.manager.autoSaveEnabled = true
        this.manager.setupChangeListener()
        
        // 设置事件监听
        this.setupEventListeners()
    }
    
    // 创建内容快照（只包含真正的内容数据）
    createContentSnapshot(markdownContent) {
        return {
            content: markdownContent ? markdownContent.trim() : '',
            length: markdownContent ? markdownContent.length : 0
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
                
                // 更新工具栏中的文件路径
                const pathElement = document.getElementById('prototype-path')
                if (pathElement) {
                    pathElement.textContent = filePath
                }
                
                // 更新管理器中的路径
                if (this.manager) {
                    this.manager.prototypePath = filePath
                }
            }
        } catch (error) {
            console.error('Failed to update file path:', error)
        }
    }
    
    setupManagerExtensions() {
        // 扩展统一管理器的方法
        this.manager.setupChangeListener = () => {
            if (this.editor) {
                this.editor.addEventListener('input', (e) => {
                    const markdownContent = e.target.value
                    
                    // 始终更新预览（实时更新）
                    this.renderMarkdown(markdownContent)
                    
                    // 创建当前内容快照
                    const currentSnapshot = this.createContentSnapshot(markdownContent)
                    
                    // 检测是否有真正的内容变化，只有内容变化时才保存
                    if (this.isContentChanged(this.lastContentSnapshot, currentSnapshot)) {
                        console.log('Content changed, saving to server')
                        this.lastContentSnapshot = currentSnapshot
                        this.manager.save({ markdownContent })
                    } else {
                        console.log('Only whitespace or formatting changed, preview updated but not saved')
                    }
                })
            }
        }
        
        this.manager.triggerSave = () => {
            if (this.editor) {
                const markdownContent = this.editor.value
                this.manager.save({ markdownContent })
            }
        }
        
        this.manager.handleFileChange = (data) => {
            this.handleFileChange(data)
        }
    }

    async initMarkdownEditor() {
        // 确保marked.js已加载
        if (typeof marked === 'undefined') {
            this.showError('❌ Marked.js library not loaded')
            return
        }
        
        // 配置marked.js
        if (typeof hljs !== 'undefined') {
            marked.setOptions({
                highlight: function(code, lang) {
                    if (lang && hljs.getLanguage(lang)) {
                        try {
                            return hljs.highlight(code, { language: lang }).value
                        } catch (err) {
                            console.warn('Highlight error:', err)
                        }
                    }
                    return hljs.highlightAuto(code).value
                },
                langPrefix: 'hljs language-'
            })
        }
        
        // 加载初始文件
        await this.loadInitialFile()
    }
    
    async loadInitialFile() {
        try {
            const urlParams = new URLSearchParams(window.location.search)
            const fileId = urlParams.get('file')
            
            if (!fileId) {
                this.showError('❌ No file ID parameter')
                return
            }
            
            const response = await fetch(`/file/${fileId}`)
            if (!response.ok) {
                throw new Error(`Failed to load file: ${response.status}`)
            }
            
            const data = await response.json()
            const markdownContent = data.markdownContent || ''
            
            // 设置编辑器内容
            this.editor = document.getElementById('editor')
            if (this.editor) {
                this.editor.value = markdownContent
                this.currentMarkdownContent = markdownContent
                
                // 创建初始快照
                this.lastContentSnapshot = this.createContentSnapshot(markdownContent)
                
                // 渲染预览
                await this.renderMarkdown(markdownContent)
                
                // 更新最后修改时间
                if (this.manager) {
                    await this.manager.updateLastModified()
                }
            }
        } catch (error) {
            console.error('Failed to load initial file:', error)
            this.showError(`❌ Failed to load file: ${error.message}`)
        }
    }
    
    setupEventListeners() {
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault()
                if (this.manager) {
                    this.manager.saveFile()
                }
            }
        })
        
        // 截图按钮
        const screenshotBtn = document.getElementById('screenshot-btn')
        if (screenshotBtn) {
            screenshotBtn.addEventListener('click', () => this.takeScreenshot())
        }
        
        // 调整器
        this.initResizer()
    }
    
    handleFileChange(_data) {
        // 重新加载文件内容
        this.loadInitialFile()
        
        // 显示提示
        if (this.manager) {
            this.manager.showSaveStatus('File updated from external changes', 3000)
        }
    }
    
    async renderMarkdown(content) {
        const preview = document.getElementById('preview')
        if (!preview) return
        
        try {
            if (!content.trim()) {
                preview.innerHTML = '<div class="loading"><div>📝 Start typing to see preview...</div></div>'
                return
            }
            
            // 先正常渲染Markdown
            const html = marked.parse(content, {
                gfm: true,
                breaks: true
            })
            
            // 然后替换mermaid代码块
            const processedHtml = html.replace(
                /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
                (match, mermaidCode) => {
                    const id = 'mermaid-' + Math.random().toString(36).substr(2, 9)
                    return `<div class="mermaid-container">
                        <div class="mermaid" id="${id}">${mermaidCode}</div>
                    </div>`
                }
            )
            
            preview.innerHTML = processedHtml
            
            // 初始化Mermaid图表
            await this.initMermaidDiagrams()
            
        } catch (error) {
            console.error('Markdown render error:', error)
            preview.innerHTML = `<div class="error"><div>❌ Render error: ${error.message}</div></div>`
        }
    }
    
    async initMermaidDiagrams() {
        const mermaidElements = document.querySelectorAll('.mermaid')
        if (mermaidElements.length === 0) {
            return
        }
        
        try {
            // 初始化Mermaid
            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose',
                fontFamily: 'arial',
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true
                }
            })
            
            // 渲染每个mermaid图表
            let svgCounter = 0
            for (const element of mermaidElements) {
                if (element.textContent.trim()) {
                    try {
                        const svgId = `mermaid-svg-${svgCounter++}`
                        const graphDefinition = element.textContent.trim()
                        
                        const renderResult = await mermaid.render(svgId, graphDefinition)
                        const svgContent = renderResult.svg || renderResult
                        
                        element.innerHTML = svgContent
                        
                    } catch (mermaidError) {
                        console.error('Mermaid render error:', mermaidError)
                        element.innerHTML = `<div class="error">❌ Mermaid render error: ${mermaidError.message}</div>`
                    }
                }
            }
            
        } catch (error) {
            console.error('Mermaid initialization error:', error)
        }
    }
    
    async takeScreenshot() {
        try {
            const previewContent = document.querySelector('.preview-content')
            if (!previewContent) {
                throw new Error('Preview content not found')
            }

            if (this.manager) {
                this.manager.showSaveStatus('📸 Taking screenshot...', 0)
            }

            // 保存原始样式
            const originalStyles = {
                overflow: previewContent.style.overflow,
                height: previewContent.style.height,
                maxHeight: previewContent.style.maxHeight
            }

            // 临时设置样式，让所有内容都可见
            previewContent.style.overflow = 'visible'
            previewContent.style.height = previewContent.scrollHeight + 'px'
            previewContent.style.maxHeight = 'none'

            // 等待样式生效
            await new Promise(resolve => setTimeout(resolve, 100))

            // 动态加载html2canvas
            const html2canvas = window.html2canvas || (await this.loadHtml2Canvas())

            // 截图preview-content，确保捕获完整高度
            const canvas = await html2canvas(previewContent, {
                backgroundColor: '#ffffff',
                scale: 1,
                useCORS: true,
                allowTaint: false,
                foreignObjectRendering: false,
                logging: false,
                width: previewContent.scrollWidth,
                height: previewContent.scrollHeight,
                ignoreElements: (element) => {
                    return element.classList?.contains('loading') || element.classList?.contains('error')
                }
            })

            // 恢复原始样式
            Object.assign(previewContent.style, originalStyles)

            // 转换为blob
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png')
            })

            if (!blob) {
                throw new Error('Failed to create image blob')
            }

            // 上传到服务器
            await this.saveScreenshotToServer(blob)

        } catch (error) {
            console.error('Screenshot error:', error)
            if (this.manager) {
                this.manager.showSaveStatus(`❌ Screenshot failed: ${error.message}`, 3000)
            }
        }
    }
    
    async loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (window.html2canvas) {
                resolve(window.html2canvas)
                return
            }
            
            const script = document.createElement('script')
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
            script.onload = () => {
                resolve(window.html2canvas)
            }
            script.onerror = reject
            document.head.appendChild(script)
        })
    }
    
    getScreenshotFileName() {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const hour = String(now.getHours()).padStart(2, '0')
        const minute = String(now.getMinutes()).padStart(2, '0')
        const second = String(now.getSeconds()).padStart(2, '0')
        
        return `markdown-screenshot-${year}-${month}-${day}_${hour}-${minute}-${second}.png`
    }
    
    async saveScreenshotToServer(blob) {
        try {
            const urlParams = new URLSearchParams(window.location.search)
            const fileId = urlParams.get('file')
            
            if (!fileId) {
                throw new Error('No file ID available')
            }
            
            if (this.manager) {
                this.manager.showSaveStatus('Saving screenshot...', 0)
            }
            
            const response = await fetch(`/save-screenshot/${fileId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                body: blob
            })
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`)
            }
            
            const result = await response.json()
            
            if (this.manager) {
                this.manager.showSaveStatus(`Screenshot saved: ${result.path}`, 3000)
            }
            
        } catch (error) {
            console.error('Save screenshot error:', error)
            if (this.manager) {
                this.manager.showSaveStatus(`Save failed: ${error.message}`, 3000)
            }
            throw error
        }
    }
    
    initResizer() {
        const resizer = document.getElementById('resizer')
        if (!resizer) return
        
        let isResizing = false
        let startX = 0
        let startWidth = 0
        
        const handleMouseDown = (e) => {
            isResizing = true
            startX = e.clientX
            const editorPanel = document.querySelector('.editor-panel')
            if (editorPanel) {
                startWidth = editorPanel.offsetWidth
            }
            document.body.style.cursor = 'col-resize'
            e.preventDefault()
        }
        
        const handleMouseMove = (e) => {
            if (isResizing) {
                const deltaX = e.clientX - startX
                const newWidth = startWidth + deltaX
                const container = document.querySelector('.container')
                if (container) {
                    const containerWidth = container.offsetWidth
                    const minWidth = 200
                    const maxWidth = containerWidth - 300
                    const clampedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth))
                    const percentage = (clampedWidth / containerWidth) * 100
                    document.documentElement.style.setProperty('--editor-width', `${percentage}%`)
                }
            }
        }
        
        const handleMouseUp = () => {
            if (isResizing) {
                isResizing = false
                document.body.style.cursor = 'default'
            }
        }
        
        resizer.addEventListener('mousedown', handleMouseDown)
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }
    
    showError(message) {
        const preview = document.getElementById('preview')
        if (preview) {
            preview.innerHTML = `<div class="error"><div>${message}</div></div>`
        }
        console.error(message)
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MarkdownApp()
})