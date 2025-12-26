import { create } from 'zustand';

interface Toast {
	id: number;
	message: string;
	tone: 'ok' | 'danger' | 'neutral';
}

interface ConfirmRequest {
	title: string;
	message?: string;
	confirmLabel?: string;
	danger?: boolean;
	resolve: (ok: boolean) => void;
}

interface FeedbackState {
	toasts: Toast[];
	confirmRequest: ConfirmRequest | null;
}

export const useFeedback = create<FeedbackState>(() => ({
	toasts: [],
	confirmRequest: null,
}));

let toastId = 0;

export function toast(message: string, tone: Toast['tone'] = 'ok') {
	const id = ++toastId;
	useFeedback.setState((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
	setTimeout(
		() =>
			useFeedback.setState((s) => ({
				toasts: s.toasts.filter((t) => t.id !== id),
			})),
		2800,
	);
}

/** Promise-based replacement for window.confirm. */
export function confirmAction(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
	return new Promise((resolve) => {
		useFeedback.setState({
			confirmRequest: {
				...opts,
				resolve: (ok) => {
					useFeedback.setState({ confirmRequest: null });
					resolve(ok);
				},
			},
		});
	});
}
