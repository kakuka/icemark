class ExcalidrawManager {
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
    
    showSaveStatus(message, duration = 2000) {
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
        if (!this.autoSaveEnabled || !this.saveEndpoint) return
        
        // 由各页面实现具体的监听逻辑
        this.setupChangeListener()
    }
    
    setupChangeListener() {
        // 由各页面具体实现覆盖此方法
        console.log('Change listener should be implemented by specific page')
    }
    
    // 移除防抖保存，直接使用 save 方法
    
    async save(data) {
        if (!this.saveEndpoint) {
            console.warn('No save endpoint configured')
            return
        }
        
        try {
            const response = await fetch(this.saveEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            
            if (response.ok) {
                this.showSaveStatus('Saved', 2000)
                this.updateConnectionStatus(true)
                
                // 关键修复：保存成功后立即更新lastModified时间
                // 避免3秒后的检查误认为文件被外部修改
                await this.updateLastModified()
                
                if (this.onSaveCallback) {
                    this.onSaveCallback(data)
                }
            } else {
                this.showSaveStatus('Save failed', 2000)
                this.updateConnectionStatus(false)
            }
        } catch (error) {
            console.error('Save failed:', error)
            this.showSaveStatus('Save failed', 2000)
            this.updateConnectionStatus(false)
        }
    }
    
    async updateLastModified() {
        // 保存成功后立即获取最新的文件修改时间
        try {
            const response = await fetch(`/file-info/${this.fileId}`)
            if (response.ok) {
                const data = await response.json()
                this.lastModified = data.modificationTime
                console.log('Updated lastModified after save:', this.lastModified)
            }
        } catch (error) {
            console.warn('Failed to update lastModified:', error)
        }
    }
    
    setupAutoRefresh() {
        if (!this.autoRefreshEnabled || !this.fileId) return
        
        // 每3秒检查一次文件变化
        this.refreshInterval = setInterval(() => {
            this.checkFileChange()
        }, 3000)
    }
    
    async checkFileChange() {
        try {
            const response = await fetch(`/file-info/${this.fileId}`)
            if (response.ok) {
                this.updateConnectionStatus(true)
                const data = await response.json()
                if (data.modificationTime && this.lastModified && data.modificationTime !== this.lastModified) {
                    const fileResponse = await fetch(`/file/${this.fileId}`)
                    if (fileResponse.ok) {
                        const fileData = await fileResponse.json()
                        this.handleFileChange(fileData)
                    }
                }
                this.lastModified = data.modificationTime
            } else {
                this.updateConnectionStatus(false)
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
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault()
                this.triggerSave()
            }
            if (e.key === 'F5') {
                e.preventDefault()
                this.triggerRefresh()
            }
        })
    }
    
    triggerSave() {
        // 由各页面具体实现覆盖此方法
        console.log('Save triggered by keyboard shortcut')
    }
    
    triggerRefresh() {
        // 由各页面具体实现覆盖此方法
        console.log('Refresh triggered by keyboard shortcut')
        window.location.reload()
    }
    
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
        }
    }
}

// 导出ExcalidrawManager
window.ExcalidrawManager = ExcalidrawManager 