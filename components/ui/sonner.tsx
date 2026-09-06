"use client";

import { useMemo, type ReactNode } from "react";
import { BaseProvider, LightTheme } from "baseui";
import { Alert, Check } from "baseui/icon";
import { DURATION, PLACEMENT, SnackbarProvider, useSnackbar, type SnackbarElementProps } from "baseui/snackbar";
import { Client, Server } from "styletron-engine-monolithic";
import { Provider as StyletronProvider } from "styletron-react";

type Enqueue = (elementProps: SnackbarElementProps, duration?: number) => void;

let enqueueSnackbar: Enqueue | null = null;

function SnackbarBridge({ children }: { children: ReactNode }) {
	const { enqueue } = useSnackbar();
	enqueueSnackbar = enqueue;
	return children;
}

export function toastSuccess(message: string) {
	enqueueSnackbar?.(
		{
			message,
			startEnhancer: ({ size }) => <Check size={size} />,
		},
		DURATION.medium,
	);
}

export function toastError(message: string) {
	enqueueSnackbar?.(
		{
			message,
			startEnhancer: ({ size }) => <Alert size={size} />,
		},
		DURATION.long,
	);
}

export function Toaster({ children }: { children: ReactNode }) {
	const engine = useMemo(() => (typeof window === "undefined" ? new Server() : new Client()), []);

	return (
		<StyletronProvider value={engine}>
			<BaseProvider
				theme={LightTheme}
				zIndex={120}
				overrides={{
					AppContainer: {
						props: { suppressHydrationWarning: true },
						style: {
							display: "flex",
							flexDirection: "column",
							flexGrow: 1,
							minHeight: "100%",
						},
					},
				}}
			>
				<SnackbarProvider placement={PLACEMENT.bottomRight} defaultDuration={DURATION.medium}>
					<SnackbarBridge>{children}</SnackbarBridge>
				</SnackbarProvider>
			</BaseProvider>
		</StyletronProvider>
	);
}
