import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFeedback } from './feedback';
import { Button } from './ui';

const FOCUSABLE =
	'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Esc closes, Tab stays inside, focus returns to the opener on close. */
function useOverlayBehavior(open: boolean, onClose: () => void) {
	const ref = useRef<HTMLDivElement>(null);
	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	});

	useEffect(() => {
		if (!open) return;
		const opener = document.activeElement as HTMLElement | null;
		ref.current?.focus();

		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onCloseRef.current();
				return;
			}
			if (e.key !== 'Tab' || !ref.current) return;
			const items = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE);
			if (items.length === 0) return;
			const first = items[0];
			const last = items[items.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('keydown', onKey);
			opener?.focus?.();
		};
	}, [open]);

	return ref;
}

export function Modal({
	open,
	onClose,
	title,
	children,
	footer,
	width = 'max-w-md',
}: {
	open: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	footer?: ReactNode;
	width?: string;
}) {
	const ref = useOverlayBehavior(open, onClose);
	if (!open) return null;
	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
			onMouseDown={(e) => e.target === e.currentTarget && onClose()}
		>
			<div
				ref={ref}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className={`w-full ${width} rounded-sm border bg-panel shadow-2xl focus:outline-hidden`}
			>
				<header className="flex items-center justify-between border-b px-4 py-3">
					<h2 className="label-caps text-base text-accent">{title}</h2>
					<button
						aria-label="Close"
						onClick={onClose}
						className="text-mute hover:text-ink"
					>
						<X size={18} />
					</button>
				</header>
				<div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
				{footer && (
					<footer className="flex justify-end gap-2 border-t px-4 py-3">{footer}</footer>
				)}
			</div>
		</div>
	);
}

export function Drawer({
	open,
	onClose,
	title,
	subtitle,
	actions,
	children,
}: {
	open: boolean;
	onClose: () => void;
	title: string;
	subtitle?: ReactNode;
	actions?: ReactNode;
	children: ReactNode;
}) {
	const ref = useOverlayBehavior(open, onClose);
	if (!open) return null;
	return (
		<div
			className="fixed inset-0 z-40 bg-black/60"
			onMouseDown={(e) => e.target === e.currentTarget && onClose()}
		>
			<aside
				ref={ref}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l bg-panel shadow-2xl focus:outline-hidden"
			>
				<header className="flex items-start justify-between gap-3 border-b px-5 py-3">
					<div>
						<h2 className="label-caps text-lg text-accent">{title}</h2>
						{subtitle && <div className="text-xs text-mute">{subtitle}</div>}
					</div>
					<div className="flex items-center gap-2">
						{actions}
						<button
							aria-label="Close"
							onClick={onClose}
							className="p-1 text-mute hover:text-ink"
						>
							<X size={20} />
						</button>
					</div>
				</header>
				<div className="flex-1 overflow-y-auto p-5">{children}</div>
			</aside>
		</div>
	);
}

/** Mounts the global toast stack and the confirm dialog. Render once in App. */
export function FeedbackHost() {
	const toasts = useFeedback((s) => s.toasts);
	const request = useFeedback((s) => s.confirmRequest);

	return (
		<>
			<div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
				{toasts.map((t) => (
					<div
						key={t.id}
						role="status"
						className={`rounded-sm border bg-panel px-3 py-2 text-sm shadow-lg ${
							t.tone === 'ok'
								? 'border-ok/50 text-ok'
								: t.tone === 'danger'
									? 'border-danger/50 text-danger'
									: 'text-ink'
						}`}
					>
						{t.message}
					</div>
				))}
			</div>
			<Modal
				open={!!request}
				onClose={() => request?.resolve(false)}
				title={request?.title ?? ''}
				footer={
					<>
						<Button variant="ghost" onClick={() => request?.resolve(false)}>
							Cancel
						</Button>
						<Button
							variant={request?.danger ? 'danger' : 'primary'}
							onClick={() => request?.resolve(true)}
						>
							{request?.confirmLabel ?? 'Confirm'}
						</Button>
					</>
				}
			>
				<p className="text-ink/90">{request?.message}</p>
			</Modal>
		</>
	);
}
