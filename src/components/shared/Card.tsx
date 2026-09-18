import { useState, type CSSProperties, type ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  action?: ReactNode;
}

export function Card({ title, subtitle, description, children, className = '', style, action }: CardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`} style={style}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            <div className="flex items-center gap-1.5">
              {title && <h3 className="text-sm font-semibold text-gray-700">{title}</h3>}
              {description && (
                <div
                  className="relative"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  <svg className="h-3.5 w-3.5 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {showTooltip && (
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-48 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
                      {description}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-gray-900" />
                    </div>
                  )}
                </div>
              )}
            </div>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
