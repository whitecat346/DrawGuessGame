import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const btnBase =
  "rounded-none border-2 md:border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] " +
  "hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] " +
  "transition-all duration-200 font-black px-4 py-2 text-sm md:text-base disabled:opacity-40 disabled:hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:cursor-not-allowed";

type Variant = "primary" | "dark" | "light" | "warning" | "accent";

const variants: Record<Variant, string> = {
  primary: "bg-[#ff006e] text-white",
  dark: "bg-black text-white",
  light: "bg-white text-black",
  warning: "bg-[#ff9500] text-black",
  accent: "bg-[#ccff00] text-black",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${btnBase} ${variants[variant]} ${className}`} {...props} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-none border-2 md:border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white p-4 md:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

const inputBase =
  "w-full min-w-0 rounded-none border-2 md:border-4 border-black font-mono bg-white text-black px-3 py-2 text-sm md:text-base " +
  "focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:focus:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:-translate-y-[2px] transition-all duration-200 disabled:bg-gray-100";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputBase} ${className}`} {...props} />;
}

export function NeoTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-black tracking-tight text-3xl md:text-5xl ${className}`}>{children}</h1>;
}

export function NeoSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-black tracking-tight text-xl md:text-2xl ${className}`}>{children}</h2>;
}

export function ErrorBanner({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div className="rounded-none border-2 md:border-4 border-black bg-[#ff9500] text-black p-3 font-mono text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-2">
      <span>⚠ {message}</span>
      {onClose && (
        <button className="font-black px-2" onClick={onClose} aria-label="关闭">
          ✕
        </button>
      )}
    </div>
  );
}
