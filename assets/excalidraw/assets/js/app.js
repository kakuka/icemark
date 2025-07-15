// Excalidraw 特有的应用逻辑
class ExcalidrawApp {
    constructor() {
        this.manager = null
        this.excalidrawAPI = null
        this.lastContentSnapshot = null // 上一次内容快照
        this.init()
    }
    
    async init() {
        // 初始化统一管理器
        const urlParams = new URLSearchParams(window.location.search)
        const fileId = urlParams.get('file')
        
        if (!fileId) {
            document.getElementById('excalidraw-container').innerHTML = '<div class="loading"><div>❌ No file ID parameter</div></div>'
            return
        }
        
        // 初始化管理器，先用Loading显示，然后异步获取真实路径
        this.manager = new ExcalidrawManager({
            fileId: fileId,
            path: 'Loading...',
            saveEndpoint: `/save/${fileId}`,
            autoSaveEnabled: true,
            onSave: (data) => {
                console.log('Excalidraw data saved:', data)
                // 保存成功后更新快照
                if (data && data.elements) {
                    this.lastContentSnapshot = this.createContentSnapshot(data.elements)
                }
            },
            onRefresh: (data) => {
                this.handleFileChange(data)
            }
        })
        
        // 异步获取并更新文件路径（延迟一点确保DOM准备好）
        setTimeout(() => {
            this.updateFilePathDisplay(fileId)
        }, 200)
        
        // 扩展管理器的方法
        this.setupManagerExtensions()
        
        // 初始化Excalidraw
        await this.initExcalidraw()
    }
    
    async updateFilePathDisplay(fileId) {
        try {
            const response = await fetch(`/file-info/${fileId}`)
            if (response.ok) {
                const data = await response.json()
                const filePath = data.filePath || 'Unknown File'
                
                // 更新左边文件路径显示
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
    
    // 创建内容快照（只包含真正的内容数据）
    createContentSnapshot(elements) {
        return elements.map(element => ({
            id: element.id,
            type: element.type,
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
            text: element.text || '',
            strokeColor: element.strokeColor || '',
            backgroundColor: element.backgroundColor || '',
            fillStyle: element.fillStyle || '',
            strokeWidth: element.strokeWidth || 1
        }))
    }
    
    // 检测内容是否真正发生变化
    isContentChanged(oldElements, newElements) {
        if (!oldElements || !newElements) return true
        if (oldElements.length !== newElements.length) return true
        
        for (let i = 0; i < oldElements.length; i++) {
            const old = oldElements[i]
            const newEl = newElements[i]
            
            // 对比关键内容属性
            if (old.type !== newEl.type ||
                old.x !== newEl.x ||
                old.y !== newEl.y ||
                old.width !== newEl.width ||
                old.height !== newEl.height ||
                old.text !== newEl.text ||
                old.strokeColor !== newEl.strokeColor ||
                old.backgroundColor !== newEl.backgroundColor ||
                old.fillStyle !== newEl.fillStyle ||
                old.strokeWidth !== newEl.strokeWidth) {
                return true
            }
        }
        return false
    }

    setupManagerExtensions() {
        // Excalidraw的变化监听已在onChange中处理
        this.manager.setupChangeListener = () => {
            // Excalidraw的变化监听已在onChange中处理
        }
        
        this.manager.triggerSave = () => {
            if (this.excalidrawAPI) {
                const elements = this.excalidrawAPI.getSceneElements()
                const appState = this.excalidrawAPI.getAppState()
                const files = this.excalidrawAPI.getFiles()
                this.saveExcalidrawData(elements, appState, files)
            }
        }
        
        this.manager.handleFileChange = (data) => {
            this.handleFileChange(data)
        }
    }
    
    async initExcalidraw() {
        // 检查依赖库
        if (typeof React === 'undefined' || typeof ReactDOM === 'undefined' || typeof ExcalidrawLib === 'undefined') {
            document.getElementById('excalidraw-container').innerHTML = '<div class="loading"><div>❌ Dependencies not loaded</div></div>'
            return
        }
        
        const urlParams = new URLSearchParams(window.location.search)
        const fileId = urlParams.get('file')
        
        if (!fileId) {
            document.getElementById('excalidraw-container').innerHTML = '<div class="loading"><div>❌ No file ID specified</div></div>'
            return
        }

        try {
            // 加载文件数据
            const response = await fetch(`/file/${fileId}`)
            if (!response.ok) {
                throw new Error(`File request failed: ${response.status} ${response.statusText}`)
            }
            
            const data = await response.json()
            console.log("Loaded Excalidraw data:", data)
            
            // 初始化Excalidraw
            const container = document.getElementById('excalidraw-container')
            container.innerHTML = ''

            // 创建兼容性更好的 appState，确保包含字体设置
            const initialAppState = {
                viewBackgroundColor: "#ffffff",
                currentItemFontFamily: 1, // 1 = Virgil (手写字体)
                currentItemFontSize: 20,
                ...data.appState
            }

            // 确保所有文本元素都使用正确的字体
            const initialElements = data.elements ? data.elements.map(element => {
                if (element.type === 'text') {
                    return {
                        ...element,
                        fontFamily: element.fontFamily || 1, // 默认使用手写字体
                        fontSize: element.fontSize || 20
                    }
                }
                return element
            }) : []

            const excalidrawElement = React.createElement(ExcalidrawLib.Excalidraw, {
                initialData: {
                    elements: initialElements,
                    appState: initialAppState,
                    files: data.files || {}
                },
                onChange: (elements, appState, files) => {
                    // 只在用户真正操作时才保存，避免初始化时的无意义保存
                    if (this.excalidrawAPI) {
                        // 创建当前内容快照
                        const currentSnapshot = this.createContentSnapshot(elements)
                        
                        // 检测是否有真正的内容变化
                        if (this.isContentChanged(this.lastContentSnapshot, currentSnapshot)) {
                            console.log('Content changed, preparing to save')
                            this.lastContentSnapshot = currentSnapshot
                            this.manager.save(this.prepareExcalidrawData(elements, appState, files))
                        } else {
                            console.log('Only view state changed, skip saving')
                        }
                    }
                },
                ref: (api) => {
                    this.excalidrawAPI = api
                }
            })

            ReactDOM.render(excalidrawElement, container)
            
            // 等待Excalidraw完全渲染后再显示状态和设置初始快照
            setTimeout(() => {
                this.manager.showSaveStatus('Loaded', 2000)
                // 设置初始内容快照，避免初始化时的无意义保存
                this.lastContentSnapshot = this.createContentSnapshot(initialElements)
            }, 500)
            
        } catch (error) {
            console.error('Loading failed:', error)
            document.getElementById('excalidraw-container').innerHTML = `<div class="loading"><div>❌ Loading failed: ${error.message}</div></div>`
        }
    }
    
    prepareExcalidrawData(elements, appState, files) {
        // 创建兼容性更好的 appState，确保包含字体设置
        const compatibleAppState = {
            viewBackgroundColor: "#ffffff",
            currentItemFontFamily: 1, // 1 = Virgil (手写字体)
            currentItemFontSize: 20
        }
        
        // 保留重要的字体和显示设置
        if (appState) {
            if (appState.viewBackgroundColor) {
                compatibleAppState.viewBackgroundColor = appState.viewBackgroundColor
            }
            if (appState.currentItemFontFamily !== undefined) {
                compatibleAppState.currentItemFontFamily = appState.currentItemFontFamily
            }
            if (appState.currentItemFontSize !== undefined) {
                compatibleAppState.currentItemFontSize = appState.currentItemFontSize
            }
        }
        
        // 确保 elements 的格式正确，特别是字体设置
        const cleanElements = elements ? elements.map(element => {
            const cleanElement = { ...element }
            
            // 确保必需的基本属性存在
            if (!cleanElement.id) {
                cleanElement.id = Math.random().toString(36).substr(2, 9)
            }
            if (typeof cleanElement.x !== 'number') cleanElement.x = 0
            if (typeof cleanElement.y !== 'number') cleanElement.y = 0
            if (typeof cleanElement.width !== 'number') cleanElement.width = 100
            if (typeof cleanElement.height !== 'number') cleanElement.height = 100
            
            // 对于文本元素，确保使用手写字体
            if (cleanElement.type === 'text') {
                cleanElement.fontFamily = cleanElement.fontFamily || 1 // 1 = Virgil
                cleanElement.fontSize = cleanElement.fontSize || 20
            }
            
            // 移除可能的临时属性
            delete cleanElement.isDeleted
            delete cleanElement.updated
            delete cleanElement.versionNonce
            
            return cleanElement
        }) : []
        
        return {
            type: "excalidraw",
            version: 2,
            source: "https://excalidraw.com",
            elements: cleanElements,
            appState: compatibleAppState,
            files: files || {}
        }
    }
    
    saveExcalidrawData(elements, appState, files) {
        const data = this.prepareExcalidrawData(elements, appState, files)
        this.manager.save(data)
    }
    
    handleFileChange(data) {
        // 处理文件变化，更新Excalidraw内容
        if (this.excalidrawAPI && data) {
            this.excalidrawAPI.updateScene({
                elements: data.elements || [],
                appState: data.appState || {},
                files: data.files || {}
            })
            // 同步更新内容快照，避免updateScene触发不必要的保存
            this.lastContentSnapshot = this.createContentSnapshot(data.elements || [])
        }
    }
}

// 初始化应用
setTimeout(() => {
    new ExcalidrawApp()
}, 100) 