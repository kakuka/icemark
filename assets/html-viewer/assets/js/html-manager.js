class HtmlManager {
    constructor(config) {
        this.fileId = config.fileId
        this.prototypePath = config.path
        this.autoRefreshEnabled = config.autoRefreshEnabled !== false
        this.refreshInterval = null
        this.lastModified = null
        this.onRefreshCallback = config.onRefresh
        this.init()
    }
    
    init() {
        this.setupAutoRefresh()
        this.setupKeyboardShortcuts()
    }
    
    showSaveStatus(message, duration = 3000) {
        const indicator = document.getElementById('save-indicator')
        
        if (!indicator) return
        
        // 清除之前的定时器，避免多个showSaveStatus调用冲突
        if (this._statusTimer) {
            clearTimeout(this._statusTimer)
            this._statusTimer = null
        }
        
        indicator.textContent = message
        indicator.className = `status-indicator show`
        
        if (duration > 0) {
            this._statusTimer = setTimeout(() => {
                indicator.classList.remove('show')
                this._statusTimer = null
            }, duration)
        }
    }
    
    updateConnectionStatus(isConnected) {
        const statusDot = document.getElementById('status-dot')
        if (!statusDot) return
        
        if (isConnected) {
            statusDot.style.background = 'greenyellow' // 绿黄色
        } else {
            statusDot.style.background = '#f44336' // 红色
        }
    }
    
    setupAutoRefresh() {
        if (!this.autoRefreshEnabled) return
        
        // HTML Viewer使用更长的检测间隔（10秒）
        this.refreshInterval = setInterval(() => {
            this.checkFileChange()
        }, 10000)
        
        // 初始连接状态设为绿色
        setTimeout(() => {
            this.updateConnectionStatus(true)
        }, 1000)
    }
    
    async checkFileChange() {
        try {
            // 轻量级连接检测 - 只检查服务器是否响应
            const response = await fetch('/api/files', { 
                method: 'HEAD',  // 只检查头部，不获取数据
                cache: 'no-cache'
            })
            
            if (response.ok) {
                this.updateConnectionStatus(true)
                // HTML Viewer不需要频繁检测文件变化，只在手动刷新时检查
                console.log('Server connection OK')
            } else {
                this.updateConnectionStatus(false)
                console.warn('Server connection failed:', response.status)
            }
        } catch (error) {
            console.warn('File check error:', error)
            this.updateConnectionStatus(false)
        }
    }
    
    handleFileChange(data) {
        // 由各页面具体实现覆盖此方法
        if (this.onRefreshCallback) {
            this.onRefreshCallback(data)
        }
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F5') {
                e.preventDefault()
                this.triggerRefresh()
            }
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault()
                this.triggerRefresh()
            }
        })
    }
    
    triggerRefresh() {
        // 由各页面具体实现覆盖此方法
        console.log('Refresh triggered by keyboard shortcut')
        if (this.onRefreshCallback) {
            this.onRefreshCallback({ type: 'manual_refresh' })
        }
    }
    
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
        }
        if (this._statusTimer) {
            clearTimeout(this._statusTimer)
            this._statusTimer = null
        }
    }
}

// 导出HtmlManager
window.HtmlManager = HtmlManager 