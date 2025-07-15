export interface PrototypeResult {
	success: boolean
	message: string
}

// 新增文件树节点接口
export interface IcemarkFileNode {
	path: string;           // 唯一的ID：从工作区根目录开始的相对路径
	type: 'file' | 'folder';
	mtime: number;          // 最后修改时间的毫秒时间戳
	ctime: number;          // 创建时间的毫秒时间戳
	renderable: boolean;    // 是否支持渲染
	children?: IcemarkFileNode[];
} 