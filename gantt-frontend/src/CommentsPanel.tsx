import { useEffect, useState } from 'react';
import { getComments, addComment, deleteComment } from './api/tasksApi';
import type { Comment } from './api/tasksApi';

interface Props {
  taskId: string;
  author?: string;
}

export default function CommentsPanel({ taskId, author = 'Пользователь' }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getComments(taskId);
      setComments(data);
    } catch (e) {
      console.error(e);
      setError('Не удалось загрузить комментарии');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    try {
      setError('');
      await addComment(taskId, author, text.trim());
      setText('');
      await load();
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? 'Не удалось добавить комментарий');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить комментарий?')) return;
    try {
      setError('');
      await deleteComment(id);
      await load();
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? 'Не удалось удалить комментарий');
    }
  };

  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      <h3 className="text-sm font-bold text-gray-700 mb-3">
        Комментарии ({comments.length})
      </h3>

      {loading ? (
        <p className="text-xs text-gray-400 mb-3">Загрузка...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-400 mb-3">Пока нет комментариев</p>
      ) : (
        <ul className="space-y-2 max-h-40 overflow-y-auto mb-3 pr-1">
          {comments.map((c) => (
            <li
              key={c.id}
              className="p-2 bg-gray-50 rounded-lg border border-gray-100"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">
                    {c.author}
                  </p>
                  <p className="text-sm text-gray-800 mt-0.5 break-words">
                    {c.text}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {c.createdAt
                      ? new Date(c.createdAt).toLocaleString('ru-RU')
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="text-red-400 hover:text-red-600 text-xs shrink-0"
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Написать комментарий..."
          className="flex-1 border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-3 py-2 rounded-lg transition-colors"
        >
          Отправить
        </button>
      </form>

      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
    </div>
  );
}