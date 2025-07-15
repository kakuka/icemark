// HTML Viewer 应用逻辑
class HtmlViewerApp {
    constructor() {
        this.manager = null
        this.currentFile = null
        this.projectInfo = null
        this.files = []
        this.currentDevice = 'phone' // phone, pad, desktop, custom
        this.customSize = null
        this.zoomLevel = 1.0
        this.init()
    }
    
    // 根据项目路径判断设备类型
    getDeviceByPath(projectName) {
        if (!projectName) return 'phone'
        
        const path = projectName.toLowerCase()
        
        // 检查是否包含mobile相关关键词
        if (path.endsWith('html-mobile')) {
            return 'phone'
        }
        
        // 检查是否包含web相关关键词
        if (path.endsWith('html-web')) {
            return 'desktop'
        }
        
        // 检查是否包含pad相关关键词
        if (path.endsWith('html-pad')) {
            return 'pad'
        }
        
        // 默认返回phone
        return 'phone'
    }
    
    async init() {
        // 初始化统一管理器
        const urlParams = new URLSearchParams(window.location.search)
        const projectName = urlParams.get('project') || 'HTML Prototype'
        
        // 根据项目路径判断设备类型
        this.currentDevice = this.getDeviceByPath(projectName)
        
        // 先创建管理器实例但不启用自动刷新
        this.manager = new HtmlManager({
            fileId: null,
            path: projectName,
            autoRefreshEnabled: true,
            onRefresh: (data) => {
                this.handleFileChange(data)
            }
        })
        
        // 扩展管理器的方法
        this.setupManagerExtensions()
        
        // 异步获取并更新文件路径
        setTimeout(() => {
            this.updateProjectPathDisplay(projectName)
        }, 200)
        
        // 加载文件列表
        await this.loadFileList()
        
        // 设置事件监听
        this.setupEventListeners()
        
        // 初始化设备选择器和输入框（自动检测）
        this.switchDevice(this.currentDevice, null, true)
    }
    
    async updateProjectPathDisplay(projectName) {
        try {
            // 更新顶部工具栏的项目路径显示
            const filePathEl = document.getElementById('prototype-path')
            if (filePathEl) {
                filePathEl.textContent = projectName
            }
            
            // 更新manager的路径
            if (this.manager) {
                this.manager.prototypePath = projectName
            }
            
            // 根据新的路径重新判断设备类型
            const newDevice = this.getDeviceByPath(projectName)
            if (newDevice !== this.currentDevice) {
                this.switchDevice(newDevice, null, true)
            }
        } catch (error) {
            console.error('Failed to update project path:', error)
            const pathEl = document.getElementById('prototype-path')
            if (pathEl) {
                pathEl.textContent = 'Unknown Project'
            }
        }
    }
    
    setupManagerExtensions() {
        // 扩展统一管理器的方法
        this.manager.triggerRefresh = () => {
            // 自动刷新系统，手动刷新通过其他方式处理
            this.manager.showSaveStatus('Auto refresh enabled', 2000)
        }
        
        this.manager.handleFileChange = (data) => {
            this.handleFileChange(data)
        }
    }
    
    async loadFileList() {
        try {
            console.log('Loading file list from server...')
            const response = await fetch('/api/files')
            
            if (!response.ok) {
                throw new Error(`File request failed: ${response.status} ${response.statusText}`)
            }
            
            const result = await response.json()
            
            if (result.success) {
                this.files = result.files || []
                this.projectInfo = result.projectInfo
                this.renderFileList()
                
                // 加载默认文件
                if (this.files.length > 0) {
                    const defaultFile = this.files.find(f => f.name === 'index.html') || this.files[0]
                    this.loadFile(defaultFile)
                }
                
                this.manager.showSaveStatus('Files loaded', 2000)
            } else {
                throw new Error(result.message || 'Failed to load file list')
            }
        } catch (error) {
            console.error('Load file list failed:', error)
            this.showError(`Failed to load files: ${error.message}`)
        }
    }
    
    renderFileList() {
        const fileList = document.getElementById('file-list')
        if (!fileList) return
        
        fileList.innerHTML = ''
        
        if (this.files.length === 0) {
            fileList.innerHTML = '<li class="error"><div>❌ No HTML files found</div></li>'
            return
        }
        
        this.files.forEach((file, index) => {
            const li = document.createElement('li')
            li.innerHTML = `
                <span class="file-name">${file.name}</span>
                <span class="file-size">${this.formatFileSize(file.size || 0)}</span>
            `
            li.addEventListener('click', () => this.loadFile(file))
            fileList.appendChild(li)
            
            // 设置第一个文件为默认激活
            if (index === 0) {
                li.classList.add('active')
            }
        })
    }
    
    loadFile(file) {
        if (!file || !file.name) {
            console.error('Invalid file object:', file)
            return
        }
        
        try {
            console.log('Loading file:', file.name)
            this.currentFile = file
            
            // 更新文件列表的活动状态
            document.querySelectorAll('#file-list li').forEach((li, index) => {
                li.classList.toggle('active', this.files[index] === file)
            })
            
            // 更新文件路径显示
            const filePathEl = document.getElementById('file-path')
            if (filePathEl) {
                filePathEl.textContent = file.name
            }
            
            // 在iframe中加载HTML文件
            const iframe = document.getElementById('preview-frame')
            if (iframe) {
                const previewUrl = `/api/preview/${encodeURIComponent(file.name)}`
                iframe.src = previewUrl
            }
            
            // 应用视图模式
            this.applyViewMode()
            
            // 确保视图模式正确
            this.applyViewMode()
            
            this.manager.showSaveStatus(`Loaded: ${file.name}`, 2000)
            
        } catch (error) {
            console.error('Load file failed:', error)
            this.manager.showSaveStatus(`Load failed: ${file.name}`, 3000)
        }
    }
    
    setupEventListeners() {
        // 设置控制按钮的事件监听
        const browserBtn = document.getElementById('browser-btn')
        const screenshotBtn = document.getElementById('screenshot-btn')
        const zoomOutBtn = document.getElementById('zoom-out')
        const zoomInBtn = document.getElementById('zoom-in')
        const zoomDisplay = document.getElementById('zoom-display')
        
        if (browserBtn) {
            browserBtn.addEventListener('click', () => this.openInBrowser())
        }
        
        if (screenshotBtn) {
            screenshotBtn.addEventListener('click', () => this.takeScreenshot())
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomOut())
        }
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomIn())
        }
        
        if (zoomDisplay) {
            zoomDisplay.addEventListener('click', () => this.resetZoom())
        }
        
        // 设置设备选择器事件监听
        this.setupDeviceSelector()
        
        // 初始化拖拽调整大小功能
        this.initResizer()
    }
    
    setupDeviceSelector() {
        const deviceBtns = document.querySelectorAll('.device-btn')
        const customWidth = document.getElementById('custom-width')
        const customHeight = document.getElementById('custom-height')
        
        deviceBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const device = btn.getAttribute('data-device')
                this.switchDevice(device, null, false)
            })
        })
        
        // 设置自定义尺寸输入框事件
        if (customWidth && customHeight) {
            let debounceTimer = null
            
            const handleCustomSizeChange = () => {
                const width = parseInt(customWidth.value) || 0
                const height = parseInt(customHeight.value) || 0
                
                // 检查是否为用户手动输入（不是程序设置的值）
                const isUserInput = document.activeElement === customWidth || document.activeElement === customHeight
                
                if (isUserInput) {
                    // 立即取消预设按钮的激活状态
                    document.querySelectorAll('.device-btn').forEach(btn => {
                        btn.classList.remove('active')
                    })
                }
                
                // 防抖处理，避免频繁触发
                if (debounceTimer) {
                    clearTimeout(debounceTimer)
                }
                
                debounceTimer = setTimeout(() => {
                    // 只有在有效范围内才应用尺寸
                    if (width >= 200 && height >= 200) {
                        this.switchDevice('custom', { width, height }, false)
                    }
                }, 300)
            }
            
            customWidth.addEventListener('input', handleCustomSizeChange)
            customHeight.addEventListener('input', handleCustomSizeChange)
        }
    }
    
    switchDevice(device, customSize = null, isAutoSwitch = false) {
        if (!['phone', 'pad', 'desktop', 'custom'].includes(device)) {
            console.error('Invalid device type:', device)
            return
        }
        
        this.currentDevice = device
        this.customSize = customSize
        
        // 更新按钮激活状态
        if (device === 'custom') {
            // 自定义模式下，不激活任何预设按钮
            document.querySelectorAll('.device-btn').forEach(btn => {
                btn.classList.remove('active')
            })
        } else {
            document.querySelectorAll('.device-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-device') === device)
            })
        }
        
        // 更新自定义尺寸输入框
        const customWidth = document.getElementById('custom-width')
        const customHeight = document.getElementById('custom-height')
        
        if (customWidth && customHeight) {
            if (device === 'custom') {
                // 自定义尺寸模式，不需要改变输入框值
            } else {
                // 预定义设备，更新输入框显示对应尺寸
                const deviceSizes = {
                    phone: { width: 393, height: 852 },
                    pad: { width: 820, height: 1180 },
                    desktop: { width: 1920, height: 1080 }
                }
                
                const size = deviceSizes[device]
                if (size) {
                    customWidth.value = size.width
                    customHeight.value = size.height
                }
            }
        }
        
        // 应用视图模式
        this.applyViewMode()
        
        // 显示状态信息
        const deviceNames = {
            phone: 'iPhone 14 Pro',
            pad: 'iPad Air',
            desktop: 'PC',
            custom: 'Custom Size'
        }
        
        // 显示状态信息（手动切换和自动切换有不同的提示）
        if (this.manager && this.manager.showSaveStatus) {
            if (isAutoSwitch) {
                this.manager.showSaveStatus(`Auto-detected: ${deviceNames[device]}`, 2000)
            } else {
                this.manager.showSaveStatus(`Switched to ${deviceNames[device]}`, 2000)
            }
        }
    }
    
    handleFileChange(data) {
        // 处理文件变化，重新加载文件列表和当前预览
        if (data && (data.type === 'manual_refresh' || data.hasChanges)) {
            console.log('File changed from server, reloading...')
            this.loadFileList()
            if (this.currentFile) {
                this.refreshPreview()
            }
        }
    }
    
    applyViewMode() {
        const iframe = document.getElementById('preview-frame')
        const container = document.getElementById('preview-container')
        
        if (!iframe || !container) return
        
        // 清除之前的类名
        iframe.className = 'preview-frame'
        
        // 清除可能存在的内联宽高样式（避免覆盖CSS类样式）
        iframe.style.width = ''
        iframe.style.height = ''
        
        switch (this.currentDevice) {
            case 'phone':
                container.style.display = 'flex'
                container.style.justifyContent = 'center'
                container.style.alignItems = 'flex-start'
                container.style.padding = '20px'
                container.style.overflow = 'auto'
                
                iframe.classList.add('device-phone')
                iframe.style.transform = `scale(${this.zoomLevel})`
                iframe.style.transformOrigin = 'top center'
                break
                
            case 'pad':
                container.style.display = 'flex'
                container.style.justifyContent = 'center'
                container.style.alignItems = 'flex-start'
                container.style.padding = '20px'
                container.style.overflow = 'auto'
                
                iframe.classList.add('device-pad')
                iframe.style.transform = `scale(${this.zoomLevel})`
                iframe.style.transformOrigin = 'top center'
                break
                
            case 'desktop':
                container.style.display = 'block'
                container.style.padding = '0'
                container.style.overflow = 'hidden'
                
                iframe.classList.add('device-desktop')
                iframe.style.transform = `scale(${this.zoomLevel})`
                iframe.style.transformOrigin = 'top left'
                break
                
            case 'custom':
                container.style.display = 'flex'
                container.style.justifyContent = 'center'
                container.style.alignItems = 'flex-start'
                container.style.padding = '20px'
                container.style.overflow = 'auto'
                
                iframe.classList.add('device-custom')
                
                // 应用自定义尺寸（重新设置内联样式）
                if (this.customSize) {
                    iframe.style.width = `${this.customSize.width}px`
                    iframe.style.height = `${this.customSize.height}px`
                }
                
                iframe.style.transform = `scale(${this.zoomLevel})`
                iframe.style.transformOrigin = 'top center'
                break
        }
        
        this.updateZoomDisplay()
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }
    
    refreshPreview() {
        const iframe = document.getElementById('preview-frame')
        if (iframe && iframe.src) {
            // 添加时间戳强制刷新
            const url = new URL(iframe.src, window.location.origin)
            url.searchParams.set('_t', Date.now().toString())
            iframe.src = url.href
            this.manager.showSaveStatus('Preview refreshed', 2000)
        }
    }
    
    openInBrowser() {
        if (!this.currentFile) {
            this.manager.showSaveStatus('❌ Please select a file first', 3000)
            return
        }
        
        const previewUrl = `/api/preview/${encodeURIComponent(this.currentFile.name)}`
        window.open(previewUrl, '_blank')
        this.manager.showSaveStatus('Opened in browser', 2000)
    }
    
    async takeScreenshot() {
        if (!this.currentFile) {
            this.manager.showSaveStatus('❌ Please select a file first', 3000)
            return
        }

        try {
            this.manager.showSaveStatus('📸 Taking screenshot...', 0)
            
            const deviceInfo = this.getCurrentDeviceInfo()
            
            const response = await fetch('/api/screenshot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fileName: this.currentFile.name,
                    type: 'html-page',
                    deviceInfo: deviceInfo
                })
            })

            if (response.ok) {
                const _result = await response.json()
                this.manager.showSaveStatus('Screenshot saved to vscode workspace', 5000)
            } else {
                throw new Error('Screenshot request failed')
            }
        } catch (error) {
            console.error('Screenshot failed:', error)
            this.manager.showSaveStatus(`❌ Screenshot failed: ${error.message}`, 5000)
        }
    }
    
    getCurrentDeviceInfo() {
        const deviceInfo = {
            device: this.currentDevice,
            zoomLevel: this.zoomLevel
        }
        
        switch (this.currentDevice) {
            case 'phone':
                deviceInfo.width = 393
                deviceInfo.height = 852
                deviceInfo.name = 'iPhone 14 Pro'
                break
            case 'pad':
                deviceInfo.width = 820
                deviceInfo.height = 1180
                deviceInfo.name = 'iPad Air'
                break
            case 'desktop':
                deviceInfo.width = 1920
                deviceInfo.height = 1080
                deviceInfo.name = 'PC'
                break
            case 'custom':
                deviceInfo.width = this.customSize?.width || 393
                deviceInfo.height = this.customSize?.height || 852
                deviceInfo.name = `Custom ${deviceInfo.width}×${deviceInfo.height}`
                break
        }
        
        return deviceInfo
    }
    

    
    // 缩放功能
    updateZoomDisplay() {
        const display = document.getElementById('zoom-display')
        if (display) {
            display.textContent = Math.round(this.zoomLevel * 100) + '%'
        }
    }
    
    zoomIn() {
        if (this.zoomLevel < 2.0) {
            this.zoomLevel += 0.1
            this.applyViewMode()
            this.manager.showSaveStatus(`Zoom: ${Math.round(this.zoomLevel * 100)}%`, 1000)
        }
    }
    
    zoomOut() {
        if (this.zoomLevel > 0.3) {
            this.zoomLevel -= 0.1
            this.applyViewMode()
            this.manager.showSaveStatus(`Zoom: ${Math.round(this.zoomLevel * 100)}%`, 1000)
        }
    }
    
    resetZoom() {
        this.zoomLevel = 1.0
        this.applyViewMode()
        this.manager.showSaveStatus('Zoom reset', 1000)
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

            const container = document.querySelector('.main-content')
            const containerRect = container.getBoundingClientRect()
            const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

            // 限制在合理范围内
            if (newLeftWidth > 15 && newLeftWidth < 85) {
                document.documentElement.style.setProperty('--file-list-width', `${newLeftWidth}%`)
                console.log('Setting file list width to:', `${newLeftWidth}%`)
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
        const fileList = document.getElementById('file-list')
        if (fileList) {
            fileList.innerHTML = `<li class="error"><div>${message}</div></li>`
        }
        this.manager.showSaveStatus(message, 5000)
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new HtmlViewerApp()
}) 