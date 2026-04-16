export default function Logo() {
  return (
    <div className="flex items-center gap-3">

      {/* ICON */}
      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">

        {/* Glow */}
        <div className="absolute inset-0 rounded-xl bg-blue-400 opacity-30 blur-md animate-pulse"></div>

        {/* R */}
        <span className="relative text-white font-bold text-lg tracking-tight">
          R
        </span>

        {/* AI badge */}
        <span className="absolute bottom-1 right-1 text-[9px] font-bold text-blue-100 bg-blue-800/40 px-1 rounded-sm leading-none">
          AI
        </span>

      </div>

      {/* WORDMARK */}
      <div className="flex items-baseline gap-1">
        <span className="text-white font-bold text-xl tracking-tight">
          Ref
        </span>
        <span className="text-blue-400 font-bold text-xl tracking-tight">
          AI
        </span>
      </div>

    </div>
  );
}