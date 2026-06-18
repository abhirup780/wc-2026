import { flagUrl, teamName } from '../utils.ts';

interface FlagProps {
  code: string;
  size?: number;
  className?: string;
}

export default function Flag({ code, size = 28, className = '' }: FlagProps) {
  const src = flagUrl(code, size <= 36 ? 40 : 80);
  if (!src) return <span className="inline-block bg-gray-800 rounded-sm" style={{ width: size, height: Math.round(size * 0.67) }} />;
  return (
    <img
      src={src}
      alt={teamName(code)}
      width={size}
      height={Math.round(size * 0.67)}
      className={`rounded shadow-sm object-cover flex-shrink-0 ${className}`}
      loading="lazy"
    />
  );
}
