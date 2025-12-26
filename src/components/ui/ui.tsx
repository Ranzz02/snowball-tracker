import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Friend } from '../../models';
import { formatRub } from '../../lib/format';

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

// ---------- Button ----------

const buttonVariants = {
	primary: 'bg-accent text-surface font-semibold hover:brightness-110',
	secondary: 'bg-raised text-ink border border-line hover:border-accent/60',
	ghost: 'text-mute hover:text-ink hover:bg-raised',
	danger: 'bg-danger/10 text-danger border border-danger/40 hover:bg-danger/20',
} as const;

export function Button({
	variant = 'secondary',
	size = 'md',
	className,
	...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: keyof typeof buttonVariants;
	size?: 'sm' | 'md';
}) {
	return (
		<button
			{...rest}
			className={cx(
				'inline-flex items-center justify-center gap-1.5 rounded-sm font-display uppercase tracking-wider transition disabled:opacity-40 disabled:cursor-not-allowed',
				size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm',
				buttonVariants[variant],
				className,
			)}
		/>
	);
}

// ---------- Panel ----------

export function Panel({
	title,
	actions,
	children,
	className,
}: {
	title?: ReactNode;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={cx('rounded-sm border bg-panel', className)}>
			{(title || actions) && (
				<header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
					<h3 className="label-caps text-sm text-accent">{title}</h3>
					<div className="flex items-center gap-2">{actions}</div>
				</header>
			)}
			<div className="p-4">{children}</div>
		</section>
	);
}

// ---------- Badge ----------

const badgeTones = {
	neutral: 'bg-raised text-mute border-line',
	ok: 'bg-ok/10 text-ok border-ok/40',
	danger: 'bg-danger/10 text-danger border-danger/40',
	warn: 'bg-warn/10 text-warn border-warn/40',
	accent: 'bg-accent/10 text-accent border-accent/40',
} as const;

export function Badge({
	tone = 'neutral',
	children,
}: {
	tone?: keyof typeof badgeTones;
	children: ReactNode;
}) {
	return (
		<span
			className={cx(
				'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-display text-xs uppercase tracking-wider',
				badgeTones[tone],
			)}
		>
			{children}
		</span>
	);
}

// ---------- Stat / Rub ----------

export function Rub({
	amount,
	signed,
	className,
}: {
	amount: number;
	signed?: boolean;
	className?: string;
}) {
	const color = amount < 0 ? 'text-danger' : signed && amount > 0 ? 'text-ok' : '';
	const text = signed && amount > 0 ? `+${formatRub(amount)}` : formatRub(amount);
	return <span className={cx('tabular-nums', color, className)}>{text}</span>;
}

export function Stat({
	label,
	children,
	className,
}: {
	label: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={className}>
			<div className="label-caps text-xs text-mute">{label}</div>
			<div className="font-display text-2xl font-semibold leading-tight">{children}</div>
		</div>
	);
}

// ---------- Stepper ----------

export function Stepper({
	value,
	onChange,
	label,
	min = 0,
}: {
	value: number;
	onChange: (value: number) => void;
	label: string;
	min?: number;
}) {
	return (
		<div className="inline-flex items-center rounded-sm border bg-surface">
			<button
				type="button"
				aria-label={`${label}: decrease`}
				disabled={value <= min}
				onClick={() => onChange(value - 1)}
				className="px-1.5 py-1 text-mute hover:text-ink disabled:opacity-30"
			>
				<Minus size={14} />
			</button>
			<span
				aria-label={label}
				className="min-w-7 text-center font-display text-base font-semibold"
			>
				{value}
			</span>
			<button
				type="button"
				aria-label={`${label}: increase`}
				onClick={() => onChange(value + 1)}
				className="px-1.5 py-1 text-mute hover:text-ink"
			>
				<Plus size={14} />
			</button>
		</div>
	);
}

// ---------- Toggle ----------

const toggleTones = {
	ok: 'border-ok/60 bg-ok/15 text-ok',
	danger: 'border-danger/60 bg-danger/15 text-danger',
	accent: 'border-accent/60 bg-accent/15 text-accent',
} as const;

export function Toggle({
	checked,
	onChange,
	children,
	tone = 'accent',
	className,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	children: ReactNode;
	tone?: keyof typeof toggleTones;
	className?: string;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onChange(!checked)}
			className={cx(
				'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-display text-xs uppercase tracking-wider transition',
				checked ? toggleTones[tone] : 'border-line bg-surface text-mute hover:text-ink',
				className,
			)}
		>
			{children}
		</button>
	);
}

// ---------- FriendChip ----------

export function FriendChip({
	friend,
	size = 24,
}: {
	friend?: Pick<Friend, 'name' | 'color'>;
	size?: number;
}) {
	return (
		<span
			title={friend?.name}
			style={{
				width: size,
				height: size,
				backgroundColor: friend?.color ?? '#555',
				fontSize: size * 0.45,
			}}
			className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-surface"
		>
			{(friend?.name ?? '?').slice(0, 1).toUpperCase()}
		</span>
	);
}

// ---------- ProgressBar ----------

export function ProgressBar({
	value,
	max,
	className,
}: {
	value: number;
	max: number;
	className?: string;
}) {
	const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
	return (
		<div
			role="progressbar"
			aria-valuenow={value}
			aria-valuemax={max}
			className={cx('h-1.5 overflow-hidden rounded-full bg-raised', className)}
		>
			<div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
		</div>
	);
}

// ---------- Inputs ----------

export const inputClass =
	'rounded-sm border bg-surface px-2.5 py-1.5 text-ink placeholder:text-mute/60 focus:border-accent focus:outline-hidden';

/** Number field that lets you clear and retype; commits whenever the text parses. */
export function NumberInput({
	value,
	onChange,
	min,
	className,
	label,
}: {
	value: number;
	onChange: (value: number) => void;
	min?: number;
	className?: string;
	label: string;
}) {
	const [draft, setDraft] = useState<string | null>(null);
	return (
		<input
			type="number"
			aria-label={label}
			min={min}
			value={draft ?? String(value)}
			onChange={(e) => {
				setDraft(e.target.value);
				const n = Number(e.target.value);
				if (e.target.value !== '' && Number.isFinite(n)) onChange(n);
			}}
			onBlur={() => setDraft(null)}
			className={cx(inputClass, 'tabular-nums', className)}
		/>
	);
}

// ---------- BossAvatar ----------

/** Boss portrait from public/bosses; falls back to an initial if the image is missing. */
export function BossAvatar({
	boss,
	size = 28,
	dim,
}: {
	boss?: { name: string; icon?: string };
	size?: number;
	dim?: boolean;
}) {
	const [broken, setBroken] = useState(false);
	const style = { width: size, height: size };
	const base = cx(
		'shrink-0 rounded-full border border-line bg-raised',
		dim && 'opacity-50 grayscale',
	);
	if (!boss?.icon || broken) {
		return (
			<span
				style={{ ...style, fontSize: size * 0.45 }}
				className={cx(
					base,
					'inline-flex items-center justify-center font-display font-bold text-mute',
				)}
			>
				{(boss?.name ?? '?').slice(0, 1)}
			</span>
		);
	}
	return (
		<img
			src={boss.icon}
			alt=""
			draggable={false}
			onError={() => setBroken(true)}
			style={style}
			className={cx(base, 'object-cover object-top')}
		/>
	);
}
