import { useEffect, useState } from 'react';

interface Props {
  count: number;
  onClose: () => void;
  durationMs?: number;
}

export default function OverdueToast({
  count,
  onClose,
  durationMs = 7000,
}: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (count === 0) {
      setVisible(false);
      return;
    }
    setVisible(true);

    const t = setTimeout(() => {
      setVisible(false);
      onClose();
    }, durationMs);

    return () => clearTimeout(t);
  }, [count, durationMs, onClose]);

  if (!visible || count === 0) return null;

  const label =
    count === 1
      ? 'просроченная задача'
      : count < 5
      ? 'просроченные задачи'
      : 'просроченных задач';

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-white border-l-4 border-red-500 shadow-lg rounded-lg p-4 flex items-start gap-3">
        <div className="text-2xl">⚠️</div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">
            Просроченные задачи
          </p>
          <p className="text-xs text-gray-600 mt-1">
            У вас {count} {label}. Проверьте сроки.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onClose();
          }}
          className="text-gray-400 hover:text-gray-600 text-sm shrink-0"
          title="Закрыть"
        >
          ✕
        </button>
      </div>
    </div>
  );
}