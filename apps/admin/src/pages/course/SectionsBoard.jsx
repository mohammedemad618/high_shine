import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../../api/client.js';
import { EmptyState, ErrorBox } from '../../components/ui.jsx';
import LessonRow from './LessonRow.jsx';
import { sectionsPayload, setCourseDetails } from './courseCache.js';

// Sortable ids are prefixed so sections and lessons can share one DndContext.
const sKey = (id) => `s:${id}`;
const lKey = (id) => `l:${id}`;
const isSectionKey = (key) => String(key).startsWith('s:');

const toBoard = (sections) => sections.map((s) => ({ id: s.id, title: s.title, lessons: s.lessons }));

function findSectionIndex(board, key) {
  if (isSectionKey(key)) return board.findIndex((s) => sKey(s.id) === key);
  return board.findIndex((s) => s.lessons.some((l) => lKey(l.id) === key));
}

/** Sections collide only with sections; lessons prefer the lesson under the pointer, then the section. */
function collisionDetection(args) {
  const type = args.active.data.current?.type;
  if (type === 'section') {
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === 'section') });
  }
  const targets = args.droppableContainers.filter((c) => c.id !== args.active.id);
  const within = pointerWithin({ ...args, droppableContainers: targets });
  if (within.length) return [within.find((c) => !isSectionKey(c.id)) || within[0]];
  return closestCorners({ ...args, droppableContainers: targets });
}

const DragHandle = ({ setRef, listeners, attributes, label }) => (
  <button type="button" className="drag-handle" ref={setRef} {...attributes} {...listeners} aria-label={label}>
    ⠿
  </button>
);

function SortableLesson({ lesson, courseId }) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, transition, isDragging } = useSortable({
    id: lKey(lesson.id),
    data: { type: 'lesson' },
  });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={isDragging ? 'dragging' : ''}>
      <LessonRow
        lesson={lesson}
        courseId={courseId}
        handle={<DragHandle setRef={setActivatorNodeRef} listeners={listeners} attributes={attributes} label="اسحب لنقل الدرس" />}
      />
    </li>
  );
}

function SortableSection({ section, courseId, onRename, onDelete, busy }) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, transition, isDragging } = useSortable({
    id: sKey(section.id),
    data: { type: 'section' },
  });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={`section${isDragging ? ' dragging' : ''}`}>
      <header className="section-header">
        <DragHandle setRef={setActivatorNodeRef} listeners={listeners} attributes={attributes} label="اسحب لترتيب القسم" />
        {editing ? (
          <form
            className="inline-form grow"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!title.trim()) return;
              if (await onRename(section.id, title.trim())) setEditing(false);
            }}
          >
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} autoFocus />
            <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
              حفظ
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setTitle(section.title);
                setEditing(false);
              }}
            >
              إلغاء
            </button>
          </form>
        ) : (
          <>
            <h3 className="section-title grow">
              {section.title} <span className="muted small">({section.lessons.length} درس)</span>
            </h3>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(true)}>
              إعادة التسمية
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost danger"
              disabled={busy}
              title={section.lessons.length ? 'انقل الدروس أو احذفها أولاً' : undefined}
              onClick={() => onDelete(section)}
            >
              حذف
            </button>
          </>
        )}
      </header>
      <SortableContext items={section.lessons.map((l) => lKey(l.id))} strategy={verticalListSortingStrategy}>
        <ul className="lesson-list">
          {section.lessons.map((lesson) => (
            <SortableLesson key={lesson.id} lesson={lesson} courseId={courseId} />
          ))}
        </ul>
        {!section.lessons.length && <div className="drop-empty">لا توجد دروس — اسحب درساً إلى هنا أو ارفع فيديوهات</div>}
      </SortableContext>
    </div>
  );
}

export default function SectionsBoard({ courseId, sections }) {
  const qc = useQueryClient();
  const [board, setBoard] = useState(() => toBoard(sections));
  const [activeKey, setActiveKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const startBoard = useRef(null); // board when the drag started (for cancel / revert)

  // Follow server data, except while the user is dragging.
  useEffect(() => {
    if (!startBoard.current) setBoard(toBoard(sections));
  }, [sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function patchCourse(body, revertTo) {
    setBusy(true);
    setError(null);
    try {
      const data = await api(`/courses/${courseId}`, { method: 'PATCH', body });
      setCourseDetails(qc, courseId, data);
      return true;
    } catch (err) {
      setError(err);
      if (revertTo) setBoard(revertTo);
      return false;
    } finally {
      setBusy(false);
    }
  }

  // ---- sections ----
  const renameSection = (id, title) => patchCourse({ sections: sectionsPayload(board.map((s) => (s.id === id ? { ...s, title } : s))) });

  function deleteSection(section) {
    if (section.lessons.length) {
      setError({ message: 'لا يمكن حذف قسم يحتوي على دروس. انقل الدروس أو احذفها أولاً.' });
      return;
    }
    if (!window.confirm(`حذف القسم «${section.title}»؟`)) return;
    patchCourse({ sections: sectionsPayload(board.filter((s) => s.id !== section.id)) });
  }

  async function addSection(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    if (await patchCourse({ sections: [...sectionsPayload(board), { title }] })) setNewTitle('');
  }

  // ---- drag & drop ----
  function onDragStart({ active }) {
    startBoard.current = board;
    setActiveKey(active.id);
    setError(null);
  }

  // Moving a lesson into another section happens live while dragging.
  function onDragOver({ active, over }) {
    if (!over || active.data.current?.type !== 'lesson') return;
    setBoard((prev) => {
      const from = findSectionIndex(prev, active.id);
      const to = findSectionIndex(prev, over.id);
      if (from < 0 || to < 0 || from === to) return prev;
      const lesson = prev[from].lessons.find((l) => lKey(l.id) === active.id);
      let insertAt = prev[to].lessons.length;
      if (!isSectionKey(over.id)) {
        const overIndex = prev[to].lessons.findIndex((l) => lKey(l.id) === over.id);
        const activeRect = active.rect.current.translated;
        const below = activeRect && over.rect && activeRect.top > over.rect.top + over.rect.height / 2;
        insertAt = overIndex + (below ? 1 : 0);
      }
      return prev.map((s, i) => {
        if (i === from) return { ...s, lessons: s.lessons.filter((l) => l.id !== lesson.id) };
        if (i === to) return { ...s, lessons: [...s.lessons.slice(0, insertAt), { ...lesson, sectionId: s.id }, ...s.lessons.slice(insertAt)] };
        return s;
      });
    });
  }

  function onDragCancel() {
    if (startBoard.current) setBoard(startBoard.current);
    startBoard.current = null;
    setActiveKey(null);
  }

  function onDragEnd({ active, over }) {
    const original = startBoard.current;
    startBoard.current = null;
    setActiveKey(null);
    if (!over || !original) {
      if (original) setBoard(original);
      return;
    }

    if (active.data.current?.type === 'section') {
      const oldIndex = board.findIndex((s) => sKey(s.id) === active.id);
      const newIndex = board.findIndex((s) => sKey(s.id) === over.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = arrayMove(board, oldIndex, newIndex);
      setBoard(next);
      patchCourse({ sections: sectionsPayload(next) }, original);
      return;
    }

    // Lesson: finish the move inside its (possibly new) section.
    let next = board;
    const si = findSectionIndex(board, active.id);
    if (si >= 0 && !isSectionKey(over.id) && over.id !== active.id) {
      const lessons = board[si].lessons;
      const from = lessons.findIndex((l) => lKey(l.id) === active.id);
      const to = lessons.findIndex((l) => lKey(l.id) === over.id);
      if (from >= 0 && to >= 0) next = board.map((s, i) => (i === si ? { ...s, lessons: arrayMove(lessons, from, to) } : s));
    }
    setBoard(next);

    // Send the order of every section whose lesson list changed.
    const before = new Map(original.map((s) => [s.id, s.lessons.map((l) => l.id).join(',')]));
    const lessonOrder = next
      .filter((s) => before.get(s.id) !== s.lessons.map((l) => l.id).join(','))
      .flatMap((s) => s.lessons.map((l, order) => ({ lessonId: l.id, sectionId: s.id, order })));
    if (lessonOrder.length) patchCourse({ lessonOrder }, original);
  }

  const activeSection = activeKey && isSectionKey(activeKey) ? board.find((s) => sKey(s.id) === activeKey) : null;
  const activeLesson = activeKey && !isSectionKey(activeKey) ? board.flatMap((s) => s.lessons).find((l) => lKey(l.id) === activeKey) : null;

  return (
    <div className="board">
      <ErrorBox error={error} />
      {!board.length && <EmptyState>لا توجد أقسام. أضف قسماً للبدء.</EmptyState>}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <SortableContext items={board.map((s) => sKey(s.id))} strategy={verticalListSortingStrategy}>
          {board.map((section) => (
            <SortableSection
              key={section.id}
              section={section}
              courseId={courseId}
              onRename={renameSection}
              onDelete={deleteSection}
              busy={busy}
            />
          ))}
        </SortableContext>
        <DragOverlay>
          {activeSection && <div className="drag-overlay">{activeSection.title}</div>}
          {activeLesson && <div className="drag-overlay">{activeLesson.title}</div>}
        </DragOverlay>
      </DndContext>

      <form className="inline-form add-section" onSubmit={addSection}>
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="اسم القسم الجديد" maxLength={150} />
        <button type="submit" className="btn" disabled={busy || !newTitle.trim()}>
          + إضافة قسم
        </button>
      </form>
    </div>
  );
}
