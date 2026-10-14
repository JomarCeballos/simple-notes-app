
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../css/app.css';

const CATEGORIES = ['School', 'Personal', 'Work', 'Ideas'];

const CATEGORY_ICONS = {
    School: '\u{1F4DA}',
    Personal: '\u{1F464}',
    Work: '\u{1F4BC}',
    Ideas: '\u{1F4A1}',
};

function updateCsrfToken(token) {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta && token) meta.content = token;
}

async function request(url, options = {}) {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content;

    const response = await fetch(url, {
        ...options,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
            ...options.headers,
        },
    });

    const type = response.headers.get('content-type') || '';
    const data = type.includes('application/json')
        ? await response.json()
        : {};

    if (!response.ok) {
        const error = data.errors
            ? Object.values(data.errors).flat().join(' ')
            : data.message || `Request failed (${response.status})`;

        throw new Error(error);
    }

    updateCsrfToken(data.csrf_token);
    return data;
}

function App() {
    const [page, setPage] = useState('login');
    const [user, setUser] = useState(null);
    const [notes, setNotes] = useState([]);
    const [search, setSearch] = useState('');

    const [activeFilter, setActiveFilter] = useState('all');
    const [activeCategory, setActiveCategory] = useState('all');

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('Personal');
    const [editingId, setEditingId] = useState(null);

    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    // Restore the saved theme when the app starts.
    const [darkMode, setDarkMode] = useState(
        () => localStorage.getItem('simple-notes-theme') === 'dark'
    );

    // Apply the selected theme and remember it in this browser.
    useEffect(() => {
        document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
        localStorage.setItem(
            'simple-notes-theme',
            darkMode ? 'dark' : 'light'
        );
    }, [darkMode]);

    function toggleTheme() {
        setDarkMode((previous) => !previous);
    }

    async function loadNotes() {
        const data = await request('/notes');

        const sortedNotes = (data.notes || []).sort(
            (a, b) =>
                Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
        );

        setNotes(sortedNotes);
    }

    useEffect(() => {
        request('/user')
            .then(async (data) => {
                setUser(data.user);
                setPage('notes');

                try {
                    await loadNotes();
                } catch (error) {
                    setMessage(`Could not load notes: ${error.message}`);
                }
            })
            .catch(() => setUser(null));
    }, []);

    function updateField(event) {
        setForm({
            ...form,
            [event.target.name]: event.target.value,
        });
    }

    async function submitForm(event) {
        event.preventDefault();
        setMessage('');
        setLoading(true);

        try {
            const endpoint = page === 'register' ? '/register' : '/login';

            const data = await request(endpoint, {
                method: 'POST',
                body: JSON.stringify(form),
            });

            setUser(data.user);
            setPage('notes');

            setForm({
                name: '',
                email: '',
                password: '',
                password_confirmation: '',
            });

            setMessage(data.message || 'Login successful.');

            try {
                await loadNotes();
            } catch (error) {
                setMessage(
                    `You are logged in, but notes could not load: ${error.message}`
                );
            }
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }

    function resetNoteForm() {
        setTitle('');
        setContent('');
        setCategory('Personal');
        setEditingId(null);
    }

    async function saveNote(event) {
        event.preventDefault();
        setMessage('');
        setLoading(true);

        try {
            const editing = editingId !== null;

            const data = await request(
                editing ? `/notes/${editingId}` : '/notes',
                {
                    method: editing ? 'PUT' : 'POST',
                    body: JSON.stringify({
                        title,
                        content,
                        category,
                    }),
                }
            );

            await loadNotes();
            resetNoteForm();

            setMessage(data.message || 'Note saved successfully.');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }

    function editNote(note) {
        setEditingId(note.id);
        setTitle(note.title);
        setContent(note.content || '');
        setCategory(
            CATEGORIES.includes(note.category)
                ? note.category
                : 'Personal'
        );

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function togglePin(note) {
        setMessage('');

        try {
            const data = await request(`/notes/${note.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title: note.title,
                    content: note.content || '',
                    category: CATEGORIES.includes(note.category)
                        ? note.category
                        : 'Personal',
                    pinned: !note.pinned,
                }),
            });

            setNotes((previous) =>
                previous
                    .map((item) => item.id === note.id ? data.note : item)
                    .sort(
                        (a, b) =>
                            Number(Boolean(b.pinned)) -
                            Number(Boolean(a.pinned))
                    )
            );

            setMessage(
                data.message ||
                (note.pinned ? 'Note unpinned.' : 'Note pinned.')
            );
        } catch (error) {
            setMessage(error.message);
        }
    }

    async function deleteNote(id) {
        if (!window.confirm('Are you sure you want to delete this note?')) {
            return;
        }

        setMessage('');

        try {
            const data = await request(`/notes/${id}`, {
                method: 'DELETE',
                body: JSON.stringify({}),
            });

            setNotes((previous) =>
                previous.filter((note) => note.id !== id)
            );

            if (editingId === id) resetNoteForm();

            setMessage(data.message || 'Note deleted successfully.');
        } catch (error) {
            setMessage(error.message);
        }
    }

    async function logout() {
        setLoading(true);

        try {
            const data = await request('/logout', {
                method: 'POST',
                body: JSON.stringify({}),
            });

            setUser(null);
            setNotes([]);
            setPage('login');
            setActiveFilter('all');
            setActiveCategory('all');
            setSearch('');
            resetNoteForm();

            setMessage(data.message || 'Logged out successfully.');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }

    function selectFilter(filter) {
        setActiveFilter(filter);
        setActiveCategory('all');
    }

    function selectCategory(selectedCategory) {
        setActiveCategory(selectedCategory);
        setActiveFilter('all');
    }

    // Login and registration page
    if (!user) {
        return (
            <main className="welcome">
                <button
                    type="button"
                    className="auth-theme-toggle"
                    onClick={toggleTheme}
                    aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                    title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {darkMode ? '☀️ Light mode' : '🌙 Dark mode'}
                </button>

                <section className="notes-card">
                    <div className="brand-mark">SN</div>
                    <p className="eyebrow">YOUR PERSONAL WORKSPACE</p>
                    <h1>Simple Notes</h1>
                    <p>
                        {page === 'register'
                            ? 'Create an account and keep your thoughts organized.'
                            : 'Welcome back. Your thoughts are waiting for you.'}
                    </p>

                    {message && (
                        <p className="message" role="status">{message}</p>
                    )}

                    <form onSubmit={submitForm}>
                        {page === 'register' && (
                            <label>
                                Full name
                                <input
                                    name="name"
                                    value={form.name}
                                    onChange={updateField}
                                    autoComplete="name"
                                    required
                                    maxLength={255}
                                />
                            </label>
                        )}

                        <label>
                            Email address
                            <input
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={updateField}
                                autoComplete="email"
                                required
                            />
                        </label>

                        <label>
                            Password
                            <input
                                name="password"
                                type="password"
                                value={form.password}
                                onChange={updateField}
                                autoComplete={
                                    page === 'register'
                                        ? 'new-password'
                                        : 'current-password'
                                }
                                minLength={8}
                                required
                            />
                        </label>

                        {page === 'register' && (
                            <label>
                                Confirm password
                                <input
                                    name="password_confirmation"
                                    type="password"
                                    value={form.password_confirmation}
                                    onChange={updateField}
                                    autoComplete="new-password"
                                    minLength={8}
                                    required
                                />
                            </label>
                        )}

                        <button type="submit" disabled={loading}>
                            {loading
                                ? 'Please wait...'
                                : page === 'register'
                                    ? 'Create account'
                                    : 'Log in'}
                        </button>
                    </form>

                    <p className="switch-page">
                        {page === 'register'
                            ? 'Already have an account?'
                            : "Don't have an account?"}{' '}

                        <button
                            type="button"
                            className="text-button"
                            onClick={() => {
                                setPage(
                                    page === 'register' ? 'login' : 'register'
                                );
                                setMessage('');
                            }}
                        >
                            {page === 'register'
                                ? 'Log in'
                                : 'Create an account'}
                        </button>
                    </p>
                </section>
            </main>
        );
    }

    const filteredNotes = notes.filter((note) => {
        const text = `${note.title} ${note.content || ''}`.toLowerCase();
        const matchesSearch = text.includes(search.toLowerCase());

        const matchesFilter =
            activeFilter === 'all' ||
            (activeFilter === 'pinned' && Boolean(note.pinned));

        const noteCategory = CATEGORIES.includes(note.category)
            ? note.category
            : 'Personal';

        const matchesCategory =
            activeCategory === 'all' ||
            noteCategory === activeCategory;

        return matchesSearch && matchesFilter && matchesCategory;
    });

    const pinnedCount = notes.filter((note) => Boolean(note.pinned)).length;

    const categoryCounts = CATEGORIES.reduce((counts, item) => {
        counts[item] = notes.filter(
            (note) => (CATEGORIES.includes(note.category)
                ? note.category
                : 'Personal') === item
        ).length;

        return counts;
    }, {});

    const pageTitle =
        activeFilter === 'pinned'
            ? 'Pinned Notes'
            : activeCategory !== 'all'
                ? activeCategory
                : 'My Notes';

    return (
        <main className="notes-dashboard">
            <aside className="app-sidebar">
                <div className="sidebar-brand">
                    <div className="brand-mark">SN</div>
                    <span>Simple Notes</span>
                </div>

                <p className="sidebar-label">WORKSPACE</p>

                <nav className="sidebar-nav">
                    <button
                        type="button"
                        className={
                            activeFilter === 'all' && activeCategory === 'all'
                                ? 'active'
                                : ''
                        }
                        onClick={() => {
                            setActiveFilter('all');
                            setActiveCategory('all');
                        }}
                    >
                        <span className="nav-icon">{'\u{1F5C2}'}</span>
                        <span>All Notes</span>
                        <span className="nav-count">{notes.length}</span>
                    </button>

                    <button
                        type="button"
                        className={activeFilter === 'pinned' ? 'active' : ''}
                        onClick={() => selectFilter('pinned')}
                    >
                        <span className="nav-icon">{'\u{1F4CC}'}</span>
                        <span>Pinned Notes</span>
                        <span className="nav-count">{pinnedCount}</span>
                    </button>
                </nav>

                <p className="sidebar-label category-sidebar-label">
                    CATEGORIES
                </p>

                <nav className="sidebar-nav category-nav">
                    {CATEGORIES.map((item) => (
                        <button
                            type="button"
                            key={item}
                            className={activeCategory === item ? 'active' : ''}
                            onClick={() => selectCategory(item)}
                        >
                            <span className="nav-icon">
                                {CATEGORY_ICONS[item]}
                            </span>
                            <span>{item}</span>
                            <span className="nav-count">
                                {categoryCounts[item]}
                            </span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    <div className="profile-avatar">
                        {(user?.name || user?.email || 'U')
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                    </div>

                    <div className="profile-info">
                        <strong>{user?.name || user?.email || 'User'}</strong>
                        <span>Personal workspace</span>
                    </div>
                </div>
            </aside>

            <section className="dashboard-main">
                <header className="dashboard-header">
                    <div>
                        <p className="eyebrow">YOUR WORKSPACE</p>
                        <h1>{pageTitle}</h1>
                        <p className="dashboard-subtitle">
                            Keep your ideas organized, all in one place.
                        </p>
                    </div>

                    <div className="header-actions">
                        <button
                            type="button"
                            className="theme-toggle"
                            onClick={toggleTheme}
                            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {darkMode ? '☀️ Light mode' : '🌙 Dark mode'}
                        </button>

                        <button
                            type="button"
                            className="logout-button"
                            onClick={logout}
                            disabled={loading}
                        >
                            Log out
                        </button>
                    </div>
                </header>

                {message && (
                    <p className="message" role="status">{message}</p>
                )}

                <section className="note-editor">
                    <div className="editor-heading">
                        <div className="editor-icon">{'\u{270D}\u{FE0F}'}</div>
                        <div>
                            <h2>
                                {editingId !== null
                                    ? 'Edit your note'
                                    : 'Create a note'}
                            </h2>
                            <p>Capture a thought before it slips away.</p>
                        </div>
                    </div>

                    <form onSubmit={saveNote}>
                        <label>
                            Note title
                            <input
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                maxLength={255}
                                placeholder="Give your note a title..."
                                required
                            />
                        </label>

                        <label>
                            Category
                            <select
                                value={category}
                                onChange={(event) => setCategory(event.target.value)}
                                required
                            >
                                {CATEGORIES.map((item) => (
                                    <option key={item} value={item}>
                                        {CATEGORY_ICONS[item]} {item}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Content
                            <textarea
                                value={content}
                                onChange={(event) => setContent(event.target.value)}
                                placeholder="Start writing your thoughts here..."
                                rows={4}
                            />
                        </label>

                        <div className="note-actions">
                            <button type="submit" disabled={loading}>
                                {loading
                                    ? 'Saving...'
                                    : editingId !== null
                                        ? 'Save changes'
                                        : '+ Save note'}
                            </button>

                            {editingId !== null && (
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={resetNoteForm}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </section>

                <section className="notes-list">
                    <div className="notes-list-header">
                        <div>
                            <h2>
                                {activeFilter === 'pinned'
                                    ? 'Your pinned notes'
                                    : activeCategory !== 'all'
                                        ? `${activeCategory} notes`
                                        : 'All your notes'}
                            </h2>
                            <p>
                                {filteredNotes.length}{' '}
                                {filteredNotes.length === 1 ? 'note' : 'notes'} in this view
                            </p>
                        </div>

                        <input
                            aria-label="Search notes"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={'\u{1F50D} Search your notes...'}
                        />
                    </div>

                    {filteredNotes.length === 0 ? (
                        <div className="empty-notes">
                            <div className="empty-icon">
                                {activeFilter === 'pinned'
                                    ? '\u{1F4CC}'
                                    : '\u{1F4DD}'}
                            </div>

                            <h3>
                                {search
                                    ? 'No matching notes'
                                    : activeFilter === 'pinned'
                                        ? 'No pinned notes yet'
                                        : activeCategory !== 'all'
                                            ? `No ${activeCategory.toLowerCase()} notes yet`
                                            : 'Your space is ready'}
                            </h3>

                            <p>
                                {search
                                    ? 'Try another search term.'
                                    : activeFilter === 'pinned'
                                        ? 'Pin a note to keep it easy to find.'
                                        : activeCategory !== 'all'
                                            ? `Create a note and choose ${activeCategory} as its category.`
                                            : 'Create your first note using the editor above.'}
                            </p>

                            {activeFilter === 'pinned' && !search && (
                                <button
                                    type="button"
                                    onClick={() => selectFilter('all')}
                                >
                                    Browse all notes
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="notes-grid">
                            {filteredNotes.map((note) => {
                                const noteCategory = CATEGORIES.includes(note.category)
                                    ? note.category
                                    : 'Personal';

                                return (
                                    <article className="note-item" key={note.id}>
                                        <div className="note-card-top">
                                            <span
                                                className={`note-tag category-tag category-${noteCategory.toLowerCase()}`}
                                            >
                                                {CATEGORY_ICONS[noteCategory]} {noteCategory}
                                            </span>

                                            <button
                                                type="button"
                                                className="pin-button"
                                                aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                                                title={note.pinned ? 'Unpin note' : 'Pin note'}
                                                onClick={() => togglePin(note)}
                                            >
                                                {note.pinned
                                                    ? '\u{1F4CC}'
                                                    : '\u{1F4CD}'}
                                            </button>
                                        </div>

                                        {note.pinned && (
                                            <span className="pinned-indicator">
                                                {'\u{1F4CC}'} Pinned
                                            </span>
                                        )}

                                        <h3>{note.title}</h3>

                                        <p className="note-content">
                                            {note.content || 'No content added.'}
                                        </p>

                                        <small>
                                            Updated {new Date(note.updated_at).toLocaleString()}
                                        </small>

                                        <div className="note-actions">
                                            <button
                                                type="button"
                                                onClick={() => editNote(note)}
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                className="delete-button"
                                                onClick={() => deleteNote(note.id)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>

                <footer className="dashboard-footer">
                    Made for your thoughts. <span>Simple Notes</span>
                </footer>
            </section>
        </main>
    );
}

createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
