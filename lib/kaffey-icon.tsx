import { ImageResponse } from "next/og";

export function kaffeyIconImage(size: number, variant: "any" | "maskable" = "any") {
	const inset = variant === "maskable" ? 0.22 : 0.14;
	const mark = Math.round(size * (1 - inset * 2));
	const radius = Math.round(mark * 0.28);

	return new ImageResponse(
		(
			<div
				style={{
					alignItems: "center",
					background: "#f5efe7",
					display: "flex",
					height: "100%",
					justifyContent: "center",
					width: "100%",
				}}
			>
				<div
					style={{
						alignItems: "center",
						background: "#b86a4b",
						borderRadius: radius,
						color: "#fffaf7",
						display: "flex",
						fontSize: Math.round(mark * 0.58),
						fontWeight: 700,
						height: mark,
						justifyContent: "center",
						letterSpacing: "-0.06em",
						width: mark,
					}}
				>
					K
				</div>
			</div>
		),
		{ width: size, height: size },
	);
}
