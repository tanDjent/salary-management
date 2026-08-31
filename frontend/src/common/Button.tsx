type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

const base =
  "rounded-lg font-medium transition active:scale-[0.98] focus:outline-none inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50";

const variants = {
  primary:
    "bg-violet-600 text-white hover:bg-violet-500 focus:ring-2 focus:ring-violet-300",
  secondary: "bg-violet-50 text-violet-700 hover:bg-violet-100",
  ghost: "text-gray-600 hover:bg-gray-100",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
