class MarkdownManager {
    constructor(config) {
        this.fileId = config.fileId
        this.prototypePath = config.path
        this.saveEndpoint = config.saveEndpoint
        this.autoSaveEnabled = config.autoSaveEnabled !== false
        this.autoRefreshEnabled = config.autoRefreshEnabled !== false
        this.refreshInterval = null
        this.lastModified = null
        this.onSaveCallback = config.onSave
        this.onRefreshCallback = config.onRefresh
        this.init()
    }
    
    init() {
        this.setupAutoSave()
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
    
    setupAutoSave() {
        // 初始状态为连接
        this.updateConnectionStatus(true)
        
        // 只有在启用自动保存时才设置监听器
        if (this.autoSaveEnabled) {
            this.setupChangeListener()
        }
    }
    
    setupChangeListener() {
        // 由各页面具体实现覆盖此方法
        console.log('Change listener should be implemented by specific page')
    }
    
    async save(data) {
        if (!this.saveEndpoint) {
            console.warn('No save endpoint configured')
            return
        }
        
        try {
            this.showSaveStatus('Saving...', 0)
            
            const response = await fetch(this.saveEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            
            if (response.ok) {
                const result = await response.json()
                this.showSaveStatus('Saved ✓', 2000)
                this.updateConnectionStatus(true)
                
                // 更新最后修改时间
                await this.updateLastModified()
                
                // 调用回调
                if (this.onSaveCallback) {
                    this.onSaveCallback(data)
                }
                
                return result
            } else {
                throw new Error(`Save failed: ${response.status}`)
            }
        } catch (error) {
            console.error('Save error:', error)
            this.showSaveStatus('Save failed ✗', 3000)
            this.updateConnectionStatus(false)
            throw error
        }
    }
    
    async updateLastModified() {
        try {
            const response = await fetch(`/file-info/${this.fileId}`)
            if (response.ok) {
                const data = await response.json()
                this.lastModified = data.modificationTime
            }
        } catch (error) {
            console.error('Failed to update last modified time:', error)
        }
    }
    
    setupAutoRefresh() {
        if (!this.autoRefreshEnabled) return
        
        this.refreshInterval = setInterval(() => {
            this.checkFileChange()
        }, 2000) // 每2秒检查一次
    }
    
    async checkFileChange() {
        if (!this.fileId) return
        
        try {
            const response = await fetch(`/file-info/${this.fileId}`)
            if (response.ok) {
                const data = await response.json()
                
                if (this.lastModified && data.modificationTime > this.lastModified) {
                    // 文件已被外部修改
                    this.handleFileChange(data)
                    this.lastModified = data.modificationTime
                }
            }
        } catch (error) {
            console.error('File change check failed:', error)
            this.updateConnectionStatus(false)
        }
    }
    
    handleFileChange(data) {
        console.log('File changed externally:', data)
        
        // 调用回调处理文件变更
        if (this.onRefreshCallback) {
            this.onRefreshCallback(data)
        }
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+S 或 Cmd+S 保存
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                this.triggerSave()
            }
            
            // Ctrl+R 或 Cmd+R 刷新
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault()
                this.triggerRefresh()
            }
        })
    }
    
    triggerSave() {
        // 由具体应用决定如何获取数据并调用save
        if (window.app && window.app.triggerSave) {
            window.app.triggerSave()
        }
    }
    
    triggerRefresh() {
        // 由具体应用决定如何刷新
        if (window.app && window.app.triggerRefresh) {
            window.app.triggerRefresh()
        }
    }
    
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
            this.refreshInterval = null
        }
        
        if (this._statusTimer) {
            clearTimeout(this._statusTimer)
            this._statusTimer = null
        }
    }
}

// 导出MarkdownManager
window.MarkdownManager = MarkdownManager 