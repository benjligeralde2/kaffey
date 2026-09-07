"use client";

import { Bell } from "lucide-react";
import { type Dispatch, type RefObject, type SetStateAction } from "react";

export type StaffNotice = {
	id: string;
	title: string;
	details: string;
	timestamp: number;
};

export function StaffNotificationBell({
	notices,
	toast,
	isOpen,
	setIsOpen,
	anchorRef,
}: {
	notices: StaffNotice[];
	toast: StaffNotice | null;
	isOpen: boolean;
	setIsOpen: Dispatch<SetStateAction<boolean>>;
	anchorRef: RefObject<HTMLDivElement | null>;
}) {
	return (
		<div className="cashier-notification-anchor" ref={anchorRef}>
			<button className="pos-icon-button" type="button" aria-label="Notifications" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
				<Bell size={18} strokeWidth={1.8} />
				{notices.length > 0 ? <span className="notification-dot" /> : null}
			</button>
			{toast && !isOpen ? (
				<div className="cashier-product-notification" role="status">
					<strong>{toast.title}</strong>
					<span>{toast.details}</span>
				</div>
			) : null}
			{isOpen ? (
				<div className="cashier-notification-panel" role="region" aria-label="Notifications">
					<div className="cashier-notification-panel-header">
						<strong>Notifications</strong>
						<span>{notices.length}</span>
					</div>
					{notices.length > 0 ? (
						<div className="cashier-notification-list">
							{notices.map((notice) => (
								<div className="cashier-notification-item" key={notice.id}>
									<span className="cashier-notification-icon"><Bell size={13} aria-hidden="true" /></span>
									<span>
										<strong>{notice.title}</strong>
										<small>{notice.details}</small>
									</span>
								</div>
							))}
						</div>
					) : (
						<p className="cashier-notification-empty">No recent notifications</p>
					)}
				</div>
			) : null}
		</div>
	);
}
