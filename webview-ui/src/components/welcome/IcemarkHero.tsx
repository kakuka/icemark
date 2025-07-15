import { useState } from "react"

const IcemarkHero = () => {
	const [imagesBaseUri] = useState(() => {
		const w = window as any
		return w.IMAGES_BASE_URI || ""
	})

	return (
		<div className="flex flex-col items-center justify-center pb-8">
			<div
				className="mx-auto"
				style={{
					width: "120px",  // 增大尺寸
					height: "120px"  // 增大尺寸
				}}>
				<img 
					src={imagesBaseUri + "/icemark-logo.svg"} 
					alt="Icemark logo" 
					className="w-full h-full"
				/>
			</div>
		</div>
	)
}

export default IcemarkHero
