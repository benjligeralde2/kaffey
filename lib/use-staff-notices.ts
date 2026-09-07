"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { readNotificationSoundEnabled } from "@/lib/pos-preferences";
import type { StaffNotice } from "@/components/pos/staff-notification-bell";

export function useStaffNotices() {
	const [toast, setToast] = useState<StaffNotice | null>(null);
	const [notices, setNotices] = useState<StaffNotice[]>([]);
	const [isOpen, setIsOpen] = useState(false);
	const anchorRef = useRef<HTMLDivElement>(null);

	const seenIds = useRef(new Set<string>());
	const pushNotice = useCallback((notice: StaffNotice) => {
		if (seenIds.current.has(notice.id)) return;
		seenIds.current.add(notice.id);
		setToast(notice);
		setNotices((current) => [notice, ...current].slice(0, 10));
		if (!readNotificationSoundEnabled()) return;
		const sound = new Audio("/sounds/notification_sounds.mp3");
		sound.currentTime = 0;
		void sound.play().catch(() => undefined);
	}, []);

	useEffect(() => {
		if (!toast) return;
		const timer = window.setTimeout(() => setToast(null), 5000);
		return () => window.clearTimeout(timer);
	}, [toast]);

	useEffect(() => {
		const handleOutsideClick = (event: MouseEvent) => {
			if (anchorRef.current && !anchorRef.current.contains(event.target as Node)) {
				setIsOpen(false);
				setToast(null);
			}
		};
		document.addEventListener("mousedown", handleOutsideClick);
		return () => document.removeEventListener("mousedown", handleOutsideClick);
	}, []);

	return { toast, notices, isOpen, setIsOpen, anchorRef, pushNotice };
}
