import React, { useState, useEffect, useMemo } from "react"
import { 
	VSCodePanels, 
	VSCodePanelTab, 
	VSCodePanelView
} from "@vscode/webview-ui-toolkit/react"
import { vscode } from "../../utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"

// 类型定义
interface IcemarkFileNode {
	path: string;
	type: 'file' | 'folder';
	mtime: number;
	ctime: number;
	renderable: boolean;
	children?: IcemarkFileNode[];
}

interface IceViewerProps {
	className?: string
}

// 工具函数
const getName = (path: string): string => {
	return path.split('/').pop() || path
}

const formatTime = (timestamp: number): string => {
	return new Date(timestamp).toLocaleString()
}

// 获取文件类型icon
const getFileIcon = (path: string): React.ReactNode => {
	const base = (window as any).IMAGES_BASE_URI;
	if (path.endsWith('.mmd')) {
	  return <img src={`${base}/mermaid-logo.svg`} alt="Mermaid" width="12" height="12" />;
	} else if (path.endsWith('.excalidraw') || path.endsWith('.excalidraw.json')) {
	  return <img src={`${base}/excalidraw-logo.svg`} alt="Excalidraw" width="12" height="12" />;
	} else if (path.endsWith('-html-web') || path.endsWith('-html-mobile')) {
	  return <img src={`${base}/h.svg`} alt="HTML" width="12" height="12" />;
	} else if (path.endsWith('.md')) {
	  return <img src={`${base}/markdown.svg`} alt="Markdown" width="12" height="12" />;
	} else if (path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.jsx') || path.endsWith('.tsx') || 
			path.endsWith('.css') || path.endsWith('.html') || path.endsWith('.json') || path.endsWith('.yml') || 
			path.endsWith('.yaml') || path.endsWith('.xml') || path.endsWith('.py') ) {
	  return <img src={`${base}/code.svg`} alt="Code" width="12" height="12" />;
	} else {
	  return <img src={`${base}/source.svg`} alt="File" width="12" height="12" />;
	}
  }

// 树修剪算法
const pruneTree = (
	nodes: IcemarkFileNode[], 
	activeTab: string
): IcemarkFileNode[] => {
	const shouldIncludeFile = (node: IcemarkFileNode): boolean => {
		if (activeTab === 'all') return true
		if (activeTab === 'html') {
			// HTML筛选：包括以 html-web 或 html-mobile 结尾的文件夹
			if (node.type === 'folder' && (node.path.endsWith('-html-web') || node.path.endsWith('-html-mobile'))) return true
			// 也包括这些文件夹内的文件
			if (node.type === 'file' && (node.path.includes('-html-web') || node.path.includes('-html-mobile'))) return true
			return false
		}
		if (activeTab === 'mermaid' && node.path.endsWith('.mmd')) return true
		if (activeTab === 'excalidraw' && (node.path.endsWith('.excalidraw') || node.path.endsWith('.excalidraw.json'))) return true
		if (activeTab === 'markdown' && node.path.endsWith('.md')) return true
		return false
	}

	const pruneNode = (node: IcemarkFileNode): IcemarkFileNode | null => {
		if (node.type === 'file') {
			return shouldIncludeFile(node) ? node : null
		}
		
		// 对于文件夹，递归处理子节点
		if (node.children) {
			const filteredChildren = node.children
				.map(pruneNode)
				.filter((child): child is IcemarkFileNode => child !== null)
			
			// 如果文件夹有符合条件的子节点，保留该文件夹
			if (filteredChildren.length > 0) {
				return {
					...node,
					children: filteredChildren
				}
			}
		}
		
		return null
	}

	return nodes
		.map(pruneNode)
		.filter((node): node is IcemarkFileNode => node !== null)
}

// 主组件
export const IceViewer: React.FC<IceViewerProps> = ({ className }) => {
	const { t } = useAppTranslation()
	const [activeTab, setActiveTab] = useState<string>('all')
	const [fullTree, setFullTree] = useState<IcemarkFileNode[]>([])
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
	
	// 派生状态：显示的树
	const displayedTree = useMemo(() => {
		return pruneTree(fullTree, activeTab)
	}, [fullTree, activeTab])

	// 打开文件
	const openFile = (filePath: string) => {
		console.log(filePath);
		vscode.postMessage({
			type: "openFile",
			text: './' + filePath
		})
	}

	const openRenderable = (filePath: string) => {
		vscode.postMessage({
			type: "prototype",
			action: "show",
			path: filePath
		})
	}

	// 创建新文件
	const createFile = (type: 'mermaid' | 'excalidraw') => {
		const now = new Date();
		const pad = (n: number) => n.toString().padStart(2, '0');
		const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`;
		const extension = type === 'mermaid' ? 'mmd' : 'excalidraw';
		const filePath = `${timestamp}.${extension}`;

		vscode.postMessage({
			type: "prototype",
			action: "init",
			path: filePath
		})

		// 立即打开文件
		setTimeout(() => {
			vscode.postMessage({
				type: "prototype", 
				action: "show",
				path: filePath
			})
		}, 100)
	}

	// 切换文件夹展开状态
	const toggleFolder = (folderPath: string) => {
		const newExpanded = new Set(expandedFolders)
		if (newExpanded.has(folderPath)) {
			newExpanded.delete(folderPath)
		} else {
			newExpanded.add(folderPath)
		}
		setExpandedFolders(newExpanded)
	}

	// 渲染树节点 - VSCode样式
	const renderTreeNode = (node: IcemarkFileNode, depth: number = 0): React.ReactNode => {
		const name = getName(node.path)
		const paddingLeft = depth * 12 + 4 // 紧凑的间距
		const isExpanded = expandedFolders.has(node.path)
		
		return (
			<div key={node.path}>
				<div 
					className="flex items-center justify-between py-0.5 px-1 hover:bg-vscode-list-hoverBackground cursor-pointer text-xs"
					style={{ 
						paddingLeft: `${paddingLeft}px`,
						color: "var(--vscode-foreground)"
					}}
					title={`${name} - ${formatTime(node.mtime)}`}
					onClick={() => {
						if (node.type === 'folder') {
							toggleFolder(node.path)
						} else {
							openFile(node.path)
						}
					}}
				>
					<div className="flex items-center gap-1 flex-1 min-w-0">
						{node.type === 'folder' ? (
							<>
								<span className="text-xs select-none" style={{ 
									transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
									transition: 'transform 0.1s ease'
								}}>
									▶
								</span>
								<span className="text-xs"><img src={`${(window as any).IMAGES_BASE_URI}/folder.svg`} alt="File" width="12" height="12" /></span>
							</>
						) : (
							<>
								<span className="text-xs opacity-0 select-none">▶</span>
								<span className="text-xs">{getFileIcon(node.path)}</span>
							</>
						)}
						<span className="truncate" style={{ fontSize: "12px" }}>{name}</span>
						{node.type === 'folder' && node.children && (
							<span className="text-xs opacity-60" style={{ fontSize: "11px" }}>
								({node.children.length})
							</span>
						)}
					</div>
					
					{node.renderable && (
						<button
							className="text-xs hover:underline transition-all  cursor-pointer flex-shrink-0 ml-2"
							style={{ color: "var(--vscode-textLink-foreground)", fontSize: "12px" }}
							onClick={e => {
								e.stopPropagation()
								openRenderable(node.path)
							}}
						>
							{t("common:ice_viewer.open")}
						</button>
					)}
				</div>
				
				{node.type === 'folder' && isExpanded && node.children && 
					node.children.map(child => renderTreeNode(child, depth + 1))
				}
			</div>
		)
	}

	// 处理标签页切换
	const handleTabChange = (event: React.MouseEvent<HTMLElement>) => {
		const target = event.target as HTMLElement
		if (target.closest('vscode-panel-tab')) {
			const tabId = target.closest('vscode-panel-tab')?.id
			if (tabId) {
				setActiveTab(tabId)
			}
		}
	}

	// 处理消息
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "prototype" && message.icemarkFileTree) {
				setFullTree(message.icemarkFileTree)
				// 刷新时保持之前的展开状态，不重置
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	// 初始化时请求文件树
	useEffect(() => {
		const scanFiles = () => {
			vscode.postMessage({
				type: "prototype",
				action: "scan"
			})
		}
		
		// 初始扫描
		scanFiles()
		
		// 每5秒自动刷新
		const interval = setInterval(scanFiles, 5000)
		
		return () => clearInterval(interval)
	}, [])

	return (
		<div className={`${className || ""} w-full`}>
			{/* 标题和新建按钮 - 恢复原有样式 */}
			<div className="flex items-center justify-between min-h-[20px]">
				<span className="flex items-center gap-1" style={{ color: "var(--vscode-foreground)", fontSize: "14px", fontWeight: 600 }}>
					<span>☘️</span>
					{t("common:ice_viewer.title")}
				</span>
				<div className="flex items-center gap-2">
					<span className="text-sm" style={{ color: "var(--vscode-descriptionForeground)", fontSize: "12px" }}>{t("common:ice_viewer.create")}:</span>
					<button
						onClick={() => createFile('mermaid')}
						className="text-sm hover:underline transition-all cursor-pointer"
						style={{ color: "var(--vscode-textLink-foreground)", fontSize: "13px" }}
						title={t("common:ice_viewer.new_mermaid_tooltip")}
					>
						Mermaid
					</button>
					<button
						onClick={() => createFile('excalidraw')}
						className="text-sm hover:underline transition-all cursor-pointer"
						style={{ color: "var(--vscode-textLink-foreground)", fontSize: "13px" }}
						title={t("common:ice_viewer.new_excalidraw_tooltip")}
					>
						Excalidraw
					</button>
				</div>
			</div>

			{/* 标签页和文件列表 */}
			<VSCodePanels onClick={handleTabChange}>
				<VSCodePanelTab id="all">
					<span style={{ fontSize: "12px" }}>{t("common:ice_viewer.all")}</span>
				</VSCodePanelTab>
				{/* <VSCodePanelTab id="markdown">
					<span style={{ fontSize: "12px" }}>Markdown</span>
				</VSCodePanelTab> */}
				<VSCodePanelTab id="excalidraw">
					<span style={{ fontSize: "12px" }}>Excalidraw</span>
				</VSCodePanelTab>
				<VSCodePanelTab id="html">
					<span style={{ fontSize: "12px" }}>HTML</span>
				</VSCodePanelTab>
				<VSCodePanelTab id="mermaid">
					<span style={{ fontSize: "12px" }}>Mermaid</span>
				</VSCodePanelTab>
				
				
				<VSCodePanelView id="all-view">
					{displayedTree.length === 0 ? (
						<div className="text-xs p-2" style={{ color: "var(--vscode-descriptionForeground)" }}>
							{t("common:ice_viewer.no_files")}
						</div>
					) : (
						<div className="max-h-64 overflow-y-auto" style={{ width: "100%" }}>
							{displayedTree.map(node => renderTreeNode(node))}
						</div>
					)}
				</VSCodePanelView>

				{/* <VSCodePanelView id="markdown-view">
					{displayedTree.length === 0 ? (
						<div className="text-xs p-2" style={{ color: "var(--vscode-descriptionForeground)" }}>
							No Markdown Files
						</div>
					) : (
						<div className="max-h-64 overflow-y-auto" style={{ width: "100%" }}>
							{displayedTree.map(node => renderTreeNode(node))}
						</div>
					)}
				</VSCodePanelView> */}
				
				<VSCodePanelView id="html-view">
					{displayedTree.length === 0 ? (
						<div className="text-xs p-2" style={{ color: "var(--vscode-descriptionForeground)" }}>
							No HTML Files
						</div>
					) : (
						<div className="max-h-64 overflow-y-auto" style={{ width: "100%" }}>
							{displayedTree.map(node => renderTreeNode(node))}
						</div>
					)}
				</VSCodePanelView>
				
				<VSCodePanelView id="mermaid-view">
					{displayedTree.length === 0 ? (
						<div className="text-xs p-2" style={{ color: "var(--vscode-descriptionForeground)" }}>
							No Mermaid Files
						</div>
					) : (
						<div className="max-h-64 overflow-y-auto" style={{ width: "100%" }}>
							{displayedTree.map(node => renderTreeNode(node))}
						</div>
					)}
				</VSCodePanelView>
				
				<VSCodePanelView id="excalidraw-view">
					{displayedTree.length === 0 ? (
						<div className="text-xs p-2" style={{ color: "var(--vscode-descriptionForeground)" }}>
							No Excalidraw Files
						</div>
					) : (
						<div className="max-h-64 overflow-y-auto" style={{ width: "100%" }}>
							{displayedTree.map(node => renderTreeNode(node))}
						</div>
					)}
				</VSCodePanelView>
			</VSCodePanels>
		</div>
	)
} 