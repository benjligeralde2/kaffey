"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";

type PaymentMethod = "Cash" | "Card" | "GCash";

type PaymentMethodModalProps = {
	total: number;
	paymentMethod: PaymentMethod;
	onPaymentMethodChange: (method: PaymentMethod) => void;
	paymentError: string;
	isBusy: boolean;
	gcashCheckoutUrl: string;
	gcashMerchantNumber: string;
	isConfirmingGcash: boolean;
	onClose: () => void;
	onConfirm: () => void;
	onConfirmGcashReceived: () => void;
};

export function PaymentMethodModal({
	total,
	paymentMethod,
	onPaymentMethodChange,
	paymentError,
	isBusy,
	gcashCheckoutUrl,
	gcashMerchantNumber,
	isConfirmingGcash,
	onClose,
	onConfirm,
	onConfirmGcashReceived,
}: PaymentMethodModalProps) {
	const [qrUrl, setQrUrl] = useState("");
	useEffect(() => {
		if (!gcashCheckoutUrl) {
			setQrUrl("");
			return;
		}
		let cancelled = false;
		void QRCode.toDataURL(gcashCheckoutUrl, { errorCorrectionLevel: "H", margin: 1, width: 240, color: { dark: "#0038A8", light: "#ffffff" } }).then((url) => {
			if (!cancelled) setQrUrl(url);
		});
		return () => {
			cancelled = true;
		};
	}, [gcashCheckoutUrl]);

	const waiting = Boolean(gcashCheckoutUrl);
	const confirmLabel = isBusy
		? paymentMethod === "GCash" ? "Starting GCash..." : "Recording..."
		: paymentMethod === "GCash"
			? waiting ? "Waiting for GCash..." : "Pay with GCash"
			: "Record Cash payment";

	return (
		<div className="charge-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !waiting) onClose(); }}>
			<section className={`charge-modal payment-method-modal${waiting ? " gcash-wait-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="payment-method-title">
				<button className="charge-modal-close" type="button" aria-label="Close payment options" onClick={onClose}><X size={18} /></button>
				<p className="pos-kicker" id="payment-method-title">{waiting ? "Scan to pay" : "Payment method"}</p>
				{waiting ? (
					<div className="gcash-wait">
						<article className="gcash-qr-card">
							<header className="gcash-qr-card-header">
								<span className="gcash-qr-mark" aria-hidden="true">G</span>
								<strong>GCash</strong>
							</header>
							<div className="gcash-qr-frame">
								{qrUrl ? <img className="gcash-qr" src={qrUrl} alt="GCash payment QR code" /> : <div className="gcash-qr gcash-qr-placeholder" />}
								<span className="gcash-qr-badge" aria-hidden="true">G</span>
							</div>
							<p className="gcash-qr-card-amount">₱{total.toFixed(2)}</p>
							{gcashMerchantNumber ? <p className="gcash-merchant-number">{gcashMerchantNumber}</p> : null}
							<p className="gcash-qr-card-scan">Scan with the GCash app</p>
						</article>
						<p>Ask the customer to scan this QR or open the checkout page, then send GCash to Kaffey.</p>
						<a className="gcash-open-link" href={gcashCheckoutUrl} target="_blank" rel="noreferrer">Open GCash checkout</a>
						<p className="gcash-wait-note">Confirm here after the transfer arrives.</p>
						<Button className="charge-confirm-button" type="button" disabled={isBusy || isConfirmingGcash} onClick={onConfirmGcashReceived}>{isConfirmingGcash ? "Confirming..." : "Payment received"}</Button>
					</div>
				) : (
					<div className="payment-methods" role="radiogroup" aria-label="Payment methods">
						{(["Cash", "Card", "GCash"] as const).map((method) => {
							const enabled = method !== "Card";
							return (
								<button
									className={`payment-method-option${paymentMethod === method ? " selected" : ""}`}
									key={method}
									type="button"
									role="radio"
									aria-checked={paymentMethod === method}
									disabled={!enabled}
									onClick={() => onPaymentMethodChange(method)}
								>
									<span className="payment-method-icon">{method === "Cash" ? "₱" : method === "Card" ? "▣" : "G"}</span>
									<span>
										<strong>{method}</strong>
										<small>{method === "Cash" ? "Collect cash at the table" : method === "GCash" ? "Send to Kaffey’s GCash" : "Coming soon"}</small>
									</span>
									<i />
								</button>
							);
						})}
					</div>
				)}
				{paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
				{!waiting && <div className="payment-method-total"><span>Amount due</span><strong>₱{total.toFixed(2)}</strong></div>}
				{!waiting && <Button className="charge-confirm-button" type="button" disabled={isBusy || paymentMethod === "Card"} onClick={onConfirm}>{confirmLabel}</Button>}
			</section>
		</div>
	);
}
